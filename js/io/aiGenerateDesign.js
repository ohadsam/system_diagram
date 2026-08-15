// "Generate Design from Spec" — the reverse direction of io/aiReview.js:
// instead of asking an AI to review an existing diagram, this builds a
// prompt asking it to *propose* a system design from a requirements spec,
// anchored to our own project JSON shape (via a few-shot example) so the
// reply can be pasted back in and imported directly. Same "prepare & hand
// off" philosophy and the same constraint it exists because of — see
// docs/SPEC.md 4.12/4.13: no mainstream LLM offers key-free API access.
import { SHAPES, ROUTINGS } from '../core/project.js';

const SPEC_TEXT_LIMIT = 16000;
const PLACEABLE_SHAPES = SHAPES.filter((s) => s !== 'rows');
const ROUTING_CHOICES = ROUTINGS.filter((r) => r !== 'magic'); // "magic" needs live obstacle data the AI can't have

const EXAMPLE_JSON = `{
  "name": "Example Order Service",
  "nodes": [
    { "id": "n1", "x": 40, "y": 40, "w": 160, "h": 84, "shape": "rounded", "text": "API Gateway", "icon": "🚪", "fill": "#EEF2FF", "stroke": "#4F46E5" },
    { "id": "n2", "x": 320, "y": 40, "w": 160, "h": 84, "shape": "rounded", "text": "Order Service", "icon": "🧾", "fill": "#ECFDF5", "stroke": "#059669" },
    { "id": "n3", "x": 320, "y": 220, "w": 160, "h": 84, "shape": "cylinder", "text": "Orders DB", "icon": "🗄️", "fill": "#FFF7ED", "stroke": "#EA580C" }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2", "label": "HTTPS", "routing": "orthogonal" },
    { "id": "e2", "from": "n2", "to": "n3", "label": "reads/writes", "routing": "orthogonal" }
  ]
}`;

export function buildGenerateDesignPrompt({ specText = '' } = {}) {
  const lines = [];
  lines.push('Based on the product/requirements spec below, propose a system design / software architecture for it.');
  lines.push('');
  lines.push('Respond with ONLY one JSON code block — no text before or after it — containing an object with exactly this shape (this is a real, complete example, not just a fragment):');
  lines.push('```json');
  lines.push(EXAMPLE_JSON);
  lines.push('```');
  lines.push('');
  lines.push('Rules:');
  lines.push(`- Every node needs a unique "id" (short strings like "n1", "n2", ...) — edges' "from"/"to" must exactly match a node "id".`);
  lines.push(`- "shape" must be one of: ${PLACEABLE_SHAPES.join(', ')} (cylinder = database, diamond = decision/branch, cloud = external/third-party service, hexagon = message queue/broker, note = plain label).`);
  lines.push('- Give each node a short, specific "text" label and a single relevant emoji as "icon". Choose "fill"/"stroke" hex colors that make sense together, or omit them for sensible defaults.');
  lines.push('- Lay nodes out left-to-right or top-to-bottom by data flow, at least 220px apart horizontally and 140px apart vertically, so nothing overlaps.');
  lines.push(`- Edge "routing" must be one of: ${ROUTING_CHOICES.join(', ')}. Give each edge a short "label" describing the interaction (e.g. "reads", "publishes", "HTTPS").`);
  lines.push('- Include every major component implied by the spec — don\'t skip databases, caches, queues, or external services — but don\'t over-fragment trivial ones either. Aim for roughly 6-20 components depending on complexity.');
  lines.push('');
  lines.push('--- SPEC START ---');
  lines.push(specText.trim().slice(0, SPEC_TEXT_LIMIT) || '(no spec text provided — use your best judgement for a generic, reasonable example system)');
  lines.push('--- SPEC END ---');
  return lines.join('\n');
}

/**
 * Pulls a project-shaped object out of raw AI response text: a direct
 * JSON.parse, then a ```json fenced block, then the first-`{`-to-last-`}`
 * substring — whichever parses first. Never throws.
 * @returns {{ok:true, data:object}|{ok:false, error:string}}
 */
export function extractProjectJSON(text) {
  if (!text || !text.trim()) return { ok: false, error: "Paste the AI's response first." };

  const candidates = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return { ok: true, data: parsed };
    } catch {
      // try the next candidate
    }
  }
  return { ok: false, error: "Couldn't find valid JSON in that text — make sure you copied the AI's whole reply, including the code block." };
}

const OVERLAP_THRESHOLD = 0.5; // if fewer than half the nodes have a distinct (x,y), treat positions as unusable

function needsAutoLayout(nodes) {
  if (nodes.length <= 1) return false;
  const uniquePositions = new Set(nodes.map((n) => `${n.x},${n.y}`));
  return uniquePositions.size / nodes.length < OVERLAP_THRESHOLD;
}

/**
 * Safety net for when the AI ignores the layout instructions and stacks
 * nodes on top of each other (or close enough to make the diagram
 * unreadable): re-lays them out on a simple grid, preserving order.
 * Leaves a project with genuinely distinct positions untouched.
 */
export function autoArrangeIfNeeded(project) {
  if (!needsAutoLayout(project.nodes)) return project;
  const cols = Math.max(1, Math.ceil(Math.sqrt(project.nodes.length)));
  const COL_W = 220;
  const ROW_H = 160;
  const MARGIN = 40;
  const nodes = project.nodes.map((n, i) => ({
    ...n,
    x: MARGIN + (i % cols) * COL_W,
    y: MARGIN + Math.floor(i / cols) * ROW_H,
  }));
  return { ...project, nodes };
}
