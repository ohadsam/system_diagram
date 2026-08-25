// Hover-preview thumbnail for a sequence-diagram template's sidebar item —
// a small SVG sketch of its lifelines and messages, shown on hover/focus so
// a user can see roughly what a template contains before dropping it in.
// Pure DOM/SVG, no store access; only wired onto items that pass
// isSequenceDiagramPattern (all-lifeline patterns — see
// data/categories/sequence-templates.js and componentData.test.mjs's own
// definition of what makes a template one of these).
import { el, svgEl } from '../utils/dom.js';

const WIDTH_PER_LIFELINE = 56;
const MIN_WIDTH = 150;
const MAX_WIDTH = 320;
const HEIGHT = 130;
const TOP_PAD = 26;
const BOTTOM_PAD = 12;
const SIDE_PAD = 20;

export function isSequenceDiagramPattern(def) {
  const nodes = def?.pattern?.nodes;
  return def?.kind === 'pattern' && Array.isArray(nodes) && nodes.length > 0 && nodes.every((n) => n.defId === 'shape-lifeline');
}

function lifelineX(i, count, width) {
  if (count <= 1) return width / 2;
  return SIDE_PAD + (i * (width - 2 * SIDE_PAD)) / (count - 1);
}

function buildPreviewSvg(def) {
  const nodes = def.pattern.nodes;
  const edges = def.pattern.edges || [];
  const count = nodes.length;
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, count * WIDTH_PER_LIFELINE));
  const indexByKey = new Map(nodes.map((n, i) => [n.key, i]));

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${HEIGHT}`, width, height: HEIGHT, class: 'pattern-preview-svg' });

  // A center-anchored label on the leftmost/rightmost lifeline would have
  // half its width run past the SVG's own edge (and get clipped by
  // .pattern-preview-svg's overflow:hidden) — clamping the *label's* x
  // (not the lifeline's own line) keeps every label fully on-screen while
  // the line itself still marks the lifeline's real position.
  const LABEL_HALF_WIDTH = 28;
  nodes.forEach((n, i) => {
    const x = lifelineX(i, count, width);
    svg.appendChild(svgEl('line', { x1: x, y1: TOP_PAD, x2: x, y2: HEIGHT - BOTTOM_PAD, class: 'pattern-preview-lifeline' }));
    const labelX = Math.min(Math.max(x, LABEL_HALF_WIDTH), width - LABEL_HALF_WIDTH);
    const label = svgEl('text', { x: labelX, y: 14, class: 'pattern-preview-label', 'text-anchor': 'middle' });
    const fullLabel = n.label || n.key;
    label.textContent = fullLabel.length > 11 ? `${fullLabel.slice(0, 10)}…` : fullLabel;
    label.appendChild(svgEl('title')).textContent = fullLabel;
    svg.appendChild(label);
  });

  const innerH = HEIGHT - TOP_PAD - BOTTOM_PAD;
  edges.forEach((edgeSpec) => {
    const fromIdx = indexByKey.get(edgeSpec.from);
    const toIdx = indexByKey.get(edgeSpec.to);
    if (fromIdx == null || toIdx == null) return;
    const overrides = edgeSpec.overrides || {};
    const y = TOP_PAD + (overrides.fromOffset ?? 0.5) * innerH;
    const dashed = overrides.dash === 'dashed';
    const cls = `pattern-preview-message${dashed ? ' is-dashed' : ''}`;
    const fromX = lifelineX(fromIdx, count, width);

    if (fromIdx === toIdx) {
      // Self-message: a small loop back to the same lifeline.
      const loopW = 16;
      const path = svgEl('path', { d: `M ${fromX} ${y} C ${fromX + loopW} ${y}, ${fromX + loopW} ${y + 10}, ${fromX} ${y + 10}`, class: cls });
      svg.appendChild(path);
      svg.appendChild(svgEl('polygon', { points: `${fromX},${y + 10} ${fromX + 5},${y + 6.5} ${fromX + 5},${y + 13.5}`, class: 'pattern-preview-arrowhead' }));
    } else {
      const toX = lifelineX(toIdx, count, width);
      svg.appendChild(svgEl('line', { x1: fromX, y1: y, x2: toX, y2: y, class: cls }));
      const dir = toX > fromX ? -1 : 1;
      const tipX = toX;
      svg.appendChild(svgEl('polygon', { points: `${tipX},${y} ${tipX + dir * 6},${y - 3.5} ${tipX + dir * 6},${y + 3.5}`, class: 'pattern-preview-arrowhead' }));
    }
  });

  return svg;
}

let popupEl = null;
let showTimer = null;

/** Also called from sidebar.js's renderList() — it tears down and rebuilds
 * every sidebar item on each keystroke/filter change, so an item a popup is
 * currently anchored to can be removed without ever firing its own
 * mouseleave/blur (the mouse never actually left, its target just vanished
 * underneath it) — leaving the popup stuck on screen otherwise. */
export function hidePatternPreview() {
  clearTimeout(showTimer);
  popupEl?.remove();
  popupEl = null;
}

function showPopup(item, def) {
  hidePatternPreview();
  const popup = el('div', { class: 'pattern-preview-popup' });
  popup.appendChild(buildPreviewSvg(def));
  document.body.appendChild(popup);
  popupEl = popup;

  const itemRect = item.getBoundingClientRect();
  const popupRect = popup.getBoundingClientRect();
  const spaceRight = window.innerWidth - itemRect.right;
  const left = spaceRight >= popupRect.width + 12
    ? itemRect.right + 8
    : Math.max(8, itemRect.left - popupRect.width - 8);
  const top = Math.min(
    Math.max(8, itemRect.top + itemRect.height / 2 - popupRect.height / 2),
    window.innerHeight - popupRect.height - 8
  );
  popup.style.left = `${left}px`;
  popup.style.top = `${top}px`;
}

/** Wires hover (with a small delay, so scrolling past several items doesn't
 * flash a popup per item) and keyboard-focus show/hide onto `item` for the
 * given sequence-diagram template `def`. */
export function attachPatternPreview(item, def) {
  const start = () => {
    clearTimeout(showTimer);
    showTimer = setTimeout(() => showPopup(item, def), 200);
  };
  item.addEventListener('mouseenter', start);
  item.addEventListener('mouseleave', hidePatternPreview);
  item.addEventListener('focus', () => showPopup(item, def));
  item.addEventListener('blur', hidePatternPreview);
}
