// "AI Beautify Layout" — asks an AI for a nicer *arrangement* of the
// components already on the canvas, as a position-only patch (never a
// shape/text/color/connection change). The deterministic sibling of this
// is Tools -> Auto-arrange (core/autoLayout.js, a fixed top-to-bottom rank
// algorithm); this one instead asks an AI to use its own judgement about
// readability, grouping, and flow direction — same honest "prepare & hand
// off, no API key" mechanism as every other AI feature here (see
// docs/SPEC.md 4.12/4.13).
import { extractProjectJSON } from './aiGenerateDesign.js';

const PROJECT_JSON_LIMIT = 12000;

function summarizeCurrentLayout(project) {
  return JSON.stringify({
    nodes: project.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, text: n.text })),
    edges: project.edges.map((e) => ({ from: e.from, to: e.to })),
  });
}

export function buildLayoutBeautifyPrompt({ project }) {
  const lines = [];
  lines.push('Here is a system design diagram\'s components and connections, as JSON (position/size in pixels, x/y is the top-left corner):');
  lines.push('```json');
  const json = summarizeCurrentLayout(project);
  lines.push(json.length > PROJECT_JSON_LIMIT ? json.slice(0, PROJECT_JSON_LIMIT) + ' /* truncated */' : json);
  lines.push('```');
  lines.push('');
  lines.push('Suggest a nicer arrangement of these same components — better readability, sensible grouping, and a layout that reads in the natural direction of the connections (e.g. left-to-right or top-to-bottom request flow, related components near each other, minimal crossing lines).');
  lines.push('Do NOT add, remove, resize, or rename anything — only reposition. Respond with ONLY one JSON code block — no text before or after it — containing exactly this shape:');
  lines.push('```json');
  lines.push('{ "repositions": [ { "id": "n1", "x": 120, "y": 80 }, { "id": "n2", "x": 420, "y": 80 } ] }');
  lines.push('```');
  lines.push('Rules:');
  lines.push('- Include one entry per component id from the input above (every id, not a subset).');
  lines.push('- x/y are the new top-left position in pixels. Leave at least 60px of clearance between any two components\' boxes.');
  lines.push('- Keep every id exactly as given — never invent a new one.');
  return lines.join('\n');
}

/** Re-exported for one consistent import across every AI wizard in this
 * app — the JSON-extraction logic isn't shape-specific. */
export { extractProjectJSON as extractLayoutJSON };

/**
 * Normalizes+validates a raw parsed reply into a safe `{id, x, y}[]` list,
 * dropping anything that isn't a real id in the current project or isn't a
 * finite coordinate — never throws, same contract as this app's other
 * validate/sanitize helpers. A reply missing some ids just means those
 * components keep their current position; nothing is ever moved off a
 * coordinate the AI didn't actually provide.
 */
export function sanitizeLayoutPatch(raw, project) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.repositions)) return [];
  const nodeIds = new Set(project.nodes.map((n) => n.id));
  const seen = new Set();
  const out = [];
  for (const entry of raw.repositions) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, x, y } = entry;
    if (typeof id !== 'string' || !nodeIds.has(id) || seen.has(id)) continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    seen.add(id);
    out.push({ id, x, y });
  }
  return out;
}
