// Converts one sequence-diagram group (lifelines + messages, plus any
// activation bars, destroy markers, overlapping UML fragment boxes, and a
// swimlane grouping via an overlapping "Group / Container" shape) into
// Mermaid `sequenceDiagram` text. Pure/DOM-free like core/sequenceDiagram.js
// — the caller (modals/subDiagramModal.js) just writes the result to the
// clipboard. Best-effort, not a lossless round-trip: Mermaid's own model
// (no offset-anchored messages, no drag-positioned fragments) can't
// represent everything this app can draw, so overlapping/non-nested
// fragments fall back to a simple stack-based "close whichever fragment
// this end belongs to" rather than guaranteeing strictly valid nesting.
import { sideAnchor, rectsIntersect } from '../core/geometry.js';

function esc(text) {
  return String(text ?? '').replace(/\r?\n/g, ' ').trim();
}

/** Solid+filled -> sync call (->>), solid+open -> async call (-)),
 * anything else (dashed/dotted, typically with an open head) -> a return
 * (-->>) — the same three combinations the arrow style editor's "Message
 * preset" dropdown offers (toolbar/arrowEditor.js), so a template built
 * from those presets round-trips through this mapping predictably. */
function arrowFor(edge) {
  if (edge.dash === 'solid' && edge.endArrow === 'filled') return '->>';
  if (edge.dash === 'solid' && edge.endArrow === 'open') return '-)';
  return '-->>';
}

function rectOf(n) {
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

function computeGroupBounds(nodes) {
  const x = Math.min(...nodes.map((n) => n.x));
  const y = Math.min(...nodes.map((n) => n.y));
  return {
    x,
    y,
    w: Math.max(...nodes.map((n) => n.x + n.w)) - x,
    h: Math.max(...nodes.map((n) => n.y + n.h)) - y,
  };
}

/**
 * @param {{nodes: object[], edges: object[], allNodes?: object[]}} group
 *   `nodes`/`edges` are one getSequenceDiagramGroups() entry (canvas.js);
 *   `allNodes` is the full canvas node list, searched for fragment boxes
 *   overlapping this group (fragments aren't group members — they're
 *   ordinary nodes visually placed behind/around the lifelines).
 * @returns {string} Mermaid `sequenceDiagram` source.
 */
export function buildSequenceMermaid({ nodes, edges, allNodes = [] }) {
  const lines = ['sequenceDiagram'];
  const idFor = new Map();
  nodes.forEach((n, i) => idFor.set(n.id, `P${i + 1}`));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const groupBounds = computeGroupBounds(nodes);
  // A plain "Group / Container" shape (data/categories/shapes.js#shape-group)
  // drawn behind a run of lifelines becomes a Mermaid `box` — the closest
  // thing Mermaid has to a swimlane. Matched by x-range containment (not
  // just overlap) since a box is meant to visually wrap the lifelines it
  // groups, not merely touch them; the frame's own y doesn't matter here.
  const boxes = allNodes.filter((n) => n.defId === 'shape-group' && rectsIntersect(rectOf(n), groupBounds));
  const boxFor = (n) => boxes.find((b) => n.x + n.w / 2 > b.x && n.x + n.w / 2 < b.x + b.w) || null;

  let openBox = null;
  for (const n of nodes) {
    const box = boxFor(n);
    if (box !== openBox) {
      if (openBox) lines.push('    end');
      if (box) lines.push(`    box "${esc(box.text) || 'Group'}"`);
      openBox = box;
    }
    lines.push(`${openBox ? '        ' : '    '}participant ${idFor.get(n.id)} as ${esc(n.text) || idFor.get(n.id)}`);
  }
  if (openBox) lines.push('    end');

  const events = [];
  // rank breaks ties when two events land on the exact same y: a fragment's
  // own start/end should bracket the messages at its boundary, not land
  // ambiguously among them.
  for (const edge of edges) {
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    if (!fromNode || !toNode) continue;
    const y = sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5).y;
    const arrow = arrowFor(edge);
    const label = esc(edge.label) || 'message';
    events.push({ y, rank: 2, text: `${idFor.get(fromNode.id)}${arrow}${idFor.get(toNode.id)}: ${label}` });
  }
  for (const n of nodes) {
    for (const act of n.activations || []) {
      events.push({ y: n.y + act.startOffset * n.h, rank: 1, text: `activate ${idFor.get(n.id)}` });
      events.push({ y: n.y + act.endOffset * n.h, rank: 3, text: `deactivate ${idFor.get(n.id)}` });
    }
    if (Number.isFinite(n.destroyOffset)) {
      events.push({ y: n.y + n.destroyOffset * n.h, rank: 4, text: `destroy ${idFor.get(n.id)}` });
    }
  }

  const fragments = allNodes.filter((n) => n.fragmentType && rectsIntersect(rectOf(n), groupBounds));
  const fragKeyword = { alt: 'alt', opt: 'opt', loop: 'loop', par: 'par', critical: 'critical', break: 'break', ref: 'ref' };
  for (const f of fragments) {
    events.push({ y: f.y, rank: 0, text: `${fragKeyword[f.fragmentType] || 'alt'} ${esc(f.text) || 'condition'}`, fragId: f.id, isStart: true });
    events.push({ y: f.y + f.h, rank: 5, text: 'end', fragId: f.id, isStart: false });
  }

  events.sort((a, b) => (a.y - b.y) || (a.rank - b.rank));

  const openFrags = [];
  for (const ev of events) {
    if (ev.isStart) {
      lines.push(`${'    '.repeat(openFrags.length + 1)}${ev.text}`);
      openFrags.push(ev.fragId);
    } else if (ev.fragId) {
      const i = openFrags.lastIndexOf(ev.fragId);
      if (i !== -1) openFrags.splice(i, 1);
      lines.push(`${'    '.repeat(openFrags.length + 1)}end`);
    } else {
      lines.push(`${'    '.repeat(openFrags.length + 1)}${ev.text}`);
    }
  }

  return lines.join('\n');
}
