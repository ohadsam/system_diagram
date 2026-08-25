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
| Change the persistent "revisit sub-component suggestions" badge/panel section | `js/canvas/suggestions.js#getUnattachedLayerSuggestions` (shared filter) + `js/canvas/node.js` (`.node-suggestion-badge`, toggled via `.has-suggestions`) + `js/panel/detailsPanel.js#renderSuggestedSubComponents` (checkbox list + batch "Add selected") |
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
| Change obstacle-avoiding connector routing (default + the per-edge "Magic" routing style) | `js/core/magicRouter.js` (pure grid router, DOM-free — unit-test it directly) + `js/canvas/connector.js#buildEdgePath` (rendering, falls back to `orthogonal` on failure) — no separate toolbar arming step exists any more, both `'orthogonal'` (default) and `'magic'` (explicit per-edge choice via the arrow editor's Routing dropdown, adds the `.edge-magic` glow) route through the same function |
| Change the "What's New" modal / version highlights  | `js/version.js` (`APP_VERSION`, `VERSION_HISTORY`) + `js/io/whatsNew.js` (last-seen-version tracking) + `js/modals/whatsNewModal.js` (UI) |
| Change "Duplicate Project" / "Duplicate entire canvas" | `js/core/project.js#duplicateProject` (pure id-remapping clone) + `js/canvas/canvas.js` (`duplicateProjectAsNew`/`duplicateEntireCanvas`) + toolbar/canvas-context-menu wiring in `toolbar.js`/`canvas.js#openCanvasContextMenu` |
| Change "Clear canvas" (canvas right-click)          | `js/canvas/canvas.js#clearCanvas` — uses `store.dispatch()`, not `store.loadProject()`, so it stays undoable; see "Common pitfalls" below and docs/ARCHITECTURE.md's "Undo/redo" section before copying this pattern elsewhere |
| Change the AI Design Review prompt/providers/panel  | `js/io/aiReview.js` (`buildReviewPrompt`, `AI_PROVIDERS`) + `js/panel/aiReviewPanel.js` (UI, paste-back). See "Common pitfalls" below before touching this — it's intentionally not an API integration. |
| Change the Generate Design from Spec prompt/wizard   | `js/io/aiGenerateDesign.js` (`buildGenerateDesignPrompt`, `extractProjectJSON`, `autoArrangeIfNeeded`) + `js/modals/generateDesignModal.js` (the 3-step wizard UI). Same "not an API integration" constraint as AI Design Review applies. |
| Change how missing node/edge ids are handled on import | `js/core/project.js#validateProject` — backfills a missing/invalid id via `core/id.js#nextId` rather than dropping the node/edge; covers file import, backup restore, and pasted AI results alike |
| Change Live Replication's sync rules                | `js/core/replication.js` (`syncReplication`, `buildReplicationPair`) — pure, DOM-free, called from `js/core/store.js#dispatch`/`loadProject`. See "Common pitfalls" below before touching this. |
| Change the Replicate create/join/break UI            | `js/modals/replicationModal.js` (UI) + `js/canvas/canvas.js` (`createReplicationPairFromSelection`, `addSelectionToReplicationSide`, `breakReplicationPair`, `getReplicationInfoForNode`). The node context menu's "🔁 Join replication..." shortcut dispatches a `sdb:open-replication` window event (listened for in `replicationModal.js`) rather than importing the modal directly — see docs/ARCHITECTURE.md's Live Replication section for why. |
| Change the group/replication-side background boundary | `js/canvas/groupBackgrounds.js` (`computeGroupBounds`, pure) + `js/canvas/canvas.js#renderGroupBackgrounds` (DOM) — see docs/ARCHITECTURE.md's "Group backgrounds" section. Dismissing one is session-only (`hiddenGroupBackgrounds`, not part of the project schema). |
| Add/adjust the sidebar's "★ Popular only" filter     | `js/sidebar/sidebar.js` (`popularOnly` module state, the toggle button in `initSidebar`, the filter inside `renderList`) — scoped to built-in categories only, not Favorites/My Components |
| Let a predefined component pin its own `textPosition`/`iconVisible` default | `js/data/schema.js#c()` (accepts the opts, only include them if set) + `js/core/project.js#createNode` (reads `def.textPosition`/`def.iconVisible` *after* spreading `overrides`, so the def wins over the user's global Default Settings) — see docs/ARCHITECTURE.md's "A component's own textPosition/iconVisible default" |
| Add an AWS cluster/node/pod-style component or an HA design pattern | `js/data/categories/aws.js` (plain `c(...)`) or `js/data/categories/design-patterns.js` (`definePattern(...)`) |
| Change the contextual style row's floating/pinned-top/pinned-bottom display mode | `js/io/uiPrefs.js` (storage, `CONTEXT_ROW_MODES`) + `js/toolbar/toolbar.js` (`mountContextRow`, `positionFloatingRow`, the 📌 pin button) + `js/modals/defaultSettingsModal.js` ("Style editor" section, the only way to reach `pinned-bottom`). See "Common pitfalls" below before touching `positionFloatingRow`. |
| Add a border to a new clip-path shape (like diamond/hexagon)      | `css/node.css` — a plain `border` won't follow `clip-path`; see the double-layer `::before` technique documented right above `.node[data-shape="diamond"] .node-body` and in `docs/ARCHITECTURE.md`'s "Borders on clip-path shapes" |
| Adjust the database cylinder shape (`data-shape="cylinder"`)      | `css/node.css` — no `clip-path`, so none of the diamond/hexagon `z-index` workaround applies; the ellipse cap is a `::before` clipped by `.node-body`'s own `overflow: hidden`, see `docs/ARCHITECTURE.md`'s "Database cylinder shape" section |
| Change the "Find on canvas" search (searches placed components/connectors, not the library) | `js/toolbar/toolbar.js` (`buildCanvasSearchGroup`/`runCanvasSearch`/`jumpToMatch`) + `js/canvas/viewport.js#centerOn` (pan-only recenter). Keep it appended *last* in `initToolbar`'s row-1 sequence — see "Add a toolbar button" pitfall below. |
| Change canvas touch/pointer gesture behavior (pan, drag, resize, connect) | `css/canvas.css`'s `#canvas-viewport { touch-action: none }` (do not remove) + the `setPointerCapture()` calls in `canvas.js#beginPan`/`nodeInteractions.js#beginResize`/`connectorInteractions.js#beginConnectFromNode` — see "Common pitfalls" below before touching any of this |
| Change which side a connector anchors on (new connector, or after Auto-arrange) | `js/core/geometry.js#pickBestSides(fromRect, toRect)` — pure, symmetric, unit-testable. Called from `connectorInteractions.js#beginConnectFromNode` (pointerup) and `canvas.js#autoArrangeAll` |
| Change Auto-arrange's layout algorithm | `js/core/autoLayout.js#computeAutoLayout(nodes, edges)` — pure, DOM-free (rank assignment, barycenter ordering, row-wrap constants at the top of the file) + `js/canvas/canvas.js#autoArrangeAll` (dispatch + re-pick edge sides + `fitToScreen`) |
| Change which routing avoids obstacles by default | `js/canvas/connector.js#buildEdgePath` — `'orthogonal'` and `'magic'` both call `core/magicRouter.js#computeMagicWaypoints` now; `'straight'`/`'curved'` stay literal |
| Change where along a side a connector actually anchors (not just which side) | `js/core/geometry.js#sideAnchor(rect, side, offset)` (0..1 along the side, default 0.5 = midpoint) / `#computeAnchorOffset(rect, side, point)` (the inverse) — see "Common pitfalls" below before reusing an offset across a `pickBestSides` side change |
| Change the Sequence Diagram wizard/lifeline shape/message numbering | `js/modals/sequenceDiagramModal.js` (wizard UI) + `js/core/sequenceDiagram.js#layoutLifelines` (pure layout) + `js/canvas/canvas.js#createSequenceDiagram`/`#computeMessageSequenceNumbers` + `js/data/categories/shapes.js` (`shape-lifeline` def) + `css/node.css`'s `[data-shape="lifeline"]` rules (title box + dashed line + full-height conn-points). See docs/ARCHITECTURE.md's "Sequence diagrams" section. |
| Mark a component as "popular" (sidebar highlight)   | `popular: true` in the `c(...)` call (`js/data/schema.js`) — same curation bar as `related`, see `add-library-item` skill |
| Add/change Favorites (folders, CRUD, reorder)       | `js/io/favorites.js` (storage — folders/favorites as flat arrays with `parentId`/`folderId` + `order`) + `js/sidebar/sidebar.js` (`renderFavoritesCategory`/`renderFavoritesTree`/`renderFavoriteFolder`, the recursive tree UI) + `js/modals/promptModal.js` (folder-name text prompt) |
| Change Live Replication's internal-edge mirroring (a connector between two already-mirrored members) | `js/core/replication.js` (`EDGE_MIRROR_FIELDS`, `edgeSignature`, `cloneAsMirrorEdge`, `syncPair`'s steps 4-5) + `pair.edgeMembers` (same `{a,b}` shape as `pair.members`, just for edges) — see docs/ARCHITECTURE.md's "Live Replication" section |
| Change a lifeline's self-message (calling itself) rendering/creation | `js/canvas/connector.js#selfLoopPath`/`buildEdgePath` (the loop shape) + `js/canvas/connectorInteractions.js#beginConnectFromNode` (`allowSelf`, gated to `shape === 'lifeline'`) — see docs/ARCHITECTURE.md's "Self-messages" section |
| Change drag-to-reconnect an existing connector's endpoint | `js/canvas/edgeReconnect.js` (the whole feature — handle overlay, drag gesture) — **read** docs/ARCHITECTURE.md's "Drag-to-reconnect" section first if the handles ever stop being clickable; it documents a real z-index gotcha with a specific, non-obvious fix |
| Change "Distribute Evenly" for a sequence diagram | `js/core/sequenceDiagram.js#distributeLifelineColumns`/`#distributeMessages` (pure, order-preserving) + `js/canvas/canvas.js#distributeSequenceDiagram` (dispatch) |
| Change "Scale Diagram" (permanent resize, not view zoom) | `js/core/scaleDiagram.js#scaleNodes` (pure) + `js/canvas/canvas.js#scaleDiagram` (dispatch, computes the origin) + `js/modals/scaleDiagramModal.js` (UI) |
| Change an edge's label position (start/middle/end) or its hover tooltip | `js/core/project.js` (`labelPosition` field, `EDGE_LABEL_POSITIONS`) + `js/canvas/connector.js` (`pathPointForLabel`, the `<title>` child element for the tooltip) + `js/toolbar/arrowEditor.js` (the style-editor control) |
| Change the sequence-diagram zoom-in/drill-down (🔍 icon, preview, pin, edit) | `js/canvas/canvas.js#getSequenceDiagramGroups`/`getNodesBounds`/`hideExcept` (derivation + export support) + `js/modals/subDiagramModal.js` (read-only preview + pin) + `js/canvas/subDiagramEdit.js` (the store-swap edit flow) — **read** docs/ARCHITECTURE.md's section on this before touching it; it documents a real gotcha about group-background icons rendering behind the toolbar |
| Change what gets an extra PNG/PDF page for a sequence diagram | `js/io/exportImage.js` (`captureDiagramCanvas({nodeIds})`, `captureSequenceDiagramCanvases`) + `js/io/exportPdf.js` (`addCanvasPage`) — both call `canvas.js#getSequenceDiagramGroups` |
| Change AI Design Review/Generate Design's sequence-diagram-specific prompt wording | `js/io/aiReview.js#buildReviewPrompt`'s `hasSequenceDiagram` param + `js/io/aiGenerateDesign.js`'s `SEQUENCE_EXAMPLE_JSON`/its rules block + `autoArrangeIfNeeded`'s lifeline skip |
| Change a lifeline-to-lifeline message's sync/async/return style presets | `js/toolbar/arrowEditor.js#renderMessagePresets` — see "Common pitfalls" below (a buttons-vs-dropdown gotcha that broke an unrelated test by growing the floating style row) |
| Change a lifeline's destroy marker (X where it terminates) | `js/core/project.js` (`destroyOffset` field) + `js/canvas/canvas.js` (`setLifelineDestroyOffset`/`clearLifelineDestroyOffset`, the context-menu wiring) + `js/canvas/node.js`/`css/node.css` (`.lifeline-destroy-marker`, `--destroy-y`) |
| Change UML activation bars (add/remove/drag-to-move/-resize) | `js/core/project.js` (`activations` field) + `js/canvas/canvas.js` (`addActivationBar`/`removeActivationBar`) + `js/canvas/nodeInteractions.js` (`beginActivationMove`/`beginActivationResize`, delegated pointerdown — see docs/ARCHITECTURE.md's "Activation bars" section before adding a per-bar listener, it'll go stale) + `js/canvas/node.js`/`css/node.css` (`.lifeline-activation`, `.activation-handle`) |
| Add/change a UML combined-fragment shape (Alt/Opt/Loop/Par/Critical/Break) | `js/core/project.js` (`fragmentType` field, `FRAGMENT_TYPES`) + `js/data/categories/sequence-templates.js#fragment()` (the six sidebar shapes) + `js/canvas/node.js`/`css/node.css` (`.fragment-tag` pentagon) — reuses the plain `rect` shape, **not** a new node shape |
| Add/change a ready-made sequence-diagram template | `js/data/categories/sequence-templates.js` — `definePattern(id, name, icon, { groupOnInstantiate: true, nodes: lifelines(...), edges: [msg(...), ...] })`; use the raw edge-spec shape via `msg()`, not `e()` — see docs/ARCHITECTURE.md's "Ready-made templates" section for why |
| Add/change a "Smart Suggestions" sequence-diagram pairing | `relatedPatterns: ['seq-...']` in the `c(...)` call (ids must be `kind: 'pattern'`) — same curation bar as `related`/`relatedLayers`, see `add-library-item` skill |
| Change dragging a pattern sidebar item onto an existing node | `js/canvas/canvas.js#instantiatePatternNearNode` (positions the pattern clearing the target node's actual leftmost edge, not a flat offset) + `js/sidebar/dragSource.js` (`.pattern-drop-target` hover affordance) |
| Change the sequence-diagram "Copy as Mermaid" export | `js/io/exportSequenceMermaid.js#buildSequenceMermaid` (pure) + `js/modals/subDiagramModal.js` (the button, clipboard write) |
| Change the sequence-diagram "Copy as PlantUML" export | `js/io/exportSequencePlantUML.js#buildSequencePlantUML` (pure, deliberately self-contained rather than sharing code with the Mermaid exporter) + `js/modals/subDiagramModal.js` (the button, clipboard write) |
| Change "📥 Import from Mermaid" (Create dropdown) | `js/io/importSequenceMermaid.js#parseSequenceMermaid` (pure parser) + `js/core/sequenceDiagram.js#layoutImportedSequenceDiagram` (pure layout) + `js/canvas/canvas.js#createSequenceDiagramFromMermaid` (the only store-touching step) + `js/modals/importSequenceMermaidModal.js` (the wizard) — see docs/ARCHITECTURE.md's "Import from Mermaid" section |
| Change the sidebar's hover-preview thumbnail for a sequence-diagram template | `js/sidebar/patternPreview.js` (`isSequenceDiagramPattern`/`attachPatternPreview`/`hidePatternPreview`) + `css/sidebar.css`'s `.pattern-preview-*` rules — see docs/ARCHITECTURE.md's own section for the "sidebar rebuilds every item on each keystroke" gotcha before touching the show/hide wiring |
| Change swimlane/box grouping in the sequence-diagram Mermaid/PlantUML export | `computeGroupBounds(nodes)` — identical helper duplicated in both `js/io/exportSequenceMermaid.js` and `js/io/exportSequencePlantUML.js` — detects a `shape-group` node overlapping lifelines by x-range containment against each lifeline's center-x, not a full rect intersection |
| Change a message's manual sequence-number override | `js/core/project.js` (`sequenceNumberOverride` field) + `js/canvas/canvas.js` (`setSequenceNumberOverride`, `computeMessageSequenceNumbers`'s `override ?? i + 1`) + `js/modals/promptModal.js#promptNumber` (the right-click prompt) — the one deliberately *persisted* exception to this app's "sequence numbers are purely derived" rule; see docs/ARCHITECTURE.md's own section |
| Change whole-diagram export (Mermaid flowchart / draw.io / "Lucidchart") | `js/io/exportFlowchartMermaid.js#buildFlowchartMermaid` + `js/io/exportDrawIO.js#buildDrawIOXml` (both pure) + `js/modals/exportDiagramModal.js` (UI, copy/download/open-provider buttons) — a different export *scope* than the sequence-diagram-only Mermaid/PlantUML exporters above (whole canvas, not one group); "Lucidchart" reuses the draw.io XML as-is, downloaded with a `.drawio` extension |
| Change the "🔗 Share" link | `js/io/shareLink.js` (`buildShareUrl`/`loadProjectFromHash`, gzip via native `CompressionStream`/`DecompressionStream`, base64url into `location.hash`) + `js/modals/shareLinkModal.js` (UI) + `js/main.js#boot()` (checks `location.hash` for a share link before the normal autosave-restore path — `boot()` is `async` for this) |
| Change AI Design Review's "🔍 Review" / "💬 Explain" mode toggle | `js/io/aiReview.js#buildExplainPrompt` (second prompt builder alongside `buildReviewPrompt`) + `js/panel/aiReviewPanel.js`'s `mode` state and `currentPrompt()` |
| Change the deterministic "🔍 Check Diagram" structural checks | `js/core/diagramLint.js#computeDiagramLint` (pure, `resolveDef` dependency-injected) + `js/modals/diagramLintModal.js` (UI, `resolveComponentDef` is the real `resolveDef` passed in) — see docs/ARCHITECTURE.md's own section for a real false-positive gotcha (the `shape-group` boundary-box shape) before adding a new check here |
| Add/change an ER-diagram design pattern | `js/data/categories/design-patterns.js`'s local `entity(key, dx, dy, title, attributes)` helper (wraps the existing `shape-server-rows` component via `overrides`) — same `definePattern(...)` mechanism every other pattern uses |
| Change the sidebar's "Recently Used" section | `js/io/recentComponents.js` (storage, `MAX_RECENT = 8`) + `js/canvas/canvas.js#createNodeFromDrop` (the single `recordComponentUsed(defId)` call site — both drag-drop and click-to-add funnel through it) + `js/sidebar/sidebar.js` (`renderRecentCategory`, mirrors `renderFavoritesCategory`'s shell but flat, no folders) |
| Change Diagram Versions (save/revert/delete a named snapshot) | `js/core/project.js` (`createVersionSnapshot`/`removeVersion`, `project.versions`) + `js/canvas/canvas.js` (`saveDiagramVersion`/`revertToVersion`/`deleteVersion` — plain `store.dispatch`, undoable) + `js/modals/versionHistoryModal.js` (UI) — see docs/ARCHITECTURE.md's "Diagram Versions & Presentations" section |
| Change comparing two versions (or a version vs. the live canvas) | `js/core/diagramDiff.js#computeDiagramDiff` (pure, id-based structural diff) + `js/modals/diagramCompareModal.js` (UI, clickable-only-if-still-on-canvas entries) |
| Change Presentations (build/play/export a slideshow of versions) | `js/core/project.js` (`project.presentations`) + `js/canvas/canvas.js` (`savePresentation`/`deletePresentation`) + `js/modals/presentationsModal.js` (build UI) + `js/modals/presentationPlayerModal.js` (`withTemporaryContent`/`renderSlidesToDataUrls` — **read** docs/ARCHITECTURE.md's section on this before touching it, the `{coalesce: true}` swap-capture-swap pattern is load-bearing for not corrupting undo history) + `js/io/exportPptx.js` (PPTX export, vendored `PptxGenJS`) |
| Add/change a "Design X" reference-architecture template | `js/data/categories/reference-architectures.js` — same `definePattern(...)` mechanism as `design-patterns.js`, but set `groupOnInstantiate: true` (a whole design should come in as one group, not a loose cluster) |
| Change the Command Palette (Ctrl/Cmd+K quick actions) | `js/toolbar/commandPalette.js#filterCommands` (pure matching) + `js/modals/commandPaletteModal.js` (the command list, contextual-vs-general sectioning, keyboard nav) + `js/main.js#initKeyboardShortcuts` (the shortcut, registered before the `isTypingTarget` guard like Ctrl/Cmd+S) — see docs/ARCHITECTURE.md's own section, especially `componentToCommand`'s `kind`-based branching before assuming a single "add" function covers every component |
| Change estimated monthly cost (badge, total, breakdown) | `js/core/project.js` (`monthlyCost` field) + `js/core/cost.js` (`getCostedNodes`/`computeMonthlyCostTotal`/`formatMonthlyCost`, pure) + `js/panel/detailsPanel.js#renderMonthlyCost` (editor) + `js/canvas/node.js` (`.node-cost` badge) + `js/modals/costBreakdownModal.js` (Tools-menu breakdown) |
| Change label chips on the node face | `js/canvas/node.js#buildLabelChips` (`.node-labels`/`.node-label-chip`) — the underlying `node.labels` field and its details-panel editor (`renderLabels`) already existed; this only added the on-canvas rendering |
| Change Smart Alignment Guides (snap-while-dragging) | `js/core/alignmentGuides.js#computeAlignmentGuides`/`boundingBoxOf` (pure) + `js/canvas/nodeInteractions.js#beginMove` (**must** stay inside the RAF-batched `apply()`, not raw `pointermove` — see docs/ARCHITECTURE.md's own section for a real bug this ordering caused and how it was fixed) + `js/canvas/canvas.js` (`showAlignmentGuides`/`hideAlignmentGuides`, the `.align-guide-layer`) + `js/io/uiPrefs.js` (`alignGuides` toggle) |
| Change dark mode (light/dark/system) | `js/io/theme.js#setTheme` (stamps `data-theme`) + `js/io/uiPrefs.js` (`theme` field) + `css/variables.css` (every color token's dark-mode override) — a display setting only, not project data |
| Change the Diagram Theme palettes (permanent recolor) | `js/core/diagramTheme.js` (`DIAGRAM_THEMES`, `applyDiagramTheme` — groups nodes by current fill first) + `js/modals/diagramThemeModal.js` (swatch picker) + `js/canvas/canvas.js#applyDiagramThemeToCanvas` |
| Change custom icon upload | `js/io/fileIO.js#pickImageFile` (file picker) + `js/core/project.js` (`node.iconImage` field) + `js/canvas/node.js#buildIconEl` (renders it over `node.icon` when set) + `js/toolbar/styleEditor.js` (Upload/Replace/Remove buttons) — remember to add `iconImage` to `core/replication.js#MIRROR_FIELDS` if it or a similar field ever needs re-adding |
| Change the minimap | `js/core/minimap.js` (`computeMinimapLayout`/`minimapPointToCanvas`, pure) + `js/canvas/minimap.js` (`initMinimap`/`setMinimapVisible`, its own store/viewport subscriptions — deliberately outside `canvas.js`'s main render) + `js/io/uiPrefs.js` (`showMinimap`) + `--z-minimap` in `css/variables.css` |
| Change Focus Mode | `js/core/focusMode.js#computeFocusedIds` (pure) + `js/canvas/canvas.js` (`setFocusMode`/`applyFocusDimming`, called from both `render()` and `renderSelectionOnly()`) + `js/io/uiPrefs.js` (`focusMode`) |
| Change manual connector waypoints (drag-to-bend) | `js/canvas/waypointHandles.js` (the handle overlay — diffed by positional index, not id) + `js/core/project.js` (`edge.waypoints` field) + `js/canvas/connector.js#buildEdgePath` (checked *before* any `routing` branch — a universal override) + `js/canvas/canvas.js#clearEdgeWaypoints` ("Straighten connector" context-menu item) |
| Change pinned comments | `js/core/project.js` (`createComment`/`validateComments`, `project.comments`) + `js/canvas/commentPins.js` (pin rendering, diffed by id) + `js/modals/commentModal.js` (`sdb:open-comment` window event, editor) + `js/canvas/canvas.js` (`addCommentAt`/`addCommentAtCenter`/`updateCommentText`/`toggleCommentResolved`/`deleteComment`, and `getContentBounds`'s comment-padding for Fit-to-Screen/export) |
| Fix a floating panel nested in `#toolbar` losing to a sibling drawer (`#sidebar`/`#details-panel`) despite a higher z-index | Raise `--z-toolbar` itself in `css/variables.css` (currently 26, just above `--z-panel`'s 25) rather than reparenting the panel — a real `document.body` portal seems more "correct" but breaks the ~28 e2e specs that locate a dropdown's buttons via `'#toolbar button'`, see "Common pitfalls" below |

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
- `store.loadProject()` calls `history.init()`, which *replaces*
  undo/redo entirely rather than adding to it — correct for genuinely
  switching to a different project (New, Duplicate as new project, Load),
  wrong for modifying the *current* project's content, which silently
  becomes un-undoable if you reach for `loadProject()` there instead of a
  normal `store.dispatch()`. See docs/ARCHITECTURE.md's "Undo/redo"
  section (the `canvas.js#clearCanvas` gotcha) for the concrete case this
  was found in.
- The canvas has its own pan/zoom transform; always convert
  screen↔canvas coordinates via `canvas/canvas.js#screenToCanvas` rather
  than using raw client coordinates.
- `canvas.js#getContentBounds` (used by "fit to screen" and PNG/PDF export)
  is *not* a pure function of `state.nodes` — it also reads the live DOM
  (`edgeLayer.getBBox()` for edge routing that juts past node boxes,
  `.node-external-label` rects for above/below labels), so it must be
  called while the canvas is actually mounted and rendered, not from a
  unit test or before `initCanvas` runs.
- `core/project.js#createNode`'s field precedence is layered, not a flat
  spread: base defaults, then `overrides` (the caller's `zIndex` plus the
  user's *global* Default Settings via `buildCreationOverrides()`), then —
  for `textPosition`/`iconVisible` only — the component `def`'s own value
  if it set one. That's the opposite of every other def-derived field
  above it (`shape`/`fill`/`stroke`/... are never in `overrides` at all,
  so there's nothing for them to lose to); if you add a new per-def
  structural default, follow this same "spread after `overrides`, only
  when the def actually sets it" pattern, not a plain merge — a plain
  merge would let the global default silently win for every user who
  hasn't customized it, defeating the point.
- Sidebar drag uses pointer events, not HTML5 DnD — don't mix the two
  paradigms when extending it.
- Adding a new node/edge field does **not** automatically make Live
  Replication mirror it — `core/replication.js#MIRROR_FIELDS`/
  `EDGE_MIRROR_FIELDS` are explicit allowlists, unlike `signature()`'s
  change-detection (which spreads the whole object and so "sees" a new
  field for free). Add the field name to the relevant list, and if it
  carries its own `id` per entry (like `subComponents` or `activations`),
  regenerate a fresh one per side in `cloneAsMirror`/`applyMirroredContent`
  rather than copying it verbatim — see docs/ARCHITECTURE.md's "Activation
  bars" gotcha for a real case this was missed in.
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
- **A bare class selector loses to `input[type="…"]` regardless of
  stylesheet load order, because the type-plus-attribute selector has
  *higher* specificity** — `.sub-icon-input { width: 52px }` (specificity
  0,1,0) lost to base.css's `input[type="text"] { width: 100% }` (0,1,1: one
  type selector *and* one attribute selector), even though `.sub-icon-input`
  was declared later in modal.css. The icon input silently rendered at its
  row's full width instead of 52px, shoving every sibling control off the
  edge of the details panel/modal and off-screen — not just visually wrong
  but genuinely unreachable (unfillable, unclickable). When styling an
  `<input>` (or any element commonly matched by a `tag[attr=...]` rule
  elsewhere in the codebase) by class, check whether a `tag[attr]` rule
  already targets it and, if so, scope the override with at least as much
  specificity (e.g. a descendant selector like `.subcomponent-row
  .sub-icon-input`, not a bare class) rather than relying on cascade order.
  A width/size override that silently loses this way won't error or warn —
  it just quietly produces an oversized/undersized element, so this class
  of bug is easy to miss without literally measuring the rendered
  `getBoundingClientRect()` (see `tests/e2e/node-defaults-and-panel.spec.js`
  for the regression test this produced).
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
  tool toggle in `toolMode.js`, zoom controls, "Add Shape" —
  `toolbar.js#buildQuickCreateGroup`) — this is what keeps the always-visible
  row short as buttons are added; see the next bullet for why that matters.
  A genuinely frequent one-click action used *while drawing* (not a
  setup/admin action) belongs flat even if it seems like it "should" live
  with its siblings conceptually — Add Shape was moved out of the
  Create/Tools dropdowns for exactly this reason after user feedback that
  burying it behind a click slowed down active diagramming. (Its former flat
  neighbor, the "🪄 Magic Arrow" toggle, was later removed outright rather
  than re-homed — see docs/ARCHITECTURE.md's connector routing section for
  why arming it ahead of drawing had become pure redundancy.) A
  dropdown's own buttons are ordinary `<button title="...">` elements
  (built the same `el(...)` way as any flat toolbar button) inside a panel
  that only renders visible once its trigger is clicked — so a Playwright
  test clicking one must open its group first (`openToolbarGroup(page,
  'File'|'Create'|'Tools'|'Help')` in `tests/e2e/helpers.js`); the panel
  also auto-closes after any of its own buttons is used, so re-open it
  before every subsequent interaction in the same test.
- **The main toolbar row has ~zero horizontal slack at common desktop
  widths (1280px) even before touching it** — `File`/`Create`/`Tools`/`Help`
  already sit right at the row's edge, with `Help` alone routinely wrapping
  onto its own row 2 there. Inserting a new always-visible item *before* the
  `.toolbar-spacer` (rather than after `Help`, at the very end) shifts the
  flex-wrap line-break point and can drag an *additional* dropdown trigger
  onto row 2 with it, landing that trigger's dropdown panel somewhere it's
  never been positioned before — this once landed the `Help` panel directly
  under the first-run tour's hint bubble, silently eating clicks on it
  (only caught by the full e2e suite, not a targeted subset — see
  "Common pitfalls" test-running advice elsewhere in this doc). **Append any
  new flat row-1 item last** (after `Help`), and re-run the *full* Playwright
  suite (not just new/targeted specs) once after any row-1 DOM-order change
  — a wrap-position regression like this doesn't show up in a feature's own
  tests, only in unrelated ones whose fixed pixel expectations quietly moved.
- **`nodeInteractions.js#beginMove` must never call
  `e.currentTarget.setPointerCapture()`** — unlike the other `begin*()` drag
  gestures in this codebase (`beginPan`, `beginResize`,
  `beginConnectFromNode`, which all capture the pointer for touch-drag
  robustness), `beginMove` fires on *every* pointerdown on a node, including
  both clicks of a double-click. Capturing the pointer there breaks the
  browser's native `dblclick` event synthesis outright — caught by the
  inline-rename mobile e2e test failing consistently (not flaky) after this
  was tried. `touch-action: none` on the ancestor `#canvas-viewport` already
  covers this element for the touch-scroll-conflict problem `setPointerCapture`
  is otherwise meant to help with (see `css/canvas.css`), so it isn't needed
  here anyway.
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
- **Adding a `related`/`relatedLayers` pairing to a component can silently
  break an *unrelated* e2e test that uses a plain substring search to place
  a different component whose name happens to be a substring of, or whose
  `tags` include, the one you just changed.** `tests/e2e/helpers.js#addComponentByName`
  clicks whichever sidebar item a fuzzy search ranks first — searching
  "DNS" had always matched both `net-dns` ("DNS") and `aws-route53`
  ("Route 53", tagged `dns`), with Route 53 ranking first, but a
  "no-companions" test using that search only broke once `aws-route53`
  *gained* a curated `related` list, since until then neither of the two
  matches had one. Use `tests/e2e/smart-suggestions.spec.js`'s own
  `addExactComponent(page, name, categoryLabel?)` helper (exact `.item-name`
  match, optionally scoped to a category) for any test that depends on
  *which specific* component got placed — never assume a fuzzy-search test
  fixture has no curated companions just because it didn't when the test
  was written; re-run the full suite (not just the new component's own
  tests) after any batch of `related`/`relatedLayers` additions.
- **Never assume a connector's rendered anchor point in an e2e test.**
  `pickBestSides` (above) picks the exit/entry side from the two nodes'
  actual relative position — since it changed a plain-elbow test connector's
  side from the historical "always right/left" to whichever side genuinely
  fits a given test's node layout, several existing tests broke at once
  (screen-math like "click just right of node A" no longer landed on the
  edge). Use `tests/e2e/helpers.js#edgeClickPoint`/`clickEdgeNearNode` (SVG
  `getPointAtLength` + `getScreenCTM`, walking a few length-fractions and
  verifying each candidate with `elementFromPoint(...).closest('[data-edge-id]')`
  before trusting it — a selected node's floating style-editor card can sit
  right on top of an obvious click point on a short connector) instead of
  computing a screen-space guess — this is the one reliable way to click a
  rendered edge regardless of which side it actually anchored on.
- **A corner badge that's always in the DOM and only CSS-hidden (`.node-badge`,
  `.node-replication-badge`, `.node-suggestion-badge` — anything toggled via a
  class like `.has-info`/`.has-suggestions` rather than being conditionally
  appended) needs `expect(locator).toBeHidden()`/`toBeVisible()` in a test, not
  `toHaveCount(0)`** — the element is always there, so a count assertion
  never fails even when the feature is correctly absent, silently testing
  nothing. This one's easy to get wrong the first time and won't show up as
  a failure — it shows up as a test that can never catch a regression.
- **An anchor offset computed against one side is meaningless against a
  different one — recompute it against the side `pickBestSides` actually
  settles on, not the side that was literally grabbed.**
  `connectorInteractions.js#beginConnectFromNode`'s `onUp` handler grabs a
  connector from one side (say `left`, a Y-fraction) but `pickBestSides`
  can independently decide the edge should actually anchor on a different
  side (say `top`, an X-fraction) based on the two nodes' relative
  position. `fromOffset` is therefore (re-)computed in `onUp` against
  `sides.fromSide` — the side that was actually settled on — from the
  original grab point, not carried over from whatever was computed at
  grab time against the originally-grabbed side. Getting this wrong
  doesn't crash (the offset is clamped 0..1 either way) — it just silently
  puts the connector at a nonsensical point along the wrong axis. Same
  principle applies to any other offset-like value derived from a
  drag gesture whose final "side"/"target" can differ from its starting
  one.
- **A new overlay meant to sit above arbitrary canvas content needs to
  out-*z-index* everything, not just out-DOM-order it.** Every `.node`
  carries an explicit numeric `z-index` (bring-to-front/send-to-back), and
  a positioned element with an explicit z-index paints above a sibling
  left at the default `z-index: auto` regardless of DOM order, once their
  shared ancestor (`.node-layer`) doesn't itself establish a stacking
  context. `js/canvas/edgeReconnect.js`'s handle-overlay layer hit exactly
  this: appending it after `.node-layer` in the DOM fixed the *common*
  case but a node that had ever been brought to front could still float
  above it. Fixed with a very high fixed `z-index` on the overlay layer
  itself (see `css/connector.css`'s `.edge-handle-layer` comment) — DOM
  order alone is not a reliable "stays on top" guarantee here.
- **A group's own on-canvas UI (background box, its 🔍/✕ corner buttons)
  can end up genuinely off-screen for a *freshly created* sequence
  diagram**, not just visually awkward — lifelines are 640px tall and
  vertically centered on the current view, which routinely puts their top
  (and anything anchored to the group's own top edge) above
  `.canvas-viewport`'s visible area before the user has panned/scrolled at
  all. See docs/ARCHITECTURE.md's "Zoom-in / drill-down" section for the
  concrete gotcha and fix (keep any such icon *inside* the box's bounds,
  never overhanging past its edge) — the same class of bug as the
  `positionFloatingRow` anchor-off-screen fix elsewhere in this file, worth
  checking for on any new UI anchored to a sequence-diagram element.
- **A floating popup anchored to a sidebar item must be explicitly hidden
  when the sidebar list rebuilds, not left to its own `mouseleave`/`blur`
  handlers.** `sidebar.js#renderList()` fully tears down and rebuilds every
  `.sidebar-item` on each keystroke/filter change — an item the mouse is
  currently over can be removed without the mouse ever "leaving" it, since
  its target just vanished underneath. `sidebar/patternPreview.js`'s hover-
  preview thumbnail hit this (a stuck popup after typing in the search box
  while hovering a template) and fixed it by having `renderList()` call the
  popup module's exported hide function unconditionally at the top of every
  rebuild. Worth rechecking for any future feature that anchors a floating
  element (tooltip, popover, preview) to a sidebar item.
- **A new `io/` module needing simple JSON persistence should go through
  `io/storage.js#readJSON`/`writeJSON`, not raw `localStorage`.** Every
  sibling storage module (`favorites.js`, `librarySettings.js`, ...) does,
  and so does `tests/unit/testSupport.mjs#installMemoryLocalStorage` — its
  stub only patches `window.localStorage`, not a bare global `localStorage`
  reference, so a module written against the raw global "works" in a real
  browser but silently fails every read/write in that test helper.
  `io/recentComponents.js`'s first draft made exactly this mistake and its
  own unit tests caught it immediately.
- **A structural "is this component connected to anything?" check needs to
  know about every node kind this app has that's deliberately *not* meant
  to have an edge** — not just the obvious sequence-diagram ones (lifelines,
  fragment boxes), but also the plain "Group / Container" shape
  (`defId === 'shape-group'`), which is purely a visual boundary box you
  drop *behind* other components and is explicitly documented as never
  meant to connect to anything. `core/diagramLint.js`'s orphan-connectivity
  check missed this one on its first pass (only excluded lifelines/
  fragments) and flagged every diagram using a Group/Container shape as
  having an "unconnected" component — caught in this batch's own review,
  not a user report.
- **`canvas/suggestions.js`'s pattern-suggestion row label is hardcoded to
  "🔀 Sequence diagrams for X"** — `relatedPatterns` is a generic `kind:
  'pattern'` id list (any `definePattern(...)` entry qualifies, not just a
  `sequence-templates.js` one), but wiring a non-sequence pattern (e.g. an
  ER-diagram template) through it today would show that literal, factually
  wrong copy. Don't add a `relatedPatterns` entry pointing at a non-
  sequence-diagram pattern until that label is generalized — this was
  deliberately left un-curated for the ER patterns added in this batch for
  exactly that reason.
- **When a drag gesture's expensive per-frame work (a geometry scan, a DOM
  rebuild) moves from raw `pointermove` into the existing RAF-batched
  `apply()` callback, any code that calls `apply()` a second time outside
  that RAF loop (e.g. a drag-end handler's "flush the final position"
  call) will re-trigger that same expensive work — including anything
  `apply()` shows/hides as a side effect.** `nodeInteractions.js#beginMove`'s
  smart-alignment-guides feature hit this exactly: `onUp` used to call
  `hideAlignmentGuides()` *before* its own final `apply()` call (needed to
  flush the last frame's position); once the guide-drawing logic moved
  inside `apply()` for performance, that final call redrew a guide line
  that then had nothing left to clear it — a real, caught-by-its-own-e2e-
  test bug, not a hypothetical. Fixed by moving the "hide/clear" call to
  *after* the drag-end sequence's own final `apply()`, not before. If you
  move per-frame visual work into a RAF-batched callback like this,
  audit every other call site of that callback for the same ordering trap.
- **A high z-index only wins inside its own stacking context — nesting a
  "should always be on top" floating panel inside an ordinary layout
  element can trap it below a completely unrelated sibling.** `#toolbar` is
  a flex item of `#app` with its own explicit `z-index` (`--z-toolbar`);
  per the flex-item stacking rules that makes `#toolbar` a real stacking
  context, and *any* z-indexed descendant of it — no matter how high that
  descendant's own z-index is — is compared against other elements only
  within `#toolbar`'s local context, never directly against a sibling like
  `#sidebar`. `toolbar/toolbarDropdown.js`'s dropdown panel is a plain
  child of its trigger (nested inside `#toolbar`) with
  `z-index: var(--z-menu)` — the app's *highest* UI layer short of hints/
  toasts — yet still rendered visually *behind* the mobile `#sidebar`
  drawer (a much lower `z-index: var(--z-panel)`) whenever both were open
  at once, because `#sidebar` sits outside `#toolbar`'s trapped context
  and legitimately outranked the whole of it. **First fix attempted:**
  make the panel a true portal (`document.body.appendChild(panel)`),
  matching `canvas/contextMenu.js`'s own right-click menu and `toolbar.js`'s
  floating contextual style row, which already work this way — correct in
  isolation, but it broke ~28 e2e spec files (plus `tests/e2e/helpers.js`'s
  `openToolbarGroup`) that locate a dropdown's own buttons via
  `'#toolbar button'`, relying on the panel staying a DOM descendant of
  `#toolbar`; reparenting it silently made every one of those selectors
  stop matching, timing out dozens of unrelated tests. Caught only by
  re-running the full e2e suite before merging — not by any of the three
  review passes — which is exactly why that step exists. **Actual fix:**
  reverted the portal, and instead raised `--z-toolbar` itself (20 → 26,
  just above `--z-panel`'s 25) in `css/variables.css` — since `#toolbar`
  and the mobile drawers never spatially overlap in normal layout, this
  fixes the one real case (a dropdown panel reaching into a drawer's screen
  region) with zero DOM/JS changes and no risk to the `'#toolbar button'`
  convention. Lesson: when a trapped descendant needs to outrank a sibling
  of its trapping ancestor, try raising the *ancestor's* own z-index first
  — a real DOM portal is a bigger, riskier change and should be reserved
  for when the trapped element's home genuinely needs to move, not just
  its numeric rank.
- **Two independently-`position: fixed`, `document.body`-portaled overlays
  can still visually collide even though neither is stacking-context-
  trapped** — the minimap (a fixed corner panel) and the floating
  contextual style row (positioned next to whatever's selected) can both
  legitimately end up in the same screen region when a component near the
  canvas's bottom-right corner is selected. This isn't a z-index problem
  (whichever paints last just wins outright, hiding the other's content
  entirely) — it needs actual geometric collision-avoidance, not a layer
  order. `toolbar.js#positionFloatingRow` already trims itself away from
  the Smart Suggestions banner (a full-width bottom overlay) by shrinking
  its available height; the minimap only occupies one fixed corner, so it
  gets a narrower, more targeted fix instead — nudging `left` only when an
  actual vertical-and-horizontal overlap with the minimap's own
  `getBoundingClientRect()` is detected. Any *third* future fixed-corner
  overlay would need the same explicit treatment added; there's no generic
  "avoid every other overlay" mechanism here.
