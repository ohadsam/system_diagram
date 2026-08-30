// Renaming a term used across many components/notes ("API Gateway" → "Edge
// Gateway") previously meant clicking into each one by hand — this scans
// node labels/notes and edge labels/notes in one pass and replaces every
// occurrence in a single undoable step. Pure and DOM-free (nodes/edges are
// passed in, not read from the store) so it's unit-testable without
// core/store.js in the loop — see modals/findReplaceModal.js, the only
// caller, for the store.dispatch() that actually applies the result.

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildFinder(find, matchCase) {
  if (!find) return null;
  return new RegExp(escapeRegExp(find), matchCase ? 'g' : 'gi');
}

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 * @param {{find: string, matchCase?: boolean, includeNotes?: boolean}} options
 * @returns {number} how many labels/notes contain at least one match
 */
export function countMatches(nodes, edges, { find, matchCase = false, includeNotes = true }) {
  const re = buildFinder(find, matchCase);
  if (!re) return 0;
  let count = 0;
  for (const n of nodes) {
    if (n.text && re.test(n.text)) count += 1;
    if (includeNotes && n.notes && re.test(n.notes)) count += 1;
    re.lastIndex = 0;
  }
  for (const e of edges) {
    if (e.label && re.test(e.label)) count += 1;
    if (includeNotes && e.notes && re.test(e.notes)) count += 1;
    re.lastIndex = 0;
  }
  return count;
}

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 * @param {{find: string, replaceWith: string, matchCase?: boolean, includeNotes?: boolean}} options
 * @returns {{nodeUpdates: {id: string, text?: string, notes?: string}[], edgeUpdates: {id: string, label?: string, notes?: string}[]}}
 *   only the fields that actually changed are present on each update object
 */
export function applyReplace(nodes, edges, { find, replaceWith, matchCase = false, includeNotes = true }) {
  const re = buildFinder(find, matchCase);
  if (!re) return { nodeUpdates: [], edgeUpdates: [] };

  const nodeUpdates = [];
  for (const n of nodes) {
    const update = { id: n.id };
    let changed = false;
    if (n.text) {
      const next = n.text.replace(re, replaceWith);
      if (next !== n.text) { update.text = next; changed = true; }
    }
    if (includeNotes && n.notes) {
      const next = n.notes.replace(re, replaceWith);
      if (next !== n.notes) { update.notes = next; changed = true; }
    }
    if (changed) nodeUpdates.push(update);
  }

  const edgeUpdates = [];
  for (const e of edges) {
    const update = { id: e.id };
    let changed = false;
    if (e.label) {
      const next = e.label.replace(re, replaceWith);
      if (next !== e.label) { update.label = next; changed = true; }
    }
    if (includeNotes && e.notes) {
      const next = e.notes.replace(re, replaceWith);
      if (next !== e.notes) { update.notes = next; changed = true; }
    }
    if (changed) edgeUpdates.push(update);
  }

  return { nodeUpdates, edgeUpdates };
}
