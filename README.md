# System Design Diagram Builder

A 100% client-side web app for designing system architecture diagrams —
drag components from a library of 500+ predefined items (AWS services,
databases, caches, message queues, frameworks, code-level layers like
Controller/Service/DAL, ready-made design pattern and state-machine
blueprints like MVC/CQRS/API Gateway/Traffic-Light, and generative-AI
building blocks like model providers/MCP/agents) onto a canvas, connect
them with configurable arrows (including an auto-routing "Magic Arrow"),
style everything, and export the result. No backend, no build step, no
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

- **Huge component library** — 500+ predefined components across 23
  categories (AWS, Databases, Cache, Messaging, Monitoring, DevOps,
  Containers, Networking, Security, Servers, Client/Frontend, Frontend &
  Backend frameworks, Storage, Logging, AI/ML, Cloud providers, Basic
  shapes, and more), searchable and alphabetically sorted.
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
- **Design Patterns** — 24 one-click blueprints (MVC, MVVM, Layered
  Architecture, Repository, CQRS, API Gateway, Circuit Breaker,
  Publish-Subscribe, Saga, Hexagonal Architecture, Singleton, Observer,
  Strategy, and more) that drop a whole ready-made cluster of connected
  components onto the canvas at once.
- **State Machines** — states, transitions and conditions using the same
  components/connectors as the rest of the diagram (no special mode), plus
  6 ready-made templates (Traffic Light, Order Lifecycle, TCP Connection,
  Media Player, Approval Workflow, Auth Session). Hideable from the
  sidebar entirely for anyone who doesn't need it.
- **Full canvas editing** — drag, resize, multi-select (including
  connectors, via marquee or shift-click), duplicate, delete, rename
  inline, pan/zoom (buttons, Ctrl/Cmd+scroll, or keyboard Ctrl/Cmd +
  "+"/"-"/"0"), right-click context menu, and Group/Ungroup for tying
  components together as one selectable/movable unit.
- **Connectors** — drag between components to draw arrows with
  configurable routing (straight/elbow/curved, or "🪄 Magic" — auto-routes
  around every other component with the fewest bends), independent
  start/end arrow-head styles, color, thickness, dash pattern and labels.
  Deleting a component always cleans up every connector attached to it.
- **Style toolbar** — colors, shape, border, font, text alignment/position
  (including outside-the-shape captions), icon visibility, size — applies
  to your whole selection at once.
- **Global default settings** — set defaults (transparent background, show
  icon, text position, sub-components display) applied to every newly
  created component, with a one-click "apply to all existing components"
  action — any component can still be styled differently at any time.
- **Details panel** — notes, labels and sub-components per component
  (shown as compact chips or a full list), with a badge indicator for
  components that have extra info, and a collapse/expand toggle alongside
  the close button; "server with rows" components manage their internal
  rows here too.
- **Custom components & shapes** — build and save your own styled
  components ("My Components", organizable into folders), or drop in
  basic shapes (rectangle, circle, diamond, cylinder, cloud, sticky note,
  server-with-rows, ...).
- **Persistence** — continuous autosave to `localStorage`, named
  "Save As" projects (with ⭐ favorites and a favorites filter), and JSON
  import/export for backup/sharing at every level: a single project, the
  whole My Components library, every saved project together, or a single
  "🗄️ Backup & Restore" file with everything at once — all with automatic
  name/id collision handling on import.
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
- **Export** — PNG and PDF snapshots of your diagram.
- **Dismissible hints** — a short first-run guided tour, restartable any
  time.
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
