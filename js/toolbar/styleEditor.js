// Contextual node style controls, shown in the toolbar's second row when
// one or more nodes are selected.
import * as store from '../core/store.js';
import { el, clear } from '../utils/dom.js';
import { field, colorInput, numberInput, selectInput, textInput, checkbox } from '../utils/formControls.js';
import { SHAPES, TEXT_POSITIONS, BORDER_STYLES } from '../core/project.js';
import { STYLE_PRESET_IDS, STYLE_PRESETS, getStylePresetFields } from '../core/stylePresets.js';
import { pickImageFile } from '../io/fileIO.js';
import { showToast } from '../utils/toast.js';

const SHAPE_LABELS = {
  rect: 'Rectangle', rounded: 'Rounded', circle: 'Circle', diamond: 'Diamond',
  cylinder: 'Cylinder (DB)', hexagon: 'Hexagon', cloud: 'Cloud', note: 'Note', rows: 'Rows',
  cuboid: 'Cuboid (3D Box)',
};
const ALIGN_LABELS = { left: 'Left', center: 'Center', right: 'Right' };
const TEXT_POSITION_LABELS = {
  center: 'Center (inside)', top: 'Top (inside)', bottom: 'Bottom (inside)', above: 'Above shape', below: 'Below shape',
};
const BORDER_STYLE_LABELS = { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' };

// Quick width/height buttons — not a persisted field, just a shortcut for
// typing the same two numbers into Width/Height (below), useful for
// lining several components up to a consistent size at a glance.
const SIZE_PRESETS = { S: { w: 120, h: 60 }, M: { w: 160, h: 84 }, L: { w: 220, h: 120 } };

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

  container.appendChild(buildStylePresetRow(updateAll));

  container.appendChild(field('Fill', colorInput(first.fill, (v) => updateAll((n) => { n.fill = v; }), { 'data-focus-key': 'fill' })));
  container.appendChild(checkbox(first.fill === 'transparent', (v) => updateAll((n) => { n.fill = v ? 'transparent' : '#FFFFFF'; }), 'No background'));
  container.appendChild(field('Border', colorInput(first.stroke, (v) => updateAll((n) => { n.stroke = v; }), { 'data-focus-key': 'stroke' })));
  container.appendChild(field('Border width', numberInput(first.strokeWidth, 0, 12, 1, (v) => updateAll((n) => { n.strokeWidth = v; }), { 'data-focus-key': 'strokeWidth' })));
  container.appendChild(field('Border style', selectInput(BORDER_STYLES, first.borderStyle || 'solid', (v) => updateAll((n) => { n.borderStyle = v; }), BORDER_STYLE_LABELS)));
  container.appendChild(field('Shape', selectInput(SHAPES.filter((s) => s !== 'rows'), first.shape === 'rows' ? 'rounded' : first.shape, (v) => updateAll((n) => { n.shape = v; }), SHAPE_LABELS)));
  if (first.shape === 'rect' || first.shape === 'rounded') {
    container.appendChild(field(
      'Corner radius',
      numberInput(Number.isFinite(first.cornerRadius) ? first.cornerRadius : (first.shape === 'rect' ? 4 : 14), 0, 40, 1, (v) => updateAll((n) => { n.cornerRadius = v; }), { 'data-focus-key': 'cornerRadius' }),
    ));
  }
  container.appendChild(checkbox(!!first.dropShadow, (v) => updateAll((n) => { n.dropShadow = v; }), 'Drop shadow'));
  container.appendChild(field('Opacity', numberInput(Number.isFinite(first.opacity) ? first.opacity : 100, 10, 100, 5, (v) => updateAll((n) => { n.opacity = v; }), { 'data-focus-key': 'opacity', title: 'How see-through this component is (100 = fully solid) — handy for marking something as planned or not-yet-built' })));
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
    const sizeRow = el('div', { class: 'style-size-preset-row' });
    for (const [label, size] of Object.entries(SIZE_PRESETS)) {
      sizeRow.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-secondary btn-sm',
        title: `Resize to ${size.w}×${size.h} — a quick shortcut for typing the same numbers into Width/Height above`,
        text: label,
        onClick: () => updateAll((n) => { n.w = size.w; n.h = size.h; }),
      }));
    }
    container.appendChild(sizeRow);
  }

  container.appendChild(el('span', { class: 'toolbar-selection-count', text: nodeIds.length > 1 ? `${nodeIds.length} selected` : '' }));
}

/** One button per core/stylePresets.js entry — applying one sets several
 * fields (fill/stroke/strokeWidth/borderStyle/dropShadow/opacity) in a
 * single dispatch, same one-undo-step convention every other field here
 * already has via `updateAll`. Not its own persisted field on the node —
 * see stylePresets.js's own header comment for why. */
function buildStylePresetRow(updateAll) {
  const row = el('div', { class: 'style-preset-row' });
  for (const id of STYLE_PRESET_IDS) {
    const preset = STYLE_PRESETS[id];
    row.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-secondary btn-sm',
      title: `Apply the "${preset.label}" look (sets fill, border, and shadow together)`,
      text: preset.label,
      onClick: () => updateAll((n) => Object.assign(n, getStylePresetFields(id))),
    }));
  }
  return row;
}
