// "📸 Version History" — save named snapshots of the current diagram,
// revert to one later, delete one, or compare any two (including "Current")
// via modals/diagramCompareModal.js. See docs/ARCHITECTURE.md's "Diagram
// Versions" section and core/project.js's versions schema.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { selectInput } from '../utils/formControls.js';
import * as store from '../core/store.js';
import { saveDiagramVersion, revertToVersion, deleteVersion } from '../canvas/canvas.js';
import { promptText } from './promptModal.js';
import { confirmAction } from './confirmModal.js';
import { openDiagramCompareModal } from './diagramCompareModal.js';
import { showToast } from '../utils/toast.js';

const CURRENT_ID = '__current__';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function contentOf(state, versionId) {
  if (versionId === CURRENT_ID) return { nodes: state.nodes, edges: state.edges };
  const version = state.versions.find((v) => v.id === versionId);
  return version ? version.snapshot : { nodes: [], edges: [] };
}

function labelOf(state, versionId) {
  if (versionId === CURRENT_ID) return 'Current';
  return state.versions.find((v) => v.id === versionId)?.name || 'Version';
}

export function openVersionHistoryModal() {
  let render;

  const api = openModal({
    title: 'Version History',
    className: 'version-history-modal',
    render: (body) => {
      render = () => renderBody(body);
      render();
    },
  });

  function renderBody(body) {
    clear(body);
    const state = store.getState();
    const versions = [...state.versions].reverse(); // newest first

    body.appendChild(el('p', {
      class: 'modal-hint',
      text: 'Capture named snapshots of this diagram — revert to one any time, or compare two to see what changed. Saved with the project (JSON export/backup included).',
    }));

    body.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-primary',
      text: '📸 Save Version',
      onClick: async () => {
        const name = await promptText({ title: 'Save Version', label: 'Version name', defaultValue: `Version ${state.versions.length + 1}`, confirmLabel: 'Save' });
        if (name == null) return;
        saveDiagramVersion(name);
        showToast('Version saved.', 'success', 1800);
        render();
      },
    }));

    if (!versions.length) {
      body.appendChild(el('p', { class: 'version-history-empty', text: 'No versions saved yet.' }));
      return;
    }

    const list = el('div', { class: 'version-history-list' });
    for (const v of versions) {
      const row = el('div', { class: 'version-history-row' });
      const info = el('div', { class: 'version-history-info' });
      info.appendChild(el('span', { class: 'version-history-name', text: v.name }));
      info.appendChild(el('span', {
        class: 'version-history-meta',
        text: `${formatDate(v.createdAt)} · ${v.snapshot.nodes.length} component(s), ${v.snapshot.edges.length} connector(s)`,
      }));
      row.appendChild(info);

      const actions = el('div', { class: 'version-history-actions' });
      actions.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-sm',
        text: '🔍 Compare with current',
        onClick: () => {
          const fresh = store.getState();
          openDiagramCompareModal({
            leftLabel: v.name,
            leftContent: v.snapshot,
            rightLabel: 'Current',
            rightContent: { nodes: fresh.nodes, edges: fresh.edges },
          });
        },
      }));
      actions.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-sm',
        text: '↩️ Revert',
        onClick: async () => {
          const ok = await confirmAction({
            title: 'Revert to this version?',
            message: `Replace the current canvas with "${v.name}"? This is undoable (Ctrl/Cmd+Z) right after.`,
            confirmLabel: 'Revert',
            danger: false,
          });
          if (!ok) return;
          revertToVersion(v.id);
          showToast(`Reverted to "${v.name}".`, 'success', 2000);
          api.close();
        },
      }));
      actions.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-sm btn-danger',
        text: '🗑️ Delete',
        onClick: async () => {
          const ok = await confirmAction({ title: 'Delete version', message: `Delete "${v.name}"? This cannot be undone.`, confirmLabel: 'Delete' });
          if (!ok) return;
          deleteVersion(v.id);
          render();
        },
      }));
      row.appendChild(actions);
      list.appendChild(row);
    }
    body.appendChild(list);

    if (versions.length >= 2) {
      body.appendChild(buildComparePicker(state));
    }
  }

  function buildComparePicker(state) {
    const wrap = el('div', { class: 'version-history-compare-picker' });
    wrap.appendChild(el('h3', { text: 'Compare any two' }));

    const optionIds = [CURRENT_ID, ...state.versions.map((v) => v.id)];
    const labelsMap = Object.fromEntries(optionIds.map((id) => [id, labelOf(state, id)]));
    let leftId = state.versions[0]?.id || CURRENT_ID;
    let rightId = CURRENT_ID;

    const row = el('div', { class: 'version-history-compare-row' });
    row.appendChild(selectInput(optionIds, leftId, (v) => { leftId = v; }, labelsMap));
    row.appendChild(el('span', { text: '→', 'aria-hidden': 'true' }));
    row.appendChild(selectInput(optionIds, rightId, (v) => { rightId = v; }, labelsMap));
    row.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-sm',
      text: 'Compare',
      onClick: () => {
        const fresh = store.getState();
        openDiagramCompareModal({
          leftLabel: labelOf(fresh, leftId),
          leftContent: contentOf(fresh, leftId),
          rightLabel: labelOf(fresh, rightId),
          rightContent: contentOf(fresh, rightId),
        });
      },
    }));
    wrap.appendChild(row);
    return wrap;
  }
}
