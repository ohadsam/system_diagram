// User-defined structural rules, layered on top of the built-in checks in
// core/diagramLint.js (see that file's header for why the built-ins are
// deliberately narrow) — a team can encode its own conventions ("every
// Cache component must connect to something in Backend Frameworks", "no
// more than 3 Databases on one diagram") without editing app code.
// Persisted in localStorage like customComponents.js's list, separate from
// any one project since a rule is a standing policy, not diagram content.
import { readJSON, writeJSON } from './storage.js';
import { nextId } from '../core/id.js';

const KEY = 'customLintRules';
const MAX_RULES = 50;

export const RULE_TYPES = ['requires-connection', 'forbidden-connection', 'max-count'];

export function getCustomLintRules() {
  return readJSON(KEY, []);
}

function persist(list) {
  writeJSON(KEY, list.slice(0, MAX_RULES));
}

/** @param {{name?:string, type:string, categoryA:string, categoryB?:string, max?:number, enabled?:boolean}} def */
export function saveCustomLintRule(def) {
  const list = getCustomLintRules();
  const id = def.id || nextId('lintrule');
  const idx = list.findIndex((r) => r.id === id);
  const record = {
    id,
    name: typeof def.name === 'string' && def.name.trim() ? def.name.trim() : defaultRuleName(def),
    type: RULE_TYPES.includes(def.type) ? def.type : 'requires-connection',
    categoryA: typeof def.categoryA === 'string' ? def.categoryA : '',
    categoryB: typeof def.categoryB === 'string' ? def.categoryB : '',
    max: Number.isFinite(def.max) && def.max >= 0 ? Math.floor(def.max) : 1,
    enabled: def.enabled !== false,
  };
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  persist(list);
  return record;
}

export function deleteCustomLintRule(id) {
  persist(getCustomLintRules().filter((r) => r.id !== id));
}

export function setCustomLintRuleEnabled(id, enabled) {
  const list = getCustomLintRules();
  const rule = list.find((r) => r.id === id);
  if (!rule) return;
  rule.enabled = !!enabled;
  persist(list);
}

function defaultRuleName(def) {
  if (def.type === 'max-count') return `Max ${def.max ?? 1} of a category`;
  if (def.type === 'forbidden-connection') return 'Forbidden connection';
  return 'Requires connection';
}
