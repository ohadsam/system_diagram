import { c, definePattern } from '../schema.js';

// BPMN (Business Process Model and Notation) — a business-process
// counterpart to the State Machines category: events/tasks/gateways are
// plain components, a sequence flow is just a normal edge, so these mix
// freely with the rest of the diagram and need no new engine concepts.
// Gateway "type" (exclusive/parallel/inclusive) is conveyed by icon +
// description only, same as every other component here — nothing in the
// engine treats a gateway specially. `kind: 'component'` entries can be
// dragged in individually; the `kind: 'pattern'` entry drops a whole
// ready-made process at once, same mechanism as design-patterns.js.
export const category = { id: 'bpmn', label: 'BPMN (Business Process)', color: '#B45309' };

const BP = '#B45309';
const opts = (shape, size, extra = {}) => ({ shape, color: BP, fill: '#FFFBEB', defaultSize: size, tags: ['bpmn', 'process', 'workflow'], ...extra });

const bpmnShapes = [
  c('bpmn-start-event', 'Start Event', '⚪', opts('circle', { w: 56, h: 56 }, { description: 'Marks where a process instance begins.', strokeWidth: 2 })),
  c('bpmn-end-event', 'End Event', '⚫', opts('circle', { w: 56, h: 56 }, { description: 'Marks where a process instance ends.', strokeWidth: 5, color: '#7C2D12' })),
  c('bpmn-intermediate-event', 'Intermediate Event', '🔔', opts('circle', { w: 52, h: 52 }, { description: 'Something that happens mid-process — a timer, a received message, a signal.', strokeWidth: 3 })),
  c('bpmn-task', 'Task / Activity', '📋', opts('rounded', { w: 170, h: 84 }, { description: 'A single unit of work in the process.' })),
  c('bpmn-subprocess', 'Sub-Process', '🗂️', opts('rounded', { w: 200, h: 110 }, { description: 'A task that itself expands into a nested sequence of steps.' })),
  c('bpmn-exclusive-gateway', 'Exclusive Gateway (XOR)', '◆', opts('diamond', { w: 110, h: 90 }, { description: 'Exactly one outgoing path is taken — label each with its condition (e.g. "[approved]").' })),
  c('bpmn-parallel-gateway', 'Parallel Gateway (AND)', '➕', opts('diamond', { w: 110, h: 90 }, { description: 'All outgoing paths are taken at once (fork), or all incoming paths must complete before continuing (join).' })),
  c('bpmn-inclusive-gateway', 'Inclusive Gateway (OR)', '⭕', opts('diamond', { w: 110, h: 90 }, { description: 'One or more outgoing paths are taken, based on each one\'s condition.' })),
  c('bpmn-pool', 'Pool / Lane', '🏊', opts('rect', { w: 700, h: 200 }, { description: 'A labeled boundary representing one participant/department — drag tasks inside it, same as the generic Group shape.', textPosition: 'top', iconVisible: false })),
];

const n = (key, defId, dx, dy, label) => ({ key, defId, dx, dy, label });
const e = (from, to, label, extra = {}) => ({ from, to, label, ...extra });

const bpmnPatterns = [
  definePattern('bpmn-approval-process', 'Simple Approval Process', '✅', {
    description: 'The Exclusive Gateway enforces that exactly one outgoing path is taken — approved or rejected, never both — which is what "exclusive" (XOR) specifically means in BPMN and is why it\'s the right gateway choice here instead of a parallel or inclusive one. Both outcomes route to their own distinct End Event rather than sharing one, since a process can legitimately end in different ways — being able to tell "approved" and "rejected" apart in a completed instance\'s history is the point, not just knowing it finished.',
    tags: ['bpmn', 'process', 'workflow', 'example'],
    nodes: [
      n('start', 'bpmn-start-event', -420, 0),
      n('submit', 'bpmn-task', -220, 0, 'Submit Request'),
      n('review', 'bpmn-task', 20, 0, 'Review Request'),
      n('gateway', 'bpmn-exclusive-gateway', 260, 0),
      n('approve', 'bpmn-task', 480, -120, 'Approve'),
      n('reject', 'bpmn-task', 480, 120, 'Notify Rejection'),
      n('endApproved', 'bpmn-end-event', 720, -120),
      n('endRejected', 'bpmn-end-event', 720, 120),
    ],
    edges: [
      e('start', 'submit', ''),
      e('submit', 'review', ''),
      e('review', 'gateway', ''),
      e('gateway', 'approve', '[approved]'),
      e('gateway', 'reject', '[rejected]'),
      e('approve', 'endApproved', ''),
      e('reject', 'endRejected', ''),
    ],
  }),
];

export const components = [...bpmnShapes, ...bpmnPatterns];
