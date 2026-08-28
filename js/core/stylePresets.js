// Quick, semantic one-click looks for a component — "Primary"/"Deprecated"/
// "External"/"Highlighted" — each a fixed bundle of the existing style
// fields (fill/stroke/strokeWidth/borderStyle/dropShadow/opacity), applied
// all at once via toolbar/styleEditor.js's `updateAll` (the same
// store.dispatch path every other style field already uses, so it's one
// undo step like any other edit). Deliberately not persisted as its own
// "which preset is this" field on the node — same reasoning as
// core/diagramTheme.js's palette recolor, which doesn't track "which
// theme" either: it's a one-time application of concrete values, not a
// live binding, so a preset's own definition can change later without
// silently reinterpreting every node that ever used it.
export const STYLE_PRESETS = {
  primary: {
    label: '⭐ Primary', fill: '#EEF2FF', stroke: '#4F46E5', strokeWidth: 3, borderStyle: 'solid', dropShadow: true, opacity: 100,
  },
  deprecated: {
    label: '🗑️ Deprecated', fill: '#F1F5F9', stroke: '#94A3B8', strokeWidth: 2, borderStyle: 'dashed', dropShadow: false, opacity: 60,
  },
  external: {
    label: '🌐 External', fill: '#FFFFFF', stroke: '#0EA5E9', strokeWidth: 2, borderStyle: 'dashed', dropShadow: false, opacity: 100,
  },
  highlighted: {
    label: '✨ Highlighted', fill: '#FEF3C7', stroke: '#F59E0B', strokeWidth: 3, borderStyle: 'solid', dropShadow: true, opacity: 100,
  },
};

export const STYLE_PRESET_IDS = Object.keys(STYLE_PRESETS);

/** The node-schema fields a preset sets (everything but its own display `label`), or null for an unknown id. */
export function getStylePresetFields(id) {
  const preset = STYLE_PRESETS[id];
  if (!preset) return null;
  const { label, ...fields } = preset;
  return fields;
}
