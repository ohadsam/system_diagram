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
| Add/change a "Smart Suggestions" companion pairing | `related: ['other-id']` in the `c(...)` call — see `add-library-item` skill's "Smart Suggestions" section for the curation bar |
| Add/change a "Smart Suggestions" sub-component pairing | `relatedLayers: ['layer-id']` in the `c(...)` call (ids must be `kind: 'layer'`) — same curation bar, same skill section |
| Change the Smart Suggestions banner/trigger        | `js/canvas/suggestions.js` (banner + filtering), `canvas.js#createNodeFromDrop` (trigger point) |
| Change node drag/resize behavior                  | `js/canvas/nodeInteractions.js` |
| Change arrow routing/markers                      | `js/canvas/connector.js`, `connectorInteractions.js` |
| Add a toolbar button                              | `js/toolbar/toolbar.js` — put it in an existing dropdown group (`buildFileGroupButtons`/`buildCreateGroupButtons`/`buildToolsGroupButtons`/`buildHelpGroupButtons`, rendered via `toolbarDropdown.js`) unless it's used continuously while working (like undo/redo, the Select/Hand tool toggle, zoom), which stay flat. **Always set a clear, specific `title`** on the button — see "Add a toolbar button" pitfall below. |
| Add a canvas navigation/interaction mode (like Hand/Select) | `js/canvas/toolMode.js` (mode state + pub-sub) + dispatch logic in `canvas.js#wireBackgroundInteractions` |
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
| Change Live Replication's sync rules                | `js/core/replication.js` (`syncReplication`, `buildReplicationPair`) — pure, DOM-free, called from `js/core/store.js#dispatch`/`loadProject`. See "Common pitfalls" below before touching this. |
| Change the Replicate create/join/break UI            | `js/modals/replicationModal.js` (UI) + `js/canvas/canvas.js` (`createReplicationPairFromSelection`, `addSelectionToReplicationSide`, `breakReplicationPair`, `getReplicationInfoForNode`) |
| Add an AWS cluster/node/pod-style component or an HA design pattern | `js/data/categories/aws.js` (plain `c(...)`) or `js/data/categories/design-patterns.js` (`definePattern(...)`) |

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
- **`core/replication.js#syncPair`'s "sever the link" branch must flag the
  surviving peer `replicationExcluded`, not just drop the mapping entry.**
  Dropping only the mapping isn't enough — the peer still structurally
  looks like an ordinary unmapped member of its side's group, and the very
  next "discover new members" pass in the same function would immediately
  re-mirror it, undoing the severance. If you touch this function, keep a
  test asserting node count stays flat (no deletion) *and* the peer ends
  up excluded after an exclude/regroup-triggered severance.
- **`syncReplication` must never mutate `prevProject`/`nextProject` in
  place** — it's called with `prev = state` (the *live* previous store
  state, not a clone) from `store.js#dispatch`, so mutating it would
  corrupt history/undo. Always build new nodes/pairs arrays.
- When writing a Playwright test that double-clicks a node label
  immediately after an action that changes how many nodes are selected
  (e.g. right after `createReplicationPairFromSelection`, which selects
  both sides), settle the selection with a plain `.click()` first before
  the `.dblclick()`. The contextual toolbar row's height depends on
  selection count, so a selection-count change mid-double-click can shift
  the canvas under the pointer between the gesture's two clicks and make
  the second one miss — a pre-existing characteristic of the layout, not
  something to "fix" in the app; just settle the selection in the test
  first, matching how a real user would naturally interact.
- **Every toolbar button — flat or inside a dropdown — must have a clear,
  specific `title`.** It's the only affordance an icon-only button gives
  (native browser tooltip; the app deliberately has no custom tooltip
  system). "What does this button do?" should be answerable from the title
  alone, not just the emoji. A `title^="X"` or `{hasText: 'X'}` Playwright
  selector elsewhere in `tests/e2e/` is a strong hint the exact wording is
  load-bearing — check before changing one you didn't add.
- **Toolbar buttons live inside one of the row's dropdown groups
  (`toolbarDropdown.js`), not flat, unless they're needed continuously or
  at a moment's notice while actively working** (undo/redo, the Select/Hand
  tool toggle in `toolMode.js`, zoom controls, "Add Shape", "Magic Arrow" —
  `toolbar.js#buildQuickCreateGroup`) — this is what keeps the always-visible
  row short as buttons are added; see the next bullet for why that matters.
  A genuinely frequent one-click action used *while drawing* (not a
  setup/admin action) belongs flat even if it seems like it "should" live
  with its siblings conceptually — Add Shape and Magic Arrow were moved out
  of the Create/Tools dropdowns for exactly this reason after user feedback
  that burying them behind a click slowed down active diagramming. A
  dropdown's own buttons are ordinary `<button title="...">` elements
  (built the same `el(...)` way as any flat toolbar button) inside a panel
  that only renders visible once its trigger is clicked — so a Playwright
  test clicking one must open its group first (`openToolbarGroup(page,
  'File'|'Create'|'Tools'|'Help')` in `tests/e2e/helpers.js`); the panel
  also auto-closes after any of its own buttons is used, so re-open it
  before every subsequent interaction in the same test.
- **A dropdown panel positions itself with `position: fixed` + JS-computed,
  viewport-clamped coordinates (`toolbarDropdown.js#positionPanel`), not
  CSS `position: absolute` relative to the trigger.** The relative approach
  was tried first and looked fine in desktop testing, but rendered partly
  off-screen in practice on mobile once the toolbar wrapped a trigger onto
  a row where it had less room than the panel needed — only a
  viewport-relative, clamped computation (same pattern as
  `canvas/contextMenu.js`) is reliably correct regardless of the trigger's
  position. Don't revert to relative positioning for a dropdown/popover
  added elsewhere in the toolbar.
- **Adding a toolbar button? Check it doesn't push a `.toolbar-group` past
  the mobile viewport width.** `.toolbar-row` wraps *groups* onto new lines
  on narrow screens, but without `.toolbar-group { flex-wrap: wrap }` (set
  in `responsive.css`'s `@media (max-width: 900px)` block) a single group
  with several full-text buttons doesn't wrap *internally* — it just forces
  the whole page into horizontal scroll once it's wider than the viewport.
  This actually happened: adding the "🔁 Replicate" button was the one that
  tipped the "create" group over 390px. Verify with
  `document.documentElement.scrollWidth <= window.innerWidth` at a mobile
  viewport (`tests/e2e/mobile-responsive.spec.js` asserts this) rather than
  eyeballing a screenshot.
- **The sidebar/details-panel/AI-review-panel mobile drawers are
  `position: absolute` inside `.app-body` (`position: relative`), not
  `position: fixed` with a hardcoded top offset.** They used to be `fixed`
  with `top: var(--toolbar-height)` (a constant 56px), which quietly
  assumed the toolbar is always one row tall. Once the toolbar wraps onto
  several rows (routine well before the 900px breakpoint — see above), its
  real height is much more than 56px, and a `fixed` drawer with that
  hardcoded offset renders starting partway *through* the toolbar instead
  of below it. `.app-body` already starts exactly where the toolbar ends
  regardless of its height (it's the second child of a column flex `#app`),
  so anchoring these drawers to `.app-body`'s own box with `position:
  absolute; top: 0` tracks the real toolbar height automatically at any
  width — don't revert to `fixed` + a fixed pixel `top`.
- **Use a plain (non-`fullPage`) Playwright screenshot when checking a
  `position: fixed`/`absolute` mobile overlay.** A `fullPage: true`
  capture can force Playwright to lay the page out against a taller
  synthetic viewport for the capture, which throws off `vw`-relative or
  absolute-positioned elements sized/positioned relative to the *real*
  viewport — this produced a completely misleading screenshot (looked like
  the sidebar was ~130px wide with toolbar buttons bleeding through it)
  during the mobile-layout investigation above, when the live page at the
  real viewport size was already correct. When something in a screenshot
  looks broken, cross-check with `getBoundingClientRect()` /
  `getComputedStyle()` via `page.evaluate()` before "fixing" it.
- **A flex item with `text-overflow: ellipsis` needs an explicit `min-width:
  0`, and so does every flex-item ancestor between it and the constraining
  container** — a flex item's default `min-width: auto` refuses to shrink
  below its content's intrinsic width no matter what `overflow`/`text-
  overflow` say, and that default applies at *every* level, not just the
  truncating element itself. This bit `.toolbar-context-summary` (the
  contextual row header's selection-name text) — fixing the span alone
  wasn't enough; `.toolbar-context-header`, the flex-item parent being
  stretched by its column-direction container, also needed `min-width: 0`.
  See "Contextual style-editor row" in `ARCHITECTURE.md` for the full story
  (a third, unrelated gotcha — combining a shared `flex-wrap: wrap` base
  class with a `flex-direction: column` override without also resetting to
  `flex-wrap: nowrap` — was tangled up in the same bug). Test any new
  truncating-text UI with a deliberately long value, not just the short
  example strings used elsewhere in this repo's tests — that's what
  surfaced this one.
