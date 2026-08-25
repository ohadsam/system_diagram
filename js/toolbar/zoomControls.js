import { el } from '../utils/dom.js';
import * as viewport from '../canvas/viewport.js';
import { fitToScreen } from '../canvas/canvas.js';

export function renderZoomControls() {
  const wrap = el('div', { class: 'zoom-controls' });
  // Each icon glyph below (−, +, ⛶) is not reliable as an accessible name on
  // its own — a screen reader may read it literally ("minus sign") rather
  // than announcing what the button does — so aria-label carries the real
  // name (title still gives everyone else the same text as a tooltip).
  const out = el('button', { type: 'button', class: 'btn btn-icon', title: 'Zoom out', 'aria-label': 'Zoom out', text: '−', onClick: () => viewport.zoomTo(viewport.getViewport().zoom - 0.1) });
  const percent = el('button', { type: 'button', class: 'zoom-percent', title: 'Reset zoom to 100%', text: '100%', onClick: () => viewport.zoomTo(1) });
  const inBtn = el('button', { type: 'button', class: 'btn btn-icon', title: 'Zoom in', 'aria-label': 'Zoom in', text: '+', onClick: () => viewport.zoomTo(viewport.getViewport().zoom + 0.1) });
  const fit = el('button', { type: 'button', class: 'btn btn-icon', title: 'Fit to screen', 'aria-label': 'Fit to screen', text: '⛶', onClick: fitToScreen });

  viewport.onViewportChange((state) => {
    percent.textContent = `${Math.round(state.zoom * 100)}%`;
  });

  wrap.appendChild(out);
  wrap.appendChild(percent);
  wrap.appendChild(inBtn);
  wrap.appendChild(fit);
  return wrap;
}
