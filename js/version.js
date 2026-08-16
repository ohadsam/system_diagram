// Single source of truth for the app version, shown in the "What's New"
// modal (see io/whatsNew.js). Bump APP_VERSION and add an entry here with
// every user-facing fix or feature — the modal shows entries newer than
// whatever version the visitor last saw.
export const APP_VERSION = '1.12.0';

export const VERSION_HISTORY = [
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
