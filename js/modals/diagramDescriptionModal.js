// "📃 Describe Diagram" — a deterministic, offline text readout of the
// current diagram's structure (core/diagramDescription.js), for anyone who
// wants a quick summary without opening an AI, or a screen-reader user for
// whom the canvas itself (a large tree of positioned divs/SVG) doesn't
// summarize well on its own.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import * as store from '../core/store.js';
import { buildDiagramDescription } from '../core/diagramDescription.js';
import { resolveComponentDef } from '../canvas/canvas.js';
import { CATEGORIES } from '../data/index.js';
import { showToast } from '../utils/toast.js';

const CATEGORY_LABELS = new Map(CATEGORIES.map((c) => [c.id, c.label]));

function resolveDef(defId) {
  const def = resolveComponentDef(defId);
  if (!def) return null;
  return { categoryId: CATEGORY_LABELS.get(def.categoryId) || def.categoryId };
}

function buildPlainText(description) {
  const lines = [description.summary];
  if (description.categoryLines.length) {
    lines.push('', 'By category:');
    for (const line of description.categoryLines) lines.push(`- ${line}`);
  }
  if (description.connectionLines.length) {
    lines.push('', 'Connections:');
    for (const line of description.connectionLines) lines.push(`- ${line}`);
  }
  if (description.isolatedLines.length) {
    lines.push('', 'Not connected to anything:');
    for (const line of description.isolatedLines) lines.push(`- ${line}`);
  }
  return lines.join('\n');
}

export function openDiagramDescriptionModal() {
  const state = store.getState();
  const description = buildDiagramDescription(state.nodes, state.edges, resolveDef);
  const text = buildPlainText(description);

  openModal({
    title: '📃 Diagram Description',
    className: 'diagram-description-modal',
    render: (body) => {
      body.appendChild(el('p', { class: 'modal-hint', text: 'A plain-text summary of this diagram\'s structure — generated instantly, offline, no AI involved.' }));
      const textarea = el('textarea', { class: 'ai-review-response diagram-description-text', rows: 14, readOnly: true });
      textarea.value = text;
      body.appendChild(textarea);
      body.appendChild(el('button', {
        type: 'button', class: 'btn btn-secondary', text: '📋 Copy',
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
