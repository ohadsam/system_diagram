---
name: add-library-item
description: Use when adding new predefined components, layers, design patterns, or a whole new category to the System Design Diagram Builder's component library (ohadsam/system_diagram) — e.g. "add an AWS component for X", "add a design pattern for Y", "add a new component category". Encodes the schema/id/testing conventions so they don't need to be re-derived from js/data/schema.js and js/core/project.js every time.
---

# Adding to the component library

The whole library is pure data — `js/data/categories/*.js`, one file per category, each exporting
`category` and `components`. No logic lives here; see `docs/AI_AGENT_GUIDE.md` rule 3. This skill
is the condensed version of that convention, scoped to just this recurring task.

## A plain component

```js
import { c } from '../schema.js';
c('aws-my-thing', 'My Thing', '🎯', {
  color: AWS,                       // hex border/accent — a per-category const, already defined at the top of the file
  shape: 'rounded',                 // optional, default 'rounded' — one of core/project.js#SHAPES
  tags: ['some', 'search', 'tags'], // extra search keywords, lowercase
  description: 'One line, shown in tooltip/search.', // optional but recommended for anything non-obvious
  defaultSize: { w: 160, h: 84 },   // optional, only needed if it should differ from the 160x84 default (e.g. a container-style box)
})
```

Rules:
- `id`: kebab-case, prefixed by category (`aws-`, `net-`, `db-`, ...), globally unique across the
  *entire* library, not just the file — check with
  `grep -rn "'<the-id>'" js/data/categories/` before adding.
- Insert alphabetically by display **name** within the file — every existing category file is
  sorted this way; `componentData.test.mjs` doesn't enforce it, but keep the diff readable.
- Pick one emoji as `icon`. If a family of related items needs visual grouping (e.g. AWS regions
  by continent), varying the icon by sub-group is a nice touch, but keep it to 2-3 distinct icons,
  not one per item.
- A "container box" component (something other things get placed on top of, like `aws-vpc` or the
  AWS region boundaries) uses `shape: 'rect'` and a larger `defaultSize` (`w: 260-340, h: 180-240`
  is the established range) — there is no real parent/child nesting in this app, it's purely
  visual: components placed over it aren't actually attached to it in the data model. `opts.
  textPosition: 'top'` (see below) is worth adding for one whose caption would otherwise sit
  centered over the contents — `shape-group` ("Group / Container", `categories/shapes.js`) does
  this; the existing region/VPC boxes don't, and there's no need to retrofit them just because the
  option now exists.
- `opts.textPosition`/`opts.iconVisible: false` pin a *structural* default for this specific shape
  (e.g. "this container's caption always goes at the top", "this plain-frame shape has no icon"),
  overriding the user's global Default Settings the same way `shape`/`color`/`defaultSize` already
  do. Only reach for these when the default is inherent to the shape, not a style preference —
  most components should just leave them unset and let the global default (or a per-node override
  after placement) decide, exactly as before this option existed.

### Smart Suggestions (`related` / `relatedLayers`) — check this every time

After adding any new plain component, check whether it has an obvious, well-known real-world
companion **already in the library** — something you'd confidently draw next to it yourself,
not just something that could plausibly connect. Two separate curated lists, depending on what
kind of companion it is:

- `related: ['other-id', ...]` — another standalone **component** commonly placed *beside* this
  one (and, where it makes sense, the reverse pairing on the other component too — see
  `db-redis`/`db-postgres` in `databases.js` for a symmetric example, and `net-load-balancer` →
  `srv-nginx` in `networking.js` for a one-directional one where the reverse isn't as universally
  true).
- `relatedLayers: ['layer-id', ...]` — a `kind: 'layer'` id (see `categories/layers.js`) commonly
  used *as a sub-component of this specific component* (e.g. `be-express` → `layer-controller`,
  `layer-middleware`; `fe-react` → `layer-react-hook`, `layer-react-component`). Only makes sense
  for components that represent actual running code (a framework, a server, a gateway) — most
  components (a database, a queue, a cloud region box) have no natural "sub-component" and should
  just have an empty/omitted `relatedLayers`.
  - **This also applies to a `layers.js` entry itself** — a layer can carry its own
    `relatedLayers` pointing at *another* layer, and it works identically once that layer is
    dropped standalone (not attached onto something else). Reserve this for a named,
    textbook-recognized pattern-role pairing (GoF/DDD/Hexagonal), not a loose association: Adapter
    → Adaptee, Repository → Unit of Work, Context (Strategy role) → Strategy, Port (Hexagonal) →
    Adapter, Router → Controller. **Direction matters** — the entry goes on whichever role is the
    *container/wrapper*, pointing at what it holds (Adapter wraps an Adaptee, so `layer-adapter`
    points at `layer-adaptee`, never the reverse), the same "container → what it holds" direction
    every other `relatedLayers` entry already follows.

- `relatedPatterns: ['pattern-id', ...]` — a `kind: 'pattern'` id (typically one of the
  `data/categories/sequence-templates.js` templates) this component's placement should suggest
  instantiating nearby — e.g. `sec-oauth` → `seq-oauth-handshake`/`seq-pkce-flow`, `net-router` →
  `seq-tcp-handshake`/`seq-udp-exchange`. Only for a component genuinely central to that flow (an
  identity/auth component and an OAuth/SSO/MFA template; a networking component and a TCP/UDP
  template) — most components have no natural sequence-diagram pairing and should leave this
  unset.

Each powers its own row in the same "Smart Suggestions" banner (`canvas/suggestions.js`) offered
right after a component is placed — `related` companions show as one row of "+ Add X" buttons that
create a new node beside the placed one; `relatedLayers` show as a second row of "↳ X" buttons that
attach directly onto the node just placed instead (same effect as dragging that layer onto it);
`relatedPatterns` shows a third "🔀 Sequence diagrams for X" row whose buttons instantiate the whole
template positioned next to the placed node (`canvas.js#instantiatePatternNearNode`) — not attached
onto it, unlike a `relatedLayers` suggestion.

Bar to clear — skip it rather than force a weak pairing, for either list:
- The pairing should be something most engineers would nod at immediately (Load Balancer → a web
  server; Kafka → Elasticsearch for a log/event pipeline; API Gateway → Lambda; Express →
  Controller/Middleware; Django → Model/View, matching its actual MVT architecture). "Both are
  used in backend systems" is not specific enough, and neither is "every backend framework has
  *some* controller-ish thing" — only add `relatedLayers` for a framework whose canonical
  architecture genuinely centers that layer (Django really is Model-View-Template; a bare
  "Application Server" component is generic enough that Controller/Service is still a safe,
  textbook-level default, but a niche or special-purpose framework might not warrant one at all).
- Don't invent a new component (or layer) just to complete a pairing (e.g. there's no
  Zookeeper/Schema Registry in the library yet, so Kafka has no `related` entry pointing at
  either — that's correct, not a gap to force-fill).
- Keep each list short (2-3 ids) — curated, not exhaustive. Both only ever point at built-in ids
  (component ids for `related`, layer ids for `relatedLayers`), never at "My Components"/custom
  ones.
- **After adding/extending several `related` pairings in one batch, re-run the *full* e2e suite,
  not just tests for the component(s) you touched.** A plain-substring sidebar search (like
  `tests/e2e/helpers.js#addComponentByName`) can rank a component you just gave a new `related`
  list ahead of the one a test actually meant to place (e.g. searching "DNS" always matched both
  `net-dns` and `aws-route53`, tagged `dns`, with Route 53 ranking first — a "no companions" test
  using that search broke only once Route 53 *gained* curated companions in this exact kind of
  batch). Any test whose outcome depends on *which specific* component a fuzzy search lands on
  should use `tests/e2e/smart-suggestions.spec.js`'s own `addExactComponent(page, name,
  categoryLabel?)` helper instead.

`componentData.test.mjs` enforces that every `related` id resolves to a real component (no
self-references, no duplicates), every `relatedLayers` id resolves to an actual `kind: 'layer'`
component, and every `relatedPatterns` id resolves to an actual `kind: 'pattern'` component — run
it (see "Always finish with" below) after adding any of the three.

### `popular` — optional, and almost never for a brand-new component

`popular: true` in the `c(...)` call gives a component a subtle sidebar highlight (background
tint + ★ badge) marking it as one most engineers would immediately recognize as a common building
block in its category — see `js/data/schema.js`'s JSDoc for the exact wording. Same "would most
engineers immediately agree" bar as `related` above, and same "deliberately sparse" rule: a
handful per category, not a ranking of every item. In practice this almost never applies to a
component you're adding for the first time — a brand-new, unproven addition to the library is
rarely also one of the most universally-recognized in its category on day one. Reach for it only
when explicitly asked to highlight/promote specific existing components, not as a default
alongside every new `c(...)` call.

## A "layer" (attaches as a sub-component instead of standing alone)

Same `c()` call, add `kind: 'layer'`. See `js/data/categories/layers.js` for the full set — used
for code-level building blocks (Controller, Service, DAL, ...) that make more sense as an addition
to an existing node than as their own box.

## A design pattern (one-click multi-node blueprint)

```js
import { definePattern } from '../schema.js';
const n = (key, defId, dx, dy, label) => ({ key, defId, dx, dy, label });
const e = (from, to, label, extra = {}) => ({ from, to, label, ...extra });

definePattern('pattern-my-thing', 'My Thing Pattern', '🎯', {
  description: 'One line.',
  tags: ['architectural', 'whatever'],
  nodes: [
    n('a', 'existing-component-id', 0, 0, 'Label A'),
    n('b', 'existing-component-id-2', 200, 0, 'Label B'),
  ],
  edges: [e('a', 'b', 'calls')],
})
```

Rules:
- Every node's `defId` must resolve to a **real, already-existing** component or layer id
  somewhere in the library (built-in only — patterns can't reference "My Components").
  `componentData.test.mjs` enforces this and will fail the build if it doesn't.
- Every edge's `from`/`to` must be a `key` used in this same pattern's own `nodes` list (not a
  `defId`) — also enforced by the test.
- `dx`/`dy` are offsets in px from wherever the user drops/clicks the pattern — lay related items
  out left-to-right or top-to-bottom, roughly 150-250px apart so nothing overlaps at default size.
- Reuse the `twoWay`/`dashed` edge-style const helpers already defined at the top of
  `design-patterns.js` for bidirectional/dashed edges instead of repeating the raw options object.
- **No dedicated component for a concept the pattern needs?** Don't invent a new component just
  for one pattern — reuse the closest existing generic `defId` and override its node `label` to
  say what it actually represents. This library has no dedicated ZooKeeper/etcd/Consul
  coordination-service component, for example, so `pattern-leader-election` reuses
  `layer-service-discovery` labeled "Coordination Service (etcd/ZooKeeper)"; `pattern-cdc-pipeline`
  reuses the generic `misc-worker` labeled "CDC Connector (Debezium)"; `pattern-db-sharding` reuses
  `net-load-balancer` labeled "Shard Router (by Key)" since a shard router's job (route by a key)
  is functionally the same shape. Only add a new dedicated component (see "A plain component"
  above) if the concept is clearly reusable across future patterns too, not just this one.
- `groupOnInstantiate: true` makes a multi-node pattern land as a real group immediately (its
  members share a fresh `groupId` the moment it's instantiated) instead of a loose cluster the user
  would have to manually select-and-group — use it for anything meant to behave as one unit
  (e.g. every `sequence-templates.js` template, so its 🔍 zoom-in drill-down works right away).
- **A sequence-diagram template is a special case of this same mechanism** —
  `data/categories/sequence-templates.js`'s `lifelines()`/`msg()` local helpers build `nodes`/
  `edges` in the *raw* `{key, defId, dx, dy}` / `{from, to, overrides: {...}}` shapes directly,
  **not** via the `n()`/`e()` convenience helpers above — those don't forward `fromOffset`/
  `toOffset`, and every message in a sequence diagram needs a distinct one (0..1 down the
  lifeline) or they'd all land on the shared midpoint and stack on top of each other. Copy
  `sequence-templates.js`'s own pattern (and its `componentData.test.mjs` coverage asserting
  distinct offsets) rather than the `n()`/`e()` one when adding another sequence-diagram template.

## A whole new category

1. New file `js/data/categories/<name>.js`, same shape as the others (`export const category =
   {id, label, color}`, `export const components = [...]`).
2. Register it in `js/data/index.js` (the aggregator every other file already lists itself in).
3. Check the new category's items against the "Smart Suggestions" bar above — both for obvious
   pairings *within* the new category and between a new item and something already in the
   library (e.g. a new message-queue category's flagship product might pair with an existing
   monitoring/analytics component).
4. If it should be user-hideable (like State Machines), wire it into
   `js/io/librarySettings.js` + `js/sidebar/sidebar.js#HIDEABLE_CATEGORIES` +
   `js/modals/defaultSettingsModal.js` — see docs/AI_AGENT_GUIDE.md's row for that pattern. Most
   new categories don't need this; only add it if asked for.

## Always finish with

```bash
node --test tests/unit/componentData.test.mjs   # validates ids, defId/key references, required fields
npm run test:unit                                # full unit suite, in case a count-based test needs updating
```

Then continue with the repo's normal closing checklist — see the `release-checklist` skill (docs,
version, tests, merge) rather than treating a library addition as a silent, undocumented change.
