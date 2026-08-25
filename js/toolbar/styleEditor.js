// Contextual node style controls, shown in the toolbar's second row when
// one or more nodes are selected.
import * as store from '../core/store.js';
import { el, clear } from '../utils/dom.js';
import { field, colorInput, numberInput, selectInput, textInput, checkbox } from '../utils/formControls.js';
import { SHAPES, TEXT_POSITIONS } from '../core/project.js';
import { pickImageFile } from '../io/fileIO.js';
import { showToast } from '../utils/toast.js';

const SHAPE_LABELS = {
  rect: 'Rectangle', rounded: 'Rounded', circle: 'Circle', diamond: 'Diamond',
  cylinder: 'Cylinder (DB)', hexagon: 'Hexagon', cloud: 'Cloud', note: 'Note', rows: 'Rows',
};
const ALIGN_LABELS = { left: 'Left', center: 'Center', right: 'Right' };
const TEXT_POSITION_LABELS = {
  center: 'Center (inside)', top: 'Top (inside)', bottom: 'Bottom (inside)', above: 'Above shape', below: 'Below shape',
};

export function renderNodeStyleEditor(container, nodeIds) {
  clear(container);
  const state = store.getState();
  const nodes = nodeIds.map((id) => state.nodes.find((n) => n.id === id)).filter(Boolean);
  if (!nodes.length) return;
  const first = nodes[0];

  const updateAll = (fn) => store.dispatch((draft) => {
    for (const id of nodeIds) {
      const n = draft.nodes.find((x) => x.id === id);
      if (n) fn(n);
    }
  });

  container.appendChild(field('Fill', colorInput(first.fill, (v) => updateAll((n) => { n.fill = v; }), { 'data-focus-key': 'fill' })));
  container.appendChild(checkbox(first.fill === 'transparent', (v) => updateAll((n) => { n.fill = v ? 'transparent' : '#FFFFFF'; }), 'No background'));
  container.appendChild(field('Border', colorInput(first.stroke, (v) => updateAll((n) => { n.stroke = v; }), { 'data-focus-key': 'stroke' })));
  container.appendChild(field('Border width', numberInput(first.strokeWidth, 0, 12, 1, (v) => updateAll((n) => { n.strokeWidth = v; }), { 'data-focus-key': 'strokeWidth' })));
  container.appendChild(field('Shape', selectInput(SHAPES.filter((s) => s !== 'rows'), first.shape === 'rows' ? 'rounded' : first.shape, (v) => updateAll((n) => { n.shape = v; }), SHAPE_LABELS)));
  container.appendChild(field('Font size', numberInput(first.fontSize, 8, 48, 1, (v) => updateAll((n) => { n.fontSize = v; }), { 'data-focus-key': 'fontSize' })));
  container.appendChild(field('Align', selectInput(['left', 'center', 'right'], first.textAlign, (v) => updateAll((n) => { n.textAlign = v; }), ALIGN_LABELS)));
  container.appendChild(field('Text position', selectInput(TEXT_POSITIONS, first.textPosition, (v) => updateAll((n) => { n.textPosition = v; }), TEXT_POSITION_LABELS)));
  container.appendChild(checkbox(first.iconVisible !== false, (v) => updateAll((n) => { n.iconVisible = v; }), 'Show icon'));

  if (nodeIds.length === 1) {
    container.appendChild(field('Icon', textInput(first.icon, (v) => updateAll((n) => { n.icon = v; }), { maxLength: 4, class: 'icon-field', 'data-focus-key': 'icon' })));
    container.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-secondary btn-sm',
      title: first.iconImage
        ? 'Replace the uploaded icon image (overrides the emoji icon above)'
        : 'Upload an image or SVG to use as this component\'s icon instead of the emoji above',
      text: first.iconImage ? '🖼️ Replace Image' : '🖼️ Upload Image',
      onClick: async () => {
        const result = await pickImageFile();
        if (!result) return;
        if (!result.ok) {
          showToast(result.error, 'error', 3200);
          return;
        }
        updateAll((n) => { n.iconImage = result.dataUrl; });
      },
    }));
    if (first.iconImage) {
      container.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-secondary btn-sm',
        title: 'Remove the uploaded icon image and go back to the emoji icon',
        text: '✕ Remove Image',
        onClick: () => updateAll((n) => { n.iconImage = null; }),
      }));
    }
    container.appendChild(field('Text', textInput(first.text, (v) => updateAll((n) => { n.text = v; }), { 'data-focus-key': 'text' })));
    container.appendChild(field('Width', numberInput(Math.round(first.w), 24, 2000, 1, (v) => updateAll((n) => { n.w = v; }), { 'data-focus-key': 'w' })));
    container.appendChild(field('Height', numberInput(Math.round(first.h), 24, 2000, 1, (v) => updateAll((n) => { n.h = v; }), { 'data-focus-key': 'h' })));
  }

  container.appendChild(el('span', { class: 'toolbar-selection-count', text: nodeIds.length > 1 ? `${nodeIds.length} selected` : '' }));
}
