# System Design Diagram Builder — Specification (איפיון)

Status: v1.0 · Last updated: 2026-08-14

## 1. Purpose

A 100% client-side web application (static HTML/CSS/JS, no backend, no build
step) that lets software engineers and architects visually design system
architecture diagrams: drag predefined components (servers, databases, AWS
services, frameworks, etc.) onto a canvas, connect them with configurable
arrows, style everything, annotate with details, and export/share the result.
Hosted on GitHub Pages.

Audience: software developers, architects, engineers. Desktop-first, usable
on mobile.

Language: UI is English. This spec is in Hebrew/English mix for the project
owner; code/UI/comments are English only.

## 2. Non-goals

- No server, no accounts, no real-time collaboration.
- No build pipeline (no bundler/transpiler) — plain ES modules load directly
  in the browser so the site works by opening `index.html` or serving the
  repo root as-is (GitHub Pages).
- Two runtime dependencies loaded from CDN are allowed for export only:
  `html2canvas` (PNG export) and `jsPDF` (PDF export). Everything else is
  hand-written vanilla JS.

## 3. Core concepts

- **Project**: the whole diagram — nodes, edges, canvas viewport, metadata
  (name, id, createdAt, updatedAt).
- **Node**: a placed component instance on the canvas (position, size,
  shape, colors, text/label, icon, notes, sub-components, custom rows).
- **Edge / Connector**: an arrow between two nodes (or free points), with
  routing style (straight / orthogonal / curved), arrow-head style per end,
  color, thickness, dash pattern, label.
- **Component definition**: a predefined (or user-created) template in the
  library that a node is instantiated from (icon, default color/shape,
  category, optional default sub-components).

## 4. Functional requirements

### 4.1 Layout
- Left sidebar: search box + categorized, alphabetically sorted list of
  draggable component definitions. Collapsible category groups.
- Center: infinite pannable/zoomable canvas — the diagram surface.
- Top toolbar: global actions + contextual style editor for the current
  selection.
- Right slide-in panel: node/edge details (opens on click of a node's info
  affordance).

### 4.2 Component library (sidebar)
- Components grouped by category (AWS, Databases, Cache, Messaging,
  Monitoring, DevOps, Containers, Networking, Security, Storage, Servers,
  Client/Frontend, Frontend Frameworks, Backend Frameworks, Logging,
  AI/ML, AI Providers & Agents, Cloud Providers, Basic Shapes,
  Layers & Roles, Design Patterns, Misc).
- Categories sorted A→Z; components inside each category sorted A→Z.
- Search box filters across all categories by name/tag/description, with
  live highlighting and auto-expanding matched categories.
- Drag-and-drop (pointer-based, works with mouse & touch) from sidebar to
  canvas creates a node. Predefined sub-components (if any) are attached to
  the new node automatically.

#### 4.2.1 Layers & Roles
A `kind: 'layer'` item (Controller, Service, DAL, Authentication, React
Hook, Angular Guard, DDD building blocks, ~100 items total — see
`js/data/categories/layers.js`) represents a code-level building block
rather than an infrastructure component. Unlike other items:
- Dropping one **onto an existing node** attaches it as a sub-component of
  that node instead of creating a separate node (a green dashed outline
  previews the attach target while dragging).
- Clicking one while exactly one node is selected attaches it to that
  node the same way; otherwise (or when dropped on empty canvas) it's
  placed as a normal standalone node.
- The details panel's "Add sub-component" name field also autocompletes
  against this same library and auto-fills the matching icon — see 4.6.
- **Design decision**: this is one flat, richly-tagged, searchable
  category rather than a duplicate list nested under every top-level
  category. A layer like "Controller" or "Auth" is equally relevant to a
  Server, a Lambda, or an AWS ECS task, so one findable list (search +
  `tags` like `backend`/`frontend`/`ddd`/`security`) scales better than
  ~20 near-identical copies. Extending it is one line in `layers.js`.

#### 4.2.2 Design Patterns
A `kind: 'pattern'` item (MVC, Repository, CQRS, API Gateway, Circuit
Breaker, Saga, Hexagonal Architecture, plus a few classic GoF patterns
like Singleton/Observer/Strategy/Adapter/Decorator — ~24 total, see
`js/data/categories/design-patterns.js`) is not a single placeable
component. Dropping or clicking one instantiates a whole small cluster of
real nodes (each reusing an existing component/layer definition, so
styling stays consistent for free) plus the connectors between them, laid
out relative to the drop point and selected together afterwards so they
can be immediately restyled or moved as a group.

#### 4.2.3 AI Providers & Agents
A normal (`kind: 'component'`) category covering the generative-AI world:
model providers (OpenAI, Anthropic, Google, AWS Bedrock, Azure OpenAI,
Mistral, Cohere, Hugging Face, Ollama, ...), specific model families (GPT,
Claude, Gemini, Llama, Whisper, DALL·E, ...), the Model Context Protocol
(MCP Server/Client/Tool/Resource/Prompt), agents and agent frameworks
(LangGraph, AutoGen, CrewAI, Semantic Kernel, LlamaIndex, agent
memory/planner/orchestrator), and the skills/tools/RAG building blocks
around them (Skill, Skill Library, System Prompt, Prompt Template, RAG
Pipeline, Knowledge Base, Guardrails, Fine-Tuning Job, Function/Tool
Calling — ~57 items, see `js/data/categories/ai-providers-agents.js`).
Complements the existing **AI / ML** category, which stays focused on
general ML *infrastructure* (training pipelines, feature stores, vector
DBs, MLflow, ...) rather than duplicating it.

#### 4.2.4 Global default component settings
A "🎛️ Default settings" toolbar button opens a modal for defaults applied
when a component is **created**, always overridable per component
afterwards via the toolbar style editor / details panel:
- **No background color** — new components get a transparent fill instead
  of their category's tinted color (border/icon/text still show).
- **Show icon** — off hides every new component's icon.
- **Text position** — where the label renders: `Center`/`Top`/`Bottom`
  (inside the shape) or `Above`/`Below` (floating outside it, e.g. for a
  minimalist icon-only look with a caption).
- **Sub-components display** — `Compact chips` (default, small pills,
  truncated after 4) or `Full list` (every sub-component on its own row,
  untruncated) — also settable per node from its details panel next to the
  sub-components list, since it's really about *that* list's own display.
- **"Apply to all existing components now"** — besides saving the defaults
  for future components, explicitly bulk-updates every component already
  on the canvas to match (one undo step) — a deliberate, visible action
  rather than a silent retroactive global override, so "what changed" is
  always predictable, and per-component customization after that remains
  a normal single-node edit.

### 4.3 Canvas node interactions
- Drag to move, resize via handles, rotate not required.
- Delete via `Delete`/`Backspace`, right-click menu, or toolbar button.
- Right-click context menu: Edit style, Duplicate, Bring to front / send to
  back, Add note, Delete, Open details.
- Small on-node button opens full edit (style) and an "ⓘ" button opens the
  details side panel.
- A visible badge appears on any node that has notes, labels, or
  sub-components ("has extra info" indicator).
- Multi-select (marquee / shift-click) + group move + group delete.

### 4.4 Arrows / connectors
- Draw by dragging from a node's connection point to another node. Both
  ends must land on a component (no free-floating endpoints in v1 — see
  `PLAN.md` for that as a possible v2 idea).
- Style: color, thickness, dash pattern, routing (straight, orthogonal
  /elbow, curved/bezier), label text.
- Arrow-head per end independently: none, open, filled triangle, diamond,
  circle — and direction: source→target, target→source, bidirectional,
  none.
- Endpoints stay attached to nodes and re-route live when nodes move
  ("dynamic reshaping").

### 4.5 Toolbar
- Style controls for current selection: fill color, "no background"
  toggle, border color, border width/style, shape, text, font size, text
  align, text position, show-icon toggle, corner radius.
- Arrow style controls (see 4.4) shown when an edge is selected.
- Undo / Redo.
- Save (autosave to localStorage), Save As (named project), Load (from
  localStorage list or from a JSON file), Export JSON, Export PNG, Export
  PDF.
- "New component" modal — build a custom styled component from the current
  selection (or from scratch) and save it into "My Components" (persisted
  in localStorage; exportable/importable as JSON).
- "Add shape" modal — basic shapes as instant custom components: rectangle,
  rounded rectangle, circle/ellipse, diamond, hexagon, cylinder (DB shape),
  cloud, "server with rows" (a container node where the user defines and
  reorders internal rows/components), sticky note / text label, group
  container.
- Zoom controls + fit-to-screen + grid toggle.
- Help button opens `help.html` (interactive guide) in a new tab, and a
  "hints" toggle.

### 4.6 Node details panel
- Opens on demand (ⓘ button / double-click). Shows: name, icon/color
  summary, free-text notes, labels (tag chips), and an editable list of
  sub-components (name + icon, add/remove/reorder, plus a "compact chips
  vs full list" display-mode control — see 4.2.4). For "server with rows"
  nodes, this is also where rows are managed.
- **Collapse / expand**: a chevron button in the panel header shrinks it to
  a slim clickable strip (content hidden, selection/edits untouched) —
  distinct from the **✕ close** button, which fully closes it and clears
  the details context. Opening a different component's details always
  starts expanded.

### 4.7 Persistence
- Autosave current project to `localStorage` on every change (debounced).
- Manual Save / Save As keeps a named list of projects in `localStorage`.
- Export/Import full project as a `.json` file.
- "My Components" custom library persisted separately in `localStorage`,
  exportable/importable as its own `.json` file so it can be shared between
  browsers/machines.

### 4.8 Export
- PNG: rasterize the current canvas (or just the diagram bounds) to an
  image download.
- PDF: same content laid out on a PDF page (auto-orientation based on
  diagram aspect ratio).

### 4.9 Hints
- Short contextual hint bubbles near key UI (sidebar, canvas, toolbar).
  Each has a unique id; "Got it" dismisses it permanently
  (`localStorage`). A "Reset hints" action in Help brings them all back.

### 4.10 Responsiveness
- Desktop: full 3-pane layout.
- Mobile/tablet: sidebar and details panel become slide-over drawers
  toggled by buttons; toolbar collapses into a compact menu; touch drag
  works via pointer events.

## 5. Non-functional requirements

- **Security**: no `eval`/`innerHTML` with unsanitized input, no inline
  event handler attributes from data, JSON parsing wrapped in try/catch
  with schema validation before it touches state, file imports validated
  before merge, CDN scripts pinned to a specific version.
- **Performance**: event delegation over per-node listeners where possible,
  debounced autosave/persist, requestAnimationFrame-batched drag updates,
  virtual-friendly sidebar list (filter, not re-render everything from
  scratch when unnecessary).
- **Accessibility/UX**: keyboard shortcuts (Ctrl/Cmd+Z / Shift+Z, Delete,
  Ctrl/Cmd+S, Ctrl/Cmd+D duplicate), focus outlines, color-contrast aware
  default palette, tooltips on icon-only buttons.
- **Maintainability**: small single-purpose ES modules, no framework, no
  global mutable state outside `core/store.js`, one central pub/sub store,
  component data is pure data (no logic) so the library is trivial to
  extend.

## 6. Data model (JSON project format v1)

```jsonc
{
  "formatVersion": 1,
  "id": "proj_...",
  "name": "My Architecture",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [
    {
      "id": "node_...",
      "defId": "aws-ec2",
      "x": 100, "y": 80, "w": 160, "h": 90,
      "shape": "rounded",
      "fill": "#FFF7ED", "stroke": "#FF9900", "strokeWidth": 2,
      "text": "API Server", "fontSize": 14, "textAlign": "center",
      "icon": "🖥️",
      "notes": "", "labels": ["prod"],
      "subComponents": [{ "id": "sc_1", "name": "Auth", "icon": "🔐" }],
      "rows": [],
      "zIndex": 3
    }
  ],
  "edges": [
    {
      "id": "edge_...",
      "from": "node_a", "to": "node_b",
      "fromSide": "right", "toSide": "left",
      "routing": "orthogonal",
      "color": "#334155", "width": 2, "dash": "solid",
      "startArrow": "none", "endArrow": "filled",
      "label": "HTTPS"
    }
  ]
}
```

## 7. Out of scope for v1 (ideas for later, see PLAN.md §7)

Real-time multi-user collaboration, versioned history beyond in-session
undo/redo, cloud sync, PNG→SVG re-import, AI-assisted auto-layout.
