# System Design Diagram Builder

A 100% client-side web app for designing system architecture diagrams —
drag components from a library of 480+ predefined items (AWS services,
databases, caches, message queues, frameworks, code-level layers like
Controller/Service/DAL, ready-made design pattern blueprints like
MVC/CQRS/API Gateway, and generative-AI building blocks like model
providers/MCP/agents) onto a canvas, connect them with configurable
arrows, style everything, and export the result. No backend, no build
step, no account — everything lives in your browser.

## Quick start

No install needed to run it — it's plain HTML/CSS/JS.

```bash
# from the repo root, any static file server works, e.g.:
python3 -m http.server 8080
# then open http://localhost:8080
```

Or open `index.html` directly in a browser.

## Features

- **Huge component library** — 480+ predefined components across 22
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
- **Full canvas editing** — drag, resize, multi-select, duplicate, delete,
  rename inline, pan/zoom, right-click context menu.
- **Connectors** — drag between components to draw arrows with
  configurable routing (straight/elbow/curved), independent start/end
  arrow-head styles, color, thickness, dash pattern and labels.
- **Style toolbar** — colors, shape, border, font, text alignment, size —
  applies to your whole selection at once.
- **Details panel** — notes, labels and sub-components per component,
  with a badge indicator for components that have extra info; "server
  with rows" components manage their internal rows here too.
- **Custom components & shapes** — build and save your own styled
  components ("My Components"), or drop in basic shapes (rectangle,
  circle, diamond, cylinder, cloud, sticky note, server-with-rows, ...).
- **Persistence** — continuous autosave to `localStorage`, named
  "Save As" projects, and JSON import/export for backup/sharing.
- **Export** — PNG and PDF snapshots of your diagram.
- **Dismissible hints** — a short first-run guided tour, restartable any
  time.
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
  panel/    the right-hand details panel
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
