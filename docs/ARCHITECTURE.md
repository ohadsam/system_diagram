# Architecture

## Runtime model

Static site, zero build step. `index.html` loads `js/main.js` as an ES
module; every other JS file is imported via native `import`/`export`.
Browsers supported: latest Chrome/Edge/Firefox/Safari (all support ES
modules, `<dialog>`, pointer events, CSS custom properties — no polyfills
shipped).

```
index.html ──► js/main.js
                 ├─ core/store.js        (state + pub/sub)
                 ├─ core/history.js      (undo/redo snapshots of store)
                 ├─ core/replication.js  (live "keep two sides mirrored" engine, run from store.js)
                 ├─ data/index.js        (component library, pure data)
                 ├─ sidebar/sidebar.js   (reads data/index.js, writes via store)
                 ├─ canvas/canvas.js     (reads store, renders nodes+edges, writes via store)
                 ├─ toolbar/toolbar.js   (reads store selection, writes via store)
                 ├─ panel/detailsPanel.js
                 ├─ panel/aiReviewPanel.js
                 ├─ panel/outlinePanel.js (searchable canvas table-of-contents)
                 ├─ panel/animationPanel.js (Diagram Animation's step list/editor)
                 ├─ core/kioskMode.js    (Presenter Mode's on/off pub-sub)
                 ├─ core/animationPlayback.js (Diagram Animation's step-through state machine)
                 ├─ canvas/animationOverlay.js (Diagram Animation's floating playback controls + draw layer)
                 ├─ modals/*.js          (incl. modals/generateDesignModal.js, modals/replicationModal.js, modals/sequenceDiagramModal.js)
                 ├─ io/*.js              (localStorage, file, image/pdf export, incl. io/projectTabs.js, io/duplicateTabWarning.js, io/exportAnimation.js)
                 └─ hints/hints.js
```

## State flow

`core/store.js` exposes:

- `getState()` — returns the current immutable-by-convention project state.
- `dispatch(mutatorFn, opts)` — runs `mutatorFn(draftClone)`, runs the
  result through `core/replication.js#syncReplication()` (mirrors any
  replication-pair changes the mutator just made — see "Live Replication"
  below), pushes a history snapshot (unless `opts.coalesce` is set, used
  for high-frequency drag updates), then calls `emit('change', state)`.
- `subscribe(fn)` — every UI module subscribes once at init and re-renders
  only the DOM it owns. No module queries another module's DOM nodes.
- `select(nodeIds, edgeIds)` — updates `state.selection` and emits
  `'selection'` separately from `'change'` so the toolbar can react without
  a full canvas re-render.

This is intentionally a tiny hand-rolled Redux-like pattern — no external
state library needed for this app's scale.

## Undo/redo (`core/history.js`)

Snapshot-based: `history.commit(state)` deep-clones (via
`structuredClone`) and pushes onto an undo stack (capped at 50), clearing
the redo stack. Drag/resize interactions call `store.dispatch(fn, {
coalesce: true })` on every pointer-move frame but only commit one history
entry on pointer-up, so undo of a drag is a single step.

**`store.loadProject()` vs. `store.dispatch()` — not interchangeable for
"replace the project's content".** `loadProject()` calls `history.init()`,
which *replaces* `undoStack`/`redoStack` wholesale rather than pushing onto
them — correct when genuinely switching to a different project (New,
Duplicate as new project, Load), where the old project's edit history has
nothing to do with the new one and undo shouldn't reach across the
boundary. But it means anything that calls `loadProject()` to modify the
*current* project's content (rather than switch identity) silently
discards undo entirely — `canvas.js#clearCanvas()` deliberately calls
`store.dispatch((draft) => { draft.nodes = []; draft.edges = [];
draft.replicationPairs = []; })` instead, which — like any other
non-coalesced dispatch — commits a normal history entry, so Ctrl/Cmd+Z
genuinely restores everything. Found because the toolbar's "🆕 New" button
already made (and still makes) an "Undo brings it back" claim in its
confirm dialog that isn't actually true for *its* mechanism — accepted
there since New is intentionally a project-switch (a fresh id, so there
being no way back to the old project via undo is arguably correct — the
old project is still separately autosaved/saved under its own id, just not
reachable via Ctrl/Cmd+Z from the new one), but worth knowing before
reaching for `loadProject()` as a shortcut for "clear the current
project's content" anywhere else in the future.

### Visual undo/redo timeline (`core/historyLabels.js`, `modals/historyTimelineModal.js`)

"🕘 Undo History" (File menu) lists every entry in `history`'s undo/redo
stacks at once, with an auto-generated human-readable label per step, and
lets you jump straight to any one of them instead of pressing undo/redo
repeatedly. Two additions make this possible without changing what
`history.js` actually stores:

- `history.getTimeline()`/`jumpTo(index)` — `getTimeline` just concatenates
  `[...undoStack, current, ...redoStack.slice().reverse()]` into one
  chronological array (plus the current index within it); `jumpTo` moves
  `current` to any index by popping/pushing the same two stacks the normal
  `undo()`/`redo()` already use, the right number of times — it's built
  entirely out of the existing stack-movement primitives, not a new
  mechanism.
- `core/historyLabels.js#describeHistoryStep(prev, next)` — pure, and
  reuses `core/diagramDiff.js#computeDiagramDiff` rather than reimplementing
  change-detection, turning its structural diff into a label like `Added
  "API Gateway"`, `Moved 2 components`, or `Restyled 3 components` (joining
  multiple categories with `, ` when a step changed more than one kind of
  thing). Purely derived for display — nothing here is persisted, so
  labels can't go stale and are naturally correct after any jump.

## Canvas rendering (`canvas/`)

- Nodes render as absolutely-positioned `<div class="node">` elements
  inside a transformed `#canvas-content` layer (`translate(x,y) scale(z)`
  drives pan/zoom — GPU-accelerated, no per-node re-layout on pan/zoom).
- Edges render into a single `<svg>` overlay sibling of the node layer,
  one `<path>` (+ optional `<text>` for the label) per edge, recomputed
  whenever an endpoint node moves. Arrow-heads are SVG `<marker>` defs,
  one marker per (type × color) combo, cached by key so repeated colors
  don't duplicate markers.
- `nodeInteractions.js` and `connectorInteractions.js` own all
  `pointerdown/move/up` handling; they read/write `store` and never touch
  other modules directly.
- **Grouping & mixed selection**: `canvas.js#selectNode` expands a
  non-additive click on a grouped node (`node.groupId` set) to select
  every node sharing that `groupId`, so a group behaves as one selectable/
  movable unit without `nodeInteractions.js#beginMove` needing to know
  about groups at all — it just moves `store.getSelection().nodeIds`,
  which is already the whole group by the time it runs.
  `groupSelection()`/`ungroupSelection()` set/clear `groupId` on the
  current selection; `duplicateSelection()` remaps each distinct source
  `groupId` to one fresh id per duplication, so copies form their own
  group rather than joining the original. `beginMarquee()` additionally
  selects any edge whose *both* endpoints landed in the drag rect, and
  `duplicateSelection()`/`deleteSelection()` both operate over the full
  `{nodeIds, edgeIds}` selection together, not nodes only.

### Connector routing (`canvas/connector.js`, `core/magicRouter.js`)

`connector.js#buildEdgePath` picks the path builder by `edge.routing`:
`straight`/`curved` go through the pure, stateless `core/geometry.js#buildPath`
as literal styles, unaffected by obstacles. `'orthogonal'` (the default) and
`'magic'` **both** now run `core/magicRouter.js#computeMagicWaypoints(fromNode,
toNode, obstacles, fromSide, toSide)` — a DOM-free, unit-testable,
grid-based least-turns router (obstacles = every other node's rect, from
`canvas.js#render`'s `allNodes` passed through `updateEdgeEl`'s options). It
quantizes the bounding area between the two nodes into a grid sized so the
cell count stays under a fixed cap regardless of canvas scale, then runs a
0-1 bucket-queue Dijkstra over `(cell, last-direction)` states — 0 cost to
continue straight, 1 to turn — to find the path with the fewest bends, then
collapses it to just its turning points and appends the two nodes' exact
anchor points. If it can't find a route in budget (or the grid would be too
large) it returns `null`, and `buildEdgePath` falls back to a plain
`buildPath('orthogonal', ...)` route rather than leaving the connector
broken. Nothing about the computed path is persisted on the edge — it's
derived fresh every render straight from current node positions, exactly
like every other routing already is, so a routed edge re-routes live as
nodes move and can never go stale.

Every freshly-drawn connector therefore gets obstacle-avoiding routing by
default now. The toolbar's old "🪄 Magic Arrow" toggle — which pre-armed
the *next* connector to get `routing: 'magic'` instead of the default —
had become fully redundant once `'orthogonal'` started doing the same
obstacle-avoiding path computation (see `buildEdgePath` above, which
branches on `edge.routing === 'magic' || edge.routing === 'orthogonal'`
identically), so it was removed: `connectorInteractions.js`'s
`magicModeActive`/`setMagicMode`/`isMagicModeActive` are gone, and
`buildQuickCreateGroup` in `toolbar.js` now renders just "Add Shape". The
`'magic'` routing *value* itself was kept — it still exists as an explicit
per-edge choice in the arrow editor's Routing dropdown and still gets its
own `.edge-magic` CSS glow (`css/connector.css`) for anyone who wants that
look deliberately; only the pre-arm-before-drawing toolbar button, which
never did anything the default didn't already do, was removed.

**Anchor-side selection** (`core/geometry.js#pickBestSides(fromRect,
toRect)`): a pure, symmetric function that picks which side of each
component a connector should anchor on, from the two components' actual
relative position (comparing the real gap between their edges along
whichever axis has one, falling back to a center-delta comparison if the
rects overlap on both axes) — not from whichever literal connection point a
user happened to drag from/to. Used both when drawing a brand-new connector
(`connectorInteractions.js#beginConnectFromNode`'s pointerup handler) and
when `autoArrangeAll()` (below) repositions every node and needs to re-pick
every edge's sides to match.

**Anchor-point offset** (`core/geometry.js#sideAnchor(rect, side, offset =
0.5)` / `#computeAnchorOffset(rect, side, point)`): `sideAnchor` used to
always return a side's exact midpoint; it now takes a third `offset`
argument (0..1 along the side) so an edge can land anywhere along its
anchored side, not just dead center — every call site
(`magicRouter.js#computeMagicWaypoints`, `connector.js#updateEdgeEl`,
`connectorInteractions.js`) defaults it to `0.5`, so this is additive and
every pre-existing diagram renders identically. `computeAnchorOffset` is
the inverse — given a side and a canvas-space point, the clamped 0..1
fraction along it — used by `beginConnectFromNode` to turn the actual
grab/drop point into a real, non-default offset instead of discarding it.
For an ordinary small connection-point dot (which *is* positioned at the
midpoint) this comes out to `~0.5` regardless, so normal diagrams are
unaffected in practice; a tall shape can expose a full-height connection
strip instead (see "Database cylinder shape"'s sibling section below,
`data-shape="lifeline"`), letting several connectors land at different,
deliberate heights on the same node instead of colliding at the midpoint —
the mechanism the Sequence Diagram feature (below) is built on.

One correctness subtlety `beginConnectFromNode`'s `onUp` handler has to get
right: `pickBestSides` (above) can choose a *different* final `fromSide`
than whichever side was actually grabbed (e.g. the user grabbed `left` but
the two nodes' relative position means `top` reads better) — so the
edge's `fromOffset` is *not* computed once at grab time against the grabbed
side and reused; it's (re-)computed in `onUp`, against `sides.fromSide`
(the side pickBestSides actually settled on), from the original grab point.
Reusing an offset computed for one axis (e.g. "40% of the way down a
left/right edge") against a different final axis (top/bottom, "40% of the
way down" makes no sense there) would silently misapply a Y-fraction as an
X-fraction or vice versa — clamped so it can't go out of bounds, but
visually wrong. `toOffset` has no equivalent issue since `sides.toSide` is
already known by the time the drop point is available.

## Sequence diagrams (`core/sequenceDiagram.js`, `modals/sequenceDiagramModal.js`, `canvas.js#createSequenceDiagram`)

A UML-style sequence/communication-flow diagram, built almost entirely out
of existing mechanisms rather than a parallel diagram type:

- **Lifeline** is just another node `shape` (`data-shape="lifeline"` in
  `css/node.css`) — a titled box pinned at the top (`::before`, needs its
  own small stacking context via an explicit `z-index: 0` on `.node-body`
  since there's no `clip-path` here to establish one implicitly the way
  diamond/hexagon get for free) and a thin dashed vertical line spanning
  the rest of the height (`::after`, outline-only like the cylinder shape's
  pseudo-elements, so no stacking-context trick needed for it). Its
  `data/categories/shapes.js` entry sets `textPosition: 'top', iconVisible:
  false` — the exact same "a shape def's own textPosition/iconVisible wins
  over the user's global default" mechanism the "Group / Container" frame
  shape already established (see "A component's own textPosition/
  iconVisible default" below) — plus a tall `defaultSize`.
- Its left/right `.conn-point` connect-handles are CSS-overridden to be
  full-height strips (`height: 100%`) instead of every other shape's small
  centered dot — this is *what* lets a user grab/drop a message at an
  arbitrary height, feeding a real offset into `computeAnchorOffset` above
  instead of a dot that's always at the midpoint anyway. Top/bottom
  connect-points are left as ordinary small dots (unused in practice for a
  horizontal sequence diagram, but harmless).
- **Messages are ordinary edges** — nothing new in the schema for "this
  edge is a message" as a concept. `beginConnectFromNode`'s `onUp` handler
  special-cases exactly one thing when both endpoints turn out to be
  `shape === 'lifeline'`: it defaults the new edge's `routing` to
  `'straight'` (an elbow jog would look wrong for a direct message) — the
  offset-based anchoring itself is the shape-agnostic mechanism above, not
  lifeline-specific code.
- **Auto-numbering** (`canvas.js#computeMessageSequenceNumbers(edges,
  nodesById)`): computed fresh in the `render()` pass, not stored — filters
  edges to lifeline-to-lifeline ones, sorts by each edge's real anchor Y
  position (`sideAnchor(fromNode, edge.fromSide, edge.fromOffset)`), and
  hands each `updateEdgeEl` a 1-based `sequenceNumber` that
  `connector.js#createEdgeEl` renders as a small numbered circle
  (`.edge-seq-badge`) at the message's start point. Being purely derived
  means it can never go stale and needs no migration — it's automatically
  correct after undo/redo, adding/deleting a message, or loading an older
  project that predates this feature. It's also exported and reused as-is
  by `panel/detailsPanel.js`'s edge-details variant (below) to show "Message
  N" there, rather than duplicating the ordering logic.
- **The wizard** (`modals/sequenceDiagramModal.js`) is a self-contained,
  non-store-backed dynamic form — a local `names` array mutated in place
  by each row's `textInput` `onChange` (no re-render per keystroke, so
  nothing needs `rerenderPreservingUiState`'s focus-preservation dance;
  only add/remove-row buttons trigger a full `rerender()`, and losing focus
  on a button click is a non-issue). "Create" validates (2+ non-empty
  names) at click time, rather than keeping a live-disabled state in sync
  with typing — the simpler design, given the form never needs to react to
  a name edit itself. Follows `replicationModal.js`'s established
  `sdb:open-sequence-diagram` window-event pattern for consistency with
  the rest of this dropdown's wizards.
- `core/sequenceDiagram.js#layoutLifelines(names, centerX, centerY, size)`
  is the pure, DOM-free layout math (even spacing, centered on a point) —
  same "pull the pure math into its own tested module" precedent as
  `canvas/groupBackgrounds.js#computeGroupBounds`.
  `canvas.js#createSequenceDiagram(names)` is the thin dispatch wrapper —
  resolves the `shape-lifeline` def, calls `layoutLifelines`, builds nodes
  via `createNode`, one `store.dispatch`, `store.select(...)` — the exact
  same shape as `instantiatePattern`/`instantiatePatternAtCenter`. It
  creates *only* the lifelines; messages are drawn afterward by the user
  with the ordinary connect gesture.
- `autoArrangeAll()` (below) bails out early (with a toast) if any node on
  the canvas is `shape === 'lifeline'`, rather than letting
  `computeAutoLayout` scramble a sequence diagram's meaningful horizontal
  layout — see that section for where the guard sits.

### Self-messages (`connector.js#selfLoopPath`, `connectorInteractions.js`, `edgeReconnect.js`)

A lifeline calling itself (e.g. internal validation before a real call
out) — `edge.from === edge.to`. Nothing new in the schema: the loop shape
comes entirely from `fromOffset`/`toOffset` differing (two distinct heights
on the same lifeline) with `fromSide === toSide` (both ends exit the same
side, which is what makes the "out, across, back in" loop shape correct —
`pickBestSides` would instead see two identical, fully-overlapping rects
and default to right/left, drawing a flat line straight *through* the
lifeline). `connector.js#buildEdgePath` special-cases `fromNode.id ===
toNode.id` before reaching any routing-specific branch (self-loops ignore
`routing` entirely — magic/orthogonal have no gap between two different
nodes to route around here).

`connectorInteractions.js#beginConnectFromNode`'s target-detection normally
excludes the source node itself (`nodeElUnder.dataset.nodeId !== nodeId`);
self-connect is allowed only when the source is a lifeline (`allowSelf =
fromNode.shape === 'lifeline'`) — every other shape's single connect-point
dot would make a self-drop a same-point no-op anyway, so there's no reason
to allow it there. `edgeReconnect.js#beginReconnect` (below) applies the
identical `fromSide` used for both ends when the target of a reconnect
drag turns out to be the connector's own fixed endpoint.

### Drag-to-reconnect an edge endpoint (`canvas/edgeReconnect.js`)

A selected edge grows two small round handles at its exact `sideAnchor`
points; dragging one moves *only* that end (to a different node, or a
different height on the same lifeline) — the other end's side/offset is
never touched. Mirrors `connectorInteractions.js`'s draft-line-while-
dragging approach but starts from an existing edge's fixed endpoint instead
of a node's connection point, and (unlike drawing a fresh connector)
dropping on empty canvas cancels rather than deleting anything.

**Gotcha — the handles need their own DOM layer, not the edge's own `<g>`.**
The first version put the two handle `<circle>`s inside `connector.js`'s
per-edge `<g>` (`.edge-layer`). A handle sits *exactly* at the edge's
anchor point, which for a node/lifeline is also exactly where that node's
own `.conn-point` full-height hit-strip lives (css/node.css) — and since
`.node-layer` is appended *after* `.edge-layer` in `canvas.js#initCanvas`,
the node's connection point always won the pointer hit-test, so "dragging
the handle" actually grabbed the node underneath and drew a brand-new
connector instead (confirmed live: edge count went from 1 to 2 on every
attempted reconnect). Moving the handles into their own overlay SVG
(`edgeHandleLayer`) appended *after* `.node-layer` fixed the DOM-order part
of this — but wasn't sufficient on its own: every `.node` carries an
**explicit numeric `z-index`** via inline style (`node.js#updateNodeEl`,
used for "bring to front"/"send to back"), and per CSS2.1 Appendix E, a
positioned descendant with an explicit z-index paints above *any* sibling
left at the default `z-index: auto` — regardless of DOM order — once that
descendant's ancestor (`.node-layer`) doesn't itself establish a stacking
context (it doesn't; no z-index of its own). So a node's z-index could
still float above the handle overlay if it had ever been brought to front.
Fixed by giving `.edge-handle-layer` a very high fixed `z-index` (100000)
so it wins regardless of how high any node's own z-index climbs — see
`css/connector.css`'s comment on `.edge-handle-layer` for the full
reasoning. Worth remembering for *any* future overlay meant to sit above
arbitrary canvas content: DOM order alone is not enough once z-indexed
siblings are in play.

`syncEdgeHandles(state, selection)` rebuilds the overlay's contents (cheap
— a couple of DOM nodes per selected edge) and is called from both
`canvas.js#render()` (data changed) and `renderSelectionOnly()` (only the
selection changed) — same "handle both change and selection updates
separately" split every other selection-reactive piece of `canvas.js`
already follows.

### "Distribute Evenly" (`core/sequenceDiagram.js#distributeLifelineColumns`/`#distributeMessages`, `canvas.js#distributeSequenceDiagram`)

A tidy-up action (Tools menu), not a replacement for auto-arrange (which
sequence diagrams opt out of entirely, above). Two independent pure
functions, both order-preserving:

- `distributeLifelineColumns(nodes)` re-spaces every lifeline to the
  wizard's own `GAP`, anchored on the leftmost lifeline's current `x` (so
  the diagram doesn't visibly jump), sorted by current `x` — never touches
  `y`.
- `distributeMessages(nodes, edges)` re-spaces every message's height,
  preserving the same top-to-bottom order `computeMessageSequenceNumbers`
  already derives (built from the same `sideAnchor(...).y` sort). A
  non-self message contributes one shared point (both ends land at the
  same height — real messages are drawn horizontal); a self-message (above)
  contributes *two* independent points, since its start and end genuinely
  need to differ for the loop shape to survive redistribution.

### Zoom-in / drill-down on a sequence diagram (`modals/subDiagramModal.js`, `canvas/subDiagramEdit.js`)

Reachable via a 🔍 icon on a *sequence-diagram group*'s background box
(`canvas.js#getSequenceDiagramGroups()` — any `groupId` whose members are
2+ nodes, all `shape === 'lifeline'`; purely derived from existing
`groupId`+`shape` fields the same way `computeMessageSequenceNumbers` is,
so nothing new needed persisting or round-tripping through JSON import/
export for this to work).

- **Read-only preview** (`subDiagramModal.js#renderGroupSnapshot`): reuses
  `node.js`/`connector.js`'s own `createNodeEl`/`updateNodeEl`/
  `createEdgeEl`/`updateEdgeEl` directly — they're plain functions that
  build/update one element from a node/edge object, no store coupling in
  the render path itself — rather than a second hand-rolled renderer. Those
  builders *do* wire up their own click/dblclick/select handlers
  internally though (shared module-level `handlers` in each file, the same
  ones the real canvas configured), so the whole preview sits under
  `pointer-events: none` (`css/canvas.css`) to keep it genuinely read-only;
  disabling pointer events is what neutralizes them, not a parallel inert
  copy of every handler. The group's nodes are shifted (not the real ones —
  plain object copies) so its own top-left corner becomes the preview's
  origin, and the whole thing is CSS-`transform: scale()`d to fit a fixed
  preview box.
- **"✏️ Edit"** (`subDiagramEdit.js#enterSubDiagramEdit`): reuses the
  *entire* existing canvas/store/undo machinery instead of a second
  parallel mini-editor — the group's own nodes+edges are temporarily
  swapped in as the whole active project via `store.loadProject()`
  (everything else stashed in a closure variable), the real canvas renders
  and edits them completely normally, and a fixed banner overlay
  (`.subdiagram-edit-banner`) is the only thing marking "you're editing a
  sub-diagram, not the main one." "✅ Done editing" merges the (possibly
  edited/added/deleted) subset back into the stashed parent project — a
  brand-new node created during the edit has no `groupId` at all
  (`createNode`'s default), so it's assigned the group's `groupId` on
  merge so it doesn't silently fall out of the sequence diagram.
  `replicationPairs` are excluded from the swapped-in project (nothing
  useful to reconcile scoped to just one group) and restored verbatim from
  the stashed snapshot on exit, untouched by whatever happened during the
  edit.
  **Known, accepted limitation** (not engineered around, given how narrow
  it is): using New/Load/Import while a sub-diagram edit is in progress
  abandons the stashed parent project when "Done" is later clicked, since
  by then `store.getState()` no longer holds the group's content at all.
  The banner's wording steers away from this rather than specially
  disabling those toolbar buttons for the session, which would need
  touching many more call sites for a case a user is unlikely to hit by
  accident.
- **Pin** (`subDiagramModal.js#pinGroup`): docks the same read-only
  snapshot renderer in a small fixed-position panel
  (`.subdiagram-pin-host`, lazily created once, appended to `document.body`
  rather than wired into `index.html`/`main.js` — self-contained, no new
  mount point needed) instead of a modal, live-updating on every store
  change via its own `store.subscribe('change', ...)` until unpinned.
- **Export** (`io/exportImage.js`, `io/exportPdf.js`): reuses the *real*
  canvas capture technique, not the preview renderer above, for pixel-
  perfect fidelity with the main export. `captureDiagramCanvas({nodeIds})`
  is `captureDiagramCanvas()`'s general-purpose "capture just this subset"
  variant — `canvas.js#hideExcept(nodeIds)` temporarily hides every node/
  edge element not in the subset (plus the group-background and edge-
  handle layers entirely) for the duration of one `html2canvas` capture,
  restored in a `finally` block, same save-and-restore shape
  `captureDiagramCanvas` already used for the viewport/pan-zoom state.
  `exportPNG` downloads the main PNG then one more per sequence-diagram
  group; `exportPDF` appends one more PDF page per group the same way.

**Gotcha — a group's background icons can render *behind* the toolbar.**
`.group-bg-dismiss`/`.group-bg-zoom` originally sat at `top: -10px`,
poking slightly above the group-background box's own top edge (a small,
deliberate overhang so they read as corner badges). A freshly-created
sequence diagram's lifelines are 640px tall and vertically centered on the
current view by `layoutLifelines` — on an ordinary desktop viewport that
routinely puts a chunk of the lifeline's top *above* `.canvas-viewport`'s
own visible area (`overflow: hidden` there, so it's simply clipped/
invisible, same as scrolling past it). The group-background box inherits
that same off-screen top from `computeGroupBounds`, so grouping a
just-created sequence diagram and immediately reaching for its 🔍/✕ icons
(before panning/fitting to screen) could find them clipped away entirely —
not mis-positioned, genuinely invisible, since `.canvas-viewport` starts in
normal page flow right below the toolbar rather than being overlaid by it
(confirmed via `getBoundingClientRect()`: the toolbar occupies real page
space, `.canvas-viewport` begins right after it — the icon's calculated
position was simply *above* that visible region). Fixed by moving both
icons to sit a few pixels *inside* the box's own top-right corner (`top:
4px`) instead of overhanging above it, so they can never end up outside
whatever region of the box is actually visible/clipped. A real user hits
this the same way the automated test did: create a sequence diagram, group
it immediately, try to click its icon before scrolling/fitting to screen —
"Fit to screen" (already a toolbar button) is the natural way out of it,
same as for any other content that starts outside the current view.

### Message style presets (`toolbar/arrowEditor.js#renderMessagePresets`)

A `<select>` (not buttons — see the gotcha below) added to the single-edge
arrow style editor only when both endpoints are `shape === 'lifeline'`,
mapping one choice to a `dash`+`startArrow`+`endArrow` combo applied via the
existing `updateAll` dispatcher: Sync call (`solid`/`none`/`filled`), Async
call (`solid`/`none`/`open`), Return (`dashed`/`none`/`open`). Deliberately
not bound to the edge's current values — a fresh "Apply a preset..."
placeholder every render, since it's a one-shot action not a stored field of
its own.

**Gotcha — three buttons, not a dropdown, broke an unrelated existing e2e
test by making the floating contextual row taller.** The first
implementation used three `<button>`s. That grew the floating style row
(`toolbar.js#positionFloatingRow`, biased to render *below* the selected
edge's own anchor rect) by one field's worth of height — enough that on a
short two-lifeline test fixture, the row's own bottom edge now reached down
into the second drag target's drop point, silently swallowing the second of
two scripted message-draw gestures. Switching to a single compact
`<select>` fixed the immediate collision, but the row's height is
inherently a moving target as more fields get added over time — the test
was also hardened to `Escape` (deselect) between the two drags rather than
relying on there being enough clearance, so it can't regress the same way
again from some *other* future addition.

### Destroy marker (`canvas.js#setLifelineDestroyOffset`/`#clearLifelineDestroyOffset`, `canvas/node.js`)

`node.destroyOffset` (0..1, `null` when unset) — set via right-click →
"Mark destroyed here", computed from the actual click height through
`core/geometry.js#computeAnchorOffset` (the same point→offset inverse a
dragged connector endpoint uses), so the X lands exactly where clicked
rather than a fixed spot. Rendered as a real DOM element
(`.lifeline-destroy-marker`, always present but `display: none` unless
`.has-destroy-marker` is set) rather than a third pseudo-element on
`.node-body`, since that element already uses `::before` (the title box)
and `::after` (the dashed line) — no third pseudo-element slot left. Its
position (and the dashed line's shortened `height`) both read a
`--destroy-y` CSS custom property set on the *root* `.node` element, not
`.node-body` — `--node-fill`/`--node-stroke` are only ever defined on
`.node-body` itself, and the marker is a `.node-body` *sibling*, not a
descendant, so a variable scoped there wouldn't reach it.

### Activation bars (`canvas.js#addActivationBar`/`#removeActivationBar`, `canvas/nodeInteractions.js`, `canvas/node.js`)

`node.activations: [{id, startOffset, endOffset}]` — added via right-click
→ "Add activation bar" (a default-length span centered on the click
height, clamped into `[0,1]`), removed via right-click *on an existing bar*
→ "Remove activation bar" (`canvas.js#openNodeContextMenu` checks
`evt.target.closest('.lifeline-activation')` to tell the two cases apart).

Rendered into a `.lifeline-activations` container that's fully **rebuilt on
every `updateNodeEl` call** rather than created once like the resize
handles/conn-points, since the *count* varies (unlike those, which are
always exactly 4/4). That has one real consequence: **drag handlers are
wired via delegation on the root `.node` element, not per-bar
`addEventListener`** (`nodeInteractions.js#attachNodeInteractions`'s single
`pointerdown` listener inspects `e.target.closest('.activation-handle')` /
`.lifeline-activation`) — a per-element listener would go stale (silently
stop firing) the moment a re-render swapped in fresh DOM nodes mid-drag,
which a rebuild-every-render container makes an ongoing risk, not a
one-time setup concern. `IGNORE_SELECTOR` (the same constant that already
excludes `.resize-handle`/`.conn-point` from triggering whole-node
drag-to-move) also excludes `.lifeline-activation`, so grabbing a bar never
also starts moving the whole lifeline underneath it.

Both gestures (`beginActivationMove`/`beginActivationResize`) convert a
screen-space pointer delta to a fraction of *that lifeline's own height*
(`dy / n.h`), not a fixed pixel span — the same `screenToCanvas`-then-divide
pattern `beginResize` already uses for ordinary resize handles, so dragging
stays correct at any zoom level. Move preserves the bar's length (both
offsets shift by the same delta, clamped so the span never runs off either
end); resize clamps each end independently with a small `MIN_ACTIVATION_SPAN`
floor so a bar can never be dragged down to zero height.

### Combined fragments (`data/categories/sequence-templates.js`'s `fragment()` helper, `core/project.js#FRAGMENT_TYPES`)

Deliberately **not** a new node `shape` — a fragment box reuses the plain
`rect` shape (same mechanism the "Group / Container" shape already uses,
including "drop it behind the messages it encloses, right-click → Send to
back") plus one new node field, `fragmentType` (`alt`/`opt`/`loop`/`par`/
`critical`/`break`/`ref`, `null` for every ordinary node). Six sidebar items
(Alt/Opt/Loop/Par/Critical/Break Fragment) each carry their own
`fragmentType` baked into their component def; `createNode`/`schema.js#c()`
propagate `def.fragmentType` the same way they already special-case
`def.textPosition`/`def.iconVisible` — a structural property of *that
specific shape def* that should always win over whatever global
new-component defaults the user has configured, unlike an ordinary per-node
style field.

Rendered as a small pentagon-shaped tag (`clip-path: polygon(...)`) pinned
to the box's top-left corner, `node.js` toggling `.has-fragment-tag` the
same on/off pattern as the destroy marker above. One condition per box
(`node.text`, renamed the same way as any node) — no alt/else divider
line, a deliberate simplification (see `docs/SPEC.md` 4.15).

**Which messages a fragment "contains" is never stored** — a fragment box
isn't structurally linked to the messages it visually overlaps (no
`groupId`, no edge references); "what's inside it" is entirely a geometric
question, answered fresh each time something needs to know (currently just
the Mermaid exporter below, via `core/geometry.js#rectsIntersect` against
each candidate message's two endpoint anchor points). This mirrors the same
"purely derived, computed at render/use time" convention `getSequenceDiagramGroups`/`computeMessageSequenceNumbers` already established — nothing to keep in sync, nothing that can go stale after a fragment or a message gets dragged.

### Ready-made templates + Smart Suggestions for patterns (`data/categories/sequence-templates.js`, `data/index.js#getRelatedPatterns`, `canvas/suggestions.js`, `canvas.js#instantiatePatternNearNode`)

The 36 sequence-diagram templates (Login Flow, OAuth Handshake, ..., Social/
Federated Login, Step-Up Authentication) are ordinary `definePattern(...)` entries — the exact
same "instantiate a whole blueprint at once" mechanism `design-patterns.js`
already uses for e.g. the API Gateway pattern, with `groupOnInstantiate:
true` (schema.js) so the result lands as a real group immediately (🔍
zoom-in works right away, no separate "now go group these" step). Their
`nodes`/`edges` use the raw `{key, defId, dx, dy}` / `{from, to,
overrides}` spec shapes directly rather than the `n()`/`e()` convenience
helpers `design-patterns.js` mostly uses — those helpers don't forward
`fromOffset`/`toOffset`, and every message in a sequence-diagram template
needs a distinct one (see `sequence-templates.js`'s own header comment) or
they'd all stack on the lifeline's midpoint.

**Smart Suggestions gained a third row.** `data/schema.js#c()`'s
`relatedPatterns` (parallel to the existing `related`/`relatedLayers`) is a
curated list of pattern ids a component suggests — e.g. placing "OAuth /
OIDC" offers "OAuth Handshake" and "PKCE Authorization Flow".
`canvas/suggestions.js#showSuggestionsFor` reads it via
`data/index.js#getRelatedPatterns` and renders a "🔀 Sequence diagrams for
X" row alongside the existing companion-component and attach-a-layer rows;
accepting one calls `canvas.js#instantiatePatternNearNode(patternDefId,
nodeId)` — **not** `onAddLayer`, since a pattern isn't attached onto the
node the way a layer is, it's instantiated as its own separate grouped
diagram beside it.

`instantiatePatternNearNode` is also what a pattern sidebar item dropped
directly onto an existing node now does (`sidebar/dragSource.js` — same
hover-highlight affordance the drag-a-layer-onto-a-node flow already has,
`.pattern-drop-target` instead of `.layer-drop-target`, a solid purple
outline instead of the layer row's dashed green to read as a visually
distinct kind of drop). Positioning it correctly needs more than a flat
pixel offset from the target node's right edge: `instantiatePatternAtPoint`
(the refactored-out core of `instantiatePattern`, now shared by both the
screen-space and canvas-space-point call paths) places each pattern node at
`center.x + spec.dx - w/2`, so the template's own *leftmost real edge*
relative to its own center can be well left of `dx = 0` depending on how
many lifelines it has and how wide they are — a fixed margin computed
without accounting for that undershoots for a wider template and
overshoots for a narrower one. `instantiatePatternNearNode` instead computes
each pattern's actual leftmost edge (`min(spec.dx - w/2)` over its own
nodes) and solves for the center point that clears the target node's right
edge by a fixed margin regardless of the template's shape.

### Export as Mermaid (`io/exportSequenceMermaid.js`, `modals/subDiagramModal.js`)

`buildSequenceMermaid({nodes, edges, allNodes})` is pure/DOM-free (mirrors
`core/sequenceDiagram.js`'s own layout helpers) — the modal just writes its
return value to the clipboard. Every event (a message, an activation
start/end, a destroy, a fragment start/end) gets a `y` and is sorted
together into one timeline, the same "compute order from vertical anchor
position" approach `canvas.js#computeMessageSequenceNumbers` already uses
for message badges — reusing `core/geometry.js#sideAnchor` for messages so
the ordering is consistent with what the badges themselves show.
Overlapping-but-not-properly-nested fragments (a layout Mermaid's own
strict nesting can't represent) fall back to a simple stack — pop whichever
open fragment id an `end` event names, wherever it sits in the stack,
rather than requiring strict LIFO — a best-effort textual export, not a
guaranteed-valid-Mermaid guarantee for adversarial layouts. Dash+arrowhead
maps onto Mermaid's three most common arrow forms using the exact same
three combinations the message-preset dropdown above offers (`solid`+
`filled` → `->>`, `solid`+`open` → `-)`, anything else → `-->>`), so a
template built from those presets round-trips predictably.

**Gotcha — this batch's four new node-only fields (`destroyOffset`,
`activations`, `fragmentType`) weren't reaching a replicated peer.**
`core/replication.js`'s `MIRROR_FIELDS` is an *allowlist* (unlike
`signature()`'s change-detection, which spreads the whole node and so
already "saw" these fields fine) — adding a field to a node's schema
doesn't automatically propagate it to a live-mirrored peer just because
`validateProject`/`createNode` know about it. `destroyOffset`/`fragmentType`
were added straight to `MIRROR_FIELDS`; `activations` needed the same
fresh-id-per-side treatment `subComponents` already gets (`mirrorActivations`
helper, since an activation carries its own `id` used to look up which one
a drag is resizing) rather than a plain verbatim copy. Caught in this
batch's own review pass, not by a user report — worth specifically
rechecking `MIRROR_FIELDS`/`EDGE_MIRROR_FIELDS` any time a future batch adds
a new node or edge field, since nothing enforces the allowlist staying in
sync with the schema.

### Export as PlantUML (`io/exportSequencePlantUML.js`)

A second, self-contained export format offered right next to "📋 Copy as
Mermaid" in the same drill-down modal. Deliberately **not** refactored to
share code with `exportSequenceMermaid.js` — the event-collection/sorting
logic is duplicated between the two files rather than extracted, since each
format's own line-formatting (participant declaration syntax, arrow tokens,
indentation) is simple enough to read standalone, and the existing Mermaid
exporter already had passing tests before this batch that a shared-code
refactor would risk regressing for a modest de-duplication win. Same
dash+arrowhead → sync/async/return mapping as the Mermaid exporter, just
PlantUML's own tokens (`->`/`->>`/`-->` instead of `->>`/`-)`/`-->>`);
`alt`/`opt`/`loop`/`par` ... `end` block keywords happen to be identical
between the two formats.

### Swimlane/box grouping in Mermaid+PlantUML export (`computeGroupBounds` in both `io/exportSequenceMermaid.js` and `io/exportSequencePlantUML.js`)

A plain "Group / Container" shape (`data/categories/shapes.js#shape-group`)
whose x-range overlaps one or more lifelines wraps them in that format's own
swimlane syntax (Mermaid's `box "Label" ... end`, PlantUML's `box "Label"
... end box`) around the whole participant declaration block for those
lifelines. Deliberately **x-range containment against each lifeline's
center-x**, not a full rect-intersection test against the group box's
actual height — a swimlane groups *participants* (columns), not a time
range, so whether the group box happens to be short or tall doesn't matter,
only which lifelines it visually sits above/behind. Both exporters extract
the identical `computeGroupBounds(nodes)` helper (was inline duplicated
logic before this batch) since the group-detection logic itself needed to
be identical between the two formats, unlike the rest of each file's
line-formatting which is deliberately kept separate (see the "Export as
PlantUML" gotcha above on why these two files don't share code in general).

### Manual sequence-number override (`js/modals/promptModal.js#promptNumber`, `canvas.js#setSequenceNumberOverride`/`#computeMessageSequenceNumbers`)

A **deliberate, singular exception** to this app's "sequence numbers are
purely derived, never persisted" architecture principle (see
`computeMessageSequenceNumbers` above and the badge-numbering description in
docs/SPEC.md 4.15): `edge.sequenceNumberOverride` (nullable positive
integer, default `null`) is a genuinely stored field the numbering badge
shows instead of the computed rank when set, without renumbering its
neighbors. Right-click a lifeline-to-lifeline message for "Set sequence
number..." (opens `promptNumber`, a `promptText`-style modal helper using a
`<input type="number">` instead of text) or "Clear sequence number
override" (shown instead once set). `connector.js#updateEdgeEl` toggles an
`.is-override` class on the badge circle so an overridden number is visibly
distinct (a different fill color) from an auto-computed one — otherwise
there'd be no way to tell "the app computed 3" from "someone deliberately
set 3" just by looking at the canvas.

**Same `EDGE_MIRROR_FIELDS` allowlist gotcha as the destroy/activation/
fragment fields above applies here too** — `sequenceNumberOverride` was
added to `core/replication.js#EDGE_MIRROR_FIELDS` explicitly; a plain
integer field with no per-entry `id` of its own, so (unlike `activations`)
a verbatim copy to the mirrored peer is correct, no fresh-id regeneration
needed.

### Import from Mermaid (`io/importSequenceMermaid.js`, `core/sequenceDiagram.js#layoutImportedSequenceDiagram`, `canvas.js#createSequenceDiagramFromMermaid`, `modals/importSequenceMermaidModal.js`)

The inverse of "📋 Copy as Mermaid" — reachable from the Create dropdown's
"📥 Import from Mermaid" wizard (a plain textarea + Import button, same
action-modal shape as `sequenceDiagramModal.js`). Three-stage pipeline:

1. **`parseSequenceMermaid(text)`** (pure) — line-by-line regex parsing into
   `{participants: [{id, label}], events: [...]}`, where each event is one of
   `message`/`activate`/`deactivate`/`destroy`/`fragmentStart`/`fragmentEnd`.
   Participants can be declared explicitly (`participant X as Y`) or
   auto-declared from the first message that mentions them — real
   hand-written/exported Mermaid text often omits the declarations, and
   this mirrors how Mermaid itself behaves. `else`/`and` branch dividers are
   read and skipped (no per-branch concept in this app's own fragment model
   — one condition per box, see the combined-fragments section above) rather
   than treated as a parse error.
2. **`layoutImportedSequenceDiagram(parsed, centerX, centerY, size)`** (pure,
   in `core/sequenceDiagram.js` alongside `layoutLifelines`) — turns that
   into concrete lifeline rects, edge specs, per-participant activation bars,
   destroy offsets, and fragment-box rects. Mermaid text has no explicit
   vertical position, only line order, so every event is spread evenly down
   the lifelines' height in the order it appears (a self-message consumes
   two "slots" — its own start and end height — everything else consumes
   one), the same "assign an even 0..1 offset per event" idea
   `distributeMessages` already uses for "Distribute evenly", just computed
   once at import time instead of on demand. A fragment's box width spans
   only the participants a message *inside* it actually touched (tracked via
   an open-fragments stack while iterating events) — not every lifeline in
   the diagram — falling back to spanning all of them only if the fragment
   enclosed zero messages.
3. **`createSequenceDiagramFromMermaid(parsed)`** (canvas.js) — the only
   stage that touches the store: creates lifeline/fragment nodes and message
   edges via the ordinary `createNode`/`createEdge` + one `store.dispatch`,
   sets a shared `groupId` so the result is immediately a real sequence-
   diagram group (🔍 zoom-in works right away), same shape as
   `createSequenceDiagram`/`instantiatePatternAtPoint`.

### Sidebar hover-preview thumbnail (`sidebar/patternPreview.js`)

Hovering (or keyboard-focusing) a Sequence Diagram Templates sidebar item
shows a small SVG sketch of its lifelines and messages — `isSequenceDiagramPattern(def)`
gates which items get this (any `kind: 'pattern'` whose every node is a
`shape-lifeline`, the same definition `componentData.test.mjs`'s own template
integrity test uses) rather than checking `categoryId`, so it stays correct
if a future template ever lived in a differently-named category. The popup
itself is appended straight to `document.body` (fixed-positioned, computed
from the hovered item's `getBoundingClientRect()`) rather than inside the
sidebar's own DOM, since the sidebar's `overflow: auto` scroll container
would otherwise clip it.

**Gotcha — `sidebar.js#renderList()` tears down and rebuilds every sidebar
item on each keystroke** (see its own header comment: expanding/collapsing a
category, editing the search, custom components changing, ...). If a preview
popup was showing when that happens, the item it was anchored to gets
removed without its own `mouseleave`/`blur` ever firing — the mouse never
actually left, its target just vanished out from under it — leaving the
popup stuck on screen. Fixed by having `renderList()` call the exported
`hidePatternPreview()` unconditionally at the top of every rebuild, not just
relying on the hover/focus handlers' own cleanup. Caught in this batch's own
UI/UX review pass by deliberately testing "hover a template, then type in
the search box" rather than just the show/hide path in isolation — worth
specifically re-testing for any future feature that opens a floating
element anchored to a sidebar item, since this rebuild-tears-down-the-DOM
behavior isn't obvious from reading `attachPatternPreview` alone.

## Whole-diagram export: Mermaid flowchart, draw.io, Lucidchart (`io/exportFlowchartMermaid.js`, `io/exportDrawIO.js`, `modals/exportDiagramModal.js`)

A different export scope than the sequence-diagram-only Mermaid/PlantUML
exporters above — these two cover the *entire* canvas (every node/edge, not
scoped to one group), reached via "🌐 Export to..." (File menu). Both
builder functions are pure/DOM-free, each mapping this app's own shape/dash/
arrow vocabulary onto the target format's own — a small `switch` per node
shape and a small `switch`/ternary per edge dash+arrowhead combination, with
an explicit fallback (plain rectangle / no-equivalent styling) for any shape
neither format has a native match for (`note`, `rows`, `lifeline`, `cloud`
depending on the target). Documented as **best-effort, not a lossless
round-trip** in each file's own header comment — deliberately so, rather
than silently dropping unsupported shapes or throwing.

"Lucidchart-compatible export" reuses `exportDrawIO.js`'s output as-is
rather than being a fourth format: Lucidchart's own importer accepts
draw.io/diagrams.net XML files, and — unlike Mermaid Live Editor and draw.io
itself — Lucidchart has no public "open with pre-loaded content" URL
scheme, only file uploads. So its "🔗 Open Lucidchart" button downloads the
same `.drawio` file and opens `lucid.app` in a new tab rather than a truly
one-click "already loaded" experience the other two providers get.

`modals/exportDiagramModal.js` reuses the established "copy prompt/content
to clipboard, then `window.open(providerUrl, '_blank', 'noopener')`, then
toast instructing paste/import" pattern first seen in
`modals/generateDesignModal.js#openProvider` and
`panel/aiReviewPanel.js#openProvider` — same shape, applied to a file
download instead of a clipboard-only handoff for the draw.io/Lucidchart
buttons. The downloaded file uses a `.drawio` extension (not `.xml`) even
though the content is the same either way — draw.io/Lucidchart both accept
either extension, but naming it `.drawio` matches what the button copy
actually promises ("Download .drawio file").

## Share link (`io/shareLink.js`, `modals/shareLinkModal.js`, `main.js#boot`)

A "read-only-in-spirit" share link — the whole project JSON, gzip-compressed
via the native `CompressionStream`/`DecompressionStream` (no bundled
dependency; confirmed available as Node.js globals too, which is what makes
`tests/unit/shareLink.test.mjs` possible without a browser) and
base64url-encoded into the URL's hash fragment (`#share=...`). There's no
backend to host anything — "sharing" just means handing someone a URL whose
hash *is* the diagram; opening it loads a local copy into their own browser.
It's "read-only" only in that it doesn't sync back to the sender, not
because it's locked — the recipient's local copy is freely editable same as
any other diagram, exactly like the sequence-diagram drill-down's own
"read-only until you press Edit" distinction elsewhere in this app.

`main.js#boot()` was converted from sync to `async` to check `location.hash`
for a share link *before* falling back to the normal
`restoreAutosavedProject()` path, then calls `history.replaceState` to strip
the hash after loading so a page reload doesn't silently re-import the same
link over whatever the user has since done. A malformed/undecodable hash (or
one that fails `validateProject`) falls through to the normal autosave-
restore path rather than erroring, same "degrade gracefully" posture as
every other import path in this app.

## Diagram Lint (`core/diagramLint.js`, `modals/diagramLintModal.js`)

`computeDiagramLint(nodes, edges, replicationPairs, resolveDef)` is pure/
DOM-free — `resolveDef` is dependency-injected (a plain `(defId) =>
{categoryId, name}|null` function) rather than imported directly, so the
module stays unit-testable without pulling in `data/index.js`/
`io/customComponents.js` (which touch `localStorage`) — `diagramLintModal.js`
is the only caller that passes the real `canvas.js#resolveComponentDef`.
Three checks, chosen to be low-false-positive and textbook-recognizable
rather than exhaustive (see docs/SPEC.md 4.16 for the checks themselves and
the reasoning against a broader/more opinionated linter).

**Gotcha found in this batch's own review pass**: the orphan-connectivity
check (#2) initially flagged the plain "Group / Container" shape
(`shape-group`) as an unconnected component whenever it shared a canvas with
other wired-up nodes — but that shape is *purely a visual boundary box you
drop behind other components*, explicitly documented (its own component
description) as never meant to have an edge of its own. Fixed by excluding
`node.defId === 'shape-group'` from that check alongside the existing
lifeline/fragment exclusions. Worth remembering for any future structural
check here: this app has a few node "kinds" (lifelines, fragment boxes, the
group/container shape) that deliberately opt out of the normal
"every node should connect to something" assumption, and a good check needs
to know about all of them, not just the sequence-diagram ones.

## ER-diagram design patterns (`data/categories/design-patterns.js`)

Three new `definePattern(...)` entries (One-to-Many, Many-to-Many with Join
Table, Self-Referencing) reusing this library's existing `shape: 'rows'`
component (`shape-server-rows`) via a local `entity(key, dx, dy, title,
attributes)` helper that sets `overrides: {icon, rows, w, h}` — confirming
`spec.overrides` flows through `instantiatePatternAtPoint` into the final
`createNode()` call the same way any other pattern's per-node overrides do.
The self-referencing pattern is the first pattern in this app with exactly
one node (an Employee entity referencing its own `manager_id`) and a
self-loop edge (`from === to`) on a *non*-lifeline shape — confirmed safe by
reading `connector.js#buildEdgePath`'s `if (fromNode.id === toNode.id)
return selfLoopPath(...)` branch, which is shape-agnostic; only the
*interactive drag gesture* for creating a self-loop is lifeline-gated
(`connectorInteractions.js`'s `allowSelf`), not the rendering path, so a
pattern's raw edge-spec data can safely include one for any shape.
`componentData.test.mjs`'s "every pattern needs ≥2 nodes" assertion was
relaxed to allow exactly 1 node when every one of its edges is self-
referencing.

**Not** wired into `relatedPatterns` (Smart Suggestions) from the Databases
category components, despite an obvious pairing (PostgreSQL/MySQL/... →
"ER: One-to-Many Relationship" is exactly the kind of pairing that
mechanism exists for) — `canvas/suggestions.js`'s pattern-suggestion row
label is hardcoded to "🔀 Sequence diagrams for X" (see the "Ready-made
templates" section above), which would read as factually wrong copy for a
non-sequence pattern. Generalizing that label is real, separate scope for
whichever future batch wants to extend `relatedPatterns` beyond sequence
templates — not bundled into this one.

## Recently Used sidebar section (`io/recentComponents.js`, `sidebar/sidebar.js`)

A pinned sidebar section (below Favorites, above the category list) showing
the last 8 component defIds actually placed on the canvas, most recent
first. `js/canvas/canvas.js#createNodeFromDrop` is the single choke point
both drag-from-sidebar and click-to-add funnel through (`addComponentAtCenter`
just calls it with viewport-center coordinates), so `recordComponentUsed(defId)`
is called there and nowhere else — internal node-creation paths (a pattern's
sub-nodes, a layer attach, a replication mirror) deliberately don't call it,
since those aren't "you chose this from the sidebar" in the same sense a
direct placement is.

Storage-wise this mirrors `io/favorites.js`'s established shape exactly: a
`Set` of listener callbacks, `readJSON`/`writeJSON` from `io/storage.js`
(not raw `localStorage`, unlike this file's first draft — see the note
below), and `onRecentComponentsChange` returning an unsubscribe function.
`sidebar.js#renderRecentCategory(q, recentDefs)` mirrors
`renderFavoritesCategory`'s header/toggle shell but renders a flat item list
(no folders — recency has no concept of user-organized folders the way
Favorites does). **Deliberately does not auto-expand** the section on every
change the way `onFavoritesChange`'s listener does for Favorites — Favorites
only changes from a deliberate right-click action, but a component lands
here on *every single placement*, so force-expanding it each time would
yank the sidebar's scroll/attention during completely ordinary canvas work;
it just re-renders in place instead, same as `onLibrarySettingsChange`.

**Gotcha caught while writing this feature's own unit tests**: the first
draft read/wrote `localStorage` directly rather than going through
`io/storage.js#readJSON`/`writeJSON` (the thin, prefixed, defensively-
try/caught wrapper every other `io/` storage module already uses) — this
"worked" in the browser but failed the exact same
`tests/unit/testSupport.mjs#installMemoryLocalStorage` stub every sibling
`io/*.test.mjs` file already relies on, since that stub only patches
`window.localStorage`, not a bare global `localStorage` reference. Fixed by
routing through `storage.js` like every other module in this family — worth
remembering as the default choice for *any* new `io/` module needing simple
JSON persistence, not just as a fix after the fact.

## Auto-arrange (`core/autoLayout.js`, `canvas.js#autoArrangeAll`)

`computeAutoLayout(nodes, edges)` is a pure function (no DOM, no store) that
returns a new `{ id, x, y }[]` — a deliberately simplified layered
("Sugiyama-style") layout, not a production-grade one:

1. **Rank assignment**: longest-path-from-sources via Kahn's-algorithm
   topological processing — every node with no incoming edge starts at rank
   0, and every other node's rank is one more than the max rank among its
   predecessors, so a node always ends up strictly below everything that
   points to it. A cycle (or a self-loop, or an edge referencing a missing
   node id) can't produce an infinite loop here — nodes still in the
   pending set once no more progress can be made are just assigned the next
   rank and dropped from further consideration, rather than the algorithm
   hanging.
2. **Ordering within a rank**: a single-pass barycenter sort (each node
   ordered by the mean x-position of its already-placed predecessors in the
   rank above) — reduces obvious crossings but isn't iterative
   crossing-minimization, and there are no dummy nodes inserted for edges
   that span more than one rank (unlike a textbook Sugiyama layout), so a
   long edge can still visually cross an intermediate rank's nodes.
3. **Row-wrap**: a rank wider than `MAX_ROW_WIDTH` wraps onto additional
   rows rather than growing the canvas unboundedly sideways.

`canvas.js#autoArrangeAll()` calls this, `store.dispatch`es the new
positions for every node **and** re-picks every edge's `fromSide`/`toSide`
via `geometry.js#pickBestSides` in the same dispatch (one undo step) — without
this second step, edges keep whatever anchor sides they had before the
nodes moved, which can leave an unnecessary loop-out even once the nodes
themselves are cleanly stacked — then calls `fitToScreen()`. Wired to the
Tools dropdown's "🗺️ Auto-arrange" button (`toolbar.js#buildToolsGroupButtons`).

`autoArrangeAll()` bails out immediately (with an explanatory toast,
before touching `computeAutoLayout` at all) if any node's `shape ===
'lifeline'` — see "Sequence diagrams" above. A sequence diagram's x
position is meaningful (which participant) and its layout is manual by
design; this connector-direction layout has no concept of that and would
just scramble it.

## Navigation tools (`canvas/toolMode.js`)

`toolMode.js` is a tiny module-level pub-sub (`getToolMode`/`setToolMode`/
`onToolModeChange`) holding which of `'select'`/`'hand'` currently governs
canvas pointer interactions, plus a separate `spaceHeld` flag for a
momentary hold-Space-to-pan override that never touches the persisted
`baseTool`. This deliberately fixes the one weak spot the old (now-removed,
see the "Connector routing" section above) Magic Arrow toggle had: its
`magicModeActive` flag had no subscribe mechanism, so its toolbar button
was the *only* thing that could desync from it if the mode were ever
changed from elsewhere. `toolMode.js` instead notifies every subscriber
(the toolbar buttons' own `.active` class *and* `canvas.js`'s cursor class)
on every change, so there is exactly one source of truth.

`canvas.js#wireBackgroundInteractions`'s `pointerdown` listener is
registered with `{ capture: true }` specifically so the Hand-tool branch
(checked first) can `stopPropagation()` *before* the event reaches a
node's own bubble-phase handlers (`nodeInteractions.js#beginMove`,
connection-point drag, etc.) — that's what makes a Hand-tool drag pan the
canvas even when it starts on top of a component, without
`nodeInteractions.js` needing any Hand-tool awareness at all. When the
Hand tool is off, this listener's added top branch is a no-op and
everything falls through to the exact same code path as before.

## Contextual style-editor row (`toolbar.js#renderContextRow`)

The row shown while something is selected (`.toolbar-row-context`) is
`flex-direction: column`: a `.toolbar-context-header` (selection summary +
collapse toggle + close button) is always rendered first, then — unless
collapsed — a `.toolbar-context-body` holding the actual style-editor
fields (`.toolbar-context-controls`) and action icons
(`.toolbar-context-actions`). Collapsing doesn't hide those with CSS; when
`contextCollapsed` is true the function returns right after appending the
header, so the fields/actions are simply never built or added to the DOM
for that render — cheaper than the details panel's CSS-based
`.collapsed` hiding and avoids keeping stale field elements around.
`contextCollapsed` resets to `false` whenever the row goes from hidden to
shown (a fresh selection starts expanded, same convention as
`detailsPanel.js`), not when switching between two different non-empty
selections.

**Gotcha found in review (fixed, and worth remembering for any future
flex-column-with-truncated-text layout)**: `.toolbar-context-summary`
(the header's selection-name text) is `white-space: nowrap; overflow:
hidden; text-overflow: ellipsis` so a long component name truncates
instead of wrapping/overflowing — but a flex item's default `min-width:
auto` refuses to *shrink below its content's intrinsic width* regardless
of `text-overflow`, which silently no-ops the ellipsis. This bit twice in
the same element chain: once on the summary span itself, and again one
level up on `.toolbar-context-header` — which is *also* a flex item (it's
stretched cross-axis by the column-direction `.toolbar-row-context` via
`align-items: stretch`) with the same default. Both needed an explicit
`min-width: 0`. Separately, `.toolbar-row` (the shared base class) sets
`flex-wrap: wrap` for the main row's row-direction layout; without
`.toolbar-row-context` also setting `flex-wrap: nowrap`, combining
`flex-wrap: wrap` with its own `flex-direction: column` silently produces
a *multi-column* wrapping layout instead of a simple vertical stack —
which defeated `align-items: stretch`'s width constraint entirely (each
"column" sized to its own content instead of the container's width). All
three were caught by testing with a deliberately long node name during
the UI/UX review pass, not by testing with the short example names used
elsewhere — a reminder to include a long/edge-case value in any new
truncating-text UI, not just the happy-path short one. See
`tests/e2e/mobile-responsive.spec.js`'s "a long component name truncates
in the contextual row header instead of overflowing" test.

The header's ✕ calls `store.select([], [])` — the same
"nothing selected" state a canvas-background click or Escape already
produces, added as an explicit, discoverable affordance since until this
was added the row had no visible way to dismiss it at all.

**Gotcha found in review #2: destructive re-render stole focus on every
keystroke.** `renderContextRow` (like `detailsPanel.js#render`) fully
`clear()`s and rebuilds its DOM on every store `'change'` event —
including the change dispatched by each keystroke in one of its own
fields (`styleEditor.js`/`arrowEditor.js` use `formControls.js`'s
`textInput`/`numberInput`/`colorInput`, which dispatch on the native
`input` event, i.e. per character). Since the rebuild creates a *new*
`<input>` element each time, the field the user was actively typing into
lost focus after every single character. Fixed generically with
`utils/dom.js#rerenderPreservingUiState`: it captures whichever element
inside the container currently has focus — identified by a `data-focus-key`
attribute added to every affected field — plus its text-selection range,
before the rebuild, and restores focus (and the range) to the
same-keyed element afterward. `renderContextRow` now wraps the actual
rebuild (`renderContextRowInner`) with this helper; `detailsPanel.js`
does the same for its own render, additionally passing a `scrollSelector`
(`.details-body`) so the panel's scroll position survives the rebuild
too — the same destructive-rebuild pattern was also resetting scroll to
the top on every keystroke there, which could put the "+ Add
sub-component" button somewhere else entirely mid-click.

**Gotcha found in review #3: a floating overlay covered content the user
still needed to click.** To address a separate complaint ("the row
pushes the whole canvas down, looks jarring"), `.toolbar-row-context` was
first changed to `position: absolute` so it wouldn't grow `#toolbar`'s
box. This broke real interactions — confirmed by e2e regressions, not
just visual inspection: connecting two components (the second sidebar
item was now covered by the row), duplicating/grouping/deleting a
selection (nodes near the top of the canvas were now covered too — a
solid-background overlay blocks pointer events same as it blocks the
view). Reverted to normal document flow; the "jarring jump" complaint is
instead addressed with a lightweight `@keyframes` fade+slide-in on the
row itself (`animation: toolbar-context-in 0.15s ease` — see
`css/toolbar.css`), which costs nothing functionally since it doesn't
change layout, only how the already-correct layout change is revealed.

### Display modes: floating / pinned-top / pinned-bottom

A later request revisited the same "jumps the canvas" complaint and asked
for an actual floating popup as an alternative, not just a smoother
transition into the same in-flow push. `contextRow` is now one persistent
element `toolbar.js` moves between three containers depending on
`getUiPrefs().contextRowMode` (`js/io/uiPrefs.js`, sharing the pre-existing
`'prefs'` localStorage key the "Toggle Grid" setting already used, so an
existing visitor's grid setting doesn't silently reset):
`mountContextRow()` appends it to `#toolbar` for `'pinned-top'` (the
original in-flow behavior from gotcha #3 above), as the last child of
`#app` for `'pinned-bottom'` (a flex column, so it shrinks `.app-body`
from the bottom exactly the way `#toolbar` shrinks it from the top), or to
`document.body` for `'floating'` (`position: fixed`, viewport coordinates —
the same host `contextMenu.js`/`toolbarDropdown.js` already use for their
own floating UI). A 📌 button on the row's header toggles floating ↔
pinned-top; "Default Settings" (`modals/defaultSettingsModal.js`) is the
only way to reach `'pinned-bottom'` specifically.

**Gotcha found in review #4: a *smaller* floating card can still cover
content it doesn't own.** Gotcha #3 above reverted a full-width overlay
after it covered sidebar items and canvas nodes; `'floating'` mode's much
smaller, selection-anchored card was specifically designed to avoid that
same mistake, but a first pass at `positionFloatingRow()` still shipped
three overlap bugs, all caught by a full e2e run rather than manual
inspection — each fix was verified by re-running the *entire* suite, not
just the specific test that first caught it, since each of these bugs
individually looked fixed in isolation right up until a different test
scenario (different node position, different card height) exposed the
next one:
1. **Clamped only to the window, not the canvas area.** The card's
   position was clamped to `window.innerWidth`/`innerHeight`, so for a
   selection near the top or an edge of the canvas, the clamped position
   could land on top of the toolbar's own open dropdown panel, the details
   panel's controls, or the sidebar — exactly the class of bug gotcha #3
   already fixed once, just reappearing in a smaller footprint. Fixed by
   clamping to `#canvas-viewport`'s own `getBoundingClientRect()` instead
   of the window — that element's box already excludes the toolbar,
   sidebar, and details/AI review panel by construction (they're flex
   siblings), so nothing that lives there can ever land under the card.
   A toolbar dropdown panel is a separate case — it's `position: fixed`
   too, so it isn't excluded by that same containment — handled instead by
   hiding the card outright (`.dropdown-suppressed`, driven by
   `toolbarDropdown.js#onDropdownOpenChange`) while any dropdown is open,
   reappearing the moment it closes. (That listener had its own
   easy-to-miss ordering bug: it originally fired *before* the module's
   `openPanel` variable was reassigned on open, so every "opened" event
   still read as "closed" — always notify listeners *after* the state
   they're being told about actually changes.)
2. **The "fits, else fall back to the first candidate" clamp could still
   slide the card back over its own anchor.** An earlier version tried
   below/above/right/left candidates and picked whichever fit entirely
   within the canvas bounds, falling back to a plain clamp of the first
   ("below") candidate if none fit perfectly. That fallback clamp only
   respected the canvas bounds, not the anchor — so a selection tall
   enough (or close enough to a bound) that neither "below" nor "above"
   fit by a few pixels could still end up clamped back on top of the
   selection itself (reproduced with the "rows" shape: its "+ Add row"
   button, positioned near the node's own bottom edge, ended up
   underneath the clamped-back card, silently swallowing clicks meant for
   it). Simplified to: pick whichever side (below or above) has *more*
   room via `spaceBelow`/`spaceAbove`, then compute `top` on that side
   *away* from the anchor and never clamp it back — if the card doesn't
   fully fit it just scrolls internally instead (`.toolbar-row-context
   .floating`'s `max-height`/`overflow-y: auto` already provides that).
   Only the horizontal axis is clamped, since sliding left/right can never
   reintroduce the overlap. The lesson generalizes beyond this feature:
   a "fits perfectly, else fall back to a naive clamp" strategy for
   positioning floating UI near an anchor is a trap — the fallback branch
   needs the same anchor-avoidance guarantee as the primary candidates, not
   just the bounds check.
3. **"Whichever side has more room" can still reach *other* content, even
   though it can never re-cover its own anchor.** The fix in (2) picked
   "above" whenever `spaceAbove > spaceBelow`. That's anchor-safe by
   construction, but "above" grows the card's *top* edge upward from the
   anchor the taller the card is — for an anchor low on the canvas with a
   lot of room above it, that can reach all the way up past an unrelated
   node positioned well above the anchor (reproduced by dragging a second
   node down-and-right of the first, then connecting them — the connection
   point drag never started because the floating card, sized for the
   just-dragged node and flipped to "above" since that side had more raw
   space, ended up covering the *first* node's connection point instead).
   "Below" doesn't have this problem — it only ever grows *downward* from a
   fixed point right under the anchor, so it can't reach content elsewhere
   on the canvas the way "above" can. Rebiased accordingly: prefer "below"
   whenever it has at least a minimal `MIN_BELOW` (currently 60px, enough
   for the row's own header) *or* more room than "above", only falling back
   to "above" when below is both small and worse than above. This isn't an
   airtight guarantee against ever covering some other node — genuinely
   dense diagrams could still see the card land near unrelated content — but
   it's a much smaller, more predictable footprint than "flip to whichever
   side is bigger," and matches this app's typical usage where a diagram
   grows down/right from its earlier content rather than up/left.
4. **Reposition triggers were incomplete — nothing fired when a *panel*
   opened.** Selection/data changes, viewport pan/zoom, and window resize
   all had explicit triggers, but the details panel and AI review panel
   have no pub-sub of their own (plain `classList.toggle('open')`) and
   animate `#canvas-viewport`'s width over 180ms when they open/close (see
   css/layout.css) — nothing told the floating card to reposition, so it
   stayed exactly where it was computed *before* the panel opened, which
   could now be squarely on top of a button inside that panel (reproduced
   with "paste an AI response back into the panel" — the floating card,
   positioned for a component selected before the AI panel opened, ended up
   over the panel's own "Save to this session" button once the panel's
   open animation finished and shrank the canvas). Rather than hunting down
   every individual trigger (and inevitably missing the next one), a
   `ResizeObserver` on `#canvas-viewport` itself is the general fix — it
   fires for *any* reason that specific element's box changes, panels
   included, and even fires repeatedly through the open/close transition so
   the card visibly tracks instead of jumping once at the end.
5. **A card taller than the available room could still render past the
   bottom of the actual browser window, not just the canvas.** `top` is
   deliberately never clamped back toward the anchor (see item 2), and the
   reasoning had been "if it doesn't fully fit, `overflow-y: auto` handles
   it" — but that only helps once the element's own height is already
   bounded; a *static* CSS `max-height` doesn't bound `top` itself, so a
   naturally tall card (a mixed node+edge selection renders both style
   editors at once) could still start low enough that most of it rendered
   below the window, with Playwright correctly reporting its buttons
   "outside of the viewport." Fixed by capping the card's height in JS to
   whatever room actually exists in the *chosen* direction
   (`spaceBelow`/`spaceAbove` from item 3) via an inline `maxHeight`, set
   *before* reading the card's height for the `top` calculation — this
   guarantees `top + actualHeight` stays within bounds without ever moving
   `top`, with genuine overflow scrolling internally instead. The inline
   `maxHeight` is cleared when switching to a pinned mode, since it would
   otherwise linger and clip a pinned row that never needed it.
6. **A *different* floating element entirely — not the card's own
   positioning logic — could still land on top of it.** The "Smart
   Suggestions" banner (`canvas/suggestions.js`) is its own `position:
   fixed` element pinned to the bottom-center of the screen, shown right
   after placing a component with a curated companion — outside
   `#canvas-viewport`'s box (so item 1's containment doesn't know about it)
   and with no store/selection/canvas-resize event of its own (so nothing
   already wired re-triggered a reposition when it appeared). Caught during
   the UI/UX review pass at a mobile width, not by any test: a card
   anchored near the bottom of a short viewport rendered squarely under the
   banner, which sits at a higher z-index and so silently blocked clicks
   into whatever of the card it covered. Fixed the same way as the toolbar
   dropdown case (item 1's second half): `suggestions.js` now exposes an
   `onSuggestionsVisibilityChange` pub-sub the banner's `show()`/`hide()`
   notify, and `positionFloatingRow` shrinks its own usable `bounds.bottom`
   to stop above the banner's top edge whenever it's visible, rather than
   hiding the card outright — unlike a dropdown panel, the banner is small
   and off to one side, so there's usually still room for both without
   resorting to a full hide. Two follow-up bugs, both self-caught before
   they ever reached a test run:
   - Folding the banner into `bounds.bottom` *before* the below-vs-above
     side decision (not just the height cap) undermined item 3's "prefer
     below" bias — the banner's presence alone could shrink `spaceBelow`
     enough to flip the decision to "above" even for a selection nowhere
     near the bottom of the screen, reopening exactly the "reaches other
     content" risk item 3 exists to prevent (reproduced: adding two plain
     components with no special positioning, where the first one just
     happened to have a curated suggestion, made connecting them fail).
     Fixed by keeping the side decision based on the *true* canvas bounds
     always, and only ever trimming the *height cap* — and only on the
     "below" side — to account for the banner afterward.
   - The banner query (`.suggestion-banner.visible`) missed a banner that
     had just appeared: `notifyVisibilityChange(true)` fires synchronously
     right after `hidden` is cleared, but the `.visible` class (its own
     fade/slide-in trigger) isn't added until the next animation frame, so
     `positionFloatingRow` ran a beat too early and found nothing to avoid.
     Fixed by querying `:not([hidden])` instead — `hidden` is what's
     actually cleared synchronously at notify time, and the element is
     already at (or a negligible few pixels from) its final layout position
     the moment `hidden` clears, since only opacity/transform animate in,
     not layout.

**Gotcha found in review #5: 'floating' mode indirectly broke click-to-add
for a second component at the same spot — an existing bug the *old*
pinned-top behavior had been silently masking.** `canvas.js#addComponentAtCenter`
(the sidebar's click-to-add path) always places a new node at
`#canvas-viewport`'s exact current center — every repeat click lands at the
literal same canvas point unless something moved the viewport or resized
it in between. Under the old always-pinned-top behavior, selecting a
newly-added node opened the context row *inside* `#toolbar`, growing the
toolbar's height and shrinking `#canvas-viewport` from the flex layout —
which happened to shift the computed center before the *next* click-add,
so two components added back-to-back never landed exactly on top of each
other. `'floating'` mode doesn't resize anything (by design — that's the
whole point of it), so `#canvas-viewport`'s center stopped moving between
clicks, and clicking the same sidebar item twice landed the second node in
*exactly* the same spot as the first — with the newer one's higher
`zIndex` permanently covering the older one's own center, the exact point
a plain click targets, making it unclickable via a normal click forever
(nothing else in the UI ever moves a freshly-created node out of the way).
This was a real latent bug in `addComponentAtCenter`, not something wrong
with the floating card itself — the pinned-top row's layout-shifting side
effect had just been accidentally covering for it the whole time. Fixed at
the actual source, not by special-casing the toolbar: `createNodeFromDrop`
(the single entry point both click-add and drag-drop funnel through) now
nudges the target point diagonally in the same 24px steps
`duplicateSelection` already uses for its own copies, but only while the
candidate box would still cover an *existing* node's own center point —
not merely "somewhat close by," so intentionally tight, deliberate
placements are untouched. General lesson: when two independent behaviors
combine to produce correct-looking output, changing either one on its own
can silently unmask a bug the *other* one was covering for — worth
specifically re-testing "do the same thing twice in a row without moving
anything in between" whenever a layout-affecting side effect (a panel
resizing shared layout, a scroll position, anything with a stateful
side-effect beyond its own obvious job) is removed or changed. The same
"always targets the exact canvas center" pattern turned up a second place
during the release-checklist's own review pass — `addCustomShapeNode` (the
"Add Shape" modal) — before it ever became a user-visible bug there; fixed
the same way, reusing `findClearCenter` rather than duplicating the logic.

## Details panel (`panel/detailsPanel.js`)

Opened via a node's ⓘ button or right-click "Open details" (both fire a
`sdb:open-details` custom event the panel listens for) — but it also
subscribes to `store.subscribe('selection', ...)` directly: if the panel
is already open and the selection changes to a different single node it
switches straight to it (`open(newNodeId)`); any other selection change
(deselect, multi-select) closes it. Before this the panel had no
`'selection'` subscription at all — only `'change'` (data mutations),
which has no way to represent "the user clicked something else" — so it
silently kept showing stale content for whatever was open before.

**Connector (edge) variant** — `currentEdgeId`, `openEdge(edgeId)`,
`renderEdgeDetails(edge)`, opened via right-click "Open details" on a
connector (`canvas.js#openEdgeContextMenu`, a new `sdb:open-edge-details`
event mirroring `sdb:open-details`'s pattern). Deliberately a *parallel*
code path rather than folded into the node-centric `render()`/`open()`
above: that function is large, heavily tested, and every field in it is
node-only (sub-components, rows, replication...), so extending it to
branch on "is this actually an edge?" throughout would have real
regression risk for no benefit — a small sibling function reusing the same
`<div class="details-panel">` shell (header, notes textarea, resize
handle) is lower-risk and just as discoverable. Selecting a single
connector while the panel is already open switches it to this variant the
same way selecting a different node does (`store.subscribe('selection',
...)` now also checks `selection.edgeIds.length === 1`); selecting a node
while it's showing an edge (or vice versa) switches the other way. Shows
the connector's `label` (mirroring the arrow editor's own label field, for
convenience — editing it here or there is the same field) and a new
`notes` textarea (edges had nowhere to note extra context before this),
plus — only when both endpoints are `shape === 'lifeline'` — a read-only
"Message N" line computed via the exact same
`canvas.js#computeMessageSequenceNumbers` the on-canvas numbered badge
uses (exported for this reuse rather than reimplemented), so the two
never disagree.

**Resize handle** (`initResizeHandle`, `css/panel.css`): a persistent
`<div class="details-resize-handle">` is created once and re-appended to
`rootEl` at the end of every `render()` call, since `render()` itself
`clear()`s all of `rootEl`'s children on every open/re-render — appending
the *same* element back (not recreating it) keeps its drag listeners
intact without needing to rewire them each time. Drag updates a
`--panel-width` CSS custom property set as an inline style directly on
`#details-panel` (which `css/layout.css`'s `#details-panel.open` rule
already reads via `var(--panel-width)`, so no other CSS needed to
change), persisted to `storage.js` on pointerup and restored on init.

**Gotcha found in review: negative-offset elements get clipped by a
sibling's `overflow: auto`.** The handle was first positioned straddling
the panel's left border (`left: -4px; width: 8px`) so it'd be easy to
grab without pixel-perfect precision on the 1px border. This silently
made half the handle unclickable: `#details-panel.open` sets
`overflow-y: auto`, and per the CSS spec a `visible` `overflow-x` paired
with a *non*-`visible` `overflow-y` computes to `auto` too — the "visible"
value never actually applies once its sibling axis needs scrolling. So
anything positioned outside the panel's own box, negative offset or not,
was clipped out of both view and hit-testing; a real drag starting in
that clipped zone landed on whatever was underneath (the canvas), which
looked like the panel closing itself (canvas click → deselect →
selection-sync above closes it) rather than the resize working at all.
Fixed by keeping the handle's hit area entirely inside the panel's own
box (`left: 0; width: 6px`) instead of straddling the border.

**Related fix in `canvas/node.js`**: a node's double-click-to-rename only
worked when the click landed exactly on the `.node-label` text, because
`.node-standard`/`.node-icon`/`.node-subchips` all set `pointer-events:
none` (deliberately, so they don't intercept the single-click/drag-select
handled on the node root) — a double-click on the icon or on empty
padding fell through to `.node-body` underneath, which had no listener of
its own. `createNodeEl` now also listens for `dblclick` on `.node-body`
directly as a fallback (skipped if the click actually landed on
`.node-label`/`.node-external-label`/`.row-text`, which already handle it
and call `stopPropagation()`, so this never double-fires). Relatedly,
`startInlineEdit`'s commit path was reordered to restore the label
element *before* calling `onCommit` rather than after — `onCommit`
dispatches synchronously, and `updateNodeEl`'s "don't rebuild while an
edit is live" guard (added for the same focus-loss reason as above) was
checking for the still-present `<input>` and skipping the rebuild that
would've shown the freshly-committed text, leaving the stale pre-edit
label visible until the next unrelated render.

## Toolbar dropdown groups (`toolbar/toolbarDropdown.js`)

`toolbar.js`'s always-visible row only holds controls needed continuously
or at a moment's notice while actively working (undo/redo, the Select/Hand
toggle, zoom, "Add Shape" — `buildQuickCreateGroup`);
everything else — occasional/setup actions — is grouped behind one of four
dropdown trigger buttons (File/Create/Tools/Help —
`toolbar.js#buildFileGroupButtons` etc.), built by
`buildToolbarDropdown(label, icon, title, buttons)`. This exists to keep
the row from growing unbounded as buttons are added — a flat row of
full-text buttons was the direct cause of a real mobile horizontal-
overflow bug (see the "Adding a toolbar button?" pitfall in
`AI_AGENT_GUIDE.md`). It's a distinct, simpler component from
`canvas/contextMenu.js` (the right-click menu): a dropdown's `buttons` are
ordinary already-built `<button title="...">` elements — the exact same
`el(...)` shape as any flat toolbar button — rather than a generic
`{label, onClick}` item list, so each keeps its own clear tooltip and a
toggle button's `.active` state/icon-swap logic works unmodified.

**Panel positioning**: the panel uses `position: fixed` with `left`/`top`
computed from the trigger's `getBoundingClientRect()` and clamped to the
viewport (`positionPanel()`), the same pattern `canvas/contextMenu.js`
already uses for the right-click menu — not CSS `position: absolute; top:
100%` relative to the trigger. The relative-to-trigger approach rendered
correctly in ad-hoc desktop testing but could still put the panel partly
off-screen in practice (reported on a real mobile device): once the
toolbar wraps a trigger onto a row where it sits further right/lower than
the panel has room for, an ancestor-relative `absolute` panel has no way
to know it needs to flip or clamp itself — only a viewport-relative
computation can. See `tests/e2e/mobile-responsive.spec.js`'s "every
toolbar dropdown panel stays fully within the viewport" test.

Only one dropdown panel is ever open at a time (module-level `openPanel`);
it closes on an outside click, `Escape`, or immediately after one of its
own buttons is used.

## Canvas element search (`toolbar.js#buildCanvasSearchGroup`)

Searches components/connectors already **placed on the canvas**, by
`node.text`/`edge.label` — architecturally distinct from `.sidebar-search`,
which searches the component *library* to find something to add. As you
type, `runCanvasSearch` case-insensitive-substring-matches both `state.nodes`
and `state.edges` into a flat `searchMatches` array (nodes first, then
edges) and jumps to the first hit; Enter/Shift+Enter step `searchIndex`
through the rest via `jumpToMatch`, wrapping at both ends like a browser's
own page-search "N of M". A match is applied by calling the same
`store.select([nodeId], [])` / `store.select([], [edgeId])` a manual click
would, so it opens the contextual style row exactly as clicking normally
does, and `viewport.js#centerOn` (new — pans to center a canvas-space point
without touching zoom, unlike `fitToContent` which also fits zoom to a whole
bounding box) recenters the view on it without disorienting the user with an
unexpected zoom change. A connector match centers on the midpoint between
its two endpoint nodes' centers (roughly where its label sits and where both
endpoints are visible at once), not the edge's own bounding box — an
elbow-routed path's bounding-box center can land on empty space inside a
bend.

The input is a plain `type="search"` with the match-count/"No matches"
badge as a normal flex sibling *after* it, not a `position: absolute`
overlay — an earlier version stacked the badge on top of the input the way
`.sidebar-search-icon` does, which collided with both the typed text and the
browser's native search-cancel-✕ control (a UA-injected element outside
CSS's box-model, invisible to `padding-right`). See the "toolbar row DOM
order" gotcha in "Mobile/responsive layout" below for why this group is
appended *last* in `initToolbar`'s row-1 sequence rather than where it's
visually described in `docs/SPEC.md` §4.5.

## Custom multi-component groups (`modals/saveComponentGroupModal.js`, `canvas.js#buildGroupSnapshotFromSelection`)

Saving a selection of 2+ components as a custom component reuses the
built-in Design Pattern runtime (`kind: 'pattern'`, `instantiatePattern` —
see 4.2.2/4.2.7 in `SPEC.md`) rather than inventing a parallel one:
`resolveComponentDef`, `sidebar.js`'s badge/tooltip rendering, and
`dragSource.js`'s drop/click routing are already `kind`-agnostic, so a
saved group gets correct sidebar rendering and instantiation with zero
changes there. What a hand-authored pattern (`data/schema.js#definePattern`)
doesn't need, though, is fidelity to a *specific* node's actual styling —
its node spec only ever carries `{key, defId, dx, dy, label}` and always
re-derives appearance from `resolveComponentDef(defId)`. A saved selection
needs the opposite: the user's exact fill/stroke/size/sub-components/text
position, or even `defId: null` (e.g. a basic shape). `buildGroupSnapshotFromSelection`
solves this with an additive `overrides` field per node/edge spec — a full
field snapshot (everything but id/x/y/zIndex/groupId for nodes, id/from/to
for edges) — and `instantiatePattern` spreads `spec.overrides` last when
present, so it's a strict superset: built-in patterns (no `overrides`)
instantiate exactly as before, saved groups instantiate with full fidelity.
Positions are stored relative to the selection's bounding-box center, and
edges are harvested the same way `duplicateSelection()` already does
(internal edges + explicitly-selected edges, deduped, from/to remapped by
key) — see that function for the precedent.

A saved group also sets `groupOnInstantiate: true` on the custom-component
record when it has 2+ nodes; `instantiatePattern` reads that flag (absent/
false for every built-in pattern, so their behavior is unchanged) to
assign the newly-created nodes a shared fresh `groupId`, so placing the
group back down behaves like an explicit Group (4.3.1) automatically.

**Import/export round-trip**: `io/customComponents.js#importCustomComponents`
used to rebuild every imported record from an explicit field whitelist
that didn't include `kind`/`pattern`/`groupOnInstantiate` — a saved group
would silently revert to broken single-node data the moment it was
exported and re-imported, or included in a full-backup restore
(`io/fullBackup.js` round-trips through this same function). Fixed by
validating and passing those three fields through
(`validatePatternField` drops any node/edge spec that isn't shaped right,
rather than importing something that would fail at instantiation time).

## Data library (`data/`)

Every category file exports `{ category, components }` where `components`
is created via the `c(id, name, icon, opts)` helper in `schema.js` — pure
data, no functions, no DOM. `data/index.js` imports every category file,
flattens, sorts (categories A→Z by label, components A→Z by name within
category), and asserts id-uniqueness (thrown in dev, tested in
`tests/unit/componentData.test.mjs`). Adding a component is: add one line
to the right category file. Adding a whole new category is: new file +
one import line in `index.js`.

Two categories carry an extra `kind` field that changes how the canvas
handles them instead of the default single-node placement:

- **`categories/layers.js`** (`kind: 'layer'`) — code-level building
  blocks (Controller, Service, DAL, React Hook, ...). `sidebar/dragSource.js`
  checks `resolveComponentDef(defId).kind` on drop: dropped on an existing
  `.node` element it calls `canvas.js#addLayerToNode(defId, nodeId)`
  (pushes into that node's `subComponents`, no new node created); dropped
  on empty canvas it falls through to the normal `createNodeFromDrop` path.
  The same library backs the details panel's sub-component name
  `<datalist>` (`utils/layerDatalist.js`) so typing "Controller" there
  autocompletes and auto-fills its icon.
- **`categories/design-patterns.js`** (`kind: 'pattern'`, built with
  `definePattern()` in `schema.js`) — a blueprint of `{key, defId, dx, dy,
  label?}` nodes and `{from, to, ...edgeStyle}` edges, where every node's
  `defId` references a *real* component/layer elsewhere in the library.
  `canvas.js#instantiatePattern(defId, clientX, clientY)` resolves each
  node's def, creates real nodes offset from the drop point (`dx`/`dy`),
  builds the edges by mapping blueprint `key`s to the new node ids, and
  pushes everything to the store in one dispatch (one undo step). Reusing
  real defIds means pattern nodes get correct styling for free and the
  blueprint data stays tiny — no node-shape/color duplication.

`kind` is per-*item*, not per-category, so a category file can freely mix
kinds — `categories/state-machines.js` does exactly that: plain
`kind: 'component'` state shapes (State, Choice, Final State, ...)
alongside `kind: 'pattern'` whole-state-machine templates, all in one
`components` array. A transition's condition/event needs no schema
support at all — it's just that edge's ordinary `label` field, set the
same way any connector's label is.

A `popular: boolean` flag (default `false`, set via `c(id, name, icon, {
popular: true, ... })`) marks a component as one most engineers would
immediately recognize as a common building block in its category — purely
a sidebar rendering hint (`sidebar.js#renderItem` adds an `.item-popular`
class + a small ★ badge), never affecting sort order, search, or anything
else. Same "would most engineers immediately agree" curation bar as
`related` below, and equally deliberately sparse. `sidebar.js`'s "★
Popular only" toggle filters the built-in categories down to just this
flag (`popularOnly` module state, re-filtered inside `renderList()`) —
deliberately scoped to `CATEGORIES` only, not Favorites/My Components,
since `popular` is a curated *library* attribute those two sections don't
carry (Favorites is already the user's own shortlist; My Components is
unrated).

### A component's own `textPosition`/`iconVisible` default

`c(id, name, icon, { textPosition, iconVisible, ... })` can pin a
structural default for that *specific shape* — e.g. `categories/shapes.js`'s
`shape-group` ("Group / Container") sets `textPosition: 'top'` so its
caption sits at the top instead of centered over whatever gets placed
inside it, and `iconVisible: false` since a plain frame has no icon to
show. This is different from every other opt `c()` accepts: `textPosition`/
`iconVisible` are also independently settable *globally* (Default Settings
→ `io/nodeDefaults.js`, applied to every newly-created node via
`buildCreationOverrides()`) and *per-node* after placement (style editor).
Before this, `core/project.js#createNode` only read those two fields from
`overrides` — a component's own definition had no way to express an
opinion about them at all, silently discarded even if a `c()` call
happened to include them (this was the actual bug behind "Group /
Container"'s label reading centered instead of at the top: the opts were
being passed, `createNode` was just never looking at `def.textPosition`).
Fixed by spreading `def.textPosition`/`def.iconVisible` (when the def sets
them) *after* `...overrides` in `createNode`'s returned object — the same
"the def wins" precedence `shape`/`fill`/`stroke` already have on that same
object, just newly extended to these two fields specifically, since they'd
never been overridable at the definition level before. Most components
don't set either, so this is a no-op for them and the global default (or a
later per-node override) decides exactly as before — only reach for this
when the default is describing something inherent to the shape, not a
style preference (see the `@param` docs on `schema.js#c` for the same
guidance inline).

## Smart Suggestions (`canvas/suggestions.js`, `data/schema.js`'s `related`/`relatedLayers` fields)

Each component definition can carry two optional, hand-curated arrays (see
the `add-library-item` skill for the curation bar both need to clear):

- `related: string[]` — other built-in **component** ids commonly used
  *alongside* this one in real designs (`db-redis` ↔ `db-postgres`,
  `net-load-balancer` → `srv-nginx`, ...). Resolved by
  `data/index.js#getRelatedComponents(id)`.
- `relatedLayers: string[]` — built-in `kind: 'layer'` ids (see
  `categories/layers.js`) commonly used *as a sub-component of* this one
  specifically (`be-express` → Controller/Middleware, `fe-react` → React
  Hook/Component, ...). Resolved by `data/index.js#getRelatedLayers(id)`,
  which additionally drops anything that doesn't resolve to an actual
  `kind: 'layer'` def.

Both resolvers drop any id that doesn't resolve rather than surfacing a
broken suggestion.

**A `kind: 'layer'` component can carry `related`/`relatedLayers` too, and
they work identically once the layer is standing alone as its own node** —
`createNodeFromDrop` (below) doesn't branch on `kind` at all, so dropping a
layer onto *empty* canvas (rather than onto an existing node, which attaches
it instead — see 4.2.1) triggers the same suggestion flow as any plain
component. Exercised for the first time by a batch of textbook pattern-role
pairings (`layer-repository` → `layer-unit-of-work`, `layer-adapter` →
`layer-adaptee`, `layer-context-role` → `layer-strategy`, `layer-port` →
`layer-adapter`, ...) — pick the *containing/wrapping* role as the one that
gets the `relatedLayers` entry (e.g. Adapter wraps an Adaptee, so
`layer-adapter` points at `layer-adaptee`, not the reverse), mirroring how a
framework's `relatedLayers` always points from the container outward to
what it holds.

`canvas.js#createNodeFromDrop` — the single choke point both drag-drop and
click-to-place funnel through (`addComponentAtCenter` just calls it with a
computed screen point) — calls `suggestions.js#showSuggestionsFor(def,
node, { onAddComponent, onAddLayer })` right after creating the node
(passing the node itself, not just its def, so the sub-component filtering
below has something to check). That function does the actual filtering per
list — Smart Suggestions setting off → nothing at all; no curated list →
nothing for that list; every related *component* already present anywhere
on the canvas → dropped from the `related` row; a *layer* already attached
to **this specific node** (checked against `node.subComponents` by name,
since attached sub-components aren't tracked by defId) → dropped from the
`relatedLayers` row — and, if anything survives in either list, shows a
small fixed-position banner: a "✨ Goes well with X:" row of "+ Add Y"
buttons for companions, and/or a "🧩 Common building blocks for X:" row of
"↳ Y" buttons (dashed green border, matching the drag-a-layer-onto-a-node
preview outline) for sub-components — both rows can show at once (e.g.
`net-api-gateway` has both lists), with one close button pinned to the
banner's corner regardless of row count.

**Deliberately no import from `suggestions.js` back to `canvas.js`** even
though clicking a suggestion needs to *create a node* or *attach a
sub-component* (both `canvas.js`'s job): `canvas.js` passes its own
`addRelatedComponent` and the already-existing `addLayerToNode` (the same
function the drag-a-layer-onto-a-node flow uses) as plain callbacks
(`onAddComponent`/`onAddLayer`) into `showSuggestionsFor` instead of
`suggestions.js` importing `canvas.js` to call them directly — dependency
injection at the call site avoids what would otherwise be a circular
`canvas.js` ⇄ `suggestions.js` import (canvas.js already imports
suggestions.js to trigger the banner in the first place). `addRelatedComponent`
places the new node via the same `findClearCenter(x, y, w, h, existingNodes)`
anti-overlap helper node-creation already uses (initial guess: to the right
of the node that prompted the suggestion, nudged diagonally away from
anything already there — not a blind fixed offset), **and creates the
connecting edge** in one dispatch: `geometry.js#pickBestSides` picks the
anchor sides from the two nodes' actual placement, and `createEdge` builds
an edge from the prompting node to the new one, matching the natural
"anchor produces/depends-on suggestion" reading of the vast majority of
curated `related` pairs. `addLayerToNode` needs no such placement/edge
logic since it doesn't create a node at all, just pushes onto the existing
node's `subComponents`.

Turning suggestions off entirely (both rows together — there's no separate
toggle per list) lives in `io/librarySettings.js` (`suggestionsEnabled`,
alongside `hideStateMachines` — same read/write/subscribe module, just one
more key) and is exposed from "🎛️ Default settings" → "Component
library", the same modal section as the State Machines toggle.

### Revisiting sub-component suggestions later (`suggestions.js#getUnattachedLayerSuggestions`, `canvas/node.js`, `panel/detailsPanel.js`)

The placement-time banner's `relatedLayers` ("attach") row is transient by
design (auto-hides, easy to dismiss) and never appears at all for a node
loaded from a saved project — so there needed to be a way back to the same
curated suggestions any time later. `getUnattachedLayerSuggestions(node)`
factors the filter `showSuggestionsFor` already did inline (curated
`relatedLayers` minus names already in `node.subComponents`) into a
standalone, reusable pure function — both the new call sites below and
`showSuggestionsFor` itself now share this one implementation.

- **`canvas/node.js`**: `updateNodeEl` (which already runs on every store
  `'change'` event for every node, right alongside the existing `hasInfo`
  computation) toggles a `.has-suggestions` class based on
  `getUnattachedLayerSuggestions(node).length > 0` — so a suggestion
  attached any way at all (this new flow, the placement banner, or the
  details panel's plain "+ Add sub-component" field) makes the badge
  disappear live, no manual invalidation needed. The badge itself
  (`.node-suggestion-badge`, a 💡 button) is created unconditionally in
  `createNodeEl` — like `.node-replication-badge`, it's always in the DOM
  and purely CSS-hidden (`display: none` unless `.has-suggestions` is set),
  which matters for testing: check visibility (`toBeHidden()`/`toBeVisible()`),
  not DOM presence (`toHaveCount(0)` never passes). It's appended to the
  DOM *after* `.node-resize-handles`, same as `.node-info-btn`/`.node-menu-btn`
  — later siblings paint on top, so it stays clickable above a corner resize
  handle when the node is selected, unlike an earlier-appended element would
  be. Its `onClick` reuses the exact same `handlers.onOpenDetails(node.id)`
  the ⓘ button calls — no new handler wiring needed.
- **`panel/detailsPanel.js`**: a "💡 Suggested sub-components" section
  (`renderSuggestedSubComponents`, rendered right after the existing
  "Sub-components" editor, and rendered as nothing — not an empty section —
  once `getUnattachedLayerSuggestions` returns `[]`) offers the same
  curated list as checkboxes instead of the banner's one-click-per-item
  buttons, so multiple can be queued and attached in a single dispatch (one
  undo step) via "+ Add selected (N)". Which names are checked is
  module-level state (`suggestionSelection`, a `Set` of names, since a
  suggestion has no id of its own on the node) rather than per-render
  state, because `render()` fully rebuilds the panel's DOM on every store
  change (see the module's own comment on `rerenderPreservingUiState`) —
  a plain local variable inside the render function would reset on every
  rebuild. `open(nodeId)` resets this Set on every call (including when
  `store.subscribe('selection', ...)` auto-switches the panel to a newly
  selected node), so selections never leak from one node's suggestions to
  another's. `renderSuggestedSubComponents` also prunes any checked name
  that's no longer being suggested — attached some other way (e.g. the
  plain "+ Add sub-component" field) while its checkbox sat checked — so a
  stale name can't render as still-checked or sneak into a later "Add
  selected" click for the same node.

## Persistence (`io/`)

- `storage.js`: thin wrapper around `localStorage` with a versioned key
  prefix (`sdb:v1:...`), JSON try/catch guards everywhere, quota-exceeded
  handled gracefully (toast, not a crash).
- `autosave.js`: subscribes to the store, debounces 500ms, writes the
  current project under a fixed "autosave" slot; on load, `main.js`
  restores it if present.
- `fileIO.js`: export = `Blob` + temporary `<a download>`; import = hidden
  `<input type="file">`, `JSON.parse` wrapped, then validated by
  `core/project.js#validateProject` before it ever reaches the store —
  invalid/foreign JSON is rejected with a clear error, never partially
  applied.
- `exportImage.js` / `exportPdf.js`: dynamically `import()` the CDN
  `html2canvas`/`jsPDF` scripts only when the user actually exports (not on
  page load), rasterize the canvas content layer, crop to diagram bounds.
  "Diagram bounds" (`canvas.js#getContentBounds`) is more than just every
  node's `x/y/w/h` — obstacle-avoiding edge routing can jut out past a
  node's own box while detouring around a cluster, and
  `textPosition: 'above'/'below'` labels render entirely outside
  `.node-body` by design, so both get unioned in too (the edge layer's own
  `getBBox()` for the former — its coordinate system is already
  canvas-space, since the pan/zoom transform lives on its parent
  `contentEl` — and each external label's real rect converted through
  `viewport.screenToCanvas()` for the latter). `exportImage.js` also caps
  the export `scale` down from the default 2x if the target size would
  cross a conservative 8000px threshold — browsers cap a single
  `<canvas>`'s dimensions (commonly ~16384px, lower on some mobile
  browsers), past which html2canvas's own internal canvas silently clips
  instead of erroring, so a very large diagram needs to downscale rather
  than get cropped with no indication anything went wrong.
- `nodeDefaults.js`: global "new component" defaults (transparent fill,
  icon visibility, text position, sub-components display — see
  docs/SPEC.md 4.2.5), stored under their own key, independent of any one
  project. `buildCreationOverrides()` returns the `overrides` object every
  `canvas.js` node-creation call site (`createNodeFromDrop`,
  `addCustomShapeNode`, `instantiatePattern`) spreads into `createNode()`.
  `duplicateSelection()` deliberately does **not** apply them — a
  duplicate copies its source node's actual values, not the current
  defaults. `modals/defaultSettingsModal.js`'s "apply to all" button is a
  separate, explicit bulk `store.dispatch` over every existing node — the
  defaults themselves never retroactively change what's already on the
  canvas on their own.
- `projects.js`: named saved-project CRUD (see docs/SPEC.md 4.7.1/4.7.3).
  Records carry a `favorite: boolean` that `saveNamedProject()` explicitly
  reads forward from the existing record on every re-save (it's not part
  of the live project schema written by `core/project.js`, so a naive
  `{...project, updatedAt}` spread would silently drop it — the fix is to
  look up the prior record's `favorite` before building the new one).
  `exportAllSavedProjects()`/`importSavedProjectsBundle()` bundle/restore
  every saved project as one file; `getRawSavedProjects()` exposes the
  full records (including `favorite`) for `fullBackup.js` to embed as-is.
- `customComponents.js`: adds an optional free-text `folder` field to each
  custom component record (trimmed on save) and `getCustomComponentFolders()`
  (distinct, sorted, non-empty folder names) for the New/Edit Component
  modal's `<datalist>` (`utils/folderDatalist.js`, rebuilt on every modal
  open since folders change over time — unlike the static
  `utils/layerDatalist.js`, built once).
- `favorites.js`: personal component-library shortcut list (docs/SPEC.md
  4.2.10) — two flat arrays under their own keys, `favoriteFolders`
  (`{id, name, parentId, order}`) and `favorites`
  (`{id, defId, folderId, order}`, `folderId: null` = unfiled at the
  Favorites root). Folders nest by `parentId` referencing another folder's
  `id` — arbitrary depth, no schema-level limit — rather than a real tree
  structure in storage; `sidebar.js`'s renderer walks it recursively
  (`getChildFolders(parentId)` + `getFavoritesInFolder(folderId)`) to build
  the nested `.sidebar-folder` DOM, mirroring (but generalizing to N levels)
  the single-level folder grouping `customComponents.js` already has for
  "My Components". `order` is a plain number scoped to same-parent
  siblings (folders) or same-`folderId` siblings (favorites); reordering
  (`reorderFolder`/`reorderFavorite`) swaps two siblings' `order` rather
  than renumbering the whole list. `deleteFolder(id)` cascades: it
  recursively collects every descendant folder's id first
  (`collectFolderIds`), then removes all of them plus every favorite whose
  `folderId` is in that set in one pass — favorites lose their folder
  pointer (i.e. are un-favorited), the underlying component is never
  touched. `sidebar.js#resolveFavoriteDef(defId)` resolves a favorite back
  to a real definition by checking the built-in library
  (`data/index.js#getComponentById`) then "My Components"
  (`getCustomComponents()`), silently skipping (never crashing on) a
  `defId` that resolves to neither — the one case that can produce this is
  a custom component getting deleted while still favorited, which
  `customComponents.js#deleteCustomComponent` proactively avoids by calling
  `removeFavorite(id)` itself rather than leaving a dangling reference
  behind. Folder naming (create/rename/add-subfolder) uses a new
  `modals/promptModal.js#promptText({title, label, defaultValue,
  confirmLabel})` — this app's first single-line text-entry confirmation
  dialog (everything before it was either a full custom-field modal or
  `modals/confirmModal.js`'s yes/no `confirmAction()`); no native
  `window.prompt()`, which can't be styled or driven reliably from
  Playwright.
- **Import collision handling** (`customComponents.js#importCustomComponents`,
  `projects.js#importSavedProjectsBundle`, and `fullBackup.js`): every
  merge-style import applies the same rule — an incoming record whose `id`
  matches an existing one overwrites it in place; a `name` collision with a
  *different* `id` gets a disambiguating suffix (`"(imported)"`, then
  `"(imported 2)"`, ...), computed by the shared
  `utils/disambiguateName.js`, instead of silently colliding — so nothing
  is ever dropped. `favorites.js#importFavoritesBundle` (used only by
  `fullBackup.js`, there's no standalone Favorites export/import UI) is
  additive-merge too, but simpler: matched purely by `id` (folders/favorites
  have no user-facing "name collision" concept the way a named custom
  component does), so an incoming record whose `id` already exists locally
  is just left alone rather than overwritten. `fullBackup.js#importFullBackupFile()`
  composes all of the above with a direct `store.loadProject()` for the
  bundled canvas and a plain `saveNodeDefaults()` overwrite for defaults —
  those two aren't "libraries" with multiple entries, so there's nothing to
  merge, only replace, which is why the UI (`modals/backupModal.js`) gates
  the whole restore behind one `confirmAction()` up front rather than
  per-field.

- `librarySettings.js`: app-level sidebar visibility settings (currently
  just `hideStateMachines`), a small `readJSON`/`writeJSON`/change-listener
  module in the same shape as `nodeDefaults.js`. `sidebar.js#renderList`
  filters `CATEGORIES` against it (via `HIDEABLE_CATEGORIES`, a
  setting-key → category-id map) before rendering, so hiding a category is
  purely a browse/search-time filter — content already on the canvas is
  untouched either way.
- `whatsNew.js`: tracks the last app version (`js/version.js#APP_VERSION`)
  a visitor saw, in its own key. `checkWhatsNew()` (called once at boot in
  `main.js`) distinguishes three cases: already on the current version
  (nothing to show), a brand-new visitor with *no* prior app data at all
  (nothing to show — the hints tour handles onboarding), or anyone else
  (show every `VERSION_HISTORY` entry newer than what they last saw). The
  boot always calls `markVersionSeen()` right after, regardless of which
  case, so the modal is a one-time-per-update nudge, not a repeat nag.

- `core/project.js#duplicateProject(project)`: pure clone with a fresh
  project id/name/timestamps and every node/edge/sub-component/group id
  regenerated (a `nodeIdMap`/`groupIdMap` pair, the same remapping shape
  `canvas.js#duplicateSelection` already uses for a partial selection).
  `canvas.js#duplicateProjectAsNew()` just calls it and
  `store.loadProject()`s the result — the original project is never
  touched, so it's still exactly as it was under its own id (autosaved or
  saved-as separately). `canvas.js#duplicateEntireCanvas()` is the
  same-project variant: select every node+edge, then reuse
  `duplicateSelection()` as-is — no new duplication logic needed there.

- `canvas.js#clearCanvas()` (canvas right-click → "🧹 Clear canvas") is in
  a sense the opposite of `duplicateEntireCanvas()` above — same-project,
  but *emptying* rather than doubling. A confirm dialog gates it (skipped
  if the canvas is already empty), and it clears `nodes`/`edges`/
  `replicationPairs` via a plain `store.dispatch()`, not
  `store.loadProject()` — see the "Undo/redo" section above for why that
  distinction matters here specifically.

## AI Design Review (`io/aiReview.js`, `panel/aiReviewPanel.js`)

Deliberately **not** an API integration — see docs/SPEC.md 4.12 for the
full reasoning (no mainstream LLM offers key-free API access; scraping
Google's embedded AI search results is blocked by CORS and against their
ToS). `aiReview.js#buildReviewPrompt()` is a pure string builder (project
name/node-edge counts/component names, plus an optional attached spec
file's text, truncated to a sane length). The panel:
1. Lets the prompt be edited in place (`promptOverride`, `null` until the
   user types, at which point it wins over the auto-generated text on
   every re-render).
2. Exports the diagram via the existing `io/exportImage.js` (both
   `exportPNG()` for a download and `captureDiagramCanvas()` re-used
   directly for an optional clipboard-image copy, feature-detected via
   `navigator.clipboard.write`/`ClipboardItem`).
3. Opens each provider's own public chat URL (`AI_PROVIDERS` in
   `aiReview.js`) in a new tab and copies the prompt to the clipboard in
   the same click — the user is (presumably) already signed in there, so
   no key ever exists in this app.
4. Has no automatic way to get the reply back (that would hit the same
   key/CORS wall) — a paste-back textarea saves replies into
   `savedReviews`, a module-level array that is **not** persisted
   (resets on reload) and **is** reset whenever the active project itself
   changes.

`buildReviewPrompt()` also takes `hasSequenceDiagram` (the panel passes
`state.nodes.some((n) => n.shape === 'lifeline')`) and swaps its entire
"Act as a senior..." checklist based on it — a sequence diagram calls for
call-order/missing-response/race-condition questions, not the generic
scalability/reliability/security checklist, which doesn't fit a flow
diagram at all. Purely a prompt-text branch — no other part of the panel
changes.

**"🔍 Review" / "💬 Explain" mode toggle**: a second exported prompt builder,
`buildExplainPrompt({projectName, nodeCount, edgeCount, componentNames,
specText, hasSequenceDiagram})`, asks for a plain-language walkthrough
instead of critique. The panel's module-level `mode` state (`'review'` |
`'explain'`) picks which builder `currentPrompt()` calls; switching modes
resets `promptOverride` to `null` so the new mode's own auto-generated text
shows instead of silently keeping the other mode's hand-edited prompt —
exactly the same "an explicit user edit wins until something invalidates
it" pattern `promptOverride` itself already follows for a project switch.

That last point is a subscription pattern worth calling out:
`initAiReviewPanel()` subscribes to `store`'s `'change'` event but only
acts when `store.getState().id` differs from the last-seen id — i.e. only
on an actual project switch (New/Load/Duplicate/restore), never on a
plain node/edge edit. This avoids two problems a naive "re-render on every
change" subscriber would have: fighting the user's typing in the prompt
textarea, and re-rendering the whole panel on every coalesced drag frame
(store emits `'change'` for those too — see "State flow" above). The
`detailsPanel.js` pattern (re-render whenever its one open node's data
changes) doesn't apply here since this panel isn't node-scoped.

## Generate Design from Spec (`io/aiGenerateDesign.js`, `modals/generateDesignModal.js`)

The reverse direction of AI Design Review — see docs/SPEC.md 4.13. Same
"prepare and hand off, no API key" mechanism, so the same reasoning above
applies unchanged. `aiGenerateDesign.js` has no UI code, only three pure
functions:
1. `buildGenerateDesignPrompt({specText})` — a string builder that embeds
   the (length-capped) spec text plus a hardcoded, complete, valid
   few-shot JSON example anchored to this app's own project shape (real
   shape/routing enum values pulled from `core/project.js#SHAPES`/
   `ROUTINGS`, not hand-duplicated, so the prompt can't drift out of sync
   with what `validateProject()` actually accepts).
2. `extractProjectJSON(text)` — never throws; tries a direct `JSON.parse`,
   then a fenced ` ```json ` block, then the first-`{`-to-last-`}`
   substring, returning the first candidate that parses to a plain
   object. Handles an AI reply that ignored "respond with only JSON" and
   added prose around it.
3. `autoArrangeIfNeeded(project)` — a safety net: if fewer than half the
   nodes have distinct `(x, y)`, they're re-laid-out on a simple grid
   (order/content preserved, only position changes). A project with
   genuinely distinct positions passes through untouched. Skipped
   entirely (before even checking positions) when any node is
   `shape === 'lifeline'` — a square grid would scramble a sequence
   diagram's meaningful left-to-right order and squash its tall vertical
   shape, which is strictly worse than leaving an imperfect AI-chosen
   layout alone; a dedicated lifeline-specific fallback wasn't judged
   worth the complexity given how rarely the AI actually mis-lays out just
   2-5 participants.

`buildGenerateDesignPrompt()`'s few-shot section also includes a *second*,
smaller example for the sequence-diagram (lifeline) shape, with its own
short rule list (straight routing, strictly increasing `fromOffset`/
`toOffset` per message so nothing stacks, a self-message's matching
`fromSide`/`toSide` — see the self-messages section above) and explicit
guidance on *when* to reach for it: only when the spec is fundamentally
about a step-by-step call order, not a static architecture. Two fenced
` ```json ` blocks now appear in the prompt rather than one;
`tests/unit/aiGenerateDesign.test.mjs` asserts on the *second* one
specifically to keep the two examples' tests from silently drifting onto
each other if their order ever changes.

`modals/generateDesignModal.js` is a single `openModal()` call with a
closure-scoped `step` variable and a `renderStep()` function that
`clear()`s and rebuilds the modal body per step — there's no per-step
modal-title support in `modal.js`'s API, so a `.modal-step-indicator`
paragraph fills that role instead. Extracted JSON is run through the same
`validateProject()` used by every other import path before it ever
touches the store, so a malformed/partial AI reply degrades to a clear
inline error (text preserved for a retry) rather than a crash or a
partially-broken canvas. Replacing a non-empty canvas goes through the
same `confirmModal.js#confirmAction()` used elsewhere, skipped entirely on
an empty canvas.

**Gotcha this feature exposed and fixed**: `modal.js`'s backdrop-click
handler used to close the dialog based on comparing click coordinates to
`dialog.getBoundingClientRect()`. That's wrong for any modal whose content
resizes during its own click handler (like this wizard's steps, which
differ substantially in height) — the click coordinates were captured
against the *pre-resize* rect, so a click near the edge of a dialog that
just shrank could land "outside" the new rect and self-close the modal.
Fixed by checking `e.target === dialog` instead, which is the correct way
to detect a native `<dialog>` backdrop click (its backdrop isn't a real
element in the DOM tree — a click that lands there targets the dialog
itself) and doesn't depend on rect timing at all.

## Live Replication (`core/replication.js`, `modals/replicationModal.js`)

Two "sides" (each an ordinary node group — `node.groupId`, the same
mechanism `groupSelection()` already uses) linked by a `replicationPairs`
entry on the project: `{ id, mode, groupA, groupB, offsetX, offsetY,
members: [{a, b}], edgeMembers: [{a, b}] }` (`edgeMembers` — see below —
is the exact same `{a, b}` id-mapping shape as `members`, just for edges
instead of nodes). `mode` is purely a descriptive label — every mode
runs through the exact same engine. No new spatial-containment concept was
introduced (the app has no parent/child node nesting); "side A" and "side
B" are just two `groupId`s, and `offsetX/offsetY` is the constant delta
between them, computed once at pair-creation time from side A's bounding
box.

`syncReplication(prevProject, nextProject)` is a pure function, deliberately
free of any DOM/store coupling so it's trivial to unit-test directly and to
call from two different integration points:
- `store.js#dispatch()` calls it with `prev = state` (before the mutator
  ran) and `next = draft` (after) — diffing against the real "before"
  state is what lets it tell *which side actually changed* in this one
  user action, without any call site (canvas drag, a details-panel edit,
  JSON import, the AI-generate paste-back, ...) needing to know
  replication exists at all.
- `store.js#loadProject()` calls it with the *same* object as both
  `prev` and `next` (a self-diff) — every node compares equal to itself,
  so content/position propagation never fires, but the "any node newly
  found with a side's groupId and no mapping yet" discovery pass still
  runs. That's what makes an imported/pasted/AI-generated project's
  `replicationPairs` "detect the existing state" on first load, per
  docs/SPEC.md 4.14, with no special-casing beyond passing one object
  twice.

Per pair, each sync pass:
1. **Reconciles existing `members`**: a pair whose `a`/`b` node id is
   simply gone gets its surviving peer cascade-deleted (a genuine
   deletion should never leave a stale orphan on the other side). A pair
   where one side is still present but no longer *eligible* (its
   `groupId` no longer matches that side, or it's `replicationExcluded`)
   instead just severs the mapping — **and flags the surviving peer
   `replicationExcluded` too**. That flag-the-peer step is required, not
   cosmetic: without it, the peer would look to the next step like an
   ordinary, unmapped member of its own side's group and get mirrored
   right back, undoing the severance. It also has the nice side effect of
   keeping the per-node "excluded" checkbox honest — it now reads
   excluded because the node genuinely no longer participates.
2. **Propagates a change**: for a still-linked pair, compares each side's
   `signature()` (every mirrorable field, JSON-stringified, minus
   `id`/`groupId`/`zIndex`/`replicationExcluded`) against its
   `prevProject` counterpart. Whichever side's signature actually changed
   drives the update — content fields are copied verbatim (sub-components
   cloned with fresh ids), position is copied via the pair's fixed offset
   in the appropriate direction. If *both* sides changed within the same
   dispatch (only realistically possible via a bulk multi-select edit that
   already applied the identical value to both), nothing propagates —
   the tie means they already match.
3. **Discovers new/unmapped members**: any node whose `groupId` matches a
   side and isn't already in `members` (and isn't excluded) gets a mirror
   created on the other side.

**Internal connectors mirror too** — steps 4-5, run after 1-3 above using
the *final* `survivingMembers` list so a connector drawn between two
already-paired nodes in the same dispatch is caught in the same sync pass:
4. **Reconciles existing `edgeMembers`**: for each mapping, checks both
   edges still exist and both endpoints are still live-mapped members
   (`aToB`/`bToA`, built from `survivingMembers`) — cascade-deletes the
   surviving edge if the other side's is genuinely gone, drops the mapping
   (deleting neither edge) if an endpoint merely stopped being a live
   member (excluded/regrouped away), otherwise propagates content changes
   via a `edgeSignature()` comparison (same shape as node `signature()`,
   minus `id`/`from`/`to`).
5. **Discovers new internal edges**: any edge in the project whose `from`
   and `to` are both currently-mapped members of the *same* side, with no
   existing `edgeMembers` entry yet, gets mirrored to the other side
   (`cloneAsMirrorEdge` — fresh id, `from`/`to` swapped to that side's
   mapped node ids, every other field — routing/color/width/dash/arrows/
   label/labelPosition/notes — copied verbatim from `EDGE_MIRROR_FIELDS`).

This is what makes drawing a message between two paired sequence-diagram
lifelines (docs/SPEC.md 4.15) mirror to the other side live, same as
everything else about replication — no special-casing for "this edge
happens to be a message," it's just an edge between two members of the
same side. `buildReplicationPair(nodes, selectedNodeIds, mode, edges)`
mirrors this at pair-creation time too: after building node mirrors, any
edge whose `from`/`to` are both in the newly-selected set gets its own
mirror + `edgeMembers` entry in the same pass, so a sequence diagram
selected with its messages already drawn arrives at the new pair fully
wired, not needing a follow-up sync to catch up.

`buildReplicationPair(nodes, selectedNodeIds, mode)` is the pure builder
behind "create a pair from the current selection" — reuses one common
existing `groupId` for side A if the whole selection already shares one
(otherwise mints a fresh one, same "overwrite on regroup" precedent as
`groupSelection()`), skips any `replicationExcluded` node from being
mirrored at all, and returns everything `canvas.js#createReplicationPairFromSelection`
needs to fold into one atomic `store.dispatch()` call.

**Joining an existing pair** (`canvas.js#addSelectionToReplicationSide(pairId,
side)`) just assigns the current selection's `groupId` to that side's — no
new mechanism, discovery pass 3 above does the rest on the next sync. This
already worked for any selection size, including a single freshly-placed
node, from `replicationModal.js`'s "Or add this selection to an existing
pair" section — the real gap was discoverability, not function: a node not
yet in a pair also gets a "🔁 Join replication..." item in its own
right-click context menu (`canvas.js#openNodeContextMenu`), which selects
just that node and dispatches a `sdb:open-replication` window event (the
same "avoid a circular import" pattern `sdb:open-details` already uses —
`replicationModal.js` imports several actions *from* `canvas.js`, so
`canvas.js` importing `openReplicationModal` back would be circular)
listened for by a `window.addEventListener` at `replicationModal.js`'s
module scope. The menu item is gated on the node not already belonging to
some *other* multi-member group too, not just "not already replicated" —
`addSelectionToReplicationSide` overwrites `groupId` with no merge, so
without that guard, joining replication from a node that's already a
member of a plain Group/Ungroup group would silently detach it from that
group with no warning.

`canvas.js` also guards against a group being claimed by two different
pairs at once (`isGroupInAnyPair`) in both the create and join actions —
the engine itself doesn't strictly need this (each pair syncs
independently against whatever `nodes` looks like after earlier pairs in
the same pass already ran), but a node whose side is ambiguous between two
pairs is a state the UI should simply never let a user create.

`core/project.js#validateProject()` validates `replicationPairs` the same
"coerce to safe defaults, never throw" way as everything else (drops a
pair with an equal/missing `groupA`/`groupB`, clamps an unknown `mode`,
filters `members` entries to ids that survived node validation, and
likewise filters `edgeMembers` entries to ids that survived edge
validation — defaulting to `[]` if missing entirely, so an older saved
project or hand-written JSON from before this field existed loads exactly
as before) and `duplicateProject()` remaps a pair's `groupA`/`groupB`/
`members`/`edgeMembers` through the same id maps it already builds for
nodes/edges/groups, dropping a pair outright if neither of its groups
survived the clone (nothing left to duplicate).

**Freeze/resume** is a single `pair.frozen` boolean, checked first thing in
`syncPair()` — a frozen pair short-circuits to a no-op before any of the
reconcile/discover logic above runs, so "frozen" really does mean
completely inert, not just "content propagation paused" (a new member
added to a frozen pair's group is *not* discovered and mirrored either,
by design — see docs/SPEC.md 4.14 for why joining a frozen pair is
disabled in the UI). There's deliberately no "resume and reconcile
retroactive drift" step: resuming just lets the normal `prevProject`-vs-
`nextProject` diff resume noticing changes from that point forward, since
whatever changed while frozen was never diffed against a "before" state at
all (each frozen dispatch returned immediately, so there's no meaningful
merge to compute — reconciling would require picking a winner between two
independently-diverged sides, which the freeze feature exists specifically
to allow without the engine second-guessing it).

## Group backgrounds (`canvas/groupBackgrounds.js`, `canvas.js#renderGroupBackgrounds`)

A subtle dismissible boundary box rendered behind every relevant `groupId`
— a regular Group/Ungroup group and a replication pair's side are the
*exact same mechanism* under the hood (both are just nodes sharing a
`groupId`, see the Live Replication section above), so `computeGroupBounds`
needs no special case for either shape-wise, only a different member-count
floor:

- A **regular group** needs 2+ members to mean anything visually — a
  single-member "group" can legitimately happen transiently (e.g.
  mid-ungroup) and has nothing to bound.
- A **replication side** is meaningful — "this is a live-mirrored unit" —
  with just 1 member, which is the common case (most replicated pairs
  mirror one component to one peer), so `replicatedGroupIds` (every
  `pair.groupA`/`pair.groupB` currently in play, computed once per render
  in `canvas.js#render` from `state.replicationPairs`) gets a floor of 1
  instead of 2. Each side gets its *own* box — a pair with 1 member per
  side renders two separate boundaries, not one spanning both.

Rendered as a `<div class="group-bg">` per active `groupId` in a new
`groupBgLayer`, inserted into `contentEl` *before* `edgeLayer`/`nodeLayer`
(see `initCanvas`) so it's always behind both, sharing their same
pan/zoom-transformed coordinate space — its `x/y/w/h` are plain
canvas-space numbers, no conversion needed. `pointer-events: none` on the
box itself keeps it from intercepting clicks meant for a node or the
canvas background underneath; only its own "✕" dismiss button
(`pointer-events: auto`, shown on hover) opts back in.

Dismissing is **session-only** — `hiddenGroupBackgrounds` is a plain
in-memory `Set` in `canvas.js`, not part of the persisted project schema.
The group/pair itself is completely unaffected by dismissing its
background; a dismissed `groupId` that later drops out of
`computeGroupBounds` entirely (group dissolved, pair broken) is cleaned out
of the set automatically in `renderGroupBackgrounds`, keeping it from
growing unbounded over a long session.

## Mobile/responsive layout (`css/responsive.css`)

Two real bugs found by direct DOM measurement (screenshots alone were
misleading — see the note on `fullPage` screenshots below) drove the
current approach, both stemming from the same root cause: the toolbar's
height is **not constant**. `.toolbar-row` wraps its `.toolbar-group`
children onto new lines once they don't fit, and once there are enough
groups/buttons (routine well before the 900px breakpoint), the toolbar
becomes several rows tall — a moving target that grows every time a new
toolbar button is added.

1. **A `.toolbar-group` didn't wrap internally.** `.toolbar-row` wrapping
   *groups* onto new lines doesn't help if a single group (e.g. "New
   Component" + "Add Shape" + "Generate Design" + "Replicate" + "Defaults")
   is on its own wider than the viewport — adding the "🔁 Replicate" button
   was what tipped that group over 390px width and forced the whole page
   into horizontal scroll. Fixed with `.toolbar-group { flex-wrap: wrap }`
   inside the mobile media query, so a too-wide group wraps its own buttons
   instead of overflowing.
2. **The sidebar/details-panel/AI-review-panel mobile drawers used
   `position: fixed; top: var(--toolbar-height)`** — a constant 56px,
   correct only for a single-row toolbar. Once the toolbar wraps onto
   several rows its real height is well past 56px, so the drawer rendered
   starting partway *through* the toolbar rather than below it. Fixed by
   switching to `position: absolute; top: 0` anchored to `.app-body`
   (already `position: relative`, and already the second child of a column
   `flex` `#app` — meaning it starts exactly where the toolbar's real
   rendered box ends, at any height, with no need to know that height at
   all). Don't revert to `fixed` + a hardcoded pixel `top`.

3. **`#canvas-viewport` had no `touch-action` set**, so a single-finger
   touch-drag pan (`canvas.js#beginPan`, driven entirely by pointer events)
   could be arbitrated by the browser as a *native* scroll/pan gesture
   running in parallel with the JS `transform`-based pan — the two fighting
   over the same GPU-composited layer is a known cause of content
   flickering/vanishing mid-gesture on mobile Chrome/Safari.
   `preventDefault()` on `pointerdown` alone does **not** reliably suppress
   this (only `touch-action`, or `preventDefault()` on the raw `touchstart`,
   does). Fixed with `touch-action: none` on `#canvas-viewport` in
   `css/canvas.css` — the "used" touch-action for a region is the
   *intersection* of the value on the element and all its ancestors, so
   setting it once here covers every descendant gesture surface (`.node`,
   `.resize-handle`, `.conn-point`) too, without repeating the declaration.
   Also added `setPointerCapture()` to `beginPan`, `beginResize` and
   `beginConnectFromNode` for robustness against a fast/off-bounds
   touch-drag producing a `pointercancel` — deliberately *not* added to
   `nodeInteractions.js#beginMove` (a node's move-drag), since that handler
   fires on every pointerdown on a node including both clicks of a
   double-click, and capturing the pointer there broke the browser's native
   `dblclick` synthesis outright.
4. **The main toolbar row has ~zero horizontal slack at common desktop
   widths (e.g. 1280px)** — `File`/`Create`/`Tools`/`Help` were already
   sitting right at the row's edge before the canvas search box existed,
   with `Help` alone routinely wrapping onto its own row 2. Adding the
   search box *before* the flex spacer (i.e. earlier in row-1's DOM order)
   shifted the flex-wrap line-break point enough to drag `Tools` onto row 2
   with it, landing `Help`'s dropdown trigger — and therefore its panel —
   in a different spot than before: directly under the first-run tour's
   hint bubble, silently swallowing clicks on it
   (`tests/e2e/hints.spec.js`'s toggle test caught this). Fixed by
   appending the search box **last** in `toolbar.js#initToolbar`'s row-1
   `appendChild` sequence, after `Help` — since flex-wrap's line-breaking
   uses each item's hypothetical (pre-shrink) size in DOM/visual order,
   whatever's appended last is the thing that wraps first if anything does,
   leaving the earlier triggers' wrap behavior (and therefore their
   dropdown panels' position) undisturbed. **Any future always-visible row-1
   item should be appended after the existing dropdown triggers for the
   same reason**, not inserted in the middle of the row.

**Gotcha these fixes exposed**: a `fullPage: true` Playwright screenshot
can lay the page out against a different synthetic viewport for the
capture, which throws off anything sized/positioned relative to the *real*
viewport (`vw` units, this file's `position: absolute` drawers). During
the investigation this produced a screenshot that looked like the sidebar
was ~130px wide with toolbar buttons bleeding through it, while the live
page at the actual viewport size was already rendering correctly. Prefer a
plain (non-`fullPage`) screenshot, or cross-check with
`getBoundingClientRect()`/`getComputedStyle()` via `page.evaluate()`,
before treating a screenshot as ground truth for a fixed/absolute mobile
overlay. `tests/e2e/mobile-responsive.spec.js` asserts the underlying
geometry (`scrollWidth`, drawer `top` vs toolbar `bottom`) rather than
comparing screenshots, for exactly this reason.

## Node label placement (`canvas/node.js`)

A node's label normally renders inside `.node-body` (which has
`overflow: hidden` so content respects clip-path shapes like
diamond/hexagon). `textPosition: 'above'|'below'` is the exception: that
label is appended as a sibling of `.node-body`, directly under the `.node`
root (`updateExternalLabel()`), positioned with `position: absolute`
relative to it — appending it *inside* `.node-body` would clip it, since
by definition it needs to render outside the shape's box.

### Borders on clip-path shapes (diamond, hexagon)

A plain CSS `border` doesn't follow a `clip-path` polygon's actual outline
— the border box underneath is still a rectangle, so the clip just crops
that rectangle's border unevenly along the diagonal edges (thin or missing
at points, uneven thickness on angled edges) instead of a border that hugs
the visible shape. `css/node.css` fakes it with two nested clipped layers
instead, the same trick an SVG stroked polygon achieves natively: the outer
`.node-body` itself becomes the "stroke" layer — filled with the border
color and clipped to the full polygon — and a `::before` pseudo-element
inset by the border width sits on top as the "fill" layer, `clip-path:
inherit`-ing the *same* polygon coordinates. Since a polygon's percentages
are relative to whichever box is being clipped, the identical coordinates
on the smaller, inset pseudo-element naturally produce a proportionally
smaller, centered inner shape — no separate math needed for the inner
outline. The colors/width feed in via `--node-fill`/`--node-stroke`/
`--node-border-width` custom properties (`node.js#updateNodeEl` sets them on
`.node-body` alongside the inline `border-*` properties every other shape
relies on directly) — a pseudo-element can't be targeted from JS directly,
but it can read a `var(--...)` custom property set as an inline style on its
real parent.

Real content (icon/label/chips) — normal-flow, non-positioned children of
`.node-body` — must paint on top of the `::before` "fill" layer, and the
`::before` rule carries an explicit `z-index: -1` to make that happen. A
first version omitted it on the theory that "a pseudo-element without its
own stacking context always paints behind subsequent normal-flow content" —
true for a non-positioned pseudo-element, but `clip-path` on `.node-body`
itself creates a stacking context, and *within* that context `::before` is
a **positioned** element (`position: absolute`, required for `inset` to
apply). Per the CSS2 painting-order algorithm, a positioned z-index:auto
descendant paints in a *later* step than in-flow non-positioned descendants
of the same stacking context — i.e. on top of them, not behind — so every
diamond/hexagon node's icon and label rendered completely hidden behind the
opaque fill layer. `z-index: -1` moves `::before` to the algorithm's
negative-stack-level step instead, which *does* paint before the in-flow
content, restoring the intended order without needing to touch every
content wrapper. See `tests/e2e/custom-and-shapes.spec.js`'s border test for
a regression check that hit-tests the label's own center point rather than
just asserting it's present with non-zero size — the earlier version of
that test only checked clip-path/color values and never caught this.

### Database cylinder shape (`data-shape="cylinder"`)

Unlike diamond/hexagon, this shape needs no `clip-path` (and so none of the
`z-index` stacking-context workaround above) — it's built entirely from
`border-radius`, an absolutely-positioned `::before`, and `.node-body`'s own
`overflow: hidden`. `.node-body` supplies the sides and the curved bottom
(`border-radius: 0 0 45% 45% / 0 0 22% 22%`, its own top border suppressed
with `border-top: none`), and `::before` draws a full ellipse "cap"
(`border-radius: 50%`) positioned at `top: 0`. Because the cap sits fully
inside the body's own top band, `.node-body`'s `overflow: hidden` clips it
identically to any other content — no separate clip-path/inset math needed
the way diamond/hexagon's fill layer requires. The ellipse's *lower* arc,
crossing through the middle of that top band, is what reads as the
cylinder's front "seam" line; its upper arc blends into the body's own
flat top edge since both use the same `--node-fill`/`--node-stroke`
colors. `padding-top` on `.node-body` keeps icon/label content clear of the
cap band — since `::before` here has no `z-index` (nothing forces it into
its own stacking context), paint order relative to in-flow content is
undefined by default, so correctness relies on the two never overlapping
rather than on layering, unlike the diamond/hexagon fill layer above.

## Diagram Versions & Presentations (`core/project.js`'s `createVersionSnapshot`/`removeVersion`, `core/diagramDiff.js`, `canvas.js`'s version/presentation actions, `modals/versionHistoryModal.js`, `modals/diagramCompareModal.js`, `modals/presentationsModal.js`, `modals/presentationPlayerModal.js`, `io/exportPptx.js`)

A version is a named, timestamped snapshot of `{nodes, edges, replicationPairs}`
captured onto `project.versions` (`createVersionSnapshot` — `structuredClone`s
its input for defense-in-depth isolation, even though `store.js`'s own
`dispatch` already replaces state wholesale via `structuredClone` on every
mutation). `revertToVersion`/`deleteVersion`/`saveDiagramVersion` in
`canvas.js` are plain `store.dispatch` actions — undoable, no special-casing.
`validateContent` (extracted from what used to be `validateProject`'s inline
node/edge/replicationPairs parsing) is shared between the top-level project
and every version snapshot, so an imported/hand-edited version gets exactly
the same id-backfilling/field-clamping as the live project.

Comparing two versions (or a version against the live canvas) is a pure
id-based structural diff (`core/diagramDiff.js#computeDiagramDiff`) —
meaningful specifically because a version shares the same project's id-space
across time, not a general-purpose diagram-diff tool. `diagramCompareModal.js`
renders added/removed/changed buckets for both nodes and edges, each entry
clickable only when its id still exists on the live canvas.

A presentation (`project.presentations`) is just an ordered list of
`{versionId, title, notes}` slides. The interesting part is rendering one:
`presentationPlayerModal.js#renderSlidesToDataUrls` loops the slides and, for
each, calls `withTemporaryContent` — swaps `store`'s live `nodes`/`edges` to
that version's snapshot via `store.dispatch(mutator, {coalesce: true})`,
waits a frame, captures a screenshot via the existing
`io/exportImage.js#captureDiagramCanvas()`, then swaps back the same way.
**Why `{coalesce: true}` matters**: `store.js#dispatch` only calls
`history.commit(state)` when `opts.coalesce` is falsy (confirmed by reading
its source, not assumed) — so this whole swap-capture-swap cycle, run for
every slide, never touches the user's real undo/redo stack. This was
deliberately chosen over `store.loadProject()`, which resets undo history
entirely (see `docs/AI_AGENT_GUIDE.md`'s pitfall on this). `replicationPairs`
is dropped during the temporary swap, matching `canvas/subDiagramEdit.js`'s
established precedent — the sync engine has nothing useful to reconcile
against an unrelated snapshot's content.

`io/exportPptx.js#exportPresentationToPptx` reuses `renderSlidesToDataUrls`
directly, then feeds the resulting data URLs into `PptxGenJS` (vendored, see
`vendor/VENDOR.md` — the standalone bundle form, JSZip included, exposing
`window.PptxGenJS`, lazily loaded via `utils/loadScript.js#loadScriptOnce`)
to build a 16:9 deck, one slide per version with its title as a heading and
its notes in the slide's speaker notes, then `pptx.write({outputType:
'blob'})` → the existing `utils/download.js#downloadBlob`.

## Reference Architecture Templates (`data/categories/reference-architectures.js`)

A new component category alongside `design-patterns.js`, built the exact
same way (`definePattern`, every node a real component/layer defId) but one
level up in scope — a whole simplified system design (URL Shortener, Chat
Application, Rate Limiter Service, Social Media Feed, Ride-Sharing Dispatch)
rather than a single architectural building block. Each one sets
`groupOnInstantiate: true` (the same field a saved multi-component custom
component uses, see "Custom multi-component groups" above) so instantiating
one produces a single movable group with a background frame — a "Design X"
is meant to read and move as one whole design, not a loose cluster the way
most `design-patterns.js` entries are. `canvas.js#instantiatePatternAtPoint`
handles `groupOnInstantiate` identically regardless of which of the two data
files a pattern came from.

## Command Palette (`toolbar/commandPalette.js`, `modals/commandPaletteModal.js`)

Split into a pure matching function (`toolbar/commandPalette.js#filterCommands`
— checks a command's `label`/`keywords`, unit-testable without a DOM) and the
actual modal (`modals/commandPaletteModal.js`, which needs live imports:
`openModal`, every action it can run, `store` for context). Opened via a
toolbar button or `Ctrl/Cmd+K` — the shortcut is registered in
`main.js#initKeyboardShortcuts` *before* the `isTypingTarget` early-return
guard, the same position as the existing `Ctrl/Cmd+S` handler, so it works
even while a text input is focused.

Results are built from three sources: `buildAppCommands()` (a flat list of
~30 app actions), `buildContextualCommands(nodeId)` (only when exactly one
node is selected — its curated `related`/`relatedLayers`/`relatedPatterns`
via `data/index.js`'s resolvers, plus duplicate/delete), and a live filter of
`ALL_COMPONENTS` via the sidebar's own `sidebar/search.js#componentMatches`
(reused rather than reimplemented). `componentToCommand(def)` branches on the
matched component's `kind` — `pattern` → `instantiatePatternAtCenter`,
`layer` with exactly one node selected → `addLayerToNode`, else →
`addComponentAtCenter` — mirroring `sidebar/dragSource.js`'s established
click-to-add branching exactly, so a palette-driven "add" never bypasses the
kind-specific handling a sidebar click would apply. Contextual results render
first, under their own heading, ahead of the general component/action list.
Picking a component-adding result reuses the same canvas.js entry points the
sidebar itself uses, so the existing "✨ Smart Suggestions" banner naturally
appears afterward — no separate "what to add next" mechanism was needed.

## Estimated Cost & Label Chips (`core/cost.js`, `modals/costBreakdownModal.js`, `canvas/node.js`)

`node.monthlyCost` (default `null`) is a small addition to the node schema
alongside the pre-existing `labels` field. `core/cost.js` is pure:
`getCostedNodes`/`computeMonthlyCostTotal`/`formatMonthlyCost`, reused by
both the node-face badge and `costBreakdownModal.js`'s list+total (Tools
menu). `canvas/node.js#buildStandardBody` renders a `.node-cost` badge when
`monthlyCost` is set and a `.node-labels` row of `.node-label-chip`s when
`labels` is non-empty — both new, visually distinct from the pre-existing
`.node-subchip` (sub-components) styling so the three don't blend together
on a busy node. `labels` itself already existed (details panel-editable)
before this batch but was previously invisible anywhere except a generic
"has extra info" dot badge; this is the first release that actually renders
it on the canvas.

## Smart Alignment Guides (`core/alignmentGuides.js`, `canvas/nodeInteractions.js#beginMove`, `canvas.js`'s `.align-guide-layer`)

`core/alignmentGuides.js#computeAlignmentGuides(movingBox, staticBoxes,
threshold)` is pure geometry: for each of the moving box's
left/center/right (and top/center/bottom) positions against every static
box's same three positions, it finds the single closest match per axis
within `threshold` and returns a `{dx, dy}` nudge plus every guide line that
position actually lines up with (not just the one that produced the
snap — so three components already sharing a left edge all light up
together). `boundingBoxOf(nodes)` lets a multi-selection drag reuse the
exact same function, treating the whole selection as one box.

Rendering reuses `contentEl` — the div `viewport.js` applies the pan/zoom
CSS transform to — rather than `marqueeEl`'s pattern of manual screen-space
math (`marqueeEl` is deliberately a *sibling* of `contentEl` for reasons
specific to that gesture). A new `.align-guide-layer` SVG sits inside
`contentEl` alongside the node/edge layers, so a guide line's coordinates
are plain canvas-space numbers with zero manual zoom math, same as every
other layer there.

`nodeInteractions.js#beginMove` computes the moving selection's bounding
box once at drag start (only x/y change mid-drag) and every other node's
box, then does the actual snap/guide computation **inside the RAF-batched
`apply()` callback**, not on every raw `pointermove` — the store dispatch
was already throttled to one write per animation frame, and running an
O(node count) geometry scan plus a guide-layer DOM rebuild on every raw
pointer event (which fires far more often than the screen can show) would
undo that. `onMove` only tracks the raw cursor-follow offset (`rawDx`/
`rawDy`); `apply()` derives the actual, possibly-snapped `dx`/`dy` from it.
One real bug caught by this ordering during review: `onUp` used to call
`hideAlignmentGuides()` *before* its own final `apply()` call — since
`apply()` itself (post-refactor) calls `showAlignmentGuides` when a snap is
active, that final call re-drew a guide line that then never got cleared.
Fixed by moving `hideAlignmentGuides()` to *after* the final `apply()`/
`store.commitHistory()` in `onUp`.

The snap threshold is a screen-pixel distance (`8 / getViewport().zoom`)
rather than a fixed canvas-unit one, so the snap "feel" stays consistent
regardless of zoom level. Toggled via a persisted `io/uiPrefs.js` boolean
(`alignGuides`, default `true`) and a Tools-menu button
(`toolbar.js`'s `alignGuidesBtn`).

## Dark Mode & Diagram Theme (`io/theme.js`, `io/uiPrefs.js`, `modals/diagramThemeModal.js`, `core/diagramTheme.js`)

Two independent, easily-confused mechanisms:

- **Dark mode** is a pure *display* setting. `io/theme.js#setTheme(mode)`
  (`'system' | 'light' | 'dark'`) stamps `data-theme` on `<html>` and
  persists the choice via `io/uiPrefs.js`; every color in the app is a CSS
  custom property in `css/variables.css` that already resolves differently
  under `[data-theme="dark"]` (or `prefers-color-scheme` for `'system'`), so
  no per-component code is needed — this is the same token scheme node/edge
  default colors themselves reference. The toolbar's "Theme" button
  (`toolbar.js`) cycles the three modes and updates its own icon/label.
- **Diagram Theme** (`core/diagramTheme.js#applyDiagramTheme`) *permanently
  rewrites* `node.fill`/`node.stroke` for every node in one dispatch —
  it's project data, not a display setting, and is a normal single undo
  step. `DIAGRAM_THEMES` is a small curated palette list (Ocean, Sunset,
  Forest, Monochrome, Pastel); the apply function first groups nodes by
  their *current* fill color (so components that are already color-coded by
  tier/layer stay grouped), then assigns each distinct group the next color
  in the target palette in a stable, deterministic order (first-seen), so
  re-running the same theme twice is idempotent. `modals/diagramThemeModal.js`
  is a simple swatch-grid picker; `canvas.js#applyDiagramThemeToCanvas` wires
  it to the live selection or whole canvas.

## Custom Icon Upload (`io/fileIO.js#pickImageFile`, `canvas/node.js#buildIconEl`, `toolbar/styleEditor.js`)

`node.iconImage` is a data-URI string (or `null`); when set it renders via
`buildIconEl` (used by both the standard and "rows" node bodies) as an
`<img>` instead of the emoji/icon-font glyph `node.icon` would otherwise
produce — `iconImage` wins whenever both are present, so switching back to
a built-in icon means explicitly clearing it (the style editor's "Remove
Image" button does exactly that, alongside "Upload"/"Replace").
`fileIO.js#pickImageFile()` is a small promise-wrapped `<input type=file>` +
`FileReader` helper, mirroring the existing JSON-file-picker pattern in the
same module. Like any other node field, `iconImage` needed adding to Live
Replication's `MIRROR_FIELDS` allowlist by hand (see "Common pitfalls" in
`docs/AI_AGENT_GUIDE.md`) — it does not mirror automatically just by
existing on the node.

## Minimap (`core/minimap.js`, `canvas/minimap.js`)

Split the same way `core/alignmentGuides.js`/`canvas/nodeInteractions.js`
are: `core/minimap.js` is pure, DOM-free layout math —
`computeMinimapLayout(nodes, viewport, viewportRect, mapSize)` fits every
node's canvas-space box into a fixed small map size (letterboxed to
preserve aspect ratio) and returns both the scaled node rects and a
"you are here" viewport rect; `minimapPointToCanvas` is its exact inverse,
used to translate a click/drag on the minimap back into a canvas point to
center on. `canvas/minimap.js` is the DOM/interaction half — a self-
contained `<div class="minimap">` positioned in `#canvas-viewport`'s own
corner (**not** inside `.canvas-content`, so it never pans/zooms itself),
with its own `store`/viewport subscriptions and render loop, deliberately
kept out of `canvas.js`'s main node/edge diff-render for the same reason
`guideLayer` is: it's read-only overlay chrome, not part of the diagram's
own data. Toggled via a persisted `io/uiPrefs.js` boolean (`showMinimap`)
and a Tools-menu button. Uses the `--z-minimap` token (`css/variables.css`)
— see that file's comment for why it must sit above the floating contextual
style row but below hints/menus/toasts, and see "Gotchas" below for the
overlap this created with that same floating row.

## Focus Mode (`core/focusMode.js`, `canvas.js#setFocusMode`/`#applyFocusDimming`)

`core/focusMode.js#computeFocusedIds(selection, nodes, edges)` is a pure
function returning the set of node/edge ids that should stay at full
opacity: the current selection itself, plus every edge directly touching a
selected node and the node on the far end of each such edge. `canvas.js`
applies it by toggling a `.dimmed` class (CSS opacity, `css/canvas.css`) on
everything *not* in that set, called from both `render()` and
`renderSelectionOnly()` so it stays correct across a full re-render and a
selection-only fast path alike. Toggled via a persisted `io/uiPrefs.js`
boolean (`focusMode`) and a Tools-menu button; with nothing selected, focus
mode is a no-op (nothing is dimmed) rather than dimming everything.

## Manual Connector Waypoints (`canvas/waypointHandles.js`, `edge.waypoints`)

Generalizes a connector's path with an explicit, user-placed point list
that overrides its routing style, following the same "separate overlay
layer stacked above the node layer" architecture `canvas/edgeReconnect.js`
already established for reconnect handles (so a handle's own pointer
events never lose the hit-test to whatever's visually underneath) —
`initWaypointHandles`/`syncWaypointHandles` live in `edgeHandleLayer`,
diffed by *positional index* rather than any stored id (a waypoint has no
identity beyond its position in the array, so the closure captured at
render time for handle *N* is always consistent with cache key *N*, even
across an insert/remove that shifts every later index).

- `connector.js#buildEdgePath` checks `edge.waypoints?.length` *before* any
  `routing`-specific branch — manual waypoints are a universal override
  regardless of the edge's chosen routing style, the same "explicit
  override wins" precedent used elsewhere (e.g. a component def's own
  `textPosition`). The actual path through `[a, ...edge.waypoints, b]` is
  `core/geometry.js#waypointsPath`, reused verbatim from magic-routing.
- Dragging an existing handle, or dragging out a new one from the "+"
  midpoint marker, uses the same `store.dispatch(mutator, {coalesce:true})`
  + `store.commitHistory()` on pointerup pattern as `nodeInteractions.js`'s
  own node-drag — the whole gesture becomes one undo step, not one per
  intermediate frame.
- Right-clicking a waypoint handle removes just that point; right-clicking
  the connector line itself (`canvas.js#clearEdgeWaypoints`) removes all of
  them via a "Straighten connector" context-menu item, returning it to its
  routing style's default path.
- **Gotcha**: the small waypoint-add handle carries a `data-edge-id`
  attribute (for its own click handling) — the same attribute name a shared
  e2e test helper's `closest('[data-edge-id=...]')` check used to decide
  whether a right-click landed "on the edge." A right-click on the add-
  handle satisfied that loose check even though it isn't the real edge
  element and has no context-menu listener of its own, silently swallowing
  the click. Fixed by giving `.waypoint-add-handle` its own `contextmenu`
  listener that forwards a synthetic `MouseEvent('contextmenu', ...)` to the
  real `.edge[data-edge-id="..."]` element. Worth remembering for any future
  overlay element that reuses a "real" element's own data attributes for
  convenience.

## Pinned Comments (`canvas/commentPins.js`, `modals/commentModal.js`, `project.comments`)

A comment (`core/project.js#createComment`) is `{id, x, y, text, resolved}`
— a plain canvas-space point, entirely independent of every node/edge (no
`nodeId` it's attached to). `canvas/commentPins.js` renders them as small
`<button>` pins in their own `.comment-layer`, appended inside
`.canvas-content` (so pins pan/zoom with the diagram, unlike the minimap)
but *last*, so a pin is never hidden behind a node. Diffed by id, the same
"reuse existing DOM, add/remove only what changed" pattern the node/edge
layers use. `modals/commentModal.js` follows the established `sdb:open-*`
window-event convention (`sdb:open-comment`) other canvas-triggered-but-
not-toolbar-button modals use (see `subDiagramModal.js`) to avoid a
circular import between `canvas.js` and the modal.

Two review-caught gaps, both now fixed and regression-tested:

- **Live Replication**: like any new node/edge field, a new *project-level*
  array needs no special replication wiring (replication only mirrors
  fields on individual mirrored nodes/edges) — but a new node/edge field
  does, and this batch's `iconImage`/`waypoints` were both initially missing
  from `MIRROR_FIELDS`/`EDGE_MIRROR_FIELDS` in `core/replication.js`. See
  "Common pitfalls" in `docs/AI_AGENT_GUIDE.md`.
- **`canvas.js#getContentBounds`**: used by both "Fit to Screen" and
  PNG/PDF export, and already documented as "not a pure function of
  `state.nodes`" (it also reads live DOM). It initially ignored
  `state.comments` entirely and required at least one node to return
  anything — meaning a comment sitting outside every node's own bounds (or
  a comment-only diagram) could be cropped out of view/export. Fixed by
  folding each comment's position (padded by a small fixed pin-radius
  constant, since a pin has a real ~26px on-screen footprint despite being
  stored as a single point) into the same bounds computation as nodes/edges.

### Gotcha: a toolbar-descendant floating panel can't outrank a sibling drawer just by raising its own z-index

`#toolbar` is a flex item of `#app` (`display: flex`) with its own explicit
`z-index` (`--z-toolbar`) — per the flex-item stacking rules this makes
`#toolbar` a genuine stacking context, and **any z-indexed descendant of
it is trapped inside that context, no matter how high that descendant's own
z-index is set.** `js/toolbar/toolbarDropdown.js`'s dropdown panel
(`position: fixed`, `z-index: var(--z-menu)` — the highest UI layer short
of hints/toasts) is a plain DOM child of its trigger, nested inside
`#toolbar`. That worked fine until this batch's minimap made it common to
have the mobile `#sidebar` drawer (`z-index: var(--z-panel)`, a *sibling*
of `#toolbar` outside its trapped context) open at the same time as a
dropdown — since `#sidebar`'s context (25) legitimately outranked the whole
of `#toolbar`'s context (previously 20) at the root level, the dropdown
panel rendered *behind* the sidebar drawer despite its own much higher
nominal z-index.

The first fix attempted here was making the panel a true portal (append it
straight to `document.body` instead of nesting it in its trigger's wrapper
`div`), matching `canvas/contextMenu.js`'s own right-click menu and
`toolbar.js`'s floating contextual style row. That's the architecturally
"correct" fix in isolation, but it broke a much bigger, pre-existing
assumption: roughly 28 e2e spec files (and `tests/e2e/helpers.js`'s
`openToolbarGroup`) locate a dropdown's buttons via `'#toolbar button'`,
relying on the panel actually being a DOM descendant of `#toolbar` — moving
it out from under `#toolbar` made every one of those selectors stop
matching, timing out dozens of unrelated tests. **A "more correct"
architectural fix is not automatically the right fix if it silently breaks
a widely-relied-upon convention elsewhere** — caught here only because the
full e2e suite was re-run before merging, not by the review passes
themselves (see docs/AI_AGENT_GUIDE.md's own note on this). Reverted, and
fixed instead by simply raising `--z-toolbar` itself (20 → 26, just above
`--z-panel`'s 25) in `css/variables.css` — since `#toolbar` and the mobile
drawers never spatially overlap in normal layout, this only changes the
outcome for the one case that actually needed fixing (a dropdown panel
extending down into a drawer's screen region), with zero DOM/JS changes and
zero risk to the `'#toolbar button'` convention. The general lesson still
holds — a high z-index only wins *within its own stacking context* — but
the fix for a *specific* instance of it should stay as narrow as possible;
reach for the trapping ancestor's own z-index first, and only resort to a
DOM restructure (a real portal) when the trapped element's home genuinely
needs to change, not just its numeric rank.

A related, narrower instance of the same family of bug: the floating
contextual style row (`toolbar.js#positionFloatingRow`) could land visually
under the minimap's fixed corner position when the selected node was near
the bottom-right of the canvas — both are correctly *outside* any trapping
context here (contextRow already portals to `document.body`, same as
above), so this one really was just two independently-positioned overlays
competing for the same screen region, not a stacking-context trap. Fixed
locally in `positionFloatingRow` by nudging its computed `left` further
left whenever it would otherwise vertically overlap the minimap's own
`getBoundingClientRect()` — deliberately narrow (only trims `left`, and
only when an actual overlap is detected) rather than reusing the wider
"trim available height" treatment already applied there for the Smart
Suggestions banner, since the minimap only ever occupies one fixed corner
rather than spanning the full width like that banner does.

## Accessibility Pass

- **Arrow-key nudge** (`main.js#initKeyboardShortcuts`): with exactly one
  node selected and focus not inside a text field (reuses the existing
  `isTypingTarget` guard), the arrow keys move it by 1px (10px with Shift)
  via a normal `store.dispatch` + `commitHistory`, one undo step per
  keypress.
- **Icon-only buttons need a real accessible name**: a plain Unicode symbol
  like "−"/"+"/"⛶" is not reliably announced by screen readers the way an
  emoji or explicit `aria-label` is (this codebase already relies on
  `title` for sighted-user tooltips, which does *not* by itself produce an
  accessible name for every browser/AT combination). Audited every
  icon-only toolbar button and added an explicit `aria-label` alongside its
  existing `title` where the visible glyph alone wasn't already
  self-describing text.
- **`:focus-visible` must not be casually overridden**: the app already had
  a global keyboard-focus-ring rule in `css/base.css`; the command palette's
  search input had its own `.command-palette-input:focus { outline: none; }`
  rule silently defeating it for that one field. Removed — a future
  "remove the ugly focus ring" instinct on any *other* input should reach
  for restyling the ring (a custom `:focus-visible` rule), not suppressing
  it outright.

## Terraform Export (`io/exportTerraform.js`, `modals/exportDiagramModal.js`)

A 4th target alongside Mermaid/draw.io/Lucidchart in the "🌐 Export to..."
modal. `AWS_RESOURCE_MAP` is a curated, best-effort mapping (same curation
bar as Smart Suggestions — not every AWS defId is worth a hardcoded
resource type) from ~36 of the ~93 AWS component defIds to their real
Terraform resource type (`'aws-ec2' → 'aws_instance'`, etc.). `buildTerraform`
emits a `provider "aws" {}` block, one resource block per mapped node with a
disambiguated snake_case resource name, a commented list of AWS-to-AWS
connectors (never real `depends_on`/reference wiring — this is a starting
point to edit, not a deployable file), and a commented list of any AWS
components on the canvas that aren't in the map, so nothing is silently
dropped. Non-AWS components are skipped with no comment at all (they have no
Terraform equivalent to even mention).

## Canvas Outline panel (`panel/outlinePanel.js`)

A collapsible, searchable "table of contents" for the current diagram —
`#outline-panel`, a fourth `<aside>` alongside the details/AI-review panels
in `index.html`, toggled via the "📋 Outline" Tools-menu button
(`toggleOutlinePanel`). Lists every node and edge, grouped into two
collapsible sections, each row showing an icon + display name (falls back to
the defId/shape when a node has no custom label).

- **Bidirectional selection sync**, per the feature's actual point: clicking
  a row calls `store.select([id], [])` and centers the viewport on it
  (`selectAndCenter`) — canvas→list is the reverse direction, done cheaply
  via `syncHighlight`, which toggles an `.active` class on the row's element
  (kept in a persistent `id → element` `Map`, the same diff-by-id pattern
  `commentPins.js`/`minimap.js` already use) rather than rebuilding the list
  on every selection change.
- **Rebuild vs. re-render**: `store.subscribe('change', ...)` fires on every
  RAF-batched drag frame, but a drag never changes what the Outline should
  *display* (no id added/removed, no label changed) — `contentSignature`
  computes a cheap JSON fingerprint of just the id/label/type fields (never
  x/y/w/h/style) so `onStoreChange` can skip the full `buildContents` rebuild
  entirely on every frame where nothing the list cares about actually
  changed.
- **Search input focus survives its own rebuild** via the established
  `rerenderPreservingUiState` + `data-focus-key` mechanism (`utils/dom.js`)
  — the same fix this codebase already uses for the details panel and style
  editor, reused rather than reinvented here.

## Multiple diagram tabs (`io/projectTabs.js`, `toolbar/projectTabsBar.js`, `modals/addTabModal.js`)

Deliberately a *thin persistence/orchestration layer*, not a second document
model: `core/store.js` still only ever holds one live project at a time.
`io/projectTabs.js`'s `openTabIds` (a small array of saved-project ids,
persisted under its own localStorage key) is just bookkeeping on top of the
*existing* `io/projects.js` save/load primitives — switching tabs really is
"save the outgoing tab, then `loadNamedProject` + `store.loadProject` the
target", the same mechanism "Load" already used. This means undo/redo,
autosave, and every other single-document assumption elsewhere in the app
needed zero changes.

- **Bookkeeping must be updated *before* `store.loadProject()`, not after.**
  `store.loadProject()` fires the store's `'change'` event *synchronously* —
  any subscriber (like `projectTabsBar.js`'s re-render) runs to completion
  before `loadProject()` itself returns. `switchToProjectTab`/
  `openNewProjectTab`/`closeProjectTab` all call `addTabId`/`closeTabId`
  *before* `store.loadProject(...)`, specifically so a re-render triggered by
  that `loadProject` call sees the final tab list, not a stale one from a
  half-updated bookkeeping step. Get this ordering backwards and the tab
  strip silently shows the wrong tab count until the *next* unrelated
  `'change'` event happens to fire.
- **Closing a tab that isn't the active one never touches `store.loadProject`
  at all** (nothing needs to load — the live canvas doesn't change) — which
  means it never fires `'change'` either, so `projectTabsBar.js` can't rely
  on that event alone to know the tab list changed. `io/projectTabs.js`
  exposes its own `subscribeTabsChanged` pub-sub (fired from `writeState`,
  the one choke point every tab-list mutation goes through) specifically to
  cover this case; the tab bar subscribes to both `store`'s `'change'` *and*
  this.
- The tab strip (`.toolbar-row-tabs`, an always-mounted-but-conditionally-
  `hidden` row inserted right after the toolbar's main row) only becomes
  visible once 2+ tabs are open — a single-diagram user sees no new chrome
  at all. Needs the same `.toolbar-row-tabs[hidden] { display: none; }`
  override as `.toolbar-row-context` (see the stacking-context/hidden-row
  gotcha further down this doc) since `.toolbar-row`'s own `display: flex`
  otherwise beats the `[hidden]` UA default.
- Each tab renders as a `<div class="project-tab">` wrapping two sibling
  `<button>`s (the tab's own select action, and its close "✕") rather than
  nesting a close button inside a single outer `<button>` — a `<button>`
  cannot legally contain another interactive `<button>`.

## Presenter/Kiosk clean mode (`core/kioskMode.js`, `toolbar/kioskModeUi.js`)

A "🖥️ Presenter Mode" Tools-menu toggle that hides `#toolbar`, `#sidebar`,
and all three side panels via a single `body.kiosk-mode` class (see
`css/layout.css`), leaving `#canvas-viewport` to fill the whole viewport —
it needs no CSS rule of its own since it's already the sole `flex: 1 1 auto`
item in `.app-body`. `core/kioskMode.js` is a tiny pub-sub (same shape as
`canvas/toolMode.js`) holding one boolean, deliberately **not** persisted
like `io/uiPrefs.js`'s other toggles — reloading the page while presenting
should never leave a visitor stuck looking at a chrome-less canvas with no
toolbar to find their way back out of.

Since the toggle button that turns kiosk mode *on* lives inside the very
toolbar that then disappears, `toolbar/kioskModeUi.js` mounts one permanent,
always-in-the-DOM `.kiosk-exit-btn` (shown only via `body.kiosk-mode
.kiosk-exit-btn { display: flex; }`) as the way back — plus Escape
(`main.js#initKeyboardShortcuts`) as a keyboard equivalent. `--z-kiosk-exit`
is the highest value in the app's z-index scale (`css/variables.css`) since
this button must stay clickable over literally everything else still able
to render, including a toast.

## Diagram Animation (`core/animationPlayback.js`, `panel/animationPanel.js`, `canvas/animationOverlay.js`, `io/exportAnimation.js`)

Any number of named, independently-playable "build" sequences over
`project.animations`/`activeAnimationId` (see `core/project.js`). Each
animation is `{ id, name, steps, autoFocus }`; each step is
`{ id, targets: [{targetType:'node'|'edge', targetId}, ...], revealMode:
'auto'|'click', delayMs, notes }` — `targets` is normally one element, but
holding several lets a step reveal a "group" together under one shared
order number (see `addAnimationStep` below). Order is just array position.
Editing (add/remove/reorder/patch settings, all in `canvas/canvas.js`'s
"Diagram Animation" section) goes through ordinary `store.dispatch` calls,
so undo/redo, JSON export/import, `duplicateProject`, and cascade-delete on
node/edge removal (`removeNode`/`removeEdge` in `core/project.js`) all cover
it for free — no animation-specific persistence code needed anywhere except
the schema itself. A pre-v1.30 project's old single-sequence, single-target
`animationSteps` array is migrated by `validateProject` into one "Animation
1" the first time such a project loads — see `validateAnimations`'s header
comment.

`canvas.js#addAnimationStep(targetsInput)` takes either a single
`{targetType, targetId}` (the common case — a right-click "Add to
Animation", or the panel's per-row "+ Add") or an array of them (a "reveal
together" group — a multi-selection's right-click "Add Selection to
Animation", or checking several rows in the panel's "Add more" list and
clicking "Add Selected as one step"). It creates the project's first
animation implicitly the moment something is actually added if none exists
yet — the panel's own "+ New" button is only needed for a deliberate
*second*, separately-named animation, so a brand-new diagram never has to
create an animation explicitly before adding its first step.
`removeAnimationTarget(stepId, targetType, targetId)` removes one target
from within a (possibly grouped) step, dropping the whole step only once
every target is gone — the context menu's "Remove from Animation" and the
panel's per-target ✕ chip both call this rather than `removeAnimationStep`,
since either could be acting on just one member of a group.

**Right-click and multi-selection.** `node.js`/`connector.js`'s
`pointerdown` handler used to unconditionally collapse the selection down to
just the right-clicked item before its own `contextmenu` event fired (a
right-click's mousedown is still a `pointerdown`) — harmless before this
feature, since nothing needed to build a context menu around the *existing*
multi-selection. Diagram Animation's group-reveal does, so both handlers now
skip that collapse when the right-clicked item is already part of the
current multi-selection (checked via the element's own `.selected` class,
already accurate at render time) — right-clicking something *not* already
selected still selects just it, same as before. `canvas.js`'s
`selectionAnimationMenuItem` reads `store.getSelection()` when building the
menu to offer "Add Selection to Animation (N items, one step)" only when 2+
items are selected and the right-clicked one is among them.

Playback is a separate concern, deliberately not store-backed:
`core/animationPlayback.js` is a tiny pub-sub (same shape as
`core/kioskMode.js`/`canvas/toolMode.js`) holding its own snapshot of
`{ playing, steps, revealedCount, frozen, autoPlayAll, loop }` plus a
`setTimeout` handle for the current auto-step or loop-restart pause. It's a
snapshot rather than a live store read because canvas.js keeps rendering
normally during playback (kiosk mode only hides chrome, it doesn't freeze
interaction), so the sequence needs to stay stable for the whole
presentation even if the diagram were edited mid-playback.
`startAnimationPlayback()` (`canvas/canvas.js`) is the join point: it reads
the *active* animation, clears selection, turns on Presenter Mode's existing
`setKioskMode(true)`, then hands that animation's `steps` to `startPlayback()`
— reusing "hide all the chrome" rather than reimplementing it. Exiting must
go through `stopAnimationPlayback()` (not `setKioskMode(false)` directly) so
the playback state machine's timers/position reset in lockstep with the
chrome reappearing; both `toolbar/kioskModeUi.js`'s exit button and
`main.js#initKeyboardShortcuts`'s Escape handler check `isAnimationPlaying()`
to route there instead. `jumpToStep(n)` (the progress dots) reaches the same
end state as repeated `nextStep()`/`prevStep()` calls in one move — a jump
forward across several auto-timed steps still lands correctly since
`scheduleCurrent()` only ever looks at `steps[revealedCount]`, whatever
`revealedCount` was just set to. `autoPlayAll`/`loop` are live, session-only
presenter choices (the overlay's ⏩/🔁 buttons) — deliberately *not*
persisted like a step's own `revealMode`/`delayMs` or an animation's
`autoFocus`, reset on every `startPlayback`/`stopPlayback` same as `frozen`.
With `autoPlayAll` on, `scheduleCurrent()` arms a timer for the next step
regardless of its own `revealMode`, using that step's own `delayMs`. With
`loop` on, reaching the end (`revealedCount >= steps.length`) arms a short
(1.2s) pause before resetting `revealedCount` to 0 and re-scheduling, rather
than just stopping.

`canvas/canvas.js` renders two purely-derived, non-persisted layers on top
of the normal node/edge rendering: small numbered `.anim-badge` order badges
(own overlay layer + `Map<key, element>`, same diff-by-id pattern as
`commentPins.js`/`minimap.js` — kept out of `node.js`/`connector.js`
entirely so this feature never touches those already-complex files) shown
only while editing, and a `.anim-hidden` class toggle on `nodeElements`/
`edgeElements` driven by `getAnimationPlaybackState()` while playing. A
grouped step draws the *same* order number over every one of its targets —
each gets its own badge element keyed by `${step.id}:${targetType}:${targetId}`
rather than just `step.id`, so every target in a group gets a DOM element of
its own. The whole feature works identically for any node/edge shape — a
lifeline, a flowchart decision diamond, a fragment box, an ordinary
component — since a target only ever stores a `targetType`/`targetId`, never
a shape. The one place shape actually mattered: a node's badge position used
to be its bottom-left corner (`n.y + n.h`), which put the badge nowhere near
the readable content on an unusually tall shape like a sequence-diagram
lifeline (640px default height) — `renderAnimationBadges` caps the offset at
84 (`project.js#createNode`'s default component height) so the badge stays
just below the visible label/title on any shape, ordinary or not. Both
badges and visibility are re-run from an `onAnimationChange` subscription in
`initCanvas` (not just from the normal store-driven `render()`) since
starting/stopping playback never dispatches to the store — without that
separate subscription, the order badges would never reappear after a
presentation ends.

**Reveal pulse.** `applyAnimationVisibility` also diffs the current pass's
revealed-target set (`${targetType}:${targetId}` keys) against the previous
pass's (`previouslyRevealedAnimKeys`, module-level in `canvas.js`) to spot a
target crossing from hidden to revealed; that element gets a transient
`.anim-just-revealed` class (a CSS ring-pulse on a node via `box-shadow`, a
`filter: drop-shadow()` pulse on an edge since `box-shadow` doesn't render
on SVG shapes — see `css/node.css`/`css/connector.css`) removed again after
700ms via `setTimeout`, so it can replay the next time the same target
happens to be revealed again (e.g. jumping backward then forward past it). A
step backward, or an unrelated re-render while already revealed, never
re-triggers it — only an actual hidden→revealed transition qualifies.

**Auto-focus.** When the active animation's `autoFocus` is on,
`maybeAutoFocusOnReveal` (in `initCanvas`'s `onAnimationChange` subscription)
pans/zooms the canvas (`canvas/viewport.js#fitToContent`) to frame whatever
the *most recent forward move* just revealed — one step, or every step
jumped over at once via a progress-dot click. It never fires on a step
backward or on an unrelated playback change (freeze toggle, autoplay/loop
toggling) since those don't advance `revealedCount`. `autoFocus`'s own value
is captured once into a module-level flag at `startAnimationPlayback()`
(not re-read live) so it can't flip mid-presentation if something edited the
project underneath it — same snapshot reasoning `core/animationPlayback.js`
documents for its own `steps`.

`canvas/animationOverlay.js` mounts the floating prev/next/step-indicator
controls, the progress-dots row, the presenter-notes readout, and the
freeze-and-draw overlay once at boot (visibility toggled via
`onAnimationChange`, never created/destroyed per session). A capture-phase
`document` click listener advances a pending "click" step for a click
anywhere outside those controls — the reveal-mode setting describes *how* a
step appears, not a dedicated button the presenter has to aim for. The
notes readout shows `steps[revealedCount - 1]`'s own `notes` (the
most-recently-revealed step, i.e. whatever the presenter is currently
talking about) and is hidden entirely when that step has none. Freezing
(`setFrozen(true)`, also bound to the D key) pauses any pending auto-timer
without changing position and opens a full-viewport transparent `<canvas>`
for freehand annotation; resuming always restarts the current step's full
delay rather than tracking a partial remaining time, and the draw canvas is
cleared on the way out of each freeze so no stale marks flash on the diagram
first. `prevStep()` never re-arms an auto-timer on its own — going back
always requires a manual step forward again, so a correction never "runs
away" forward a moment later.

`io/exportAnimation.js` exports/imports the *whole* `animations` collection
(every named animation, its steps, groups, and notes) as its own JSON file,
independent of the diagram's own JSON export — `parseAnimationFile`
re-validates every target against the *current* diagram's actual node/edge
ids (silently dropping and counting anything orphaned, dropping a step
entirely once every target is gone) rather than trusting the file, and
always assigns fresh animation/step ids rather than reusing the ones in the
file; `activeAnimationName` is matched by name on import (falling back to
the first animation) since ids never survive the round trip. A pre-v1.30
export (a flat `steps` array, one target per step, no `animations` key) is
still parsed, wrapped into one "Animation 1" the same way an old project's
`animationSteps` field is.

Because kiosk mode's chrome-hiding wasn't originally scoped to every
bottom-of-screen fixed element, adding the playback controls surfaced a
pre-existing gap: the Smart Suggestions `.suggestion-banner` toast
(`canvas/suggestions.js`) wasn't in the `body.kiosk-mode` hidden-chrome list
in `css/layout.css` and could render directly on top of them. Fixed by
adding it to that same list — worth remembering if a future feature adds
another fixed-position toast or banner: it needs adding there too, not just
to whatever list existed when it was written.

## Large-diagram rendering performance (`css/node.css`)

`.node-body` (not `.node` itself) gets `content-visibility: auto`, letting
the browser skip style/layout/paint entirely for an off-screen node's
icon/label/sub-component rows/badges — the actual DOM weight of a node lives
there, not on the outer `.node` wrapper. Two deliberate placement choices
keep this "measure-safe":

- **On `.node-body`, not `.node`**: `.node`'s own box already has an
  explicit inline width/height from the project data (never depends on its
  content for sizing), so `canvas.js#getSelectionScreenRect`'s
  `getBoundingClientRect()` calls on `.node` stay accurate for an
  off-screen selected node regardless of what's skipped inside it.
- **`.node-external-label` is a *sibling* of `.node-body`, not a
  descendant** (see `canvas/node.js#updateExternalLabel` — both are direct
  children of the `.node` root). `canvas.js#getContentBounds` unions in
  every `.node-external-label`'s real `getBoundingClientRect()` regardless
  of whether its node is currently on-screen, specifically so "Fit to
  screen"/PNG/PDF export don't crop a label that extends outside its node's
  own box (this function has bitten this exact bug class before — see its
  own header comment). Because the label isn't nested inside the
  content-visibility'd element, this measurement was never at risk from this
  change — a genuine "off by construction" guarantee, not something that
  merely happens to work today.

PNG/PDF export (`io/exportImage.js#captureDiagramCanvas`) already toggles a
`.canvas-viewport.exporting` class for the duration of the capture (used
elsewhere to hide the minimap/grid background). `css/node.css` adds
`.canvas-viewport.exporting .node-body { content-visibility: visible; }` to
force every node fully rendered during that capture — belt-and-suspenders
against html2canvas (which walks the DOM manually, not through the browser's
real paint pipeline) not reliably re-classifying every node as "relevant to
the user" in time after the viewport is resized to the content's bounds.

## Duplicate-tab warning (`io/duplicateTabWarning.js`)

Every browser tab of this app shares the same `localStorage` — the autosave
slot, saved projects, tab bookkeeping above, all of it — so two tabs open at
once can silently overwrite one tab's edits with the other's. `main.js#boot`
calls `initDuplicateTabWarning(showToast)`, which opens a same-origin
`BroadcastChannel('sdb-tab-presence')`: on load it posts a `hello`; any tab
that receives one immediately replies `here`; either message triggers a
one-time toast in *both* tabs. Deliberately **not** a `localStorage` "lock"
flag — a flag needs careful cleanup on crash/close to avoid falsely warning
a single tab forever, whereas a `BroadcastChannel` only ever reaches tabs
that are genuinely open right now, no cleanup required. The "already
warned" flag lives in the function's own closure (returned from
`initDuplicateTabWarning`, one instance per tab/module-load) rather than
module scope, precisely so nothing here could ever leak across what should
be independent tabs — and so a unit test simulating two tabs in one process
gets two independent instances instead of accidentally sharing one.

## Security notes

- No `innerHTML` is ever fed unsanitized/user-provided strings; text
  content is set via `textContent` or DOM APIs. The few places that build
  HTML from trusted static templates use template literals with only
  static markup, never interpolated user text.
- Imported JSON goes through `validateProject()` (shape/type checks,
  clamps unknown enum values to safe defaults) before touching state.
- No dynamic `Function`/`eval`. Custom component/shape data is plain JSON.
- The two CDN scripts (`html2canvas`, `jsPDF`) are loaded from a pinned
  version URL; if you fork this project, consider vendoring them locally
  for a fully offline/air-gapped build.

## Testing

- `tests/unit/*.test.mjs` — pure logic (history stack, geometry/routing
  math incl. `magicRouter.js`'s obstacle-avoidance, search/filter, project
  validation, component-data integrity), run with Node's built-in
  `node:test`, no browser needed.
- `tests/e2e/*.spec.js` — Playwright, drives a real Chromium against the
  static site (`npx http-server` or `python3 -m http.server`), covers
  drag-from-sidebar → node appears, undo/redo, localStorage persistence
  across reload, search filtering.

## Why these tradeoffs

- **Snapshot undo/redo** over a command pattern: far less code, easy to
  reason about, and diagrams here are small (dozens–low hundreds of
  nodes), so cloning cost is negligible. If diagrams grow huge, swap for
  a command/patch-based history without touching any UI module (the
  `history.js` interface stays the same).
- **Emoji icons** instead of bundled AWS/vendor icon assets: zero binary
  assets to ship/maintain/license, renders crisp at any zoom, still
  instantly recognizable, and sidesteps AWS/Azure/GCP icon-usage
  trademark guidelines that apply to their official icon sets.
