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
  (see `docs/SPEC.md` 4.2.5, `docs/ARCHITECTURE.md` "Node label
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

## v1.2.0 (2026-08-14)

Starting formal version tracking here — see `js/version.js`
(`APP_VERSION`/`VERSION_HISTORY`) and `docs/SPEC.md` 4.11. Bump
`APP_VERSION` and add a `VERSION_HISTORY` entry with every future
user-facing fix or feature, alongside this changelog.

- Added a **"What's New" modal**: shown once after an update to anyone
  who's used the app before (a brand-new visitor doesn't get it — the
  hints tour covers onboarding), listing what changed since they last
  looked; reachable any time afterward from the toolbar's "🆕" button.
- Added a **"State Machines"** component category: state shapes (Initial
  State, State, Choice/Decision, Final State, Fork/Join, History State,
  Composite State) plus six ready-made pattern templates (Traffic Light,
  Order Lifecycle, TCP Connection, Media Player, Approval Workflow, Auth
  Session). No new engine concepts — a state is just a node and a
  transition's condition is just an edge's existing `label`, so it mixes
  freely with the rest of a diagram and a diagram that never touches it is
  unaffected. Can be hidden from the sidebar via the "🎛️" settings modal's
  new "Component library" section (`hideStateMachines`, `js/io/librarySettings.js`).
- Added **keyboard zoom**: Ctrl/Cmd + "+"/"-"/"0" to zoom in/out/reset to
  100%, alongside the existing toolbar buttons and Ctrl/Cmd+scroll.
- Confirmed and locked in with explicit test coverage: deleting a
  component always cascades to delete every connector attached to it
  (`core/project.js#removeNode`) — no dangling arrows are possible.
- Added **combined component+connector selection**: marquee-select now
  also picks up connectors fully inside the box; duplicate/delete act on a
  mixed selection together in one step; the toolbar shows both the
  component and connector style editors at once for a mixed selection.
  Added **Group/Ungroup** (🔗/✂️): 2+ selected components can be tied
  together so selecting/dragging any one of them acts on the whole group;
  duplicating a group gives the copies their own new group. New node field
  `groupId`.
- Added **"🪄 Magic Arrow"**: an obstacle-avoiding auto-routed connector.
  Arm it from the toolbar, then draw a connector as usual — it
  automatically finds an orthogonal path to the target that avoids every
  other component, using as few bends as possible
  (`js/core/magicRouter.js`, a grid-based least-turns search), falling
  back to a plain elbow route if no clear path exists. New `routing`
  value `'magic'`, also chooseable for any existing connector from its
  style editor.

## v1.5.0 (2026-08-15)

- Added AWS container/orchestration components: **EKS Cluster**, **EKS
  Node Group**, **Pod (EKS)**, **ECS Cluster**, **ECS Service**, **ECS
  Task**.
- Added 5 high-availability/replication **Design Patterns**: Active-Active
  Replication, Active-Passive Replication (Primary-Standby), Multi-AZ
  Deployment, Read Replica, Multi-Region Active-Active — each a one-time,
  labeled blueprint of nodes + connectors, same as the existing patterns.
- Added **"🔁 Replicate"** — live, ongoing replication between two sides of
  a diagram, distinct from the static patterns above. Link a selection to
  an auto-generated mirrored second side (Active-Active / Active-Passive /
  Primary-Replica, a descriptive label only — every mode uses the same
  mechanism); from then on, a component added to either side automatically
  gets a mirror on the other, and moving/resizing/restyling/renaming/
  editing a mirrored component propagates to its peer. Deleting a mirrored
  component deletes its peer too, so the two sides can't silently drift
  out of sync. Any component can be marked "Exclude from replication" (its
  details panel) to opt out without affecting the rest of its side —
  excluding an already-mirrored component severs the link without
  deleting its peer, which is then frozen at its last state rather than
  orphaned into looking like a fresh unmapped member. Break a pair any
  time from the "🔁 Replicate" modal, leaving both sides exactly as they
  are. New `js/core/replication.js` (the pure sync engine, wired into
  `core/store.js#dispatch`/`loadProject` so every mutation path gets
  mirroring for free) + `js/modals/replicationModal.js`.
- Extended the project schema with `replicationPairs` and a per-node
  `replicationExcluded` flag; `validateProject()` and `duplicateProject()`
  both updated to validate/remap this data the same defensive way as
  everything else.

## v1.4.0 (2026-08-15)

- Added **"🧠 Generate Design"**: a 3-step wizard that runs the AI Design
  Review mechanism in reverse. Step 1: paste or load a requirements spec.
  Step 2: an editable, schema-anchored prompt (embedding a valid few-shot
  JSON example of this app's own project format) with the same
  Claude/ChatGPT/Gemini/Copilot one-click links as AI Design Review — no
  API key here either, same reasoning as before. Step 3: paste the AI's
  reply back in; the JSON is extracted automatically (direct parse, then a
  fenced code block, then a loose `{...}` fallback) and validated through
  the existing `validateProject()` before loading onto the canvas as real,
  editable components, with a grid-layout safety net if the AI ignored the
  layout instructions. Replacing a non-empty canvas asks for confirmation
  first. New `js/io/aiGenerateDesign.js` + `js/modals/generateDesignModal.js`.
- Hardened `validateProject()`: a node or edge missing (or with an
  invalid) `id` now gets a fresh one generated for it instead of being
  silently dropped — makes every import path (file import, backup
  restore, and the new Generate Design paste-back) more forgiving of
  hand-edited or AI-generated JSON.
- Fixed: a multi-step modal whose content changes size between steps
  (like the new wizard) could close itself when a button click was
  followed by the dialog shrinking — the backdrop-click detection in
  `modal.js` compared click coordinates against the dialog's bounding
  rect, which could be stale in the very frame the content resized.
  Switched to checking `event.target === dialog`, the correct way to
  detect a native `<dialog>` backdrop click.

## v1.3.0 (2026-08-15)

- Added **"Duplicate Project"** (📄 toolbar button, or canvas right-click):
  clones the whole diagram into a new, independent project (fresh ids
  throughout) and switches to editing the copy — the original stays
  exactly as it was. Added **"Duplicate entire canvas"** (canvas
  right-click): copies every component and connector in place, within the
  same project. New `core/project.js#duplicateProject()`.
- Added a **"🤖 AI Design Review"** side panel: prepares a review prompt
  and exports the diagram as an image (download or clipboard copy), then
  opens Claude/ChatGPT/Gemini/Copilot's own website in a new tab — no API
  key or configuration, since it uses the account you're already signed
  into there. Optionally attach a plain-text/Markdown spec file to fold
  into the prompt for a diagram-vs-spec comparison. There's no automatic
  round trip (every mainstream LLM requires an API key for programmatic
  access, and scraping Google's embedded AI search results is neither
  feasible from a static page nor allowed) — paste the AI's reply into the
  panel to keep it alongside your project for the session. New
  `js/io/aiReview.js` + `js/panel/aiReviewPanel.js`.
