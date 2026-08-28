---
name: release-checklist
description: Run this after implementing any feature or fix in the System Design Diagram Builder repo (ohadsam/system_diagram), before considering the work done. Covers the recurring "wrap up a batch of changes" checklist — 3x code review with UI/UX and mobile-vs-desktop emphasis, version bump, What's New, hints, all docs, skills, tests, and merging to main. Invoke by name ("run the release checklist") or whenever a user asks to finish/ship/wrap up/close out a change in this repo.
---

# Release checklist

This repo (a 100% client-side, no-build-step system design diagram builder) has one recurring
closing ritual for every batch of changes, feature or fix alike. Do not skip a step and do not
reorder them — later steps assume earlier ones are done (e.g. the review pass needs the feature
finished; the version bump needs the review's fixes already applied; the merge needs tests green).

If a step turns up nothing to do (no hint-worthy feature, no doc actually affected), say so
explicitly and move on — don't pad an entry just to have written something.

## 1. Code review — run it 3 times (technical, functional, UI/UX + mobile)

**Literally three separate review passes, every time — not one merged skim, not "the important
one twice."** This is a hard requirement of this checklist, not a suggestion: each of the three
passes below has independently caught real bugs the other two missed in this repo's history (see
the mobile off-screen-dropdown bug and the "Save as Component" edge-harvesting logic as two
concrete examples). Do all three, in order, every single time this skill runs:

1. **Technical correctness.** Re-read every changed/added file fresh. For anything touching
   `core/store.js#dispatch`/`loadProject` or `core/replication.js`, check the "Common pitfalls"
   section of `docs/AI_AGENT_GUIDE.md` first — this area has produced subtle bugs before (mirrored
   deletion not cascading to edges, a severed replication link not freezing its peer and getting
   silently re-mirrored). Look specifically for: mutation of a `dispatch`-passed `prev` state,
   missing edge cleanup on any node deletion path, and off-by-one/tie-break logic in diff-based
   code. **Also double-check every new import in a new `io/`/`core/` module against the file it
   actually claims to export from** — a wrong import doesn't fail at parse time if the wrong module
   happens to export other real things, but if the new file is statically imported by something
   already wired into the app (a panel, `main.js`), it throws at module-evaluation time and breaks
   the *entire* app's module graph, not just the new feature. This happened for real: both
   `io/exportAnimationPptx.js` and `io/exportAnimationVideo.js` imported `captureDiagramCanvas` from
   `canvas/canvas.js` instead of its real home `io/exportImage.js`, and because `panel/animationPanel.js`
   statically imports both, every e2e test failed with the sidebar never rendering — a symptom with
   no obvious link to animations, only diagnosed via a raw Playwright script with
   `page.on('pageerror', ...)` to get the browser's own precise error. If a whole test suite
   suddenly fails at the very first render right after a new io/export module was added, suspect a
   bad import in that new file's chain before debugging the feature itself. **A second way to
   trigger the identical symptom: a stray literal `*/` inside a `/** ... */` JSDoc comment's own
   prose closes the comment early**, turning the rest of it into an invalid top-level statement —
   happened for real in `js/io/aiLayoutSuggest.js`, whose comment read "...validate*/sanitize*
   helpers." Same fix works for both causes: `node -e "import('./path/to/file.js').catch(e=>console.log(e.message))"`
   run against every new/changed file until the exact one throws.
2. **Functional/integration.** Trace how the change interacts with existing features: undo/redo,
   JSON import/export, duplicate-project, autosave, the details panel, multi-select. A feature that
   works in isolation but breaks e.g. cascade-delete or the export format is not done.
   **If this batch added any new predefined component(s) or a whole new category**, also check
   whether it should get a `related` and/or `relatedLayers` (Smart Suggestions) entry — see the
   "add-library-item" skill's "Smart Suggestions (`related` / `relatedLayers`)" section for the bar
   a pairing needs to clear. Skip it and say so if nothing in the batch has an obvious,
   already-in-the-library companion (or sub-component, for `relatedLayers`) — don't force a weak
   pairing just to have added one.
3. **UI/UX, with explicit desktop-vs-mobile emphasis.** This is the pass most likely to be
   shortchanged — don't. For every new/changed screen (toolbar buttons, modals, panels):
   - Screenshot at a **desktop width** (~1280px) via Playwright.
   - Screenshot at a **mobile width** (390×844) AND a **tablet width** (768×1024) — see
     `tests/e2e/mobile-responsive.spec.js` for the pattern (open the sidebar drawer via
     `.sidebar-toggle-btn` before using it at mobile widths; it's closed by default there).
   - Use **non-`fullPage`** screenshots when checking any `position: fixed`/`absolute` overlay
     (sidebar drawer, details panel, AI review panel) — `fullPage: true` can lay the page out
     against a different synthetic viewport and produce a misleading capture. Cross-check anything
     that looks broken with `page.evaluate(() => ({...getBoundingClientRect()}))` before "fixing"
     it.
   - Explicitly check for **horizontal overflow**: `document.documentElement.scrollWidth <=
     window.innerWidth` at both mobile and tablet widths. A `.toolbar-group` with several
     full-text buttons is the most common source — `.toolbar-group` needs `flex-wrap: wrap` inside
     `@media (max-width: 900px)` (see `css/responsive.css`) or it forces page-wide horizontal
     scroll instead of wrapping onto a new line.
   - Check any mobile drawer's `top` tracks the toolbar's *actual* rendered height (which varies —
     the toolbar wraps onto multiple rows well before 900px) rather than a hardcoded pixel offset.
   - Verify color, spacing and copy are consistent with sibling features already in the app,
     including in dark mode where applicable.
   - **Every toolbar button touched or added this batch has a clear, specific `title`** (the
     app's only tooltip mechanism — no custom tooltip system). If it's a new button, also check it
     landed inside one of `toolbar.js`'s dropdown groups (`toolbarDropdown.js`) rather than flat,
     unless it's a continuously-used control like undo/redo/zoom/a tool-mode toggle — see
     `docs/AI_AGENT_GUIDE.md`'s "Add a toolbar button" pitfall for the convention and why (a flat
     row of full-text buttons was the direct cause of a past mobile horizontal-overflow bug).

Fix everything found before moving on. If a pass finds nothing, say so and continue — don't
manufacture a finding.

## 2. Version + What's New

- Bump `APP_VERSION` in `js/version.js` (semver: features → minor, fixes-only → patch).
- Add a `VERSION_HISTORY` entry: short, user-facing highlights (not implementation detail).

## 3. Hints

Check `js/hints/hintData.js`. If the change adds a genuinely new, non-obvious, discoverable
interaction (a new toolbar button, a new modal flow), add a hint entry pointing at it. Don't add
one for an internal/behind-the-scenes change, or one already implied by an existing hint.

## 4. Hebrew/RTL localization (`io/i18n.js`)

This app has an opt-in Hebrew/RTL mode (Tools menu → 🌐 Language) covering a **deliberately
narrow** surface: the toolbar dropdown group labels/tooltips (File/Create/Tools/Help),
undo/redo/select/hand-tool labels, the sidebar search box, and the shared "Cancel" button. It does
**not** cover the component library data or `help.html` — that's an explicit, separate
much-larger project (see `io/i18n.js`'s header comment) and needs no action here. Every batch
checks this the same way it checks Smart Suggestions or hints — explicitly, even when the answer
is "nothing to do":

- **Changed the text of an already-translated string?** (e.g. reworded a toolbar dropdown title,
  renamed a button) — update its Hebrew counterpart in `STRINGS.he` to match, and re-verify the
  `STRINGS.en` value is still byte-for-byte identical to whatever hardcoded text it mirrors
  elsewhere. A silent mismatch here is easy to introduce and easy to miss in an English-language
  review pass — exactly this happened during the batch that added this localization (the
  `toolbar.handTool`/`toolbar.file.title` strings drifted from the real button text and only an
  e2e failure caught it). Grep for the string's key across `.js` files to find every call site.
- **Added a new toolbar dropdown group, or a new always-visible control in the same family as the
  currently-translated set** (undo/redo/select/hand-tool)? Decide explicitly whether it joins the
  translated surface too — not mandatory, the surface grows slowly on purpose, but say so either
  way rather than silently leaving a new prominent string untranslated next to translated ones.
- **Added a new `position: fixed`/`absolute` element positioned with a literal `left`/`right`** (a
  new toast, floating button, drawer, panel)? It needs its own `[dir="rtl"]` override the same way
  the existing ones do (`css/responsive.css`, `css/base.css`, `css/toolbar.css`, `css/canvas.css`)
  — `direction: rtl` on `<html>` does nothing for physically-positioned offsets.
- **Added a new UI surface whose text content is always English** (like the guided-tour hint
  bubbles)? It needs its own `direction: ltr` rule the same way `.hint-bubble` does
  (`css/hints.css`) or an RTL ancestor will silently right-align it and reverse any flex-row
  button order inside it.
- If anything above changed, screenshot it with the language switched to Hebrew — set
  `localStorage['sdb:v1:prefs']` to include `"language":"he"` and reload (note the `sdb:v1:`
  prefix from `io/storage.js`; without it the app never sees the override) — at desktop and mobile
  width, confirm `document.documentElement.dir === 'rtl'`, and check for horizontal overflow same
  as the rest of the UI/UX pass.

## 5. Docs — all of them, every time

- `docs/SPEC.md` — functional requirements; add/update the relevant numbered section.
- `docs/ARCHITECTURE.md` — how it's built; update the module-tree diagram if a new top-level file
  was added, and add a section for any new subsystem. Record genuine "gotchas" found during
  review here (see existing sections for the tone/format).
- `docs/AI_AGENT_GUIDE.md` — update the quick-reference table and "Common pitfalls" with anything
  a future agent would otherwise have to rediscover the hard way.
- `docs/CHANGELOG.md` — a new dated entry under `## v<version> (<date>)`, matching the existing
  entries' level of detail.
- `README.md` — update the feature list/counts if the change is user-facing (component counts,
  category counts, new top-level features).
- `help.html` — the in-app user guide. Add/update a section, its TOC entry, and an FAQ entry if
  relevant. Verify every TOC `href="#x"` still resolves to a real `<section id="x">` (a broken
  anchor is easy to introduce and easy to check: extract all `href="#..."` and `<section id="...">`
  values and diff them). **If this batch adds a genuinely new, visually distinctive screen** (a new
  modal, a new full-canvas view like 3D Presentation, a new panel) that a screenshot would make
  meaningfully easier to understand than prose alone, add one: serve the app locally, drive it with
  a throwaway Playwright script (dismiss the "Skip all" hints prompt and any onboarding-checklist
  widget first, click "Fit to screen" before capturing a canvas view, use `page.locator(...).screenshot()`
  or a `clip` region to crop tightly rather than a full 1280×900 viewport with mostly empty space),
  save the PNG under `assets/screenshots/`, and embed it with `<img class="help-screenshot" src="assets/screenshots/<name>.png" alt="...">`
  right after that section's `<h2>` — see the existing screenshots there for the pattern. Not every
  batch needs a new one; most changes extend an already-illustrated screen and need no image at all.

## 6. Demo Projects (`js/core/demoProjects.js`, `js/modals/demoProjectsModal.js`)

**If this batch adds a new diagram *kind*** (a new sidebar category with its own distinct visual
shape/pattern — the way BPMN, UML Deployment, and Sequence Diagrams each got their own demo — not
just a new component within an existing kind), add a matching entry to `DEMO_PROJECTS` in
`js/core/demoProjects.js` so "🎓 Demo Projects" (Create menu) keeps demonstrating every kind this
app actually supports. Reuse an existing ready-made pattern/template via `buildPatternPieces(...)`
where one already exists (fastest, and automatically stays in sync with that pattern's own
nodes/edges) rather than hand-placing nodes; only reach for `manualChain(...)` when no suitable
pattern exists yet (as UML Deployment's demo does). Run `tests/unit/demoProjects.test.mjs` after
adding one — it validates every demo's `defId`s resolve to real components and the built project
passes `validateProject()`, which catches a typo'd id immediately rather than only when someone
opens that specific demo. If the batch's new feature is a capability *within* an existing diagram
kind (a new sequence-diagram fragment type, a new BPMN shape) rather than a whole new kind, no demo
change is needed — say so explicitly rather than skipping the question.

## 7. Command Palette & Keyboard Shortcuts

**Every new toolbar-reachable action or modal added this batch needs a matching entry in
`js/modals/commandPaletteModal.js#buildAppCommands()`** (or `buildContextualCommands`, if it only
makes sense with a component selected) — this app's stated design is that the Command Palette
(Ctrl/Cmd+K) is a complete, searchable index of everything the toolbar can do, not just a curated
subset, and it has drifted behind new features before (a whole batch's worth of actions — AI
Quick Start, Import from Image, Template Gallery, Collaborate, 3D Presentation, and more — were
missing until an explicit audit added them). Concretely: for every new `onClick` added to
`toolbar.js` this batch, grep `commandPaletteModal.js` for that same label/action; if it's missing,
add a `{ id, label, keywords, run }` entry matching the toolbar button's own icon+text exactly (so
search results feel identical to the toolbar), and re-run `tests/e2e/commandPalette.spec.js`'s
"every action added across recent batches is reachable" test with the new label appended to its
list. Separately, **decide explicitly whether the new action also deserves its own dedicated
keyboard shortcut** in `main.js#initKeyboardShortcuts` — reserved for continuously-repeated actions
only (zoom, undo/redo, delete, duplicate, the Hand/Select toggle, keyboard-connect's `C`), not for
every new modal/toggle; the Command Palette is the intended discovery path for everything else, so
"no dedicated shortcut, reachable via ⌘K" is the expected answer most of the time — say so rather
than skip the question. If you do add one, update `help.html`'s `#shortcuts` table too.

## 8. Skills — including a self-review of this checklist

Check whether this repo's `.claude/skills/` need updating given the change — e.g.
`.claude/skills/add-library-item/SKILL.md` if the component data schema (`js/data/schema.js`)
changed.

**Then, explicitly and every time, ask whether this checklist itself (this file) needs updating.**
Do this last, after steps 1-7 are actually done — only with the whole batch behind you can you see
whether it taught this checklist something new. Concretely: did anything found or built during
this run reveal a recurring pattern, a new gotcha, a new subsystem worth its own check, or a step
whose instructions turned out to be incomplete/wrong once actually followed? If so, add or edit a
section here in the same way the existing ones read (concrete file paths, the "why", a real
example from this repo's history) — this is exactly how the "Hebrew/RTL localization" step above
came to exist: a batch that *added* RTL support was the first time anyone noticed this checklist
had nothing telling a *future* batch to keep it in sync. If nothing this batch did calls for a
checklist change, say so explicitly rather than skip the question silently — "nothing to update
here" is a valid, expected answer most of the time, not a step to omit.

Create a new skill only for a genuinely recurring workflow, not a one-off task — skills cost a
discovery/loading overhead, so a narrow one-shot instruction belongs in the conversation, not a
new skill file. Any resulting edit to this file is part of the same batch — commit it together
with everything else in step 10, not as an afterthought later.

## 9. Tests

- Add/extend unit tests (`tests/unit/*.test.mjs`) for any new pure logic — see existing tests in
  `tests/unit/replication.test.mjs` and `tests/unit/project.test.mjs` for the style (plain
  `node:test`, no DOM; DOM-touching modules like `hints.js` get e2e coverage instead, not node
  unit tests — see `tests/unit/storage.test.mjs`'s header comment for why).
- Add/extend e2e tests (`tests/e2e/*.spec.js`) for any new user-facing flow.
- **If the feature does real peer-to-peer/WebRTC networking** (as Live Collaboration's
  `collab/webrtcCollab.js` does), don't assume a public STUN/TURN/signaling server is reachable
  from this sandboxed test environment — it often isn't, and a non-trickle ICE-gathering flow that
  waits on a real `icegatheringstatechange` event will hang forever waiting for a STUN round trip
  that never resolves. Race it against a hard timeout (see `GATHER_TIMEOUT_MS` there) so host
  candidates alone (near-instant, no external server needed) are enough for a same-machine/same-LAN
  e2e test, and write the real e2e test as two real peer connections in one browser context (see
  `tests/e2e/liveCollaboration.spec.js`), not a mocked transport — a mock would never have caught
  the hang in the first place.
- Run everything and confirm it's green before moving on:

```bash
npm run test:unit
# Playwright needs the pre-installed Chromium pointed at explicitly in this environment:
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test --config=tests/e2e/playwright.config.js --reporter=line
```

If the pinned chromium path above doesn't exist, find the installed one first:
`find /opt/pw-browsers -maxdepth 2 -iname "chrome"`.

## 10. Merge to main and push

This repo's convention (established across every batch) is a **fast-forward merge**, not a PR:

```bash
git add -A
git commit -m "<summary of this batch>"
git push -u origin <feature-branch>

git fetch origin main
git checkout -B main origin/main
git merge --ff-only <feature-branch>
git push origin main

git checkout <feature-branch>   # leave the working tree back on the feature branch
```

If `--ff-only` fails, do not force-push or rebase without checking with the user first — that
means main moved since the branch was cut and needs a real merge decision.

## Done means

- Code review ran 3 times — technical, functional, and UI/UX+mobile, as genuinely separate
  passes — and every finding was fixed, not just noted.
- Hebrew/RTL surface (`io/i18n.js`) checked against this batch's changes — any changed/new string
  in its scope translated (or explicitly deemed out of scope), any new fixed/absolute element or
  always-English surface reviewed for an RTL override, even if the answer was "nothing to do".
- `npm run test:unit` and the Playwright e2e suite both pass with 0 failures.
- Version bumped, What's New updated, hints reviewed, all six doc surfaces reviewed (even if some
  needed no change — say so).
- Demo Projects checked against this batch's changes — a new diagram kind got a matching demo (or
  it was explicitly decided none was needed).
- Command Palette checked against every toolbar action/modal added this batch — each is reachable
  from Ctrl/Cmd+K, and a dedicated keyboard shortcut was explicitly considered (and added, or
  explicitly skipped) for each.
- This checklist itself explicitly reconsidered in light of this batch — updated if this run
  surfaced a new recurring pattern/gotcha, or a stated "no update needed" otherwise.
- `main` is pushed and fast-forwarded to include the batch.
