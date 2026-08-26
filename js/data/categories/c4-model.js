// C4 Model notation (Context/Container/Component/Code) — see
// https://c4model.com. These are just styled boxes with the model's
// well-known color palette; there is no enforced abstraction-level state
// machine here (no real "drill down" from one level to the next) — a
// Container or Component diagram is built the same way as a Context
// diagram: drag these shapes onto the canvas and connect them. See
// js/core/c4Context.js + js/modals/c4ContextModal.js for a wizard that
// bootstraps the most common starting point (a System Context diagram).
import { c } from '../schema.js';

export const category = { id: 'c4-model', label: 'C4 Model', color: '#1168BD' };

const PERSON = '#08427B';
const SYSTEM = '#1168BD';
const SYSTEM_EXT = '#8A8A8A';
const CONTAINER = '#438DD5';
const CONTAINER_EXT = '#B3B3B3';
const COMPONENT = '#85BBF0';

export const components = [
  c('c4-person', 'Person / Actor', '🧑', {
    color: PERSON,
    tags: ['c4', 'actor', 'context'],
    description: 'A human user or role interacting with the system (C4 Context diagram).',
    related: ['c4-system'],
  }),
  c('c4-system', 'Software System', '📦', {
    color: SYSTEM,
    tags: ['c4', 'system', 'context'],
    description: 'The system in scope, or one it depends on (C4 Context diagram).',
    related: ['c4-person', 'c4-container'],
  }),
  c('c4-system-external', 'External Software System', '📦', {
    color: SYSTEM_EXT,
    tags: ['c4', 'system', 'context', 'external'],
    description: 'A system outside your scope of control (C4 Context diagram).',
  }),
  c('c4-container', 'Container', '🧱', {
    color: CONTAINER,
    tags: ['c4', 'container'],
    description: 'A deployable/runnable unit — an app, service, or data store (C4 Container diagram).',
    related: ['c4-component'],
  }),
  c('c4-container-external', 'External Container', '🧱', {
    color: CONTAINER_EXT,
    tags: ['c4', 'container', 'external'],
    description: 'A container owned by another team or vendor (C4 Container diagram).',
  }),
  c('c4-component', 'Component', '🔧', {
    color: COMPONENT,
    tags: ['c4', 'component'],
    description: 'A grouping of related functionality inside a container (C4 Component diagram).',
  }),
];
