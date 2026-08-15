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
`straight`/`orthogonal`/`curved` go through the pure, stateless
`core/geometry.js#buildPath`, same as always. `'magic'` instead calls
`core/magicRouter.js#computeMagicWaypoints(fromNode, toNode, obstacles,
fromSide, toSide)` — a DOM-free, unit-testable, grid-based least-turns
router (obstacles = every other node's rect, from `canvas.js#render`'s
`allNodes` passed through `updateEdgeEl`'s options). It quantizes the
bounding area between the two nodes into a grid sized so the cell count
stays under a fixed cap regardless of canvas scale, then runs a 0-1
bucket-queue Dijkstra over `(cell, last-direction)` states — 0 cost to
continue straight, 1 to turn — to find the path with the fewest bends,
then collapses it to just its turning points and appends the two nodes'
exact anchor points. If it can't find a route in budget (or the grid
would be too large) it returns `null`, and `buildEdgePath` falls back to
a plain `orthogonal` route rather than leaving the connector broken.
Nothing about the computed path is persisted on the edge — it's derived
fresh every render straight from current node positions, exactly like
every other routing already is, so a magic edge re-routes live as nodes
move and can never go stale.

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
- **Import collision handling** (`customComponents.js#importCustomComponents`,
  `projects.js#importSavedProjectsBundle`, and `fullBackup.js`): every
  merge-style import applies the same rule — an incoming record whose `id`
  matches an existing one overwrites it in place; a `name` collision with a
  *different* `id` gets a disambiguating suffix (`"(imported)"`, then
  `"(imported 2)"`, ...), computed by the shared
  `utils/disambiguateName.js`, instead of silently colliding — so nothing
  is ever dropped. `fullBackup.js#importFullBackupFile()` composes this
  with a direct `store.loadProject()` for the bundled canvas and a plain
  `saveNodeDefaults()` overwrite for defaults — those two aren't
  "libraries" with multiple entries, so there's nothing to merge, only
  replace, which is why the UI (`modals/backupModal.js`) gates the whole
  restore behind one `confirmAction()` up front rather than per-field.

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
