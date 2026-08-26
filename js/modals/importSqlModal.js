// "Import ER Diagram from SQL" — reachable from the toolbar's Create
// dropdown. Paste `CREATE TABLE` DDL (MySQL/Postgres/SQL Server/SQLite
// style) and it becomes a real ER diagram: one "entity" node per table
// (same `rows`-shape convention as this library's own 3 built-in ER
// templates, data/categories/design-patterns.js#entity) and one labeled
// edge per foreign key. See io/sqlDdlImport.js for the parser and
// canvas/canvas.js#createErDiagramFromDdl for node creation. No AI/hand-off
// needed here — unlike Generate Design or Edit with AI, SQL DDL parsing is
// a deterministic, well-defined task this app can just do directly.
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { parseSqlDdl } from '../io/sqlDdlImport.js';
import { createErDiagramFromDdl } from '../canvas/canvas.js';

const PLACEHOLDER = `CREATE TABLE users (
  id INT PRIMARY KEY,
  email VARCHAR(255)
);

CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT REFERENCES users(id),
  total DECIMAL(10,2)
);`;

window.addEventListener('sdb:open-import-sql', () => openImportSqlModal());

export function openImportSqlModal() {
  let text = '';

  openModal({
    title: 'Import ER Diagram from SQL',
    className: 'import-sql-modal',
    render: (body, api) => {
      body.appendChild(el('p', {
        class: 'modal-hint',
        text: 'Paste CREATE TABLE statements below — each table becomes an entity node listing its columns, and each foreign key becomes a labeled connector between the two tables. Best-effort, not a full SQL parser (views, triggers, and other statement types are ignored).',
      }));

      const textarea = el('textarea', {
        class: 'ai-review-prompt import-sql-input',
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
          const parsed = parseSqlDdl(text);
          if (!parsed.ok) {
            error.textContent = parsed.error;
            error.hidden = false;
            return;
          }
          createErDiagramFromDdl(parsed);
          api.close();
        },
      }));
      body.appendChild(actions);
    },
  });
}
