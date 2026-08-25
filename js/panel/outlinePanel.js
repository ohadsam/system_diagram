// Right slide-in "Outline" panel — a searchable table-of-contents for the
// live canvas: every component and connector as a text row, click one to
// select + center the view on it (canvas -> list direction is the reverse:
// selecting anything on the canvas highlights and scrolls to its row here).
// Kept out of canvas.js's own render() the same way minimap.js/commentPins.js
// are — this is read-only navigation chrome, not part of the diagram's own
// data, with its own store subscriptions.
import * as store from '../core/store.js';
import { el, clear, rerenderPreservingUiState } from '../utils/dom.js';
import { centerOn } from '../canvas/viewport.js';

let rootEl = null;
let isOpen = false;
let searchQuery = '';
const collapsedSections = new Set(); // 'components' | 'connectors'
let itemElements = new Map(); // `${type}:${id}` -> row element, rebuilt each render()
let lastContentSignature = null;
let unsubChange = null;
let unsubSelection = null;

export function initOutlinePanel(root) {
  rootEl = root;
  rootEl.classList.add('outline-panel');
}

export function toggleOutlinePanel() {
  if (isOpen) close();
  else open();
}

function open() {
  isOpen = true;
  rootEl.classList.add('open');
  lastContentSignature = null; // force the first render regardless of prior state
  unsubChange = store.subscribe('change', onStoreChange);
  unsubSelection = store.subscribe('selection', syncHighlight);
  render();
}

export function close() {
  isOpen = false;
  rootEl.classList.remove('open');
  unsubChange?.();
  unsubSelection?.();
  unsubChange = null;
  unsubSelection = null;
}

function nodeLabel(n) {
  return n.text || n.defId || 'Component';
}

function edgeLabel(e, nodesById) {
  if (e.label) return e.label;
  const from = nodesById.get(e.from);
  const to = nodesById.get(e.to);
  return `${from ? nodeLabel(from) : '?'} → ${to ? nodeLabel(to) : '?'}`;
}

function contentSignature(state) {
  // Only what the list actually displays — deliberately excludes x/y/w/h/
  // style so a drag (which dispatches on every animation frame, see
  // nodeInteractions.js#beginMove) doesn't rebuild this whole panel dozens
  // of times a second for content that hasn't actually changed.
  return JSON.stringify([
    state.nodes.map((n) => [n.id, n.text, n.defId]),
    state.edges.map((e) => [e.id, e.from, e.to, e.label]),
  ]);
}

/** Only rebuilds the list when what it would show has actually changed. */
function onStoreChange() {
  const state = store.getState();
  const sig = contentSignature(state);
  if (sig === lastContentSignature) return;
  lastContentSignature = sig;
  render();
}

function selectAndCenter(type, id) {
  const state = store.getState();
  if (type === 'node') {
    const n = state.nodes.find((x) => x.id === id);
    if (!n) return;
    centerOn(n.x + n.w / 2, n.y + n.h / 2);
    store.select([id], []);
  } else {
    const e = state.edges.find((x) => x.id === id);
    if (!e) return;
    const from = state.nodes.find((n) => n.id === e.from);
    const to = state.nodes.find((n) => n.id === e.to);
    if (from && to) centerOn((from.x + from.w / 2 + to.x + to.w / 2) / 2, (from.y + from.h / 2 + to.y + to.h / 2) / 2);
    store.select([], [id]);
  }
}

/** Selecting something on the canvas (or anywhere else) highlights the
 * matching row here and scrolls it into view — the "canvas -> list"
 * direction of the bidirectional sync. Deliberately a cheap class toggle
 * over the existing rows, not a full render(), since selection can change
 * often (click, marquee, arrow-key nudge) and none of it needs a rebuild. */
function syncHighlight() {
  if (!isOpen) return;
  const selection = store.getSelection();
  const activeKeys = new Set([
    ...selection.nodeIds.map((id) => `node:${id}`),
    ...selection.edgeIds.map((id) => `edge:${id}`),
  ]);
  let scrolledTo = false;
  for (const [key, rowEl] of itemElements) {
    const isActive = activeKeys.has(key);
    rowEl.classList.toggle('active', isActive);
    if (isActive && !scrolledTo) {
      rowEl.scrollIntoView({ block: 'nearest' });
      scrolledTo = true;
    }
  }
}

function buildSection(title, sectionKey, entries, buildRow) {
  const wrap = el('div', { class: 'outline-section' });
  const collapsed = collapsedSections.has(sectionKey);
  const toggle = el('button', {
    type: 'button',
    class: 'outline-section-toggle',
    text: `${collapsed ? '▸' : '▾'} ${title} (${entries.length})`,
    onClick: () => {
      if (collapsed) collapsedSections.delete(sectionKey);
      else collapsedSections.add(sectionKey);
      render();
    },
  });
  wrap.appendChild(toggle);
  if (!collapsed) {
    const list = el('div', { class: 'outline-section-list' });
    for (const entry of entries) list.appendChild(buildRow(entry));
    wrap.appendChild(list);
  }
  return wrap;
}

function render() {
  if (!rootEl || !isOpen) return;
  rerenderPreservingUiState(rootEl, buildContents, '.outline-body');
  syncHighlight();
}

function buildContents() {
  clear(rootEl);
  itemElements = new Map();
  const state = store.getState();
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  const q = searchQuery.trim().toLowerCase();

  const header = el('div', { class: 'outline-header' });
  header.appendChild(el('h2', { text: 'Outline' }));
  header.appendChild(el('button', { type: 'button', class: 'outline-close', 'aria-label': 'Close outline', text: '✕', onClick: close }));
  rootEl.appendChild(header);

  const search = el('input', {
    type: 'search',
    class: 'outline-search',
    placeholder: 'Search components & connectors…',
    value: searchQuery,
    'data-focus-key': 'outline-search',
    onInput: (e) => { searchQuery = e.target.value; render(); },
  });
  rootEl.appendChild(search);

  const body = el('div', { class: 'outline-body' });

  const matchingNodes = state.nodes.filter((n) => !q || nodeLabel(n).toLowerCase().includes(q));
  const matchingEdges = state.edges.filter((e) => !q || edgeLabel(e, nodesById).toLowerCase().includes(q));

  body.appendChild(buildSection('Components', 'components', matchingNodes, (n) => {
    const row = el('button', {
      type: 'button',
      class: 'outline-item',
      onClick: () => selectAndCenter('node', n.id),
    }, [
      el('span', { class: 'outline-item-icon', text: n.icon || '🔲', 'aria-hidden': 'true' }),
      el('span', { class: 'outline-item-label', text: nodeLabel(n) }),
    ]);
    itemElements.set(`node:${n.id}`, row);
    return row;
  }));

  body.appendChild(buildSection('Connectors', 'connectors', matchingEdges, (e) => {
    const row = el('button', {
      type: 'button',
      class: 'outline-item',
      onClick: () => selectAndCenter('edge', e.id),
    }, [
      el('span', { class: 'outline-item-icon', text: '➔', 'aria-hidden': 'true' }),
      el('span', { class: 'outline-item-label', text: edgeLabel(e, nodesById) }),
    ]);
    itemElements.set(`edge:${e.id}`, row);
    return row;
  }));

  if (q && !matchingNodes.length && !matchingEdges.length) {
    body.appendChild(el('p', { class: 'outline-empty', text: 'No matches.' }));
  }

  rootEl.appendChild(body);
}
