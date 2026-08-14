# Changelog

All notable changes to this project. Format: date, then bullet list.
Keep this in sync with `PLAN.md` as stages complete.

## Unreleased

- Initial build: full client-side system design diagram builder per
  `SPEC.md` v1 — canvas, ~310-component library across 19 categories,
  connectors with configurable routing/arrowheads, style toolbar, details
  panel with sub-components/rows, custom component & shape builder,
  localStorage autosave + named projects, JSON/PNG/PDF export, dismissible
  hints, responsive/mobile layout, standalone `help.html` guide, unit +
  Playwright e2e tests (44 + 24 passing), GitHub Pages deploy workflow.
- Fixed during review: clicking a node during a drag gesture suppressed
  the browser's default focus-shift (a `preventDefault()` side effect),
  which silently broke keyboard shortcuts (Delete/undo/duplicate) right
  after interacting with the canvas — now explicitly focuses the
  node/edge/canvas so shortcuts always work.
  Fixed: components saved to "My Components" couldn't actually be placed
  on the canvas (their ids weren't resolved against the custom-component
  registry, only the built-in library) — a core feature that was
  silently broken.
  Fixed: the contextual toolbar row's `hidden` attribute had no visual
  effect because `.toolbar-row` also sets `display: flex`, which (per the
  CSS cascade) silently wins over the browser's `[hidden] { display:none }`
  default — added an explicit override rule.
  Added: Ctrl/Cmd+S now saves an actual checkpoint (was previously a no-op
  beyond swallowing the browser's Save Page dialog while typing).
  Added: the mobile sidebar drawer now auto-closes after a component is
  placed or the canvas is tapped, instead of requiring an extra tap.

## Unreleased (2)

- Added **Layers & Roles** category (~97 items: Controller, Service, DAL,
  Authentication, React Hook, Angular Guard, DDD building blocks, ...).
  Drag one onto an existing node to attach it as a sub-component (green
  dashed drop highlight); drop/click on empty canvas places it as a
  normal standalone node. The details panel's sub-component name field
  now autocompletes against this library and auto-fills the icon.
- Added **Design Patterns** category (24 blueprints: MVC, MVVM, Layered
  Architecture, Repository, CQRS, API Gateway, Circuit Breaker,
  Publish-Subscribe, Event Sourcing, Saga, Sidecar, Strangler Fig, BFF,
  Hexagonal Architecture, Service Discovery, Cache-Aside, Rate Limiting,
  plus classic GoF patterns Singleton/Factory Method/Observer/Strategy/
  Adapter/Decorator). Dropping or clicking one instantiates the whole
  cluster of nodes + connectors at once, positioned around the drop
  point, selected together as a single undo step.
- Library now totals ~430 components across 21 categories.

## Unreleased (3)

- Added **AI Providers & Agents** category (~57 items): model providers
  (OpenAI, Anthropic, Google, AWS Bedrock, Azure OpenAI, Mistral, Cohere,
  Hugging Face, Ollama, Groq, ...), specific model families (GPT, Claude,
  Gemini, Llama, Whisper, DALL·E, Stable Diffusion, ...), the Model
  Context Protocol (MCP Server/Client/Tool/Resource/Prompt), agents and
  agent frameworks (LangGraph, AutoGen, CrewAI, Semantic Kernel,
  LlamaIndex, agent memory/planner/orchestrator), and the skills/tools/RAG
  building blocks around them (Skill, Skill Library, System Prompt, Prompt
  Template, RAG Pipeline, Knowledge Base, Guardrails, Fine-Tuning Job,
  Function/Tool Calling). A plain component category — no special
  attach/instantiate behavior, complements the existing AI/ML (ML infra)
  category rather than duplicating it.
- Library now totals ~490 components across 22 categories.

## Unreleased (4)

- Added a global **"🎛️ Default settings"** toolbar button/modal: no
  background color, show/hide icon, text position (center/top/bottom
  inside the shape, or above/below floating outside it), and
  sub-components display mode (compact chips vs full list) — applied to
  newly created components from then on, plus an explicit "apply to all
  existing components now" bulk action (one undo step). Every one of
  these remains fully overridable per component via the toolbar style
  editor at any time.
- Added a **collapse/expand toggle** to the details panel header (a
  chevron next to the existing ✕ close button) — shrinks it to a slim
  strip without losing the current selection/edit context; opening a
  different component's details always starts expanded.
- Sub-components can now render on the node itself as either compact
  truncated chips (previous/default behavior) or a full untruncated list
  of rows, settable per node from its details panel or via the new global
  default.
- New node fields: `iconVisible`, `textPosition`, `subComponentsDisplay`
  (see `docs/SPEC.md` 4.2.4, `docs/ARCHITECTURE.md` "Node label
  placement").

## Unreleased (5)

- Added **saved-project favorites**: a ⭐ toggle per project in the Load
  modal, favorites sorted first, plus a "Favorites only" filter checkbox.
  Favorite status survives re-saving the same project.
- Added **bulk export/import for saved projects** ("Export all… / Import
  all…" in the Load modal) and **bulk export/import for the whole My
  Components library** (quick 📤/📥 icons on the sidebar's "My Components"
  header) — both alongside the existing single-project/single-library
  flows.
- Added a **full project backup**: a new toolbar "🗄️ Backup & Restore"
  modal exports/restores everything at once — the live canvas, global
  default settings, the whole My Components library, and every saved
  project — in one `.json` file. Restoring asks for confirmation first
  since it replaces the current canvas and defaults.
- Added **name/id collision handling** to every merge-style import (My
  Components, saved projects, and full backup): an `id` match overwrites
  the existing record; a `name` collision with a different `id` gets a
  disambiguating suffix ("(imported)", "(imported 2)", ...) instead of
  silently overwriting or duplicating by name.
- Added **folders for "My Components"**: an optional free-text `folder`
  field (with autocomplete) on custom components, grouping them into
  collapsible 📁 sub-groups in the sidebar.
