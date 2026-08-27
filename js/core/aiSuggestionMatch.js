// Best-effort match between an AI-suggested component name (freeform text
// from an LLM, e.g. "Redis Cache" or "a message queue like SQS") and this
// app's own component library, so panel/aiReviewPanel.js's "AI Suggestions"
// mode can offer a one-click "+ Add" for a suggestion that maps to
// something real instead of always falling back to plain, unactionable
// text. Exact name match wins; otherwise the first component whose name
// contains the suggestion (or is contained by it, once long enough to be a
// meaningful substring) is used — a "did we recognize this" heuristic, not
// a search ranking algorithm, so a wrong or missing match is expected and
// harmless (the suggestion just renders without an Add button).
import { normalize } from '../sidebar/search.js';

const MIN_SUBSTRING_LENGTH = 3;

export function findComponentMatch(suggestedName, components) {
  const q = normalize(suggestedName);
  if (!q) return null;
  let best = null;
  for (const c of components) {
    const name = normalize(c.name);
    if (!name) continue;
    if (name === q) return c;
    if (!best && q.length >= MIN_SUBSTRING_LENGTH && name.length >= MIN_SUBSTRING_LENGTH
      && (name.includes(q) || q.includes(name))) {
      best = c;
    }
  }
  return best;
}
