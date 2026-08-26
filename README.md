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

- **Huge component library** — 550+ predefined components across 25
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
- **Design Patterns** — 32 one-click blueprints (MVC, MVVM, Layered
  Architecture, Repository, CQRS, API Gateway, Circuit Breaker,
  Publish-Subscribe, Saga, Hexagonal Architecture, Singleton, Observer,
  Strategy, high-availability blueprints like Active-Active Replication,
  Active-Passive Replication, Multi-AZ Deployment, Read Replica, and
  Multi-Region Active-Active, plus entity-relationship templates like
  One-to-Many, Many-to-Many with Join Table, and Self-Referencing
  Relationship) that drop a whole ready-made cluster of connected
  components onto the canvas at once.
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
  keep it with your project. A "💬 Explain" mode toggle asks instead for a
  plain-language walkthrough of what the diagram represents.
- **🔍 Check Diagram** — instant, offline structural checks (no AI needed):
  flags a client talking straight to a database, a component with no
  connections, or a replication pair with no load balancer routing to it.
  Click a finding to jump straight to it.
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
  Selecting a message offers sync/async/return style presets, or right-click
  it to manually override its auto-computed sequence-number badge; right-click
  a lifeline for a UML "destroy" marker (an X where it terminates) or a
  draggable activation bar (execution occurrence); six "Fragment" shapes
  (Alt/Opt/Loop/Par/Critical/Break) add UML combined-fragment boxes;
  "📋 Copy as Mermaid" / "📋 Copy as PlantUML" in the drill-down view export
  the diagram as text (a "Group / Container" shape overlapping lifelines
  exports as a labeled swimlane box in both formats), and "📥 Import from
  Mermaid" (Create dropdown) does the reverse — paste Mermaid
  `sequenceDiagram` text and it becomes a real, grouped diagram.
  36 ready-made templates (Login Flow, OAuth Handshake, PKCE, SCIM, MFA,
  RBAC/ABAC, SSO, SPA Silent Refresh, API Key Auth, TCP/UDP, Password
  Reset, Magic Link Login, WebAuthn/Passkey, Circuit Breaker, Cache-Aside,
  Saga, Two-Phase Commit, Outbox, Event Sourcing/CQRS, gRPC, GraphQL,
  DNS Resolution, and more) — hover one in the sidebar for a preview
  thumbnail first — are also offered as a Smart Suggestion for relevant
  components (OAuth, SSO, API Gateway, JWT, Redis Cache, WebSocket Server,
  gRPC, GraphQL, Kafka, DNS, ...) and can be dragged from the sidebar
  directly onto an existing node.
- **📐 Scale Diagram** — permanently resize every component and its text
  together by a chosen percentage, distinct from zooming the view.
- **Export** — PNG/PDF snapshots, plus "🌐 Export to..." for the whole
  diagram as Mermaid flowchart text, a draw.io/diagrams.net file, or a
  Lucidchart-importable download — each with a one-click link to open the
  tool itself. "🔗 Share" generates a link that encodes the whole diagram
  in the URL (no backend, nothing uploaded) — opening it loads an
  independent local copy for whoever opens it.
- **Recently Used** — the sidebar's pinned "Recently Used" section shows the
  last 8 components you actually placed on the canvas, most recent first.
- **Diagram Versions & Presentations** — save named snapshots of a diagram
  ("📸 Version History"), revert to one or compare any two side-by-side, then
  assemble a subset of them into a "🎬 Presentation" — play it step-by-step
  or export it to a real `.pptx` file.
- **Reference Architecture Templates** — 5 ready-made "Design X" blueprints
  (URL Shortener, Chat Application, Rate Limiter Service, Social Media Feed,
  Ride-Sharing Dispatch) for interview prep, each a complete starting point
  that drops in as one grouped cluster.
- **Command Palette** — "⌘" toolbar button or Ctrl/Cmd+K opens a searchable
  box covering every app action and the whole component library at once,
  with context-aware results when a component is selected.
- **Estimated cost & label chips** — set a $/mo cost estimate on any
  component (shown as a badge, rolled into a "💰 Cost Breakdown" total), and
  free-form labels now render as visible chips on the component itself.
- **Smart alignment guides** — dragging a component snaps into exact
  alignment with nearby components and shows a Figma-like guide line,
  toggleable via "🧲 Snap Guides".
- **Dark mode & Diagram Theme** — a "Theme" toolbar button cycles
  Match System / Light / Dark for the whole app, while "🎨 Diagram Theme"
  permanently recolors every component to a curated palette (Ocean, Sunset,
  Forest, Monochrome, Pastel), keeping same-colored components grouped.
- **Custom icon upload** — use your own image as any component's icon
  instead of the built-in emoji/icon set.
- **🧭 Minimap** — a small overview map in the canvas corner; click or drag
  it to jump the main view anywhere.
- **🔦 Focus Mode** — dims every component except the current selection and
  its directly-connected neighbors.
- **Manual connector waypoints** — drag handles along a selected connector
  to add, move, or remove bend points, overriding its routing style.
- **Pinned comments** — right-click empty canvas to drop a note pin
  anywhere on the diagram; click a pin to edit it or mark it resolved.
- **Accessibility** — arrow-key nudging for the selected component,
  accessible names on every icon-only toolbar button, and a visible
  keyboard focus ring throughout, including the command palette.
- **Dismissible hints** — a short first-run guided tour, restartable any
  time, with a separate 🔔/🔕 toggle to turn hint bubbles on/off.
- **"What's New"** — a one-time modal after each update summarizing what
  changed, reachable any time afterward from the toolbar.
- **Responsive** — full desktop layout; sidebar/details panel become
  slide-over drawers on mobile, with touch-friendly interactions.
- **📋 Outline panel** — a searchable, collapsible list of every component
  and connector on the canvas, doubling as a table of contents; click an
  entry to jump to it, or select something on the canvas to see it
  highlighted in the list.
- **🕘 Undo History** — a visual timeline of every edit with an
  auto-generated label ("Added...", "Moved 2 components", ...); jump
  straight to any past point instead of pressing undo repeatedly.
- **Terraform export** — "🌐 Export to..." can now also generate a starter
  Terraform (`.tf`) file for the AWS components on the canvas.
- **Diagram tabs** — "🗂️ Open in New Tab..." opens another saved diagram
  (or a new blank one) alongside your current one, with a tab strip to
  switch between them.
- **🖥️ Presenter Mode** — hides the toolbar, sidebar and side panels for a
  full-bleed, distraction-free view; Esc or a floating Exit button brings
  them back.
- **Duplicate-tab warning** — opening this app in a second browser tab
  shows a warning, since both share the same autosave/saved-project storage.
- **🎞️ Diagram Animation** — number components and connectors into an
  ordered reveal sequence from a side panel (auto-timed or click-to-reveal
  per step), then play it back step by step in a clean presentation view —
  advance/go back with the keyboard, freeze to draw over the diagram live,
  and export/import the sequence as its own file.

See [`help.html`](help.html) for the full interactive user guide.

## Tech stack

Vanilla HTML/CSS/JavaScript (ES modules), no framework, no bundler. The
only three runtime dependencies — `html2canvas` and `jsPDF` for PNG/PDF
export, and `PptxGenJS` for the Presentations feature's `.pptx` export —
are vendored locally in `vendor/` (see
[`vendor/VENDOR.md`](vendor/VENDOR.md)), not loaded from a CDN, and only
fetched lazily when you actually use the feature that needs them.

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
