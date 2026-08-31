// Pure layout math for the "Sequence Diagram" wizard (see
// modals/sequenceDiagramModal.js): turns a flat list of participant names
// into evenly-spaced lifeline rects, centered on a given point. No DOM/store
// access — see canvas/canvas.js#createSequenceDiagram for where the result
// actually becomes real nodes.
import { sideAnchor } from './geometry.js';
import { estimateWrappedBlockSize, DEFAULT_LABEL_MAX_WIDTH } from './labelWrap.js';

// Also reused by canvas.js#addLifelineToRight (the quick "add lifeline"
// context-menu action) so a manually-added participant lines up with the
// wizard's own spacing.
export const GAP = 220;
// Keeps a redistributed message's offset clear of a lifeline's own title
// box at the top and its very bottom end, same margin on both sides.
const OFFSET_MARGIN = 0.08;

/**
 * @param {string[]} names participant names, in left-to-right order
 * @param {number} centerX canvas-space x to center the whole row on
 * @param {number} centerY canvas-space y for the top of every lifeline
 * @param {{w:number,h:number}} size each lifeline's size
 * @returns {{text:string, x:number, y:number, w:number, h:number}[]}
 */
export function layoutLifelines(names, centerX, centerY, size) {
  const totalWidth = names.length > 0 ? (names.length - 1) * GAP + size.w : size.w;
  const startX = centerX - totalWidth / 2;
  return names.map((text, i) => ({
    text,
    x: startX + i * GAP,
    y: centerY,
    w: size.w,
    h: size.h,
  }));
}

/**
 * "Distribute evenly" (Tools dropdown, see canvas.js#distributeSequenceDiagram)
 * — part 1: re-spaces every lifeline currently on the canvas to the same
 * `GAP` the wizard itself uses, preserving their existing left-to-right
 * order (and each one's own y/height) rather than imposing the wizard's
 * layout wholesale. Returns a Map<nodeId, newX>; empty if fewer than 2
 * lifelines exist (nothing to redistribute).
 */
export function distributeLifelineColumns(nodes) {
  const lifelines = nodes.filter((n) => n.shape === 'lifeline').sort((a, b) => a.x - b.x);
  const updates = new Map();
  if (lifelines.length < 2) return updates;
  const startX = lifelines[0].x;
  lifelines.forEach((n, i) => updates.set(n.id, startX + i * GAP));
  return updates;
}

/**
 * "Distribute evenly" — part 2: re-spaces every message's height along its
 * lifeline(s), preserving the current top-to-bottom order (same order
 * canvas.js#computeMessageSequenceNumbers already derives and numbers) so
 * the redistribution never reshuffles *what happens when*, only how evenly
 * the gaps between events are spaced. A self-message (see connector.js
 * #selfLoopPath) contributes two independent points — its start and end
 * height both matter for the loop shape — everything else contributes one
 * shared point applied to both ends, since an ordinary message is drawn
 * horizontal. Returns Map<edgeId, {fromOffset?, toOffset?}>.
 */
export function distributeMessages(nodes, edges) {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const events = [];
  for (const edge of edges) {
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    if (fromNode?.shape !== 'lifeline' || toNode?.shape !== 'lifeline') continue;
    const isSelf = edge.from === edge.to;
    events.push({ edgeId: edge.id, end: 'from', y: sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5).y });
    if (isSelf) {
      events.push({ edgeId: edge.id, end: 'to', y: sideAnchor(toNode, edge.toSide, edge.toOffset ?? 0.5).y });
    }
  }
  events.sort((a, b) => a.y - b.y);

  const updates = new Map();
  const step = events.length > 1 ? (1 - 2 * OFFSET_MARGIN) / (events.length - 1) : 0;
  events.forEach((ev, i) => {
    const offset = events.length > 1 ? OFFSET_MARGIN + i * step : 0.5;
    const cur = updates.get(ev.edgeId) || {};
    cur[ev.end === 'from' ? 'fromOffset' : 'toOffset'] = offset;
    updates.set(ev.edgeId, cur);
  });
  // A non-self message only ever contributed a single 'from' event above —
  // mirror the same value onto toOffset so both ends land on one shared,
  // horizontal height.
  for (const [edgeId, upd] of updates) {
    const edge = edges.find((e) => e.id === edgeId);
    if (edge && edge.from !== edge.to && upd.toOffset == null) upd.toOffset = upd.fromOffset;
  }
  return updates;
}

// Minimum vertical clearance between two consecutive messages even when
// neither has a label at all — keeps them from landing right on top of each
// other the way a naive "just fit the label" computation could for the
// first/shortest gap.
const MIN_MESSAGE_GAP_PX = 24;
// Clearance above/below a message's own wrapped label block before the
// next message's — see spaceMessagesForLabels below.
const LABEL_GAP_PADDING_PX = 10;

/**
 * "🔤 Fix Text Display" (Tools dropdown, see canvas.js#fixTextDisplay) for a
 * sequence diagram — re-spaces every message's height along its lifeline(s),
 * same shape as distributeMessages above, but the gap between two
 * consecutive events is however tall that first one's own *wrapped* label
 * actually renders (core/labelWrap.js) plus a fixed padding, not a fixed
 * even split — a message with a long, multi-line label gets proportionally
 * more room than a short one, so the next message's own label never lands
 * inside the space the previous one's wrapped text needs. If the sum of
 * every required gap would overflow the lifeline's own usable height, every
 * gap is scaled down proportionally so the whole sequence still fits inside
 * the existing lifelines (this app treats a sequence diagram's own height as
 * user-owned/manual, the same reasoning autoArrangeAll opts sequence
 * diagrams out of entirely — this function repositions messages *within*
 * that height, it never grows it). Returns Map<edgeId, {fromOffset?, toOffset?}>,
 * empty if there are fewer than 2 messages to space (nothing to do) or no
 * lifeline exists to read a height from.
 */
export function spaceMessagesForLabels(nodes, edges) {
  const lifelineH = nodes.find((n) => n.shape === 'lifeline')?.h;
  if (!lifelineH) return new Map();

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const events = [];
  for (const edge of edges) {
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    if (fromNode?.shape !== 'lifeline' || toNode?.shape !== 'lifeline') continue;
    const isSelf = edge.from === edge.to;
    const blockHeight = estimateWrappedBlockSize(edge.label, DEFAULT_LABEL_MAX_WIDTH).height;
    events.push({ edgeId: edge.id, end: 'from', y: sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5).y, blockHeight });
    if (isSelf) {
      events.push({ edgeId: edge.id, end: 'to', y: sideAnchor(toNode, edge.toSide, edge.toOffset ?? 0.5).y, blockHeight });
    }
  }
  events.sort((a, b) => a.y - b.y);
  if (events.length < 2) return new Map();

  const gapsPx = events.slice(0, -1).map((ev) => Math.max(MIN_MESSAGE_GAP_PX, ev.blockHeight + LABEL_GAP_PADDING_PX));
  const usablePx = lifelineH * (1 - 2 * OFFSET_MARGIN);
  const totalGapPx = gapsPx.reduce((a, b) => a + b, 0);
  const scale = totalGapPx > usablePx ? usablePx / totalGapPx : 1;

  const updates = new Map();
  let offset = OFFSET_MARGIN;
  events.forEach((ev, i) => {
    const cur = updates.get(ev.edgeId) || {};
    cur[ev.end === 'from' ? 'fromOffset' : 'toOffset'] = offset;
    updates.set(ev.edgeId, cur);
    if (i < gapsPx.length) offset += (gapsPx[i] * scale) / lifelineH;
  });
  for (const [edgeId, upd] of updates) {
    const edge = edges.find((e) => e.id === edgeId);
    if (edge && edge.from !== edge.to && upd.toOffset == null) upd.toOffset = upd.fromOffset;
  }
  return updates;
}

// Same margin idea as OFFSET_MARGIN above, kept separate since an imported
// diagram's event count (and therefore its ideal margin) has nothing to do
// with the "Distribute evenly" action's.
const IMPORT_OFFSET_MARGIN = 0.05;

const MESSAGE_STYLE_OVERRIDES = {
  sync: { dash: 'solid', endArrow: 'filled' },
  async: { dash: 'solid', endArrow: 'open' },
  return: { dash: 'dashed', endArrow: 'open' },
};

/**
 * Pure layout for io/importSequenceMermaid.js's parsed
 * `{participants, events}` — turns it into lifeline rects (same shape
 * layoutLifelines returns), message edge specs, per-participant activation
 * bars, per-participant destroy offsets, and combined-fragment box rects.
 * No DOM/store access — canvas.js#createSequenceDiagramFromMermaid does the
 * actual node/edge creation from this. Events are read top-to-bottom and
 * spread evenly down the lifelines' height in that order (Mermaid text has
 * no explicit vertical position, only line order) — a self-message and an
 * activate/deactivate pair each consume their own slot in that order, same
 * as a plain message would.
 *
 * @param {{participants:{id:string,label:string}[], events:object[]}} parsed
 * @param {number} centerX canvas-space x to center the lifeline row on
 * @param {number} centerY canvas-space y for the top of every lifeline
 * @param {{w:number,h:number}} size each lifeline's size
 */
export function layoutImportedSequenceDiagram(parsed, centerX, centerY, size) {
  const { participants, events } = parsed;
  const lifelines = layoutLifelines(participants.map((p) => p.label), centerX, centerY, size);
  const idToIndex = new Map(participants.map((p, i) => [p.id, i]));

  let totalUnits = 0;
  const unitOf = events.map((ev) => {
    const unit = totalUnits;
    totalUnits += (ev.kind === 'message' && ev.from === ev.to) ? 2 : 1;
    return unit;
  });
  const step = totalUnits > 1 ? (1 - 2 * IMPORT_OFFSET_MARGIN) / (totalUnits - 1) : 0;
  const offsetFor = (unit) => (totalUnits > 1 ? IMPORT_OFFSET_MARGIN + unit * step : 0.5);

  const edges = [];
  const activations = participants.map(() => []);
  const activationStarts = new Map();
  const destroys = participants.map(() => null);
  const openFragments = [];
  const fragments = [];

  events.forEach((ev, i) => {
    const unit = unitOf[i];
    if (ev.kind === 'message') {
      const isSelf = ev.from === ev.to;
      const fromOffset = offsetFor(unit);
      const toOffset = isSelf ? offsetFor(unit + 1) : fromOffset;
      edges.push({
        fromId: ev.from,
        toId: ev.to,
        overrides: {
          label: ev.label,
          routing: 'straight',
          fromOffset,
          toOffset,
          startArrow: 'none',
          ...MESSAGE_STYLE_OVERRIDES[ev.style],
          ...(isSelf ? { fromSide: 'right', toSide: 'right' } : {}),
        },
      });
      const fromIdx = idToIndex.get(ev.from);
      const toIdx = idToIndex.get(ev.to);
      for (const f of openFragments) { f.participantIdxs.add(fromIdx); f.participantIdxs.add(toIdx); }
    } else if (ev.kind === 'activate') {
      const idx = idToIndex.get(ev.id);
      if (idx == null) return;
      if (!activationStarts.has(idx)) activationStarts.set(idx, []);
      activationStarts.get(idx).push(offsetFor(unit));
    } else if (ev.kind === 'deactivate') {
      const idx = idToIndex.get(ev.id);
      const stack = idx == null ? null : activationStarts.get(idx);
      const start = stack && stack.length ? stack.pop() : null;
      if (start != null) activations[idx].push({ startOffset: start, endOffset: offsetFor(unit) });
    } else if (ev.kind === 'destroy') {
      const idx = idToIndex.get(ev.id);
      if (idx != null) destroys[idx] = offsetFor(unit);
    } else if (ev.kind === 'fragmentStart') {
      openFragments.push({ type: ev.type, label: ev.label, startUnit: unit, participantIdxs: new Set() });
    } else if (ev.kind === 'fragmentEnd') {
      const frag = openFragments.pop();
      if (frag) fragments.push({ ...frag, endUnit: unit });
    }
  });
  // An `alt`/`opt`/`loop`/`par` with no matching `end` still gets drawn,
  // closing at the last event rather than being silently dropped.
  while (openFragments.length) {
    fragments.push({ ...openFragments.pop(), endUnit: totalUnits > 0 ? totalUnits - 1 : 0 });
  }

  const X_MARGIN = 40;
  const Y_PADDING = 30;
  const MIN_W = 220;
  const MIN_H = 80;
  const fragmentRects = fragments.map((f) => {
    const idxs = f.participantIdxs.size ? [...f.participantIdxs] : lifelines.map((_, i) => i);
    const minIdx = Math.min(...idxs);
    const maxIdx = Math.max(...idxs);
    const left = lifelines[minIdx].x - X_MARGIN;
    const right = lifelines[maxIdx].x + lifelines[maxIdx].w + X_MARGIN;
    const top = centerY + offsetFor(f.startUnit) * size.h - Y_PADDING;
    const bottom = centerY + offsetFor(f.endUnit) * size.h + Y_PADDING;
    return {
      type: f.type,
      label: f.label,
      x: left,
      y: top,
      w: Math.max(right - left, MIN_W),
      h: Math.max(bottom - top, MIN_H),
    };
  });

  return { lifelines, edges, activations, destroys, fragments: fragmentRects };
}
