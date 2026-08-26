// "Manage Custom Rules" — a small builder for team-authored structural
// rules layered on top of the built-in checks (see core/diagramLint.js
// #computeCustomLint and io/customLintRules.js). Deliberately parameterized
// (pick a rule type + one or two categories, not free-form code) so a rule
// is always safe to evaluate and easy to read back later.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { field, selectInput, checkbox, numberInput, textInput } from '../utils/formControls.js';
import { CATEGORIES } from '../data/index.js';
import { RULE_TYPES, getCustomLintRules, saveCustomLintRule, deleteCustomLintRule, setCustomLintRuleEnabled } from '../io/customLintRules.js';
import { confirmAction } from './confirmModal.js';

const TYPE_LABELS = {
  'requires-connection': 'Requires a connection to another category',
  'forbidden-connection': 'Forbids a direct connection between two categories',
  'max-count': 'Limits how many of a category can appear',
};

export function openCustomLintRulesModal({ onChange } = {}) {
  let editingId = null; // id of the rule currently shown in the add/edit form, or null for "new rule" defaults
  let draftType = 'requires-connection';
  let draftCategoryA = CATEGORIES[0]?.id || '';
  let draftCategoryB = CATEGORIES[0]?.id || '';
  let draftMax = 1;
  let draftName = '';

  function loadDraftFrom(rule) {
    editingId = rule?.id || null;
    draftType = rule?.type || 'requires-connection';
    draftCategoryA = rule?.categoryA || CATEGORIES[0]?.id || '';
    draftCategoryB = rule?.categoryB || CATEGORIES[0]?.id || '';
    draftMax = rule?.max ?? 1;
    draftName = rule?.name || '';
  }

  openModal({
    title: 'Manage Custom Rules',
    className: 'custom-lint-rules-modal',
    render: (body, api) => {
      const renderAll = () => {
        clear(body);
        body.appendChild(el('p', { class: 'modal-hint', text: 'Team-specific structural rules, checked alongside the built-in ones every time you run "Check Diagram".' }));

        const rules = getCustomLintRules();
        if (rules.length) {
          const list = el('div', { class: 'custom-lint-rule-list' });
          for (const rule of rules) {
            const row = el('div', { class: 'custom-lint-rule-row' });
            row.appendChild(checkbox(rule.enabled, (v) => { setCustomLintRuleEnabled(rule.id, v); onChange?.(); renderAll(); }, ''));
            row.appendChild(el('span', { class: 'custom-lint-rule-name', text: rule.name }));
            row.appendChild(el('button', { type: 'button', class: 'btn-link', text: 'Edit', onClick: () => { loadDraftFrom(rule); renderAll(); } }));
            row.appendChild(el('button', {
              type: 'button', class: 'btn-link', text: 'Delete',
              onClick: async () => {
                const ok = await confirmAction({ title: 'Delete this rule?', message: `"${rule.name}" will no longer be checked.`, confirmLabel: 'Delete', danger: true });
                if (!ok) return;
                deleteCustomLintRule(rule.id);
                if (editingId === rule.id) loadDraftFrom(null);
                onChange?.();
                renderAll();
              },
            }));
            list.appendChild(row);
          }
          body.appendChild(list);
        } else {
          body.appendChild(el('p', { class: 'diagram-lint-empty', text: 'No custom rules yet.' }));
        }

        body.appendChild(el('h3', { class: 'modal-subheading', text: editingId ? 'Edit rule' : 'New rule' }));

        const form = el('div', { class: 'custom-lint-rule-form' });
        form.appendChild(field('Rule type', selectInput(RULE_TYPES, draftType, (v) => { draftType = v; renderAll(); }, TYPE_LABELS)));
        const categoryOptions = CATEGORIES.map((c) => c.id);
        const categoryLabels = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
        form.appendChild(field(
          draftType === 'requires-connection' ? 'This category…' : 'Category A',
          selectInput(categoryOptions, draftCategoryA, (v) => { draftCategoryA = v; }, categoryLabels),
        ));
        if (draftType !== 'max-count') {
          form.appendChild(field(
            draftType === 'requires-connection' ? '…must connect to' : 'Category B',
            selectInput(categoryOptions, draftCategoryB, (v) => { draftCategoryB = v; }, categoryLabels),
          ));
        }
        if (draftType === 'max-count') {
          form.appendChild(field('Maximum allowed', numberInput(draftMax, 0, 999, 1, (v) => { draftMax = v; })));
        }
        form.appendChild(field('Name (optional)', textInput(draftName, (v) => { draftName = v; }, { placeholder: 'Shown in "Check Diagram" results' })));
        body.appendChild(form);

        const actions = el('div', { class: 'modal-actions' });
        if (editingId) {
          actions.appendChild(el('button', { type: 'button', class: 'btn', text: 'Cancel edit', onClick: () => { loadDraftFrom(null); renderAll(); } }));
        }
        actions.appendChild(el('button', {
          type: 'button', class: 'btn btn-primary', text: editingId ? 'Save rule' : '+ Add rule',
          onClick: () => {
            saveCustomLintRule({ id: editingId, type: draftType, categoryA: draftCategoryA, categoryB: draftCategoryB, max: draftMax, name: draftName, enabled: true });
            loadDraftFrom(null);
            onChange?.();
            renderAll();
          },
        }));
        body.appendChild(actions);

        const doneActions = el('div', { class: 'modal-actions' });
        doneActions.appendChild(el('button', { type: 'button', class: 'btn btn-secondary', text: 'Done', onClick: () => api.close() }));
        body.appendChild(doneActions);
      };

      loadDraftFrom(null);
      renderAll();
    },
  });
}
