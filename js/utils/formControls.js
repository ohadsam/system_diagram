// Small shared form-control builders reused by the toolbar's style/arrow
// editors and the custom component/shape modals — keeps that repeated UI
// pattern (label + input) in one place.
import { el } from './dom.js';

export function normalizeHex(value) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || '') ? value : '#000000';
}

export function field(labelText, controlEl, extraClass = '') {
  return el('label', { class: `field ${extraClass}`.trim() }, [el('span', { class: 'field-label', text: labelText }), controlEl]);
}

export function colorInput(value, onChange, attrs = {}) {
  return el('input', { type: 'color', value: normalizeHex(value), onInput: (e) => onChange(e.target.value), ...attrs });
}

export function numberInput(value, min, max, step, onChange, attrs = {}) {
  return el('input', { type: 'number', value, min, max, step, onInput: (e) => onChange(Number(e.target.value)), ...attrs });
}

export function textInput(value, onChange, attrs = {}) {
  return el('input', { type: 'text', value, onInput: (e) => onChange(e.target.value), ...attrs });
}

export function selectInput(options, value, onChange, labelsMap) {
  const select = el('select', { onChange: (e) => onChange(e.target.value) });
  for (const opt of options) {
    const option = el('option', { value: opt, text: labelsMap?.[opt] || opt });
    if (opt === value) option.selected = true;
    select.appendChild(option);
  }
  return select;
}

export function checkbox(checked, onChange, labelText) {
  const wrap = el('label', { class: 'field field-checkbox' });
  const input = el('input', { type: 'checkbox', checked, onChange: (e) => onChange(e.target.checked) });
  wrap.appendChild(input);
  wrap.appendChild(el('span', { text: labelText }));
  return wrap;
}
