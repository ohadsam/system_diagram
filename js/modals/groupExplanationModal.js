// "📖 Explain This Diagram" — see core/groupExplanation.js's header comment
// for the full rationale. Gathers every node sharing one instantiation's
// `patternInstanceId` (canvas.js#instantiatePatternAtPoint stamps this on
// every node it creates) plus the edges between them, resolves the
// original library pattern's own def for the curated header, and renders
// it as a plain-text read-only modal — same shape as diagramDescriptionModal.js.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import { buildGroupExplanation } from '../core/groupExplanation.js';
import { resolveComponentDef } from '../canvas/canvas.js';
import { showToast } from '../utils/toast.js';

function buildPlainText(explanation) {
  const lines = [explanation.title];
  if (explanation.headerDescription) lines.push(explanation.headerDescription);
  if (explanation.components.length) {
    lines.push('', 'Components:');
    for (const c of explanation.components) {
      lines.push(c.description ? `- ${c.name}: ${c.description}` : `- ${c.name}`);
    }
  }
  if (explanation.flowLines.length) {
    lines.push('', explanation.isSequenceDiagram ? 'How it works (in order):' : 'Connections:');
    for (const line of explanation.flowLines) lines.push(`- ${line}`);
  }
  return lines.join('\n');
}

export function openGroupExplanationModal(patternInstanceId) {
  const state = store.getState();
  const nodes = state.nodes.filter((n) => n.patternInstanceId === patternInstanceId);
  if (!nodes.length) {
    showToast('This diagram is no longer on the canvas.', 'error');
    return;
  }
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = state.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  const patternDef = nodes[0].sourcePatternId ? resolveComponentDef(nodes[0].sourcePatternId) : null;
  const explanation = buildGroupExplanation(nodes, edges, resolveComponentDef, patternDef);
  const text = buildPlainText(explanation);

  openModal({
    title: `📖 ${explanation.title}`,
    className: 'group-explanation-modal',
    render: (body) => {
      body.appendChild(el('p', { class: 'modal-hint', text: 'A comprehensive, offline explanation of this diagram — what it is, what each component does, and how it works — generated instantly from this app\'s own component library, no AI involved.' }));
      if (explanation.headerDescription) {
        body.appendChild(el('p', { class: 'group-explanation-summary', text: explanation.headerDescription }));
      }
      if (explanation.components.length) {
        body.appendChild(el('h3', { class: 'modal-subheading', text: 'Components' }));
        const list = el('ul', { class: 'group-explanation-list' });
        for (const c of explanation.components) {
          list.appendChild(el('li', {}, [
            el('strong', { text: c.name }),
            c.description ? el('span', { text: ` — ${c.description}` }) : null,
          ].filter(Boolean)));
        }
        body.appendChild(list);
      }
      if (explanation.flowLines.length) {
        body.appendChild(el('h3', { class: 'modal-subheading', text: explanation.isSequenceDiagram ? 'How it works (in order)' : 'Connections' }));
        const list = el('ol', { class: 'group-explanation-list' });
        if (!explanation.isSequenceDiagram) list.setAttribute('style', 'list-style: disc;');
        for (const line of explanation.flowLines) {
          list.appendChild(el('li', { text: explanation.isSequenceDiagram ? line.replace(/^\d+\.\s*/, '') : line }));
        }
        body.appendChild(list);
      }
      body.appendChild(el('button', {
        type: 'button', class: 'btn btn-secondary', text: '📋 Copy as text',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(text);
            showToast('Copied to clipboard.', 'success', 1600);
          } catch {
            showToast('Could not copy automatically — select the text and copy it manually.', 'error');
          }
        },
      }));
    },
  });
}

window.addEventListener('sdb:open-group-explanation', (e) => openGroupExplanationModal(e.detail.patternInstanceId));
