// "Import Sequence Diagram from Mermaid" — reachable from the toolbar's
// Create dropdown. Paste Mermaid `sequenceDiagram` text (e.g. from this
// app's own "📋 Copy as Mermaid" export, or hand-written/from another
// tool) and it becomes a real, grouped set of lifelines + messages, the
// inverse of that export. See io/importSequenceMermaid.js for the parser
// and canvas/canvas.js#createSequenceDiagramFromMermaid for node creation.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { parseSequenceMermaid } from '../io/importSequenceMermaid.js';
import { createSequenceDiagramFromMermaid } from '../canvas/canvas.js';

const PLACEHOLDER = `sequenceDiagram
    participant Client
    participant Server
    Client->>Server: GET /data
    Server-->>Client: 200 OK`;

// Same `sdb:open-*` window-event convention as every other Create-dropdown
// wizard (see modals/sequenceDiagramModal.js's header comment for why).
window.addEventListener('sdb:open-import-sequence-mermaid', () => openImportSequenceMermaidModal());

export function openImportSequenceMermaidModal() {
  let text = '';

  openModal({
    title: 'Import Sequence Diagram from Mermaid',
    className: 'import-sequence-mermaid-modal',
    render: (body, api) => {
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: 'Paste Mermaid sequenceDiagram text below — participants become lifelines and each message becomes an offset-anchored connector. activate/deactivate, destroy, and alt/opt/loop/par are also read. Best-effort, not a guaranteed lossless round-trip.',
      }));

      const textarea = el('textarea', {
        class: 'ai-review-prompt import-sequence-mermaid-input',
        rows: 12,
        placeholder: PLACEHOLDER,
        onInput: (e) => { text = e.target.value; },
      });
      body.appendChild(textarea);

      const error = el('p', { class: 'sequence-diagram-error', hidden: true });
      body.appendChild(error);

      const actions = el('div', { class: 'modal-actions' });
      actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel', onClick: () => api.close() }));
      actions.appendChild(el('button', {
        type: 'button',
        class: 'btn btn-primary',
        text: '📥 Import',
        onClick: () => {
          const parsed = parseSequenceMermaid(text);
          if (!parsed) {
            error.textContent = 'No participants or messages found — check the pasted text.';
            error.hidden = false;
            return;
          }
          createSequenceDiagramFromMermaid(parsed);
          api.close();
        },
      }));
      body.appendChild(actions);
    },
  });
}

