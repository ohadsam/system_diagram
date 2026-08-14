// "Add shape" modal: a quick-pick grid of the basic shapes (rectangle,
// circle, diamond, cylinder/DB, hexagon, cloud, sticky note, server-with-
// rows, ...) that drops the shape onto the canvas immediately. Reuses the
// same data as the "Basic Shapes" sidebar category — see js/data/categories/shapes.js.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { getComponentsForCategory } from '../data/index.js';
import { addCustomShapeNode } from '../canvas/canvas.js';

export function openCustomShapeModal() {
  const shapes = getComponentsForCategory('shapes');
  openModal({
    title: 'Add a shape',
    className: 'shape-picker-modal',
    render: (body, api) => {
      const grid = el('div', { class: 'shape-grid' });
      for (const shape of shapes) {
        const card = el('button', {
          type: 'button',
          class: 'shape-card',
          title: shape.description || shape.name,
          onClick: () => {
            addCustomShapeNode(shape);
            api.close();
          },
        });
        card.appendChild(el('span', { class: 'shape-card-icon', text: shape.icon }));
        card.appendChild(el('span', { class: 'shape-card-name', text: shape.name }));
        grid.appendChild(card);
      }
      body.appendChild(grid);
      body.appendChild(el('p', { class: 'modal-hint', text: 'Tip: after adding a shape, select it and use the toolbar to change its color, size or text — or turn it into a reusable component from "New Component".' }));
    },
  });
}
