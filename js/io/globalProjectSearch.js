// Case-insensitive substring search across every SAVED project (io/
// projects.js — "Save As" entries, not the always-on autosave slot) —
// different from the sidebar's search (the component *library*) and the
// toolbar's "Find on canvas" (the *currently open* diagram only): this is
// the one that reaches into every other diagram sitting in this browser.
// Pure/DOM-free so it's unit-testable without localStorage in the loop —
// modals/globalSearchModal.js supplies the actual project list via
// io/projects.js#getRawSavedProjects().

const MATCH_LABEL = {
  'project-name': 'Project name',
  component: 'Component',
  notes: 'Notes',
  connector: 'Connector label',
  comment: 'Comment',
};

export { MATCH_LABEL };

function includesQuery(text, q) {
  return typeof text === 'string' && text.toLowerCase().includes(q);
}

/**
 * @param {object[]} projects raw saved-project records (io/projects.js#getRawSavedProjects())
 * @param {string} query
 * @returns {{id: string, name: string, updatedAt: string, matches: {kind: string, text: string}[]}[]}
 *   one entry per project with at least one match, most-recently-updated first
 */
export function searchSavedProjects(projects, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];

  const results = [];
  for (const project of projects || []) {
    const matches = [];
    if (includesQuery(project.name, q)) matches.push({ kind: 'project-name', text: project.name });

    for (const node of project.nodes || []) {
      if (includesQuery(node.text, q)) matches.push({ kind: 'component', text: node.text });
      if (includesQuery(node.notes, q)) matches.push({ kind: 'notes', text: node.notes });
    }
    for (const edge of project.edges || []) {
      if (includesQuery(edge.label, q)) matches.push({ kind: 'connector', text: edge.label });
    }
    for (const comment of project.comments || []) {
      if (includesQuery(comment.text, q)) matches.push({ kind: 'comment', text: comment.text });
      for (const reply of comment.replies || []) {
        if (includesQuery(reply.text, q)) matches.push({ kind: 'comment', text: reply.text });
      }
    }

    if (matches.length) {
      results.push({ id: project.id, name: project.name, updatedAt: project.updatedAt, matches });
    }
  }

  return results.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
