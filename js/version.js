// Single source of truth for the app version, shown in the "What's New"
// modal (see io/whatsNew.js). Bump APP_VERSION and add an entry here with
// every user-facing fix or feature — the modal shows entries newer than
// whatever version the visitor last saw.
export const APP_VERSION = '1.49.1';

export const VERSION_HISTORY = [
  {
    version: '1.49.1',
    date: '2026-08-31',
    highlights: [
      'Curated "Design Patterns" down from 32 to 26 entries — removed the most minimal/textbook ones (MVP, Singleton, Factory Method, Observer, Strategy, Adapter, Decorator, the two smallest ER examples, and standalone Circuit Breaker/Rate Limiting) and added richer, real-world scenarios: Change Data Capture (CDC) Pipeline, Database Sharding, Resilience Stack (Rate Limiter + Circuit Breaker), Leader Election, and a realistic multi-entity E-Commerce Order Schema.',
      'Curated "State Machines": removed Traffic Light, Media Player, and Approval Workflow (already covered by the BPMN category\'s Approval Process template); enriched Order Lifecycle (returns/refunds) and Auth Session (MFA, token refresh, lockout); added Circuit Breaker, Background Job Processing, and Payment Processing state machines.',
      'Fixed a Final State circle clipping longer labels like "Cancelled" or "Refunded" into an unreadable single-character column — the label now renders cleanly below the circle instead.',
    ],
  },
  {
    version: '1.49.0',
    date: '2026-08-31',
    highlights: [
      'New "🔤 Fix Text Display" (Tools menu) — re-spaces a busy sequence diagram\'s messages (or any diagram\'s overlapping labeled connectors) so text has room to display cleanly, without moving anything that doesn\'t need it. Edge labels now also wrap onto multiple lines instead of overflowing or hiding.',
      'New "📖 Show Descriptions" toggle (always-visible toolbar row) — shows every dropdown button\'s tooltip explanation inline, right under its label, instead of only on hover. Off by default; the tooltip itself is always still there.',
      'New "📖 Explain This Diagram" (right-click a component from any built-in library pattern/template, or its details panel) — an instant, offline, comprehensive explanation of that specific template: what it is, what each of its components does, and a numbered step-by-step read of how it works.',
      'Diagram Animation: new "+ Add All" button adds every remaining component and connector to the animation at once, and "Set all steps to: ⏱️ Auto-play / 🖱️ Click" changes every step\'s reveal mode in one click instead of one row at a time.',
      'New "🪄 Auto-Play Diagram" (Tools menu, or Ctrl/Cmd+K) — instantly builds a walkthrough animation from everything already on the canvas, in the order it was added, and starts playing it right away — no manual step-adding or configuration needed.',
    ],
  },
  {
    version: '1.48.0',
    date: '2026-08-30',
    highlights: [
      'The Tools menu (Tools ▾) now has a "Search actions..." box at the top — start typing to filter its 24+ buttons down to just what matches.',
      'Every section in the Tools menu (AI Tools, Analysis & QA, Layout Tools, ...) can now be collapsed with a click on its header, and stays collapsed the next time you open the menu.',
      'Filled in the one toolbar tooltip that was missing a real explanation ("🤖 AI Design Review" now says what it actually does).',
    ],
  },
  {
    version: '1.47.0',
    date: '2026-08-30',
    highlights: [
      'A new connector now guesses a sensible default label from what the two components actually are — "reads/writes" for a service into a database, "publishes to"/"delivers to" around a queue, "routes to" from a load balancer, and more — instead of always starting blank.',
      'Duplicating a component now auto-increments its name ("Auth Service" → "Auth Service 2") instead of leaving an identical-looking twin next to the original.',
      'The "⛶" zoom button now fits the current selection instead of the whole diagram once something is selected — handy once a diagram gets large and you only care about one subsystem right now.',
      'New "🔎 Find & Replace" (Tools menu, or Ctrl/Cmd+K) — renames a term across every component/connector label and notes field in one undoable step, instead of clicking into each one by hand.',
      'New "📌 Manage Pinned Toolbar Actions" (Ctrl/Cmd+K) — pin your most-used actions (anything ⌘K can already find) as always-visible toolbar buttons, in whatever order you like.',
      'New "🔔 Diagram Nudges" (on by default, Tools menu) — a quiet toolbar badge the moment "🔍 Check Diagram" would find something new, instead of only finding out once you remember to open it yourself.',
    ],
  },
  {
    version: '1.46.0',
    date: '2026-08-29',
    highlights: [
      'The "🤖 AI Chat" panel can now be resized — drag its left edge while docked to the side, its top edge while docked to the bottom, or its bottom-right corner while floating. The size you pick sticks across reopening the panel, independently for each dock mode.',
    ],
  },
  {
    version: '1.45.1',
    date: '2026-08-29',
    highlights: [
      'Fixed "🖥️ Working with CLI" (Help menu, or Ctrl/Cmd+K): a bare web address doesn\'t tell a CLI tool which file to fetch — there\'s no standard convention that makes it check `/llms.txt` just because it was handed a domain. The dialog\'s primary, first action is now a ready-made prompt that already names the exact file (`<address>llms.txt`); the bare address is still offered, but demoted to a secondary fallback for building your own request.',
    ],
  },
  {
    version: '1.45.0',
    date: '2026-08-29',
    highlights: [
      'New "🖥️ Working with CLI" (Help menu, or Ctrl/Cmd+K) — a dialog showing the exact, live address of this app instance to give an AI CLI tool, auto-detected from the page itself (not a guess), plus a ready-to-copy prompt telling the CLI where to start reading.',
      'New "🤖 AI Chat" (Tools menu, once Direct API mode or Local AI mode is set up) — a fast, in-app live chat with your configured AI, no copy/paste. Dock it to the side, pin it to the bottom, or drag it anywhere on screen as a floating card. It shares the exact same ongoing conversation as "🗨️ AI Conversation" — switch between hand-off and live chat mid-conversation without losing context. A reply can also propose a diagram update, previewed and applied inline the same way as Edit with AI.',
    ],
  },
  {
    version: '1.44.0',
    date: '2026-08-29',
    highlights: [
      'New "🗨️ AI Conversation" (Create menu, or Ctrl/Cmd+K) — an ongoing, reopenable back-and-forth about the current diagram instead of a one-shot prompt: every message you send carries the whole conversation so far (and the diagram\'s current state), so your AI — including an AI CLI tool run fresh each time from a terminal — never needs re-briefing. A reply can just be a plain answer, or also propose a diagram update (previewed and applied the same way as "💬 Edit with AI").',
      'The transcript persists across reopening the modal (it\'s a standalone browser setting, not part of the diagram itself, so it\'s excluded from JSON export/backup/duplicate-project) and can be cleared at any time.',
      'This is a documented protocol, not a live connection — this app has no server to keep a real, always-listening channel open to a CLI tool, so "awareness" works by re-sending the full history with every message rather than the AI remembering anything on its own. See `docs/AI_INTEGRATION.md`\'s "Continuing the Conversation" section for the exact format an AI/CLI tool should expect.',
    ],
  },
  {
    version: '1.43.0',
    date: '2026-08-29',
    highlights: [
      'New "🤖 AI / CLI Integration" guide (Help menu, or Ctrl/Cmd+K) — a standalone document at `docs/AI_INTEGRATION.md` written for an AI CLI tool (Claude Code, or any other AI agent) explaining exactly how to generate a diagram for this app and hand it back to you, with zero backend involved either way.',
      'A share link (🔗 Share) can now be built entirely outside this app by any tool that can run code — the guide documents the exact encoding with runnable Python/Node snippets, so an AI CLI tool can hand you a real, clickable link with no copy/paste at all.',
      '"Generate Design from Spec" and "AI Quick Start"\'s "paste the AI\'s result" step now also accepts a share link pasted as plain text (not just raw JSON) — whichever format an AI/CLI tool managed to produce works in the same box.',
      'Added a root-level `llms.txt` pointing AI tools that check for it at the new integration guide.',
    ],
  },
  {
    version: '1.42.0',
    date: '2026-08-28',
    highlights: [
      'A component\'s style controls now include four one-click "✨ Style Presets" (⭐ Primary, 🗑️ Deprecated, 🌐 External, ✨ Highlighted) that set fill, border, and shadow together in one click, instead of adjusting each field separately.',
      'New "Corner Radius" field for rectangle/rounded components — adjust how sharp or rounded the corners are, independent of the Shape dropdown.',
      'New "Border style" field (Solid/Dashed/Dotted) alongside the existing border color/width controls.',
      'New "Drop shadow" checkbox for a stronger, more elevated look on any component.',
      'New "Opacity" field (10-100%) — fade a component out, e.g. to mark something as planned or not-yet-built; independent of Focus Mode\'s own dimming.',
      'New S/M/L quick size buttons next to Width/Height for lining up several components to a consistent size at a glance.',
    ],
  },
  {
    version: '1.41.0',
    date: '2026-08-28',
    highlights: [
      'New "🧩 Feature Level" setting (Create → Default Settings) — Basic (recommended for new users), Advanced (show everything), or Custom, controlling how many of this app\'s many Create/Tools menu actions show up. Everything stays reachable through ⌘/Ctrl+K Quick Actions regardless of this setting, and nothing here ever touches your diagram.',
      'The Tools/Create/File dropdown menus now group their buttons under labeled sections (AI Tools, Diagram Types, Collaboration, Analysis & QA, Layout Tools, Visual & Presentation, Advanced Import/Export) instead of one long flat list.',
      'New compact sidebar mode (🗂️ button above the component library, or the same setting in Default Settings) — shows just Favorites, Recently Used and My Components by default; search still always looks everywhere.',
      'A first-time visitor now starts in Basic mode with a compact sidebar automatically; anyone who already had this app open keeps their exact existing toolbar/sidebar with nothing hidden.',
      'If you\'re in Basic mode, a small one-time nudge appears after a few sessions suggesting you explore the rest of this app\'s tools, with a direct link to the new Feature Level setting.',
    ],
  },
  {
    version: '1.40.0',
    date: '2026-08-28',
    highlights: [
      'New "🎯 Blast Radius" (right-click any component) — shows everything that would be affected if that component failed: what it feeds downstream, and what calls into it, purely from the diagram\'s own connectors.',
      'New "🎓 Interview Mode" (Tools menu) — practice a system-design interview question against an optional timer, then submit your diagram for AI feedback using this app\'s usual hand-off/direct/local AI setup.',
      'New "🔗 Import from URL/Gist" (File menu) — load a diagram JSON hosted elsewhere (a GitHub raw file link, a public Gist, or any URL returning this app\'s format) instead of only a local file.',
      'New "🗺️ System Map" (File menu) — a visual graph of every saved diagram and the links between them, so a system diagram can point at a related sequence diagram, DB schema diagram, or any other saved project.',
      'New "🧩 Export PDF (Poster)" (File menu) — splits a large diagram across several same-size printable pages (A4 or US Letter) to print and physically assemble into one big poster.',
      'New "📝 Review Status" (Tools menu) — a shared draft/in-review/approved label for a diagram, with who set it and when, for team workflows (not an access-control system — just a note for whoever else opens it).',
    ],
  },
  {
    version: '1.39.0',
    date: '2026-08-28',
    highlights: [
      'New "🎓 Demo Projects" (Create menu) — load a ready-made example diagram for each diagram kind this app supports (system diagram, sequence diagram, BPMN, UML Deployment, ER diagram, state machine, C4 Context), plus a "Combo" demo showing a system diagram and a sequence diagram together on one canvas. "🧹 Clear Canvas" sits right there too.',
      'The in-app user guide (help.html) now includes real screenshots alongside the writeups for several visually distinctive screens — the canvas, connectors, sequence diagrams, 3D Presentation, AI Design Review, Demo Projects, and the Command Palette.',
      'Fixed: a sequence-diagram lifeline in 3D Presentation Mode rendered as a giant, wildly out-of-proportion slab instead of a normal-looking component — it now renders as a tall pillar, sized like everything else in the scene.',
      'The Command Palette (Ctrl/Cmd+K) now includes every toolbar action and modal in this app — over a dozen were previously reachable only from the toolbar, including AI Quick Start, Import from Image, Edit with AI, C4 Context, Import from SQL, Template Gallery, Collaborate, Comments, Outline, AI Beautify Layout, Describe Diagram, Presenter Mode, Diagram Animation, Flow Simulation, 3D Presentation, Language, and What\'s New.',
    ],
  },
  {
    version: '1.38.0',
    date: '2026-08-27',
    highlights: [
      'New "🪄 AI Beautify Layout" (Tools menu) — asks an AI to suggest a nicer arrangement of your existing components, using its own judgement instead of a fixed algorithm; only positions change.',
      'Voice dictation: a 🎙️ mic button now appears on AI Quick Start, Generate Design, and Edit with AI\'s text fields wherever your browser supports it — dictate instead of typing.',
      'New "💬 Explain this diff with AI" button in Compare Versions, and "🤖 Ask AI to reduce this cost" in Cost Breakdown — both use the same hand-off/direct/local send flow as every other AI feature here.',
      'New "BPMN (Business Process)" and "UML Deployment" component categories, plus Switch, IDS/IPS, Network ACL, and Bastion Host in Networking. UML Deployment nodes render as a pseudo-3D "cuboid" box, the classic UML look.',
      'Keyboard-only editing: Tab to a component to select it, then press C and a number to draw a connector to another component — no mouse required.',
      'New "📃 Describe Diagram" (Tools menu) — an instant, offline plain-text summary of your diagram\'s structure, no AI involved.',
      '"🔍 Check Diagram" now shows a Health Score (0-100) based on how many findings it turned up.',
      'Diagram Versions can now be organized into lightweight branches — "🌿 Branch from here" and "🔀 Merge into..." on any saved version (an explicit "use this content" choice, not an automatic structural merge).',
      'New "🧊 3D Presentation" (Tools menu) — view the current diagram as a rotatable 3D scene for presenting: components become extruded, colored blocks with ambient "thinking" particles, connectors become animated cables color-coded by direction, and a "🎥 Export 3D Video" button records it (driven by your Diagram Animation, if one exists) to a downloadable video file.',
    ],
  },
  {
    version: '1.37.0',
    date: '2026-08-27',
    highlights: [
      'New "🪄 AI Quick Start" wizard (Create menu): describe your system in plain words and let AI propose a starting diagram — an optional nudge to set up an AI engine first, a natural-language description step, then a generated diagram you can keep editing, ending on a plain-language explanation of why it chose each component and that overall shape.',
      'New "🤝 Live Collaboration" (Tools menu): work on the same diagram with one other person in real time over WebRTC, no account or server — choose a fully offline manual code-exchange method, or a quick room-code method for a faster connect. A green toolbar badge shows when a session is connected.',
      'New "🖼️ Import from Image" (Create menu): reconstruct a diagram from a screenshot, exported image, or hand-drawn sketch, with AI help — same prompt-and-paste flow as Generate Design from Spec.',
      'AI Design Review gets a new "🛡️ Security" mode — a focused pass for public exposure, missing encryption, weak auth boundaries, exposed secrets, and missing audit logging, grouped by severity. Available even without an automatic AI connection, unlike Suggestions.',
      'Settings → AI Providers gets a "🔁 Auto-suggest" option: runs the "💡 Suggestions" check on its own in the background after a configurable number of diagram edits pile up — not a timer, so idle time never triggers it. A badge on the AI Design Review button shows when a background check found something.',
      'Export Diagram gains three new Infrastructure-as-Code targets: Pulumi (TypeScript), CloudFormation (YAML), and Kubernetes manifests — alongside the existing Terraform export.',
      'After an AI-generated diagram (Generate Design, Quick Start, or Import from Image) with 2+ components, you can now have it automatically build a "walkthrough" Diagram Animation revealing everything in the order it was generated — pick auto-advance (with your own timing) or click-to-advance.',
      'Diagram Animation can now export to a real .pptx (one slide per step, cumulatively revealing the diagram) or to a real video file — both from the "🎞️ Diagram Animation" panel.',
    ],
  },
  {
    version: '1.36.0',
    date: '2026-08-27',
    highlights: [
      'New "💡 Suggestions" mode in AI Design Review — once Direct API mode or Local AI mode is set up, get automatic, specific suggestions for this diagram (missing/relevant components, pricing considerations, other improvements) with no copy/paste round trip. A suggested component that matches something in the library gets a one-click "+ Add" button.',
    ],
  },
  {
    version: '1.35.0',
    date: '2026-08-27',
    highlights: [
      'New "🧩 Local AI" sending mode (Settings → "🤖 AI Providers"): runs a small open model (Llama 3.2, Qwen2.5) entirely inside your browser via WebGPU — no key, no account, and nothing ever leaves your device. The model downloads once (1.5-2.5 GB) and is cached by the browser after that, with a "⬇️ Preload model" button to fetch it ahead of time.',
      'A "🧩 Send to Local AI" button now appears alongside the existing hand-off and Direct API buttons in AI Design Review, Generate Design from Spec, and Edit with AI whenever Local AI mode is on — every option always stays available side by side.',
    ],
  },
  {
    version: '1.34.0',
    date: '2026-08-27',
    highlights: [
      'New "⚡ Direct API mode" for AI-assisted features (Settings → "🤖 AI Providers"): save an API key for Claude, Gemini, ChatGPT, or any other OpenAI-compatible endpoint so AI Design Review/Generate Design/Edit with AI can send the prompt straight to that provider instead of the copy/paste hand-off — the hand-off option always stays right there too, in case a direct call fails.',
      'Keys are stored only in this browser (never in project files or backups), with a clear on-screen security warning, a one-click "🗑️ Clear API Keys" button, and an automatic wipe of every saved key when switching back to Copy/Paste mode.',
    ],
  },
  {
    version: '1.33.0',
    date: '2026-08-26',
    highlights: [
      'Storage backend: everything this app stores (saved projects, backups, My Components, settings) can now live in IndexedDB instead of localStorage — configurable from "🗄️ Backup & Restore" (File menu), defaulting to localStorage. Switching always copies your data into the new backend first without deleting it from the old one, so you can switch back at any time.',
      'New "🔺 Export SVG" (File menu) — exports the diagram as a scalable vector image that stays crisp at any zoom, unlike PNG.',
      'New "🔎 Search All Projects" (File menu) — finds text across every saved project in this browser, not just the one currently open, with a snippet preview per match and a one-click "Load".',
      'Comments: a new 💬 Comments badge on the toolbar shows how many are still unresolved, and a new "Comments" list (Tools menu) shows every comment on the diagram at a glance, jump straight to one, or type @name in a reply to highlight a mention.',
      '"🔍 Check Diagram" findings can now offer a one-click "🔧 Auto-fix" — inserting a service layer between a client talking straight to a database, or a load balancer in front of unrouted replicas.',
      'Flow Simulation now also shows a small traveling dot along a Live Replication pair, in both directions, since replication has no drawn connector of its own to animate.',
      'New "🚀 Getting Started" checklist (Help menu) — a small dismissible card tracking a few first steps (add a component, connect two, save your diagram) for anyone just getting oriented.',
      'New "🖼️ Template Gallery" (Create menu) — browse every Reference Architecture and Design Pattern visually, each with a small preview thumbnail, instead of scanning the sidebar list.',
      'This app now works offline and can be installed as an app (PWA) — once you\'ve loaded it once, it keeps working (and autosaves) without a connection, and reconnects to sync in the background.',
      'New "📥 Import from SQL" (Create menu) — paste CREATE TABLE statements and get a real ER diagram: one entity node per table with its columns, and a labeled connector per foreign key.',
      'New "C4 Model" component category (Person, Software System, external variants, Container, Component, using the standard C4 color notation) plus a "🧩 C4 Context Diagram" wizard (Create menu) that bootstraps a System Context diagram from a system name and its users/external systems.',
    ],
  },
  {
    version: '1.32.0',
    date: '2026-08-26',
    highlights: [
      '💫 Flow Simulation: a new toolbar toggle animates small dots continuously flowing along every connector in its direction, to visualize traffic at a glance.',
      '💬 Edit with AI: describe a change in plain language ("add a Redis cache between the gateway and the database"), get a ready-to-paste prompt for your own AI chat, and preview + apply the returned patch as one undoable step — without disturbing the rest of your hand-placed layout.',
      '🔍 Check Diagram now supports team-authored custom rules ("⚙️ Manage Custom Rules") — require a connection between two component categories, forbid one, or cap how many of a category can appear — checked alongside the built-in structural checks.',
      'Pinned comments are now full discussion threads: add and remove replies under a note, which persist through export/import and duplicate-project.',
      '🌐 A new Language toggle (Tools menu) switches the toolbar, sidebar, and common dialogs to Hebrew with a right-to-left layout — the component library and help guide stay in English for now.',
    ],
  },
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
