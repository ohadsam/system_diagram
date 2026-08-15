// Global "new component" defaults (see docs/SPEC.md 4.2.5): applied when a
// node is created, always overridable per-node afterwards via the toolbar
// style editor / details panel. Persisted separately from any one project
// so they carry across diagrams.
import { readJSON, writeJSON } from './storage.js';

const KEY = 'nodeDefaults';

export const DEFAULT_NODE_DEFAULTS = {
  transparentFill: false,
  showIcon: true,
  textPosition: 'center',
  subComponentsDisplay: 'chips',
};

export function getNodeDefaults() {
  const stored = readJSON(KEY, {});
  return { ...DEFAULT_NODE_DEFAULTS, ...stored };
}

export function saveNodeDefaults(partial) {
  const next = { ...getNodeDefaults(), ...partial };
  writeJSON(KEY, next);
  return next;
}

/** Overrides to merge into core/project.js#createNode's `overrides` argument for a newly created node. */
export function buildCreationOverrides(defaults = getNodeDefaults()) {
  const overrides = {
    iconVisible: !!defaults.showIcon,
    textPosition: defaults.textPosition,
    subComponentsDisplay: defaults.subComponentsDisplay,
  };
  if (defaults.transparentFill) overrides.fill = 'transparent';
  return overrides;
}
