// "Scale Diagram" — permanently resize every node's position/size and font
// size together by a chosen percentage (see canvas.js#scaleDiagram). Reached
// from the toolbar's Tools dropdown, following the same `sdb:open-*`
// window-event convention as sequenceDiagramModal.js/replicationModal.js.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { field, numberInput } from '../utils/formControls.js';
import { scaleDiagram } from '../canvas/canvas.js';

const MIN_PERCENT = 10;
const MAX_PERCENT = 500;
const PRESETS = [50, 75, 150, 200];

window.addEventListener('sdb:open-scale-diagram', openScaleDiagramModal);

export function openScaleDiagramModal() {
  let percent = 100;

  openModal({
    title: 'Scale Diagram',
    className: 'scale-diagram-modal',
    render: (body, api) => {
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: 'Permanently resizes every component (position, size, and text) by the percentage below — unlike zooming the view, this changes the diagram’s actual data.',
      }));

      const input = numberInput(percent, MIN_PERCENT, MAX_PERCENT, 5, (v) => { percent = v; }, { 'data-focus-key': 'scale-percent' });
      body.appendChild(field('Scale to (%)', input));

      const presetsRow = el('div', { class: 'field-row scale-diagram-presets' });
      for (const p of PRESETS) {
        presetsRow.appendChild(el('button', {
          type: 'button', class: 'btn btn-secondary btn-sm', text: `${p}%`,
          onClick: () => { percent = p; input.value = String(p); },
        }));
      }
      body.appendChild(presetsRow);

      const actions = el('div', { class: 'modal-actions' });
      actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
      actions.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-primary',
        text: '📐 Scale',
        onClick: () => {
          const clamped = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, percent));
          scaleDiagram(clamped / 100);
          api.close();
        },
      }));
      body.appendChild(actions);
    },
  });
}
