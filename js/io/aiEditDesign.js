// "Edit with AI" — the incremental sibling of io/aiGenerateDesign.js.
// Generate Design replaces the whole canvas from a spec; this instead asks
// an AI for a small JSON *patch* against the diagram that's already there
// ("add a Redis Cache between the Gateway and the DB"), so a deliberate,
// hand-placed layout survives an edit instead of being regenerated from
// scratch. Same "prepare & hand off, no API key" mechanism as every other
// AI feature here (see docs/SPEC.md 4.12/4.13) — no mainstream LLM offers
// key-free API access from a static page, so the app builds a prompt, the
// user pastes it into their own AI chat, and pastes the reply back in.
import { SHAPES, ROUTINGS } from '../core/project.js';
import { extractProjectJSON } from './aiGenerateDesign.js';

const PROJECT_JSON_LIMIT = 20000;
const INSTRUCTION_LIMIT = 4000;
const PLACEABLE_SHAPES = SHAPES.filter((s) => s !== 'rows');
const ROUTING_CHOICES = ROUTINGS.filter((r) => r !== 'magic');

const EXAMPLE_PATCH_JSON = `{
  "addNodes": [
    { "id": "new1", "x": 460, "y": 320, "w": 160, "h": 84, "shape": "cylinder", "text": "Redis Cache", "icon": "⚡", "fill": "#FFF7ED", "stroke": "#EA580C" }
  ],
  "addEdges": [
    { "id": "newe1", "from": "n1", "to": "new1", "label": "reads/writes", "routing": "orthogonal" }
  ],
  "updateNodes": [
    { "id": "n2", "text": "Order Service (v2)" }
  ],
  "updateEdges": [],
  "removeNodeIds": [],
  "removeEdgeIds": ["e3"]
}`;

/** A minimal projection of the live project — just what an edit needs to
 * reference existing ids and geometry — kept far smaller than a full
 * export (drops history/versions/animations/comments/etc.) since this text
 * gets embedded directly into the prompt and every model has a context
 * budget. */
function summarizeCurrentProject(project) {
  return JSON.stringify({
    name: project.name,
    nodes: project.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, shape: n.shape, text: n.text, icon: n.icon, fill: n.fill, stroke: n.stroke })),
    edges: project.edges.map((e) => ({ id: e.id, from: e.from, to: e.to, label: e.label, routing: e.routing })),
  });
}

export function buildEditPrompt({ project, instruction = '' }) {
  const lines = [];
  lines.push('Here is a system design diagram, as JSON (a trimmed projection — some cosmetic fields are omitted):');
  lines.push('```json');
  const currentJSON = summarizeCurrentProject(project);
  lines.push(currentJSON.length > PROJECT_JSON_LIMIT ? currentJSON.slice(0, PROJECT_JSON_LIMIT) + ' /* truncated */' : currentJSON);
  lines.push('```');
  lines.push('');
  lines.push('Requested change:');
  lines.push('--- REQUEST START ---');
  lines.push((instruction || '').trim().slice(0, INSTRUCTION_LIMIT) || '(no instruction given — use your best judgement)');
  lines.push('--- REQUEST END ---');
  lines.push('');
  lines.push('Respond with ONLY one JSON code block — no text before or after it — containing a PATCH object with exactly this shape (a real, complete example, not just a fragment):');
  lines.push('```json');
  lines.push(EXAMPLE_PATCH_JSON);
  lines.push('```');
  lines.push('');
  lines.push('Rules:');
  lines.push('- Only include the keys you actually need — omit or leave empty any of addNodes/addEdges/updateNodes/updateEdges/removeNodeIds/removeEdgeIds that don\'t apply.');
  lines.push('- `addNodes`/`addEdges` are brand-new items: give each a short new "id" not already used above (e.g. "new1", "new2", ...) — never reuse an existing id here.');
  lines.push(`- A new node's "shape" must be one of: ${PLACEABLE_SHAPES.join(', ')}. Place it at x/y coordinates that don't overlap an existing node (leave at least 220px horizontal / 140px vertical clearance).`);
  lines.push(`- A new edge's "routing" must be one of: ${ROUTING_CHOICES.join(', ')}. Its "from"/"to" must be an existing node's id or one of this same patch's own new node ids.`);
  lines.push('- `updateNodes`/`updateEdges` are partial patches: each needs the existing "id" plus only the fields being changed — don\'t repeat fields that stay the same.');
  lines.push('- `removeNodeIds`/`removeEdgeIds` are plain arrays of existing ids to delete. Removing a node also removes any edge attached to it automatically — don\'t also list that edge in removeEdgeIds.');
  lines.push('- Don\'t rewrite or reposition anything the request doesn\'t call for — a small, targeted patch is much more useful than a wholesale redo.');
  return lines.join('\n');
}

/** Re-exported so callers only need one import for both the prompt-builder
 * feature (aiGenerateDesign) and this one — the extraction logic itself
 * isn't project-shape-specific (it just finds/parses a JSON object out of
 * free text), so there's nothing edit-specific to add here. */
export { extractProjectJSON as extractPatchJSON };

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

/** Normalizes a raw parsed patch into a safe, fully-shaped object — never
 * throws, same contract as core/project.js's own validate* helpers. Doesn't
 * validate individual node/edge field contents (applyAiEditPatch reuses
 * core/project.js#validateProject for that, the same battle-tested
 * backfill/clamp logic every other import path already relies on) — this
 * layer only guarantees the six keys exist and are the right container
 * type, and that every id referenced in the "remove"/"update" arrays is at
 * least a non-empty string. */
export function normalizePatch(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    addNodes: asArray(raw.addNodes).filter((n) => n && typeof n === 'object'),
    addEdges: asArray(raw.addEdges).filter((e) => e && typeof e === 'object'),
    updateNodes: asArray(raw.updateNodes).filter((n) => n && typeof n === 'object' && typeof n.id === 'string' && n.id),
    updateEdges: asArray(raw.updateEdges).filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && e.id),
    removeNodeIds: asArray(raw.removeNodeIds).filter((id) => typeof id === 'string' && id),
    removeEdgeIds: asArray(raw.removeEdgeIds).filter((id) => typeof id === 'string' && id),
  };
}

function labelForNodeId(project, id) {
  return project.nodes.find((n) => n.id === id)?.text || id;
}

/**
 * Builds a human-readable preview of what a patch will do against the
 * current project, so a user can see the effect of pasting-in an AI reply
 * before committing to it (canvas.js#applyAiEditPatch does the actual
 * mutation). Anything referencing an id this project doesn't have is
 * called out as a warning rather than silently ignored, since a stale/
 * hallucinated id is the single most likely way an AI reply goes wrong.
 */
export function summarizePatch(patch, project) {
  const nodeIds = new Set(project.nodes.map((n) => n.id));
  const edgeIds = new Set(project.edges.map((e) => e.id));
  const newNodeIds = new Set(patch.addNodes.map((n) => n.id).filter(Boolean));

  const toAdd = [];
  for (const n of patch.addNodes) toAdd.push({ kind: 'node', type: 'add', text: `+ ${n.text || n.id || 'New component'}` });
  for (const e of patch.addEdges) {
    const fromOk = nodeIds.has(e.from) || newNodeIds.has(e.from);
    const toOk = nodeIds.has(e.to) || newNodeIds.has(e.to);
    if (!fromOk || !toOk) continue; // counted as a warning below, not added
    const fromLabel = newNodeIds.has(e.from) ? (patch.addNodes.find((n) => n.id === e.from)?.text || e.from) : labelForNodeId(project, e.from);
    const toLabel = newNodeIds.has(e.to) ? (patch.addNodes.find((n) => n.id === e.to)?.text || e.to) : labelForNodeId(project, e.to);
    toAdd.push({ kind: 'edge', type: 'add', text: `+ ${fromLabel} → ${toLabel}${e.label ? ` (${e.label})` : ''}` });
  }

  const toUpdate = [];
  for (const n of patch.updateNodes) {
    if (!nodeIds.has(n.id)) continue;
    const { id, ...fields } = n;
    const fieldNames = Object.keys(fields);
    if (!fieldNames.length) continue;
    toUpdate.push({ kind: 'node', type: 'update', text: `~ ${labelForNodeId(project, id)}: ${fieldNames.join(', ')}` });
  }
  for (const e of patch.updateEdges) {
    if (!edgeIds.has(e.id)) continue;
    const { id, ...fields } = e;
    const fieldNames = Object.keys(fields);
    if (!fieldNames.length) continue;
    toUpdate.push({ kind: 'edge', type: 'update', text: `~ connector ${id}: ${fieldNames.join(', ')}` });
  }

  const toRemove = [];
  for (const id of patch.removeNodeIds) {
    if (!nodeIds.has(id)) continue;
    toRemove.push({ kind: 'node', type: 'remove', text: `- ${labelForNodeId(project, id)}` });
  }
  for (const id of patch.removeEdgeIds) {
    if (!edgeIds.has(id)) continue;
    if (patch.removeNodeIds.some((nid) => project.edges.find((e) => e.id === id && (e.from === nid || e.to === nid)))) continue;
    toRemove.push({ kind: 'edge', type: 'remove', text: `- connector ${id}` });
  }

  const warnings = [];
  const unknownAddEdgeCount = patch.addEdges.filter((e) => !((nodeIds.has(e.from) || newNodeIds.has(e.from)) && (nodeIds.has(e.to) || newNodeIds.has(e.to)))).length;
  if (unknownAddEdgeCount) warnings.push(`${unknownAddEdgeCount} new connector${unknownAddEdgeCount === 1 ? '' : 's'} referenced an unknown component id and will be skipped.`);
  const unknownUpdateNodeCount = patch.updateNodes.filter((n) => !nodeIds.has(n.id)).length;
  if (unknownUpdateNodeCount) warnings.push(`${unknownUpdateNodeCount} update${unknownUpdateNodeCount === 1 ? '' : 's'} referenced a component id that doesn't exist and will be skipped.`);
  const unknownRemoveNodeCount = patch.removeNodeIds.filter((id) => !nodeIds.has(id)).length;
  if (unknownRemoveNodeCount) warnings.push(`${unknownRemoveNodeCount} component id${unknownRemoveNodeCount === 1 ? '' : 's'} to remove don't exist and will be skipped.`);

  return { toAdd, toUpdate, toRemove, warnings, isEmpty: !toAdd.length && !toUpdate.length && !toRemove.length };
}

/**
 * Backfills/clamps one raw `addNodes` entry's fields the same way every
 * other JSON import path does (see core/project.js#validateContent),
 * scaled down to just the fields a diagram actually cares about — the
 * caller (canvas.js#applyAiEditPatch) passes the result as `createNode`'s
 * `overrides`, so every field this doesn't set still gets createNode's own
 * sensible default. Deliberately doesn't assign a real `id` here: id
 * collision-checking against the *live* project needs canvas.js's own
 * existing-id set, not something this pure/DOM-free module has access to.
 * Returns null for a malformed entry (missing/wrong-typed object).
 */
export function sanitizeAddNode(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const overrides = {};
  if (typeof raw.id === 'string' && raw.id) overrides.id = raw.id;
  if (Number.isFinite(raw.x)) overrides.x = raw.x;
  if (Number.isFinite(raw.y)) overrides.y = raw.y;
  if (Number.isFinite(raw.w) && raw.w > 0) overrides.w = raw.w;
  if (Number.isFinite(raw.h) && raw.h > 0) overrides.h = raw.h;
  if (SHAPES.includes(raw.shape)) overrides.shape = raw.shape;
  if (typeof raw.fill === 'string') overrides.fill = raw.fill;
  if (typeof raw.stroke === 'string') overrides.stroke = raw.stroke;
  if (typeof raw.text === 'string') overrides.text = raw.text;
  if (typeof raw.icon === 'string') overrides.icon = raw.icon;
  return overrides;
}

/** Same idea as sanitizeAddNode, for one `addEdges` entry — canvas.js
 * passes the result as `createEdge`'s `overrides` after remapping `from`/
 * `to` through whatever id substitutions collision-avoidance required.
 * Returns null when `from`/`to` aren't even present (canvas.js still does
 * the real existence check against the live + newly-added node id space). */
export function sanitizeAddEdge(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.from !== 'string' || typeof raw.to !== 'string' || !raw.from || !raw.to) return null;
  const overrides = { from: raw.from, to: raw.to };
  if (typeof raw.id === 'string' && raw.id) overrides.id = raw.id;
  if (typeof raw.label === 'string') overrides.label = raw.label;
  if (ROUTING_CHOICES.includes(raw.routing)) overrides.routing = raw.routing;
  return overrides;
}

/** Field allow-list for one `updateNodes` entry — reuses sanitizeAddNode's
 * per-field validation (it already only sets a key when that key
 * individually validates) but strips `id`: a patch is never allowed to
 * rename an existing node's id, since every edge/animation-target/version
 * snapshot referencing it would silently desync. */
export function sanitizeNodeUpdateFields(raw) {
  const overrides = sanitizeAddNode(raw);
  if (!overrides) return null;
  delete overrides.id;
  delete overrides.x;
  delete overrides.y;
  return overrides;
}

/** Field allow-list for one `updateEdges` entry. Unlike sanitizeAddEdge,
 * `from`/`to` are optional here (most edge updates only touch a label or
 * style) — canvas.js#applyAiEditPatch still validates a given from/to
 * resolves to a real node before applying it. */
export function sanitizeEdgeUpdateFields(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const overrides = {};
  if (typeof raw.from === 'string' && raw.from) overrides.from = raw.from;
  if (typeof raw.to === 'string' && raw.to) overrides.to = raw.to;
  if (typeof raw.label === 'string') overrides.label = raw.label;
  if (ROUTING_CHOICES.includes(raw.routing)) overrides.routing = raw.routing;
  return overrides;
}
