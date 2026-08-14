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

export function filterComponents(components, query) {
  if (!normalize(query)) return components;
  return components.filter((c) => componentMatches(c, query));
}
