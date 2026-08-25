// "💰 Cost" toolbar readout's modal — lists every node carrying an
// estimated monthly cost (core/project.js#createNode's monthlyCost field,
// entered via the details panel) plus the running total. Read-only: cost
// is edited per-node in the details panel (panel/detailsPanel.js), same as
// notes/labels — this is a summary view, not another place to edit it.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import { getCostedNodes, computeMonthlyCostTotal, formatMonthlyCost } from '../core/cost.js';
import { centerOn } from '../canvas/viewport.js';

export function openCostBreakdownModal() {
  const state = store.getState();
  const costed = getCostedNodes(state.nodes);
  const total = computeMonthlyCostTotal(state.nodes);

  openModal({
    title: '💰 Estimated Monthly Cost',
    className: 'cost-breakdown-modal',
    render: (body, api) => {
      if (!costed.length) {
        body.appendChild(el('p', {
          class: 'cost-breakdown-empty',
          text: 'No components have an estimated cost yet. Open a component\'s details panel (ⓘ) to add one.',
        }));
        return;
      }

      const list = el('div', { class: 'cost-breakdown-list' });
      for (const node of costed) {
        const row = el('button', {
          type: 'button',
          class: 'cost-breakdown-row',
          title: 'Jump to this component',
          onClick: () => {
            centerOn(node.x + node.w / 2, node.y + node.h / 2);
            store.select([node.id], []);
            api.close();
          },
        });
        row.appendChild(el('span', { class: 'cost-breakdown-name', text: `${node.icon || '▪️'} ${node.text || 'Component'}` }));
        row.appendChild(el('span', { class: 'cost-breakdown-amount', text: `${formatMonthlyCost(node.monthlyCost)}/mo` }));
        list.appendChild(row);
      }
      body.appendChild(list);

      const totalRow = el('div', { class: 'cost-breakdown-total' });
      totalRow.appendChild(el('span', { text: `Total (${costed.length} component${costed.length === 1 ? '' : 's'})` }));
      totalRow.appendChild(el('span', { class: 'cost-breakdown-total-amount', text: `${formatMonthlyCost(total)}/mo` }));
      body.appendChild(totalRow);
    },
  });
}
