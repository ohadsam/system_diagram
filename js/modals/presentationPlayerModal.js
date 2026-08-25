// Presentation playback: temporarily swaps the live canvas to each slide's
// saved-version content, rasterizes it (io/exportImage.js's html2canvas
// capture, same as PNG export), then restores the live canvas — so slides
// show exactly what the diagram looked like at each captured version,
// without a full off-screen renderer. All slides are captured up front
// (not per-navigation) so paging through them afterward is instant and
// never touches the live canvas again.
//
// The temporary swap uses a *coalesced* `store.dispatch` (not
// `store.loadProject`) specifically so it never touches undo/redo history
// — `dispatch(..., {coalesce:true})` never calls `history.commit()`, so
// none of these transient in/out swaps is ever recorded, and the user's
// real undo stack for their actual work is completely unaffected. Plain
// `loadProject` would have reset it entirely (see AI_AGENT_GUIDE.md's
// dispatch-vs-loadProject pitfall) — a non-starter for a read-only preview
// feature. `replicationPairs` is dropped during the swap for the same
// reason `subDiagramEdit.js` drops it for its own temporary content swap:
// the sync engine has nothing useful to reconcile against an unrelated
// snapshot's content.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { captureDiagramCanvas } from '../io/exportImage.js';
import { nextFrame } from '../utils/loadScript.js';

async function withTemporaryContent(content, fn) {
  const original = store.getState();
  store.dispatch((draft) => {
    draft.nodes = content.nodes;
    draft.edges = content.edges;
    draft.replicationPairs = [];
  }, { coalesce: true });
  await nextFrame();
  try {
    return await fn();
  } finally {
    store.dispatch((draft) => {
      draft.nodes = original.nodes;
      draft.edges = original.edges;
      draft.replicationPairs = original.replicationPairs;
    }, { coalesce: true });
    await nextFrame();
  }
}

/** @returns {Promise<{title:string, notes:string, dataUrl:string|null}[]>} */
export async function renderSlidesToDataUrls(presentation, versions, onProgress) {
  const results = [];
  for (let i = 0; i < presentation.slides.length; i++) {
    const slide = presentation.slides[i];
    const version = versions.find((v) => v.id === slide.versionId);
    onProgress?.(i + 1, presentation.slides.length);
    let dataUrl = null;
    if (version) {
      // eslint-disable-next-line no-await-in-loop -- each swap must fully
      // finish and restore before the next one starts, since they share
      // the one live store the visible canvas renders from.
      const canvas = await withTemporaryContent(version.snapshot, () => captureDiagramCanvas());
      dataUrl = canvas ? canvas.toDataURL('image/png') : null;
    }
    results.push({ title: slide.title, notes: slide.notes, dataUrl });
  }
  return results;
}

export function openPresentationPlayer(presentation) {
  const versions = store.getState().versions || [];
  let index = 0;
  let slides = null;

  openModal({
    title: presentation.name,
    className: 'presentation-player-modal',
    render: async (body) => {
      const loading = el('p', { class: 'presentation-player-loading', text: `Preparing slide 1 / ${presentation.slides.length}… (the canvas behind this dialog may flicker briefly)` });
      body.appendChild(loading);

      slides = await renderSlidesToDataUrls(presentation, versions, (done, total) => {
        loading.textContent = `Preparing slide ${done} / ${total}… (the canvas behind this dialog may flicker briefly)`;
      });
      renderSlide(body);
    },
  });

  function renderSlide(body) {
    clear(body);
    const slide = slides[index];

    const header = el('div', { class: 'presentation-player-header' });
    header.appendChild(el('span', { class: 'presentation-player-title', text: slide?.title || `Slide ${index + 1}` }));
    header.appendChild(el('span', { class: 'presentation-player-progress', text: `${index + 1} / ${slides.length}` }));
    body.appendChild(header);

    if (slide?.dataUrl) {
      body.appendChild(el('img', { class: 'presentation-player-image', src: slide.dataUrl, alt: slide.title || `Slide ${index + 1}` }));
    } else {
      body.appendChild(el('p', { class: 'presentation-player-empty', text: 'This slide\'s version is empty, or no longer exists.' }));
    }
    if (slide?.notes) body.appendChild(el('p', { class: 'presentation-player-notes', text: slide.notes }));

    const nav = el('div', { class: 'presentation-player-nav' });
    nav.appendChild(el('button', { type: 'button', class: 'btn', text: '← Previous', disabled: index === 0, onClick: () => { index--; renderSlide(body); } }));
    nav.appendChild(el('button', { type: 'button', class: 'btn', text: 'Next →', disabled: index === slides.length - 1, onClick: () => { index++; renderSlide(body); } }));
    body.appendChild(nav);
  }
}
