import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import * as viewport from '../canvas/viewport.js';
import { fitToScreen, fitToSelection } from '../canvas/canvas.js';

export function renderZoomControls() {
  const wrap = el('div', { class: 'zoom-controls' });
  // Each icon glyph below (−, +, ⛶) is not reliable as an accessible name on
  // its own — a screen reader may read it literally ("minus sign") rather
  // than announcing what the button does — so aria-label carries the real
  // name (title still gives everyone else the same text as a tooltip).
  const out = el('button', { type: 'button', class: 'btn btn-icon', title: 'Zoom out', 'aria-label': 'Zoom out', text: '−', onClick: () => viewport.zoomTo(viewport.getViewport().zoom - 0.1) });
  const percent = el('button', { type: 'button', class: 'zoom-percent', title: 'Reset zoom to 100%', text: '100%', onClick: () => viewport.zoomTo(1) });
  const inBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Zoom in', 'aria-label': 'Zoom in', text: '+', onClick: () => viewport.zoomTo(viewport.getViewport().zoom + 0.1) });
  // Fits the current selection instead of the whole diagram once something
  // is selected — same button, no extra toolbar clutter for a large-diagram
  // convenience most people only want occasionally. Falls back to the
  // classic "fit everything" behavior with nothing selected.
  const fit = el('button', { type: 'button', class: 'btn btn-icon', text: '⛶', onClick: () => (store.getSelection().nodeIds.length ? fitToSelection() : fitToScreen()) });
  const updateFitLabel = () => {
    const count = store.getSelection().nodeIds.length;
    const label = count ? `Fit to selection (${count} selected)` : 'Fit to screen';
    fit.title = label;
    fit.setAttribute('aria-label', label);
  };
  updateFitLabel();
  store.subscribe('selection', updateFitLabel);

  viewport.onViewportChange((state) => {
    percent.textContent = `${Math.round(state.zoom * 100)}%`;
  });

  wrap.appendChild(out);
  wrap.appendChild(percent);
  wrap.appendChild(inBtn);
  wrap.appendChild(fit);
  return wrap;
}
