# System Design Diagram Builder

A 100% client-side web app for designing system architecture diagrams —
drag components from a library of 500+ predefined items (AWS services,
databases, caches, message queues, frameworks, code-level layers like
Controller/Service/DAL, ready-made design pattern and state-machine
blueprints like MVC/CQRS/API Gateway/Traffic-Light, and generative-AI
building blocks like model providers/MCP/agents) onto a canvas, connect
them with configurable arrows (every connector auto-routes around
obstacles by default), style everything, and export the result. No
backend, no build step, no
account — everything lives in your browser.

## Quick start

No install needed to run it — it's plain HTML/CSS/JS.

```bash
# from the repo root, any static file server works, e.g.:
python3 -m http.server 8080
# then open http://localhost:8080
```

Or open `index.html` directly in a browser.

## Features

- **Huge component library** — 550+ predefined components across 24
  categories (AWS, Databases, Cache, Messaging, Monitoring, DevOps,
  Containers, Networking, Security, Servers, Client/Frontend, Frontend &
  Backend frameworks, Storage, Logging, AI/ML, Cloud providers, Basic
  shapes, and more), searchable and alphabetically sorted, with the most
  commonly-used component in each category (PostgreSQL, Docker, S3, Kafka,
  React, ...) subtly highlighted with a ★ badge — a "★ Popular only"
  toggle narrows the list down to just those.
- **⭐ Favorites** — right-click any component and pin it to a Favorites
  section at the top of the sidebar; organize favorites into folders and
  subfolders, reorder, rename, or delete — all from the same right-click
  menu (or the section's own "+ New folder" button).
- **AI Providers & Agents** — ~57 generative-AI building blocks: model
  providers (OpenAI, Anthropic, Google, Bedrock, Azure OpenAI, Mistral,
  Cohere, Hugging Face, Ollama, ...), model families (GPT, Claude,
  Gemini, Llama, Whisper, DALL·E, ...), MCP (Server/Client/Tool/Resource/
  Prompt), agents & agent frameworks (LangGraph, AutoGen, CrewAI,
  Semantic Kernel, LlamaIndex), and skills/tools/RAG (Skill, System
  Prompt, RAG Pipeline, Knowledge Base, Guardrails, Function Calling).
- **Layers & Roles** — ~100 code-level building blocks (Controller,
  Service, DAL, Authentication, React Hook, Angular Guard, DDD terms, ...).
  Drag one onto an existing component to attach it as a sub-component, or
  add it via that component's details panel (with autocomplete).
- **Design Patterns** — 29 one-click blueprints (MVC, MVVM, Layered
  Architecture, Repository, CQRS, API Gateway, Circuit Breaker,
  Publish-Subscribe, Saga, Hexagonal Architecture, Singleton, Observer,
  Strategy, plus high-availability blueprints like Active-Active
  Replication, Active-Passive Replication, Multi-AZ Deployment, Read
  Replica, and Multi-Region Active-Active) that drop a whole ready-made
  cluster of connected components onto the canvas at once.
- **State Machines** — states, transitions and conditions using the same
  components/connectors as the rest of the diagram (no special mode), plus
  6 ready-made templates (Traffic Light, Order Lifecycle, TCP Connection,
  Media Player, Approval Workflow, Auth Session). Hideable from the
  sidebar entirely for anyone who doesn't need it.
- **Full canvas editing** — drag, resize, multi-select (including
  connectors, via marquee, shift-click, or Ctrl/Cmd-click to toggle one
  item in/out of the current selection), duplicate, delete, rename
  inline, pan/zoom (buttons, Ctrl/Cmd+scroll, or keyboard Ctrl/Cmd +
  "+"/"-"/"0"), right-click context menu (including "🧹 Clear canvas" to
  wipe everything and start fresh, undoable), and Group/Ungroup for tying
  components together as one selectable/movable unit — a group of 2+ (and
  each side of a Live Replication pair) shows a dismissible dashed
  background so it reads as one unit at a glance.
- **Navigation tools** — a 🖱️ Select / ✋ Hand toolbar toggle (`H`/`V`
  shortcuts, or hold **Space**): Hand pans the canvas by dragging anywhere,
  even over a component, without moving or altering it.
- **🗺️ Auto-arrange** — rearranges every component on the canvas into a
  clean top-to-bottom layout that follows your connectors' direction, and
  reconnects every arrow to match.
- **🔎 Find on canvas** — a toolbar search box that finds components and
  connectors already placed in your diagram by name/label (not the sidebar
  library), selecting and centering the view on each match as you type;
  Enter/Shift+Enter cycle through the rest.
- **Save any selection as a component** — turn 2+ selected components
  (plus the connectors between them) into a reusable "My Components" item
  in one click, with or without grouping them first — drop it again to
  recreate the whole group, styled exactly as saved.
- **✨ Smart Suggestions** — placing a component with a well-known
  real-world companion (Load Balancer → a web server; Kafka →
  Elasticsearch; API Gateway → Lambda; and more) shows a small dismissible
  banner with one-click "+ Add" buttons for each one — accepting one draws
  the connecting arrow automatically and places the new component sensibly
  — and, where relevant, a second row of one-click sub-components to attach
  directly onto that node (Express → Controller/Middleware; React →
  Hook/Component; API Gateway → Authentication/Rate Limiter). Off switch in
  Default Settings for anyone who doesn't want it. A component with any
  unattached sub-component suggestion keeps a small 💡 badge — click it any
  time to check off any number in the details panel and attach them all at
  once, not just right after placing it.
- **Connectors** — drag between components to draw arrows that anchor on
  whichever side actually makes sense between the two (not just whichever
  point you dragged from) with configurable routing (straight/elbow/curved,
  or "🪄 Magic" — auto-routes around every other component with the fewest
  bends; every other routing now auto-avoids obstacles too), independent
  start/end arrow-head styles, color, thickness, dash pattern and labels.
  Deleting a component always cleans up every connector attached to it.
- **Style toolbar** — colors, shape, border, font, text alignment/position
  (including outside-the-shape captions), icon visibility, size — applies
  to your whole selection at once. Its header lets you collapse it to a
  slim strip without losing your selection (handy on mobile), or close it
  outright. Shows as a small floating card next to your selection by
  default, or pin it (📌) to the top of the screen instead — set your
  preferred default (floating, pinned to top, or pinned to bottom) in
  Default Settings.
- **Global default settings** — set defaults (transparent background, show
  icon, text position, sub-components display) applied to every newly
  created component, with a one-click "apply to all existing components"
  action — any component can still be styled differently at any time.
- **Details panel** — notes, labels and sub-components per component
  (shown as compact chips or a full list), with a badge indicator for
  components that have extra info, a collapse/expand toggle alongside the
  close button, and a drag-to-resize left edge; "server with rows"
  components manage their internal rows here too. Tracks canvas
  selection — switches to a newly-selected component automatically, and
  closes on deselect.
- **Custom components & shapes** — build and save your own styled
  components ("My Components", organizable into folders), or drop in
  basic shapes (rectangle, circle, diamond, cylinder, cloud, sticky note,
  server-with-rows, lifeline, ...).
- **Persistence** — continuous autosave to `localStorage`, named
  "Save As" projects (with ⭐ favorites and a favorites filter), and JSON
  import/export for backup/sharing at every level: a single project, the
  whole My Components library, every saved project together, or a single
  "🗄️ Backup & Restore" file with everything at once (including the
  component Favorites library) — all with automatic name/id collision
  handling on import.
- **Duplicate Project** — clone the whole diagram into a new, independent
  project in one click (the original stays untouched), or duplicate the
  entire canvas in place within the same project.
- **🤖 AI Design Review** — prepares a review prompt and exports your
  diagram as an image, then opens Claude/ChatGPT/Gemini/Copilot's own
  website so you can get a review — no API key or setup, since it uses the
  account you're already signed into there. Optionally attach a spec file
  to compare against; paste the AI's reply back into the side panel to
  keep it with your project.
- **🧠 Generate Design** — the reverse direction: paste or load a
  requirements spec, get a tailored prompt (with the same one-click AI
  links as above) that guides the AI to reply with a design in this app's
  own format, then paste that reply back in and it's imported straight
  onto the canvas as real, editable components.
- **🔁 Replicate** — link a selection to a live-mirrored second side
  (Active-Active / Active-Passive / Primary-Replica). Add, move, resize,
  restyle or rename a component on either side and its peer follows
  automatically — connectors between mirrored components mirror too, not
  just the components themselves; delete one and its peer goes too. Mark
  any single component "Exclude from replication" to opt it out, or
  ❄️ freeze a whole pair to edit one side without touching the other.
- **🔀 Sequence Diagrams** — name a set of participants and get a titled
  vertical "lifeline" for each, evenly spaced; drag between two lifelines
  to draw a message at whatever height represents when it happens (several
  messages on the same lifeline land at their own distinct heights instead
  of piling up), with messages between two lifelines auto-numbered in the
  order they occur — a lifeline can even message itself (renders as a small
  loop). Drag a message's endpoint handle to reconnect it to a different
  height/lifeline, or use "↔️ Distribute Evenly" to re-space a diagram
  that's drifted uneven. Group 2+ lifelines for a 🔍 zoom-in icon on the
  group: a read-only preview (or pinned side panel) with an "✏️ Edit"
  button for real editing that saves back into the main diagram — each such
  group also exports as its own extra PNG/PDF page. Right-click any
  connector for a new "Open details" notes panel — handy for annotating a
  message, but works on any connector; a connector's notes also show as a
  hover tooltip, and its label can be positioned near the start/middle/end.
  Selecting a message offers sync/async/return style presets; right-click a
  lifeline for a UML "destroy" marker (an X where it terminates) or a
  draggable activation bar (execution occurrence); four "Fragment" shapes
  (Alt/Opt/Loop/Par) add UML combined-fragment boxes; "📋 Copy as Mermaid"
  in the drill-down view exports the diagram as Mermaid `sequenceDiagram`
  text. 23 ready-made templates (Login Flow, OAuth Handshake, PKCE, SCIM,
  MFA, RBAC/ABAC, SSO, SPA Silent Refresh, API Key Auth, TCP/UDP, Password
  Reset, Magic Link Login, WebAuthn/Passkey, Circuit Breaker, Cache-Aside,
  Saga, and more) are also offered as a Smart Suggestion for relevant
  components (OAuth, SSO, API Gateway, JWT, Redis Cache, WebSocket Server,
  ...) and can be dragged from the sidebar directly onto an existing node.
- **📐 Scale Diagram** — permanently resize every component and its text
  together by a chosen percentage, distinct from zooming the view.
- **Export** — PNG and PDF snapshots of your diagram.
- **Dismissible hints** — a short first-run guided tour, restartable any
  time, with a separate 🔔/🔕 toggle to turn hint bubbles on/off.
- **"What's New"** — a one-time modal after each update summarizing what
  changed, reachable any time afterward from the toolbar.
- **Responsive** — full desktop layout; sidebar/details panel become
  slide-over drawers on mobile, with touch-friendly interactions.

See [`help.html`](help.html) for the full interactive user guide.

## Tech stack

Vanilla HTML/CSS/JavaScript (ES modules), no framework, no bundler. The
only two runtime dependencies — `html2canvas` and `jsPDF`, used solely for
PNG/PDF export — are vendored locally in `vendor/` (see
[`vendor/VENDOR.md`](vendor/VENDOR.md)), not loaded from a CDN, and only
fetched lazily when you actually export.

## Project structure

```
index.html / help.html        entry page + user guide
css/                           one stylesheet per UI area
js/
  core/     central store, undo/redo history, project (de)serialization
  data/     the component library (pure data, easy to extend)
  canvas/   rendering, pan/zoom, drag/resize, connectors
  sidebar/  search + draggable component list
  toolbar/  global actions + contextual style/arrow editors
  panel/    the right-hand details panel + AI design review panel
  modals/   custom component/shape, save-as, load, confirm dialogs
  io/       localStorage, JSON, PNG/PDF export
  hints/    the guided-tour hints
  utils/    small shared DOM/color/form helpers
vendor/     vendored html2canvas + jsPDF (export only)
tests/
  unit/     Node test-runner tests for pure logic
  e2e/      Playwright browser tests
docs/       SPEC.md, PLAN.md, ARCHITECTURE.md, AI_AGENT_GUIDE.md, CHANGELOG.md
```

Full docs live in [`docs/`](docs/) — start with
[`docs/SPEC.md`](docs/SPEC.md) (what it does) and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (how it's built).
[`docs/AI_AGENT_GUIDE.md`](docs/AI_AGENT_GUIDE.md) is a quick-start for AI
coding agents (Claude, Copilot, etc.) picking up this repo.

## Running tests

```bash
npm install          # installs Playwright only — the app itself needs no deps

npm run test:unit    # pure-logic tests, no browser (Node's test runner)
npm run test:e2e     # Playwright, drives a real Chromium against the app
npm test              # both
```

## Deploying to GitHub Pages

Since this is a static site with no build step, it deploys via GitHub's
classic Pages setup: in the repo's **Settings → Pages**, set **Source** to
**Deploy from a branch**, pick branch `main` and folder `/ (root)`. From
then on, every push to `main` publishes automatically — no CI run
involved.

`.github/workflows/deploy.yml` (an Actions-based alternative) is kept in
the repo on standby, triggered manually only (`workflow_dispatch`) — see
the comment at the top of that file if you ever want to switch to it
instead (e.g. after adding a real build step).
