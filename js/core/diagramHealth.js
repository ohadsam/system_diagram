// A single at-a-glance "health score" for modals/diagramLintModal.js's
// header — deliberately just a transparent, deterministic function of the
// findings that dialog already computes (core/diagramLint.js), not a new
// detector of its own: this avoids a second, possibly-inconsistent opinion
// about what's wrong with the diagram, and keeps the score's meaning
// obvious ("N issues found" -> a lower number) rather than a black box.
const PENALTY_PER_FINDING = 10;

/**
 * @param {number} nodeCount
 * @param {number} findingsCount total Check Diagram findings (built-in + custom)
 * @returns {{score: number, label: string}}
 */
export function computeDiagramHealth(nodeCount, findingsCount) {
  if (nodeCount === 0) return { score: 100, label: 'Empty' };
  const score = Math.max(0, Math.min(100, 100 - findingsCount * PENALTY_PER_FINDING));
  const label = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Needs attention' : 'Poor';
  return { score, label };
}
