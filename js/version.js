// Single source of truth for the app version, shown in the "What's New"
// modal (see io/whatsNew.js). Bump APP_VERSION and add an entry here with
// every user-facing fix or feature — the modal shows entries newer than
// whatever version the visitor last saw.
export const APP_VERSION = '1.31.0';

export const VERSION_HISTORY = [
  {
    version: '1.31.0',
    date: '2026-08-26',
    highlights: [
      'Diagram Animation: a diagram can now hold several named, independent animations at once (a switcher in the panel — "+ New"/✎ Rename/🗑 Delete) instead of just one sequence.',
      'Diagram Animation: group several components/connectors into a single step that reveals them all together under one order number — check items in "Add more" and click "Add Selected", or right-click a multi-selection and choose "Add Selection to Animation".',
      'Diagram Animation: each step can carry a presenter-only note (📝), shown during playback but never part of the diagram itself.',
      'Diagram Animation: a per-animation "Auto-focus" toggle pans/zooms the canvas to frame each step as it reveals during playback.',
      'Diagram Animation: floating progress dots during playback jump straight to any step, and two new toggles — ⏩ Autoplay-to-end and 🔁 Loop — run the whole sequence unattended.',
      'Diagram Animation: a newly-revealed item briefly pulses during playback so it draws the eye.',
      'Diagram Animation\'s standalone export/import now covers every named animation on a diagram at once (old single-sequence export files still import correctly).',
      'Right-clicking an item that\'s part of a current multi-selection no longer collapses that selection first — useful beyond Diagram Animation too, anywhere a context-menu action should act on the whole selection.',
    ],
  },
  {
    version: '1.30.0',
    date: '2026-08-26',
    highlights: [
      'New "🎞️ Diagram Animation" (Tools menu) — build a numbered reveal sequence out of any components and connectors on the canvas, in a side panel showing each item\'s name and order; set each step to reveal automatically after a delay or only on a click/right-arrow. Right-click a component or connector for a quick "Add to Animation"/"Remove from Animation" shortcut, and a small numbered badge shows its place in the sequence right on the canvas.',
      '"▶️ Play Animation" enters a presentation view (reusing Presenter Mode\'s clean, chrome-free look) and reveals the sequence step by step — advance with →/N/a click, go back with ←/P, and Esc exits cleanly.',
      'Freeze the animation mid-presentation (D, or the 🖊️ button) to draw freely on top of the frozen diagram — handy for pointing things out live — then hit Done to clear the markup and resume.',
      'Export/import a diagram\'s animation sequence as its own JSON file, independent of the diagram itself, so a build order can be reused or shared separately.',
    ],
  },
  {
    version: '1.29.0',
    date: '2026-08-25',
    highlights: [
      'New "📋 Outline" panel (Tools menu) — a searchable, collapsible list of every component and connector on the canvas, doubling as a table of contents: click an entry to select and center it on the canvas, or select something on the canvas to see it highlighted in the list.',
      'New "🕘 Undo History" (File menu) — a visual timeline of every edit with an auto-generated label ("Added \'API Gateway\'", "Moved 2 components", ...); jump straight to any past point instead of pressing undo repeatedly.',
      'Export to Terraform: the "🌐 Export to..." modal (File menu) can now generate a starter Terraform (.tf) file for the AWS components on the canvas, with a resource block per mapped service and their connections noted.',
      'Diagram tabs: "🗂️ Open in New Tab..." (File menu) opens a second saved diagram — or a new blank one — alongside your current one, with a tab strip to switch between them without a full Load dialog each time.',
      'New "🖥️ Presenter Mode" (Tools menu) — hides the toolbar, sidebar and side panels for a full-bleed, distraction-free view when presenting a diagram; press Esc or the floating Exit button to come back.',
      'Large diagrams now render more smoothly — off-screen components no longer cost rendering time, with no change to exports, measurements, or "Fit to screen".',
      'Opening this diagram builder in a second browser tab now shows a warning, since both tabs share the same autosave and saved-project storage and editing in both at once can overwrite one tab\'s changes.',
    ],
  },
  {
    version: '1.28.0',
    date: '2026-08-25',
    highlights: [
      'Dark mode: the "Theme" toolbar button (Tools menu) now cycles Match System / Light / Dark — the whole app, including the canvas, restyles instantly and the choice is remembered.',
      'New "🎨 Diagram Theme" (Tools menu) — permanently recolors every component to one of several curated palettes (Ocean, Sunset, Forest, Monochrome, Pastel), keeping components that currently share a color grouped together in the new palette.',
      'Custom icon upload — any component\'s style editor now has an "Upload Image" button to use your own image as its icon instead of the built-in emoji/icon set.',
      'New "🧭 Minimap" (Tools menu) — a small overview map in the corner of the canvas showing every component as a tiny rect plus a "you are here" box; click or drag on it to jump the main view anywhere.',
      'New "🔦 Focus Mode" (Tools menu) — dims every component except the current selection and its directly-connected neighbors, useful for tracing one part of a large diagram.',
      'Connectors can now be manually reshaped: drag the small handles that appear along a selected connector to add and move bend points; right-click a bend point (or the connector itself) to remove it.',
      'New pinned comments — right-click empty canvas and choose "Add comment here" to drop a note pin anywhere; click a pin to edit its text or mark it resolved. Pins are included in "Fit to screen" and PNG/PDF export.',
      'Accessibility: selected components can now be nudged with the arrow keys (1px, or 10px with Shift), every icon-only toolbar button (undo/redo/zoom/fit) has a real accessible name for screen readers, and the command palette\'s search box keeps a visible focus ring instead of suppressing it.',
      'Fixed: the floating contextual style row could render partly hidden behind the new minimap when the selected component was near the bottom-right corner of the canvas.',
      'Fixed: opening a toolbar dropdown (File/Create/Tools/Help) while the sidebar drawer was open on a narrow/mobile screen could render the dropdown\'s menu items behind the drawer instead of on top of it.',
    ],
  },
  {
    version: '1.27.0',
    date: '2026-08-25',
    highlights: [
      'Diagram Versions: save named snapshots of a diagram ("📸 Version History", File menu), revert to one, or compare any two side-by-side (added/removed/changed nodes and edges).',
      'Presentations: build a slideshow out of saved versions ("🎬 Presentations", File menu), play it step-by-step with rendered slide images, and export the whole thing to a real .pptx file.',
      '5 new "Design X" reference-architecture templates (Reference Architectures category) for interview prep — URL Shortener, Chat Application, Rate Limiter Service, Social Media Feed, and Ride-Sharing Dispatch — each a complete, ready-to-customize starting point that instantiates as one grouped cluster.',
      'New Command Palette ("⌘" toolbar button or Ctrl/Cmd+K) — search every app action or add any component from one box; selecting a component first shows actions relevant to it (its curated companions, sub-components, duplicate/delete) ahead of general results.',
      'Estimated monthly cost: set a $/mo estimate on any component (details panel) — shown as a badge on the component and rolled into a running total ("💰 Cost Breakdown", Tools menu).',
      'Labels (details panel) now render as visible chips on the component face itself, not just in the details panel — handy for capacity/SLA tags like "10K RPS" or "99.9% SLA".',
      'Smart alignment guides: dragging a component now snaps into exact alignment with nearby components\' edges/centers and shows a Figma-like guide line, on by default ("🧲 Snap Guides" toggle, Tools menu).',
    ],
  },
  {
    version: '1.26.0',
    date: '2026-08-25',
    highlights: [
      'UML combined fragments: added "critical" and "break" to the existing Alt/Opt/Loop/Par set.',
      'Sequence diagram "📋 Copy as Mermaid"/"📋 Copy as PlantUML" now wrap lifelines overlapping a "Group / Container" shape in a labeled swimlane box.',
      'Right-click a lifeline-to-lifeline message and choose "Set sequence number..." to manually override its auto-computed badge number for the rare case the auto order doesn\'t match intent ("Clear sequence number override" to go back to automatic).',
      'New "🌐 Export to..." (File menu) — sends the whole diagram (not just a sequence diagram) to another tool: copy or open as a Mermaid flowchart, download a .drawio file for draw.io/diagrams.net, or download the same file for Lucidchart\'s importer — each with a one-click "Open X" link to the tool itself.',
      'New "🔗 Share" (File menu) — generates a link that encodes the whole diagram in the URL itself (no backend, nothing uploaded); opening it loads a local, independently-editable copy for whoever opens it.',
      'AI Design Review panel: a "🔍 Review" / "💬 Explain" toggle — Explain mode asks the AI for a plain-language walkthrough of the diagram instead of critique/feedback.',
      'New "🔍 Check Diagram" (Tools menu) — instant, offline structural checks (a client talking straight to a database, an unconnected component, a replication pair with no load balancer routing to it) with clickable findings that jump to the component involved. Complements "🤖 AI Design Review" rather than replacing it.',
      '3 new ER-diagram design patterns (Design Patterns category): One-to-Many Relationship, Many-to-Many with Join Table, and a Self-Referencing Relationship — each using the existing "rows" component shape for primary/foreign-key attribute lists.',
      'New "Recently Used" sidebar section, pinned above the component categories — shows the last 8 components you actually placed on the canvas, most recent first.',
    ],
  },
  {
    version: '1.25.0',
    date: '2026-08-25',
    highlights: [
      '13 more Sequence Diagram Templates: Two-Phase Commit, Outbox Pattern, Event Sourcing/CQRS Command Flow, gRPC Unary Call, GraphQL Query Resolution, Presigned URL File Upload, Kafka Consumer-Group Rebalance, Distributed Lock Acquisition, Service Mesh mTLS Handshake, Blue-Green/Canary Deployment Traffic Shift, DNS Resolution Flow, Social/Federated Login, and Step-Up Authentication.',
      '"📥 Import from Mermaid" (Create dropdown) — paste Mermaid sequenceDiagram text and it becomes a real, grouped set of lifelines and messages (including activate/deactivate, destroy, and alt/opt/loop/par), the inverse of "📋 Copy as Mermaid".',
      '"📋 Copy as PlantUML" alongside the existing "📋 Copy as Mermaid" button in a sequence diagram\'s drill-down view — a second export format.',
      'Hovering a Sequence Diagram Templates item in the sidebar now shows a small preview thumbnail of its lifelines and messages before you drop it in.',
      'More components suggest a relevant sequence-diagram template in the Smart Suggestions banner: gRPC Service, GraphQL Server, Apache Kafka, Redis Cache, DNS, Service Mesh, S3, and Spinnaker.',
    ],
  },
  {
    version: '1.24.0',
    date: '2026-08-25',
    highlights: [
      '10 more Sequence Diagram Templates: Password Reset Flow, Passwordless Magic Link Login, WebAuthn/Passkey Authentication, OAuth Client Credentials (M2M), WebSocket Handshake & Messaging, Webhook Delivery with Retry, Circuit Breaker Pattern, Cache-Aside Pattern, Saga Pattern (Choreography), and Idempotent Request Handling.',
      'New "WebSocket Server" component (Networking).',
      'More components now suggest a relevant sequence-diagram template in the Smart Suggestions banner: Redis Cache, WebSocket Server, Email Service, Webhook, Payment Gateway, Circuit Breaker, Saga Coordinator, plus expanded suggestions on OAuth/OIDC, SSO, Identity Provider, and API Key.',
    ],
  },
  {
    version: '1.23.0',
    date: '2026-08-24',
    highlights: [
      'Sync/async/return message presets in the arrow style editor for a lifeline-to-lifeline message — one dropdown sets dash + arrowhead together instead of two separate fields.',
      'UML "destroy" marker for a lifeline — right-click it and choose "Mark destroyed here" to drop an X where it terminates (its dashed line stops there too); "Clear destroy marker" removes it.',
      'UML activation bars — right-click a lifeline and choose "Add activation bar" for a draggable execution-occurrence rectangle: drag its body to move it, drag either end to resize it, right-click it to remove it.',
      'UML combined fragments — four new "Fragment" shapes (Alt/Opt/Loop/Par) in Sequence Diagram Templates: a resizable labeled box with a pentagon operator tag, for enclosing a group of messages under a condition.',
      '"📋 Copy as Mermaid" in a sequence diagram\'s drill-down view — copies the diagram (including activation bars, destroy markers, and any overlapping fragment boxes) as Mermaid `sequenceDiagram` text.',
      '10 new Sequence Diagram Templates: PKCE Authorization Flow, SCIM User Provisioning, MFA Challenge, RBAC/ABAC Authorization Checks, SSO (SAML/OIDC), SPA Silent Token Refresh, API Key Authentication, TCP 3-Way Handshake, and UDP Request/Response.',
      'Components like OAuth/OIDC, SSO, Identity Provider, API Gateway, JWT, API Key, Cognito, React, and Router now suggest a relevant sequence-diagram template in the Smart Suggestions banner when placed, and a template can be dragged from the sidebar directly onto an existing node to instantiate it positioned next to that node.',
    ],
  },
  {
    version: '1.22.0',
    date: '2026-08-24',
    highlights: [
      'Sequence diagrams: a lifeline can now message itself (renders as a small loop), an existing message can be reconnected to a different height or lifeline by dragging its endpoint handles instead of deleting and redrawing it, and "↔️ Distribute Evenly" (Tools menu) re-spaces a diagram\'s lifelines and messages evenly while keeping their order.',
      'New "🔍" zoom-in on a grouped sequence diagram — click the icon on its background for a read-only zoomed preview (or "📌 Pin to side panel" to dock it), with an "✏️ Edit" button to open it for real editing that saves back into the main diagram.',
      'Live Replication now mirrors connectors too, not just components — a message drawn between two already-mirrored components (e.g. two paired sequence-diagram lifelines) automatically mirrors to the other side.',
      'New "📐 Scale Diagram" (Tools menu) — permanently resizes every component and its text together by a chosen percentage, unlike zooming the view which never touches the underlying data.',
      'Connector labels can now be positioned near the start, middle, or end of the connector (arrow style editor), and a connector\'s notes now show as a hover tooltip on the connector itself.',
      'AI Design Review and Generate Design from Spec are now sequence-diagram-aware: reviewing one asks flow-specific questions (call order, missing responses, race conditions) instead of the generic architecture checklist, and generating one can produce a proper sequence diagram (lifelines + timed messages) when the request calls for it.',
    ],
  },
  {
    version: '1.21.0',
    date: '2026-08-24',
    highlights: [
      'New "🔀 Sequence Diagram" wizard (Create menu) — name a set of participants (Client, Server, Database, ...) and get a titled vertical "lifeline" for each, evenly spaced. Drag between two lifelines to draw a message at whatever height represents when it happens — several messages on the same lifeline no longer land on top of each other, and messages between two lifelines are automatically numbered (1, 2, 3...) in the order they occur.',
      'Right-click a connector and choose "Open details" for a new right-side panel with an editable label and free-form notes — handy for annotating a sequence-diagram message, but works on any connector.',
      '"🗺️ Auto-arrange" now leaves a sequence diagram alone (with an explanatory toast) instead of scrambling its manual left-to-right layout.',
    ],
  },
  {
    version: '1.20.0',
    date: '2026-08-20',
    highlights: [
      'New "🧹 Clear canvas" action (right-click empty canvas) — deletes every component and connector in one step and starts fresh, with a confirmation first. Unlike "🆕 New" (which switches to a brand-new project), this clears the current project in place, and Ctrl/Cmd+Z genuinely brings everything back afterward.',
    ],
  },
  {
    version: '1.19.0',
    date: '2026-08-20',
    highlights: [
      'Database cylinder shapes no longer show stray vertical lines poking above the cap.',
      'Fixed the "✨ Smart Suggestions" banner staying stuck on a previous component instead of updating (or hiding) for whatever you just placed.',
      'New "★ Popular only" sidebar filter — narrows the component library to just the commonly-used, ★-marked building blocks in each category.',
      'PNG export no longer crops a large or heavily-connected diagram — it now accounts for connector routing and above/below labels that extend past every component\'s own box, and downscales automatically if the diagram is extremely large.',
      'Right-click a component and choose "🔁 Join replication..." to add it to an existing replication pair directly, instead of having to open the Replicate modal and select it there yourself.',
      'New dismissible background boundary behind any multi-component group or replication side, so it reads as one unit at a glance — right-click-free, just hover it and click ✕ to hide (the group itself is unaffected).',
      'The "Group / Container" basic shape now captions itself at the top instead of centering its label over whatever gets placed inside it, and starts larger by default.',
      'Removed the "🪄 Magic Arrow" toolbar toggle — every connector already routes around obstacles by default now, so arming it first never did anything extra. The magic routing style itself is still available per-connector from the arrow editor\'s Routing dropdown.',
    ],
  },
  {
    version: '1.18.1',
    date: '2026-08-20',
    highlights: [
      'Database/cache components (PostgreSQL, Redis, MongoDB, and every other "Cylinder (DB)"-shaped component) now render as a proper cylinder — an elliptical top cap with a visible seam line, straight sides, and a curved bottom — matching the classic database icon used in most system-design diagrams, instead of the previous barely-rounded box. Also gave AWS ElastiCache the same cylinder shape as its sibling database services, since it\'s a managed Redis/Memcached store.',
    ],
  },
  {
    version: '1.18.0',
    date: '2026-08-18',
    highlights: [
      '21 more curated "✨ Smart Suggestions" sub-component pairings, including — for the first time — layers suggesting *other* layers when placed standalone: Repository suggests a Unit of Work, Adapter suggests an Adaptee, Router suggests a Controller, Port (Hexagonal) suggests an Adapter, Context suggests a Strategy, and more textbook design-pattern-role pairings. Also added an Inference Endpoint → Controller/DTO pairing and Istio → Sidecar Proxy.',
    ],
  },
  {
    version: '1.17.0',
    date: '2026-08-18',
    highlights: [
      '23 new curated "✨ Smart Suggestions" sub-component pairings — e.g. AWS Lambda and Serverless Function both suggest a Handler; Gin, Fiber and Actix (Go/Rust) suggest a Handler + Middleware; FastAPI suggests a Validator + DTO; Service Mesh suggests a Sidecar Proxy; a Cron Job suggests a Scheduler; Step Functions and the Multi-Agent Orchestrator both suggest an Orchestrator; Next.js, Nuxt, Preact and Remix now suggest the same sub-components their underlying library (React/Vue) already did.',
    ],
  },
  {
    version: '1.16.0',
    date: '2026-08-18',
    highlights: [
      'Any component with unattached "✨ Smart Suggestions" sub-components (like Express\'s Controller/Middleware) now shows a small 💡 badge — click it to open the details panel\'s new "Suggested sub-components" section, check off any number of them, and attach them all at once. Works any time, not just right after placing the component.',
    ],
  },
  {
    version: '1.15.0',
    date: '2026-08-17',
    highlights: [
      'Accepting a "✨ Smart Suggestions" companion now draws the connecting arrow between the two components automatically, in the right direction, and places the new one in a sensible spot relative to the original — previously it just dropped in unconnected.',
      'New "🗺️ Auto-arrange" (Tools menu) — rearranges every component on the canvas into a clean top-to-bottom layout that follows your connectors\' direction, and reconnects every arrow along the shortest sensible path.',
      'Every newly-drawn connector now automatically picks the most sensible side of each component to anchor on (regardless of which exact point you dragged from) and routes around any component in the way — previously this "smart routing" only applied when Magic Arrow mode was explicitly turned on.',
      'The component library now highlights the most commonly-used components in each category (PostgreSQL, Docker, S3, Kafka, React, and more) with a subtle background tint and a ★ badge, to help you spot a familiar building block faster in a long list.',
      'New "⭐ Favorites" — right-click any component and choose "Add to Favorites" to pin it to a new Favorites section at the top of the sidebar; organize favorites into folders and subfolders, reorder them, rename or delete folders, all from the same right-click menu.',
    ],
  },
  {
    version: '1.14.0',
    date: '2026-08-17',
    highlights: [
      'Expanded ✨ Smart Suggestions with ~90 new curated component/sub-component pairings across AWS, AI Providers & Agents, AI/ML, Containers, Monitoring, Security, and more — e.g. an ECS Cluster now suggests ECS Service (→ ECS Task), SNS suggests SQS, an AI model provider suggests its own flagship model, and a RAG Pipeline suggests a Vector Database, Reranker and Knowledge Base.',
    ],
  },
  {
    version: '1.13.1',
    date: '2026-08-17',
    highlights: [
      'Fixed: a sub-component row in the details panel (and the "New Component" modal) rendered its icon field at the full row width, pushing the name field and the "×" remove button off the edge of the panel — both are now correctly sized and reachable again.',
      'Fixed: diamond and hexagon components rendered with no visible border and a completely hidden icon/label — their fill layer was painting on top of the content instead of underneath it.',
    ],
  },
  {
    version: '1.13.0',
    date: '2026-08-16',
    highlights: [
      'New "🔎 Find on canvas" search box in the toolbar — searches components and connectors already placed in your diagram by name/label (separate from the sidebar\'s library search), selecting and centering the view on each match; press Enter to cycle through the rest.',
      'Fixed: on mobile, panning/scrolling inside the canvas could make components flicker or vanish mid-drag — the canvas now fully owns single-finger touch gestures instead of the browser\'s native scrolling fighting over them.',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-08-16',
    highlights: [
      'New: the style editor row (shown when a component/connector is selected) can now float as a small card next to the selection instead of always pushing the toolbar/canvas — click 📌 on it to pin it to the top of the screen instead, or set your preferred default (floating, pinned to top, or pinned to bottom) in "🎛️ Default Settings".',
      'Fixed: the diamond and hexagon shapes\' border didn\'t follow their actual outline — it now hugs the shape correctly, matching every other shape.',
      'Fixed: adding two components in a row (via sidebar click or "Add Shape") without moving either one could leave the first one stuck exactly underneath the second, unable to be clicked — the newer one now nudges out of the way automatically.',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-08-16',
    highlights: [
      'Fixed: text/number/color fields in the style editor and details panel (rename, notes, sub-components, ...) lost focus after every keystroke, making it impossible to type fluently.',
      'Fixed: double-clicking a component only started renaming it if you clicked precisely on the label text — clicking its icon or empty padding now works too.',
      'New: the details panel can now be resized by dragging its left edge.',
      'Fixed: adding a sub-component in the details panel could become unclickable or require scrolling, and a newly-picked name could end up missing (only its icon showing) — both were caused by the same focus/scroll-reset bug above.',
      'Fixed: the details panel now closes when you click elsewhere or deselect, and switches to a newly-selected component instead of continuing to show a stale one.',
      'Fixed: the toolbar\'s contextual style row jumping the whole canvas down when a component/connector is selected now fades in smoothly instead of an abrupt size jump.',
      'Fixed: "Toggle Grid" (Tools menu) previously did nothing — a CSS rule was silently overriding the canvas background regardless of the toggle.',
      'Fixed: expanding/collapsing a sidebar category reset your scroll position back to the top.',
      'Fixed: right-clicking a connector was missing "Duplicate" (already available for components).',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-08-16',
    highlights: [
      'Smart Suggestions: more curated companion pairings (Filebeat→Logstash→Elasticsearch→Kibana, ArgoCD→Kubernetes, Jenkins→Docker, OAuth→JWT, WAF→CDN, Datadog→PagerDuty, Istio↔Envoy, and more).',
      'Smart Suggestions can now also suggest sub-components to attach directly onto the component you just placed — e.g. Express suggests a Controller/Middleware, React suggests a Hook/Component, API Gateway suggests Authentication/Rate Limiter. One click attaches it, same as dragging it from "Layers & Roles".',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-08-16',
    highlights: [
      'New "✨ Smart Suggestions" — placing a component with a well-known real-world companion (e.g. a Load Balancer → a web server; Kafka → Elasticsearch; an API Gateway → Lambda) shows a small dismissible banner with one-click "+ Add" buttons for each one. Can be turned off from "🎛️ Default settings" → "Component library".',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08-16',
    highlights: [
      'The toolbar\'s style-editor row (shown when a component/connector is selected) now has a header: a ›/‹ button collapses it down to a slim strip without losing your selection — frees up most of the screen, especially useful on mobile — and a ✕ button deselects outright. Previously the only way to dismiss it was clicking empty canvas or pressing Escape.',
      'Fixed: a long component name could overflow the toolbar on a narrow screen instead of truncating with "…".',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-08-16',
    highlights: [
      'Moved "🔷 Add Shape" and "🪄 Magic Arrow" out of the Create/Tools dropdown menus back to the always-visible toolbar row — both are used too often while actively drawing a diagram to be worth a dropdown click.',
      'Fixed: a toolbar dropdown menu (File/Create/Tools/Help) could render partly off-screen on a narrow/mobile viewport instead of staying fully visible.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-08-16',
    highlights: [
      'New navigation tools: 🖱️ Select and ✋ Hand (pan-anywhere without moving components) toolbar toggle, with H/V keyboard shortcuts and hold-Space-to-pan.',
      'New "⭐ Save as Component" — turns any selection of components (and the connectors between them) into a reusable "My Components" item, with or without grouping them first; drop it again anywhere to recreate the whole group, styled exactly as saved.',
      'Toolbar reorganized into File/Create/Tools/Help dropdown menus, plus a shorter always-visible row (undo/redo, Select/Hand, zoom) — keeps things findable as more actions are added instead of the row growing indefinitely.',
      'Every toolbar button now has a clear, descriptive tooltip.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-08-15',
    highlights: [
      'Replicate: added ❄️ Freeze / ▶️ Resume per pair — while frozen, either side can be edited (or a new component added) without it reaching the other side; resuming picks syncing back up from that point on.',
      'AWS: added 12 Region components (US East/West, Canada, Europe, Asia Pacific, South America) for depicting multi-region architectures, plus a CloudFront Edge Location component.',
      'New 🔔/🔕 toolbar button to show or hide hint bubbles at any time, separate from "Show hints again" (which restarts the whole tour).',
      'Fixed: a toolbar button group with several full-text buttons could force the whole page into horizontal scroll on a narrow phone instead of wrapping.',
      'Fixed: the sidebar, details panel and AI review panel drawers could render starting partway through the toolbar instead of below it on mobile, once the toolbar wrapped onto more than one row.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-15',
    highlights: [
      'AWS: added EKS Cluster, EKS Node Group, Pod (EKS), ECS Cluster, ECS Service and ECS Task components.',
      'Design Patterns: added 5 high-availability blueprints — Active-Active Replication, Active-Passive Replication (Primary-Standby), Multi-AZ Deployment, Read Replica, and Multi-Region Active-Active.',
      'New "🔁 Replicate" — link a selection to a live-mirrored second side (Active-Active / Active-Passive / Primary-Replica). Add a component to either side and it automatically appears on the other; move, resize, restyle or rename a mirrored component and its peer follows; delete one and its peer goes too. Any single component can be marked "Exclude from replication" (in its details panel) to opt out.',
      'Hardened validateProject() to also validate/repair a project\'s replication-pair data on import, and duplicateProject() to correctly remap it when cloning a project.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-15',
    highlights: [
      'New "🧠 Generate Design" — the reverse of AI Design Review: paste or load a spec, get a schema-aware prompt (with links to Claude/ChatGPT/Gemini/Copilot) to hand to an AI, then paste its reply back in and it\'s imported straight onto the canvas as real, editable components.',
      'JSON import (including the new Generate Design paste-back) now keeps every node and connector even if it\'s missing an id, instead of silently dropping it.',
      'Fixed: a multi-step modal that changes size between steps (like the new wizard) could close itself unexpectedly when clicking a button near the edge of the shrinking dialog.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-15',
    highlights: [
      'New "Duplicate Project" (📄) — clone the whole diagram into a new, independent project in one click; the original stays exactly as it was.',
      'New "Duplicate entire canvas" (right-click the canvas) — copies every component and connector in place, within the same project.',
      'New "🤖 AI Design Review" panel — prepares a review prompt and your diagram as an image, then opens Claude/ChatGPT/Gemini/Copilot\'s own website (no API key or setup needed) so you can paste them in and get a review; optionally attach a spec file to compare against, and paste the AI\'s reply back into the panel to keep it with your project.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-14',
    highlights: [
      'New "What\'s New" screen (this one!) that appears once after each update.',
      'New "State Machines" component category: states, transitions and conditions, plus ready-made templates (traffic light, order lifecycle, TCP states, and more).',
      'Zoom in/out/reset now also works from the keyboard (Ctrl/Cmd + "+"/"-"/"0"), alongside the existing buttons and Ctrl/Cmd+scroll.',
      'Select multiple components and connectors together to edit, duplicate, or delete them as one — plus a new Group/Ungroup action.',
      'New "🪄 Magic Arrow" — an auto-routed connector that finds its own path between two components, automatically avoiding every other component in the way.',
      'Confirmed: deleting a component always removes every connector attached to it, with no leftovers.',
    ],
  },
];
