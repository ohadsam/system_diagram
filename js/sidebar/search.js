// Pure search/filter logic, unit-testable without a DOM.

export function normalize(str) {
  return (str || '').toLowerCase().trim();
}

/** Does this component match the query (name, description, or tags)? */
export function componentMatches(component, query) {
  const q = normalize(query);
  if (!q) return true;
  if (normalize(component.name).includes(q)) return true;
  if (normalize(component.description).includes(q)) return true;
  return (component.tags || []).some((tag) => normalize(tag).includes(q));
}

/** Does this component match the query by its own *name* specifically (not
 * just its description or tags)? Used to rank a literal, well-known product
 * name (e.g. "Redis") ahead of an unrelated-by-name component that merely
 * mentions it in passing (e.g. AWS ElastiCache's "managed Redis or
 * Memcached store" description) — see sidebar.js's category sort. */
export function nameMatches(component, query) {
  return nameMatchRank(component, query) !== null;
}

/** How well does this component's own *name* match the query, from 0 (best)
 * to null (not a name match at all, though it may still match by
 * description/tag)? Distinguishes an exact name match (typing the literal,
 * well-known product name "Device") from a merely-partial one (an
 * unrelated "IoT Device" that happens to contain the same word) — two
 * components can both pass `nameMatches`, but a user who typed the exact
 * name almost always means the shorter, exact one. See sidebar.js's
 * category sort, which ranks by the best (lowest) rank found in each
 * category.
 *
 * Below "exact", rank is driven mainly by *coverage* — how much of the
 * matched name the query actually accounts for (`excess` = the leftover,
 * unmatched length) — not just whether the match happens to sit at index 0.
 * A naive "prefix always beats substring" rule gets this wrong for a real
 * pair in this library's own data: searching "Kafka" must surface the
 * actual "Apache Kafka" component (a substring match, but only 7 characters
 * of excess) ahead of the "Kafka Consumer-Group Rebalance" sequence-diagram
 * template (a prefix match, but 26 characters of excess) — a plain
 * prefix-over-substring rule would rank the much longer, more specific
 * template first, which regressed a real e2e test (`addComponentByName`
 * picking the template instead of the component and instantiating a whole
 * cluster where a single node was expected) the first time this ranking
 * shipped. Prefix position still matters, but only as a tiebreak once
 * coverage is equal. */
export function nameMatchRank(component, query) {
  const q = normalize(query);
  if (!q) return null;
  const name = normalize(component.name);
  if (name === q) return 0;
  const idx = name.indexOf(q);
  if (idx === -1) return null;
  const excess = name.length - q.length;
  return 1 + excess * 2 + (idx === 0 ? 0 : 1);
}

export function filterComponents(components, query) {
  if (!normalize(query)) return components;
  return components.filter((c) => componentMatches(c, query));
}

/** Re-orders an already-filtered list so a better *name* match comes first
 * (see `nameMatchRank` for what "better" means — exact, then by coverage),
 * falling back to each component's existing relative order for ties or a
 * description/tag-only match —
 * without this, a plain alphabetical or declaration order can surface the
 * wrong one of two similarly-named components first (typing the literal,
 * well-known name "React" must not surface "Preact" — alphabetically
 * earlier, and *also* a substring-technically-true match on "react" —
 * ahead of the real "React" component). Used by both the sidebar (ranking
 * within a category; see sidebar.js's own cross-category sort for the
 * other half of this) and the Command Palette (ranking before truncating
 * to its own result cap, so the right component doesn't get cut off
 * entirely by a flood of coincidental substring matches). A stable sort
 * (native Array.prototype.sort) keeps this a pure reordering, never a
 * surprise for an empty or already-well-ordered query. */
export function rankComponents(components, query) {
  if (!normalize(query)) return components;
  return [...components].sort((a, b) => (nameMatchRank(a, query) ?? Infinity) - (nameMatchRank(b, query) ?? Infinity));
}
