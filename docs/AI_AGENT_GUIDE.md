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
| Change the details panel's resize/selection-sync behavior | `js/panel/detailsPanel.js#initResizeHandle` (drag-to-resize) / its `store.subscribe('selection', ...)` (auto close/switch) |
| Fix a "loses focus every keystroke" bug in a rebuild-on-every-change panel | `js/utils/dom.js#rerenderPreservingUiState` + add `data-focus-key` to the field — see "Common pitfalls" below |
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
| Change the contextual style row's floating/pinned-top/pinned-bottom display mode | `js/io/uiPrefs.js` (storage, `CONTEXT_ROW_MODES`) + `js/toolbar/toolbar.js` (`mountContextRow`, `positionFloatingRow`, the 📌 pin button) + `js/modals/defaultSettingsModal.js` ("Style editor" section, the only way to reach `pinned-bottom`). See "Common pitfalls" below before touching `positionFloatingRow`. |
| Add a border to a new clip-path shape (like diamond/hexagon)      | `css/node.css` — a plain `border` won't follow `clip-path`; see the double-layer `::before` technique documented right above `.node[data-shape="diamond"] .node-body` and in `docs/ARCHITECTURE.md`'s "Borders on clip-path shapes" |

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
- **Any panel/row that `clear()`s + rebuilds its whole DOM on every store
  `'change'` event (details panel, toolbar contextual row) will steal focus
  from one of its own text/number/color fields on every keystroke**, since
  `formControls.js`'s inputs dispatch on the native `input` event (i.e. per
  character) and the rebuild creates a brand-new element each time. Wrap the
  rebuild with `utils/dom.js#rerenderPreservingUiState` and add a
  `data-focus-key` (a stable, per-field string — e.g. keyed by a stable id
  when iterating a list, not by array index if items can be added/removed)
  to any field the fix should cover; add a `scrollSelector` too if the
  container has its own scrollable region (same rebuild resets `scrollTop`
  otherwise). See "Details panel" and "Contextual style-editor row" in
  `docs/ARCHITECTURE.md` for the full story and a second, related gotcha in
  `canvas/node.js#updateNodeEl` (don't rebuild a node's body while its own
  inline rename is live, since a *different* node's unrelated dispatch
  re-renders every node, not just the one that changed).
- **A CSS ID selector's `background` shorthand can silently clobber a class
  rule's `background-image`, regardless of stylesheet order** — an ID's
  specificity (1,0,0) beats any class selector, and the shorthand resets
  every sub-property it doesn't mention. Always use `background-color` (not
  `background`) when styling an element by ID if a *class* rule on the same
  element sets `background-image` — this exact bug made "Toggle Grid" look
  completely broken (`css/layout.css`'s `#canvas-viewport` vs.
  `css/canvas.css`'s `.canvas-viewport`/`.show-grid`).
- **A `position: absolute`/negative-offset element inside a container with
  `overflow-y: auto` (or any single-axis overflow) gets silently clipped
  out of hit-testing, not just view** — per the CSS spec, a `visible`
  `overflow-x` paired with a non-`visible` `overflow-y` computes to `auto`
  too, so nothing about that axis is ever truly "visible" once its sibling
  axis scrolls. Bit the details panel's first resize-handle attempt (see
  ARCHITECTURE.md "Details panel"); keep any such handle's hit area fully
  inside its scrollable ancestor's box.
- **A floating (`position: absolute`/`fixed`) overlay that spans the
  sidebar and/or canvas will block clicks on whatever it visually covers**
  — this isn't just a look-and-feel tradeoff, it broke real e2e tests
  (connecting to a second component, duplicating/grouping/deleting a
  selection) when a *full-width* floating overlay was tried for the
  toolbar's contextual row, and it broke a whole different set of tests
  again later when a *smaller*, selection-anchored floating card (its
  `'floating'` display mode — see docs/ARCHITECTURE.md's "Contextual
  style-editor row" gotcha #4) still clamped only to the window instead of
  the canvas area. If a future request asks for "make X float instead of
  pushing the layout": clamp its position to the specific container it's
  allowed to cover (e.g. `#canvas-viewport`'s own rect), not the whole
  window — that excludes chrome like the toolbar/sidebar/panels for free,
  since they're siblings outside that box — and run the full e2e suite
  (not just a visual check) before considering it done; overlap bugs like
  this one show up as click-interception timeouts, not visual glitches.
- **A "pick whichever candidate fits, else fall back to a naive clamp"
  strategy for positioning floating UI near an anchor needs the *same*
  anchor-avoidance guarantee in its fallback branch, not just in the
  primary candidates.** `positionFloatingRow()`'s first version tried
  below/above/left/right placements and fell back to a plain
  bounds-clamped "below" if none fit perfectly — that fallback could still
  slide the card back on top of its own anchor when the card was taller
  than the available room on every side (reproduced with the "rows" shape:
  its own "+ Add row" button ended up hidden underneath the clamped-back
  card). Fixed by always computing position *away* from the anchor on
  whichever side has more room, and never clamping back toward it — if it
  doesn't fully fit, it scrolls internally instead (`overflow-y: auto` +
  `max-height` already set for this on `.toolbar-row-context.floating`).
- **Two independent behaviors can combine to hide a latent bug — changing
  either one alone can silently unmask it.** `canvas.js#addComponentAtCenter`
  always places a new node at `#canvas-viewport`'s exact current center, so
  clicking the same sidebar item twice always landed both nodes in the
  identical spot — except this had never actually been reachable, because
  selecting the first newly-added node grew the (then always-pinned-top)
  contextual row inside `#toolbar`, which shrank `#canvas-viewport` and
  shifted its center before the second click landed. Making the row
  `'floating'` by default (no longer resizing anything) removed that
  accidental side effect and immediately exposed the real bug underneath:
  two components landing in the exact same spot, the newer one's higher
  `zIndex` permanently hiding the first one's own center — the exact point
  a plain click targets — behind it. Fixed at the actual source
  (`createNodeFromDrop` now nudges a new node's spot when it would cover an
  existing node's center, see docs/ARCHITECTURE.md gotcha #5), not by
  reintroducing the toolbar resize. The generalizable habit: when removing
  or changing a layout-affecting side effect (something resizes shared
  space, moves a scroll position, etc.), specifically re-test "do the exact
  same thing twice in a row without moving anything in between" — that's
  the scenario an accidental workaround is most likely to have been
  covering for.
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
