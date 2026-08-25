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
- **Combined fragments**: four "Fragment" shapes (Alt/Opt/Loop/Par) in the
  Sequence Diagram Templates sidebar category — a plain resizable/movable
  labeled box (same mechanism as the Group/Container shape, 4.3.x) with a
  `fragmentType` baked into its definition, rendered as a small UML
  pentagon operator tag at its top-left corner plus the condition text
  (its own label). One condition per box — no alt/else divider line.
  Drop one behind the messages it encloses (right-click → Send to back).
- **Ready-made sequence-diagram templates**: the "Sequence Diagram
  Templates" sidebar category also offers whole ready-made flows — Login
  Flow, OAuth Handshake, Checkout Flow, Retry with Backoff, PKCE
  Authorization Flow, SCIM User Provisioning, MFA Challenge, RBAC/ABAC
  Authorization Checks, SSO (SAML/OIDC), SPA Silent Token Refresh, API Key
  Authentication, TCP 3-Way Handshake, UDP Request/Response, Password Reset
  Flow, Passwordless Magic Link Login, WebAuthn/Passkey Authentication,
  OAuth Client Credentials (M2M), WebSocket Handshake & Messaging, Webhook
  Delivery with Retry, Circuit Breaker Pattern, Cache-Aside Pattern, Saga
  Pattern (Choreography), and Idempotent Request Handling — clicking or
  dropping one instantiates the whole lifeline+message cluster at once,
  already grouped (4.15's drill-down zoom-in works immediately). A relevant
  template is also offered as a Smart Suggestion (4.12) when placing a
  component like OAuth/OIDC, SSO, Identity Provider, API Gateway, JWT, API
  Key, Cognito, React, Router, Redis Cache, WebSocket Server, Email
  Service, Webhook, Payment Gateway, Circuit Breaker, or Saga Coordinator —
  accepting it instantiates the template positioned next to that component
  (not attached onto it, unlike a layer suggestion) — and a template can be
  dragged from the sidebar directly onto an existing node for the same
  effect.
- **Export as Mermaid**: a sequence diagram's drill-down modal (above) has a
  "📋 Copy as Mermaid" button — converts its lifelines, messages (mapped to
  Mermaid's `->>`/`-)`/`-->>` arrow syntax by dash+arrowhead), activation
  bars (`activate`/`deactivate`), destroy markers (`destroy`), and any
  fragment box whose bounds overlap the group (`alt`/`opt`/`loop`/`par` ...
  `end`) into Mermaid `sequenceDiagram` text on the clipboard. Best-effort,
  not a lossless round-trip — Mermaid has no offset-anchored messages or
  freely-positioned fragments of its own.

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
      "label": "HTTPS", "labelPosition": "middle", "notes": ""
    }
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
`alt`/`opt`/`loop`/`par`/`ref`) marks a node as a combined-fragment box —
see 4.15.
`notes` (default `""`) is free-form text shown/edited in the connector's
own details-panel variant (4.6), and also surfaced as a hover tooltip on
the connector itself — see 4.4. `groupId` (default `null`) ties 2+ nodes
into a Group/Ungroup unit — see 4.3.1. `replicationExcluded` (default
`false`) and
`replicationPairs` (default `[]`, `edgeMembers` within it defaulting to
`[]`) drive Live Replication — see 4.14;
`mode` is one of `active-active` / `active-passive` / `primary-replica`,
purely descriptive, and `members` maps each side-A node id to its side-B
mirror's id.

## 7. Out of scope for v1 (ideas for later, see PLAN.md §7)

Real-time multi-user collaboration, versioned history beyond in-session
undo/redo, cloud sync, PNG→SVG re-import, AI-assisted auto-layout.
