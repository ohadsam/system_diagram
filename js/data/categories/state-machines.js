import { c, definePattern } from '../schema.js';

// "State Machines" — states/transitions are just normal components/edges
// (a transition's condition/event is simply the edge's existing `label`
// field), so these mix freely with the rest of the diagram and need no new
// engine concepts. `kind: 'component'` state shapes below can be dragged in
// individually and wired up with regular connectors; the `kind: 'pattern'`
// entries drop a whole ready-made state machine at once, the same
// mechanism as `design-patterns.js` — see canvas/canvas.js#instantiatePattern.
// See docs/SPEC.md 4.2.6 for the "hide this category" setting.
export const category = { id: 'state-machines', label: 'State Machines', color: '#9333EA' };

const SM = '#9333EA';
const opts = (shape, size, extra = {}) => ({ shape, color: SM, fill: '#F5F3FF', defaultSize: size, tags: ['state-machine', 'fsm'], ...extra });

const stateShapes = [
  c('sm-initial', 'Initial State', '●', opts('circle', { w: 40, h: 40 }, { description: 'The state machine\'s single starting point.', fill: '#1E1B4B', color: '#1E1B4B' })),
  c('sm-state', 'State', '⬭', opts('rounded', { w: 160, h: 84 }, { description: 'A named state the machine can be in.' })),
  c('sm-choice', 'Choice / Decision', '◆', opts('diamond', { w: 130, h: 100 }, { description: 'Branches to different states based on a condition — label each outgoing transition with its guard.' })),
  c('sm-final', 'Final State', '🏁', opts('circle', { w: 48, h: 48 }, { description: 'An end point — the state machine stops here.', strokeWidth: 4 })),
  c('sm-fork-join', 'Fork / Join', '▬', opts('rect', { w: 120, h: 14 }, { description: 'Splits into (fork) or merges from (join) parallel states.', fill: '#1E1B4B', color: '#1E1B4B' })),
  c('sm-history', 'History State', 'Ⓗ', opts('circle', { w: 44, h: 44 }, { description: 'Re-enters a composite state at whichever sub-state it was last in.' })),
  c('sm-composite', 'Composite State', '🗂️', opts('rounded', { w: 200, h: 120 }, { description: 'A state that itself contains a nested sub-state-machine.' })),
];

const n = (key, defId, dx, dy, label) => ({ key, defId, dx, dy, label });
const e = (from, to, label, extra = {}) => ({ from, to, label, ...extra });
const back = { dash: 'dashed', routing: 'curved' };

const statePatterns = [
  definePattern('pattern-sm-traffic-light', 'Traffic Light State Machine', '🚦', {
    description: 'Classic 3-state cyclic state machine.',
    tags: ['state-machine', 'fsm', 'example'],
    nodes: [
      n('init', 'sm-initial', -420, 0),
      n('red', 'sm-state', -220, 0, 'Red'),
      n('green', 'sm-state', 20, 0, 'Green'),
      n('yellow', 'sm-state', 260, 0, 'Yellow'),
    ],
    edges: [
      e('init', 'red', ''),
      e('red', 'green', 'timer expires'),
      e('green', 'yellow', 'timer expires'),
      e('yellow', 'red', 'timer expires', back),
    ],
  }),

  definePattern('pattern-sm-order-lifecycle', 'Order Lifecycle State Machine', '📦', {
    description: 'A typical e-commerce order, from creation to delivery or cancellation.',
    tags: ['state-machine', 'fsm', 'example', 'backend'],
    nodes: [
      n('init', 'sm-initial', 0, -220),
      n('created', 'sm-state', 0, -60, 'Created'),
      n('paid', 'sm-state', -220, 100, 'Paid'),
      n('cancelled', 'sm-final', 220, 100, 'Cancelled'),
      n('shipped', 'sm-state', -220, 260, 'Shipped'),
      n('delivered', 'sm-final', -220, 420, 'Delivered'),
    ],
    edges: [
      e('init', 'created', ''),
      e('created', 'paid', 'payment received'),
      e('created', 'cancelled', 'customer cancels'),
      e('paid', 'shipped', 'warehouse ships'),
      e('shipped', 'delivered', 'courier delivers'),
    ],
  }),

  definePattern('pattern-sm-tcp', 'TCP Connection State Machine', '🔌', {
    description: 'Simplified server-side TCP handshake/teardown states.',
    tags: ['state-machine', 'fsm', 'example', 'networking'],
    nodes: [
      n('init', 'sm-initial', 0, -300),
      n('closed', 'sm-state', 0, -140, 'Closed'),
      n('listen', 'sm-state', 0, 20, 'Listen'),
      n('synRcvd', 'sm-state', 0, 180, 'SYN Received'),
      n('established', 'sm-state', 0, 340, 'Established'),
      n('finWait', 'sm-state', -240, 500, 'Fin Wait'),
      n('timeWait', 'sm-state', 0, 500, 'Time Wait'),
      n('closedFinal', 'sm-final', 0, 660, 'Closed'),
    ],
    edges: [
      e('init', 'closed', ''),
      e('closed', 'listen', 'passive open'),
      e('listen', 'synRcvd', 'receive SYN'),
      e('synRcvd', 'established', 'receive ACK'),
      e('established', 'finWait', 'active close (send FIN)'),
      e('established', 'timeWait', 'passive close'),
      e('finWait', 'timeWait', 'receive ACK'),
      e('timeWait', 'closedFinal', 'timeout'),
    ],
  }),

  definePattern('pattern-sm-media-player', 'Media Player State Machine', '🎵', {
    description: 'Play / pause / stop transitions for a media player.',
    tags: ['state-machine', 'fsm', 'example', 'ui'],
    nodes: [
      n('init', 'sm-initial', 0, -180),
      n('stopped', 'sm-state', 0, -20, 'Stopped'),
      n('playing', 'sm-state', -220, 160, 'Playing'),
      n('paused', 'sm-state', 220, 160, 'Paused'),
    ],
    edges: [
      e('init', 'stopped', ''),
      e('stopped', 'playing', 'play'),
      e('playing', 'paused', 'pause'),
      e('paused', 'playing', 'resume', back),
      e('playing', 'stopped', 'stop'),
      e('paused', 'stopped', 'stop'),
    ],
  }),

  definePattern('pattern-sm-approval-workflow', 'Approval Workflow State Machine', '✅', {
    description: 'Draft through review to an approved/rejected outcome, with revision loop-back.',
    tags: ['state-machine', 'fsm', 'example', 'workflow'],
    nodes: [
      n('init', 'sm-initial', 0, -260),
      n('draft', 'sm-state', 0, -100, 'Draft'),
      n('submitted', 'sm-state', 0, 60, 'Submitted'),
      n('review', 'sm-state', 0, 220, 'Under Review'),
      n('choice', 'sm-choice', 0, 380),
      n('approved', 'sm-final', -220, 540, 'Approved'),
      n('rejected', 'sm-final', 220, 540, 'Rejected'),
    ],
    edges: [
      e('init', 'draft', ''),
      e('draft', 'submitted', 'submit'),
      e('submitted', 'review', 'assign reviewer'),
      e('review', 'choice', 'decision made'),
      e('choice', 'approved', '[approved]'),
      e('choice', 'rejected', '[rejected]'),
      e('rejected', 'draft', 'revise', back),
    ],
  }),

  definePattern('pattern-sm-auth-session', 'Auth Session State Machine', '🔐', {
    description: 'Login, active session and expiry/logout transitions.',
    tags: ['state-machine', 'fsm', 'example', 'security'],
    nodes: [
      n('init', 'sm-initial', 0, -220),
      n('loggedOut', 'sm-state', 0, -60, 'Logged Out'),
      n('authenticating', 'sm-state', 0, 100, 'Authenticating'),
      n('loggedIn', 'sm-state', 0, 260, 'Logged In'),
    ],
    edges: [
      e('init', 'loggedOut', ''),
      e('loggedOut', 'authenticating', 'submit credentials'),
      e('authenticating', 'loggedIn', 'credentials valid'),
      e('authenticating', 'loggedOut', 'credentials invalid', back),
      e('loggedIn', 'loggedOut', 'logout / session expires'),
    ],
  }),
];

export const components = [...stateShapes, ...statePatterns];
