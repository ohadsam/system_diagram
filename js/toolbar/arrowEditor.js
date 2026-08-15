// Contextual connector (edge) style controls, shown in the toolbar's
// second row when one or more edges are selected.
import * as store from '../core/store.js';
import { el, clear } from '../utils/dom.js';
import { field, colorInput, numberInput, selectInput, textInput } from '../utils/formControls.js';
import { ROUTINGS, ARROW_HEADS, DASH_STYLES } from '../core/project.js';

const ROUTING_LABELS = { straight: 'Straight', orthogonal: 'Elbow', curved: 'Curved', magic: '🪄 Magic (auto-avoid)' };
const ARROW_LABELS = { none: 'None', open: 'Open', filled: 'Filled', diamond: 'Diamond', circle: 'Circle' };
const DASH_LABELS = { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' };

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

  container.appendChild(field('Color', colorInput(first.color, (v) => updateAll((e) => { e.color = v; }))));
  container.appendChild(field('Width', numberInput(first.width, 1, 10, 1, (v) => updateAll((e) => { e.width = v; }))));
  container.appendChild(field('Dash', selectInput(DASH_STYLES, first.dash, (v) => updateAll((e) => { e.dash = v; }), DASH_LABELS)));
  container.appendChild(field('Routing', selectInput(ROUTINGS, first.routing, (v) => updateAll((e) => { e.routing = v; }), ROUTING_LABELS)));
  container.appendChild(field('Start arrow', selectInput(ARROW_HEADS, first.startArrow, (v) => updateAll((e) => { e.startArrow = v; }), ARROW_LABELS)));
  container.appendChild(field('End arrow', selectInput(ARROW_HEADS, first.endArrow, (v) => updateAll((e) => { e.endArrow = v; }), ARROW_LABELS)));

  if (edgeIds.length === 1) {
    container.appendChild(field('Label', textInput(first.label, (v) => updateAll((e) => { e.label = v; }), { placeholder: 'e.g. HTTPS' })));
  }

  container.appendChild(el('span', { class: 'toolbar-selection-count', text: edgeIds.length > 1 ? `${edgeIds.length} selected` : '' }));
}
