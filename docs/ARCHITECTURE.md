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
                 ├─ data/index.js        (component library, pure data)
                 ├─ sidebar/sidebar.js   (reads data/index.js, writes via store)
                 ├─ canvas/canvas.js     (reads store, renders nodes+edges, writes via store)
                 ├─ toolbar/toolbar.js   (reads store selection, writes via store)
                 ├─ panel/detailsPanel.js
                 ├─ modals/*.js
                 ├─ io/*.js              (localStorage, file, image/pdf export)
                 └─ hints/hints.js
```

## State flow

`core/store.js` exposes:

- `getState()` — returns the current immutable-by-convention project state.
- `dispatch(mutatorFn)` — runs `mutatorFn(draftClone)`, replaces state,
  pushes a history snapshot (unless flagged `silent`, used for
  high-frequency drag updates which are coalesced), then calls
  `emit('change', state)`.
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
  docs/SPEC.md 4.2.4), stored under their own key, independent of any one
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
  math, search/filter, project validation, component-data integrity), run
  with Node's built-in `node:test`, no browser needed.
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
