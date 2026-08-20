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
                 ├─ modals/*.js          (incl. modals/generateDesignModal.js, modals/replicationModal.js)
                 ├─ io/*.js              (localStorage, file, image/pdf export)
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
default now, not just ones explicitly armed via the toolbar's "🪄 Magic
Arrow" toggle (`connectorInteractions.js`'s `magicModeActive`, which still
sets `edge.routing = 'magic'` specifically and still gets its own
`.edge-magic` CSS glow) — Magic Arrow is functionally close to redundant
for brand-new connectors now, but was left in place unchanged rather than
removed, since removing a previously-shipped, tested, documented feature
wasn't part of the request that made `'orthogonal'` obstacle-avoiding too.

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

## Navigation tools (`canvas/toolMode.js`)

`toolMode.js` is a tiny module-level pub-sub (`getToolMode`/`setToolMode`/
`onToolModeChange`) holding which of `'select'`/`'hand'` currently governs
canvas pointer interactions, plus a separate `spaceHeld` flag for a
momentary hold-Space-to-pan override that never touches the persisted
`baseTool`. This deliberately fixes the one weak spot in the older Magic
Arrow toggle (`connectorInteractions.js`'s `magicModeActive`): that flag
has no subscribe mechanism, so its toolbar button is the *only* thing that
can desync from it if the mode were ever changed from elsewhere.
`toolMode.js` instead notifies every subscriber (the toolbar buttons' own
`.active` class *and* `canvas.js`'s cursor class) on every change, so there
is exactly one source of truth.

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
(deselect, multi-select, an edge) closes it. Before this the panel had no
`'selection'` subscription at all — only `'change'` (data mutations),
which has no way to represent "the user clicked something else" — so it
silently kept showing stale content for whatever was open before.

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
toggle, zoom, "Add Shape", "Magic Arrow" — `buildQuickCreateGroup`);
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
`related` below, and equally deliberately sparse.

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
   genuinely distinct positions passes through untouched.

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
members: [{a, b}] }`. `mode` is purely a descriptive label — every mode
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

`buildReplicationPair(nodes, selectedNodeIds, mode)` is the pure builder
behind "create a pair from the current selection" — reuses one common
existing `groupId` for side A if the whole selection already shares one
(otherwise mints a fresh one, same "overwrite on regroup" precedent as
`groupSelection()`), skips any `replicationExcluded` node from being
mirrored at all, and returns everything `canvas.js#createReplicationPairFromSelection`
needs to fold into one atomic `store.dispatch()` call.

`canvas.js` also guards against a group being claimed by two different
pairs at once (`isGroupInAnyPair`) in both the create and join actions —
the engine itself doesn't strictly need this (each pair syncs
independently against whatever `nodes` looks like after earlier pairs in
the same pass already ran), but a node whose side is ambiguous between two
pairs is a state the UI should simply never let a user create.

`core/project.js#validateProject()` validates `replicationPairs` the same
"coerce to safe defaults, never throw" way as everything else (drops a
pair with an equal/missing `groupA`/`groupB`, clamps an unknown `mode`,
filters `members` entries to ids that survived node validation) and
`duplicateProject()` remaps a pair's `groupA`/`groupB`/`members` through
the same id maps it already builds for nodes/edges/groups, dropping a pair
outright if neither of its groups survived the clone (nothing left to
duplicate).

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
