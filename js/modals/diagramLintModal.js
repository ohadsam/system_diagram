// "Check Diagram" — runs the small set of deterministic structural checks
// in core/diagramLint.js against the current canvas and lists what it
// found, each clickable to jump straight to the component(s) involved.
// Complementary to "🤖 AI Design Review" (panel/aiReviewPanel.js), which
// needs an external LLM and gives much broader, subjective feedback —
// this is instant, offline, and deliberately narrow (only fires on a
// handful of textbook, low-false-positive patterns).
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import { computeDiagramLint } from '../core/diagramLint.js';
import { resolveComponentDef } from '../canvas/canvas.js';
import { centerOn } from '../canvas/viewport.js';

function selectAndCenter(nodeIds) {
  const state = store.getState();
  const nodes = state.nodes.filter((n) => nodeIds.includes(n.id));
  if (!nodes.length) return;
  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  const maxX = Math.max(...nodes.map((n) => n.x + n.w));
  const maxY = Math.max(...nodes.map((n) => n.y + n.h));
  centerOn((minX + maxX) / 2, (minY + maxY) / 2);
  store.select(nodeIds, []);
}

export function openDiagramLintModal() {
  const state = store.getState();
  const findings = computeDiagramLint(state.nodes, state.edges, state.replicationPairs, resolveComponentDef);

  openModal({
    title: 'Check Diagram',
    className: 'diagram-lint-modal',
    render: (body, api) => {
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: 'A handful of quick, offline structural checks — not a full review (see "🤖 AI Design Review" for that). Click a finding to jump to it.',
      }));

      if (!findings.length) {
        body.appendChild(el('p', { class: 'diagram-lint-empty', text: '✅ No issues found.' }));
        return;
      }

      const list = el('div', { class: 'diagram-lint-list' });
      for (const finding of findings) {
        const item = el('button', {
          type: 'button',
          class: 'diagram-lint-item',
          onClick: () => { selectAndCenter(finding.nodeIds); api.close(); },
        });
        item.appendChild(el('span', { class: 'diagram-lint-item-icon', text: '⚠️', 'aria-hidden': 'true' }));
        item.appendChild(el('span', { class: 'diagram-lint-item-text', text: finding.message }));
        list.appendChild(item);
      }
      body.appendChild(list);
    },
  });
}
