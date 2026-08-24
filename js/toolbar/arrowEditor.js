// Contextual connector (edge) style controls, shown in the toolbar's
// second row when one or more edges are selected.
import * as store from '../core/store.js';
import { el, clear } from '../utils/dom.js';
import { field, colorInput, numberInput, selectInput, textInput } from '../utils/formControls.js';
import { ROUTINGS, ARROW_HEADS, DASH_STYLES, EDGE_LABEL_POSITIONS } from '../core/project.js';

const ROUTING_LABELS = { straight: 'Straight', orthogonal: 'Elbow', curved: 'Curved', magic: '🪄 Magic (auto-avoid)' };
const ARROW_LABELS = { none: 'None', open: 'Open', filled: 'Filled', diamond: 'Diamond', circle: 'Circle' };
const DASH_LABELS = { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' };
const LABEL_POSITION_LABELS = { start: 'Near start', middle: 'Middle', end: 'Near end' };

export function renderEdgeStyleEditor(container, edgeIds) {
  clear(container);
  const state = store.getState();
  const edges = edgeIds.map((id) => state.edges.find((e) => e.id === id)).filter(Boolean);
  if (!edges.length) return;
  const first = edges[0];

  const updateAll = (fn) => store.dispatch((draft) => {
    for (const id of edgeIds) {
      const e = draft.edges.find((x) => x.id === id);
      if (e) fn(e);
    }
  });

  container.appendChild(field('Color', colorInput(first.color, (v) => updateAll((e) => { e.color = v; }), { 'data-focus-key': 'edge-color' })));
  container.appendChild(field('Width', numberInput(first.width, 1, 10, 1, (v) => updateAll((e) => { e.width = v; }), { 'data-focus-key': 'edge-width' })));
  container.appendChild(field('Dash', selectInput(DASH_STYLES, first.dash, (v) => updateAll((e) => { e.dash = v; }), DASH_LABELS)));
  container.appendChild(field('Routing', selectInput(ROUTINGS, first.routing, (v) => updateAll((e) => { e.routing = v; }), ROUTING_LABELS)));
  container.appendChild(field('Start arrow', selectInput(ARROW_HEADS, first.startArrow, (v) => updateAll((e) => { e.startArrow = v; }), ARROW_LABELS)));
  container.appendChild(field('End arrow', selectInput(ARROW_HEADS, first.endArrow, (v) => updateAll((e) => { e.endArrow = v; }), ARROW_LABELS)));

  if (edgeIds.length === 1) {
    container.appendChild(field('Label', textInput(first.label, (v) => updateAll((e) => { e.label = v; }), { placeholder: 'e.g. HTTPS', 'data-focus-key': 'edge-label' })));
    container.appendChild(field('Label position', selectInput(EDGE_LABEL_POSITIONS, first.labelPosition || 'middle', (v) => updateAll((e) => { e.labelPosition = v; }), LABEL_POSITION_LABELS)));

    const fromNode = state.nodes.find((n) => n.id === first.from);
    const toNode = state.nodes.find((n) => n.id === first.to);
    if (fromNode?.shape === 'lifeline' && toNode?.shape === 'lifeline') {
      container.appendChild(renderMessagePresets(updateAll));
    }
  }

  container.appendChild(el('span', { class: 'toolbar-selection-count', text: edgeIds.length > 1 ? `${edgeIds.length} selected` : '' }));
}

// One-click UML message conventions (only offered when both endpoints are
// lifelines, see above) — sets dash+arrowhead together instead of two
// separate dropdown changes. A compact <select> rather than three buttons:
// three full-width buttons made the floating contextual row tall enough to
// cover part of the canvas below it (found drawing a second message right
// after the first — see tests/e2e/sequence-diagram.spec.js).
const MESSAGE_PRESETS = {
  sync: { dash: 'solid', startArrow: 'none', endArrow: 'filled' },
  async: { dash: 'solid', startArrow: 'none', endArrow: 'open' },
  return: { dash: 'dashed', startArrow: 'none', endArrow: 'open' },
};
const MESSAGE_PRESET_LABELS = { '': 'Apply a preset...', sync: '📞 Sync call', async: '⚡ Async call', return: '↩️ Return' };

function renderMessagePresets(updateAll) {
  const select = selectInput(['', 'sync', 'async', 'return'], '', (v) => {
    if (!v) return;
    const preset = MESSAGE_PRESETS[v];
    updateAll((e) => Object.assign(e, preset));
  }, MESSAGE_PRESET_LABELS);
  select.title = 'Apply a standard UML message style (sets dash + arrowhead together)';
  return field('Message preset', select);
}
