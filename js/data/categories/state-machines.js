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
  c('sm-final', 'Final State', '🏁', opts('circle', { w: 48, h: 48 }, { description: 'An end point — the state machine stops here.', strokeWidth: 4, textPosition: 'below' })),
  c('sm-fork-join', 'Fork / Join', '▬', opts('rect', { w: 120, h: 14 }, { description: 'Splits into (fork) or merges from (join) parallel states.', fill: '#1E1B4B', color: '#1E1B4B' })),
  c('sm-history', 'History State', 'Ⓗ', opts('circle', { w: 44, h: 44 }, { description: 'Re-enters a composite state at whichever sub-state it was last in.' })),
  c('sm-composite', 'Composite State', '🗂️', opts('rounded', { w: 200, h: 120 }, { description: 'A state that itself contains a nested sub-state-machine.' })),
];

const n = (key, defId, dx, dy, label) => ({ key, defId, dx, dy, label });
const e = (from, to, label, extra = {}) => ({ from, to, label, ...extra });
const back = { dash: 'dashed', routing: 'curved' };

const statePatterns = [
  definePattern('pattern-sm-auth-session', 'Auth Session State Machine (with Token Refresh & Lockout)', '🔐', {
    description: 'Login, MFA, silent token refresh, and a failed-attempt lockout — the real shape of a modern session, not just login/logout.',
    tags: ['state-machine', 'fsm', 'example', 'security'],
    nodes: [
      n('init', 'sm-initial', 0, -320),
      n('loggedOut', 'sm-state', 0, -160, 'Logged Out'),
      n('authenticating', 'sm-state', 0, 0, 'Authenticating'),
      n('mfaChoice', 'sm-choice', 0, 160),
      n('mfaPending', 'sm-state', -260, 320, 'Awaiting MFA Code'),
      n('locked', 'sm-final', 260, 320, 'Locked Out'),
      n('loggedIn', 'sm-state', -260, 480, 'Logged In'),
      n('refreshing', 'sm-state', -260, 640, 'Refreshing Token'),
    ],
    edges: [
      e('init', 'loggedOut', ''),
      e('loggedOut', 'authenticating', 'submit credentials'),
      e('authenticating', 'loggedOut', 'invalid credentials', back),
      e('authenticating', 'mfaChoice', 'credentials valid'),
      e('mfaChoice', 'mfaPending', '[MFA enabled]'),
      e('mfaChoice', 'loggedIn', '[MFA disabled]'),
      e('mfaPending', 'loggedIn', 'code valid'),
      e('mfaPending', 'locked', 'too many failed codes'),
      e('loggedIn', 'refreshing', 'access token expiring'),
      e('refreshing', 'loggedIn', 'refresh succeeds', back),
      e('refreshing', 'loggedOut', 'refresh token expired'),
      e('loggedIn', 'loggedOut', 'logout'),
    ],
  }),

  definePattern('pattern-sm-job-processing', 'Background Job Processing State Machine', '⚙️', {
    description: 'A queued job with bounded retry-with-backoff before landing in a dead-letter state — the real lifecycle behind any job queue worker.',
    tags: ['state-machine', 'fsm', 'example', 'backend', 'messaging'],
    nodes: [
      n('init', 'sm-initial', 0, -320),
      n('queued', 'sm-state', 0, -160, 'Queued'),
      n('running', 'sm-state', 0, 0, 'Running'),
      n('choice', 'sm-choice', 0, 160),
      n('succeeded', 'sm-final', -280, 320, 'Succeeded'),
      n('retryWait', 'sm-state', 280, 320, 'Waiting to Retry'),
      n('deadLetter', 'sm-final', 280, 480, 'Dead-Lettered'),
    ],
    edges: [
      e('init', 'queued', ''),
      e('queued', 'running', 'worker picks up job'),
      e('running', 'choice', 'job finishes'),
      e('choice', 'succeeded', '[success]'),
      e('choice', 'retryWait', '[failure, retries left]'),
      e('choice', 'deadLetter', '[failure, retries exhausted]'),
      e('retryWait', 'queued', 'backoff elapses', back),
    ],
  }),

  definePattern('pattern-sm-circuit-breaker', 'Circuit Breaker State Machine', '🔌', {
    description: 'The classic resilience pattern as its actual state machine: trips open on repeated failures, tests recovery half-open, and either resets or re-opens.',
    tags: ['state-machine', 'fsm', 'example', 'resilience', 'backend'],
    nodes: [
      n('init', 'sm-initial', 0, -260),
      n('closed', 'sm-state', 0, -100, 'Closed (calls flow)'),
      n('open', 'sm-state', -260, 100, 'Open (fails fast)'),
      n('halfOpen', 'sm-state', 0, 300, 'Half-Open (trial call)'),
    ],
    edges: [
      e('init', 'closed', ''),
      e('closed', 'open', 'failure threshold exceeded'),
      e('open', 'halfOpen', 'reset timeout elapses'),
      e('halfOpen', 'closed', 'trial call succeeds', back),
      e('halfOpen', 'open', 'trial call fails'),
    ],
  }),

  definePattern('pattern-sm-order-lifecycle', 'Order Lifecycle State Machine (with Returns & Refunds)', '📦', {
    description: 'A full e-commerce order: payment, fulfillment, delivery, and the post-delivery return/refund path most simple examples skip.',
    tags: ['state-machine', 'fsm', 'example', 'backend'],
    nodes: [
      n('init', 'sm-initial', 0, -320),
      n('created', 'sm-state', 0, -160, 'Created'),
      n('paid', 'sm-state', -260, 0, 'Paid'),
      n('cancelled', 'sm-final', 260, 0, 'Cancelled'),
      n('shipped', 'sm-state', -260, 160, 'Shipped'),
      n('delivered', 'sm-state', -260, 320, 'Delivered'),
      n('returnRequested', 'sm-state', -260, 480, 'Return Requested'),
      n('refunded', 'sm-final', -260, 640, 'Refunded'),
    ],
    edges: [
      e('init', 'created', ''),
      e('created', 'paid', 'payment received'),
      e('created', 'cancelled', 'customer cancels'),
      e('paid', 'cancelled', 'payment fails', back),
      e('paid', 'shipped', 'warehouse ships'),
      e('shipped', 'delivered', 'courier delivers'),
      e('delivered', 'returnRequested', 'customer requests return'),
      e('returnRequested', 'refunded', 'return received & approved'),
    ],
  }),

  definePattern('pattern-sm-payment-processing', 'Payment Processing State Machine', '💳', {
    description: 'Authorization, capture, and dispute handling — the states a real payment actually moves through, including a decline retry and a post-capture chargeback.',
    tags: ['state-machine', 'fsm', 'example', 'backend'],
    nodes: [
      n('init', 'sm-initial', 0, -320),
      n('pending', 'sm-state', 0, -160, 'Pending'),
      n('authorizing', 'sm-state', 0, 0, 'Authorizing'),
      n('declined', 'sm-final', 300, 160, 'Declined'),
      n('authorized', 'sm-state', -150, 160, 'Authorized'),
      n('captured', 'sm-state', -150, 320, 'Captured'),
      n('refunded', 'sm-final', -400, 480, 'Refunded'),
      n('disputed', 'sm-state', 100, 480, 'Disputed (Chargeback)'),
    ],
    edges: [
      e('init', 'pending', ''),
      e('pending', 'authorizing', 'submit to processor'),
      e('authorizing', 'authorized', 'issuer approves'),
      e('authorizing', 'declined', 'issuer declines'),
      e('authorized', 'captured', 'capture funds'),
      e('authorized', 'declined', 'authorization expires', back),
      e('captured', 'refunded', 'merchant refunds'),
      e('captured', 'disputed', 'cardholder disputes charge'),
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
];

export const components = [...stateShapes, ...statePatterns];
