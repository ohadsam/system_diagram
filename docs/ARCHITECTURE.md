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
