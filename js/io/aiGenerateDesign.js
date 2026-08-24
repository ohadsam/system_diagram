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

// A second, shorter example for the alternative "sequence diagram" shape
// (see the "lifeline" note in buildGenerateDesignPrompt below) — participant
// lifelines with time-ordered messages between them, not a component graph.
// fromOffset/toOffset (0..1, top-to-bottom along each lifeline) are what
// place a message at a specific point in time; omitting them defaults to
// the midpoint, which stacks every message on one spot — always give each
// message its own distinct, increasing offset down both lifelines involved.
const SEQUENCE_EXAMPLE_JSON = `{
  "name": "Example Login Flow",
  "nodes": [
    { "id": "n1", "x": 40, "y": 40, "w": 140, "h": 640, "shape": "lifeline", "text": "Client" },
    { "id": "n2", "x": 320, "y": 40, "w": 140, "h": 640, "shape": "lifeline", "text": "Auth Service" },
    { "id": "n3", "x": 600, "y": 40, "w": 140, "h": 640, "shape": "lifeline", "text": "Users DB" }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2", "label": "POST /login", "routing": "straight", "fromOffset": 0.12, "toOffset": 0.12 },
    { "id": "e2", "from": "n2", "to": "n3", "label": "find user by email", "routing": "straight", "fromOffset": 0.3, "toOffset": 0.3 },
    { "id": "e3", "from": "n3", "to": "n2", "label": "user record", "routing": "straight", "fromOffset": 0.45, "toOffset": 0.45, "dash": "dashed" },
    { "id": "e4", "from": "n2", "to": "n2", "label": "verify password hash", "routing": "straight", "fromOffset": 0.6, "toOffset": 0.72, "fromSide": "right", "toSide": "right" },
    { "id": "e5", "from": "n2", "to": "n1", "label": "200 OK + session token", "routing": "straight", "fromOffset": 0.85, "toOffset": 0.85, "dash": "dashed" }
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
  lines.push('If — and only if — the spec is fundamentally about a step-by-step interaction/flow between a handful of participants over time (e.g. "walk through the login handshake", "show the request lifecycle", "explain the checkout call sequence"), produce a SEQUENCE DIAGRAM instead of a component graph: one tall "lifeline" node per participant, and "messages" as edges between them timed by height. Most specs are NOT this — only switch to this shape when the ask is explicitly about the order of calls/responses, not the static architecture.');
  lines.push('```json');
  lines.push(SEQUENCE_EXAMPLE_JSON);
  lines.push('```');
  lines.push('Sequence diagram rules (only apply these when you chose this shape instead of the component graph above):');
  lines.push('- Every participant is `"shape": "lifeline"`, sized ~140x640, evenly spaced left to right (~280px apart) in the order they first appear in the flow. No other shape mixes into a sequence diagram.');
  lines.push('- Every message is a plain edge between two lifelines with `"routing": "straight"`. Give each one a strictly increasing `fromOffset`/`toOffset` (0..1, top of the lifeline to bottom) in call order — reusing the same offset stacks messages on top of each other, which is the one mistake that ruins this shape. A request/call is normally solid; a response/return reads better `"dash": "dashed"`.');
  lines.push('- A participant messaging itself (e.g. internal validation) uses `"from"` equal to `"to"`, with `"fromOffset"` less than `"toOffset"` (it loops out and back) and matching `"fromSide"`/`"toSide"` (both "right", or both "left").');
  lines.push('- Leave `"icon"`/`"fill"`/`"stroke"` off lifeline nodes — they render with their own fixed style, not a component\'s.');
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
 *
 * Skipped entirely for a sequence diagram (any "lifeline" node present) —
 * a generic square grid would scramble its left-to-right participant order
 * and squash its tall vertical shape into something unrecognizable; even a
 * botched-but-still-horizontal AI layout reads better than that. A
 * dedicated lifeline-specific fallback isn't worth the complexity here
 * given how rarely the AI actually mis-lays out just 2-5 participants.
 */
export function autoArrangeIfNeeded(project) {
  if (project.nodes.some((n) => n.shape === 'lifeline')) return project;
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
