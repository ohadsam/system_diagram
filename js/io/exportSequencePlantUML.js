// Converts one sequence-diagram group into PlantUML sequence-diagram text —
// a second export format alongside io/exportSequenceMermaid.js, offered as
// a sibling "📋 Copy as PlantUML" button next to "📋 Copy as Mermaid" in
// modals/subDiagramModal.js. Mirrors that file's own event-collection and
// fragment-nesting approach (see its header comment for why fragments use a
// simple stack-based close rather than guaranteed valid nesting) — kept as
// its own self-contained pass rather than sharing code with it, so each
// export format's line-formatting stays simple to read on its own.
import { sideAnchor, rectsIntersect } from '../core/geometry.js';

function esc(text) {
  return String(text ?? '').replace(/\r?\n/g, ' ').trim();
}

/** Solid+filled -> a synchronous call (->), solid+open -> async (->>),
 * anything else (dashed/dotted) -> a return (-->) — the same three
 * conventions exportSequenceMermaid.js#arrowFor maps to ->>/-)/-->>, just
 * with PlantUML's own arrow tokens. */
function arrowFor(edge) {
  if (edge.dash === 'solid' && edge.endArrow === 'filled') return '->';
  if (edge.dash === 'solid' && edge.endArrow === 'open') return '->>';
  return '-->';
}

function rectOf(n) {
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

/**
 * @param {{nodes: object[], edges: object[], allNodes?: object[]}} group
 *   same shape buildSequenceMermaid takes — one getSequenceDiagramGroups()
 *   entry (canvas.js) plus the full canvas node list for fragment lookup.
 * @returns {string} PlantUML source, wrapped in @startuml/@enduml.
 */
export function buildSequencePlantUML({ nodes, edges, allNodes = [] }) {
  const lines = ['@startuml'];
  const idFor = new Map();
  nodes.forEach((n, i) => {
    const id = `P${i + 1}`;
    idFor.set(n.id, id);
    lines.push(`participant "${esc(n.text) || id}" as ${id}`);
  });
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const events = [];
  for (const edge of edges) {
    const fromNode = nodesById.get(edge.from);
    const toNode = nodesById.get(edge.to);
    if (!fromNode || !toNode) continue;
    const y = sideAnchor(fromNode, edge.fromSide, edge.fromOffset ?? 0.5).y;
    const arrow = arrowFor(edge);
    const label = esc(edge.label) || 'message';
    events.push({ y, rank: 2, text: `${idFor.get(fromNode.id)} ${arrow} ${idFor.get(toNode.id)} : ${label}` });
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

  const groupBounds = {
    x: Math.min(...nodes.map((n) => n.x)),
    y: Math.min(...nodes.map((n) => n.y)),
    w: 0,
    h: 0,
  };
  groupBounds.w = Math.max(...nodes.map((n) => n.x + n.w)) - groupBounds.x;
  groupBounds.h = Math.max(...nodes.map((n) => n.y + n.h)) - groupBounds.y;
  const fragments = allNodes.filter((n) => n.fragmentType && rectsIntersect(rectOf(n), groupBounds));
  const fragKeyword = { alt: 'alt', opt: 'opt', loop: 'loop', par: 'par', ref: 'ref' };
  for (const f of fragments) {
    events.push({ y: f.y, rank: 0, text: `${fragKeyword[f.fragmentType] || 'alt'} ${esc(f.text) || 'condition'}`, fragId: f.id, isStart: true });
    events.push({ y: f.y + f.h, rank: 5, text: 'end', fragId: f.id, isStart: false });
  }

  events.sort((a, b) => (a.y - b.y) || (a.rank - b.rank));

  const openFrags = [];
  for (const ev of events) {
    if (ev.isStart) {
      lines.push(`${'  '.repeat(openFrags.length)}${ev.text}`);
      openFrags.push(ev.fragId);
    } else if (ev.fragId) {
      const i = openFrags.lastIndexOf(ev.fragId);
      if (i !== -1) openFrags.splice(i, 1);
      lines.push(`${'  '.repeat(openFrags.length)}${ev.text}`);
    } else {
      lines.push(`${'  '.repeat(openFrags.length)}${ev.text}`);
    }
  }

  lines.push('@enduml');
  return lines.join('\n');
}
