# Changelog

All notable changes to this project. Format: date, then bullet list.
Keep this in sync with `PLAN.md` as stages complete.

## v1.51.0 (2026-09-01)

- **3D Presentation Mode's control bar is now repositionable and has a compact
  mode** (`js/io/uiPrefs.js`, `js/canvas/scene3dOverlay.js`, `css/toolbar.css`)
  — two new persisted preferences, `scene3dBarPosition` (`'bottom'` default,
  `'top'`/`'left'`/`'right'`) and `scene3dBarCompact` (`false` default), set
  from a new "⚙️ Layout" button/panel alongside "🎬 Camera Tour":
  - The bar (main controls + both floating panels) is a single flex container
    now rather than several independently-`position: fixed` elements each
    guessing a sibling's size; `data-position` on that container drives which
    edge it's anchored to and CSS `order` on its children (not
    `flex-direction: row-reverse`/`column-reverse`, to keep the four positions'
    rules symmetric and easy to reason about) keeps the always-visible controls
    row nearest the anchored edge and either open panel expanding toward the
    screen's center, at all four positions.
  - Docking left/right switches the controls row itself from wrapped
    horizontal rows to a single scrollable vertical column (`overflow-y: auto`
    with a `max-height`), so it hugs the side of the screen instead of eating
    half its width, and never becomes unreachable at a short viewport height —
    the exact "tall Tools dropdown" class of bug this repo has hit before.
  - Deliberately **not** flipped for `[dir="rtl"]`: docking "left"/"right" is a
    literal "which physical side of my screen" choice independent of the
    app's own Hebrew/RTL text-direction setting, unlike this file's other
    position:fixed elements that intentionally do flip with reading direction.
  - Compact mode hides each control button's text-label `<span>` via CSS
    (`makeSceneBtn` in `scene3dOverlay.js` now builds every main-row button
    with a separate icon/label span pair) while every button keeps a real
    `title` and `aria-label` — added/improved on `▶️ Play Animation` and
    `✕ Close 3D View`, which had no tooltip at all before this batch — so a
    screen reader or a hover still gets a full description in either mode.
  - Both preferences persist via `localStorage` (`io/uiPrefs.js`, same
    mechanism as the contextual style row's floating/pinned modes) across
    closing/reopening the 3D view and across a full page reload.
  - Added `tests/unit/uiPrefs.test.mjs` coverage for the new fields' defaults/
    validation, and e2e coverage in `tests/e2e/scene3d.spec.js` for tooltip
    presence, position persistence, compact-mode label hiding, and no
    horizontal overflow at all four positions at desktop, tablet-narrow, and
    mobile widths.

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

## v1.50.0 (2026-08-31)

- **3D Presentation Mode visual/usability overhaul** (`js/render3d/scene3dRenderer.js`,
  `js/canvas/scene3dOverlay.js`) — the existing feature looked rough and was hard to read; fixed
  the concrete problems found by actually rendering it, rather than guessing:
  - **Camera auto-fit was broken**: it only tracked node *center points*, not their actual
    width/height/depth, so a normal-sized cluster of boxes routinely computed a camera distance
    tight enough that the boxes themselves overflowed the viewport (cropped tops/bottoms, labels
    running off-screen). Now computes the real 3D bounding box (including height) and fits the
    camera to it against whichever of the vertical/horizontal FOV is more restrictive — verified
    at desktop, tablet, and mobile widths.
  - **No ground plane or grid** — boxes floated as flat cutouts in a black void with no sense of
    scale or orientation. Added a raised-floor tile texture sized to the diagram, plus real cast
    shadows (a shadow-casting key light, `renderer.shadowMap` enabled) so boxes read as grounded
    objects.
  - **Flat, near-black lighting** — a single directional light left every face not directly facing
    it nearly black. Added a hemisphere light (soft sky/floor split) and a dim fill light from the
    opposite side so every face stays legible. Fog now scales with the diagram's own size instead
    of a fixed range, so it fades the empty void at the horizon without ever washing out the
    diagram itself on a larger canvas.
  - **Labels silently truncated** past ~20 characters (e.g. "Elastic Load Balancer" rendered as
    "lastic Load Balance") because the label's canvas texture had a fixed 256px width. Now sized to
    the actual measured text.
  - **"Chip" decals looked like rendering glitches** — a wide flat box on a box's top face
    foreshortens under an oblique camera into a slanted parallelogram. Replaced with small glowing
    sphere "status light" decals that read clearly as an intentional detail.
  - New **"🎯 Reset View" button** in the 3D controls bar — recenters and re-fits the camera,
    since the custom orbit camera has no pan and a user can spin/zoom somewhere disorienting with
    no other way back.
- **3D scene visual concept reworked to look like real infrastructure**, not a field of identical
  boxes (`js/core/scene3dLayout.js#getVisualKind`, `js/render3d/scene3dRenderer.js`) — since this
  app has no photographic/illustrated asset pipeline, "real-looking" is built the same way the
  existing label sprites already are: drawn onto a `<canvas>` and used as a texture, cached per
  (kind, color) pair for the life of the mounted scene so a diagram with many same-colored
  components doesn't regenerate/re-upload identical textures on every edit.
  - Each 2D shape now gets its own 3D silhouette instead of one generic box: `cylinder`
    (databases/caches) renders as a **stacked-disk storage drum** (a canvas-drawn ring texture that
    wraps naturally around `CylinderGeometry`'s side), `diamond` as a **gem-like octahedron**,
    `circle` as a **sphere**, `hexagon` as a **hex prism**, and a sequence-diagram `lifeline` as a
    plain, undecorated pillar (it's an abstract presence marker, not real hardware). Every other
    shape (the majority of components, plus UML's `cuboid` "device" stereotype) keeps a box, now
    textured to look like a **server-chassis front panel** — rack-unit seams, a brushed-metal
    gradient, and a couple of small status LEDs baked into the surface.
  - Connectors render as **segmented, capped cables** instead of a flat-shaded pipe — a repeating
    cable-pattern texture tiled along the tube's length, plus small dark "connector plug" spheres
    at both ends, so a run reads as something actually plugged in rather than an abstract line.
  - Added `tests/unit/scene3dLayout.test.mjs` coverage for the new `getVisualKind` mapping.
- **New "🏢 Realistic Room" toggle** (`js/render3d/scene3dRenderer.js`, `js/canvas/scene3dOverlay.js`)
  — a second, more true-to-life look for the 3D scene, switched on/off without leaving the view:
  - Wraps the scene in an enclosing cylindrical room — textured wall panels (perforated vents, a
    cable-conduit trim strip), a lit ceiling (recessed light-panel texture), and the floor extended
    to meet the walls seamlessly. Two soft point lights stand in for ceiling fixtures, since the
    directional key light alone reads as outdoor sunlight and breaks the "indoors" illusion.
  - Every component gets a more detailed surface in this mode: `'rack'`-kind boxes (the majority of
    components) show individual recessed drive bays with vent slits and a handle per rack unit, plus
    a small backlit vendor label plate, instead of plain seam lines; `'storage'` drums (databases/
    caches) get a brushed-metal highlight and a circular "activity window" instead of a flat LED
    stripe.
  - **Technical note**: the custom orbit camera sits at a fixed spherical distance from the target
    regardless of view angle, so the only way to guarantee it never clips through an enclosing wall
    from *some* rotation is a wall shaped as a cylinder (constant radius at every angle) with the
    wheel-zoom's own maximum distance capped safely inside that radius — capping only the initial
    auto-fit distance isn't enough, since the user can still scroll further out. Room size scales
    with the diagram's own bounding sphere so it always reads as "a big room the diagram sits
    inside," not a tight-fitting box.
- **New "🎬 Camera Tour"** (`js/core/cameraTour.js`, `js/render3d/scene3dRenderer.js`,
  `js/canvas/scene3dOverlay.js`) — a sequence of camera "shots" (position/angle/zoom + a label),
  available in both the default 3D view and Realistic Room, buildable manually or automatically:
  - **Manual**: "📍 Add Current View" captures wherever the camera is right now as the next shot;
    each shot in the panel's list can be previewed (click its label), reordered (↑/↓), or removed.
  - **Automatic**: "✨ Auto-Generate" builds one shot per component (a pleasant angled offset, never
    dead-on) plus a closing "Overview" shot using the scene's own default framing — snapshotted
    fresh on every rebuild (`defaultTarget`/`defaultRadius` in `scene3dRenderer.js`) so it stays
    correct regardless of what the user has since done to the live camera.
  - **Playback**: "▶️ Play Tour" holds on each shot (2.2s) then eases into the next (1.6s,
    shortest-path angle interpolation via `core/cameraTour.js#lerpAngle` so a transition never spins
    the "long way around"); an optional "Loop" checkbox tours indefinitely instead of stopping after
    one pass. Manually dragging or scrolling the camera at any point immediately hands control back
    to the user — the tour doesn't fight an in-progress user gesture.
  - **Export**: "🎥 Export 3D Video" now drives its recording from a configured tour (one full
    non-looping pass) instead of a slow ambient auto-rotate when no tour exists, running concurrently
    with any Diagram Animation reveal if one is also configured — and this explicitly now works
    (verified via e2e test) with Realistic Room active too, closing the original request to make sure
    that mode's own export path wasn't missed. New "📊 Export 3D Presentation" button exports a real
    `.pptx`: one dark-themed slide per tour shot (or per Diagram Animation step, if no tour is set),
    each slide's image captured via a new `captureStillFrame()` controller method — a synchronous
    `renderer.render()` + `canvasEl.toDataURL()` pair, since the renderer has no
    `preserveDrawingBuffer` and an `await`-separated read risks a blank frame otherwise.
  - Added `tests/unit/cameraTour.test.mjs` (angle interpolation, easing, auto-shot generation) and
    e2e coverage in `tests/e2e/scene3d.spec.js` for the panel, drag-to-interrupt, and both new export
    buttons.

## v1.49.3 (2026-08-31)

- **Extended the previous release's description-quality bar to every remaining "out of the box"
  pattern/template category**, not just Sequence Diagram Templates:
  - `js/data/categories/design-patterns.js` — all 26 entries rewritten (API Gateway, CQRS,
    Read Replica, Saga, Sidecar, Strangler Fig, MVC/MVVM, Repository, Service Discovery, the two
    ER schemas, etc.), each now explaining the actual design trade-off (e.g. Active-Active's
    write-conflict problem vs. Active-Passive's failover latency, why CQRS splits read/write
    models, why a shard router exists) instead of a one-line restatement of the boxes and arrows.
  - `js/data/categories/state-machines.js` — the 6 pattern templates (Circuit Breaker, Order
    Lifecycle, Payment Processing, TCP, Job Processing, Auth Session) now explain why specific
    states/transitions exist the way they do (e.g. why Half-Open is a distinct third state, why
    Authorize/Capture are separate payment steps).
  - `js/data/categories/reference-architectures.js` — all 5 "Design X" blueprints (URL Shortener,
    Chat App, Rate Limiter, Social Feed, Ride-Sharing Dispatch) now explain the specific
    architectural decisions behind each (e.g. why the ID generator is its own service, why
    fan-out-on-write trades an expensive write for a cheap read).
  - `js/data/categories/bpmn.js` — the Approval Process description now correctly explains the
    Exclusive Gateway's semantics instead of a prior version that inaccurately claimed a "revision
    loop-back" the pattern's edges never actually implemented.

## v1.49.2 (2026-08-31)

- **Rewrote all 37 "Sequence Diagram Templates" descriptions** (Login Flow through Step-Up
  Authentication, including PKCE, OAuth, Circuit Breaker, Two-Phase Commit, Outbox, DNS
  Resolution, etc.) — the previous one-liners just restated what the diagram already showed
  visually (e.g. PKCE's was "OAuth 2.0 Authorization Code flow with PKCE — the standard for
  SPAs..."). Each description is now 2-3 sentences explaining the actual reasoning: *why* the flow
  is built this way, what real problem or attack it addresses, and non-obvious consequences or
  trade-offs (e.g. PKCE's now explains *why* a public client can't safely hold a secret, what
  attack that gap enables, and how the code_verifier/code_challenge split closes it). This directly
  improves "📖 Explain This Diagram" (right-click a template → Explain), since that feature's
  headline summary paragraph is exactly this same `description` field — it was previously the
  weakest, least useful part of an otherwise comprehensive explanation.

## v1.49.1 (2026-08-31)

- **Curated the "Design Patterns" category down from 32 to 26 entries**, favoring fewer, more
  complex, realistic diagrams over many small textbook examples. Removed as too minimal/generic:
  MVP, the classic GoF patterns Singleton, Factory Method, Observer, Strategy, Adapter, and
  Decorator, the standalone Circuit Breaker and Rate Limiting Gateway patterns (superseded by the
  new combined Resilience Stack below), and the two smallest ER examples (One-to-Many,
  Many-to-Many with Join Table). Added five new higher-value scenarios: **Change Data Capture
  (CDC) Pipeline** (a connector tailing a database's WAL, fanning change events out through Kafka
  to a search index and a cache invalidator), **Database Sharding** (a shard router splitting
  traffic across three shards by key range), **Resilience Stack** (Rate Limiter + Circuit Breaker
  chained in front of a downstream service, with a fallback cache for when it's open),
  **Leader Election** (peer nodes racing for a lease on a coordination service, only the elected
  leader writing to the shared database), and a realistic multi-entity **ER: E-Commerce Order
  Schema** (Customer → Order → Order Item ← Product, plus Payment) replacing the two removed toy
  ER examples.
- **Curated the "State Machines" category**: removed Traffic Light and Media Player (too generic
  to be interesting) and Approval Workflow (redundant with the BPMN category's existing "Simple
  Approval Process" template, which already covers the same submit/review/approve-or-reject flow
  in proper BPMN notation). Enriched Order Lifecycle with a post-delivery return/refund path and
  a payment-failure branch, and Auth Session with MFA, silent token refresh, and a failed-attempt
  lockout state. Added three new pattern templates: **Circuit Breaker** (Closed/Open/Half-Open,
  the resilience pattern's own state machine), **Background Job Processing** (queued → running →
  retry-with-backoff → dead-letter), and **Payment Processing** (authorize → capture, with a
  decline path and a post-capture chargeback/dispute state).
- Repointed the "🎓 Demo Projects" ER Diagram and State Machine demos at the new E-Commerce Order
  Schema and Order Lifecycle patterns respectively, since their previous sources (One-to-Many and
  Traffic Light) no longer exist.
- Fixed a pre-existing bug surfaced by this batch's UI/UX review: a state machine's Final State
  circle (`sm-final`) is only 48px wide, so any label longer than ~6 characters clipped into an
  unreadable single-character-per-line column ("Cancelled" rendered as "Ca / nce", "Refunded" as
  "Ref / und") — already present in the shipped Order Lifecycle pattern before this batch, and
  made more visible by this batch's own new longer final-state labels ("Dead-Lettered",
  "Succeeded", "Declined"). Fixed by rendering the label outside the circle
  (`textPosition: 'below'`) with a width that can grow past the node's own bounds
  (`css/node.css`'s new `.node[data-shape="circle"] .node-external-label` rule) instead of being
  clipped to it.

## v1.49.0 (2026-08-31)

- **Fix Text Display** — new "🔤 Fix Text Display" (Tools → Layout Tools, or ⌘K) re-spaces
  overlapping labeled content in one undoable step: for a sequence diagram, every message's
  height along its lifeline(s) based on how tall its own wrapped label actually renders
  (`core/sequenceDiagram.js#spaceMessagesForLabels`, proportional to label height rather than
  forcing an equal gap the way "Distribute Evenly" does); for any other diagram, nudges the two
  ends of a labeled connector apart just far enough for the label's wrapped width to clear both
  nodes (`core/labelSpacing.js#spreadNodesForLabels`). Passively, every edge label now also wraps
  onto multiple `<tspan>` lines instead of overflowing or rendering hidden behind other content
  (`core/labelWrap.js`, `canvas/connector.js`) — this alone fixes the out-of-the-box PKCE-style
  templates whose longer message labels used to sit unreadably cramped.
- **Show Descriptions toggle** — a new "📖 Show Descriptions" button at the end of the always-
  visible toolbar row (`toolbar.js`) shows every dropdown button's own tooltip text inline, right
  under its label, instead of only on hover (`io/uiPrefs.js#showActionDescriptions`,
  `toolbar/toolbarDropdown.js#updateButtonDescription` — appends/removes a
  `.toolbar-dropdown-btn-desc` span without touching a button's existing children, so a button
  with its own badge, like "🔍 Check Diagram", is unaffected). Off by default; the native tooltip
  is always still there either way.
- **Explain This Diagram** — right-click any component from an instantiated library
  pattern/template (or "Open details" → its details panel) and choose "📖 Explain This Diagram"
  for an instant, offline, comprehensive explanation of that specific template: a curated
  header description, every component's own curated description (`core/groupExplanation.js`), and
  a numbered step-by-step read of how it flows. Every pattern instantiation now carries
  `sourcePatternId`/`patternInstanceId` provenance (`canvas.js#instantiatePatternAtPoint`,
  `core/project.js#validateContent`) so this — and future per-template tooling — can trace a node
  back to the template it came from and find its siblings.
- **Diagram Animation: bulk actions** — the panel's "Add more" section gained a "+ Add All"
  button that adds every remaining component/connector as its own step in one click
  (`canvas.js#addAllToActiveAnimation`), and the step list gained "Set all steps to: ⏱️
  Auto-play / 🖱️ Click" to change every step's reveal mode at once
  (`canvas.js#setAllStepsRevealMode`) instead of one row's dropdown at a time.
- **Auto-Play Diagram** — new "🪄 Auto-Play Diagram" (Tools → Visual & Presentation, or ⌘K)
  builds a full walkthrough animation from every component/connector already on the canvas
  (reusing `core/animationAutoBuild.js#buildAutoWalkthroughAnimation`, the same logic already
  offered after AI-generation flows) and starts playing it immediately — no manual step-adding
  or per-step configuration required first, replacing whichever animation was already active.

## v1.48.0 (2026-08-30)

- **Tools dropdown search** — a "Search actions..." box at the top of the Tools menu
  live-filters its 24+ buttons by name/tooltip as you type (`toolbar/toolbarDropdown.js`'s
  new `filterDropdownPanel`, opt-in `searchable: true` — only the Tools dropdown uses
  it). A whole section (label included) disappears once nothing in it matches; clears
  and refocuses every time the menu reopens.
- **Collapsible Tools sections** — every labeled section in the Tools dropdown (AI
  Tools, Collaboration, Analysis & QA, Layout Tools, Visual & Presentation) now has a
  clickable ▾/▸ header that hides/shows its buttons, persisted per-section across
  reopening the menu and reloading the page (`io/uiPrefs.js#collapsedToolsSections`,
  `toolbar.js#buildGatedButtonList`). A search match inside a collapsed section still
  surfaces it, without touching the saved collapse choice. File and Create's own
  section headers are unchanged (Tools is the one dropdown long enough to need this).
- **Tooltip audit** — "🤖 AI Design Review" was the one Tools-dropdown button whose
  tooltip was just its own name with no explanation; it now reads like every other
  button's does.

## v1.47.0 (2026-08-30)

**Six small "ease the user" additions** — automatic/proactive assists plus a
few discoverability/editing conveniences:

- **Smart default edge labels** (`core/smartEdgeLabels.js`) — a freshly-drawn
  connector now guesses a sensible label from what its two ends actually are
  (category-pair table plus a few name-based rules for gateways/queues),
  e.g. "reads/writes" for a service into a database, "routes to" from a load
  balancer, "publishes to"/"delivers to" around a queue depending on
  direction. Never overrides a label you already set yourself.
- **Smart duplicate naming** (`core/duplicateNaming.js`) — duplicating a
  component now auto-increments its name ("Auth Service" → "Auth Service 2")
  the way a file manager suggests "copy 2", instead of leaving an
  identical-looking twin. `duplicateEntireCanvas` (a whole-canvas mirror, not
  the "avoid two same-named siblings" case this exists for) opts out.
- **"Fit to selection"** (`canvas.js#fitToSelection`) — the toolbar's "⛶" fit
  button now fits just the current selection once something is selected,
  falling back to fitting the whole diagram otherwise. Same button, no new
  toolbar clutter.
- **"🔎 Find & Replace"** (Tools menu, or Ctrl/Cmd+K) — renames a term across
  every component/connector label and notes field in one undoable step
  (`core/findReplace.js`), instead of clicking into each one by hand.
- **"📌 Manage Pinned Toolbar Actions"** (Ctrl/Cmd+K) — pin your most-used
  actions (the exact same list ⌘K already searches,
  `commandPaletteModal.js#buildAppCommands`) as always-visible toolbar
  buttons, in whatever order you like, via a new second toolbar row
  (`toolbar/pinnedActionsBar.js`) hidden until you pin something.
- **"🔔 Diagram Nudges"** (on by default, Tools menu) — a quiet toolbar badge
  the moment "🔍 Check Diagram" would find something new
  (`io/lintWatcher.js`), instead of only finding out once you remember to
  open it yourself. Deterministic and offline, same as Check Diagram itself
  — never makes a network call.

## v1.46.0 (2026-08-29)

**"🤖 AI Chat" is now resizable in every dock mode.** Drag its left edge while
docked to the side, its top edge while docked to the bottom, or its bottom-right
corner grip while floating — each dock mode has its own draggable handle
(`js/panel/aiChatPanel.js`), and the size you pick is persisted per mode
(`io/uiPrefs.js#aiChatWidth/aiChatBottomHeight/aiChatFloatingHeight`) so it
sticks across reopening the panel or reloading the page.

## v1.45.1 (2026-08-29)

**Fix: "Working with CLI" dialog was leading with the wrong action.** A bare web
address doesn't tell a CLI tool which file to fetch — there's no standard convention
that makes it check `/llms.txt` just because it was handed a domain, so presenting the
address as the dialog's first/primary step was misleading. The dialog's primary,
first action is now a ready-made prompt that already names the exact file
(`<address>llms.txt`); the bare address is still offered, but demoted to a clearly
labeled secondary fallback for someone building their own request.

## v1.45.0 (2026-08-29)

**Working with CLI** and **AI Chat** — two additions answering "how does a CLI tool
actually get connected to this app" from both directions:

- New "🖥️ Working with CLI" dialog (Help menu, or Command Palette) — shows the *live*,
  auto-detected base URL of the app instance actually running right now
  (`core/appUrl.js#computeAppBaseUrl`, working correctly for GitHub Pages, a custom
  domain, or a local dev server), a one-click "Copy" button, and a ready-to-paste
  prompt telling an AI CLI tool to fetch `<address>llms.txt`. This replaces guessing
  the app's own URL from its repo name with reading it straight off the page.
- New "🤖 AI Chat" panel (Tools menu, or Command Palette) — a fast, in-app live chat
  with whichever automatic AI mode is configured (Direct API mode or Local AI mode),
  no copy/paste. Shows a setup nudge instead until one is configured. Dock it to the
  right, pin it to the bottom, or drag it anywhere on screen as a floating card
  (`io/uiPrefs.js#aiChatDockMode`/`aiChatFloatingPos`) — the first panel in this app
  with more than one screen position.
- AI Chat deliberately shares the exact same transcript and prompt format as
  "🗨️ AI Conversation" (`io/aiConversationStore.js`, `core/aiConversation.js`) —
  both are the same ongoing conversation about the diagram, so switching between
  hand-off and live chat mid-conversation keeps every prior turn. A reply's proposed
  diagram change previews and applies inline, right under the message that proposed
  it, using the same patch format as Edit with AI.
- `io/aiAutoSend.js` extracts the "call whichever automatic mode is configured"
  dispatch (Local AI, or the first configured Direct API provider) out of
  `io/autoSuggest.js`, now shared by both.

## v1.44.0 (2026-08-29)

**AI Conversation** — an ongoing, reopenable back-and-forth about the current diagram
(Create menu, or Command Palette), building on v1.43.0's AI/CLI Integration guide: a
genuine multi-turn conversation with a stateless AI (a browser chat tab, or an AI CLI
tool invoked fresh each time) isn't possible without a server, so instead this feature
threads the whole prior transcript into every prompt it builds — the app itself repeats
the necessary context rather than the AI remembering anything on its own.

- New `core/aiConversation.js` (`buildConversationPrompt`, `extractConversationReply`,
  `createTurn` — pure, no DOM) and `io/aiConversationStore.js` (transcript persistence,
  a single browser-level setting like AI provider keys — excluded from JSON export,
  full backup, and duplicate-project, same as those).
- New "🗨️ AI Conversation" modal (`modals/aiConversationModal.js`) — unlike this app's
  other AI wizards, it never auto-closes: finishing a round returns to step 1 so the
  conversation can keep going, with the full transcript shown above the step UI every
  time the modal is (re)opened.
- A reply can propose a diagram update using the exact same PATCH JSON format as
  "💬 Edit with AI" — previewed and applied as one undoable step — or be pure prose
  with no diagram change at all.
- `io/aiEditDesign.js` now exports `buildPatchRules`, `EXAMPLE_PATCH_JSON`, and
  `summarizeCurrentProject` so this new feature reuses the exact same patch-format
  prompt fragment instead of duplicating it.
- Documented in `docs/AI_INTEGRATION.md`'s new "Continuing the Conversation" section,
  written for an external AI/CLI tool reading the protocol cold.

## v1.43.0 (2026-08-29)

**AI / CLI Integration** — this app has no backend, so instead of an API, this batch
publishes a document any AI agent or CLI tool (Claude Code, or any other) can read to
learn its own JSON format, plus two zero-server ways to hand a generated diagram back
to the user:

- New `docs/AI_INTEGRATION.md` — a standalone guide written to be read cold by an AI
  agent: the full project JSON schema (nodes/edges, the sequence-diagram alternate
  shape), a complete example, and both delivery methods below. Kept in sync by hand
  with `io/aiGenerateDesign.js`'s own in-app example JSON.
- New root-level `llms.txt` pointing at the guide, following the emerging convention
  several AI tools already check.
- **Delivery method A — a direct share link.** The guide documents `io/shareLink.js`'s
  exact gzip + base64url encoding with runnable Python/Node snippets, so a CLI tool
  with code execution can build a real, clickable `#share=...` link itself — no
  copy/paste of raw JSON at all.
- **Delivery method B — paste or file import.** `io/shareLink.js#findShareHashInText`
  is a new small pure text scanner that pulls a share hash out of arbitrary pasted
  text (bare, or embedded in a full URL). Both `modals/generateDesignModal.js`'s and
  `modals/quickStartModal.js`'s existing "paste the AI's result" steps check this
  before falling back to raw-JSON extraction, so the same paste box works for either
  delivery method a CLI tool managed to produce.
- New "🤖 AI / CLI Integration" entry point in the toolbar's Help menu and the
  Command Palette, both just opening the guide.

## v1.42.0 (2026-08-28)

**Six new component-styling options**, expanding the per-node style editor (`toolbar/styleEditor.js`)
without adding new modals or toolbar clutter — all fields live in the same contextual style card that
already opens when a component is selected:

- **✨ Style Presets** — four one-click buttons (⭐ Primary, 🗑️ Deprecated, 🌐 External, ✨ Highlighted)
  each apply a fixed bundle of fill/border/border-style/shadow/opacity in a single dispatch (one undo
  step), defined in a new pure `core/stylePresets.js` module. Deliberately not persisted as "which
  preset is this" on the node — same reasoning as `core/diagramTheme.js`'s palette recolor — so a
  preset's own definition can evolve later without silently reinterpreting every node that ever used it.
- **Corner Radius** — a numeric field, shown only for the `rect`/`rounded` shapes (the only two with a
  real, adjustable CSS `border-radius`); `null` means "use that shape's own default radius," so
  switching shapes never needs special reset logic.
- **Border style** — Solid/Dashed/Dotted, a plain CSS `border-style` value. Like `strokeWidth` before
  it, this is an honest no-op on diamond/hexagon/cylinder, which fake their outline with filled
  pseudo-elements and have no real border to dash.
- **Drop shadow** — a checkbox for a stronger `box-shadow`. Implemented via a `--node-extra-shadow`
  CSS custom property rather than setting `box-shadow` directly from JS — an inline `box-shadow` would
  have unconditionally beaten the `.node:hover`/`.node.selected` class rules that also draw a shadow
  there, silently hiding e.g. the selection ring on a selected node with drop shadow on. Every one of
  those rules now reads `var(--node-extra-shadow, <its own baseline>)` instead.
- **Opacity** — a 10-100% field, applied as an inline style on `.node-body` (not the outer `.node`),
  which is exactly what lets it compose independently of Focus Mode's dimming and Diagram Animation's
  reveal/hide, both of which toggle a class on the outer element instead.
- **Size presets** — S/M/L quick buttons next to Width/Height, a shortcut for typing the same two
  numbers rather than a new persisted field.

All four new node-schema fields (`cornerRadius`, `borderStyle`, `dropShadow`, `opacity`) get a
`createNode` default and a `validateProject` clamp/fallback branch, same as every other per-node field.

## v1.41.0 (2026-08-28)

**🧩 Feature Level (Basic/Advanced/Custom)** — this app has accumulated a very large number of
toolbar actions across many batches (77 buttons, 24 alone in the Tools dropdown), overwhelming for
someone who just wants to draw a basic diagram. A new setting (Create → Default Settings → 🧩
Feature Level, or the Command Palette) lets anyone choose Basic (hide everything but a small
always-visible core), Advanced (show everything — this app's original behavior), or Custom (pick
exactly which of 7 themed tool groups — AI Tools, Diagram Types, Collaboration, Analysis & QA,
Layout Tools, Visual & Presentation, Advanced Import/Export — show up). Nothing here ever touches a
diagram or removes a capability — every action stays reachable through ⌘/Ctrl+K Quick Actions
regardless, and gated buttons are hidden, not destroyed, so switching modes live never loses a
badge or a running timer.

**Grouped toolbar dropdowns** — the File/Create/Tools menus now organize their buttons under
labeled sections (the same 7 groups above) instead of one long flat list, independent of the
Basic/Advanced/Custom choice — even in Advanced mode, where everything shows, the Tools dropdown's
24 buttons are far easier to scan grouped than flat.

**Compact sidebar** — a new 🗂️ toggle above the component library (also in Default Settings) shows
only Favorites, Recently Used, and My Components by default, collapsing the full ~28-category
browser one click away. Search always still searches every category regardless of this setting.

**First-time-visitor defaults** — a brand-new visitor (nothing at all in this browser's storage
yet) now starts in Basic mode with a compact sidebar automatically, so their very first look at
this app isn't 77 buttons and 28 categories all at once. Anyone who already had this app open
before this update keeps their exact existing toolbar and sidebar, nothing hidden — this is a
one-time decision made once per browser, not a retroactive change for existing visitors.

**Progressive-unlock suggestion** — a Basic-mode visitor who's used the app for a few sessions (3,
8, then 15) gets a small, dismissible one-time nudge suggesting they explore the rest of this
app's tools, linking straight to the Feature Level setting. Each nudge shows at most once; "Don't
ask again" turns it off for good.

## v1.40.0 (2026-08-28)

**🎯 Blast Radius** — right-click any component → "Blast Radius..." shows what would be affected
if it failed, computed purely from the diagram's own connectors: what it feeds downstream, and
what calls into it. No AI, no new schema — a pure BFS over the existing edge list
(`core/blastRadius.js`), with each affected component clickable to jump to it and a
"Highlight all on canvas" button to select and frame the whole set at once.

**🎓 Interview Mode** — a new practice flow (Tools menu): pick a curated system-design interview
question (ten to start, Easy/Medium/Hard), work against an optional timer shown as a live toolbar
countdown, then submit the diagram for AI feedback using the exact same hand-off/direct/local send
flow every other AI feature here already uses — no separate grading pipeline, no fake automatic
score.

**🔗 Import from URL/Gist** — loads a diagram JSON hosted elsewhere (a GitHub raw file link, a
public Gist, or any URL returning this app's format), the counterpart to the existing encoded
share link for when the file already lives somewhere public. A Gist URL resolves through GitHub's
own public API; any fetch/parse/format failure shows a specific error without touching the canvas.

**🗺️ System Map** — a new visual graph (File menu) of every saved diagram and the links between
them, for a diagram best understood alongside a related one — a system diagram pointing at a
separate sequence diagram detailing one of its flows, or at a DB schema diagram. Any saved diagram
can link to any other with an optional label; clicking a diagram on the map opens it.

**🧩 Export PDF (Poster)** — splits a large diagram across several same-size printable pages (A4
or US Letter) to physically assemble into one big poster, complementing the existing single-page
PDF export (which always scales the whole diagram onto one sheet). Each page prints its own page
number and grid position to help reassemble them in order.

**📝 Review Status** — a new shared draft/in-review/approved label (Tools menu) for team
workflows, with an optional name and a timestamp recorded on every change, shown as a colored
toolbar badge. Explicitly a lightweight note, not an access-control system — this app has no
accounts to enforce one.

## v1.39.0 (2026-08-28)

**🎓 Demo Projects** — a new "🎓 Demo Projects" picker (Create menu) loads a ready-made example
diagram for each diagram kind this app supports: a plain layered system diagram, a highly-available
replicated deployment, a sequence diagram, a BPMN process, a UML deployment diagram, an ER diagram,
a state machine, and a C4 Context diagram — plus a "Combo" demo showing a regular system diagram
and a sequence diagram coexisting on the same canvas, to make the point that these aren't
mutually exclusive. Loading a demo asks for confirmation first if the canvas isn't already empty
(same as Generate Design/AI Quick Start); "🧹 Clear Canvas" sits in the same modal for convenience.
Built with `js/core/demoProjects.js` — a pure module reusing the exact same pattern/lifeline
construction logic the interactive paths already use, so a demo can't drift out of sync with what
those mechanisms actually produce.

**In-app guide screenshots** — `help.html` now embeds real screenshots for several visually
distinctive screens (the canvas, connectors/connection points, a sequence diagram, 3D Presentation
Mode, the AI Design Review panel, Demo Projects, and the Command Palette) alongside the existing
prose, since some things are genuinely clearer shown than described.

**3D Presentation Mode: lifeline shape fix** — a sequence-diagram lifeline rendered in the 3D view
as a giant, wildly disproportionate slab (its 2D height, a time axis rather than a spatial
footprint, was being mapped straight into the 3D box's depth). It now renders as a tall pillar
instead, sized comparably to every other component in the scene — found and fixed by rendering one
instance of every 2D shape side by side in the 3D view and comparing them.

**Command Palette completeness audit** — the Command Palette (Ctrl/Cmd+K) is meant to be a
complete index of every toolbar action, but had drifted behind more than a dozen real features
across several batches. AI Quick Start, Import from Image, Edit with AI, C4 Context Diagram,
Import from SQL, Template Gallery, Demo Projects, Collaborate, Comments, Outline, AI Beautify
Layout, Describe Diagram, Presenter Mode, Diagram Animation, Flow Simulation, 3D Presentation,
the Language toggle, and What's New are all now searchable from the palette. Keyboard shortcuts
were reviewed too — no gaps found; every existing shortcut is still reserved for a continuously-
repeated action, with everything else discoverable through the (now complete) palette.

## v1.38.0 (2026-08-27)

**🧊 3D Presentation Mode** — the headline feature of this batch: a one-click "🧊 3D Presentation"
button (Tools menu) converts the current diagram into a rotatable 3D scene for presenting.
Components become extruded, colored boxes (`core/scene3dLayout.js` maps 2D canvas coordinates to
3D space; box color uses each component's stroke color, not its pastel fill, so it reads as vivid
under lighting); connectors become animated "cable" tubes color-coded by flow direction — one
direction blue, the opposite red, purely a function of geometry so two opposite edges between the
same pair of components always render one of each color regardless of draw order. Playing the
diagram's existing Diagram Animation inside the 3D view shows ambient "thinking" particle swarms
and pulsing chip decals inside each component. A hand-rolled orbit camera (drag to rotate, wheel to
zoom, a slow ambient auto-rotate when idle) makes it read like a real presentation shot. A
"🎥 Export 3D Video" button records the whole thing to a downloadable video file, driving the
Diagram Animation in real time frame-by-frame if one exists, or a fixed ambient orbiting shot
otherwise. Built on a newly-vendored Three.js (`vendor/three.module.min.js`, MIT) — the only
non-UMD, genuine-ES-module third-party library in this app so far.

**🪄 AI Beautify Layout** — Tools menu → asks an AI to suggest a nicer arrangement of the existing
diagram's components, using its own judgement rather than a fixed auto-layout algorithm; only
node positions change, nothing is added, removed, or restyled.

**🎙️ Voice dictation** — AI Quick Start, Generate Design from Spec, and Edit with AI's text fields
now show a mic button wherever the browser's Web Speech API is supported, appending dictated text
instead of requiring typing.

**💬 AI-narrated diff & cost explanations** — "Explain this diff with AI" in Compare Versions and
"Ask AI to reduce this cost" in Cost Breakdown both open a new shared single-step ask/answer modal
(hand-off/direct/local send, same as every other AI feature here).

**New component categories** — BPMN (Business Process) with 9 event/task/gateway/pool shapes and
an approval-process template, and UML Deployment (Device/Execution Environment/Artifact — the
first two render as a pseudo-3D "cuboid" box, the classic UML look). Networking rounded out with
Switch, IDS/IPS, Network ACL, and Bastion Host.

**⌨️ Keyboard-only component connect** — Tab to a component to select it (previously impossible
with the keyboard alone), then press C and a number to draw a connector to a nearby component, no
mouse required.

**📃 Describe Diagram** — Tools menu → an instant, fully offline plain-text summary of the
diagram's structure (components by category, connections, isolated components) — no AI involved.

**Diagram Health Score** — 🔍 Check Diagram now shows a 0-100 score derived from how many lint
findings turned up, alongside the existing findings list.

**🌿 Version branching** — any saved Diagram Version can now "Branch from here" or "Merge into..."
another named branch — an explicit "copy this content onto that branch" operation, not an
automatic structural merge, in keeping with this app's honesty about what its AI/versioning
features actually do under the hood.

## v1.37.0 (2026-08-27)

**🪄 AI Quick Start** — a guided on-ramp for someone new to the app, reachable any time from
Create → AI Quick Start. Step 1 (skippable, shown only when no automatic AI mode is configured)
nudges toward setting one up with a direct link into Settings; step 2 asks for a plain-language
description of the system; step 3 sends `io/aiGenerateDesign.js#buildQuickStartPrompt` off (hand-off
or automatic, like every other AI flow here) and loads the resulting diagram. Unlike Generate Design
from Spec, the wizard doesn't close on success — a final step shows the AI's own rationale (an
overview sentence plus a one-line "why" per component, matched back to the created nodes by id)
before the user is dropped into the now-editable diagram.

**🤝 Live Collaboration** — real-time two-person co-editing over WebRTC, with no account and no
server of this app's own. `collab/webrtcCollab.js` implements a fully offline manual method (raw
`RTCPeerConnection`/`RTCDataChannel`, non-trickle ICE, the offer/answer exchanged as two short
copy-pasteable codes); `collab/peerjsCollab.js` implements a quick-room-code alternative via the
newly-vendored PeerJS's free public broker, for when copying two blobs of text is more friction than
wanted — the diagram itself still flows peer-to-peer either way. `collab/collabSession.js` syncs a
connected transport with the canvas: whole-project-state broadcast (debounced), last-write-wins,
applied via a coalesced `store.dispatch` (not `loadProject`) so incoming updates don't spam the local
undo/redo history or reset selection. A green toolbar badge shows a session is connected even after
the setup modal is closed. STUN-only (no TURN) is a known limitation for restrictive NATs.

**🖼️ Import from Image** — reconstructs a diagram from a screenshot, exported image, or hand-drawn
sketch. Same schema-anchored prompt-and-paste mechanism as Generate Design from Spec, with a new
`buildImportFromImagePrompt` sharing its component-graph rules, asking the AI to read every visible
label verbatim rather than paraphrase.

**🛡️ AI Design Review: Security mode** — a fourth mode alongside Review/Explain/Suggestions, focused
on public exposure, missing encryption, weak auth boundaries, exposed secrets, and missing audit
logging — grouped by severity (🔴/🟠/🟡) rather than free-form prose. Available even in hand-off-only
setups (unlike Suggestions, whose entire point is skipping the copy/paste round trip).

**🔁 Auto-suggest** — Settings → AI Providers gained a background trigger for the existing
"💡 Suggestions" mode: after a configurable number of distinct diagram edits pile up (not a timer —
someone idle for an hour shouldn't get an unprompted API call, but someone who just edited a handful
of components probably wants the check), it runs unattended and surfaces a badge on the AI Design
Review toolbar button. Off by default since it's a trigger that can incur real cost in Direct API mode.

**IaC exports** — Export Diagram gained Pulumi (TypeScript), CloudFormation (YAML), and Kubernetes
manifest targets alongside the existing Terraform export, all following the same curation philosophy:
a mapped AWS component becomes a real resource, an unmapped one is listed rather than guessed at.

**Diagram Animation: auto-build + PPTX/video export** — after any AI-generation flow creates a
diagram with 2+ components, a small prompt offers to auto-build a "walkthrough" animation revealing
every node then every edge in the order they were generated (`core/animationAutoBuild.js`), with a
configurable auto-advance delay or click-to-advance chosen right there. The Diagram Animation panel
can now also export the active animation to a real `.pptx` (`io/exportAnimationPptx.js` — one slide
per step, cumulatively revealing the diagram; PowerPoint's own auto-advance timing isn't exposed by
the vendored PptxGenJS, so each slide's speaker notes carry the intended timing instead) or to a real
video file (`io/exportAnimationVideo.js` — native `MediaRecorder` + `canvas.captureStream()`, playing
back in real time; a "click" step gets a fixed 2s dwell since there's no presenter to click for it).

## v1.36.0 (2026-08-27)

**💡 AI-Powered Suggestions** — a third mode in AI Design Review, alongside Review and Explain,
offered once Direct API mode or Local AI mode is actually usable (this mode's whole point is
skipping the copy/paste round trip, so it isn't offered in Copy/Paste-only setups). Sends the
current diagram (and any attached spec) and asks for a short, specific list of suggestions —
missing or complementary **components** (by name, e.g. "Redis Cache"), **pricing** considerations,
and other **improvements** — rendered as grouped cards rather than a block of prose to read. A
suggested component that matches something already in this app's own library gets a one-click
"+ Add" button that drops it onto the canvas immediately. If the AI's reply isn't valid JSON, the
raw response is shown with a "💡 Parse suggestions" retry button instead of being silently lost.

## v1.35.0 (2026-08-27)

**🧩 Local AI mode** — a third AI sending mode alongside Copy/Paste and Direct API, added after
researching (and explicitly declining to build) username/password or SSO login as a way to avoid
storing an API key at all: no legitimate version of that exists for any of the three remote
providers. What genuinely does exist is running a small open model — Llama 3.2 3B, Qwen2.5 1.5B,
or Qwen2.5 3B — entirely inside the browser via WebGPU, using the vendored `@mlc-ai/web-llm`
engine (Apache-2.0). No key, no account, no server, and nothing about the prompt or diagram leaves
the device. The model (1.5-2.5 GB) downloads once on first use from Hugging Face and is cached by
the browser after that — the one feature in this otherwise fully offline-capable app that needs a
connection the first time it's used. Settings → "🤖 AI Providers" gained a model picker and a
"⬇️ Preload model" button; a browser without WebGPU sees a clear warning instead of a confusing
failure. A "🧩 Send to Local AI" button appears additively next to every hand-off button across all
three AI-assisted flows whenever this mode is active, exactly like the existing Direct API button —
the hand-off option is never replaced, so a failed local generation always has a working fallback
one click away.

## v1.34.0 (2026-08-27)

**⚡ Direct API mode for AI providers** — every AI-assisted feature (AI Design Review, Generate
Design from Spec, Edit with AI) still defaults to the existing copy/paste hand-off flow, but
Settings → "🤖 AI Providers" now offers an opt-in alternative: save an API key for Claude
(Anthropic) or Gemini (Google) — both verified to genuinely support a direct browser-to-API call —
plus ChatGPT (OpenAI, included though its CORS support couldn't be confirmed) and any other
OpenAI-compatible endpoint via "+ Add custom provider…". A "⚡ Send directly" button appears
alongside (never instead of) the existing hand-off button wherever a provider is configured, so a
failed direct call (bad key, rate limit, CORS) always has a working fallback one click away.

Keys are stored in their own `localStorage` entry (`io/aiProviderKeys.js`), never included in
project JSON or full-backup export — an app/browser setting, not project data. A visible warning
explains the tradeoff (an unencrypted browser setting is the most secure option a 100% static app
has for a user-supplied secret, but it's still readable by anyone with access to the browser
profile). Switching the sending mode back to Copy/Paste wipes every saved key automatically, and a
separate "🗑️ Clear API Keys" button clears everything on demand without switching modes.

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

## v1.24.0 (2026-08-25)

A third sequence-diagram batch: 10 more ready-made templates spanning auth, resilience,
messaging, and caching, plus a matching wave of Smart Suggestions pairings.

**10 new templates**: Password Reset Flow, Passwordless Magic Link Login, WebAuthn/Passkey
Authentication, OAuth Client Credentials (M2M), WebSocket Handshake & Messaging, Webhook Delivery
with Retry, Circuit Breaker Pattern, Cache-Aside Pattern, Saga Pattern (Choreography), and
Idempotent Request Handling — 23 templates total in the "Sequence Diagram Templates" category.

**New component**: "WebSocket Server" (Networking) — a real-time full-duplex connection, missing
from the library until now.

**Expanded Smart Suggestions**: Redis Cache, WebSocket Server, Email Service, Webhook, Payment
Gateway, Circuit Breaker, and Saga Coordinator now suggest a relevant new template; OAuth/OIDC,
SSO, Identity Provider, and API Key each gained one more curated pairing alongside their existing
ones.

## v1.33.0 (2026-08-26)

A 12-feature batch spanning storage, search, comments, diagram lint, replication visualization,
onboarding, templates, offline support, SQL import, and a new C4 Model notation.

**Configurable storage backend** — `io/storage.js` now supports IndexedDB as an alternate backend
to the default `localStorage`, behind a synchronous read/write facade: an in-memory cache is
populated once at boot (`initStorageBackend()`) so every existing synchronous call site keeps
working unmodified. "🗄️ Backup & Restore" (renamed "Backup & Storage" internally) gained a
backend picker and a "Switch & copy data…" action (`switchStorageBackend()`) that always copies
every entry from the current backend into the new one — nothing is ever deleted from the source,
so switching is fully reversible.

**🔺 Export SVG** (`io/exportSvg.js`) — a vector export alongside PNG/PDF. Every CSS custom
property used by the exported subtree is resolved to its live concrete value and inlined into a
flat `:root {...}` block, since a saved `.svg` file becomes its own document when reopened (where
the original page's selector-based theme rules no longer apply).

**🔎 Search All Projects** (`io/globalProjectSearch.js` + `modals/globalSearchModal.js`) — searches
node/edge text and comments across every saved project in this browser at once, with a snippet
per match and a one-click "Load".

**Comments upgrades** — a `toolbar-count-badge` on the new "💬 Comments" button tracks unresolved
count; `modals/commentsListModal.js` lists every comment (unresolved-first) with a jump-to-it
"Open" button; and `core/mentions.js#splitMentions` renders an `@handle` in a reply as a
highlighted `.mention-chip` (built as real DOM text nodes, no `innerHTML`).

**🔧 Lint auto-fix** — `core/diagramLint.js` findings can now carry a `fix` descriptor;
`canvas.js#applyLintAutoFix` handles `insert-service-layer` (client→db findings) and
`add-load-balancer` (unrouted-replicas findings) as one dispatched action each.

**Replication sync direction** — Live Replication pairs have no real edge to animate, so
`canvas.js#renderReplicationSyncPaths` synthesizes a bidirectional dashed path + traveling dot
(SMIL `animateMotion` with `keyPoints="0;1;0"`) as a child of the existing `.edge-layer`, riding
its pre-existing Flow Simulation pause/resume and visibility toggle for free.

**🚀 Getting Started checklist** (`hints/onboardingChecklistWidget.js`) — a small dismissible
card tracking a few first steps, reopenable from the Help menu at any time.

**🖼️ Template Gallery** (`modals/templateGalleryModal.js`) — a visual browser for Reference
Architectures and Design Patterns, each rendered as a small SVG preview thumbnail
(`core/patternThumbnailLayout.js`, a DOM-free geometry helper).

**Offline support (PWA)** — `manifest.json` + `sw.js` (a stale-while-revalidate service worker,
appropriate for a no-build-step app with no generated asset manifest) let the app keep working,
including autosave, without a connection once loaded once.

**📥 Import from SQL** (`io/sqlDdlImport.js` + `modals/importSqlModal.js`) — a regex-based
`CREATE TABLE` parser (with paren-depth-aware splitting so `DECIMAL(10,2)` and multi-column
`FOREIGN KEY (a, b)` clauses parse correctly) turns pasted DDL into a real ER diagram: one
"entity" node per table (the same `rows`-shape convention this library's own ER templates use)
and a labeled edge per foreign key.

**C4 Model** — a new component category (`data/categories/c4-model.js`: Person, Software System,
External Software System, Container, External Container, Component) using the standard C4 color
notation, plus a "🧩 C4 Context Diagram" wizard (`core/c4Context.js` + `modals/c4ContextModal.js`)
that lays out a central system with a row of people above and external systems below, each
connected to the center. Only a Context-diagram wizard exists — Container/Component diagrams are
built the same way as any other diagram, by dragging the matching shapes and connecting them; no
enforced multi-level drill-down state was added.

## v1.32.0 (2026-08-26)

Five independent additions: an ambient traffic visualization, a conversational way to edit an
existing diagram with AI help, team-authored structural lint rules, threaded pinned comments, and
a Hebrew/RTL localization of the core UI chrome.

**💫 Flow Simulation** — a new Tools-menu toggle animates a small dot continuously flowing along
every connector in its direction (an SVG `<animateMotion>` riding each edge's own path), so a
glance at the diagram shows which way data actually moves. Off by default; paused at the
`.edge-layer` level when disabled, so it costs nothing regardless of diagram size.

**💬 Edit with AI** — the incremental sibling of "Generate Design from Spec": describe a change in
plain language, get a prompt (embedding a trimmed JSON projection of the current diagram) to paste
into your own AI chat, then paste the reply back. The app parses it as a small JSON patch
(`addNodes`/`addEdges`/`updateNodes`/`updateEdges`/`removeNodeIds`/`removeEdgeIds`), shows a
human-readable preview of exactly what will change (with warnings for anything referencing an
unknown id), and applies it as one atomic, undoable dispatch — the rest of the diagram's hand-placed
layout is untouched. Same "prepare & hand off, no API key" mechanism as every other AI feature here.

**🔍 Custom Lint Rules** — "Check Diagram" gained an "⚙️ Manage Custom Rules" builder for
team-specific structural policy: require a connection between two component categories, forbid a
direct connection between two categories, or cap how many of a category can appear. Rules are
parameterized (pick a type + category/categories, no free-form code), persisted in localStorage,
individually enabled/disabled, and evaluated alongside the built-in checks every time.

**Threaded comments** — pinned comments (Figma-style canvas annotations) now support replies: add
and remove them under a note's own text, independent of the resolved/unresolved state. Replies
round-trip through full-project JSON export/import, full backups, and duplicate-project (with
fresh ids on copy, same as the parent comment).

**🌐 Hebrew/RTL localization** — a new Language toggle (Tools menu) switches the toolbar group
labels, undo/redo/select/hand-tool labels, sidebar search, and the shared "Cancel" button (used by
every confirm/dismiss dialog) to Hebrew, and sets `dir="rtl"` on `<html>`. Most of the layout mirrors
for free under `direction: rtl` (flexbox's row axis is direction-aware by spec); the few
`position: fixed`/`absolute` elements pinned with a literal `left`/`right` (mobile drawers, the
toast stack, the kiosk-mode exit button) get explicit `[dir="rtl"]` overrides. The ~200 predefined
component names/descriptions and `help.html` deliberately stay in English — a separate, much
larger content-translation project.

Found during review: the guided-tour hint bubbles (always English, see `js/hints/hintData.js`)
were inheriting `direction: rtl` from the document under the new Hebrew mode, right-aligning their
English text and swapping their Skip/Next button order — `.hint-bubble` now forces `direction: ltr`
regardless of the app's language setting.

## v1.31.0 (2026-08-26)

Expands Diagram Animation with everything short of a full rewrite: multiple named animations per
diagram, grouped "reveal together" steps, per-step presenter notes, auto-focus pan/zoom, a
progress-dot scrubber, and unattended Autoplay/Loop modes.

**Multiple animations** — the panel gained a switcher (dropdown + "+ New"/✎ Rename/🗑 Delete) so
one diagram can carry several independent, separately-playable sequences (e.g. "Normal flow" vs
"Failure scenario") instead of just one.

**Group-reveal** — a step can now hold several targets that reveal together under one shared order
number: check items in the panel's "Add more" list and click "Add Selected as one step", or
right-click a multi-selection on the canvas and choose "Add Selection to Animation". Removing one
target from a grouped step (its own ✕ chip) leaves the rest of the group intact.

**Presenter notes** — each step can carry a short free-text reminder (📝 toggle in the panel),
shown in the playback controls for whichever step was just revealed — never part of the diagram
itself.

**Auto-focus** — a per-animation toggle pans/zooms the canvas to frame each step as it reveals,
using the same "fit to content" mechanism as the toolbar's own Fit-to-Screen action.

**Playback controls** — a row of clickable progress dots jumps straight to any step instead of
stepping through one at a time; ⏩ "Autoplay to the end" forces every remaining step to auto-advance
regardless of its own Auto/Click setting; 🔁 "Loop" restarts from the beginning after a short pause
once the sequence finishes — together enough for an unattended kiosk display. A newly-revealed item
also gets a brief pulse so it draws the eye.

**Export/import** — the standalone animation file now covers every named animation on the diagram
at once (a pre-v1.31 single-sequence export still imports correctly), and everything above is
ordinary project data, so it travels automatically with the diagram's own JSON export/import and
full backup too.

Fixed in review: right-clicking an item that was part of a current multi-selection used to
collapse that selection down to just the one item before the context menu even opened (a
right-click's own `pointerdown` fired first) — group-reveal via right-click needed the selection
preserved, so both `node.js` and `connector.js` now only collapse when the right-clicked item
*isn't* already selected. This also fixes the same experience for any other context-menu action
someone might reasonably expect to act on a multi-selection.

## v1.30.0 (2026-08-26)

**Diagram Animation** ("🎞️ Diagram Animation", Tools menu) — number any components and connectors
on the canvas into an ordered reveal sequence, editable from a new side panel that lists each
item's order and name, with per-step ▲/▼ reordering and an Auto (timed) / Click reveal-mode
choice. Right-click a component or connector for a quick "Add to Animation"/"Remove from
Animation" toggle, and small numbered badges show the current order directly on the canvas while
editing.

"▶️ Play Animation" enters a Presenter-Mode-style clean view and reveals the sequence step by
step: →/N or a plain click advances, ←/P goes back, Esc exits. Freeze mid-presentation (D key, or
the 🖊️ button) to draw freely over the frozen diagram — useful for pointing things out live — then
"Done" clears the markup and resumes. The sequence and its per-step settings export/import as a
standalone JSON file, independent of the diagram itself.

Fixed in review: the pre-existing Smart Suggestions toast wasn't hidden by Presenter/Kiosk Mode,
so it could render on top of the new playback controls — added it to the same chrome-hiding list.

## v1.29.0 (2026-08-25)

A 7-feature batch: a canvas table-of-contents, a visual undo/redo timeline, Terraform export,
multiple diagram tabs, Presenter Mode, large-diagram rendering performance, and a duplicate-tab
warning.

**Outline panel** ("📋 Outline", Tools menu) — a searchable, collapsible list of every component and
connector on the canvas, doubling as a table of contents. Click an entry to select and center it;
selecting something on the canvas highlights its row in the panel too.

**Undo History** ("🕘 Undo History", File menu) — a visual timeline of every past and available-to-
redo edit, each auto-labeled in plain language ("Added...", "Moved 2 components", ...). Jump
straight to any step instead of pressing undo/redo repeatedly.

**Terraform export** — "🌐 Export to..." gains a 4th target: a starter `.tf` file with one resource
block per recognized AWS component on the canvas, plus comments noting connectors and any
unmapped AWS components.

**Diagram tabs** — "🗂️ Open in New Tab..." (File menu) opens another saved diagram (or a new blank
one) alongside your current one. A tab strip appears above the toolbar once 2+ are open, to switch
between them; closing a tab never deletes its underlying saved project.

**Presenter Mode** ("🖥️ Presenter Mode", Tools menu) — hides the toolbar, sidebar and every side
panel for a full-bleed, distraction-free canvas view. Esc or a floating "Exit Presenter Mode"
button brings everything back.

**Large-diagram rendering performance** — components far outside the current view no longer cost
rendering work; the browser skips their layout/paint until scrolled back into view. Purely an
internal optimization — "Fit to screen", PNG/PDF export, and every measurement stay exactly as
accurate as before.

**Duplicate-tab warning** — opening this app in a second browser tab now shows a one-time warning
in both tabs, since every tab shares the same autosave and saved-project storage.

## v1.28.0 (2026-08-25)

An 8-feature batch of visual/UX upgrades: dark mode, diagram-wide color themes, custom icon upload,
a minimap, focus mode, draggable connector bend points, pinned comments, and an accessibility pass.

**Dark mode** — the "Theme" toolbar button (Tools menu) cycles Match System / Light / Dark; the
whole app restyles instantly and the choice is remembered.

**Diagram Theme** ("🎨 Diagram Theme", Tools menu) — permanently recolors every component to one of
several curated palettes (Ocean, Sunset, Forest, Monochrome, Pastel), keeping components that
currently share a color grouped together in the new palette.

**Custom icon upload** — any component's style editor now has an "Upload Image" button to use your
own image as its icon instead of the built-in emoji/icon set.

**Minimap** ("🧭 Minimap", Tools menu) — a small overview map in the corner of the canvas showing
every component as a tiny rect plus a "you are here" box; click or drag on it to jump the main view
anywhere.

**Focus Mode** ("🔦 Focus Mode", Tools menu) — dims every component except the current selection and
its directly-connected neighbors, for tracing one part of a large diagram.

**Manual connector waypoints** — a selected connector now shows small drag handles along its path:
drag one to bend the connector there, drag the "+" between two handles to add a new bend point, or
right-click a handle (or the connector itself) to remove it.

**Pinned comments** — right-click empty canvas and choose "Add comment here" to drop a note pin
anywhere; click a pin to edit its text or mark it resolved. Pins are included in "Fit to screen" and
PNG/PDF export.

**Accessibility** — a selected component can be nudged with the arrow keys (1px, or 10px with
Shift); every icon-only toolbar button (undo/redo/zoom/fit) now has a real accessible name for
screen readers; the command palette's search box keeps a visible focus ring instead of suppressing
it.

**Fixed**: the floating contextual style row could render partly hidden behind the new minimap when
the selected component was near the bottom-right corner of the canvas.

**Fixed**: opening a toolbar dropdown (File/Create/Tools/Help) while the sidebar drawer was open on
a narrow/mobile screen could render the dropdown's menu items behind the drawer instead of on top
of it.

## v1.27.0 (2026-08-25)

A large batch: diagram versioning/comparison, presentations with PPTX export, ready-made "Design X"
interview-prep templates, a Command Palette, cost estimation, visible label chips, and smart
alignment guides while dragging.

**Diagram Versions** ("📸 Version History", File menu) — save named snapshots of a diagram, revert
to one (undoable), or compare any two side-by-side (added/removed/changed nodes and edges, each
clickable to jump to it).

**Presentations** ("🎬 Presentations", File menu) — assemble an ordered slideshow out of saved
versions, play it step-by-step with rendered slide images, and export the whole thing to a real
`.pptx` file (vendored PptxGenJS — see `vendor/VENDOR.md`).

**5 new "Design X" reference-architecture templates** (Reference Architectures category) — URL
Shortener, Chat Application, Rate Limiter Service, Social Media Feed, and Ride-Sharing Dispatch —
complete, ready-to-customize starting points for system-design-interview prep, each instantiating
as one grouped cluster.

**Command Palette** ("⌘" toolbar button, or Ctrl/Cmd+K from anywhere) — search every app action or
add any component from one box; selecting a component first shows actions relevant to it (curated
companions, sub-components, duplicate/delete) ahead of the general list, with full keyboard
navigation.

**Estimated monthly cost** — set a $/mo estimate on any component (details panel), shown as a badge
on the component face and rolled into a running total ("💰 Cost Breakdown", Tools menu).

**Visible label chips** — the existing per-component labels field now renders as small chips
directly on the component face, not just in the details panel — handy for capacity/SLA tags like
"10K RPS" or "99.9% SLA".

**Smart alignment guides** — dragging a component (or a multi-selection) now snaps into exact
alignment with a nearby component's edge/center and shows a Figma-like dashed guide line, on by
default ("🧲 Snap Guides" toggle, Tools menu).

## v1.26.0 (2026-08-25)

A grab-bag batch closing out the previously-suggested export/lint/AI ideas: two more UML fragment
types, swimlane export grouping, a manual message-numbering override, whole-diagram export to three
external tools, a shareable link, an AI "Explain" mode, a deterministic structural linter, ER-diagram
patterns, and a "Recently Used" sidebar section.

**UML fragments**: added "critical" and "break" to the existing Alt/Opt/Loop/Par set (6 total).

**Swimlane/box export**: a plain "Group / Container" shape overlapping one or more lifelines now
wraps them in a labeled swimlane box in both the "📋 Copy as Mermaid" and "📋 Copy as PlantUML"
exports.

**Manual sequence-number override**: right-click a lifeline-to-lifeline message and choose "Set
sequence number..." to override its auto-computed badge for the rare case the auto order doesn't
match intent ("Clear sequence number override" reverts to automatic).

**New "🌐 Export to..."** (File menu) — exports the *whole* diagram (not just a sequence diagram) as
Mermaid flowchart text, a draw.io/diagrams.net `.drawio` file, or the same file for Lucidchart's
importer — each with a one-click "Open X" link to the tool itself (Mermaid Live Editor, draw.io,
Lucidchart).

**New "🔗 Share"** (File menu) — generates a link that encodes the whole diagram directly in the URL
(gzip-compressed, no backend, nothing uploaded); opening it loads an independent local copy for
whoever opens it.

**AI Design Review "🔍 Review" / "💬 Explain" toggle** — Explain mode asks the AI for a plain-language
walkthrough of the diagram instead of critique/feedback, reusing the same prepare-and-hand-off
mechanism.

**New "🔍 Check Diagram"** (Tools menu) — instant, offline structural checks (client talking straight
to a database, an unconnected component, a replication pair with no load balancer routing to it),
each finding clickable to jump to the component involved. Complements "🤖 AI Design Review" rather
than replacing it.

**3 new ER-diagram design patterns** (Design Patterns category): One-to-Many Relationship,
Many-to-Many with Join Table, and Self-Referencing Relationship.

**New "Recently Used" sidebar section** — pinned above the category list, shows the last 8
components you actually placed on the canvas, most recent first.

## v1.25.0 (2026-08-25)

A fourth sequence-diagram batch: 13 more ready-made templates covering distributed-systems,
protocol, and deployment scenarios, plus Mermaid import, a second export format (PlantUML), and a
sidebar hover-preview thumbnail for templates.

**13 new templates**: Two-Phase Commit, Outbox Pattern, Event Sourcing/CQRS Command Flow, gRPC
Unary Call, GraphQL Query Resolution, Presigned URL File Upload, Kafka Consumer-Group Rebalance,
Distributed Lock Acquisition, Service Mesh mTLS Handshake, Blue-Green/Canary Deployment Traffic
Shift, DNS Resolution Flow, Social/Federated Login, and Step-Up Authentication — 36 templates total
in the "Sequence Diagram Templates" category.

**"📥 Import from Mermaid"** (Create dropdown) — the inverse of "📋 Copy as Mermaid": paste Mermaid
`sequenceDiagram` text and it becomes a real, grouped set of lifelines and messages, reading
participants, `->>`/`-)`/`-->>` arrow styles, `activate`/`deactivate`, `destroy`, and
`alt`/`opt`/`loop`/`par` blocks. Best-effort, not a guaranteed lossless round-trip.

**"📋 Copy as PlantUML"** — a second export format alongside the existing Mermaid one, in the same
drill-down modal.

**Sidebar hover-preview thumbnail** — hovering (or keyboard-focusing) a Sequence Diagram Templates
item now shows a small SVG sketch of its lifelines and messages before you drop it in.

**Expanded Smart Suggestions**: gRPC Service, GraphQL Server, Apache Kafka, Redis Cache, DNS,
Service Mesh, S3, and Spinnaker now suggest a relevant new template.

**Fixed during review**: a sidebar preview popup could be left stuck on screen if the search box
was typed into while the popup was showing (the hovered item's DOM node is torn down and rebuilt
on every keystroke, without ever firing its own `mouseleave`) — the sidebar now explicitly hides
any open preview before rebuilding its list. Also fixed: an edge-lifeline's preview label could
render with its leading character clipped off (a center-anchored SVG text label on the
leftmost/rightmost lifeline ran past the preview box's own edge).

## v1.24.0 (2026-08-25)

A third sequence-diagram batch: 10 more ready-made templates spanning auth, resilience,
messaging, and caching, plus a matching wave of Smart Suggestions pairings.

**10 new templates**: Password Reset Flow, Passwordless Magic Link Login, WebAuthn/Passkey
Authentication, OAuth Client Credentials (M2M), WebSocket Handshake & Messaging, Webhook Delivery
with Retry, Circuit Breaker Pattern, Cache-Aside Pattern, Saga Pattern (Choreography), and
Idempotent Request Handling — 23 templates total in the "Sequence Diagram Templates" category.

**New component**: "WebSocket Server" (Networking) — a real-time full-duplex connection, missing
from the library until now.

**Expanded Smart Suggestions**: Redis Cache, WebSocket Server, Email Service, Webhook, Payment
Gateway, Circuit Breaker, and Saga Coordinator now suggest a relevant new template; OAuth/OIDC,
SSO, Identity Provider, and API Key each gained one more curated pairing alongside their existing
ones.

## v1.23.0 (2026-08-24)

A UML-completeness batch for sequence diagrams (destroy markers, activation bars, combined
fragments, sync/async/return presets, Mermaid export) plus a large expansion of ready-made
templates for common auth/identity/networking flows and their Smart Suggestions integration.

**Sync/async/return message presets**: selecting a single lifeline-to-lifeline message adds a
"Message preset" dropdown to the arrow style editor — Sync call, Async call, or Return sets
dash+arrowhead together instead of two separate fields.

**UML destroy marker**: right-click a lifeline → "Mark destroyed here" drops an X where it
terminates (computed from the click height), and shortens its dashed line to stop there.
"Clear destroy marker" removes it. Schema addition: `nodes[].destroyOffset` (default `null`).

**UML activation bars**: right-click a lifeline → "Add activation bar" for a draggable
execution-occurrence rectangle — drag its body to move it (both ends shift together), drag either
end to resize it, right-click it to remove it. Schema addition: `nodes[].activations` (default
`[]`, each `{id, startOffset, endOffset}`).

**UML combined fragments**: four new shapes (Alt/Opt/Loop/Par Fragment) in Sequence Diagram
Templates — a resizable, movable labeled box (reusing the plain rect/Group-Container mechanism)
with a small UML pentagon operator tag. One condition per box; drop it behind the messages it
encloses. Schema addition: `nodes[].fragmentType` (default `null`, one of `alt`/`opt`/`loop`/
`par`/`ref`).

**"📋 Copy as Mermaid"** in a sequence diagram's drill-down view — converts the diagram (including
activation bars, destroy markers, and any overlapping fragment box) into Mermaid `sequenceDiagram`
text on the clipboard. Best-effort, not a lossless round-trip.

**10 new sequence-diagram templates**: PKCE Authorization Flow, SCIM User Provisioning, MFA
Challenge, RBAC Authorization Check, ABAC Authorization Check, SSO (SAML/OIDC), SPA Silent Token
Refresh, API Key Authentication, TCP 3-Way Handshake, UDP Request/Response.

**Smart Suggestions now offers sequence-diagram templates**: placing a component like OAuth/OIDC,
SSO, Identity Provider, API Gateway, JWT, API Key, Cognito, React, or Router suggests a relevant
template in the suggestions banner — accepting it instantiates the whole template positioned next
to that component (not attached onto it, unlike a sub-component suggestion). Schema addition:
component defs gained a curated `relatedPatterns` field, parallel to `related`/`relatedLayers`.
A template can also now be dragged from the sidebar directly onto an existing node for the same
effect (previously dropping a pattern anywhere on the canvas always centered it on the drop point).

**Fixed during this batch's own review**: `core/replication.js`'s field-mirroring allowlist didn't
carry the three schema additions above (`destroyOffset`/`activations`/`fragmentType`) to a live
replication peer after the initial mirror was created — a value set on one side's lifeline
wouldn't propagate to its mirror. Fixed before merge; see `docs/ARCHITECTURE.md`'s "Activation
bars" gotcha.

## v1.22.0 (2026-08-24)

A follow-up batch rounding out sequence diagrams, plus two general connector/canvas features
that fell out of the same work.

**Self-messages**: a lifeline can now message itself (e.g. "validate locally" before a real call
out) — drag from its connection strip back onto itself at a different height; renders as a small
loop rather than a flat line through the lifeline. No schema change (`from === to`, distinct
`fromOffset`/`toOffset`, matching `fromSide`/`toSide`).

**Drag-to-reconnect**: a selected connector now shows two small handles at its exact endpoints —
drag either one to a different node (or a different height on the same lifeline) to move just that
end, live, without deleting and redrawing the connector. Dropping on empty canvas cancels rather
than deleting anything.

**"↔️ Distribute Evenly"** (Tools menu): re-spaces a sequence diagram's lifeline columns and
message heights evenly, preserving both the lifelines' left-to-right order and the messages'
top-to-bottom order — a tidy-up for a diagram that's drifted uneven from manual dragging.

**Live Replication mirrors connectors too**, not just components: a connector drawn between two
already-mirrored components on the same side (e.g. a message between two paired sequence-diagram
lifelines) automatically mirrors to the other side, with the same live sync/cascade-delete
semantics as node mirroring. Schema addition: `replicationPairs[].edgeMembers` (default `[]`,
same shape as `.members`).

**Zoom-in / drill-down on a sequence diagram**: grouping 2+ lifelines adds a 🔍 icon on the
group's background — a read-only zoomed preview (modal, or "📌 Pin to side panel" to dock it
instead) with an "✏️ Edit" button that opens the real canvas scoped to just that group for actual
editing, saving back into the main diagram when done. Nothing new persisted — a "sequence diagram
group" is simply any group whose members are all lifelines, so every existing JSON/PDF/PNG path
already supports it; a sequence-diagram group now also exports as its own separate PNG file /
extra PDF page alongside the main diagram.

**Connector label position & tooltip**: a connector's label can now sit near the start, middle
(default), or end of its own rendered path (`labelPosition`, new `edges[]` field, default
`"middle"`), and its free-text notes field now also shows as a native hover tooltip on the
connector itself.

**"📐 Scale Diagram"** (Tools menu): permanently resizes every component's position, size, *and*
font size together by a chosen percentage — distinct from zooming the view, which is purely
visual and never touches the underlying data.

**AI Design Review / Generate Design from Spec are sequence-diagram-aware**: reviewing a diagram
that contains a sequence diagram asks flow-specific questions (call order, missing responses,
race conditions, async-vs-blocking) instead of the generic architecture checklist; generating a
design now offers a second few-shot example and rule set for producing a proper sequence diagram
(lifelines + correctly time-ordered messages) when the spec calls for a step-by-step interaction
flow rather than a static architecture.

## v1.21.0 (2026-08-24)

New **"🔀 Sequence Diagram"** wizard (toolbar Create menu): name a set of participants (Client,
Server, Database, ...) and get a titled vertical **lifeline** node for each, evenly spaced left to
right. Messages are drawn with the existing drag-a-connector gesture, now generalized so a
connector lands wherever it was actually grabbed/dropped along a side (`fromOffset`/`toOffset`,
0..1, default 0.5 = the previous always-midpoint behavior — every existing diagram renders
identically) rather than always the midpoint. A lifeline exposes a full-height connection strip
instead of the usual small dot, so several messages on the same lifeline land at their own distinct
heights instead of colliding on one point. A message between two lifelines defaults to straight
routing and is automatically numbered (1, 2, 3, ...) top to bottom — purely computed for display, so
it's always correct after undo/redo or editing.

Also new: right-click any connector → **"Open details"** opens the right-side details panel (until
now node-only) for that connector — its label plus a new free-text **notes** field — and, for a
sequence-diagram message specifically, its auto-computed order. "🗺️ Auto-arrange" now skips (with
an explanatory toast) instead of scrambling a sequence diagram's manual layout whenever a lifeline
is on the canvas. The lifeline shape is also available on its own from the Basic Shapes sidebar
category.

Schema additions (`edges[]`): `fromOffset`/`toOffset` (default `0.5`) and `notes` (default `""`) —
both backward compatible, an older saved project loads with the same defaults it always rendered
with.

## v1.20.0 (2026-08-20)

New "🧹 Clear canvas" action (canvas right-click) — deletes every component, connector and
replication pair in one confirmed step and starts fresh. Distinct from "🆕 New" (which switches to
a brand-new, separate project): Clear Canvas empties the *current* project in place, keeping its
id/name so a later Save/autosave still writes to the same slot.

Implemented via `store.dispatch()` rather than `store.loadProject()` specifically so Ctrl/Cmd+Z
genuinely restores everything afterward — `loadProject()` calls `history.init()`, which replaces
undo/redo entirely rather than adding to it (right for a real project switch, wrong for clearing
the current one). Found while building this that the existing "New" button's confirm dialog already
makes the same "undo brings it back" claim for its own (loadProject-based, and therefore not
actually undoable) mechanism — left as-is since New's history reset is correct for a genuine
project switch, but documented in `docs/ARCHITECTURE.md`'s "Undo/redo" section as a pitfall to
avoid reproducing elsewhere.

## v1.19.0 (2026-08-20)

An 11-item batch: 5 bug fixes plus 6 UX improvements around replication, grouping, and the
component library.

**Fixes:**

- Database cylinder shape: the ellipse "cap" ::before overlapped the body's own left/right border
  above its equator, where an oval is narrower than the box — a straight vertical sliver of border
  poked above the curve at both top corners. Rebuilt with two outline-only pseudo-elements (cap +
  sides-and-bottom, meeting exactly at the cap's equator) instead of one filled ellipse plus a
  bordered body.
- Smart Suggestions banner: placing a component with no curated suggestions left whatever banner
  was already up from a *previous* placement untouched instead of hiding it — looked like
  suggestions had silently stopped working, since the banner never again reflected what was
  actually just placed.
- PNG export cropped a large or heavily-connected diagram: `getContentBounds()` only unioned node
  `x/y/w/h`, missing obstacle-avoiding edge routing (which can jut out past every node's own box
  while detouring) and `textPosition: 'above'/'below'` labels (which render entirely outside
  `.node-body` by design). Now also unions in the edge layer's own `getBBox()` and every external
  label's actual rect. Also added a canvas-size safety clamp — html2canvas silently clips past a
  browser's real `<canvas>` dimension cap (commonly ~16384px), so the export scale now downshifts
  from the default 2x if the target size would cross a conservative 8000px threshold, instead of
  producing a cropped image with no indication anything went wrong.
- Replication: adding a new component and joining it to an existing pair's side required knowing
  to select it, open the "🔁 Replicate" modal, and use its "Add as side A/B" buttons — the
  underlying mechanism already worked correctly (mirroring, moving/resizing a side together), the
  gap was purely discoverability. A component not yet part of a pair now offers "🔁 Join
  replication..." directly from its right-click context menu (only shown when it wouldn't silently
  detach the node from some other regular group it's already in).
- Removed the "🪄 Magic Arrow" toolbar toggle — obstacle-avoiding routing became the default for
  every connector in v1.15.0, making the pre-arm-before-drawing step pure redundancy ever since.
  The `'magic'` routing value/glow style itself is untouched, still choosable per-connector from
  the arrow editor's Routing dropdown.

**Improvements:**

- New "★ Popular only" sidebar toggle, narrowing the built-in library to just `popular: true`
  components (Favorites/My Components are unaffected — that's already a separate curation).
- New dismissible background boundary behind any multi-component regular group or replication
  side (purple for replication, gray for a plain group), so it reads as one visual unit at a
  glance — hover it and click its ✕ to hide just the background, without touching the group/pair
  itself. A replication side needs only 1 member to get one (the common case); a regular group
  needs 2+ (a single ungrouped node has nothing to bound).
- The "Group / Container" basic shape now captions its label at the top instead of centering it
  over whatever gets placed inside it, hides its icon, and starts at a larger default size —
  required extending `data/schema.js#c()`/`core/project.js#createNode` to let a component
  definition pin its own `textPosition`/`iconVisible` default (previously only settable globally
  via Default Settings or per-node after placement), for shapes where the default is structural
  rather than a style preference.

## v1.18.1 (2026-08-20)

Fixed the database cylinder shape — every DB/cache component set to `shape: 'cylinder'`
(PostgreSQL, Redis, MongoDB, and the rest) previously rendered as a barely-rounded box (a single
`border-radius` trick), not the classic drum/cylinder icon used across most system-design
diagrams:

- `css/node.css` now builds the shape from `.node-body`'s own curved bottom (top border/radius
  suppressed) plus a `::before` full-ellipse "cap" clipped by the body's existing
  `overflow: hidden` — no `clip-path` involved, so none of the diamond/hexagon stacking-context
  workaround is needed. Documented the technique in `docs/ARCHITECTURE.md`.
- Gave `aws-elasticache` (AWS's managed Redis/Memcached) the same `shape: 'cylinder'` its sibling
  AWS database services already had — the one gap found while auditing DB/cache components for
  the shape.
- Verified at default, small (resized-down), and large (resized-up) node sizes, on mobile/tablet
  viewports, and in the PNG export (html2canvas) path.

## v1.18.0 (2026-08-18)

21 more curated `relatedLayers` pairings — same precision-first bar, but exercising a new part of
the mechanism for the first time: a `kind: 'layer'` component can carry its own `relatedLayers`
pointing at *another* layer, and it works identically once dropped standalone (not attached onto
something else) — `createNodeFromDrop` never branched on `kind`, so this was already
technically possible, just never curated before:

- **19 layer-to-layer pairings**, all named, textbook design-pattern-role relationships rather
  than loose associations — GoF (`layer-adapter` → `layer-adaptee`, `layer-factory`/`layer-builder`
  → `layer-product`, `layer-context-role` → `layer-strategy`), DDD/enterprise (`layer-repository`
  → `layer-unit-of-work`, `layer-dto` → `layer-mapper`), Hexagonal/Ports & Adapters
  (`layer-port` → `layer-adapter`, `layer-core-domain` → `layer-port`), and framework-agnostic
  backend conventions (`layer-router` → `layer-controller`, `layer-migration`/`layer-seeder` →
  `layer-schema`/`layer-migration`, `layer-circuit-breaker` → `layer-retry-policy`,
  `layer-webhook-handler` → `layer-validator`, `layer-session-manager` → `layer-authentication`,
  `layer-trigger` → `layer-stored-procedure`, `layer-saga-coordinator` → `layer-command-handler`,
  `layer-provider` → `layer-interface`). Direction always goes on the *containing/wrapping* role,
  pointing at what it holds (Adapter wraps an Adaptee, not the reverse) — same convention every
  other `relatedLayers` entry already follows.
- Plus 2 more component-level pairings: `ai-inference-endpoint` → Controller + DTO (an API
  endpoint shape, same reasoning as the REST API/gRPC/Chat Endpoint pairings from the last batch),
  `ctr-istio` → Sidecar Proxy (the textbook service-mesh sub-component, same reasoning as
  `net-service-mesh`).
- Documented the "layers can suggest other layers, direction matters" nuance in
  `docs/ARCHITECTURE.md`'s Smart Suggestions section and the `add-library-item` skill.

## v1.17.0 (2026-08-18)

Expanded ✨ Smart Suggestions' `relatedLayers` (sub-component) curation — a precision-first pass,
same bar as every prior expansion (something most engineers would nod at immediately, not every
plausible pairing):

- **23 new pairings across 7 category files**: backend framework/language handler+middleware
  conventions (Actix, Fastify, Fiber, Gin all suggest Handler/Middleware — their own docs use these
  exact terms; FastAPI suggests Validator + DTO for its defining Pydantic-model validation; Phoenix
  suggests Controller + Model, matching Rails/Django's existing MVC treatment); serverless entry
  points (`aws-lambda`, `srv-serverless-fn`) both suggest Handler, since every serverless runtime
  literally calls its entry point that; orchestration-named components (`aws-step-functions`,
  `ai-agent-orchestrator`) suggest Orchestrator; `net-service-mesh` suggests Sidecar Proxy (the
  textbook service-mesh sub-component); `misc-cron` suggests Scheduler (an exact-name match);
  `misc-webhook` suggests Webhook Handler (ditto); `misc-worker` suggests Event Handler;
  `misc-rest-api`/`misc-grpc`/`ai-chat-endpoint` suggest Controller/Service + DTO for their
  request/response shape; `srv-microservice` gets the same Controller/Service pairing
  `srv-app-server` already had; React-based meta-frameworks already pointing at React via `related`
  (Next.js, Remix) or Vue via Nuxt now also get their underlying library's own `relatedLayers`
  (React Hook/Component, Vue Component/Store) so dropping the meta-framework itself offers the same
  sub-component suggestions dropping the base library would; Preact gets the same React
  Hook/Component pairing since its API explicitly mirrors React's, hooks included.
- Deliberately skipped candidates that didn't clear the bar: Flask (intentionally unopinionated, no
  canonical layer), SvelteKit/Svelte (no matching layer exists in the library yet), Ember (its
  historical Controller concept is largely deprecated in modern Ember Octane), raw
  languages/runtimes (Go, Python, Node.js, .NET, Java — no single-app-layer structure at the
  language level), and infrastructure/message-broker components (queues, caches, databases) that
  the library has never given `relatedLayers` — matching the existing "a queue/database has no
  natural sub-component" precedent.

## v1.16.0 (2026-08-18)

- Added a persistent way to revisit **✨ Smart Suggestions**' curated sub-component ("attach as a
  building block") suggestions after the placement-time banner is gone — a component with any
  unattached curated suggestion now shows a small 💡 badge on the node; clicking it opens the
  details panel's new "Suggested sub-components" section, which offers the same curated list as
  checkboxes so any number can be selected and attached together in one step ("+ Add selected"),
  instead of one click per suggestion. Works on a node loaded from a saved project too, not only
  right after placement. New `canvas/suggestions.js#getUnattachedLayerSuggestions` shared filter,
  `js/canvas/node.js` badge, `js/panel/detailsPanel.js#renderSuggestedSubComponents` section.

## v1.15.0 (2026-08-17)

Five related improvements to how you build and organize a diagram, requested together:

- **Smart Suggestions now draws the connecting arrow**: accepting a companion from the "✨ Smart
  Suggestions" banner previously just dropped an unconnected new node next to the one you placed —
  it now also creates the edge between them (in the natural anchor → suggestion direction) and
  places the new node with anti-overlap placement instead of a blind fixed offset
  (`canvas.js#addRelatedComponent`, reusing the pre-existing `findClearCenter` helper).
- **New "🗺️ Auto-arrange"** (Tools menu): rearranges every component on the canvas into a clean
  top-to-bottom layered layout that follows connector direction (a simplified Sugiyama-style
  layout — rank-by-longest-path, single-pass barycenter ordering within each rank, row-wrap for
  very wide ranks — see the new `core/autoLayout.js`), and re-picks every edge's anchor sides to
  match the new positions.
- **Smarter connector anchoring and routing, for every new connector**: which side of a component
  a connector's endpoint lands on is now picked from the two components' actual relative position
  (`core/geometry.js#pickBestSides`) rather than fixed to whichever exact point you dragged from —
  drag from anywhere on the source, the arrow still exits/enters on the geometrically sensible
  side. The default (`'orthogonal'`) routing also now auto-avoids other components in its path,
  the same obstacle-avoiding routing previously only used by the explicit "🪄 Magic Arrow" toggle
  (which is unchanged and still available for its shortest-path guarantee).
- **Popular component highlighting**: the sidebar library now gives a subtle background tint and a
  ★ badge to a hand-curated set of components most engineers would immediately recognize as common
  building blocks in their category (PostgreSQL, Docker, S3, Kafka, React, and ~30 more across
  AWS, Databases, Containers, Networking, Monitoring, and more) — a new `popular` flag on the
  component schema (`js/data/schema.js`), same curation bar as `related`.
- **New "⭐ Favorites"**: right-click any component (built-in or "My Components") and choose "Add
  to Favorites" to pin it to a new Favorites section at the top of the sidebar. Organize favorites
  into folders and subfolders from the same right-click menu (or the section's own "+ New folder"
  button): rename, delete (cascades to subfolders, un-favoriting their contents without touching
  the underlying components), and reorder folders/favorites with "Move up"/"Move down". Favorites
  are personal library data like "My Components" — not part of the project file, unaffected by
  undo/redo, and now included in the full-backup export/import (`io/favorites.js`).

## v1.14.0 (2026-08-17)

Expanded ✨ Smart Suggestions coverage — a deliberate, precision-first pass, not an attempt to
cover the whole library:

- **~90 new curated `related`/`relatedLayers` pairings** across AWS, Containers & Orchestration,
  Monitoring & Observability, Security & Identity, Databases, Storage, DevOps & CI/CD, Logging,
  Servers & Compute, Networking, AI/ML, AI Providers & Agents, Frontend Frameworks, Backend
  Frameworks, and Cloud Providers. Every addition clears the `add-library-item` skill's curation
  bar (something most engineers would nod at immediately) — several categories of pairing were
  considered and deliberately skipped for being too generic ("every CI tool could use Docker",
  "every backend framework could use a database") or ambiguous (a component with several
  equally-plausible companions and no single canonical one). Highlights: AWS resource hierarchies
  that are literally direct parent/child relationships (ECS Cluster → Service → Task, EKS Cluster
  → Node Group → Pod), named AWS patterns (SNS → SQS fan-out, Route 53 → CloudFront/ELB, a VPC →
  its Internet/NAT Gateways), 1:1 AI provider → flagship model pairings (Anthropic → Claude, xAI →
  Grok, OpenAI → GPT/DALL·E/Whisper, ...), the MCP client/server/tool triad, a RAG Pipeline →
  Vector Database/Reranker/Knowledge Base, meta-frameworks built directly on another library in
  this one (Next.js/Gatsby/Remix → React, Nuxt → Vue), and two more MVC-architecture frameworks
  (Laravel, ASP.NET Core) getting the same `relatedLayers` treatment Rails/Django already had.
- **Fixed a pre-existing e2e test fragility this batch's data changes exposed**:
  `tests/e2e/smart-suggestions.spec.js`'s "no curated companions" test used a plain substring
  search for "DNS", which had always matched both `net-dns` and `aws-route53` (tagged `dns`) with
  Route 53 ranking first — harmless while neither had a `related` list, but broken the moment
  Route 53 legitimately gained one in this batch. Switched to the file's own exact-match
  `addExactComponent` helper. See `docs/AI_AGENT_GUIDE.md`'s new pitfall entry for the general
  lesson (re-run the full suite after any `related` batch, not just new tests).

## v1.13.1 (2026-08-17)

Two reported UI bugs, both real regressions/oversights caught by the reporter, not by review:

- **Fixed: a sub-component row in the details panel (and the "New Component" modal, which shares
  the same markup) rendered its icon field at the row's full width instead of a fixed 52px,
  pushing the name field and the "×" remove button off the edge of the panel and off-screen
  entirely.** Root cause: `.sub-icon-input { width: 52px }` (a bare class selector, specificity
  0,1,0) lost to base.css's `input[type="text"] { width: 100% }` (0,1,1 — a type selector *and*
  an attribute selector), regardless of stylesheet load order. Fixed by scoping the override to
  `.subcomponent-row .sub-icon-input` (0,2,0), which unambiguously wins; also added `min-width: 0`
  to the row's other inputs and `flex: 0 0 auto` to its remove button for robustness at the
  details panel's narrowest resizable width. See `docs/AI_AGENT_GUIDE.md`'s new "bare class loses
  to `input[type]`" pitfall for the general lesson.
- **Fixed: diamond and hexagon components rendered with no visible border, and their icon/label
  were completely hidden.** The double-layer clip-path border technique (added in v1.12.0) put
  its `::before` "fill" layer on top of the real content instead of underneath it. Root cause:
  `clip-path` on `.node-body` creates a stacking context, and within it a *positioned* `::before`
  (required for its `inset` offset) paints in a later step than in-flow non-positioned content per
  the CSS2 painting-order algorithm — the opposite of what the original implementation assumed.
  Fixed with an explicit `z-index: -1` on `::before`. See `docs/ARCHITECTURE.md`'s "Borders on
  clip-path shapes" section for the full mechanism and why the fix works.

## v1.13.0 (2026-08-16)

A mobile bug report plus a requested feature, both from the same message:

- **Fixed: panning/scrolling inside the canvas on mobile could make components flicker or vanish
  mid-drag.** `#canvas-viewport` had no `touch-action` set, so a single-finger touch-drag
  (`canvas.js#beginPan`, driven entirely by pointer events) could be arbitrated by the browser as
  a native scroll/pan gesture running in parallel with the JS `transform`-based pan — the two
  fighting over the same GPU-composited layer is a known cause of content flickering/vanishing
  mid-gesture on mobile Chrome/Safari; `preventDefault()` on `pointerdown` alone doesn't reliably
  suppress this. Fixed with `touch-action: none` on `#canvas-viewport` (css/canvas.css) — the
  "used" touch-action for a region is the intersection of the value on the element and all its
  ancestors, so setting it once here covers every descendant gesture surface (`.node`,
  `.resize-handle`, `.conn-point`) too. Also added `setPointerCapture()` to `beginPan`
  (`canvas.js`), `beginResize` and `beginConnectFromNode` (`nodeInteractions.js`,
  `connectorInteractions.js`) for drag robustness against a fast/off-bounds touch-drag producing a
  `pointercancel` — deliberately *not* added to `beginMove` (a node's move-drag), since that
  handler fires on every pointerdown on a node including both clicks of a double-click, and
  capturing the pointer there broke the browser's native `dblclick` synthesis outright (caught by
  an existing inline-rename e2e test).
- **New: "🔎 Find on canvas" search box in the toolbar.** Searches components/connectors already
  placed on the canvas by their text/label — distinct from the sidebar's own search, which
  searches the component *library* to add something new. Selects and centers the viewport
  (`viewport.js#centerOn`, new — pans without changing zoom, unlike `fitToContent`) on the first
  match as you type; Enter/Shift+Enter cycle forward/backward through the rest, wrapping, with a
  "N/M" or "No matches" indicator (`toolbar.js#buildCanvasSearchGroup`). Appended last in the
  toolbar's row-1 DOM order (after File/Create/Tools/Help), not before the flex spacer — at common
  desktop widths that row already has ~zero slack, so inserting a new item earlier in the flow
  shifted the flex-wrap line-break point and dragged the Help dropdown trigger onto row 2 in an
  unpredictable spot, where a first-run tour hint bubble could land on top of it and swallow
  clicks; appending last means it's always the thing that wraps, if anything does, leaving the
  other triggers' wrap behavior undisturbed.

## v1.12.0 (2026-08-16)

Two more reported bugs: the contextual style row's canvas-jump complaint got a real alternative
(not just a smoother transition), and diamond/hexagon shapes had a longstanding border bug:

- **New: floating/pinned-top/pinned-bottom display modes for the contextual style row.**
  `js/io/uiPrefs.js` (new) stores the mode under the pre-existing `'prefs'` localStorage key.
  `toolbar.js#mountContextRow` moves the single persistent `.toolbar-row-context` element between
  `#toolbar` (pinned-top, the original in-flow behavior), the last child of `#app` (pinned-bottom,
  shrinking `.app-body` from the bottom the way `#toolbar` shrinks it from the top), or
  `document.body` (floating, `position: fixed`). A 📌 button on the row's header toggles floating
  ↔ pinned-top; "Default Settings" → "Style editor" picks the default, including pinned-bottom.
  `positionFloatingRow()` anchors the floating card next to the current selection, clamped to
  `#canvas-viewport`'s own rect (not the window) so it can never cover the toolbar, sidebar, or
  details/AI review panel, and computed away from the selection's own rect so it can never slide
  back over it either — the card scrolls internally if it doesn't fully fit rather than being
  clamped back into an overlap. Hides itself while a toolbar dropdown panel is open
  (`toolbarDropdown.js#onDropdownOpenChange`) since that's independently-positioned floating UI
  too, and re-tracks the selection via a `ResizeObserver` on `#canvas-viewport` itself (catches
  the details/AI review panels resizing it on open/close, which have no pub-sub of their own),
  with its own height dynamically capped to whatever room actually exists so it can never render
  past the bottom of the window either, and shrinks its own usable bottom edge while the "Smart
  Suggestions" banner is visible (`canvas/suggestions.js#onSuggestionsVisibilityChange`) since
  that's yet another independently-positioned `position: fixed` element outside
  `#canvas-viewport`'s box. See `docs/ARCHITECTURE.md`'s "Contextual style-editor row" gotcha #4
  for the six overlap/positioning bugs a first pass shipped (window-only clamping; a fallback
  clamp that could still slide back over the anchor; a "more room wins" side choice that could
  still reach unrelated content; missing panel-resize triggers; an uncapped height reaching past
  the window; the Smart Suggestions banner) and how each was fixed.
- **Fixed: adding two components by clicking the sidebar (without moving either one) could make
  the first one permanently unclickable.** Not actually a new bug — a latent issue in
  `canvas.js#addComponentAtCenter` that the old always-pinned-top row had been accidentally
  masking (selecting a newly-added node grew the toolbar, which shifted `#canvas-viewport`'s
  center before the next click-add landed). `'floating'` mode doesn't resize anything, so that
  accidental workaround went away and every click-added component started landing in the exact
  same spot as the last. `createNodeFromDrop` (and `addCustomShapeNode`, the "Add Shape" modal,
  which has the same "always targets the exact canvas center" pattern) now nudges a new node's
  position diagonally (24px steps, same cascade `duplicateSelection` uses) only while it would
  otherwise cover an existing node's own center point — see `docs/ARCHITECTURE.md` gotcha #5.
- **Fixed: diamond and hexagon shapes' border didn't follow their actual outline.** A plain CSS
  `border` doesn't follow `clip-path`'s polygon — the border box underneath is still a rectangle,
  so the clip crops that rectangle's border unevenly instead of hugging the visible shape. Fixed
  with a double-layer technique in `css/node.css` (the outer `.node-body` becomes the "stroke"
  layer, a `::before` pseudo-element inset by the border width becomes the "fill" layer, both
  sharing the same `clip-path` polygon) — see `docs/ARCHITECTURE.md`'s "Borders on clip-path
  shapes" section for the full mechanism.

## v1.11.0 (2026-08-16)

Batch of reported bugs, all traced to root cause and fixed, plus a new details-panel resize handle:

- **Fixed: per-keystroke focus loss.** `formControls.js`'s `textInput`/`numberInput`/`colorInput`
  dispatch on every `input` event, and both the details panel and the toolbar's contextual style
  row fully `clear()` + rebuild their DOM on every store `'change'` event with no reconciliation —
  so typing a single character into any of those fields destroyed and recreated the very `<input>`
  being typed into, losing focus every time. Added `utils/dom.js#rerenderPreservingUiState`, which
  captures the focused element (via a new `data-focus-key` attribute, added to every affected field)
  and its selection range before the rebuild and restores both after — used by
  `detailsPanel.js#render` and `toolbar.js#renderContextRow`. Also fixed a related but separate
  issue in `canvas/node.js#updateNodeEl`: it rebuilds a node's body on *every* store change
  anywhere in the app (not just changes to that node), which could destroy an in-progress inline
  rename (`startInlineEdit`'s raw `<input>`) started on a completely different action; it now skips
  the rebuild while that node's own inline edit is live.
- **Fixed: double-click dead zone.** `.node-standard`/`.node-icon`/`.node-subchips` all set
  `pointer-events: none` (so they don't steal single-click/drag-select from the node), which as a
  side effect meant only the exact label text had a real double-click target — clicking a node's
  icon or padding did nothing. `node.js#createNodeEl` now also listens for `dblclick` on
  `.node-body` itself as a fallback, catching whatever pointer-events lets fall through to it.
- **New: details panel resize handle** (`panel/detailsPanel.js#initResizeHandle`,
  `css/panel.css`) — drag the panel's left edge to widen/narrow it (260-640px), persisted across
  reloads. First attempt straddled the panel's border with a negative offset, which
  `#details-panel.open`'s `overflow-y: auto` silently clipped out of both view and hit-testing
  (per the CSS spec, a `visible` `overflow-x` paired with a non-`visible` `overflow-y` computes to
  `auto`, never truly `visible`) — the handle now sits fully inside the panel's own box.
- **Fixed: details panel didn't track canvas selection.** It only ever opened/updated via the
  explicit "Open details" action (ⓘ button / context menu) — it had no `store.subscribe('selection', ...)`
  at all, so clicking empty canvas or a different node left it open on stale content. Now closes on
  deselect and switches straight to a newly-selected single node.
- **Fixed: contextual style row's abrupt canvas resize.** A floating/absolute-overlay version was
  tried first but reverted — it covered sidebar items and canvas nodes still meant to be clickable
  while something is selected (confirmed by real e2e regressions: connecting to a second node,
  duplicating, grouping). Kept in normal document flow, with a fade+slide-in animation to soften
  what would otherwise be an instant size jump.
- **Fixed: "Toggle Grid" did nothing.** `#canvas-viewport`'s `background: var(--color-bg)` (the
  shorthand) was resetting `background-image` to `none`, and as an ID selector it always won over
  `.canvas-viewport`'s own dot-grid/line-grid rules regardless of source order — so the canvas
  background was always a flat color no matter what the toggle set. Changed to `background-color`.
- **Fixed: sidebar scroll reset.** Expanding/collapsing a category (or a custom-component folder)
  re-renders `.sidebar-categories` from scratch; while briefly empty mid-rebuild its `scrollHeight`
  collapses, clamping `scrollTop` down with nothing to restore it after. `sidebar.js#renderList` now
  saves/restores `scrollTop` around every rebuild.
- **Fixed: edge context menu missing Duplicate.** `canvas.js#openEdgeContextMenu` only offered
  "Delete connector" — `duplicateSelection()` already fully supports a pure-edge selection, it just
  wasn't exposed there (the toolbar's contextual row already had it).

## v1.10.0 (2026-08-16)

- Smart Suggestions batch 2: ~13 more curated `related` companion pairings
  across categories not covered in v1.9.0 — the Beats→Logstash→
  Elasticsearch→Kibana log pipeline, Fluentd→Elasticsearch (EFK), ArgoCD→
  Kubernetes, Jenkins→Docker, OAuth/OIDC→JWT, Identity Provider→SSO, WAF→
  CDN, Datadog→PagerDuty, and Istio↔Envoy Proxy.
- New: Smart Suggestions can now also suggest **sub-components** to attach
  directly onto the node you just placed, via a new curated `relatedLayers`
  field (`js/data/schema.js#c`) resolved by `getRelatedLayers()`
  (`js/data/index.js`) — e.g. placing Express (Node.js) suggests attaching
  a Controller/Middleware layer, React suggests a Hook/Component, Django
  suggests a Model/View, API Gateway suggests Authentication/Rate Limiter.
  Shown as a second, visually distinct ("↳", dashed green border) row in
  the same banner; clicking one attaches it exactly like dragging that
  item from "Layers & Roles" onto the node (`canvas.js#addLayerToNode`,
  reused as-is) instead of creating a new standalone node. An
  already-attached sub-component is never re-suggested.
- `js/canvas/suggestions.js#showSuggestionsFor` now takes the just-created
  node (not just its definition) so it can check the node's own
  `subComponents` for that filtering.

## v1.9.0 (2026-08-16)

- Added "✨ Smart Suggestions": placing a component with a curated list of
  well-known real-world companions (Load Balancer → Nginx Web Server /
  Auto Scaling Group; Kafka → Elasticsearch; API Gateway → Lambda/Cognito;
  S3 → CDN/CloudFront; Redis ↔ Postgres/MySQL/MongoDB; Docker ↔ Kubernetes;
  Prometheus ↔ Grafana; and more — ~22 components, ~25 pairings) shows a
  small dismissible banner with one-click "+ Add X" buttons, positioned
  next to the component just placed. Already-present companions are never
  re-offered, and a component with no curated companions shows no banner.
  New `related` field on component definitions (`js/data/schema.js#c`),
  resolved via `getRelatedComponents()` (`js/data/index.js`), rendered by
  the new `js/canvas/suggestions.js`. See `docs/ARCHITECTURE.md` "Smart
  Suggestions" for the design (deliberately hand-curated and sparse, no
  circular import between `canvas.js` and `suggestions.js`).
- New "🎛️ Default settings" → "Component library" toggle to turn Smart
  Suggestions off entirely.
- `.claude/skills/add-library-item/SKILL.md` and
  `.claude/skills/release-checklist/SKILL.md` now prompt checking for a
  `related` (Smart Suggestions) pairing whenever a new predefined
  component or category is added.

## v1.8.0 (2026-08-16)

- Added a collapse/close header to the toolbar's contextual style-editor row
  (`toolbar.js#renderContextRow`): a selection summary, a ›/‹ toggle that
  shrinks the row to a slim strip without deselecting (most useful on
  mobile, where the full field grid could otherwise fill most of the
  screen), and a ✕ that deselects outright. Previously there was no
  explicit way to dismiss the row at all — only an implicit background
  click or Escape. See `docs/ARCHITECTURE.md` "Contextual style-editor
  row".
- Fixed (found during this batch's UI/UX review pass, testing with a
  deliberately long component name rather than the short examples used
  elsewhere): the new header's selection-name text didn't actually
  truncate on a narrow viewport and instead pushed the whole row wider
  than the screen. Root cause was a flexbox default (`min-width: auto`)
  silently defeating `text-overflow: ellipsis` at *two* levels of the
  element chain, tangled up with a third, unrelated issue where combining
  the shared `.toolbar-row` class's `flex-wrap: wrap` with this row's own
  `flex-direction: column` produced a multi-column layout instead of a
  simple stack. See the "Gotcha found in review" note in
  `docs/ARCHITECTURE.md`'s "Contextual style-editor row" section — worth
  remembering for any future flex-column-with-truncated-text layout.
- Strengthened `.claude/skills/release-checklist/SKILL.md` to state
  unambiguously that the review pass means running code review 3 literal
  times (technical, functional, UI/UX+mobile), not a merged single pass.

## v1.7.1 (2026-08-16)

- Moved "🔷 Add Shape" and "🪄 Magic Arrow" back out of the Create/Tools
  dropdown menus (added in v1.7.0) to the always-visible toolbar row —
  user feedback that both are used too frequently while actively drawing a
  diagram for a dropdown click to be worth it. See `buildQuickCreateGroup`
  in `js/toolbar/toolbar.js`.
- Fixed a real mobile bug (reported on a real device, not just simulated
  viewport testing): a toolbar dropdown panel (File/Create/Tools/Help)
  could render partly off the edge of the screen instead of staying fully
  visible. The panel's CSS `position: absolute` (relative to its trigger)
  had no way to know it needed to flip/clamp itself once the toolbar
  wrapped a trigger onto a row with less room than the panel needed —
  switched to `position: fixed` with JS-computed, viewport-clamped
  coordinates (same pattern as `canvas/contextMenu.js`'s right-click
  menu). See `js/toolbar/toolbarDropdown.js`.

## v1.7.0 (2026-08-16)

- Added **navigation tools**: a 🖱️ **Select** / ✋ **Hand** toolbar toggle
  (`H`/`V` keyboard shortcuts, and holding **Space** temporarily pans no
  matter which tool is active). Hand-tool dragging pans the canvas even
  when it starts on top of a component, without moving or altering it —
  see `docs/ARCHITECTURE.md` "Navigation tools" for how the `pointerdown`
  capture-phase interception makes that work without touching
  `nodeInteractions.js`. Zoom in/out/reset/fit-to-screen were already
  covered by the existing zoom controls.
- Added **"⭐ Save as Component"**: any selection of 2+ components (plus
  the connectors between them) can now be saved as one reusable "My
  Components" item — with or without grouping them first. Unlike a
  hand-authored Design Pattern, it captures each node's exact styling, so
  placing it again reproduces precisely what was selected, re-grouped
  together as one unit. A single-node selection still opens the richer,
  editable "New Component" form instead. Fixed a latent bug this surfaced:
  `importCustomComponents` was rebuilding every imported record from a
  field whitelist that silently dropped a saved group's `pattern` data —
  it would have reverted to broken single-node junk on re-import or
  full-backup restore.
- **Restructured the toolbar** into File/Create/Tools/Help dropdown menus,
  keeping only continuously-used controls (undo/redo, Select/Hand, zoom)
  flat in the always-visible row — keeps the row short and findable
  instead of growing unbounded as more actions are added (the direct cause
  of a past mobile horizontal-overflow bug). Every toolbar button, flat or
  inside a dropdown, now has a clear, descriptive tooltip; the
  release-checklist skill and `AI_AGENT_GUIDE.md` were updated to check
  for both on every future toolbar change.

## v1.6.0 (2026-08-15)

- Added **❄️ Freeze / ▶️ Resume** to each replication pair (in the
  "🔁 Replicate" modal): freezing pauses live syncing completely for that
  pair — either side can then be edited, or a new component added, without
  it reaching the other side. Resuming picks syncing back up from that
  point on (it does not retroactively reconcile whatever changed while
  frozen). Joining a frozen pair is disabled in the UI, since a new member
  wouldn't visibly mirror until resumed. A frozen pair's members show a ❄️
  canvas badge instead of 🔁.
- Added 12 AWS **Region** components (US East N. Virginia/Ohio, US West
  Oregon/N. California, Canada Central, Europe Ireland/London/Frankfurt,
  Asia Pacific Singapore/Sydney/Tokyo, South America São Paulo) — big
  container-style boxes for depicting multi-region architectures, plus a
  **CloudFront Edge Location** component.
- Added a **🔔/🔕 hints toggle** to the toolbar: turns hint bubbles on/off
  at any time, independent of "💡 Show hints again" (which restarts the
  whole tour by clearing every dismissed hint). Turning hints back off
  hides the current bubble without dismissing it; turning back on resumes
  exactly where it left off. Restarting the tour also turns this switch
  back on, so it can never look silently broken.
- Fixed two real mobile-layout bugs (found by direct DOM measurement, not
  visual inspection — see docs/ARCHITECTURE.md "Mobile/responsive layout"
  for the full story and why `fullPage` screenshots misled the first pass):
  a toolbar button group with several full-text buttons (adding "🔁
  Replicate" was what tipped it over) forced the whole page into
  horizontal scroll instead of wrapping onto a new line; and the
  sidebar/details-panel/AI-review-panel mobile drawers used a hardcoded
  pixel offset for "below the toolbar" that broke once the toolbar wrapped
  onto more than one row, rendering the drawer starting partway through
  the toolbar instead of below it.
- Added `.claude/skills/release-checklist` and `.claude/skills/add-library-item`
  — repeatable project skills encoding this repo's recurring "wrap up a
  batch of changes" checklist and "add a component/pattern to the library"
  workflow, respectively, to keep future work consistent and cut down on
  re-deriving conventions from scratch each time.

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
