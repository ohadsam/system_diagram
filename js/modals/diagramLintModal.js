// "Check Diagram" — runs the small set of deterministic structural checks
// in core/diagramLint.js against the current canvas and lists what it
// found, each clickable to jump straight to the component(s) involved.
// Complementary to "🤖 AI Design Review" (panel/aiReviewPanel.js), which
// needs an external LLM and gives much broader, subjective feedback —
// this is instant, offline, and deliberately narrow (only fires on a
// handful of textbook, low-false-positive patterns).
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import * as store from '../core/store.js';
import { computeDiagramLint, computeCustomLint } from '../core/diagramLint.js';
import { resolveComponentDef } from '../canvas/canvas.js';
import { centerOn } from '../canvas/viewport.js';
import { getCustomLintRules } from '../io/customLintRules.js';
import { openCustomLintRulesModal } from './customLintRulesModal.js';

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

function computeAllFindings() {
  const state = store.getState();
  const builtIn = computeDiagramLint(state.nodes, state.edges, state.replicationPairs, resolveComponentDef);
  const custom = computeCustomLint(state.nodes, state.edges, getCustomLintRules(), resolveComponentDef);
  return [...builtIn, ...custom];
}

export function openDiagramLintModal() {
  openModal({
    title: 'Check Diagram',
    className: 'diagram-lint-modal',
    render: (body, api) => {
      const renderBody = () => {
        clear(body);
        body.appendChild(el('p', {
          class: 'modal-hint',
          text: 'A handful of quick, offline structural checks — not a full review (see "🤖 AI Design Review" for that). Click a finding to jump to it.',
        }));

        const findings = computeAllFindings();
        if (!findings.length) {
          body.appendChild(el('p', { class: 'diagram-lint-empty', text: '✅ No issues found.' }));
        } else {
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
        }

        const actions = el('div', { class: 'modal-actions' });
        actions.appendChild(el('button', {
          type: 'button', class: 'btn btn-secondary', text: '⚙️ Manage Custom Rules',
          onClick: () => openCustomLintRulesModal({ onChange: renderBody }),
        }));
        body.appendChild(actions);
      };

      renderBody();
    },
  });
}
