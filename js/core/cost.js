// Pure helpers for the estimated-monthly-cost feature — see
// core/project.js#createNode's monthlyCost field. No DOM, no store.

/** Nodes carrying an actual cost estimate (monthlyCost !== null), sorted
 * highest-cost first — the order the cost breakdown modal and toolbar
 * tooltip list them in. */
export function getCostedNodes(nodes) {
  return (nodes || [])
    .filter((n) => Number.isFinite(n.monthlyCost))
    .sort((a, b) => b.monthlyCost - a.monthlyCost);
}

/** Sum of every node's monthlyCost — 0 if none is set. */
export function computeMonthlyCostTotal(nodes) {
  return getCostedNodes(nodes).reduce((sum, n) => sum + n.monthlyCost, 0);
}

/** Compact "$1,234/mo" / "$45.50/mo" formatting shared by the node badge,
 * toolbar readout and breakdown modal — 2 decimals only when the amount
 * actually needs them, so a rounded estimate doesn't grow a noisy ".00". */
export function formatMonthlyCost(amount) {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })}`;
}
