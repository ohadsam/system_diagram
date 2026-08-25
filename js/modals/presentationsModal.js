// "🎬 Presentations" — build an ordered slideshow out of saved diagram
// versions (see modals/versionHistoryModal.js), play it back
// (modals/presentationPlayerModal.js), or export it to PowerPoint
// (io/exportPptx.js). See docs/ARCHITECTURE.md's "Presentations" section.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { textInput, field } from '../utils/formControls.js';
import * as store from '../core/store.js';
import { savePresentation, deletePresentation } from '../canvas/canvas.js';
import { confirmAction } from './confirmModal.js';
import { showToast } from '../utils/toast.js';
import { openPresentationPlayer } from './presentationPlayerModal.js';
import { exportPresentationToPptx } from '../io/exportPptx.js';

export function openPresentationsModal() {
  let mode = 'list'; // 'list' | 'build'
  let editingId = null;
  let draftName = '';
  let draftSlides = []; // [{versionId, title, notes}]
  let render;

  openModal({
    title: 'Presentations',
    className: 'presentations-modal',
    render: (body) => {
      render = () => renderBody(body);
      render();
    },
  });

  function startNew() {
    const state = store.getState();
    mode = 'build';
    editingId = null;
    draftName = `Presentation ${(state.presentations?.length || 0) + 1}`;
    draftSlides = [];
    render();
  }

  function startEdit(presentation) {
    mode = 'build';
    editingId = presentation.id;
    draftName = presentation.name;
    draftSlides = presentation.slides.map((s) => ({ ...s }));
    render();
  }

  function renderBody(body) {
    clear(body);
    if (mode === 'list') renderList(body);
    else renderBuild(body);
  }

  function renderList(body) {
    const state = store.getState();
    const presentations = state.presentations || [];

    body.appendChild(el('p', {
      class: 'modal-hint',
      text: 'Assemble a slideshow out of saved diagram versions to show how the design evolved — play it back here, or export it to PowerPoint.',
    }));
    body.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: '+ New Presentation', onClick: startNew }));

    if (!presentations.length) {
      body.appendChild(el('p', { class: 'presentations-empty', text: 'No presentations yet.' }));
      return;
    }

    const list = el('div', { class: 'presentations-list' });
    for (const p of presentations) {
      const row = el('div', { class: 'presentations-row' });
      const info = el('div', { class: 'presentations-info' });
      info.appendChild(el('span', { class: 'presentations-name', text: p.name }));
      info.appendChild(el('span', { class: 'presentations-meta', text: `${p.slides.length} slide(s)` }));
      row.appendChild(info);

      const actions = el('div', { class: 'presentations-actions' });
      actions.appendChild(el('button', {
        type: 'button', class: 'btn btn-sm', text: '▶️ Play', disabled: !p.slides.length,
        onClick: () => openPresentationPlayer(p),
      }));
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: '✏️ Edit', onClick: () => startEdit(p) }));
      actions.appendChild(el('button', {
        type: 'button', class: 'btn btn-sm', text: '🎬 Export PPTX', disabled: !p.slides.length,
        onClick: async (e) => {
          const btn = e.currentTarget;
          const original = btn.textContent;
          btn.disabled = true;
          btn.textContent = 'Rendering…';
          try {
            await exportPresentationToPptx(p);
          } catch (err) {
            showToast(`Could not export: ${err.message || err}`, 'error');
          } finally {
            btn.disabled = false;
            btn.textContent = original;
          }
        },
      }));
      actions.appendChild(el('button', {
        type: 'button', class: 'btn btn-sm btn-danger', text: '🗑️ Delete',
        onClick: async () => {
          const ok = await confirmAction({ title: 'Delete presentation', message: `Delete "${p.name}"? This cannot be undone (its saved versions are untouched).`, confirmLabel: 'Delete' });
          if (!ok) return;
          deletePresentation(p.id);
          render();
        },
      }));
      row.appendChild(actions);
      list.appendChild(row);
    }
    body.appendChild(list);
  }

  function renderBuild(body) {
    const state = store.getState();
    const versions = state.versions || [];
    const usedIds = new Set(draftSlides.map((s) => s.versionId));
    const available = versions.filter((v) => !usedIds.has(v.id));

    const backBtn = el('button', { type: 'button', class: 'btn btn-sm', text: '← Back to list', onClick: () => { mode = 'list'; render(); } });
    body.appendChild(backBtn);

    const nameInput = textInput(draftName, (v) => { draftName = v; }, { maxLength: 80 });
    body.appendChild(field('Presentation name', nameInput));

    if (!versions.length) {
      body.appendChild(el('p', { class: 'presentations-empty', text: 'No saved versions yet — use "📸 Version History" (File menu) to save a few first.' }));
      return;
    }

    body.appendChild(el('h3', { text: `Slides (${draftSlides.length})` }));
    if (!draftSlides.length) {
      body.appendChild(el('p', { class: 'presentations-empty small', text: 'Add versions below to build the slideshow.' }));
    }
    const slideList = el('div', { class: 'presentations-slide-list' });
    draftSlides.forEach((slide, idx) => {
      const version = versions.find((v) => v.id === slide.versionId);
      const row = el('div', { class: 'presentations-slide-row' });
      row.appendChild(el('span', { class: 'presentations-slide-index', text: `${idx + 1}.` }));
      const titleInput = textInput(slide.title || version?.name || '', (v) => { slide.title = v; }, { placeholder: version?.name || 'Slide title', maxLength: 80 });
      row.appendChild(titleInput);
      const moveUp = el('button', { type: 'button', class: 'btn btn-icon', title: 'Move up', 'aria-label': 'Move slide up', text: '⬆️', disabled: idx === 0, onClick: () => { [draftSlides[idx - 1], draftSlides[idx]] = [draftSlides[idx], draftSlides[idx - 1]]; render(); } });
      const moveDown = el('button', { type: 'button', class: 'btn btn-icon', title: 'Move down', 'aria-label': 'Move slide down', text: '⬇️', disabled: idx === draftSlides.length - 1, onClick: () => { [draftSlides[idx + 1], draftSlides[idx]] = [draftSlides[idx], draftSlides[idx + 1]]; render(); } });
      const removeBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Remove from presentation', 'aria-label': 'Remove slide', text: '✕', onClick: () => { draftSlides.splice(idx, 1); render(); } });
      row.appendChild(moveUp);
      row.appendChild(moveDown);
      row.appendChild(removeBtn);
      slideList.appendChild(row);
    });
    body.appendChild(slideList);

    if (available.length) {
      body.appendChild(el('h3', { text: 'Available versions' }));
      const availList = el('div', { class: 'presentations-available-list' });
      for (const v of available) {
        const row = el('div', { class: 'presentations-available-row' });
        row.appendChild(el('span', { text: v.name }));
        row.appendChild(el('button', {
          type: 'button', class: 'btn btn-sm', text: '+ Add',
          onClick: () => { draftSlides.push({ versionId: v.id, title: v.name, notes: '' }); render(); },
        }));
        availList.appendChild(row);
      }
      body.appendChild(availList);
    }

    const actions = el('div', { class: 'modal-actions' });
    const primary = el('div', { class: 'modal-actions-primary' });
    primary.appendChild(el('button', {
      type: 'button', class: 'btn btn-primary', text: 'Save Presentation', disabled: !draftSlides.length,
      onClick: () => {
        savePresentation({ id: editingId, name: draftName, slides: draftSlides });
        showToast('Presentation saved.', 'success', 1800);
        mode = 'list';
        render();
      },
    }));
    actions.appendChild(primary);
    body.appendChild(actions);
  }
}
