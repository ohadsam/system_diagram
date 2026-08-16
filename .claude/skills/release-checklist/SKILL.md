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
   code.
2. **Functional/integration.** Trace how the change interacts with existing features: undo/redo,
   JSON import/export, duplicate-project, autosave, the details panel, multi-select. A feature that
   works in isolation but breaks e.g. cascade-delete or the export format is not done.
   **If this batch added any new predefined component(s) or a whole new category**, also check
   whether it should get a `related` (Smart Suggestions) entry — see the "add-library-item" skill's
   "Smart Suggestions (`related`)" section for the bar a pairing needs to clear. Skip it and say so
   if nothing in the batch has an obvious, already-in-the-library companion — don't force a weak
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

## 4. Docs — all of them, every time

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
  values and diff them).

## 5. Skills

Check whether this repo's `.claude/skills/` need updating given the change — e.g. this skill file
itself, if the checklist changed, or `.claude/skills/add-library-item/SKILL.md` if the component
data schema (`js/data/schema.js`) changed. Create a new skill only for a genuinely recurring
workflow, not a one-off task — skills cost a discovery/loading overhead, so a narrow one-shot
instruction belongs in the conversation, not a new skill file.

## 6. Tests

- Add/extend unit tests (`tests/unit/*.test.mjs`) for any new pure logic — see existing tests in
  `tests/unit/replication.test.mjs` and `tests/unit/project.test.mjs` for the style (plain
  `node:test`, no DOM; DOM-touching modules like `hints.js` get e2e coverage instead, not node
  unit tests — see `tests/unit/storage.test.mjs`'s header comment for why).
- Add/extend e2e tests (`tests/e2e/*.spec.js`) for any new user-facing flow.
- Run everything and confirm it's green before moving on:

```bash
npm run test:unit
# Playwright needs the pre-installed Chromium pointed at explicitly in this environment:
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx playwright test --config=tests/e2e/playwright.config.js --reporter=line
```

If the pinned chromium path above doesn't exist, find the installed one first:
`find /opt/pw-browsers -maxdepth 2 -iname "chrome"`.

## 7. Merge to main and push

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
- `npm run test:unit` and the Playwright e2e suite both pass with 0 failures.
- Version bumped, What's New updated, hints reviewed, all six doc surfaces reviewed (even if some
  needed no change — say so).
- `main` is pushed and fast-forwarded to include the batch.
