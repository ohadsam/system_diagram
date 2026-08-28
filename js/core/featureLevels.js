// Progressive disclosure for the toolbar's Create/Tools/File dropdowns —
// this app has accumulated a very large number of toolbar actions across
// many batches (dozens per dropdown), which is overwhelming for someone
// who just wants to draw a basic diagram. Every gate-able button belongs to
// exactly one "feature pack" (a themed group, e.g. "AI Tools" or "Visual &
// Presentation"); a small set of always-useful actions (New/Save/Load,
// basic exports, AI Quick Start, undo/redo, ...) is never gated at all and
// isn't part of any pack — see toolbar.js's own per-button pack
// assignments for the actual list.
//
// Three modes (io/featureLevelPrefs.js persists the choice):
//   - 'basic': no packs enabled — only the always-visible actions show.
//   - 'advanced': every pack enabled — identical to this app's behavior
//     before this system existed, so an existing visitor is never
//     regressed by this shipping (see io/firstVisitDefaults.js).
//   - 'custom': exactly the packs listed in `enabledPacks`.
// Pure and DOM-free by design (see tests/unit/featureLevels.test.mjs) —
// toolbar.js/sidebar.js/defaultSettingsModal.js do the actual DOM work.
export const FEATURE_MODES = ['basic', 'advanced', 'custom'];

export const FEATURE_PACKS = [
  { id: 'ai-tools', icon: '🤖', label: 'AI Tools', description: 'AI Design Review, AI Beautify Layout, Import from Image, Edit with AI.' },
  { id: 'diagram-types', icon: '🧩', label: 'Diagram Types', description: 'Sequence Diagrams, C4 Context, Replicate, and importing from Mermaid/SQL.' },
  { id: 'collaboration', icon: '🤝', label: 'Collaboration', description: 'Real-time Live Collaboration with another person.' },
  { id: 'analysis', icon: '🔍', label: 'Analysis & QA', description: 'Check Diagram, Cost Breakdown, Describe Diagram, Interview Mode, Review Status.' },
  { id: 'layout-tools', icon: '📐', label: 'Layout Tools', description: 'Auto-arrange, Distribute Evenly, Scale Diagram.' },
  { id: 'visual-extras', icon: '🎨', label: 'Visual & Presentation', description: 'Minimap, Focus Mode, Diagram Theme, Presenter Mode, Diagram Animation, Flow Simulation, 3D Presentation.' },
  { id: 'advanced-io', icon: '📦', label: 'Advanced Import/Export', description: 'Search All Projects, Open in New Tab, Import from URL/Gist, System Map, Export Poster/SVG/Terraform-etc., Share, Version History, Undo History, Presentations, Backup & Restore.' },
];

export const FEATURE_PACK_IDS = FEATURE_PACKS.map((p) => p.id);

/** Which pack ids are switched on for a given {featureMode, enabledPacks}. */
export function packsForMode(featureMode, enabledPacks = []) {
  if (featureMode === 'advanced') return [...FEATURE_PACK_IDS];
  if (featureMode === 'custom') return FEATURE_PACK_IDS.filter((id) => enabledPacks.includes(id));
  return []; // 'basic', or anything unrecognized — fail closed to the least-cluttered view
}

export function isPackEnabled(prefs, packId) {
  return packsForMode(prefs.featureMode, prefs.enabledPacks).includes(packId);
}

// Session-count milestones at which a Basic-mode user gets a one-time,
// dismissible nudge suggesting they unlock more tools — see
// io/usageStats.js for what's tracked and hints/featureSuggestionBanner.js
// for the UI. Spaced out (not just "session 2") so the nudge doesn't
// compete with the first-run hint tour, and repeats a few times (each
// dismissible) rather than a single ask, since someone who says "not now"
// once may still want it later once they've hit a wall a hidden tool
// would have solved.
export const SUGGESTION_MILESTONES = [3, 8, 15];

/**
 * @param {{featureMode: string, sessionCount: number, suggestionsShownAtSessions: number[], suggestionDismissedForever: boolean}} args
 * @returns {number|null} the milestone to show a nudge for, or null if none is due
 */
export function getDueSuggestionMilestone({ featureMode, sessionCount, suggestionsShownAtSessions = [], suggestionDismissedForever = false }) {
  if (featureMode !== 'basic' || suggestionDismissedForever) return null;
  const due = SUGGESTION_MILESTONES.find((m) => sessionCount >= m && !suggestionsShownAtSessions.includes(m));
  return due ?? null;
}
