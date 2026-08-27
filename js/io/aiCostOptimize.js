// "Ask AI to reduce this cost" — for modals/costBreakdownModal.js. Builds
// a prompt from the diagram's own cost annotations (core/cost.js) asking
// for concrete cost-reduction ideas. Same honest "prepare & hand off, no
// API key" mechanism as every other AI feature here (see docs/SPEC.md
// 4.12/4.13); no apply step, since the answer is advice to read, not data
// to feed back into the project.
import { formatMonthlyCost } from '../core/cost.js';

export function buildCostOptimizePrompt({ costedNodes, total }) {
  const lines = [];
  lines.push('Here is a system design diagram\'s estimated monthly cost breakdown:');
  for (const node of costedNodes) {
    lines.push(`- ${node.text || 'Component'}: ${formatMonthlyCost(node.monthlyCost)}/mo`);
  }
  lines.push(`Total: ${formatMonthlyCost(total)}/mo`);
  lines.push('');
  lines.push('Suggest concrete ways to reduce this cost — rightsizing, reserved/committed-use pricing, spot/preemptible capacity, cheaper alternative services, caching to cut request volume, or removing/consolidating redundant components. Be specific about which component(s) each suggestion applies to, and note any suggestion that trades off reliability or performance for cost so it can be weighed deliberately.');
  return lines.join('\n');
}
