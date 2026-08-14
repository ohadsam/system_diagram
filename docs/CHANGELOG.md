# Changelog

All notable changes to this project. Format: date, then bullet list.
Keep this in sync with `PLAN.md` as stages complete.

## Unreleased

- Initial build: full client-side system design diagram builder per
  `SPEC.md` v1 — canvas, ~310-component library across 19 categories,
  connectors with configurable routing/arrowheads, style toolbar, details
  panel with sub-components/rows, custom component & shape builder,
  localStorage autosave + named projects, JSON/PNG/PDF export, dismissible
  hints, responsive/mobile layout, standalone `help.html` guide, unit +
  Playwright e2e tests (44 + 24 passing), GitHub Pages deploy workflow.
- Fixed during review: clicking a node during a drag gesture suppressed
  the browser's default focus-shift (a `preventDefault()` side effect),
  which silently broke keyboard shortcuts (Delete/undo/duplicate) right
  after interacting with the canvas — now explicitly focuses the
  node/edge/canvas so shortcuts always work.
  Fixed: components saved to "My Components" couldn't actually be placed
  on the canvas (their ids weren't resolved against the custom-component
  registry, only the built-in library) — a core feature that was
  silently broken.
  Fixed: the contextual toolbar row's `hidden` attribute had no visual
  effect because `.toolbar-row` also sets `display: flex`, which (per the
  CSS cascade) silently wins over the browser's `[hidden] { display:none }`
  default — added an explicit override rule.
  Added: Ctrl/Cmd+S now saves an actual checkpoint (was previously a no-op
  beyond swallowing the browser's Save Page dialog while typing).
  Added: the mobile sidebar drawer now auto-closes after a component is
  placed or the canvas is tapped, instead of requiring an extra tap.
