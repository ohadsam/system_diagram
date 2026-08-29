# AI / CLI Integration Guide

This document is written **for an AI agent or CLI tool** (Claude Code, or any other
coding/chat agent with its own model access) that wants to generate a diagram for a
user and get it into **System Design Diagram Builder** — a 100% client-side,
no-backend, no-account web app. There is no server here to call: "integration" means
producing a JSON file in this app's own format and handing it to the user through one
of the two zero-server paths below. If you are that agent, read this whole file before
generating anything — it is the complete contract.

If you are a person who was pointed here by an AI tool: nothing here needs to be
understood by you. Follow whatever the tool tells you to do with its output (usually:
click a link, or open a file in the app).

## The two ways to deliver a diagram (no server involved either way)

### Option A — a direct link (best, if you can run code)

Build a URL that *is* the diagram — opening it loads the diagram straight into the
user's browser, no file, no copy/paste, no upload anywhere. This is exactly what this
app's own "🔗 Share" feature does (`js/io/shareLink.js`), and you can reproduce its
encoding yourself:

1. Build the project JSON (see the schema below) and `JSON.stringify` it.
2. gzip-compress the UTF-8 bytes of that string (the plain DEFLATE-with-gzip-header
   format — Python's `gzip` module and Node's `zlib.gzipSync` both produce this
   natively; no special options needed).
3. Base64-encode the compressed bytes, then make it URL-safe: replace `+` with `-`,
   `/` with `_`, and strip any trailing `=` padding.
4. The final link is: `<APP_URL>/index.html#share=<encoded>` — replace `<APP_URL>`
   with wherever this app is actually hosted (e.g. its GitHub Pages URL, or
   `http://localhost:8080` for a local checkout — you don't know this in advance,
   so ask the user, or infer it from how they reached you).

Runnable reference implementations:

```python
import gzip, base64, json

def build_share_url(app_url: str, project: dict) -> str:
    data = json.dumps(project).encode("utf-8")
    compressed = gzip.compress(data)
    token = base64.urlsafe_b64encode(compressed).decode("ascii").rstrip("=")
    return f"{app_url.rstrip('/')}/index.html#share={token}"
```

```javascript
// Node.js
const zlib = require('zlib');

function buildShareUrl(appUrl, project) {
  const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(project), 'utf8'));
  const token = compressed.toString('base64url'); // Node's base64url already strips padding
  return `${appUrl.replace(/\/$/, '')}/index.html#share=${token}`;
}
```

Once you have the link, just tell the user to open it (or open it yourself if you have
that ability). **If you can't determine `<APP_URL>`, don't guess it** — ask the user,
or fall back to Option B.

### Option B — paste or import the raw JSON (no code execution needed)

If you can't run code (gzip/base64) yourself, just produce the plain project JSON and
tell the user to bring it in one of these ways — all already built into the app, no
extra steps on your end beyond writing correct JSON:

1. **Paste it into a wizard** — open the app, **Create → 🧠 Generate Design from
   Spec** (or **🪄 AI Quick Start**), skip straight to the last step ("Paste the AI's
   result") and paste your JSON there. It's found automatically whether it's the only
   thing pasted, wrapped in a ` ```json ` code fence, or has extra prose around it —
   and it *also* accepts a full share link (Option A's URL) pasted as plain text, so
   either output works in the same box.
2. **Save it as a file and import it** — tell the user to save your JSON output as
   `diagram.json`, then in the app: **File → ⬆️ Import JSON** and pick that file.

Either path calls the exact same validator this app uses for every other import, so
partial or slightly-off JSON (missing an id, an unrecognized field, a color left out)
is repaired or defaulted rather than rejected — see the schema below for what's
actually required versus just nice to include.

## The JSON schema

A project is one JSON object: `{ "name": "...", "nodes": [...], "edges": [...] }`.
Everything else the app's own save format carries (viewport, versions, replication
pairs, ...) is optional and gets sensible defaults — omit all of it.

### Nodes — the boxes on the canvas

```json
{ "id": "n1", "x": 40, "y": 40, "w": 160, "h": 84, "shape": "rounded", "text": "API Gateway", "icon": "🚪", "fill": "#EEF2FF", "stroke": "#4F46E5" }
```

| Field | Required | Notes |
|---|---|---|
| `id` | **yes** | Any unique short string (`"n1"`, `"n2"`, ...) — edges' `from`/`to` must match it exactly. |
| `x`, `y`, `w`, `h` | **yes** | Canvas-space position/size in pixels. Lay nodes out left-to-right or top-to-bottom by data flow, at least 220px apart horizontally and 140px apart vertically so nothing overlaps — the app has no auto-layout fallback for a badly-spread graph unless positions are so degenerate (nearly all identical) that it re-grids everything itself. |
| `text` | **yes** | A short, specific label. |
| `shape` | recommended | One of: `rect`, `rounded`, `circle`, `diamond`, `cylinder`, `hexagon`, `cloud`, `note`, `cuboid`, `lifeline`. `cylinder` = database, `diamond` = decision/branch, `cloud` = external/third-party service, `hexagon` = message queue/broker, `note` = plain sticky note, `lifeline` = sequence-diagram participant (see below). Defaults to `rounded`. |
| `icon` | recommended | A single emoji relevant to the component. |
| `fill`, `stroke` | recommended | Hex colors that make sense together — omit for sensible defaults. |
| `strokeWidth` | optional | Border thickness in px (default 2). |
| `cornerRadius` | optional | Only visible on `rect`/`rounded` shapes; omit for that shape's own default rounding. |
| `borderStyle` | optional | `solid` (default), `dashed`, or `dotted`. |
| `dropShadow` | optional | `true` for a stronger drop shadow. |
| `opacity` | optional | 0-100 (default 100) — a lower value reads as "planned" or "not yet built". |
| `notes` | optional | Free text, shown in the details panel and as a hover tooltip. |
| `labels` | optional | Array of short strings rendered as chips on the node face (e.g. `["10K RPS", "99.9% SLA"]`). |
| `subComponents` | optional | Array of `{ "text": "...", "icon": "..." }` — smaller items attached inside the node (e.g. a service's Controller/Service/DAL layers). |
| `monthlyCost` | optional | A number (USD/month) shown as a badge and rolled into the app's cost total. |
| `fontSize`, `textAlign`, `textPosition`, `iconVisible` | optional | Cosmetic — safe to omit. |

### Edges — the arrows between them

```json
{ "id": "e1", "from": "n1", "to": "n2", "label": "HTTPS", "routing": "orthogonal" }
```

| Field | Required | Notes |
|---|---|---|
| `id` | **yes** | Any unique short string. |
| `from`, `to` | **yes** | Must exactly match a node `id`. |
| `label` | recommended | Short description of the interaction (`"reads"`, `"publishes"`, `"HTTPS"`). |
| `routing` | optional | `straight`, `orthogonal` (default), or `curved` — never `magic` (that mode needs live obstacle data only the running app has). |
| `dash` | optional | `solid` (default) or `dashed` — a dashed arrow conventionally reads as a "response"/"return" rather than a "call". |
| `startArrow`, `endArrow` | optional | `none`, `open`, `filled` (default for `endArrow`), `diamond`, `circle`. |
| `notes` | optional | Free text, shown as a hover tooltip on the edge. |

### Alternative shape: sequence diagrams

If the request is specifically about **the order of calls/responses over time**
between a handful of participants (not a static architecture), produce a sequence
diagram instead: every node is `"shape": "lifeline"` (sized ~140×640, evenly spaced
~280px apart left to right, in the order participants first appear), and every
message is an edge between two lifelines with `"routing": "straight"` plus a
`fromOffset`/`toOffset` — a fraction 0..1 down the lifeline (top to bottom) marking
*when* that message happens. Give every message a strictly increasing offset in call
order; reusing the same offset stacks messages on top of each other, which is the one
mistake that ruins this shape. A response naturally reads better with `"dash":
"dashed"`. Leave `icon`/`fill`/`stroke` off lifeline nodes — they render with their
own fixed look.

```json
{
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
    { "id": "e4", "from": "n2", "to": "n1", "label": "200 OK + session token", "routing": "straight", "fromOffset": 0.85, "toOffset": 0.85, "dash": "dashed" }
  ]
}
```

### A complete component-graph example

```json
{
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
}
```

For a good, detailed result: include every major component a spec implies (don't
skip databases, caches, queues, or external services), but don't over-fragment
trivial ones — roughly 6-20 components for a real system, 4-12 for a short
description. Give every node a real, distinct position (the spacing rule above) —
the app's own auto-layout safety net only kicks in when almost every node shares the
same position, and does a plain grid, not something spec-aware.

## Template: what to tell the user

Adapt one of these once you've generated the diagram:

> **If you have a direct link (Option A):** "I've generated your diagram — open this
> link to load it: `<the link>`"
>
> **If you only have JSON (Option B):** "I've generated your diagram as JSON. Open
> System Design Diagram Builder, go to **Create → 🧠 Generate Design from Spec**,
> jump to the last step, and paste this in: \`\`\`json ... \`\`\` — or save it as
> `diagram.json` and use **File → ⬆️ Import JSON** instead."

## Further reading

- [`SPEC.md`](SPEC.md) — the complete functional specification of every feature in
  this app (600+ components, styling, export formats, and much more), if you need to
  understand a capability beyond generating a diagram.
- [`../help.html`](../help.html) — the in-app user guide, written for a human.

---
*Maintainer note: the example JSON above is kept in sync by hand with
`js/io/aiGenerateDesign.js`'s own `EXAMPLE_JSON`/`SEQUENCE_EXAMPLE_JSON` constants
(used for the in-app "hand off to your own AI chat" prompts) — update both together
if the schema changes.*
