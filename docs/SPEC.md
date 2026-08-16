# System Design Diagram Builder — Specification (איפיון)

Status: v1.3 · Last updated: 2026-08-15

## 1. Purpose

A 100% client-side web application (static HTML/CSS/JS, no backend, no build
step) that lets software engineers and architects visually design system
architecture diagrams: drag predefined components (servers, databases, AWS
services, frameworks, etc.) onto a canvas, connect them with configurable
arrows, style everything, annotate with details, and export/share the result.
Hosted on GitHub Pages.

Audience: software developers, architects, engineers. Desktop-first, usable
on mobile.

Language: UI is English. This spec is in Hebrew/English mix for the project
owner; code/UI/comments are English only.

## 2. Non-goals

- No server, no accounts, no real-time collaboration.
- No build pipeline (no bundler/transpiler) — plain ES modules load directly
  in the browser so the site works by opening `index.html` or serving the
  repo root as-is (GitHub Pages).
- Two runtime dependencies loaded from CDN are allowed for export only:
  `html2canvas` (PNG export) and `jsPDF` (PDF export). Everything else is
  hand-written vanilla JS.

## 3. Core concepts

- **Project**: the whole diagram — nodes, edges, canvas viewport, metadata
  (name, id, createdAt, updatedAt).
- **Node**: a placed component instance on the canvas (position, size,
  shape, colors, text/label, icon, notes, sub-components, custom rows).
- **Edge / Connector**: an arrow between two nodes (or free points), with
  routing style (straight / orthogonal / curved), arrow-head style per end,
  color, thickness, dash pattern, label.
- **Component definition**: a predefined (or user-created) template in the
  library that a node is instantiated from (icon, default color/shape,
  category, optional default sub-components).

## 4. Functional requirements

### 4.1 Layout
- Left sidebar: search box + categorized, alphabetically sorted list of
  draggable component definitions. Collapsible category groups.
- Center: infinite pannable/zoomable canvas — the diagram surface.
- Top toolbar: global actions + contextual style editor for the current
  selection.
- Right slide-in panel: node/edge details (opens on click of a node's info
  affordance).

### 4.2 Component library (sidebar)
- Components grouped by category (AWS, Databases, Cache, Messaging,
  Monitoring, DevOps, Containers, Networking, Security, Storage, Servers,
  Client/Frontend, Frontend Frameworks, Backend Frameworks, Logging,
  AI/ML, AI Providers & Agents, Cloud Providers, Basic Shapes,
  Layers & Roles, Design Patterns, State Machines, Misc).
- Categories sorted A→Z; components inside each category sorted A→Z.
- Search box filters across all categories by name/tag/description, with
  live highlighting and auto-expanding matched categories.
- Drag-and-drop (pointer-based, works with mouse & touch) from sidebar to
  canvas creates a node. Predefined sub-components (if any) are attached to
  the new node automatically.

#### 4.2.1 Layers & Roles
A `kind: 'layer'` item (Controller, Service, DAL, Authentication, React
Hook, Angular Guard, DDD building blocks, ~100 items total — see
`js/data/categories/layers.js`) represents a code-level building block
rather than an infrastructure component. Unlike other items:
- Dropping one **onto an existing node** attaches it as a sub-component of
  that node instead of creating a separate node (a green dashed outline
  previews the attach target while dragging).
- Clicking one while exactly one node is selected attaches it to that
  node the same way; otherwise (or when dropped on empty canvas) it's
  placed as a normal standalone node.
- The details panel's "Add sub-component" name field also autocompletes
  against this same library and auto-fills the matching icon — see 4.6.
- **Design decision**: this is one flat, richly-tagged, searchable
  category rather than a duplicate list nested under every top-level
  category. A layer like "Controller" or "Auth" is equally relevant to a
  Server, a Lambda, or an AWS ECS task, so one findable list (search +
  `tags` like `backend`/`frontend`/`ddd`/`security`) scales better than
  ~20 near-identical copies. Extending it is one line in `layers.js`.

#### 4.2.2 Design Patterns
A `kind: 'pattern'` item (MVC, Repository, CQRS, API Gateway, Circuit
Breaker, Saga, Hexagonal Architecture, a few classic GoF patterns like
Singleton/Observer/Strategy/Adapter/Decorator, and a set of high-
availability/replication blueprints — Active-Active Replication,
Active-Passive Replication (Primary-Standby), Multi-AZ Deployment, Read
Replica, Multi-Region Active-Active — ~29 total, see
`js/data/categories/design-patterns.js`) is not a single placeable
component. Dropping or clicking one instantiates a whole small cluster of
real nodes (each reusing an existing component/layer definition, so
styling stays consistent for free) plus the connectors between them, laid
out relative to the drop point and selected together afterwards so they
can be immediately restyled or moved as a group.

#### 4.2.3 AI Providers & Agents
A normal (`kind: 'component'`) category covering the generative-AI world:
model providers (OpenAI, Anthropic, Google, AWS Bedrock, Azure OpenAI,
Mistral, Cohere, Hugging Face, Ollama, ...), specific model families (GPT,
Claude, Gemini, Llama, Whisper, DALL·E, ...), the Model Context Protocol
(MCP Server/Client/Tool/Resource/Prompt), agents and agent frameworks
(LangGraph, AutoGen, CrewAI, Semantic Kernel, LlamaIndex, agent
memory/planner/orchestrator), and the skills/tools/RAG building blocks
around them (Skill, Skill Library, System Prompt, Prompt Template, RAG
Pipeline, Knowledge Base, Guardrails, Fine-Tuning Job, Function/Tool
Calling — ~57 items, see `js/data/categories/ai-providers-agents.js`).
Complements the existing **AI / ML** category, which stays focused on
general ML *infrastructure* (training pipelines, feature stores, vector
DBs, MLflow, ...) rather than duplicating it.

#### 4.2.4 State Machines
A category mixing normal (`kind: 'component'`) state shapes — Initial State,
State, Choice/Decision, Final State, Fork/Join, History State, Composite
State (see `js/data/categories/state-machines.js`) — with `kind: 'pattern'`
ready-made templates (Traffic Light, Order Lifecycle, TCP Connection,
Media Player, Approval Workflow, Auth Session). No new engine concepts were
needed: a state is just a node, and a transition's condition/event is just
a normal edge's existing `label` field — so state-machine content mixes
freely with the rest of a diagram (a state can connect to/from any other
component with a regular connector) and, symmetrically, a diagram that
never touches this category is completely unaffected by it. Can be hidden
from the sidebar entirely — see 4.2.6.

#### 4.2.5 Global default component settings
A "🎛️ Default settings" toolbar button opens a modal for defaults applied
when a component is **created**, always overridable per component
afterwards via the toolbar style editor / details panel:
- **No background color** — new components get a transparent fill instead
  of their category's tinted color (border/icon/text still show).
- **Show icon** — off hides every new component's icon.
- **Text position** — where the label renders: `Center`/`Top`/`Bottom`
  (inside the shape) or `Above`/`Below` (floating outside it, e.g. for a
  minimalist icon-only look with a caption).
- **Sub-components display** — `Compact chips` (default, small pills,
  truncated after 4) or `Full list` (every sub-component on its own row,
  untruncated) — also settable per node from its details panel next to the
  sub-components list, since it's really about *that* list's own display.
- **"Apply to all existing components now"** — besides saving the defaults
  for future components, explicitly bulk-updates every component already
  on the canvas to match (one undo step) — a deliberate, visible action
  rather than a silent retroactive global override, so "what changed" is
  always predictable, and per-component customization after that remains
  a normal single-node edit.

#### 4.2.6 Hiding a component category from the sidebar
The same "🎛️" settings modal has a "Component library" section with a
"Hide 'State Machines' components & templates" checkbox, for anyone who
doesn't want that category cluttering search/browse. It only filters the
sidebar/search — a diagram that already has state-machine components on
its canvas is completely unaffected, and toggling it back on doesn't lose
anything.

#### 4.2.7 Saving a selection as a custom component
Beyond building one custom component from scratch (4.5), any current
selection of **2 or more components** (plus whichever connectors run
between them) can be saved as one reusable "My Components" item via the
contextual toolbar's "⭐" button — with or without grouping them first
(4.3.1's Group is unrelated; this works on any selection). Unlike a
hand-authored Design Pattern (4.2.2), which is a blueprint referencing
existing component definitions, a saved selection captures each node's
*exact* current styling (fill, stroke, size, sub-components, text
position, etc. — a full per-node snapshot, `kind: 'pattern'` under the
hood with a style-override channel design patterns don't need) so
dropping it again reproduces precisely what was selected, not just its
shape. Placing it back down instantiates every node + connector at once,
re-grouped together as a single movable unit. A selection of exactly one
component (no connectors) instead opens the richer, editable "New
Component" form (4.5) so its fields stay tweakable before saving.

#### 4.2.8 Smart Suggestions
Placing a component with a curated list of well-known real-world companions
(e.g. a Load Balancer → a web server; Apache Kafka → Elasticsearch; an API
Gateway → Lambda) shows a small dismissible banner offering one-click
"+ Add X" buttons for each one, positioned next to the component just
placed. Suggestions already present on the canvas are never re-offered,
and a component with no curated companions shows no banner at all. The
mapping is hand-curated (`related` on each `c(...)` definition — see
`js/data/schema.js` and the `add-library-item` skill's "Smart Suggestions"
section for the bar a pairing needs to clear) rather than automatic or
heuristic, deliberately sparse and grown incrementally rather than
covering the whole library at once. Can be turned off entirely from
"🎛️ Default settings" → "Component library" (4.2.5) for anyone who
doesn't want it.

### 4.3 Canvas node interactions
- Drag to move, resize via handles, rotate not required.
- Delete via `Delete`/`Backspace`, right-click menu, or toolbar button —
  **always cascades to every connector attached to the deleted
  component(s)**, so a diagram never ends up with an arrow dangling from
  nothing (`core/project.js#removeNode`; see also 4.4).
- Right-click context menu: Edit style, Duplicate, Bring to front / send to
  back, Add note, Delete, Open details.
- Small on-node button opens full edit (style) and an "ⓘ" button opens the
  details side panel.
- A visible badge appears on any node that has notes, labels, or
  sub-components ("has extra info" indicator).
- Multi-select (marquee / shift-click) + group move + group delete.

#### 4.3.1 Selecting, editing, duplicating and deleting components + connectors together
- **Combined selection**: marquee-selecting a cluster picks up every
  connector whose both ends land inside the box, alongside the components —
  not just components. Shift-click extends a selection across both types
  too (e.g. shift-click a connector after selecting some components keeps
  both).
- **Edit together**: with a mixed selection, the toolbar's contextual row
  shows the component style editor *and* the connector style editor at the
  same time, instead of picking one — so restyling a component cluster and
  its connectors is one pass, not several.
- **Collapse / close the contextual row**: its header (what's selected, a
  ›/‹ toggle, and a ✕ button) is always shown while something is selected.
  › collapses the row to just that slim header strip — freeing up canvas
  space (most useful on mobile, where the full field grid can otherwise
  fill most of the screen) while keeping the selection intact, so editing
  can resume right where it left off; ‹ expands it back. ✕ deselects
  outright, an explicit "done editing" action alongside clicking empty
  canvas or pressing Escape. Opening a new selection always starts
  expanded, regardless of how the previous one was left.
- **Duplicate together** (⧉ / Ctrl+D) and **delete together** (🗑️ / Delete)
  both act on the whole current selection — components, connectors, or a
  mix — in one step/undo entry.
- **Group / Ungroup**: with 2+ components selected, the 🔗 "Group" button
  ties them together — clicking (or dragging) any one member afterwards
  selects/moves the whole group as a unit. The ✂️ "Ungroup" button (shown
  whenever the selection includes a grouped component) releases them back
  to independent components. Duplicating a grouped selection gives the
  copies their own new group, independent of the original.

#### 4.3.2 Navigation tools
- **Select tool** (default) and **Hand tool** are a mutually-exclusive
  toolbar toggle (`js/canvas/toolMode.js`). Select is today's normal
  behavior: click/drag a component to move it, drag empty canvas to
  marquee-select. Hand makes *any* drag — including one starting on top of
  a component — pan the canvas instead, without moving or altering
  anything; it's the safe way to navigate a dense diagram.
- Keyboard: `H` switches to Hand, `V` switches to Select, and holding
  **Space** temporarily pans no matter which tool is active (Figma-style),
  reverting to whichever was active the moment it's released.
- Zoom in / out / reset-to-100% / fit-to-screen (toolbar buttons, Ctrl/Cmd
  + "+"/"-"/"0", and Ctrl/Cmd+scroll) round out navigation — see 4.5.

### 4.4 Arrows / connectors
- Draw by dragging from a node's connection point to another node. Both
  ends must land on a component (no free-floating endpoints in v1 — see
  `PLAN.md` for that as a possible v2 idea).
- Style: color, thickness, dash pattern, routing (straight, orthogonal
  /elbow, curved/bezier, or **magic** — see 4.4.1), label text.
- Arrow-head per end independently: none, open, filled triangle, diamond,
  circle — and direction: source→target, target→source, bidirectional,
  none.
- Endpoints stay attached to nodes and re-route live when nodes move
  ("dynamic reshaping") — magic-routed connectors too, since their route is
  recomputed fresh from current node positions on every render rather than
  stored, so it never goes stale.
- Deleting either endpoint component deletes the connector too (see 4.3).

#### 4.4.1 Magic Arrow
The toolbar's "🪄" button arms Magic Arrow mode for the *next* connector
you draw: drag from a component's connection point to another component as
usual, and the resulting connector automatically routes itself around
every other component in the way — an orthogonal path computed to avoid
overlapping any other node, using as few bends as possible
(`js/core/magicRouter.js`, a grid-based least-turns search). If no clear
route can be found (e.g. the target is fully boxed in), it falls back to a
plain elbow connector rather than failing silently. Any existing
connector can also be switched to (or off) magic routing afterward from
its style editor's Routing dropdown — it isn't a one-time creation-only
choice.

### 4.5 Toolbar
- **Layout**: the always-visible row keeps only controls used continuously
  or needed at a moment's notice while actively working — undo/redo, the
  Select/Hand navigation-tool toggle (4.3.2), zoom, "🔷 Add Shape", and "🪄
  Magic Arrow" — plus four dropdown menus (**File**, **Create**, **Tools**,
  **Help**) that group every occasional/setup action, so the row stays
  short and findable instead of growing unbounded as features are added.
  Every button, flat or inside a dropdown, has a clear descriptive tooltip
  (its only affordance beyond an icon — there's no custom tooltip system).
  A dropdown's panel is positioned in viewport-clamped screen coordinates
  (not CSS relative-to-trigger), so it always renders fully on-screen
  regardless of where its trigger ends up, including on a narrow/mobile
  viewport where the toolbar wraps onto several rows.
- Style controls for current selection: fill color, "no background"
  toggle, border color, border width/style, shape, text, font size, text
  align, text position, show-icon toggle, corner radius.
- Arrow style controls (see 4.4) shown when an edge is selected.
- **Add Shape** (flat): instant basic shapes as custom components
  (rectangle, rounded rectangle, circle/ellipse, diamond, hexagon,
  cylinder, cloud, "server with rows", sticky note, group container).
- **Magic Arrow** (flat, see 4.4.1): arms auto-routing for the next
  connector drawn.
- **File**: New diagram, Save (autosave to localStorage) / Save As (named
  project), Load (from localStorage list or a JSON file), Duplicate
  Project (see 4.7.4), Export/Import JSON, Export PNG, Export PDF, Backup
  & Restore.
- **Create**: "New component" modal — build a custom styled component from
  the current selection (or from scratch) and save it into "My Components"
  (persisted in localStorage; exportable/importable as JSON); Generate
  Design; Replicate; Default settings for new components.
- **Tools**: grid toggle, AI Design Review.
- **Help**: the interactive guide (`help.html`), a "hints" toggle, "Show
  hints again", and "🆕 What's new" (see 4.11).
- Zoom controls (in/out/reset/fit-to-screen) stay flat; also reachable via
  Ctrl/Cmd + "+"/"-"/"0" and Ctrl/Cmd+scroll.
- Contextual row (shown only while something is selected): Group / Ungroup
  for multi-component selections (see 4.3.1), "⭐ Save as Component" for
  any selection (see 4.2.7), Duplicate, Delete.

### 4.6 Node details panel
- Opens on demand (ⓘ button / double-click). Shows: name, icon/color
  summary, free-text notes, labels (tag chips), and an editable list of
  sub-components (name + icon, add/remove/reorder, plus a "compact chips
  vs full list" display-mode control — see 4.2.5). For "server with rows"
  nodes, this is also where rows are managed.
- **Collapse / expand**: a chevron button in the panel header shrinks it to
  a slim clickable strip (content hidden, selection/edits untouched) —
  distinct from the **✕ close** button, which fully closes it and clears
  the details context. Opening a different component's details always
  starts expanded.

### 4.7 Persistence
- Autosave current project to `localStorage` on every change (debounced).
- Manual Save / Save As keeps a named list of projects in `localStorage`.
- Export/Import full project as a `.json` file.
- "My Components" custom library persisted separately in `localStorage`,
  exportable/importable as its own `.json` file so it can be shared between
  browsers/machines.

#### 4.7.1 Saved-project favorites
Each saved project (in the "Load" modal) has a ⭐ toggle button. Favorited
projects sort first in the list, and a "Favorites only" checkbox filters
the list down to just them. Favorite status is preserved across re-saves
(re-running "Save As" on an already-favorited project keeps its star).

#### 4.7.2 "My Components" folders
Any custom component can be filed into an optional free-text **folder**
(set in the New/Edit Component modal, with autocomplete against existing
folder names). The sidebar's "My Components" category groups components
with a folder into collapsible sub-groups (📁); components with no folder
list directly under the category, unchanged from before.

#### 4.7.3 Bulk export/import & full backup
Three export/import scopes, each downloadable/uploadable as its own
`.json` file:
- **My Components** (all custom components together) — quick 📤/📥 icons on
  the sidebar's "My Components" category header, or from "Backup & Restore".
- **Saved projects** (every named project together, favorites included) —
  "Export all… / Import all…" in the Load modal, or from "Backup & Restore".
- **Full backup** — everything at once: the live canvas, global default
  settings, the whole My Components library and every saved project, via
  the toolbar's "🗄️ Backup & Restore" modal. Restoring a full backup
  replaces the current canvas and default settings (after a confirmation
  dialog, since this can't be undone) and merges its components/projects
  into the existing libraries using the same collision rule as above.

**Collision handling** (applies to every import above, and to the
single-project "Load from JSON file" and single-library "Import My
Components" flows too): an item whose `id` matches an existing one
**overwrites** that existing record; an item with a *different* `id` but a
name that collides with an existing name is imported as a new, separate
record with its name suffixed (`"Name (imported)"`, then
`"Name (imported 2)"`, ...) so nothing is silently dropped or merged by
name alone.

#### 4.7.4 Duplicate Project
Two distinct ways to duplicate a diagram's canvas content, both id-safe
(every node/edge/sub-component/group gets a fresh id, so the copy never
collides with the original):
- **Duplicate Project** (📄 toolbar button, or canvas right-click →
  "Duplicate as new project") — clones the whole project under a new id
  and name (`"<name> (Copy)"`) and switches the active canvas to editing
  the copy. The original is completely untouched (still autosaved/saved
  under its own id) — this is a "make a copy and keep working on the
  copy" action, the same shape as "Make a copy" in most document editors.
- **Duplicate entire canvas** (canvas right-click) — copies every
  component and connector currently on the canvas, offset in place,
  *within the same project* — the diagram, doubled. Internally this is
  "select all, then Duplicate" (see 4.3.1) done in one click.

### 4.8 Export
- PNG: rasterize the current canvas (or just the diagram bounds) to an
  image download.
- PDF: same content laid out on a PDF page (auto-orientation based on
  diagram aspect ratio).

### 4.9 Hints
- Short contextual hint bubbles near key UI (sidebar, canvas, toolbar).
  Each has a unique id; "Got it" dismisses it permanently
  (`localStorage`). A "💡 Show hints again" action in the toolbar restarts
  the whole tour (clears every dismissed id).
- A separate "🔔/🔕" toolbar toggle turns hint bubbles on/off without
  affecting which ones have been dismissed — off just hides whatever would
  otherwise show (including mid-tour); turning back on resumes exactly
  where the tour left off. Restarting the tour also turns this switch back
  on, so it can't silently look broken if it was off. See `js/hints/hints.js`
  (`areHintsEnabled`/`setHintsEnabled`).

### 4.10 Responsiveness
- Desktop: full 3-pane layout.
- Mobile/tablet (≤900px): sidebar, details panel and AI review panel
  become slide-over drawers toggled by buttons, positioned with
  `position: absolute` inside `.app-body` (which already starts right
  below the toolbar in normal flow) rather than a fixed pixel offset —
  the toolbar's own height varies once it wraps onto multiple rows
  (routine well before 900px as more toolbar buttons accumulate), so a
  fixed offset would land a drawer partway through the toolbar instead of
  below it. A `.toolbar-group` with several full-text buttons also wraps
  its own buttons onto additional lines at this width rather than forcing
  the page into horizontal scroll. Touch drag works via pointer events.
  See `css/responsive.css` and `tests/e2e/mobile-responsive.spec.js`.

### 4.11 Versioning & "What's New"
`js/version.js` holds `APP_VERSION` and a `VERSION_HISTORY` list of
per-version highlights — bumped with every user-facing fix or feature (see
`docs/CHANGELOG.md`, which stays the detailed record; `version.js` is the
short, in-app-facing summary). On boot, a returning visitor whose
last-seen version (tracked in `localStorage`) differs from the current one
sees a "What's New" modal listing everything newer than what they last
saw, once; a brand-new visitor (nothing in storage at all yet) doesn't —
the hints tour already covers onboarding. Reachable any time afterward via
the toolbar's "🆕" button too (`js/io/whatsNew.js`,
`js/modals/whatsNewModal.js`).

### 4.12 AI Design Review
A "🤖 AI Design Review" toolbar button opens a right-hand side panel that
prepares everything needed to get a system-design review from a
mainstream LLM — **without any API key or configuration**. This is a
deliberate, transparent design choice, not a shortcut:

- **Why not a live API integration?** Every mainstream LLM provider
  (Claude, OpenAI, Gemini, Copilot) requires an API key for programmatic
  access — there's no anonymous/key-free API, for any of them. That's a
  constraint of the providers themselves, not something a client-only app
  can route around.
- **Why not scrape Google's embedded AI search results?** It isn't a
  public API, it's blocked by CORS from a third-party page, and scraping
  it would violate Google's Terms of Service — none of which changes by
  wrapping it in a nicer UI.
- **What it actually does instead**: the panel builds an editable review
  prompt (what the diagram contains, plus — optionally — the text of an
  attached plain-text/Markdown spec file to compare against), lets you
  download the diagram as a PNG (or copy it to the clipboard as an image,
  where supported), and one click per provider (Claude / ChatGPT / Gemini
  / Copilot) copies the prompt and opens that provider's own chat website
  in a new tab — using the account you're already signed into there, so
  no key ever touches this app. You then attach/paste the image and send
  the prompt yourself.
- **Getting the answer back**: there is no automatic round trip (that
  would hit the exact same key/CORS wall) — you paste the AI's reply into
  a text box in the panel, where it's kept (session-only, not persisted
  across a reload) with copy/remove actions, so you have it alongside the
  project while you work.
- Opening a genuinely different project (New / Load / Duplicate / restore
  a backup) while the panel is open resets its scratch state (attached
  spec, prompt edits, saved replies) — a review prepared for one project
  shouldn't silently look like it belongs to another.

See `js/io/aiReview.js` (prompt builder, provider list) and
`js/panel/aiReviewPanel.js` (the panel itself).

### 4.13 Generate Design from Spec
A "🧠 Generate Design" toolbar button opens a 3-step modal wizard that
runs 4.12's mechanism in reverse: instead of reviewing an existing
diagram, it proposes a brand-new one from a requirements spec. Same
"prepare and hand off, no API key" reasoning applies — nothing here
changes that.

- **Step 1 — Your spec**: paste spec text directly, or load it from a
  `.txt`/`.md` file (loading a file overwrites the textarea rather than
  appending, to avoid an ambiguous mixed state).
- **Step 2 — Copy this prompt to your AI**: an editable prompt that
  embeds the spec text plus a complete, valid few-shot JSON example
  anchored to this app's own project schema (node shapes, edge routing
  values, the exact field names `validateProject` expects) — so a
  compliant AI reply can be pasted straight back in. "📋 Copy prompt"
  copies it manually; the same provider grid as 4.12 (Claude / ChatGPT /
  Gemini / Copilot) copies the prompt and opens that provider's site in
  one click.
- **Step 3 — Paste the AI's result**: paste the AI's whole reply (prose
  and all — the JSON is extracted automatically: a direct parse first,
  then a fenced ```json block, then a first-`{`-to-last-`}` fallback).
  The extracted object goes through the same `validateProject()` used by
  every other import path, so malformed or partial output degrades
  gracefully instead of crashing; if the AI ignored the layout
  instructions and stacked components on top of each other, a safety net
  re-arranges them on a simple grid rather than leaving an unusable pile.
  A failed paste shows an inline error and keeps your text in place for a
  retry, without losing it.
- If the canvas already has content, generating asks for confirmation
  before replacing it (skipped on an empty canvas, matching the rest of
  the app's "don't gate trivial actions" convention); undo (Ctrl/Cmd+Z)
  brings back what was replaced.

See `js/io/aiGenerateDesign.js` (prompt builder, JSON extraction,
auto-layout safety net) and `js/modals/generateDesignModal.js` (the
wizard itself).

### 4.14 Live Replication
A "🔁 Replicate" toolbar button links a selection of components to a
second, auto-generated "side" and keeps the two continuously mirrored —
distinct from the static Design Patterns in 4.2.2 (which drop a one-time
labeled blueprint): this one is a live, ongoing relationship between two
groups of components.

- **Creating a pair**: select one or more components and click
  "🔁 Replicate". Choose a mode (Active-Active / Active-Passive
  (Primary-Standby) / Primary-Replica — a descriptive label only, every
  mode uses the same mirroring mechanism) and confirm. The selection
  becomes "side A"; an exact copy is created as "side B", placed to the
  right of side A's bounding box. Both sides share the same group-select
  behavior as any other component group (clicking one member selects the
  whole side).
- **Staying in sync, automatically**: from then on, adding a component to
  either side (join it via "🔁 Replicate" → "Add to an existing pair") — or
  a component already sitting in that side's group, e.g. right after a
  JSON import — gets a mirror created on the other side on the very next
  change. Moving, resizing, restyling, renaming or editing a mirrored
  component's sub-components/notes/labels propagates the same change to
  its peer, in either direction (whichever side actually changed drives
  the update). Deleting a mirrored component deletes its peer too, so the
  two sides can never silently drift into a stale, half-deleted state.
- **Excluding a component**: any single component can be marked "Exclude
  from replication mirroring" from its details panel (shown whenever it's
  currently part of an active pair) — it keeps its content as-is and stops
  syncing, without affecting the rest of its side. If it already had a
  peer, that peer is also frozen at its last-synced state rather than
  deleted, and re-clearing the exclude flag later creates a fresh mirror
  (not a restoration of the old one).
- **Breaking a pair**: from the "🔁 Replicate" modal's "All replication
  pairs" list — both sides are left exactly as they are, just no longer
  kept in sync going forward.
- **Freezing / resuming**: each pair also has a ❄️ Freeze / ▶️ Resume
  toggle (same "All replication pairs" list). While frozen, the pair is
  completely inert — neither side propagates to the other, and adding a
  component to either side does not get mirrored. This is the way to make
  changes deliberately local to one side (e.g. testing something on just
  the standby) without breaking the pair outright. Resuming does not
  retroactively reconcile whatever changed while frozen; it only resumes
  live syncing for changes made from then on. Joining a frozen pair (via
  "Add to an existing pair") is disabled in the UI, since a component
  added while frozen wouldn't visibly get a mirror until resumed anyway.
- A component that's part of an active, unfrozen pair (and not excluded)
  shows a small 🔁 badge on the canvas; a frozen pair's members show ❄️
  instead.

See `js/core/replication.js` (the pure sync engine — `syncReplication()`
runs inside `core/store.js#dispatch()`/`loadProject()` so every mutation
path gets mirroring for free) and `js/modals/replicationModal.js` (the
create/join/break UI).

## 5. Non-functional requirements

- **Security**: no `eval`/`innerHTML` with unsanitized input, no inline
  event handler attributes from data, JSON parsing wrapped in try/catch
  with schema validation before it touches state, file imports validated
  before merge, CDN scripts pinned to a specific version.
- **Performance**: event delegation over per-node listeners where possible,
  debounced autosave/persist, requestAnimationFrame-batched drag updates,
  virtual-friendly sidebar list (filter, not re-render everything from
  scratch when unnecessary).
- **Accessibility/UX**: keyboard shortcuts (Ctrl/Cmd+Z / Shift+Z, Delete,
  Ctrl/Cmd+S, Ctrl/Cmd+D duplicate, Ctrl/Cmd + "+"/"-"/"0" zoom in/out/reset),
  focus outlines, color-contrast aware default palette, tooltips on
  icon-only buttons.
- **Maintainability**: small single-purpose ES modules, no framework, no
  global mutable state outside `core/store.js`, one central pub/sub store,
  component data is pure data (no logic) so the library is trivial to
  extend.

## 6. Data model (JSON project format v1)

```jsonc
{
  "formatVersion": 1,
  "id": "proj_...",
  "name": "My Architecture",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [
    {
      "id": "node_...",
      "defId": "aws-ec2",
      "x": 100, "y": 80, "w": 160, "h": 90,
      "shape": "rounded",
      "fill": "#FFF7ED", "stroke": "#FF9900", "strokeWidth": 2,
      "text": "API Server", "fontSize": 14, "textAlign": "center",
      "icon": "🖥️",
      "notes": "", "labels": ["prod"],
      "subComponents": [{ "id": "sc_1", "name": "Auth", "icon": "🔐" }],
      "rows": [],
      "zIndex": 3,
      "groupId": null,
      "replicationExcluded": false
    }
  ],
  "edges": [
    {
      "id": "edge_...",
      "from": "node_a", "to": "node_b",
      "fromSide": "right", "toSide": "left",
      "routing": "orthogonal",
      "color": "#334155", "width": 2, "dash": "solid",
      "startArrow": "none", "endArrow": "filled",
      "label": "HTTPS"
    }
  ],
  "replicationPairs": [
    {
      "id": "repl_...",
      "mode": "active-active",
      "groupA": "group_...", "groupB": "group_...",
      "offsetX": 280, "offsetY": 0,
      "members": [{ "a": "node_a", "b": "node_b" }]
    }
  ]
}
```

`routing` is one of `straight` / `orthogonal` / `curved` / `magic` (see
4.4.1) — a magic-routed edge's actual path is never stored (it's
recomputed live from current node positions), so no extra field is needed
for it. `groupId` (default `null`) ties 2+ nodes into a Group/Ungroup unit
— see 4.3.1. `replicationExcluded` (default `false`) and
`replicationPairs` (default `[]`) drive Live Replication — see 4.14;
`mode` is one of `active-active` / `active-passive` / `primary-replica`,
purely descriptive, and `members` maps each side-A node id to its side-B
mirror's id.

## 7. Out of scope for v1 (ideas for later, see PLAN.md §7)

Real-time multi-user collaboration, versioned history beyond in-session
undo/redo, cloud sync, PNG→SVG re-import, AI-assisted auto-layout.
