# Development Plan

Companion to `SPEC.md` (what) — this is *how* and *in what order*.

## Guiding architecture decisions

1. **No framework, no bundler.** Vanilla ES modules (`<script type="module">`),
   loaded directly by the browser. Zero install step for contributors —
   `python3 -m http.server` (or any static server) and open the page.
2. **One store, one direction of data flow.** `js/core/store.js` holds all
   diagram state; every mutation goes through it; it emits change events;
   every UI module subscribes and re-renders the slice it owns. No module
   reaches into another module's DOM.
3. **Pointer events, not HTML5 Drag&Drop**, for canvas node drag/resize and
   sidebar→canvas drag. HTML5 DnD is inconsistent on touch and hard to
   style mid-drag; pointer events unify mouse + touch and are easy to test.
4. **Data-only component library.** `js/data/categories/*.js` are plain
   arrays of objects, no behavior — trivial for anyone (or an AI agent) to
   extend without touching engine code.
5. **Snapshot-based undo/redo.** Simpler and more robust than a command
   pattern for a v1; the project JSON is small enough that cloning it per
   change is cheap. `js/core/history.js`.
6. **Two CDN dependencies only, both for export**: `html2canvas` (PNG) and
   `jsPDF` (PDF). Everything else hand-written.

## Stages

1. **Docs & scaffolding** — `SPEC.md`, `PLAN.md`, `ARCHITECTURE.md`,
   `AI_AGENT_GUIDE.md`, repo skeleton, `.gitignore`, root `package.json`
   (test tooling only).
2. **Core engine** — store, history, id/geometry utils, project
   serialization + validation.
3. **Component data** — schema helper + ~18 category files (~200
   components), aggregated & de-duplicated in `data/index.js`.
4. **Canvas** — render nodes/edges from store, pan/zoom, select, drag,
   resize, connector drawing & live re-routing, context menu.
5. **Sidebar** — categorized list, search/filter, pointer-based drag source.
6. **Toolbar** — style editor for selection, arrow editor, undo/redo,
   zoom/grid controls.
7. **Details panel** — notes/labels/sub-components/rows editor, "has info"
   badge.
8. **Modals** — custom component builder, custom shape picker (incl.
   "server with rows"), Save As, Load project, confirm dialog.
9. **Persistence & IO** — localStorage autosave + named projects,
   JSON export/import, PNG/PDF export.
10. **Hints system** — dismissible contextual hints, persisted, reset
    action.
11. **Responsive/mobile pass** — drawer behavior, touch drag tuning,
    compact toolbar.
12. **`help.html`** — standalone interactive user guide.
13. **Tests** — unit tests (pure logic, Node's test runner) + Playwright
    e2e tests (drag-drop, undo/redo, persistence, export triggers).
14. **Three-pass self code review** (functional, technical, UI/UX) and
    fixes.
15. **GitHub Pages workflow** + `README.md` + commit & push.

## File map (target)

```
index.html                  help.html
css/  (variables, base, layout, sidebar, toolbar, canvas, node,
       connector, modal, panel, hints, responsive)
js/
  main.js
  core/     store.js history.js id.js geometry.js project.js
  data/     schema.js index.js categories/*.js
  sidebar/  sidebar.js search.js dragSource.js
  canvas/   canvas.js node.js nodeInteractions.js connector.js
            connectorInteractions.js contextMenu.js selection.js
  toolbar/  toolbar.js styleEditor.js arrowEditor.js zoomControls.js
  panel/    detailsPanel.js
  modals/   modal.js customComponentModal.js customShapeModal.js
            saveAsModal.js loadProjectModal.js confirmModal.js
  io/       storage.js fileIO.js exportImage.js exportPdf.js autosave.js
  hints/    hints.js hintData.js
  utils/    dom.js color.js debounce.js download.js
tests/unit/*.test.mjs        tests/e2e/*.spec.js
docs/*.md
.github/workflows/deploy.yml
```

## Suggested additions beyond the original request (approved to include)

- Multi-select + marquee selection, group move/delete, duplicate (Ctrl/Cmd+D).
- Keyboard shortcuts for power users.
- Grid + snap-to-grid toggle, zoom-to-fit.
- "My Components" personal library, separate from the built-in one,
  import/export as its own JSON so it's portable across machines.
- GitHub Actions workflow to publish to GitHub Pages automatically.
- Dismissible hints + a "Reset hints" action.

## Status tracking

See `docs/CHANGELOG.md` for what has actually been implemented — keep it in
sync with this plan as work lands, so any AI coding agent picking this repo
up later can tell "planned" from "done" at a glance.
