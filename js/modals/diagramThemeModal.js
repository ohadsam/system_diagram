// "Diagram Theme" — permanently recolors every component to a chosen
// palette (see canvas.js#applyDiagramThemeToCanvas / core/diagramTheme.js).
// Reached from the toolbar's Tools dropdown, same `sdb:open-*` window-event
// convention as scaleDiagramModal.js/sequenceDiagramModal.js.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { DIAGRAM_THEMES } from '../core/diagramTheme.js';
import { applyDiagramThemeToCanvas } from '../canvas/canvas.js';

window.addEventListener('sdb:open-diagram-theme', openDiagramThemeModal);

export function openDiagramThemeModal() {
  let themeKey = Object.keys(DIAGRAM_THEMES)[0];

  openModal({
    title: 'Diagram Theme',
    className: 'diagram-theme-modal',
    render: (body, api) => {
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: 'Permanently recolors every component to the chosen palette — components that currently share a color stay grouped together, just in the new theme’s hues.',
      }));

      const grid = el('div', { class: 'diagram-theme-grid' });
      const cards = new Map();
      const selectTheme = (key) => {
        themeKey = key;
        for (const [k, card] of cards) card.classList.toggle('active', k === key);
      };

      for (const [key, theme] of Object.entries(DIAGRAM_THEMES)) {
        const swatches = el('div', { class: 'diagram-theme-swatches' });
        for (const color of theme.colors.slice(0, 6)) {
          swatches.appendChild(el('span', { class: 'diagram-theme-swatch', style: `background:${color}` }));
        }
        const card = el('button', {
          type: 'button',
          class: 'diagram-theme-card',
          onClick: () => selectTheme(key),
        }, [swatches, el('span', { class: 'diagram-theme-label', text: theme.label })]);
        cards.set(key, card);
        grid.appendChild(card);
      }
      selectTheme(themeKey);
      body.appendChild(grid);

      const actions = el('div', { class: 'modal-actions' });
      actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
      actions.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-primary',
        text: '🎨 Apply Theme',
        onClick: () => {
          applyDiagramThemeToCanvas(themeKey);
          api.close();
        },
      }));
      body.appendChild(actions);
    },
  });
}
