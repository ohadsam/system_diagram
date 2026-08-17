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
