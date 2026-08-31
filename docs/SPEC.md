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
- "★ Popular only" toggle narrows the built-in categories to just their
  `popular: true` components (see 4.2 below for the flag itself) —
  Favorites and My Components are unaffected, since `popular` is a
  curated library attribute neither of those sections carries.
- Drag-and-drop (pointer-based, works with mouse & touch) from sidebar to
  canvas creates a node. Predefined sub-components (if any) are attached to
  the new node automatically.
- A pinned **"Recently Used"** section (above the category list, below
  Favorites) shows the last 8 components actually placed on the canvas
  (drag or click-to-add alike), most recent first, deduplicated — placing
  an already-recent one again just moves it back to the front rather than
  showing it twice. `localStorage`-backed (`js/io/recentComponents.js`),
  same listener-notified shape as Favorites/My Components.

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
A `kind: 'pattern'` item (MVC, MVVM, Layered Architecture, Repository,
CQRS, API Gateway, Publish-Subscribe, Event Sourcing, Saga, Sidecar,
Strangler Fig, Backend for Frontend, Hexagonal Architecture, Service
Discovery, Cache-Aside, a set of high-availability/replication blueprints
— Active-Active Replication, Active-Passive Replication (Primary-Standby),
Multi-AZ Deployment, Read Replica, Multi-Region Active-Active — several
higher-complexity, realistic multi-node scenarios — Change Data Capture
(CDC) Pipeline, Database Sharding, Resilience Stack (Rate Limiter +
Circuit Breaker), Leader Election — plus 2 entity-relationship (ER)
diagram templates (a realistic multi-entity E-Commerce Order Schema, and a
Self-Referencing Relationship, each using the existing "rows" component
shape for primary/foreign-key attribute lists) — ~26 total, see
`js/data/categories/design-patterns.js`) is not a single placeable
component. Dropping or clicking one instantiates a whole small cluster of
real nodes (each reusing an existing component/layer definition, so
styling stays consistent for free) plus the connectors between them, laid
out relative to the drop point and selected together afterwards so they
can be immediately restyled or moved as a group. This category favors a
smaller set of complex, realistic, high-value diagrams over many
minimal/textbook examples — see `docs/CHANGELOG.md`'s entry for the batch
that curated it down from ~32 generic entries for the reasoning.

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
ready-made templates: Auth Session (with MFA, token refresh and lockout),
Background Job Processing (retry-with-backoff and dead-lettering), Circuit
Breaker, Order Lifecycle (with returns/refunds), Payment Processing
(authorize/capture/dispute), and TCP Connection — each a richer, realistic
multi-branch state machine rather than a minimal textbook example. No new
engine concepts were
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

The same modal also has a "Style editor" section with a **display mode**
selector (`floating` / `pinned-top` / `pinned-bottom`) that picks the
default for the toolbar's contextual style-editor row — see 4.3.1.

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
doesn't want it. Accepting a companion suggestion also **creates the
connecting edge** between the two components (anchored via 4.4's smart
side-picking) and **places the new node with anti-overlap placement**
(`canvas.js#addRelatedComponent`, reusing the same `findClearCenter` helper
node-creation already uses) rather than dropping it unconnected at a blind
fixed offset.

The same banner can also suggest **sub-components** to attach directly onto
the node just placed (e.g. Express suggests a Controller/Middleware layer;
React suggests a Hook/Component; API Gateway suggests Authentication/Rate
Limiter), shown as a second, visually distinct row ("↳", dashed green
border matching the drag-a-layer-onto-a-node preview style) below the
companion-component row when both apply. Curated the same way via a
`relatedLayers` field (ids of `kind: 'layer'` components — see 4.2.1).
Clicking one attaches it exactly like dragging that item from "Layers &
Roles" onto the node, instead of creating a new standalone node, and an
already-attached sub-component is never re-suggested.

**Revisiting sub-component suggestions later** (4.6): the placement-time
banner is easy to miss or dismiss, and a node loaded from a saved project
never sees it at all in that session — so any component with unattached
`relatedLayers` suggestions shows a small 💡 badge on the node itself,
persisting for as long as any curated suggestion remains unattached.
Clicking it opens the details panel's "Suggested sub-components" section:
the same curated list, but as checkboxes — check any number and click
"Add selected" to attach them all in one step, instead of one click per
suggestion like the banner. The badge and section both disappear once
every curated suggestion for that component is attached.

#### 4.2.9 Popular component highlighting
A hand-curated subset of components — the ones most engineers would
immediately recognize as one of the most common building blocks in their
category (PostgreSQL, Docker, S3, Kafka, React, ...) — get a subtle
background tint and a small ★ badge in the sidebar, so scanning a long
category turns up a familiar landmark first. Marked via a `popular: boolean`
flag on `c(...)` (`js/data/schema.js`), same "would most engineers
immediately agree" curation bar as `related` (4.2.8) — deliberately sparse
(a handful per category), and purely visual: it never reorders or filters
the list.

#### 4.2.10 Favorites
Any component (built-in or "My Components") can be pinned to a personal
**Favorites** section shown at the very top of the sidebar, above "My
Components" — right-click it and choose "Add to Favorites" (or "Remove from
Favorites" to unpin). Distinct from the ⭐ **saved-project** favorites
described in 4.7.1 — same word, two unrelated things: this section is about
favoriting library *components*, that one is about favoriting saved
*projects* in the Load modal. Favorites can be organized into **folders**, which can
themselves nest **subfolders** to any depth, each with its own manual
ordering. From the Favorites section's "+ New folder" header button, or a
folder's "⋮" options menu (Add subfolder / Rename / Move up / Move down /
Delete), or a favorited item's own right-click menu (Move to folder / Move
up / Move down / Remove from Favorites): the full set is create, rename,
delete (cascades through subfolders, un-favoriting — never deleting — the
components filed inside any of them, with a confirmation summarizing what
will be removed), reorder, and move an item between folders. A favorited
item still drags/clicks onto the canvas exactly like its normal sidebar
entry. Favorites is personal library data, like "My Components" — persisted
separately in `localStorage` (`js/io/favorites.js`), not part of the
project file, unaffected by undo/redo or "New Project", and included in the
full-backup export/import (4.7.3).

### 4.3 Canvas node interactions
- Drag to move, resize via handles, rotate not required.
- **Double-click renames a component inline** — its label is replaced with
  a text input (Enter commits, Escape/blur cancels). Works anywhere on the
  component's face, not just precisely on the label text (icon, padding,
  and empty background all trigger it too).
- Delete via `Delete`/`Backspace`, right-click menu, or toolbar button —
  **always cascades to every connector attached to the deleted
  component(s)**, so a diagram never ends up with an arrow dangling from
  nothing (`core/project.js#removeNode`; see also 4.4).
- Right-click context menu: Open details, Duplicate, Bring to front / send to
  back, Delete.
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
- **Display mode**: the contextual row can show as a small **floating**
  card next to whatever's selected (the default — see `js/toolbar/toolbar.js`
  and 4.5), **pinned to the top** of the screen (in the toolbar's own flow,
  the original always-on-top behavior), or **pinned to the bottom**. A
  📌 button on the row's header toggles floating ↔ pinned-top; "Default
  Settings" (4.5) picks which of the three the row starts in, including the
  pinned-bottom option that button doesn't reach. Floating mode positions
  itself just below (or, if there isn't room, above) the selection, clamped
  to stay fully inside the canvas area so it never covers the toolbar,
  sidebar, or details/AI review panel, and never slides back over the
  selection itself.
- **Duplicate together** (⧉ / Ctrl+D) and **delete together** (🗑️ / Delete)
  both act on the whole current selection — components, connectors, or a
  mix — in one step/undo entry.
- **Group / Ungroup**: with 2+ components selected, the 🔗 "Group" button
  ties them together — clicking (or dragging) any one member afterwards
  selects/moves the whole group as a unit. The ✂️ "Ungroup" button (shown
  whenever the selection includes a grouped component) releases them back
  to independent components. Duplicating a grouped selection gives the
  copies their own new group, independent of the original. A group of 2+
  members shows the same dashed background boundary described in 4.14 for
  a replication side.

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
- **Auto-arrange** (Tools menu, `js/core/autoLayout.js`): rearranges every
  component on the canvas into a top-to-bottom layered layout that follows
  connector direction — a simplified Sugiyama-style layout (rank assignment
  by longest path from source nodes, single-pass barycenter ordering within
  each rank to reduce crossings, wrapping an overly-wide rank onto
  additional rows) — then re-picks every edge's anchor sides (4.4) to match
  the new positions and fits the view to the result. One undo step.
- **Scale Diagram** (Tools menu): permanently resizes every component's
  position, size, *and* font size together by a chosen percentage —
  distinct from zooming the view (which is purely visual and never touches
  the underlying data): scaling to 150% and then viewing at 100% zoom looks
  identical to viewing the original at 150% zoom, but the diagram's actual
  data changed. Centered on the diagram's own current bounding-box center
  so it stays roughly in place rather than drifting toward the canvas
  origin. Connector routing needs no adjustment (its anchor offsets are
  already resolution-independent fractions, 4.4).

### 4.4 Arrows / connectors
- Draw by dragging from a node's connection point to another node. Both
  ends must land on a component (no free-floating endpoints in v1 — see
  `PLAN.md` for that as a possible v2 idea). Which side of each component
  the connector actually anchors on is picked from the two components'
  real relative position (`core/geometry.js#pickBestSides`), not fixed to
  whichever exact connection point you happened to drag from/to — dragging
  from any point on the source still produces a geometrically sensible
  connector (e.g. exiting the bottom of a node stacked above another,
  rather than always the point that was literally grabbed).
- Where along that side the connector actually lands is likewise wherever
  it was actually grabbed/dropped (`fromOffset`/`toOffset`, 0..1 along the
  side, default 0.5 = the midpoint) rather than always the midpoint — for
  a normal small connection-point dot this comes out to the midpoint
  either way, but a tall shape (see 4.15 Sequence Diagrams) exposes a
  full-height strip so several connectors can land on the same node at
  different heights instead of stacking on one point.
- Style: color, thickness, dash pattern, routing (straight, orthogonal
  /elbow, curved/bezier, or **magic** — see 4.4.1), label text. The default
  orthogonal routing auto-avoids every other component in its path (the
  same obstacle-avoiding routing described in 4.4.1) with no extra step
  needed — magic routing remains available as an explicit per-edge choice
  for its own visual glow style.
- Arrow-head per end independently: none, open, filled triangle, diamond,
  circle — and direction: source→target, target→source, bidirectional,
  none.
- Endpoints stay attached to nodes and re-route live when nodes move
  ("dynamic reshaping") — magic-routed connectors too, since their route is
  recomputed fresh from current node positions on every render rather than
  stored, so it never goes stale.
- Deleting either endpoint component deletes the connector too (see 4.3).
- Right-click a connector for its own context menu: Open details,
  Duplicate, Delete. Selecting it (click, or right-click) shows the same
  style editor as a component in the toolbar's contextual row (4.5), just
  for arrow properties instead. "Open details" opens the right-side
  details panel (4.6) for this connector specifically — its label plus a
  free-form notes field (new; a connector previously had nowhere to note
  extra context), and — when both endpoints are sequence-diagram lifelines
  (4.15) — its auto-computed message order.
- A label's position along the connector's own path is a separate choice
  from the label text itself — "Label position" in the style editor (Start
  / Middle / End, default Middle) — useful for keeping several labels on
  crowded or overlapping connectors legible, or (in a sequence diagram) for
  reading a message's label right where the call actually starts.
- A connector's free-form notes (the field above) also shows as a native
  hover tooltip on the connector itself, not just inside the details
  panel — a quick way to leave/read extra context on a connector/message
  without opening anything.
- **Reconnecting an existing connector**: once selected, two small round
  handles appear at its exact start/end points — drag either one to a
  different component (or, on a sequence-diagram lifeline, a different
  height on the very same lifeline) to move just that end, live, without
  deleting and redrawing the whole connector. Dropping on empty canvas
  cancels the reconnect and leaves the connector exactly as it was; the
  *other* end's side/height is never touched by dragging one handle.

#### 4.4.1 Magic (auto-avoid) routing
Every freshly-drawn connector already routes itself around every other
component in the way by default — an orthogonal path computed to avoid
overlapping any other node, using as few bends as possible
(`js/core/magicRouter.js`, a grid-based least-turns search). If no clear
route can be found (e.g. the target is fully boxed in), it falls back to a
plain elbow connector rather than failing silently. Any connector can also
be explicitly switched to (or off) the **magic** routing style from its
style editor's Routing dropdown, which computes the exact same
obstacle-avoiding path but adds a distinct visual glow — a purely cosmetic
choice, since the underlying path-finding is identical to the default. (An
earlier version required arming a "🪄 Magic Arrow" toolbar toggle before
drawing to get this behavior at all; that toggle was removed once the
default routing started doing the same thing unconditionally.)

### 4.5 Toolbar
- **Layout**: the always-visible row keeps only controls used continuously
  or needed at a moment's notice while actively working — undo/redo, the
  Select/Hand navigation-tool toggle (4.3.2), zoom, and "🔷 Add Shape" —
  plus four dropdown menus (**File**, **Create**, **Tools**, **Help**) that
  group every occasional/setup action, so the row stays short and findable
  instead of growing unbounded as features are added.
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
- **"🔎 Find on canvas"** (flat, always visible): searches components and
  connectors already placed on the canvas by name/label — distinct from the
  sidebar's search (4.2), which searches the component *library* to add
  something new. Selects and centers the view (without changing zoom) on the
  first match as you type; Enter/Shift+Enter cycle forward/backward through
  the rest, wrapping, with an "N/M" or "No matches" indicator.
- Contextual row (shown only while something is selected): Group / Ungroup
  for multi-component selections (see 4.3.1), "⭐ Save as Component" for
  any selection (see 4.2.7), Duplicate, Delete.

### 4.6 Node details panel
- Opens on demand (ⓘ button, the node's 💡 suggestion badge when it has
  one — see 4.2.8, or pressing Enter with a node focused — not
  double-click, which instead renames the node inline; see 4.3). Shows:
  name, icon/color summary, free-text notes, labels (tag chips), and an
  editable list of sub-components (name + icon, add/remove/reorder, plus a
  "compact chips vs full list" display-mode control — see 4.2.5). For
  "server with rows" nodes, this is also where rows are managed. If any
  curated `relatedLayers` suggestions remain unattached for this
  component, a "💡 Suggested sub-components" section follows with a
  checkbox per suggestion and an "Add selected" button — see 4.2.8.
- **Collapse / expand**: a chevron button in the panel header shrinks it to
  a slim clickable strip (content hidden, selection/edits untouched) —
  distinct from the **✕ close** button, which fully closes it and clears
  the details context. Opening a different component's details always
  starts expanded.
- **Resizable**: drag the panel's left edge to widen or narrow it (260–640px);
  the chosen width is remembered across reloads.
- **Tracks canvas selection**: while open, selecting a different single
  component switches the panel straight to it, and selecting a single
  connector switches it to that connector's own details variant (see
  below); deselecting (clicking empty canvas, Escape) or selecting a
  multi-selection closes the panel rather than leaving it open on stale
  content.
- **Connector (message) variant**: right-click a connector → "Open
  details" (4.4) opens the same right-side panel showing the connector's
  label and a free-text notes field instead of a component's fields — see
  4.4 and, for a sequence diagram specifically, 4.15.

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
  settings, the whole My Components library, every saved project, and the
  component Favorites library (folders + entries, 4.2.10) — via the
  toolbar's "🗄️ Backup & Restore" modal. Restoring a full backup replaces
  the current canvas and default settings (after a confirmation dialog,
  since this can't be undone) and merges its components/projects/favorites
  into the existing libraries (favorites merge additively by id, same
  reasoning as My Components — see `io/favorites.js#importFavoritesBundle`).

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

#### 4.7.5 Clear Canvas
Canvas right-click → "🧹 Clear canvas" deletes every component, connector
and replication pair, after a confirmation dialog (skipped entirely if the
canvas is already empty). Distinct from "🆕 New" (File menu, 4.5 above):
Clear Canvas empties the *current* project in place (same id/name — a
later Save/autosave still writes to the same slot), while New switches to
a brand-new, separate project. Ctrl/Cmd+Z immediately after undoes it,
bringing everything back exactly as it was — this genuinely works (unlike
if it were implemented as "load an empty project", which would reset undo
history instead of adding to it).

### 4.8 Export
- PNG: rasterize the current canvas (or just the diagram bounds) to an
  image download. "Diagram bounds" accounts for connector routing and
  above/below labels that extend past every component's own box, not just
  node positions/sizes, and the export scale downshifts automatically for
  an extremely large diagram rather than silently cropping it.
- PDF: same content laid out on a PDF page (auto-orientation based on
  diagram aspect ratio).
- If the project has one or more sequence-diagram groups (4.15), each one
  additionally exports as its own separate PNG file (suffixed with its
  participant names) alongside the main diagram's PNG, and as its own extra
  page appended to the main PDF — cropped tightly to just that group's own
  content, everything else on the canvas hidden for that one capture.
- **"🌐 Export to..."** (File menu) — a *whole-canvas* export (every node/
  edge, not scoped to a sequence-diagram group like 4.15's Mermaid/PlantUML
  export) to three external tools, each best-effort rather than a lossless
  round-trip since none of these formats has a 1:1 match for every shape
  this app has:
  - **Mermaid Flowchart** — converts the diagram to `flowchart LR` text;
    "📋 Copy as Mermaid" puts it on the clipboard, "🔗 Open Mermaid Live
    Editor" copies it and opens `mermaid.live` in a new tab to paste into.
  - **draw.io / diagrams.net** — converts the diagram to mxGraph XML,
    downloaded as a `.drawio` file; "🔗 Open draw.io" downloads it and opens
    `app.diagrams.net` to open the file there.
  - **Lucidchart** — Lucidchart's own importer accepts draw.io files and it
    has no "open with pre-loaded content" URL scheme (only file uploads,
    unlike Mermaid Live/draw.io above), so this offers the *same* mxGraph
    XML download plus a link to `lucid.app` to import it from there.
- **"🔗 Share"** (File menu) — generates a URL whose hash fragment encodes
  the entire project (gzip-compressed via the native `CompressionStream`,
  base64url-encoded — no bundled dependency, no backend). Opening the link
  loads that project as a local copy in the recipient's own browser
  (checked before the normal autosave-restore on boot); it's "read-only"
  only in that edits never sync back to the sender, not because it's
  locked — the recipient can freely edit their own local copy afterward.

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
  `#canvas-viewport` sets `touch-action: none` so every canvas gesture
  (pan, node drag/resize, connector draw) is owned entirely by that
  pointer-event handling — without it, a single-finger touch-drag can be
  arbitrated by the browser as a native scroll running in parallel with
  the JS `transform`-based pan, which flickers/vanishes content on mobile.
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
- **Sequence-diagram-aware**: when the canvas holds a sequence diagram (any
  lifeline node present, 4.15), the generated prompt swaps its whole
  checklist for one suited to reviewing an interaction/call flow — call
  order, missing responses, unhandled error/timeout/retry paths, race
  conditions, and whether a call should be async vs. blocking — instead of
  the generic architecture checklist (scalability/reliability/security/
  cost/maintainability), which doesn't fit a flow diagram well.
- **"🔍 Review" / "💬 Explain" mode toggle**: the panel's top offers two
  prompt builders, not just one — "🔍 Review" (default) asks for critique/
  feedback as above; "💬 Explain" instead asks the AI for a plain-language
  walkthrough of what the diagram represents (useful for onboarding a
  teammate, or sanity-checking that a generated/imported diagram reads the
  way you intended). Both reuse the exact same prepare-and-hand-off
  mechanism — only which prompt-builder function runs differs. Switching
  modes clears any hand-edited prompt text so the new mode's own
  auto-generated prompt shows, rather than silently keeping stale text from
  the other mode.

See `js/io/aiReview.js` (prompt builders, provider list) and
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
  one click. The prompt also offers a *second* few-shot example and its own
  rules for a sequence diagram (4.15) — lifeline nodes and time-ordered
  messages instead of a component graph — with explicit guidance on when
  to use it (the spec is fundamentally about a step-by-step interaction/
  call order, not a static architecture) so the AI only reaches for it when
  that's actually the better fit; a pasted lifeline-shaped reply skips the
  grid-layout safety net below entirely (see that bullet) since a generic
  grid would scramble a sequence diagram's meaningful left-to-right order.
- **Step 3 — Paste the AI's result**: paste the AI's whole reply (prose
  and all — the JSON is extracted automatically: a direct parse first,
  then a fenced ```json block, then a first-`{`-to-last-`}` fallback).
  The extracted object goes through the same `validateProject()` used by
  every other import path, so malformed or partial output degrades
  gracefully instead of crashing; if the AI ignored the layout
  instructions and stacked components on top of each other, a safety net
  re-arranges them on a simple grid rather than leaving an unusable pile —
  skipped entirely for a sequence diagram (any lifeline node), since a
  square grid would scramble its meaningful left-to-right participant
  order and squash its tall vertical shape; even an imperfect AI layout
  there reads better than that.
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
  either side (join it via "🔁 Replicate" → "Add to an existing pair", or
  right-click an unlinked component and choose "🔁 Join replication..." for
  the same modal pre-focused on just that component) — or a component
  already sitting in that side's group, e.g. right after a JSON import —
  gets a mirror created on the other side on the very next change. Moving,
  resizing, restyling, renaming or editing a mirrored component's
  sub-components/notes/labels propagates the same change to its peer, in
  either direction (whichever side actually changed drives the update).
  Deleting a mirrored component deletes its peer too, so the two sides can
  never silently drift into a stale, half-deleted state.
- **Internal connectors mirror too**: a connector drawn between two
  components that are both already mirrored members of the same side (e.g.
  a message between two sequence-diagram lifelines, 4.15) gets its own
  mirror created on the other side automatically, on the same pass as the
  node it connects to — same live "whichever side changed drives the
  update" propagation, and cascade-delete: removing one such connector (or
  a node it depends on) removes its mirror too, rather than leaving a
  dangling one-sided connector behind. A connector that merely stops
  touching two live members (one endpoint excluded/regrouped away) drops
  its mirror mapping without deleting either connector.
- **Visual boundary**: each side of an active pair (and, separately, any
  regular multi-component group from 4.3.x) shows a subtle dashed
  background box behind its members so it reads as one unit at a glance —
  hover it and click its ✕ to hide just that background (the group/side
  itself is completely unaffected, and hiding it is session-only, not
  saved with the project).
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

### 4.15 Sequence Diagrams
A UML-style "communication flow" diagram — vertical **lifelines**, one per
participant, with horizontal **messages** between them showing a call
followed by a response (or any back-and-forth), read top to bottom as time.

- **"🔀 Sequence Diagram" wizard** (toolbar Create menu) — enter 2+
  participant names (add/remove rows; e.g. Client, Server, Database) and
  click Create. One titled **lifeline** node per participant appears,
  evenly spaced left to right, centered on the current view. This only
  creates the lifelines — messages are drawn afterward.
- **Lifeline**: a `lifeline`-shaped node — a titled box pinned at the top
  with a thin dashed vertical line spanning the rest of its height. It's an
  ordinary node otherwise: draggable, restylable (color/border), resizable,
  renameable — and also available on its own from the Basic Shapes sidebar
  category (as "Lifeline"), for adding one more to an existing diagram
  without re-running the wizard.
- **Messages**: drawn with the same drag-from-a-connection-point gesture as
  any other connector (4.4), except a lifeline's left/right connection
  points span its *full height* instead of a small dot at the midpoint —
  grab/drop at whatever height represents when the message happens, and
  several messages on the same lifeline land at their own distinct heights
  instead of stacking on one point (see 4.4's `fromOffset`/`toOffset`).
  A message between two lifelines defaults to straight routing (no elbow
  jog) and is automatically numbered (1, 2, 3, ...) in top-to-bottom order —
  a small numbered badge at its start — purely computed for display, not
  stored, so it's always correct after adding/deleting/undoing a message.
  Right-click a message → "Set sequence number..." overrides its badge with
  a manually-chosen number instead (shown with a distinct badge color) for
  the rare case the auto order doesn't match intent — this one field
  (`edge.sequenceNumberOverride`) *is* persisted, unlike every other part of
  this numbering scheme, and doesn't renumber its neighbors; "Clear sequence
  number override" (shown once set) goes back to automatic numbering.
  Every other connector feature already applies: solid vs. dashed (a
  natural call-vs-response convention), arrow direction, color, label, and
  the right-click "Open details" notes panel (4.4, 4.6).
- **Auto-arrange** (4.3.2) is skipped, with an explanatory toast, whenever a
  lifeline is on the canvas — a sequence diagram's horizontal layout is
  manual and meaningful (x position = which participant), not something a
  connector-direction layout should rearrange.
- **Self-messages**: a lifeline can message itself (e.g. "validate input
  locally" before calling out) — drag from a lifeline's connection strip
  back onto that same lifeline at a different height; it renders as a
  small loop out and back rather than a flat line through the lifeline, and
  still gets a sequence number and every normal connector feature (label,
  notes/tooltip, style).
- **"↔️ Distribute Evenly"** (toolbar Tools menu) tidies up a sequence
  diagram that's drifted uneven from manual dragging/reconnecting: re-spaces
  every lifeline column to the wizard's own even gap and every message's
  height along its lifeline(s) — preserving both the lifelines'
  left-to-right order and the messages' top-to-bottom order, so nothing
  reorders, only the spacing evens out.
- **Zoom in / drill-down on a sequence diagram**: grouping 2+ lifelines
  (Group, 4.3.x) adds a 🔍 icon on the group's own background — click it
  for a read-only zoomed-in preview of just that sequence diagram in a
  modal (or "📌 Pin to side panel" to dock the same live-updating preview
  instead). The preview is view-only; its own "✏️ Edit" button (also
  reachable straight from a pinned panel) opens the *real* canvas scoped to
  just that group's lifelines/messages for actual editing — a banner marks
  this state and its own "✅ Done editing" button merges the changes back
  into the main diagram, restoring everything else exactly as it was set
  aside. Nothing new is persisted for this — a "sequence diagram group" is
  simply any group whose members are all lifelines, so it needs no schema
  changes and every existing JSON/PDF/PNG import-export path already
  supports it (see 4.7/4.8's own callouts).
- A UML "note" attached to a lifeline needs no special support — drop a
  Sticky Note (Basic Shapes) next to it like on any other diagram.
- **Message style presets**: selecting a single lifeline-to-lifeline message
  adds a "Message preset" dropdown to the arrow style editor — Sync call
  (solid, filled arrowhead), Async call (solid, open arrowhead), or Return
  (dashed, open arrowhead) sets `dash`+`startArrow`+`endArrow` together
  instead of two separate fields.
- **Destroy marker**: right-click a lifeline → "Mark destroyed here" sets
  `node.destroyOffset` (0..1 down the lifeline, computed from the click
  height) — renders an X at that point and stops the dashed line there;
  "Clear destroy marker" (shown instead once set) removes it.
- **Activation bars**: right-click a lifeline → "Add activation bar" appends
  `{id, startOffset, endOffset}` (0..1 span) to `node.activations` — a
  narrow rectangle centered on the lifeline, draggable by its body (moves
  both offsets together, preserving length) or by either end (resizes that
  end); right-click an existing bar for "Remove activation bar".
- **Combined fragments**: six "Fragment" shapes (Alt/Opt/Loop/Par/Critical/
  Break) in the Sequence Diagram Templates sidebar category — a plain
  resizable/movable labeled box (same mechanism as the Group/Container
  shape, 4.3.x) with a `fragmentType` baked into its definition, rendered as
  a small UML pentagon operator tag at its top-left corner plus the
  condition text (its own label). One condition per box — no alt/else
  divider line. Drop one behind the messages it encloses (right-click →
  Send to back).
- **Ready-made sequence-diagram templates**: the "Sequence Diagram
  Templates" sidebar category also offers whole ready-made flows — Login
  Flow, OAuth Handshake, Checkout Flow, Retry with Backoff, PKCE
  Authorization Flow, SCIM User Provisioning, MFA Challenge, RBAC/ABAC
  Authorization Checks, SSO (SAML/OIDC), SPA Silent Token Refresh, API Key
  Authentication, TCP 3-Way Handshake, UDP Request/Response, Password Reset
  Flow, Passwordless Magic Link Login, WebAuthn/Passkey Authentication,
  OAuth Client Credentials (M2M), WebSocket Handshake & Messaging, Webhook
  Delivery with Retry, Circuit Breaker Pattern, Cache-Aside Pattern, Saga
  Pattern (Choreography), Idempotent Request Handling, Two-Phase Commit,
  Outbox Pattern, Event Sourcing/CQRS Command Flow, gRPC Unary Call,
  GraphQL Query Resolution, Presigned URL File Upload, Kafka Consumer-Group
  Rebalance, Distributed Lock Acquisition, Service Mesh mTLS Handshake,
  Blue-Green/Canary Deployment Traffic Shift, DNS Resolution Flow,
  Social/Federated Login, and Step-Up Authentication — 36 templates total —
  clicking or dropping one instantiates the whole lifeline+message cluster
  at once, already grouped (4.15's drill-down zoom-in works immediately).
  Hovering (or keyboard-focusing) a template's sidebar item shows a small
  SVG preview thumbnail of its lifelines and messages first. A relevant
  template is also offered as a Smart Suggestion (4.12) when placing a
  component like OAuth/OIDC, SSO, Identity Provider, API Gateway, JWT, API
  Key, Cognito, React, Router, Redis Cache, WebSocket Server, Email
  Service, Webhook, Payment Gateway, Circuit Breaker, Saga Coordinator,
  gRPC Service, GraphQL Server, Apache Kafka, DNS, Service Mesh, S3, or
  Spinnaker — accepting it instantiates the template positioned next to
  that component (not attached onto it, unlike a layer suggestion) — and a
  template can be dragged from the sidebar directly onto an existing node
  for the same effect.
- **Export as Mermaid / PlantUML**: a sequence diagram's drill-down modal
  (above) has "📋 Copy as Mermaid" and "📋 Copy as PlantUML" buttons — each
  converts its lifelines, messages (mapped to that format's own sync/async/
  return arrow syntax by dash+arrowhead), activation bars
  (`activate`/`deactivate`), destroy markers (`destroy`), and any fragment
  box whose bounds overlap the group (`alt`/`opt`/`loop`/`par`/`critical`/
  `break` ... `end`) into that format's text on the clipboard. A plain
  "Group / Container" shape (4.3.x) whose horizontal span overlaps one or
  more lifelines also wraps them in a labeled swimlane (Mermaid's
  `box "Label" ... end` / PlantUML's `box "Label" ... end box`), letting you
  group lifelines into named participants/teams in the exported text.
  Best-effort, not a lossless round-trip — neither format has
  offset-anchored messages or freely-positioned fragments of its own.
- **Import from Mermaid**: the Create dropdown's "📥 Import from Mermaid"
  wizard is the inverse — paste Mermaid `sequenceDiagram` text (participant
  declarations are optional; participants are auto-declared from the first
  message that mentions them) and it becomes a real, grouped set of
  lifelines and messages on the canvas, reading arrow styles
  (`->>`/`-)`/`-->>` → sync/async/return), `activate`/`deactivate`,
  `destroy`, and `alt`/`opt`/`loop`/`par` blocks. Events are spread evenly
  down the lifelines' height in the order they appear in the text (Mermaid
  text has no explicit vertical position). Best-effort, not a guaranteed
  lossless round-trip.

### 4.16 Diagram Lint
A "🔍 Check Diagram" toolbar button runs a small, deterministic (non-AI) set
of structural checks over the current diagram's graph and lists what it
found, each clickable to select and center the view on the component(s)
involved. Complementary to 4.12's AI Design Review, not a replacement — it
needs no LLM/API key/paste-back round trip, runs instantly, and is
deliberately narrow: a handful of textbook, low-false-positive checks most
engineers would immediately recognize, not a general-purpose architecture
linter (a much bigger, far more opinionated project than this one
attempts). Currently three checks:

1. A "Client & Frontend"-category component connected directly to a
   "Databases"-category component (no service/API layer in between).
2. A component with zero connections while the rest of the diagram is wired
   up (only fires once the diagram has at least one edge elsewhere, so a
   still-empty diagram isn't flagged node-by-node) — excludes sequence-
   diagram elements (lifelines, fragment boxes) and the plain "Group /
   Container" shape (4.3.x), none of which are meant to have an edge of
   their own.
3. A Live Replication pair (4.14) with no load balancer/API gateway-named
   component routing traffic to either side — only fires once the
   replication feature is actually in use, so it's a confident signal, not
   a guess about intent.

Pure/DOM-free (`js/core/diagramLint.js#computeDiagramLint`), with
`resolveDef` dependency-injected rather than imported directly so it stays
unit-testable without touching `localStorage`-backed modules.

### 4.17 Diagram Versions
"📸 Version History" (File menu) lets a user capture a named, timestamped
snapshot of the current diagram's content (nodes/edges/replicationPairs) at
any point, then later revert to one (a normal undoable dispatch, not a
history reset) or delete it. Two versions can be compared side-by-side — an
id-based structural diff (`core/diagramDiff.js#computeDiagramDiff`) listing
added/removed/changed nodes and edges, each clickable to jump to it if it's
still on the live canvas. Versions live inside the project itself
(`project.versions`, see §6) rather than a separate `localStorage` silo, so
they travel with JSON export/import and full backups like everything else.

### 4.18 Presentations
"🎬 Presentations" (File menu) assembles an ordered subset of saved
versions (4.17) into a slideshow (`project.presentations`, see §6), each
slide carrying its own title/notes. Playing one steps through rendered
screenshots of each version's diagram content — captured by temporarily
swapping the live canvas to that version's snapshot via a **coalesced**
store dispatch (so it never pollutes undo/redo history), running the
existing `io/exportImage.js#captureDiagramCanvas()` capture path, then
swapping back. A presentation can also be exported to a real `.pptx` file
(vendored `PptxGenJS`, see `vendor/VENDOR.md`) — one slide per version, each
image plus its title/notes.

### 4.19 Reference Architecture Templates
The "Reference Architectures" sidebar category holds ready-made "Design X"
system-design-interview blueprints (URL Shortener, Chat Application, Rate
Limiter Service, Social Media Feed, Ride-Sharing Dispatch) — complete, if
simplified, whole-system starting points, one step up from the small
architectural building-block patterns in "Design Patterns" (§4.2). Built
the same way as any other pattern (`definePattern`, real component defIds
for every node), but with `groupOnInstantiate: true` so a "Design X" comes
in as one movable group with a background frame, since it's meant to read
and move as a whole design rather than a loose cluster.

### 4.20 Command Palette
"⌘ Quick Actions" (toolbar button, or Ctrl/Cmd+K from anywhere including
while a text field is focused) is a single searchable box covering both
every major app action (arrange, export, save, ...) and the whole component
library ("add redis") — picking a component result reuses the same
`addComponentAtCenter`/`addRelatedComponent`/`addLayerToNode`/
`instantiatePatternAtCenter` paths the sidebar already uses, branching on
the component's `kind` the same way `sidebar/dragSource.js`'s click-to-add
does (a `pattern` instantiates as a cluster, a `layer` attaches to a single
selected node, everything else adds standalone). When exactly one component
is selected on the canvas, results relevant to *it* specifically (curated
companions, sub-components, patterns, plus duplicate/delete) are shown
first under their own heading, ahead of the general action/component list.
Arrow keys move the highlighted result, Enter runs it.

### 4.21 Estimated Cost & Label Chips
Any node can carry an estimated monthly cost in US dollars (details panel,
`node.monthlyCost`, default `null` = "not estimated") — shown as a small
badge on the node face itself when set, and rolled into a running total
viewable via "💰 Cost Breakdown" (Tools menu), which lists every costed
component (highest first, each clickable to jump to it) plus the total.
Free-form labels (already editable in the details panel — capacity/SLA
tags like "10K RPS" or "99.9% SLA") now also render as small chips directly
on the node face, not just in the details panel, so this kind of
annotation is visible at a glance on the diagram itself.

### 4.22 Smart Alignment Guides
While dragging a node (or a multi-selection, treated as one bounding box),
the drag snaps into exact alignment with a nearby node's left/center/right
or top/center/bottom edge — independently per axis — and a Figma-like
dashed guide line is drawn spanning every node sharing that alignment, not
just the one that triggered it. Pure geometry
(`core/alignmentGuides.js#computeAlignmentGuides`) driving a plain SVG
overlay layer in canvas-space (`canvas/canvas.js`'s `.align-guide-layer`,
a sibling of the node/edge layers so no manual pan/zoom math is needed).
The snap threshold is a fixed *screen*-pixel distance converted to canvas
units by the current zoom, so the "feel" stays consistent whether zoomed in
or out. On by default; toggled off via "🧲 Snap Guides" (Tools menu, a
persisted `io/uiPrefs.js` preference).

### 4.23 Dark Mode & Diagram Themes
The "Theme" toolbar button (Tools menu) cycles a persisted `io/uiPrefs.js`
preference through Match System / Light / Dark; `io/theme.js#setTheme`
stamps `data-theme` on the document root and every color in the app (canvas,
toolbar, modals, node/edge colors that reference CSS custom properties)
follows the corresponding light/dark token set in `css/variables.css`.
Separately, "🎨 Diagram Theme" (Tools menu) *permanently* recolors every
node's own `fill`/`stroke` to one of several curated palettes (Ocean,
Sunset, Forest, Monochrome, Pastel) — components that currently share a
color are grouped together and mapped to the same new color, so a
diagram's existing color-coding by layer/tier is preserved, just re-skinned.
This is a one-time bulk edit (undoable as one step), unlike the dark-mode
toggle which is a non-destructive display setting.

### 4.24 Custom Icon Upload
A node's style editor has an "Upload Image" button (alongside the existing
built-in icon picker) to use a local image file as that node's icon instead
of an emoji/icon-font glyph — stored as a data URI on `node.iconImage`,
which takes precedence over `node.icon` when rendering and mirrors like any
other node field under Live Replication.

### 4.25 Minimap & Focus Mode
"🧭 Minimap" (Tools menu, persisted preference) shows a small always-on-top
overview panel in the canvas's corner with every node as a tiny rect and a
"you are here" box for the current pan/zoom; click or drag on it to jump the
main view anywhere. "🔦 Focus Mode" (Tools menu, persisted preference) dims
every node except the current selection and its directly-connected
neighbors, for tracing one part of a large diagram without losing the rest
as context. Both are pure display overlays with no effect on the saved
project data.

### 4.26 Manual Connector Waypoints
A selected connector shows small drag handles along its rendered path (a
dedicated overlay layer, the same architecture as the reconnect-endpoint
handles): dragging one moves an existing bend point, dragging the small "+"
that appears between two handles inserts a new one at that spot, and
right-clicking a handle (or the connector itself) removes all manual bend
points and returns it to its routing style's default path. Manual waypoints
(`edge.waypoints`, an ordered list of `{x,y}` canvas points) take priority
over the connector's `routing` value for path computation, but the
`routing`/arrow/label/style settings are all unaffected and still apply
around the manual path.

### 4.27 Pinned Comments
Right-clicking empty canvas offers "Add comment here", dropping a small
pin (`project.comments`, each `{id, x, y, text, resolved, replies}`) at
that canvas point and immediately opening it for editing. Clicking an
existing pin reopens the same editor to change its note or toggle "Mark as
resolved" (shown with a checkmark and muted styling instead of the default
speech-bubble icon). A comment's `replies` array (each `{id, text,
createdAt}`) holds a lightweight discussion thread under the note — an
input at the bottom of the editor adds a reply on Enter, and each reply has
its own ✕ to remove it; replies are independent of the resolved/unresolved
state. Comments (and their replies) are included in duplicate-project
(with fresh ids on the copy), full-project JSON export/import, and full
backup — dropped only from the standalone per-diagram-content copy
operations that never touched comments to begin with. They're also
included in "Fit to screen" and PNG/PDF export bounds so a pin is never
cropped out of view. An older project's comment with no `replies` field
(saved before this existed) validates to an empty array rather than being
migrated destructively.

### 4.28 Accessibility
A selected node can be nudged with the arrow keys (1px per press, 10px with
Shift held), for precise keyboard-only positioning without a mouse.
Icon-only toolbar buttons (undo/redo, zoom in/out/reset, fit to screen) all
carry a real `aria-label` so a screen reader announces their purpose instead
of an unlabeled symbol. The app's existing `:focus-visible` keyboard-focus
ring (`css/base.css`) is honored everywhere, including the command palette's
search input, which previously suppressed it.

### 4.29 Terraform Export
The "🌐 Export to..." modal (also home to Mermaid/draw.io/Lucidchart) gains
a 4th target: "Copy as Terraform" / "Download .tf file", generating a
starter `.tf` file for the AWS components on the canvas — one resource
block per component mapped to a real Terraform resource type, a comment
noting AWS-to-AWS connectors, and a comment listing any AWS components not
yet mapped (never silently dropped). Non-AWS components are skipped with no
mention, since they have no Terraform equivalent. Intended as an editable
starting point, not a deployable file as-is.

### 4.30 Canvas Outline panel
A "📋 Outline" toolbar button (Tools menu) opens a collapsible side panel
listing every component and connector currently on the canvas, grouped into
two sections, with a search box to filter by name. Clicking an entry selects
and centers that component/connector on the canvas; conversely, selecting
something on the canvas highlights the matching row in the Outline panel.
Doubles as a quick table of contents for a large diagram.

### 4.31 Multiple diagram tabs
"🗂️ Open in New Tab..." (File menu) opens a picker to either start a new
blank diagram or reopen any other saved project as an additional tab,
alongside the diagram already open. Once 2+ tabs are open, a tab strip
appears above the toolbar showing each open diagram by name; clicking a tab
switches the live canvas to it (saving the outgoing tab's changes first), and
each tab's own "✕" closes it (without deleting the underlying saved
project) — closing the active tab switches to another open one. A single
diagram never shows this tab strip at all.

### 4.32 Presenter Mode
"🖥️ Presenter Mode" (Tools menu) hides the toolbar, sidebar, and every side
panel, leaving a full-bleed view of just the canvas — useful for presenting
or screen-sharing a diagram without the editing chrome visible. A small
floating "✕ Exit Presenter Mode" button (the only chrome left on screen)
or the Escape key returns to the normal editing view. The setting is not
remembered across a page reload.

### 4.33 Large-diagram rendering performance
Components far outside the current view no longer cost meaningful rendering
work — the browser is free to skip laying out and painting their inner
content until they're scrolled/panned/zoomed back into view. This has no
observable effect on correctness: "Fit to screen", PNG/PDF export, and every
other measurement stay accurate regardless of what's currently on-screen.

### 4.34 Duplicate-tab warning
Opening this app in a second browser tab shows a one-time warning (in both
tabs) that the diagram builder is already open elsewhere — every tab shares
the same autosave slot and saved-project storage, so editing the same
diagram in two tabs at once can silently overwrite one tab's changes with
the other's.

### 4.35 Visual Undo/Redo Timeline
"🕘 Undo History" (File menu) shows every past and available-to-redo edit as
a single ordered list, each entry auto-labeled in plain language (e.g.
`Added "API Gateway"`, `Moved 2 components`, `Restyled 3 components`) rather
than a bare step number. The current position is marked "You are here";
clicking any other entry jumps straight to that point in one action instead
of pressing undo/redo repeatedly.

### 4.36 Diagram Animation
"🎞️ Diagram Animation" (Tools menu) builds any number of named, ordered,
numbered reveal sequences out of any components and connectors already on
the canvas, regardless of diagram type. A side panel ("Diagram Animation")
holds a switcher (dropdown + "+ New"/✎ Rename/🗑 Delete) for choosing which
named animation is currently being edited or played — a diagram can carry
several independent sequences (e.g. "Normal flow" vs "Failure scenario")
without them interfering with each other. The active one lists every item
in its sequence with its order number and name, a per-step "Auto" (reveal
automatically after a configurable delay, default 2s) / "Click" (reveal
only on the next click/keypress) setting, ▲/▼ reorder controls, an optional
free-text presenter note (📝, never part of the diagram content itself, only
shown during playback), and an "Auto-focus" toggle that pans/zooms the
canvas to frame each step as it reveals. An "Add more" section lists
everything not yet included, each with a one-click "+ Add", plus a checkbox
per item and an "Add Selected as one step" button for grouping several items
into a single "reveal together" step sharing one order number. Right-
-clicking a component or connector offers a quick "Add to Animation"/"Remove
from Animation" toggle; right-clicking within an existing multi-selection
instead offers "Add Selection to Animation" to group the whole selection
into one step in a single action. While editing (not currently playing), a
small numbered badge appears directly on the canvas over every item in the
sequence (every target in a grouped step shares the same number), and a
newly-revealed item briefly pulses during playback to draw the eye.

"▶️ Play Animation" enters a presentation view — reusing Presenter Mode's
chrome-hiding — that hides every not-yet-revealed item and reveals them one
at a time per the configured order/timing. Floating playback controls
(prev/next/step counter, a row of clickable progress dots for jumping
straight to any step, and the current step's presenter note if it has one)
appear at the bottom of the screen; the → arrow key (or N) advances a step,
← (or P) goes back one, and a plain click anywhere on the canvas also
advances a pending "Click" step. Two session-only toggles — ⏩ "Autoplay to
the end" (forces every remaining step to auto-advance regardless of its own
Auto/Click setting) and 🔁 "Loop" (restarts from the beginning after a short
pause once every step is revealed) — support running the whole sequence
unattended, e.g. on a kiosk display. Escape exits playback and returns to
the normal editing view. A 🖊️ "freeze" toggle (or the D key) pauses
advancement and opens a full-screen transparent drawing layer with a small
color palette, so the presenter can annotate the frozen diagram live; "Done"
clears the markup and resumes. Every animation's sequence, groupings, notes,
and auto-focus setting are ordinary project data — they travel automatically
with the diagram's own JSON export/import and full backup — and also
export/import independently as a standalone JSON file (covering every named
animation on the diagram at once) for reusing or sharing just the
"script" separately from the diagram itself.

### 4.37 Flow Simulation
"💫 Flow Simulation" (Tools menu, off by default) animates a small dot
continuously riding every connector's own rendered path in its drawn
direction — an SVG `<circle>` with a native `<animateMotion>`/`<mpath>`
referencing that connector's `<path>` element by id, so the dot always
tracks the path's current shape (including live edits) with no per-frame
JS. Toggling it on/off flips a CSS class on the shared `.edge-layer` SVG
root and calls that root's own `pauseAnimations()`/`unpauseAnimations()` —
an O(1) operation regardless of how many connectors the diagram has, so a
diagram that never enables it pays nothing for the feature. The dot is
purely a live visualization, not persisted project data; the toggle itself
is a persisted UI preference (`uiPrefs.flowSimulation`), same as the grid
or minimap toggles.

### 4.38 Edit with AI
"💬 Edit with AI" (Create menu) is the incremental sibling of "🧠 Generate
Design from Spec" (4.13): instead of replacing the whole canvas, it asks an
AI for a small JSON *patch* against the diagram that's already there. Same
3-step "prepare & hand off, no API key" wizard shape: (1) describe the
change in plain language, (2) copy a generated prompt — embedding a trimmed
JSON projection of the live diagram (ids, geometry, text; cosmetic fields
omitted) plus the instruction — to your own AI chat, (3) paste the reply
back. The expected reply is a patch object: `addNodes`/`addEdges` (new
items, each given a short new id), `updateNodes`/`updateEdges` (an existing
id plus only the fields being changed — never an id rename, never a
position change via update), and `removeNodeIds`/`removeEdgeIds`. Before
applying anything, a preview lists every addition/update/removal in
human-readable form (component/connector names, not raw ids) and calls out
any entry referencing an id the diagram doesn't have as a warning — that
entry is silently skipped rather than applied. Applying a patch is one
atomic dispatch: new node/edge ids that would collide with something
already on the canvas are transparently remapped (and every reference to
that declared id within the same patch follows the remap), so the whole
patch is a single undoable step regardless of how many additions/updates/
removals it contains.

### 4.39 Custom Lint Rules
"🔍 Check Diagram" (4.9's built-in structural checks) can be extended with
team-authored rules via its "⚙️ Manage Custom Rules" button. A rule is
parameterized, not free-form code, so it's always safe to evaluate: pick a
type — **requires-connection** (every component in category A must have at
least one connection, either direction, to a component in category B),
**forbidden-connection** (no component in category A may connect directly,
either direction, to one in category B), or **max-count** (no more than N
components of category A may appear) — plus the category/categories and,
for max-count, the limit. Rules are named (auto-named from their
parameters if left blank), individually enabled/disabled without deleting
them, and persisted in `localStorage` (`customLintRules`, capped at 50)
independent of any one project, same as global node defaults. Every
enabled rule is evaluated alongside the built-in checks each time "Check
Diagram" runs, producing findings in the same `{severity, message,
nodeIds}` shape so they render identically in the results list and are
equally clickable to jump to the offending component(s).

### 4.40 Threaded Comments
See 4.27 — Pinned Comments now support a lightweight reply thread under
each note.

### 4.41 Language / RTL
A "🌐 Language" toggle (Tools menu) switches the app's own UI chrome
between English and Hebrew, applying `dir="rtl"`/`lang="he"` to `<html>`
for Hebrew. The choice is a persisted UI preference
(`uiPrefs.language`); since switching changes rendered text throughout the
toolbar/sidebar/every open modal, the toggle reloads the page rather than
attempting a partial live re-render of every already-built piece of UI.
Translation is curated and deliberately scoped to the app's own chrome —
toolbar group labels and their tooltips, the undo/redo/select/hand-tool
labels, the sidebar search box, and the shared "Cancel" button used by
every confirm/dismiss dialog — via a small `t(key)` lookup
(`io/i18n.js`) that falls back to English (then to the key itself) on any
miss, so an added-but-untranslated string never renders blank. The ~200
predefined component names/descriptions and `help.html` are **not**
translated — a separate, much larger content-translation project — and
stay in English regardless of the chosen language. Most of the layout
mirrors for free under `direction: rtl` (flexbox's row axis is direction-
aware by spec, so the toolbar/sidebar/canvas arrangement flips without any
RTL-specific CSS); the handful of `position: fixed`/`absolute` elements
pinned with a literal `left`/`right` — the mobile sidebar/panel drawers,
the toast stack, and the kiosk-mode exit button — get explicit
`[dir="rtl"]` override rules alongside their normal (LTR) ones.

### 4.42 Configurable Storage Backend
Every persisted thing this app stores (saved projects, backups, My
Components, settings) can live in either `localStorage` (the default) or
IndexedDB, chosen from "🗄️ Backup & Restore" (File menu). Since IndexedDB
is natively async and the rest of the app calls `readJSON`/`writeJSON`
synchronously everywhere, IndexedDB mode is backed by an in-memory cache
populated once at boot (`initStorageBackend()`, awaited first thing in
`main.js#boot()`) so every existing call site keeps working unmodified.
Switching backends (`switchStorageBackend()`) always copies every entry
from the current backend into the new one first and never deletes the
source, so switching back is always possible; the page reloads afterward
to boot cleanly on the new backend.

### 4.43 SVG Export
"🔺 Export SVG" (File menu) exports the diagram as a scalable vector
image, alongside the existing PNG/PDF export. Since a saved `.svg` file
becomes its own document when reopened (its `:root` is the `<svg>` root,
not the original page), every CSS custom property the exported subtree
uses is resolved to its live concrete value and inlined as a flat
`:root {...}` block rather than relying on the app's own selector-based
light/dark theme rules to re-match in a foreign document.

### 4.44 Search All Projects
"🔎 Search All Projects" (File menu) searches node/edge text and comment
text across every saved project in this browser at once — not just the
one currently open — showing per-project match snippets and a one-click
"Load" for any result.

### 4.45 Comments: Unresolved Badge, List, and Mentions
A small badge on the toolbar's "💬 Comments" button shows how many
comments on the current diagram are still unresolved (hidden entirely at
zero). The same button opens a list of every comment, unresolved-first,
each with a one-click jump-to-it action. Typing `@name` in a reply (see
4.27/4.40) renders it as a small highlighted mention chip, built from real
DOM text nodes rather than `innerHTML`.

### 4.46 Diagram Lint Auto-fix
Select findings from "🔍 Check Diagram" (4.16) now offer a one-click
"🔧 Auto-fix" button: a client-to-database finding inserts a "Service
Layer" node between the two and reroutes the existing edge through it; an
unrouted-replicas finding adds a "Load Balancer" node connected to every
member. Both apply as a single undoable action. The orphan-component
finding has no fix — there's no single sensible default for "connect this
to something."

### 4.47 Replication Sync Direction
When Flow Simulation (4.37) is on, each Live Replication pair (4.14) also
shows a dashed line with a small dot traveling back and forth between its
two mirrored members — replication has no real drawn connector to animate
otherwise, since the sync relationship is data, not a connector. The
visual rides the same `.edge-layer` visibility/pause toggle Flow
Simulation already controls, with no separate on/off state of its own.

### 4.48 Getting Started Checklist
A small dismissible card ("🚀 Getting Started", reopenable from the Help
menu) tracks a few first steps for anyone just getting oriented (add a
component, connect two, save the diagram), checking each one off as it's
completed.

### 4.49 Template Gallery
"🖼️ Template Gallery" (Create menu) is a visual browser for every
Reference Architecture (4.19) and Design Pattern (see 4. Component
library), each shown as a small SVG preview thumbnail (a simplified
node/edge layout, not a live render) instead of only a name in the
sidebar list. Clicking a card instantiates it the same way clicking it in
the sidebar would.

### 4.50 Offline Support (PWA)
The app registers a service worker (`sw.js`) and links a web app manifest
(`manifest.json`), so once it's been loaded once it keeps working —
including autosave — without a network connection, and can be installed
like a native app. The service worker uses a stale-while-revalidate
strategy (serve from cache immediately, refetch in the background) rather
than a hand-maintained precache list, since this app has no build step
and therefore no generated asset manifest to keep such a list in sync
with.

### 4.51 Import ER Diagram from SQL
"📥 Import from SQL" (Create menu) parses pasted `CREATE TABLE`
statements (a best-effort regex-based parser, not a full SQL grammar) and
creates one "entity" node per table (the same `rows`-shape convention
this library's own ER design-pattern templates already use) with its
columns listed, plus a labeled edge per foreign key (inline `REFERENCES`
or a table-level `FOREIGN KEY (...) REFERENCES ...(...)` constraint). A
foreign key referencing a table that wasn't actually defined is silently
dropped rather than creating a dangling edge.

### 4.52 C4 Model
A dedicated "C4 Model" component category provides the standard C4
notation shapes with their conventional color coding: Person, Software
System, External Software System, Container, External Container, and
Component. A "🧩 C4 Context Diagram" wizard (Create menu) bootstraps the
most common starting point — a System Context diagram — from a system
name and a dynamic list of people/external systems, laying the named
system out in the center with people above and external systems below,
each connected to the center. Only the Context level has a dedicated
wizard; a Container or Component diagram is built the same way as any
other diagram, by dragging the matching shapes onto the canvas and
connecting them — there is no enforced multi-level drill-down state.

### 4.53 Direct API Mode for AI Providers
Every AI-assisted feature (4.12 AI Design Review, 4.13 Generate Design from
Spec, 4.38 Edit with AI) defaults to a "prepare & hand off" flow: no API key,
nothing leaves the clipboard. Settings → "Default settings for new
components" → "🤖 AI Providers" adds an opt-in alternative: a "Sending mode"
toggle between **Copy/Paste** (the default) and **Direct API calls**, plus a
key/model field for each of the three providers with a genuinely usable
direct-browser-call path (Claude/Anthropic and Gemini/Google both support
it; ChatGPT/OpenAI is offered too but may reject the request depending on
that provider's own CORS policy — outside this app's control either way),
and a "+ Add custom provider…" option for any other OpenAI-compatible
endpoint (name, base URL, key, model). GitHub Copilot has no public per-key
completions API for third-party apps, so it stays hand-off-only.

Every AI flow's UI renders **both** options side by side whenever Direct
mode is configured for a given provider — the existing hand-off button never
disappears, so a failed direct call (bad key, rate limit, CORS) is always
one click away from falling back to copy/paste. A direct call sends the
same prompt (and, for AI Design Review, the same diagram PNG) the hand-off
flow would have copied, and on success fills in the same paste-back field
the user would otherwise have pasted into by hand.

Credentials are stored in their own `localStorage` entry (`aiProviderKeys`),
never included in project JSON, full-backup export, or saved-project files —
an app/browser setting, not project data, same category as UI preferences.
A visible warning explains the security tradeoff: an unencrypted browser
setting is the most secure option a 100% static, backend-free app has for a
user-supplied secret, but it is not encrypted and is readable by anyone with
access to the browser profile or its dev tools. Switching the mode back to
Copy/Paste wipes every saved key/custom provider automatically (the point
of switching back is to stop keeping them around, not just to stop using
them), and a separate "🗑️ Clear API Keys" button clears everything without
requiring a mode switch.

### 4.54 Local AI Mode (in-browser inference, no key)
A third sending mode alongside Copy/Paste and Direct API, and the one with
no credential of any kind: "Local AI in your browser" runs a small open
model (Llama 3.2 3B, Qwen2.5 1.5B, or Qwen2.5 3B — picked in the same "🤖 AI
Providers" settings section) entirely inside the current browser tab via
WebGPU, using the vendored `@mlc-ai/web-llm` engine. No account, no key,
and nothing about the prompt or diagram leaves the device — the tradeoff is
that the model itself (1.5-2.5 GB, quantized) has to download once on first
use (from Hugging Face / a GitHub-hosted binary release, both outside this
app's control) before it can respond, and is meaningfully smaller/slower
than a hosted frontier model. The browser caches the download afterward, so
every use past the first is fully offline — the one feature in this
otherwise fully offline-capable app that needs a connection the first time.

Settings offers a model picker and a "⬇️ Preload model" button to download
ahead of time rather than surprising a user with a multi-GB wait on their
first "Send." A browser without WebGPU support sees a clear warning and a
disabled preload button rather than a confusing failure later. Exactly like
Direct API mode, a "🧩 Send to Local AI" button appears additively next to
every hand-off button across all three AI-assisted flows whenever this mode
is active — the hand-off option is never replaced, so a failed local
generation (unsupported browser, model-load failure) always has a working
fallback one click away. Local AI mode is text-only: the diagram image
(only ever attached by AI Design Review) is not sent to it, since the
curated models here aren't multimodal.

### 4.55 AI-Powered Suggestions
A third mode ("💡 Suggestions") inside AI Design Review, alongside Review
and Explain — offered only once Direct API mode or Local AI mode is
actually usable (a configured provider key, or Local AI turned on), since
this mode's whole point is an *automatic* round trip: asking someone to
hand-copy a JSON array in and out would defeat the purpose the way the
plain-text Review/Explain hand-off flow doesn't. The mode toggle simply
doesn't offer "Suggestions" in Copy/Paste-only setups.

The prompt asks the configured AI for a short, specific list of
suggestions for the current diagram (and any attached spec — same
optional attach step as Review/Explain), each tagged one of three
categories: a concrete missing or complementary **component** worth
adding (by name — "Redis Cache", "Web Application Firewall" — not a vague
concept), a **pricing** consideration specific to what's actually in the
diagram, or another concrete **improvement** (reliability, security,
scalability, maintainability). Clicking "⚡ Send directly" or "🧩 Send to
Local AI" sends it and renders the reply as grouped, readable cards —
title, one-line detail, and (for a "component" suggestion whose name
matches something in this app's own library) a one-click "+ Add" button
that drops it onto the canvas at the current view center. A suggestion
with no library match, or in the pricing/improvement categories, renders
as plain text with no button — there's nothing to add automatically.

If the AI's reply isn't valid JSON (a model ignoring the format
instruction, a truncated response), the raw text is shown in a box with a
"💡 Parse suggestions" button to retry after a manual edit, rather than
losing the response outright — the same manual-paste affordance Review/
Explain already offer, just repurposed as a fallback here instead of the
primary path. A "🔄 Ask again" link clears the current cards to prepare a
fresh request.

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
      "icon": "🖥️", "iconImage": null,
      "notes": "", "labels": ["prod"], "monthlyCost": 45.5,
      "subComponents": [{ "id": "sc_1", "name": "Auth", "icon": "🔐" }],
      "rows": [],
      "zIndex": 3,
      "groupId": null,
      "replicationExcluded": false,
      "destroyOffset": null,
      "activations": [],
      "fragmentType": null
    }
  ],
  "edges": [
    {
      "id": "edge_...",
      "from": "node_a", "to": "node_b",
      "fromSide": "right", "toSide": "left",
      "fromOffset": 0.5, "toOffset": 0.5,
      "routing": "orthogonal",
      "color": "#334155", "width": 2, "dash": "solid",
      "startArrow": "none", "endArrow": "filled",
      "label": "HTTPS", "labelPosition": "middle", "notes": "",
      "sequenceNumberOverride": null,
      "waypoints": []
    }
  ],
  "comments": [
    { "id": "comment_...", "x": 400, "y": 220, "text": "Double-check retries here", "resolved": false }
  ],
  "replicationPairs": [
    {
      "id": "repl_...",
      "mode": "active-active",
      "groupA": "group_...", "groupB": "group_...",
      "offsetX": 280, "offsetY": 0,
      "members": [{ "a": "node_a", "b": "node_b" }],
      "edgeMembers": [{ "a": "edge_a", "b": "edge_b" }]
    }
  ],
  "versions": [
    {
      "id": "ver_...",
      "name": "Before adding cache",
      "createdAt": "ISO-8601",
      "branch": "main",
      "snapshot": { "nodes": [], "edges": [], "replicationPairs": [] }
    }
  ],
  "presentations": [
    {
      "id": "pres_...",
      "name": "Design Review",
      "createdAt": "ISO-8601",
      "slides": [{ "versionId": "ver_...", "title": "Before adding cache", "notes": "" }]
    }
  ]
}
```

`routing` is one of `straight` / `orthogonal` / `curved` / `magic` (see
4.4.1) — a magic-routed edge's actual path is never stored (it's
recomputed live from current node positions), so no extra field is needed
for it. `fromOffset`/`toOffset` (default `0.5`, each 0..1) are how far
along `fromSide`/`toSide` the edge actually anchors — see 4.4 and 4.15.
`labelPosition` (default `"middle"`, one of `start`/`middle`/`end`) is
where along the edge's own rendered path its label sits — see 4.4.
`destroyOffset` (default `null`, 0..1) and `activations` (default `[]`, each
`{id, startOffset, endOffset}`) are lifeline-only UML sequence-diagram
fields — see 4.15. `fragmentType` (default `null`, one of
`alt`/`opt`/`loop`/`par`/`critical`/`break`/`ref`) marks a node as a
combined-fragment box — see 4.15. `sequenceNumberOverride` (default `null`,
a positive integer when set) is the one deliberate exception to "sequence
numbers are purely derived, never persisted" — see 4.15.
`notes` (default `""`) is free-form text shown/edited in the connector's
own details-panel variant (4.6), and also surfaced as a hover tooltip on
the connector itself — see 4.4. `groupId` (default `null`) ties 2+ nodes
into a Group/Ungroup unit — see 4.3.1. `replicationExcluded` (default
`false`) and
`replicationPairs` (default `[]`, `edgeMembers` within it defaulting to
`[]`) drive Live Replication — see 4.14;
`mode` is one of `active-active` / `active-passive` / `primary-replica`,
purely descriptive, and `members` maps each side-A node id to its side-B
mirror's id. `monthlyCost` (default `null`) is an estimated US-dollar/month
figure — see 4.21. `versions` (default `[]`) and `presentations` (default
`[]`) are described in 4.17/4.18; a version's own `snapshot` is validated
exactly like the top-level `nodes`/`edges`/`replicationPairs` above (same
shared `validateContent` helper), and a presentation slide referencing a
version id that no longer exists is dropped on load.

### 4.56 AI Quick Start
A guided on-ramp for someone new to the app, reachable any time from
Create → "🪄 AI Quick Start" (not auto-triggered on first load — it's a
menu entry, not a first-run modal). Step 1, shown only when no automatic
AI send path is currently configured (see 4.53/4.54's
`isAutomaticSendConfigured`), nudges toward setting one up with a direct
link that opens Settings scrolled straight to the AI Providers section,
and can be skipped — every step from here on works with hand-off providers
regardless. Step 2 asks for a plain-language description of the system.
Step 3 builds a schema-anchored prompt (`buildQuickStartPrompt`, sharing
Generate Design from Spec's component-graph rules) and sends it the same
way every AI flow here does — hand-off or automatic. Step 4 parses the
reply and loads it onto the canvas exactly like Generate Design from Spec.

Unlike Generate Design from Spec, the wizard does not close once the
diagram loads. A final step shows the AI's own rationale for its choices:
one or two plain-language sentences on why the overall shape fits the
description, plus a one-line "why" for each component, matched back to
the node it describes by id. The AI is asked for this via a `rationale`
object alongside the normal `nodes`/`edges` in its JSON reply;
`validateProject` ignores unknown top-level keys, so `rationale` is read
separately from the same parsed response rather than becoming part of the
saved project. If the AI's reply omits it, the final step says so plainly
rather than showing an empty section.

### 4.57 Live Collaboration
Real-time two-person co-editing of the same diagram over WebRTC, with no
account and no signaling server of this app's own — reachable from
Tools → "🤝 Collaborate". Whoever sets up a session picks one of two
methods, and a role (host or guest):

- **Manual code exchange** — fully offline. A raw `RTCPeerConnection` +
  `RTCDataChannel`, non-trickle ICE (candidate gathering is capped at a
  few seconds rather than waiting indefinitely for a STUN response that
  may never arrive on a restrictive network), with the offer/answer
  exchanged as two short base64 codes copy-pasted by any channel the two
  people already have (chat, email, read aloud).
- **Quick room code** — a public broker (via the vendored PeerJS) finds
  the two browsers by a short, human-typable room code instead of a
  manual code exchange; the diagram itself still flows directly between
  the two browsers either way, same as the manual method.

Once connected, the whole project state is broadcast (debounced, so a
drag/resize gesture doesn't flood the channel) and applied on the other
side as a single, last-write-wins update — whichever edit lands later,
locally or remotely, wins. Applied via a coalesced store update rather
than a full project reload, so a stream of incoming remote edits doesn't
spam the local undo/redo history or reset the current selection/viewport.
A guest whose canvas already has content is warned before connecting,
since the host's diagram will arrive and take over. A small green badge on
the toolbar's "🤝 Collaborate" button shows a session is connected even
after the setup dialog is closed; the connection and its sync continue
running in the background either way. Scoped to exactly one host and one
guest. STUN-only (no TURN relay, since that needs a server) is a known
limitation — two devices on especially restrictive/symmetric NATs may fail
to connect via the manual method.

### 4.58 Import from Image
Create → "🖼️ Import from Image" reconstructs a diagram from a screenshot,
an exported diagram image, or a hand-drawn sketch. Same 3-step
prompt-and-paste mechanism as Generate Design from Spec (4.34): attach an
image, get a prompt built specifically for reading an attached image
(`buildImportFromImagePrompt`, sharing the same component-graph/shape
rules and few-shot JSON example), send it (hand-off or automatic), and
paste the reply back in to load it onto the canvas. The prompt asks the AI
to use every label actually visible in the image verbatim rather than
paraphrase or invent components not shown, and to infer each shape from
the image's own visual conventions where it can.

### 4.59 AI Design Review: Security Mode
A fourth mode ("🛡️ Security") in AI Design Review, alongside
Review/Explain/Suggestions (4.55). Unlike Suggestions, this mode is
offered even in hand-off-only setups — its whole point is a focused
checklist, not necessarily an automatic round trip, so the manual
copy/paste path is just as central here as the automatic one. The prompt
asks for a JSON array of findings, each tagged a severity (`high` /
`medium` / `low`) and covering: public exposure of something that
shouldn't be, missing encryption in transit/at rest, a weak or missing
authentication/authorization boundary, an exposed secret/credential, and
missing audit logging on a component that should have it. Findings render
grouped by severity (🔴/🟠/🟡) rather than a flat list, with no "+ Add"
action (a security finding isn't something to drop onto the canvas the
way a Suggestions "missing component" is). Same manual-paste retry
affordance as every other structured mode if the reply isn't valid JSON.

### 4.60 Auto-suggest (background trigger for AI-Powered Suggestions)
Settings → "🤖 AI Providers" gains a "🔁 Auto-suggest" toggle and an "every
N edits" number field, meaningful only once Direct API mode or Local AI
mode is actually usable (same `isAutomaticSendConfigured` check as
Suggestions itself — see 4.55) and shown with a clear warning otherwise.
When enabled, a store-change watcher counts distinct edits — a debounced
trailing edge of `change` events, so one drag/resize gesture or a burst of
label keystrokes counts as one edit, not one per frame/keystroke — and
once the configured count is reached, runs the Suggestions prompt in the
background (text-only, no canvas image, for efficiency) with no panel
needing to be open. Deliberately count-based, not a timer: someone away
from the keyboard for an hour shouldn't trigger an unprompted API call,
but someone who just edited a handful of components probably wants the
check. Off by default, since it's an unattended trigger that can incur
real cost in Direct API mode. A small badge appears on the toolbar's
"🤖 AI Design Review" button once a background check finds something;
clicking it opens the panel straight into Suggestions mode with the
findings already shown, and clears the badge.

### 4.61 Infrastructure-as-Code Exports
"🌐 Export to..." (4.9's export modal) gains three more Infrastructure-as-
Code targets alongside the existing Terraform export: **Pulumi**
(TypeScript), **CloudFormation** (YAML), and **Kubernetes manifests**. All
four follow the same curation philosophy: an AWS component with a real,
unambiguous mapping to a resource type becomes one; an AWS component
without a clean mapping, or a non-AWS component, is listed in a trailing
comment rather than guessed at; connectors between two mapped resources
are noted as a comment too, since dependency wiring varies too much by
target to auto-generate safely. The Kubernetes target is deliberately
narrower still — only the "Pod" component maps to a real
Deployment+Service manifest pair, since every other Containers &
Orchestration component (Docker, Helm, ...) is a labeled box with no
single obvious Kubernetes resource kind.

### 4.62 Diagram Animation: Auto-build + PPTX/Video Export
Two additions to Diagram Animation (4.36):

- **Auto-build after AI generation.** After Generate Design from Spec
  (4.34), AI Quick Start (4.56), or Import from Image (4.58) loads a
  diagram with 2 or more components, a small prompt offers to
  automatically build a "walkthrough" animation — one step per node, then
  one step per edge, in the exact order they appear in the generated
  project (the order an AI lists things in already reads as a narrative).
  The prompt lets the auto-advance delay (default 3 seconds) or a
  click-to-advance choice be set right there, before the animation is
  created; skipping it leaves the diagram exactly as generated, and the
  same animation can always be built by hand afterward.
- **Export to PPTX/video.** The Diagram Animation panel gains "🎬 Export to
  PPTX" and "🎥 Export to Video" buttons for the active animation. PPTX
  export produces one slide per step, cumulatively revealing more of the
  diagram than the last (PowerPoint's own per-shape entrance animations
  and per-slide auto-advance timing aren't something the vendored
  PptxGenJS exposes, so each step's intended timing is written into that
  slide's speaker notes instead, alongside any of the step's own presenter
  notes). Video export plays the animation back in real time as an actual
  `.webm` file (via the browser's native `MediaRecorder` and
  `canvas.captureStream()` — no vendored library needed); a step set to
  "click" gets a fixed 2-second dwell in the recording, since there's no
  presenter there to click for it.

### 4.63 AI Beautify Layout
A "🪄 AI Beautify Layout" button (Tools menu, disabled with a toast under
2 components) opens a 2-step wizard: a generated prompt asking an AI to
suggest new `{id, x, y}` positions for the existing diagram, then a paste
step that applies the result. Same copy/paste-hand-off/Direct-API/Local-AI
sending options as every other AI feature here. Only positions change —
shape, color, text, connectors are untouched — applied as one undoable
dispatch, then the view fits to the new layout.

### 4.64 Voice Dictation
Every AI-prompt textarea (AI Quick Start, Generate Design from Spec, Edit
with AI) gains a 🎙️ mic button wherever the browser's Web Speech API is
available; clicking it transcribes speech and appends it to the field's
existing content (never replacing it). No button appears at all when the
API isn't supported — no error, no disabled state.

### 4.65 AI-Narrated Diff & Cost Explanations
Two small AI hand-offs, both using a single shared "ask and read the
answer" modal (prompt + the usual hand-off/Direct/Local send options + an
answer field, no apply step):
- **Compare Versions** gains "💬 Explain this diff with AI", which asks
  the AI to narrate the structural diff (4.17) in plain language.
- **Cost Breakdown** (4.21) gains "🤖 Ask AI to reduce this cost", which
  asks for cost-reduction suggestions given the diagram's costed
  components and total.

### 4.66 New Component Categories: BPMN & UML Deployment; Networking Additions
- **BPMN (Business Process)** — 9 components (start/intermediate/end
  event, task, sub-process, exclusive/parallel/inclusive gateway,
  pool/lane) plus one ready-made "Approval Process" pattern.
- **UML Deployment** — Device and Execution Environment (both rendered
  with a new pseudo-3D `cuboid` shape, the classic UML deployment-diagram
  box) and Artifact (a sticky-note shape).
- **Networking** gains Bastion Host, IDS/IPS, Network ACL, and Switch.

### 4.67 Keyboard-Only Component Connect
A component can be selected via `Tab` alone (previously only a mouse
click could select one) using a `focus`-based listener, guarded against
double-firing from a mouse click's own focus side-effect. With exactly
one component selected, pressing `C` shows a numbered badge (1-9) on
every nearby component; pressing that number draws a connector to it,
identical to a mouse drag between connection points. `Escape` cancels.

### 4.68 Describe Diagram
"📃 Describe Diagram" (Tools menu) generates an instant, fully offline
plain-text summary of the diagram's structure — components grouped by
category with counts, a line per connection, and a line listing any
isolated (unconnected) components — shown in a read-only text area with a
"📋 Copy" button. No AI call of any kind. Phrases itself in terms of
"lifelines"/"messages" instead of "components"/"connections" when every
component in the diagram is a sequence-diagram lifeline (4.15).

### 4.69 Diagram Health Score
"🔍 Check Diagram" (4.16) gains a 0-100 score badge at the top of its
dialog, computed as `100 - findings.length * 10` (clamped to `[0, 100]`,
`100` labeled "Empty" for a diagram with zero components) — a simple,
deterministic function of the same findings list already shown below it,
not a separate analysis.

### 4.70 Version Branching
Diagram Versions (4.17) gain a lightweight branch field (`'main'` by
default for every existing/new version). A branch selector above the
version list appears once 2+ versions exist, filtering the list to the
selected branch. Two per-version actions: "🌿 Branch from here" (prompts
a new branch name, copies that version's snapshot onto it as a new
version) and "🔀 Merge into..." (prompts an existing branch name, same
copy operation). Both are an explicit "copy this content over," not a
diff-based structural merge of two branches' independent changes.

### 4.71 3D Presentation Mode
"🧊 3D Presentation" (Tools menu, disabled with a toast on an empty
canvas) renders the current diagram as a rotatable 3D scene in a
full-viewport overlay, for presenting rather than editing:
- **Components** become extruded, colored boxes — 2D canvas (x, y) maps
  to 3D (x, z); box height is a fixed per-shape constant; box color uses
  the component's stroke color (its 2D fill is a pastel tint, chosen for
  on-canvas text legibility, and would look washed out as a 3D surface). A
  sequence-diagram lifeline is the one exception: its 2D height is a time
  axis, not a real spatial footprint, so mapping it straight through like
  every other shape produced a box hundreds of units deep but only as tall
  as any other component — a giant slab wildly out of proportion with the
  rest of the scene. A lifeline instead renders as a tall pillar (a fixed,
  small footprint; a height taller than an ordinary component), anchored
  near the top of its 2D bounding box where its title box actually sits.
- **Connectors** become animated cable-like tubes, color-coded by flow
  direction purely from each edge's own geometry — one direction blue,
  the opposite direction red — so the same coloring rule always produces
  one blue and one red cable for two opposite-direction edges between the
  same pair of components, regardless of draw order.
- **Camera** is a hand-rolled orbit (drag to rotate, scroll to zoom) with
  a slow automatic rotation whenever the user isn't actively dragging.
  Opening the view auto-fits the camera distance and target to the whole
  diagram's real bounding box (not just node center points), so the
  diagram is always framed fully in view rather than clipped or
  overflowing the viewport. A "🎯 Reset View" button in the controls bar
  recenters and re-fits the camera at any time — there is no pan, only
  orbit and zoom, so this is the way back if the view ends up
  disorienting. The scene includes a ground plane, a grid, and cast
  shadows for a sense of scale and depth, rather than boxes floating in
  an empty void.
- **Playback.** If the diagram has a Diagram Animation (4.36), the
  overlay's Play/Prev/Next controls drive the same reveal sequence in 3D;
  while playing, visible components show ambient "thinking" particle
  effects and a subtly pulsing decal, for a sense of active processing.
  With no animation, the scene is just the static (auto-rotating) diagram.
- **Video export.** "🎥 Export 3D Video" records the 3D canvas to a
  downloadable video file — driving the Diagram Animation through in real
  time if one exists (each step's own on-screen duration, exactly like a
  live playback), or a fixed ~8-second ambient orbiting shot if not.
- Closing the overlay (✕ or `Esc`) returns to normal editing; nothing
  about the 3D view is itself saved as diagram data.

### 4.72 Demo Projects
"🎓 Demo Projects" (Create menu) opens a picker listing one ready-made
example diagram per diagram *kind* this app supports — a plain layered
system diagram, a highly-available replicated deployment, a sequence
diagram (4.15), a BPMN process (4.66), a UML deployment diagram (4.66),
an ER diagram, a state machine, a C4 Context diagram (4.52) — plus a
"Combo" demo placing a regular system diagram and a sequence diagram on
the same canvas at once, to demonstrate that different diagram kinds can
coexist. Clicking "Load" on a demo replaces the canvas (confirming first
if it isn't already empty, exactly like Generate Design/AI Quick Start);
the same modal's "🧹 Clear Canvas" button clears the canvas back to blank
regardless of whether a demo is currently loaded — no separate "is this a
demo" tracking exists, it's the same clear-canvas action available
everywhere else. Each demo is built from the exact same building blocks a
user would use interactively (an existing pattern's own node/edge
blueprint, or `core/sequenceDiagram.js`'s lifeline layout), so a demo
can't visually drift out of sync with what those mechanisms actually
produce.

### 4.73 In-App Guide Screenshots
`help.html` embeds real screenshots (`assets/screenshots/*.png`) of
several visually distinctive screens — the canvas with a sample diagram,
connectors/connection points, a sequence diagram, 3D Presentation Mode,
the AI Design Review panel, the Demo Projects picker, and the Command
Palette — alongside the existing prose, since some interactions (what the
3D view actually looks like, what a filled-in AI review prompt looks
like) are meaningfully clearer shown than described. Screenshots are a
static asset checked into the repo (no build step to generate them at
publish time), regenerated by hand via a throwaway Playwright script
whenever the screen they show changes enough to look stale — not every UI
tweak warrants a re-capture.

### 4.74 Blast Radius
Right-click any component → "🎯 Blast Radius..." shows what would be
affected if that component failed, computed purely from the diagram's own
connectors (`core/blastRadius.js`) — no AI. An edge `from → to` is read as
"`from` depends on `to`" (the same convention 4.34's client-straight-to-
database lint check assumes), so the modal lists two groups: "⬇️ Depends on
this" (nodes reachable by following connectors forward from the target —
they stop getting what it normally sends them) and "⬆️ Calls into this"
(nodes reachable by following connectors backward into it — their calls
start failing). Each listed component is clickable to jump to it; a
"🎯 Highlight all on canvas" button selects and frames the whole affected
set at once. A component with no connections reports that nothing would be
affected.

### 4.75 Interview Mode
"🎓 Interview Mode" (Tools menu) is a practice flow for system-design
interview questions: pick one of ten curated prompts (`core/
interviewPrompts.js`, Easy/Medium/Hard) and an optional time limit
(15/30/45/60 minutes, or none), then build the design on the canvas. A
toolbar badge shows a live countdown (or 🎓 for an untimed session). Once
ready, "🎓 Submit for Grading" builds a prompt combining the question and
this diagram's own offline plain-text description (4.68) and opens the
same generic AI hand-off/direct/local ask flow every other AI feature here
uses (`modals/aiAskModal.js`) — there is no separate automatic grading
pipeline, consistent with this app's honesty about what its AI features
actually do. The session (question, timer, start time) lives only in
memory (`core/interviewMode.js`) — it is not part of the project JSON and
does not survive a reload, the same way Live Collaboration's connection
state doesn't.

### 4.76 Import from URL/Gist
"🔗 Import from URL/Gist" (File menu) loads a diagram JSON hosted
elsewhere, the counterpart to 4.40's share link for when the file already
lives somewhere public rather than being encoded into a URL. A
`gist.github.com/...` link is resolved via GitHub's public gists API (no
auth needed for a public gist); any other URL is fetched directly and
expected to already return this app's JSON format (e.g. a GitHub "raw"
file link). A failure — bad URL, network/CORS error, invalid JSON, or JSON
that isn't a diagram this app understands — shows a clear, specific error
without touching the canvas. A successful fetch replaces the canvas,
confirming first if it isn't already empty (same pattern as 4.72/Generate
Design).

### 4.77 System Map
"🗺️ System Map" (File menu) is a visual graph of every saved diagram
(`io/projects.js#listSavedProjects`) and the cross-project links between
them (`project.links`, see `core/project.js`), laid out on a simple circle
(`core/systemMap.js`) — for a system diagram that's best understood
alongside a related one (a sequence diagram detailing one of its flows, a
separate DB schema diagram, ...). Any saved diagram can link to any other
by name with an optional label; clicking a diagram's node on the map loads
it (no confirm — same as the Load Project modal's own "Load" button,
unlike the wizard-style flows above). A link whose target was since
deleted is simply skipped when drawing the map rather than erroring. This
is not a nested-document/workspace system — every linked diagram is still
its own independent saved project.

### 4.78 Export PDF (Poster)
"🧩 Export PDF (Poster)" (File menu) splits the diagram across several
same-size pages (A4 or US Letter) meant to be printed and physically
assembled edge to edge into one large poster — the plain "📄 Export PDF"
(4.6) always scales the whole diagram onto a single page, which shrinks a
large diagram past legibility. Tiling math (`core/pdfTiling.js`) divides
the diagram's full rasterized bounds into a grid with a small overlap
between neighboring tiles so the printed sheets can be lined up by eye;
each page prints its own page number and grid position (e.g. "Page 3/6 —
row 1, col 3") in the corner to help reassemble them in order.

### 4.79 Review Status
"📝 Review Status" (Tools menu) sets a shared draft/in-review/approved
label on the current diagram (`project.reviewStatus`), with an optional
free-text name and a timestamp recorded on every change
(`project.reviewedBy`/`reviewedAt`). A colored toolbar badge always shows
the current status. This is explicitly a lightweight note for whoever else
opens the diagram, not a real permissions/approval system — this app has
no accounts to enforce one, the same honesty already applied to 4.70's
version branching being an explicit copy rather than a real structural
merge.

### 4.80 Feature Levels — Basic/Advanced/Custom
A "🧩 Feature Level" setting (Create → Default Settings, or the Command
Palette) controls how much of this app's Create/Tools/File dropdown
content is visible, without ever touching a diagram's own content:
- **Basic** — only a small, always-useful core shows (New/Save/Load, basic
  exports, AI Quick Start, Generate Design, undo/redo, zoom, Select/Hand
  toggle, and a few cosmetic prefs); everything else is hidden.
- **Advanced** — every action shows, this app's original behavior.
- **Custom** — pick exactly which of 7 themed groups (AI Tools, Diagram
  Types, Collaboration, Analysis & QA, Layout Tools, Visual & Presentation,
  Advanced Import/Export) show, independently.

The File/Create/Tools dropdown menus group their contents under these same
7 labeled sections regardless of the current mode — grouping the Tools
menu's many buttons is worth doing even when nothing is hidden. Every
action stays reachable through ⌘/Ctrl+K Quick Actions regardless of this
setting.

A brand-new visitor (nothing at all in this browser's storage yet) starts
in Basic mode with a compact sidebar (below) automatically; anyone who
already had this app open before this setting existed keeps their exact
existing toolbar/sidebar, nothing hidden — this is a one-time decision made
once per browser, never retroactive.

A Basic-mode visitor who's used the app for a few sessions (3, then 8, then
15) gets a small, dismissible one-time nudge suggesting they explore the
rest of this app's tools, linking directly to the Feature Level setting.
"Don't ask again" turns it off permanently; otherwise each milestone shows
at most once.

### 4.81 Compact Sidebar
A 🗂️ toggle above the component library (also in Default Settings) shows
only Favorites, Recently Used, and My Components by default, collapsing
the full category browser (~28 categories) one click away. Search always
searches every category regardless of this setting — it only affects what
shows without an active search.

### 4.82 Component Style Presets, Corner Radius, Border Style, Drop Shadow, Opacity, Size Presets
The per-node style editor (4.5) gains six new controls, all in the same contextual card:

- **Style Presets** — four buttons (⭐ Primary, 🗑️ Deprecated, 🌐 External, ✨ Highlighted) each set
  fill/border/border-width/border-style/drop-shadow/opacity together in one click (one undo step),
  same as any other style-editor edit. Not its own persisted field on the node — applying one is a
  one-time bundle of concrete values, not a live binding to "which preset."
- **Corner radius** — a numeric field (0-40px), shown only when the node's shape is `rect` or
  `rounded` (the only two shapes with a real CSS `border-radius`); unset (`null`) means "use that
  shape's own default radius."
- **Border style** — Solid/Dashed/Dotted. Like `strokeWidth`, this has no visible effect on
  diamond/hexagon/cylinder, whose outline is faked with clipped/pseudo-element layers rather than a
  real CSS border.
- **Drop shadow** — a checkbox for a stronger elevation shadow than every node's own baseline. Composes
  correctly with the existing hover/selection-ring shadows rather than replacing them.
- **Opacity** — 10-100%, for fading a node to indicate e.g. a planned-but-not-built component.
  Independent of, and composes with, Focus Mode's dimming and Diagram Animation's reveal/hide.
- **Size presets** — S/M/L buttons next to Width/Height for quickly matching a component to one of
  three common sizes (120×60, 160×84, 220×120), a shortcut rather than a new field.

### 4.83 AI / CLI Integration
Since this app is 100% client-side with no backend, "integrating" an external AI CLI
tool (Claude Code, or any other agent with its own model access) means giving it a
document it can read to learn this app's own JSON format, plus a zero-server way to
hand a generated diagram back to the user:

- **`docs/AI_INTEGRATION.md`** — a standalone guide, written for an AI agent, covering
  the full project JSON schema (nodes/edges, the sequence-diagram alternate shape),
  a complete example, and both delivery methods below. Discoverable via a root-level
  `llms.txt` (the emerging convention many AI tools check), the toolbar's Help menu
  ("🤖 AI / CLI Integration"), and the Command Palette.
- **Delivery method A — a direct share link.** The guide documents the exact
  gzip + base64url encoding this app's own "🔗 Share" feature already uses (4.8),
  with runnable Python/Node snippets, so a CLI tool with code execution can build a
  real, directly-clickable `#share=...` link itself — no copy/paste of raw JSON at
  all.
- **Delivery method B — paste or file import.** For a tool that can't run code: paste
  the JSON into "Generate Design from Spec" or "AI Quick Start"'s last step (which
  already extracts JSON from arbitrary surrounding text — 4.13), or save it as a
  `.json` file and use "⬆️ Import JSON" (4.8). Both paste-back boxes above **also**
  accept a share link pasted as plain text (bare hash or embedded in a full URL) —
  detected and decoded the same way method A's own link would be, so either output
  format works in the same box regardless of which the CLI could actually produce.

### 4.84 AI Conversation
An ongoing, reopenable back-and-forth about the current diagram (Create menu, or
Command Palette), unlike 4.38's ("Edit with AI") one-shot prompt-and-paste. The same
prepare/hand-off/paste-back mechanism, no API key, applies here too — this app has no
backend and cannot keep a live connection open to a browser chat tab or an AI CLI tool
invoked fresh each time — but every prompt this feature builds additionally embeds the
**entire prior transcript**, not just the new message:

- **Transcript persistence** (`io/aiConversationStore.js`) — every turn (the user's own
  message, and the AI's reply) is appended to a transcript stored the same way as
  4.83's own delivery mechanism needs no server: plain browser storage, not project
  data. Like 4.83's AI provider keys or usage stats, it's a browser/app setting, so
  it's excluded from JSON export, full backup (4.7.3), and duplicate-project — reopening
  the modal later resumes the same conversation regardless of which project happens to
  be open, and "🗑️ Clear conversation" empties it explicitly.
- **Prompt building** (`core/aiConversation.js#buildConversationPrompt`) — every prompt
  includes: (1) the most recent turns (capped, so a very long conversation's prompt
  doesn't grow without bound), each labeled `[You (the user)]:`/`[AI]:`; (2) the
  diagram's **current** state, always freshly read (never a frozen per-turn copy), so
  it reflects any updates applied earlier in the same conversation; (3) the new
  message. This is the only honest way a stateless AI — including an AI CLI tool that
  starts a fresh context on every invocation — can stay "aware" across turns: the app
  itself repeats the necessary context rather than any real memory existing on either
  side.
- **Replies** use the exact same PATCH JSON shape as 4.38's Edit with AI
  (`{addNodes, addEdges, updateNodes, updateEdges, removeNodeIds, removeEdgeIds}`),
  parsed and previewed the same way (`summarizePatch`) before an explicit "Apply
  update & continue" applies it as one undoable step. A reply can also be pure prose
  with no patch at all (e.g. answering a question) — the modal never assumes a change
  was intended.
- **Never auto-closes.** Unlike other AI wizards here, finishing a round returns to
  step 1 instead of closing the modal, since the point is an ongoing conversation, not
  a single edit.
- See `docs/AI_INTEGRATION.md`'s "Continuing the Conversation" section for the same
  protocol documented for an external AI/CLI tool reading it cold.

### 4.85 Working with CLI
A "🖥️ Working with CLI" dialog (Help menu, or Command Palette) directly answers two
things 4.83's guide itself can't: an AI CLI tool has no built-in way to discover this
specific app instance's address — there is no API, registry, or DNS trick that hands
a generic CLI tool a URL it was never told — and even once it has the bare address, a
plain domain doesn't tell it *which file* to read, since there's no universal
convention that makes a generic CLI check `/llms.txt` just because it was handed a
URL. So the dialog's primary, first action is a ready-to-copy prompt that already
names the exact file to fetch (`<address>llms.txt`), computed from the *live*,
auto-detected base URL of the page actually running right now (stripping a trailing
`index.html`, working correctly for GitHub Pages, a custom domain, or a local dev
server) — removing all guesswork from the one manual step this app's zero-backend
design can't avoid. The bare address is still offered, demoted to a secondary "Copy"
fallback for someone building their own request.

### 4.86 AI Chat
A "🤖 AI Chat" panel (Tools menu, or Command Palette) — a fast, in-app live chat with
whichever automatic AI mode is configured (4.53 Direct API mode, or Local AI mode),
for anyone who doesn't want 4.84's copy/paste hand-off wizard. Genuinely useless
without an automatic mode configured (there's no live chat without one), so it shows
a setup nudge instead until one is. Deliberately shares the exact same underlying
transcript as "🗨️ AI Conversation" (4.84) — both are the same ongoing conversation
about the diagram, just two different UIs on top of it, so switching from hand-off to
live chat (or back) mid-conversation carries every prior turn along. A reply can
propose a diagram update using the same patch format as Edit with AI (4.38),
previewed and applied inline right under the message that proposed it. Resizable in
every dock mode (drag the left edge docked-right, top edge docked-bottom,
bottom-right corner while floating), with the picked size persisted per mode.

Unlike every other side panel in this app (always docked to one side), this one can
be positioned three ways: docked to the right (in-flow, like AI Design Review),
pinned as a drawer along the bottom, or dragged anywhere on screen as a floating
card — the last-used floating position is remembered.

### 4.87 Automatic/proactive assists and editing conveniences
A batch of small, deliberately unobtrusive additions:

- **Smart default connector labels** — a freshly-drawn connector guesses a sensible
  default label from what its two ends actually are (a curated category-pair table
  plus a few name-based rules for gateways/queues, `core/smartEdgeLabels.js`), e.g.
  "reads/writes" for a backend service into a database, "routes to" from a load
  balancer, "publishes to"/"delivers to" around a queue depending on which side it's
  on. Never overrides a label already set by the user; skipped for a sequence-diagram
  message (those are read by their numbered badge, not a label).
- **Smart duplicate naming** — duplicating a component auto-increments its name
  ("Auth Service" → "Auth Service 2", `core/duplicateNaming.js`) instead of leaving
  an identical-looking twin. `duplicateEntireCanvas` (a whole-canvas mirror) opts out,
  since renaming every node there would just be noise.
- **"Fit to selection"** — the toolbar's "⛶" fit button (`toolbar/zoomControls.js`)
  fits just the current selection once something is selected
  (`canvas.js#fitToSelection`), falling back to fitting the whole diagram otherwise.
- **"🔎 Find & Replace"** (Tools menu, or Command Palette) — renames a term across
  every component/connector label and notes field in one undoable step
  (`core/findReplace.js`), with "match case" and "include notes" options and a live
  match count before committing.
- **"📌 Manage Pinned Toolbar Actions"** (Command Palette) — pin any action from the
  Command Palette's own index (`commandPaletteModal.js#buildAppCommands`) as an
  always-visible toolbar button, reorderable, via a second toolbar row
  (`toolbar/pinnedActionsBar.js`) hidden until at least one action is pinned.
- **"🔔 Diagram Nudges"** (Tools menu, on by default) — a quiet badge on the "🔍 Check
  Diagram" toolbar button the moment a *new* finding appears (`io/lintWatcher.js`),
  debounced the same way as the AI auto-suggest watcher but entirely deterministic —
  no AI/API call, so it needs no configuration and stays on by default. Only ever
  notifies once per newly-appeared finding per session; toggling it back on after
  disabling doesn't retroactively flag whatever was already wrong.

### 4.88 Tools dropdown: search, collapsible sections, tooltip audit
Three usability additions scoped to the Tools dropdown specifically — this app's
longest (5 labeled sections, 24+ buttons):

- **Search** — a "Search actions..." box (`toolbar/toolbarDropdown.js`'s opt-in
  `searchable: true`) live-filters the panel's buttons by their visible text and
  title as you type. A whole section disappears (label included) once none of its
  buttons match; a section the user has collapsed still surfaces a match inside it
  (force-opened for display only, its persisted collapse choice untouched). Clears
  itself and refocuses every time the dropdown reopens. Shows "No matching actions."
  when nothing matches.
- **Collapsible sections** — each of the Tools dropdown's 5 labeled section headers
  (`toolbar.js#buildGatedButtonList`) is now a clickable toggle with a ▾/▸ chevron;
  collapsing hides that section's buttons (not its label) and persists per-section
  (`io/uiPrefs.js#collapsedToolsSections`) across reopening the dropdown and reloading
  the page. File and Create's own labeled sections are unaffected — plain, non-
  interactive headers, since neither dropdown is long enough for collapsing to help.
- **Tooltip completeness** — every Tools-dropdown button already carried a
  descriptive `title` before this batch except "🤖 AI Design Review" (just its own
  name, no explanation), fixed here to match the rest ("AI Design Review: get an AI
  critique of this diagram — review, explain, suggestions, or a security-focused
  pass").

### 4.89 Fix Text Display + passive edge-label wrapping
Every edge label now wraps onto multiple lines instead of overflowing or rendering
hidden behind other content (`core/labelWrap.js#wrapLabelLines`, a fixed
average-char-width estimate rather than live DOM measurement, kept consistent
with this app's other pure/testable layout math) — rendered as stacked `<tspan>`
children under the label's existing `<text>` (`canvas/connector.js`), inheriting
the same fill/stroke/white-halo legibility styling automatically.

"🔤 Fix Text Display" (Tools → Layout Tools, or ⌘K) is a one-click, undoable
action that re-spaces content just enough for wrapped labels to actually have
room, without moving anything that doesn't need it:
- **Sequence diagram** (any lifeline on the canvas) — re-spaces every message's
  height along its lifeline(s) proportional to how tall its own wrapped label
  renders (`core/sequenceDiagram.js#spaceMessagesForLabels`), scaling every gap
  down together if the total would overflow the lifeline's usable height. Unlike
  "↔️ Distribute Evenly" (which forces every gap equal), a message with a longer
  label gets proportionally more room than a short one.
- **Any other diagram** — nudges the two ends of a labeled connector directly
  apart along the line between their centers, splitting the shortfall evenly
  (`core/labelSpacing.js#spreadNodesForLabels`), only when the label's wrapped
  width doesn't already fit in the gap between them.
A toast explains what happened (or that there was nothing to fix, or to add at
least one/two items first). This is what makes an out-of-the-box template like
"PKCE Authorization Flow" — several long messages sitting close together —
display its text cleanly with one click.

### 4.90 Show Descriptions toggle
A new "📖 Show Descriptions" button at the end of the always-visible toolbar
row (appended last, same width-safety reasoning as the canvas search box next
to it) toggles `io/uiPrefs.js#showActionDescriptions` (off by default). When
on, every dropdown-panel button (File/Create/Tools/Help) also renders its own
`title` tooltip text inline as a small line under its label
(`toolbar/toolbarDropdown.js#updateButtonDescription`), so browsing a long menu
like Tools doesn't require hovering one button at a time to see what each one
does — handy on a touch device too, where hover tooltips barely exist. The
inline description is appended as its own child span rather than overwriting a
button's content, so a button that already has its own child elements (e.g.
"🔍 Check Diagram"'s lint-nudge badge) keeps them. The native `title` tooltip
is unaffected either way — this is purely an additional, opt-in display.

### 4.91 Explain This Diagram
Every node created by instantiating a library pattern/template
(`canvas.js#instantiatePatternAtPoint`) now carries `sourcePatternId` (which
pattern) and `patternInstanceId` (a fresh id per instantiation, so dropping the
same template twice never conflates the two copies) — provenance metadata,
separate from and orthogonal to the pre-existing `groupId` visual-grouping
mechanism, round-tripped through save/reload/import like any other node field
(`core/project.js#validateContent`).

Right-click any node that carries a `patternInstanceId` (or open its details
panel and use the "About this diagram" section there) and choose "📖 Explain
This Diagram" for a deterministic, offline, per-template counterpart to
"📃 Describe Diagram" (4.68's whole-canvas summary): a curated title/description
from the original pattern's own def, every one of its components listed with
its own curated library description (surfaced for the first time — every
component already carries one, `data/schema.js#c`'s `description` field, that
nothing showed the user before this), and a numbered step-by-step read of how
it flows — sequence-numbered messages in vertical order for a sequence-diagram
template, plain "A → B" connection lines otherwise (`core/groupExplanation.js`,
`modals/groupExplanationModal.js`). A "📋 Copy as text" button copies the whole
explanation as plain text.

### 4.92 Diagram Animation: Add All, bulk mode-change, Auto-Play Diagram
Three additions rounding out Diagram Animation (4.36) editing:
- **"+ Add All"** (panel's "Add more" section, alongside "+ Add Selected as one
  step") adds every remaining component/connector as its own separate step, in
  canvas order, in one click and one undo entry
  (`canvas.js#addAllToActiveAnimation`) — the bulk sibling of adding items one
  at a time.
- **Bulk mode-change** — "Set all steps to: ⏱️ Auto-play / 🖱️ Click" (panel's
  step list) changes every step's reveal mode in the active animation at once
  (`canvas.js#setAllStepsRevealMode`), instead of opening each row's own
  Auto/Click dropdown individually. Switching a step into 'auto' that has no
  delay set yet gives it the same 2s default a hand-added step would get;
  switching to 'click' leaves any configured delay untouched so switching back
  restores it rather than resetting.
- **"🪄 Auto-Play Diagram"** (Tools → Visual & Presentation, or ⌘K) builds a
  full walkthrough animation from *every* node/edge currently on the canvas —
  reusing the same `core/animationAutoBuild.js#buildAutoWalkthroughAnimation`
  logic already offered after an AI-generation flow (4.62's auto-build prompt)
  — and starts playing it immediately, replacing whichever animation was
  already active. No manual "add to animation" or per-step configuration is
  needed first; this is the "just show me the whole thing" one-click path,
  distinct from "+ Add All" (which builds into the *current* animation for
  further hand-editing rather than playing right away).

## 7. Out of scope for v1 (ideas for later, see PLAN.md §7)

Versioned history beyond in-session undo/redo (superseded by 4.17/4.63
branching), cloud sync, PNG→SVG re-import.
