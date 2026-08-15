# Guide for AI coding agents (Claude, Copilot, etc.)

Read this before making changes. Also read `SPEC.md` (what the app must do)
and `ARCHITECTURE.md` (how it's built) — this file is the "how to work in
this repo" quick-start.

## Ground rules

1. **No build step.** Don't add a bundler/transpiler/framework unless the
   human explicitly asks. Plain ES modules only.
2. **State goes through `js/core/store.js`.** Never mutate DOM-derived data
   directly; never let two modules read each other's DOM. If you need data
   from another module, get it from the store.
3. **Component data is pure data.** New predefined components/categories go
   in `js/data/categories/*.js` using the `c(...)` helper from
   `js/data/schema.js`. Never put logic there.
4. **Keep files small and single-purpose.** If a file is doing two jobs,
   split it. Match the existing `js/<area>/<thing>.js` layout.
5. **Security**: never use `innerHTML`/`insertAdjacentHTML` with a string
   built from user/project data — use `textContent`/DOM APIs, or a static
   template literal with no interpolated user text. Any imported JSON must
   go through `core/project.js#validateProject` first.
6. **Update docs as you go**: if you change behavior described in
   `SPEC.md`, update it. If you finish a plan item, check it off in
   `CHANGELOG.md`. Keep `PLAN.md` "suggested additions" list honest about
   what's actually implemented. **Bump the version**: every user-facing fix
   or feature updates `APP_VERSION` in `js/version.js` and adds a
   `VERSION_HISTORY` entry (short, user-facing highlights) alongside the
   fuller `CHANGELOG.md` entry — see `docs/SPEC.md` 4.11.
7. **Tests**: add/update a unit test (`tests/unit`) for logic changes and,
   for user-facing flows, a Playwright test (`tests/e2e`). Run
   `npm test` before calling anything done.
8. **Do a self code review** after non-trivial changes: correctness, then
   a technical pass (naming, duplication, error handling), then a UI/UX
   pass (does it look/feel right, keyboard/touch/mobile still work).

## Where things live (cheat sheet)

| I want to...                                   | Touch this |
|-------------------------------------------------|------------|
| Add a predefined component                       | `js/data/categories/<category>.js` |
| Add a new category                                | new file in `js/data/categories/` + import in `js/data/index.js` |
| Add a "layer/role" (attachable to any node)       | `js/data/categories/layers.js` — just `c(id, name, icon, { kind: 'layer', ... })` |
| Add a "design pattern" (multi-node blueprint)     | `js/data/categories/design-patterns.js` — `definePattern(id, name, icon, { nodes, edges })`, node `defId`s must reference real components/layers |
| Change node drag/resize behavior                  | `js/canvas/nodeInteractions.js` |
| Change arrow routing/markers                      | `js/canvas/connector.js`, `connectorInteractions.js` |
| Add a toolbar button                              | `js/toolbar/toolbar.js` (+ new module if it needs its own state) |
| Add a style control                               | `js/toolbar/styleEditor.js` (node) or `arrowEditor.js` (edge) |
| Change what the details panel shows/edits         | `js/panel/detailsPanel.js` |
| Add a modal                                       | `js/modals/*.js`, register it in `modals/modal.js` |
| Change project JSON shape                         | `js/core/project.js` (bump `formatVersion`, keep a migration path) |
| Change global new-component defaults              | `js/io/nodeDefaults.js` (storage) + `js/modals/defaultSettingsModal.js` (UI) |
| Change saved-project favorites/bulk export-import  | `js/io/projects.js` + `js/modals/loadProjectModal.js` |
| Change "My Components" folders/bulk export-import  | `js/io/customComponents.js` + `js/modals/customComponentModal.js` (folder field) + `js/sidebar/sidebar.js` (grouping, quick export/import) |
| Change full-backup export/import                   | `js/io/fullBackup.js` (storage) + `js/modals/backupModal.js` (UI) |
| Change import name/id collision handling            | `js/utils/disambiguateName.js` (the "(imported)"/"(imported 2)" suffixing), used by both `customComponents.js#importCustomComponents` and `projects.js#importSavedProjectsBundle`; `fullBackup.js` delegates to both rather than reimplementing it |
| Change localStorage keys/behavior                 | `js/io/storage.js`, `io/autosave.js` |
| Change PNG/PDF export                             | `js/io/exportImage.js` / `exportPdf.js` |
| Add/change a hint                                 | `js/hints/hintData.js` |
| Change layout/visual style                        | `css/*.css` (one file per area, `variables.css` for tokens) |
| Add a state-machine shape/pattern                  | `js/data/categories/state-machines.js` — plain `c(...)` for a state shape, `definePattern(...)` for a whole template; a transition's condition is just that edge's `label`, nothing special |
| Change the "hide State Machines" (or any future hideable category) setting | `js/io/librarySettings.js` (storage) + `js/modals/defaultSettingsModal.js` "Component library" section (UI) + `js/sidebar/sidebar.js#HIDEABLE_CATEGORIES` (the filter) |
| Change Group/Ungroup or mixed component+connector selection | `js/canvas/canvas.js` (`groupSelection`/`ungroupSelection`/`selectNode`/`beginMarquee`/`duplicateSelection`) + `js/toolbar/toolbar.js#renderContextRow` |
| Change Magic Arrow routing                         | `js/core/magicRouter.js` (pure grid router, DOM-free — unit-test it directly) + `js/canvas/connector.js#buildEdgePath` (rendering, falls back to `orthogonal` on failure) + `js/canvas/connectorInteractions.js` (`setMagicMode`/`isMagicModeActive`, the creation-time toggle) |
| Change the "What's New" modal / version highlights  | `js/version.js` (`APP_VERSION`, `VERSION_HISTORY`) + `js/io/whatsNew.js` (last-seen-version tracking) + `js/modals/whatsNewModal.js` (UI) |
| Change "Duplicate Project" / "Duplicate entire canvas" | `js/core/project.js#duplicateProject` (pure id-remapping clone) + `js/canvas/canvas.js` (`duplicateProjectAsNew`/`duplicateEntireCanvas`) + toolbar/canvas-context-menu wiring in `toolbar.js`/`canvas.js#openCanvasContextMenu` |
| Change the AI Design Review prompt/providers/panel  | `js/io/aiReview.js` (`buildReviewPrompt`, `AI_PROVIDERS`) + `js/panel/aiReviewPanel.js` (UI, paste-back). See "Common pitfalls" below before touching this — it's intentionally not an API integration. |
| Change the Generate Design from Spec prompt/wizard   | `js/io/aiGenerateDesign.js` (`buildGenerateDesignPrompt`, `extractProjectJSON`, `autoArrangeIfNeeded`) + `js/modals/generateDesignModal.js` (the 3-step wizard UI). Same "not an API integration" constraint as AI Design Review applies. |
| Change how missing node/edge ids are handled on import | `js/core/project.js#validateProject` — backfills a missing/invalid id via `core/id.js#nextId` rather than dropping the node/edge; covers file import, backup restore, and pasted AI results alike |

## Running things locally

```bash
# serve the static site
python3 -m http.server 8080   # then open http://localhost:8080

# unit tests (no browser)
npm run test:unit

# e2e tests (Playwright, needs the site served — see tests/e2e/playwright.config.js)
npm run test:e2e

# everything
npm test
```

## Common pitfalls specific to this app

- Edge endpoints reference node ids; when deleting a node, always cascade-
  delete or re-anchor its edges (see `core/project.js#removeNode`).
- `history.js` snapshots the whole project; don't commit a history entry
  on every `pointermove` during drag — coalesce and commit once on
  `pointerup` (see existing drag code for the pattern).
- The canvas has its own pan/zoom transform; always convert
  screen↔canvas coordinates via `canvas/canvas.js#screenToCanvas` rather
  than using raw client coordinates.
- Sidebar drag uses pointer events, not HTML5 DnD — don't mix the two
  paradigms when extending it.
- Every `components` array entry (including `layer`/`pattern` kinds) still
  needs `defaultSize`/`shape`/`color`/`fill` even if a pattern never
  renders as a single node — `componentData.test.mjs` checks every
  library entry has them, and other code paths assume they exist.
- A pattern's node `defId`s must resolve via `canvas.js#resolveComponentDef`
  (built-ins *or* custom "My Components") and its edges must only
  reference `key`s that exist in its own `nodes` list —
  `componentData.test.mjs` checks both.
- `connector.js#updateEdgeEl` needs the *full* node list (to compute magic
  routing's obstacles) — always pass `allNodes` when calling it, or magic
  edges silently render with zero obstacles. Magic routing itself is
  computed fresh every render (nothing persisted on the edge), same as
  every other routing already re-routes live when nodes move — don't try
  to cache/store its waypoints.
- `magicRouter.js` is intentionally DOM-free and grid-size-capped
  (`MAX_CELLS`) so it can't hang on a huge diagram — if you change its
  constants, keep it bounded and keep returning `null` (not throwing) on
  failure so the caller's elbow-route fallback still works.
- **Don't build a fake API integration for AI Design Review.** This was
  evaluated deliberately (see docs/SPEC.md 4.12): no mainstream LLM offers
  key-free API access, and scraping Google's embedded AI search results is
  both technically infeasible from a static page (CORS) and against their
  ToS. If a future request asks for a "real" automatic round trip, that
  requires either the user supplying their own API key (a genuine, opt-in
  config step — don't silently add one) or a backend proxy (a real
  architecture change, not something to bolt on quietly) — don't simulate
  either by hardcoding a key, routing through an undisclosed third-party
  proxy, or scraping search results.
- `aiReviewPanel.js`'s `savedReviews`/attached spec/prompt edits are
  session-only (module-level variables, not `localStorage`) and reset when
  the active project id changes — see `store.subscribe('change', ...)`
  there for the "only react to an actual project switch, not every edit"
  pattern, reusable anywhere else a panel needs to stay in sync with
  *which* project is open without re-rendering on every drag frame.
- Same "not a real API integration" constraint applies to Generate Design
  from Spec (`aiGenerateDesign.js`) — it's the reverse direction of AI
  Design Review, built the same way for the same reason (see docs/SPEC.md
  4.13). Don't add a live API call here either.
- If a modal's content can change size between renders (a multi-step
  wizard, an expand/collapse section), be aware `modal.js`'s backdrop-click
  detection uses `e.target === dialog` specifically because it's
  resize-safe — a coordinate/rect-based check used to live there and broke
  when a click handler shrank the dialog before the backdrop listener ran
  (see docs/ARCHITECTURE.md's Generate Design from Spec section for the
  full story). Don't revert to comparing click coordinates against
  `getBoundingClientRect()`.
