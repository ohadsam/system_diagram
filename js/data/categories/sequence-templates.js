import { c, definePattern } from '../schema.js';

// Ready-made sequence diagrams — same "instantiate a whole blueprint at
// once" mechanism as Design Patterns (definePattern), just built entirely
// out of `shape-lifeline` nodes and straight, offset-anchored message edges
// instead of a component graph. `groupOnInstantiate: true` (new optional
// field on definePattern, see schema.js) means the result lands as a real
// "sequence diagram group" immediately — background box, 🔍 zoom-in — not
// just a loose cluster of lifelines a user would have to select-and-group
// themselves. See docs/SPEC.md 4.15.
export const category = { id: 'sequence-templates', label: 'Sequence Diagram Templates', color: '#7C3AED' };

const GAP = 220;

/** Evenly spaces `names.length` lifelines around dx=0, same gap the
 * "🔀 Sequence Diagram" wizard itself uses (core/sequenceDiagram.js). */
function lifelines(...names) {
  const startDx = -((names.length - 1) * GAP) / 2;
  return names.map((label, i) => ({ key: label, defId: 'shape-lifeline', dx: startDx + i * GAP, dy: 0, label }));
}

/** A message edge with a real, distinct fromOffset/toOffset (0..1 down the
 * lifeline) — the one thing that matters for a sequence-diagram template to
 * actually be readable; two edges sharing an offset stack on the same
 * point. `isReturn` applies the dashed-line UML convention for a
 * response, matching the arrow style editor's "↩️ Mark as return" preset. */
function msg(from, to, label, offset, { isReturn = false, isSelf = false } = {}) {
  return {
    from,
    to,
    overrides: {
      label,
      routing: 'straight',
      fromOffset: offset,
      toOffset: isSelf ? offset + 0.06 : offset,
      dash: isReturn ? 'dashed' : 'solid',
      startArrow: 'none',
      endArrow: isReturn ? 'open' : 'filled',
      ...(isSelf ? { fromSide: 'right', toSide: 'right' } : {}),
    },
  };
}

/** UML combined-fragment box — a plain resizable/movable labeled rect (same
 * mechanism as the "Group / Container" shape in shapes.js) with a
 * fragmentType baked into the def, so it always renders its pentagon
 * operator tag (canvas/node.js) without any follow-up setup. Deliberately
 * one condition per box (node.text) — no alt/else divider line, per
 * docs/SPEC.md. */
function fragment(id, name, icon, fragmentType, description) {
  return c(id, name, icon, {
    shape: 'rect', color: '#7C3AED', fragmentType,
    defaultSize: { w: 300, h: 180 }, textPosition: 'top', iconVisible: false,
    description, tags: ['sequence', 'fragment', fragmentType],
  });
}

export const components = [
  definePattern('seq-login-flow', 'Login Flow', '🔐', {
    description: 'Client authenticates through a server, an auth service, and a users database.',
    tags: ['sequence', 'auth'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Server', 'Auth Service', 'Users DB'),
    edges: [
      msg('Client', 'Server', 'POST /login', 0.08),
      msg('Server', 'Auth Service', 'validate credentials', 0.20),
      msg('Auth Service', 'Users DB', 'find user by email', 0.32),
      msg('Users DB', 'Auth Service', 'user record', 0.44, { isReturn: true }),
      msg('Auth Service', 'Auth Service', 'verify password hash', 0.54, { isSelf: true }),
      msg('Auth Service', 'Server', 'session token', 0.70, { isReturn: true }),
      msg('Server', 'Client', '200 OK + Set-Cookie', 0.85, { isReturn: true }),
    ],
  }),

  definePattern('seq-oauth-handshake', 'OAuth Handshake', '🪪', {
    description: 'Authorization-code OAuth flow between a client, an app server, and an auth provider.',
    tags: ['sequence', 'auth'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'App Server', 'Auth Provider'),
    edges: [
      msg('Client', 'App Server', 'GET /login', 0.06),
      msg('App Server', 'Client', '302 redirect to Auth Provider', 0.15, { isReturn: true }),
      msg('Client', 'Auth Provider', 'GET /authorize?client_id=...', 0.27),
      msg('Auth Provider', 'Client', 'user approves, redirect w/ code', 0.38, { isReturn: true }),
      msg('Client', 'App Server', 'GET /callback?code=...', 0.50),
      msg('App Server', 'Auth Provider', 'POST /token (exchange code)', 0.62),
      msg('Auth Provider', 'App Server', 'access_token + id_token', 0.74, { isReturn: true }),
      msg('App Server', 'Client', '200 OK + session', 0.87, { isReturn: true }),
    ],
  }),

  definePattern('seq-checkout-flow', 'Checkout Flow', '🛒', {
    description: 'Client checks out through an order service that coordinates inventory and payment.',
    tags: ['sequence', 'e-commerce'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Order Service', 'Payment Service', 'Inventory Service'),
    edges: [
      msg('Client', 'Order Service', 'POST /checkout', 0.08),
      msg('Order Service', 'Inventory Service', 'reserve items', 0.20),
      msg('Inventory Service', 'Order Service', 'reserved', 0.31, { isReturn: true }),
      msg('Order Service', 'Payment Service', 'charge card', 0.44),
      msg('Payment Service', 'Order Service', 'payment confirmed', 0.57, { isReturn: true }),
      msg('Order Service', 'Order Service', 'create order record', 0.66, { isSelf: true }),
      msg('Order Service', 'Client', '200 OK + order id', 0.85, { isReturn: true }),
    ],
  }),

  definePattern('seq-retry-backoff', 'Retry with Backoff', '🔁', {
    description: 'A client call to a flaky downstream API, retried with increasing backoff until it succeeds.',
    tags: ['sequence', 'resilience'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Service', 'Downstream API'),
    edges: [
      msg('Client', 'Service', 'request', 0.05),
      msg('Service', 'Downstream API', 'call (attempt 1)', 0.14),
      msg('Downstream API', 'Service', 'timeout / 503', 0.23, { isReturn: true }),
      msg('Service', 'Service', 'wait backoff (100ms)', 0.30, { isSelf: true }),
      msg('Service', 'Downstream API', 'call (attempt 2)', 0.44),
      msg('Downstream API', 'Service', 'timeout / 503', 0.53, { isReturn: true }),
      msg('Service', 'Service', 'wait backoff (200ms)', 0.60, { isSelf: true }),
      msg('Service', 'Downstream API', 'call (attempt 3)', 0.74),
      msg('Downstream API', 'Service', '200 OK', 0.83, { isReturn: true }),
      msg('Service', 'Client', '200 OK', 0.92, { isReturn: true }),
    ],
  }),

  definePattern('seq-pkce-flow', 'PKCE Authorization Flow', '🔑', {
    description: 'OAuth 2.0 Authorization Code flow with PKCE — the standard for SPAs and mobile apps that can\'t keep a client secret.',
    tags: ['sequence', 'auth', 'oauth', 'pkce'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Auth Server', 'Resource Server'),
    edges: [
      msg('Client', 'Client', 'generate code_verifier + code_challenge', 0.05, { isSelf: true }),
      msg('Client', 'Auth Server', 'GET /authorize?code_challenge=...', 0.16),
      msg('Auth Server', 'Client', '302 redirect + authorization code', 0.28, { isReturn: true }),
      msg('Client', 'Auth Server', 'POST /token (code + code_verifier)', 0.42),
      msg('Auth Server', 'Auth Server', 'verify code_verifier matches challenge', 0.52, { isSelf: true }),
      msg('Auth Server', 'Client', 'access_token + refresh_token', 0.66, { isReturn: true }),
      msg('Client', 'Resource Server', 'GET /resource (Bearer token)', 0.80),
      msg('Resource Server', 'Client', '200 OK + data', 0.92, { isReturn: true }),
    ],
  }),

  definePattern('seq-scim-provisioning', 'SCIM User Provisioning', '🧑‍💼', {
    description: 'An identity provider provisions and later deprovisions a user via a SCIM endpoint.',
    tags: ['sequence', 'auth', 'scim', 'identity'],
    groupOnInstantiate: true,
    nodes: lifelines('Identity Provider', 'SCIM Endpoint', 'Users DB'),
    edges: [
      msg('Identity Provider', 'SCIM Endpoint', 'POST /Users (create)', 0.07),
      msg('SCIM Endpoint', 'SCIM Endpoint', 'validate SCIM schema', 0.16, { isSelf: true }),
      msg('SCIM Endpoint', 'Users DB', 'insert user record', 0.28),
      msg('Users DB', 'SCIM Endpoint', 'user id', 0.38, { isReturn: true }),
      msg('SCIM Endpoint', 'Identity Provider', '201 Created', 0.48, { isReturn: true }),
      msg('Identity Provider', 'SCIM Endpoint', 'PATCH /Users/{id} (deactivate)', 0.64),
      msg('SCIM Endpoint', 'Users DB', 'mark user inactive', 0.76),
      msg('Users DB', 'SCIM Endpoint', 'ok', 0.86, { isReturn: true }),
      msg('SCIM Endpoint', 'Identity Provider', '200 OK', 0.94, { isReturn: true }),
    ],
  }),

  definePattern('seq-mfa-challenge', 'MFA Challenge', '🔐', {
    description: 'Password login followed by a one-time-passcode multi-factor challenge before a session is issued.',
    tags: ['sequence', 'auth', 'mfa', '2fa'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Auth Server', 'MFA Service'),
    edges: [
      msg('Client', 'Auth Server', 'POST /login (username + password)', 0.06),
      msg('Auth Server', 'Auth Server', 'verify password', 0.15, { isSelf: true }),
      msg('Auth Server', 'MFA Service', 'request OTP challenge', 0.26),
      msg('MFA Service', 'Client', 'deliver OTP (SMS / push)', 0.38, { isReturn: true }),
      msg('Client', 'Auth Server', 'POST /mfa/verify (otp code)', 0.52),
      msg('Auth Server', 'MFA Service', 'verify otp', 0.64),
      msg('MFA Service', 'Auth Server', 'valid', 0.75, { isReturn: true }),
      msg('Auth Server', 'Client', 'session token', 0.90, { isReturn: true }),
    ],
  }),

  definePattern('seq-rbac-check', 'RBAC Authorization Check', '🛡️', {
    description: 'A gateway validates a token and checks the caller\'s roles before permitting a request (role-based access control).',
    tags: ['sequence', 'auth', 'rbac', 'authorization'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'API Gateway', 'Auth Service'),
    edges: [
      msg('Client', 'API Gateway', 'request + JWT', 0.08),
      msg('API Gateway', 'Auth Service', 'validate token, get roles', 0.22),
      msg('Auth Service', 'Auth Service', 'decode JWT, extract roles', 0.33, { isSelf: true }),
      msg('Auth Service', 'API Gateway', 'roles: [admin]', 0.46, { isReturn: true }),
      msg('API Gateway', 'API Gateway', 'check role permits this action', 0.58, { isSelf: true }),
      msg('API Gateway', 'Client', '200 OK (permitted)', 0.85, { isReturn: true }),
    ],
  }),

  definePattern('seq-abac-check', 'ABAC Authorization Check', '🧮', {
    description: 'A policy decision point evaluates subject/resource/action/context attributes against policy (attribute-based access control).',
    tags: ['sequence', 'auth', 'abac', 'authorization'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Policy Enforcement Point', 'Policy Decision Point', 'Attribute Store'),
    edges: [
      msg('Client', 'Policy Enforcement Point', 'request resource', 0.06),
      msg('Policy Enforcement Point', 'Policy Decision Point', 'evaluate(subject, resource, action, context)', 0.18),
      msg('Policy Decision Point', 'Attribute Store', 'fetch attributes', 0.30),
      msg('Attribute Store', 'Policy Decision Point', 'attributes', 0.40, { isReturn: true }),
      msg('Policy Decision Point', 'Policy Decision Point', 'evaluate policy rules', 0.50, { isSelf: true }),
      msg('Policy Decision Point', 'Policy Enforcement Point', 'Permit', 0.64, { isReturn: true }),
      msg('Policy Enforcement Point', 'Client', '200 OK', 0.85, { isReturn: true }),
    ],
  }),

  definePattern('seq-sso-saml', 'SSO (SAML / OIDC)', '🪄', {
    description: 'Single sign-on redirect flow between a service provider and an identity provider.',
    tags: ['sequence', 'auth', 'sso', 'saml', 'oidc'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Service Provider', 'Identity Provider'),
    edges: [
      msg('Client', 'Service Provider', 'GET /protected-resource', 0.05),
      msg('Service Provider', 'Client', '302 redirect to Identity Provider', 0.15, { isReturn: true }),
      msg('Client', 'Identity Provider', 'GET /sso?SAMLRequest=...', 0.27),
      msg('Identity Provider', 'Identity Provider', 'authenticate user', 0.36, { isSelf: true }),
      msg('Identity Provider', 'Client', '302 redirect + SAML assertion', 0.50, { isReturn: true }),
      msg('Client', 'Service Provider', 'POST /acs (assertion)', 0.64),
      msg('Service Provider', 'Service Provider', 'validate assertion, create session', 0.74, { isSelf: true }),
      msg('Service Provider', 'Client', '200 OK + session cookie', 0.90, { isReturn: true }),
    ],
  }),

  definePattern('seq-spa-silent-refresh', 'SPA Silent Token Refresh', '🌐', {
    description: 'A single-page app silently renews its session and rotates an expired access token without a full-page redirect.',
    tags: ['sequence', 'auth', 'spa', 'oauth'],
    groupOnInstantiate: true,
    nodes: lifelines('SPA', 'Auth Server', 'API'),
    edges: [
      msg('SPA', 'Auth Server', 'silent auth (hidden iframe, prompt=none)', 0.05),
      msg('Auth Server', 'Auth Server', 'check existing session cookie', 0.14, { isSelf: true }),
      msg('Auth Server', 'SPA', 'access_token + id_token', 0.25, { isReturn: true }),
      msg('SPA', 'API', 'GET /data (Bearer access_token)', 0.38),
      msg('API', 'SPA', '401 Unauthorized (expired)', 0.48, { isReturn: true }),
      msg('SPA', 'Auth Server', 'POST /token (refresh_token grant)', 0.60),
      msg('Auth Server', 'Auth Server', 'rotate refresh token', 0.69, { isSelf: true }),
      msg('Auth Server', 'SPA', 'new access_token', 0.80, { isReturn: true }),
      msg('SPA', 'API', 'GET /data (new Bearer token)', 0.90),
      msg('API', 'SPA', '200 OK + data', 0.97, { isReturn: true }),
    ],
  }),

  definePattern('seq-api-key-auth', 'API Key Authentication', '🗝️', {
    description: 'A static API key is validated by a gateway before a request reaches the backend service.',
    tags: ['sequence', 'auth', 'api-key'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'API Gateway', 'Auth Service', 'Backend Service'),
    edges: [
      msg('Client', 'API Gateway', 'GET /data (X-API-Key: ...)', 0.08),
      msg('API Gateway', 'Auth Service', 'validate API key', 0.22),
      msg('Auth Service', 'Auth Service', 'lookup key, check active + quota', 0.33, { isSelf: true }),
      msg('Auth Service', 'API Gateway', 'valid, owner=acme-corp', 0.46, { isReturn: true }),
      msg('API Gateway', 'Backend Service', 'GET /data', 0.60),
      msg('Backend Service', 'API Gateway', '200 OK + data', 0.72, { isReturn: true }),
      msg('API Gateway', 'Client', '200 OK + data', 0.85, { isReturn: true }),
    ],
  }),

  definePattern('seq-tcp-handshake', 'TCP 3-Way Handshake', '📶', {
    description: 'Connection setup (SYN, SYN-ACK, ACK) and graceful teardown (FIN/ACK) between a client and a server.',
    tags: ['sequence', 'networking', 'tcp'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Server'),
    edges: [
      msg('Client', 'Server', 'SYN (seq=100)', 0.06),
      msg('Server', 'Client', 'SYN-ACK (seq=300, ack=101)', 0.17, { isReturn: true }),
      msg('Client', 'Server', 'ACK (ack=301)', 0.28),
      msg('Client', 'Server', 'FIN (seq=101)', 0.55),
      msg('Server', 'Client', 'ACK (ack=102)', 0.66, { isReturn: true }),
      msg('Server', 'Client', 'FIN (seq=300)', 0.78),
      msg('Client', 'Server', 'ACK (ack=301)', 0.90, { isReturn: true }),
    ],
  }),

  definePattern('seq-udp-exchange', 'UDP Request/Response', '📡', {
    description: 'Connectionless datagram exchange — no handshake, no delivery guarantee, each request is independent.',
    tags: ['sequence', 'networking', 'udp'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Server'),
    edges: [
      msg('Client', 'Server', 'datagram: request #1', 0.10),
      msg('Server', 'Server', 'process request (no ack expected)', 0.22, { isSelf: true }),
      msg('Server', 'Client', 'datagram: response #1', 0.38, { isReturn: true }),
      msg('Client', 'Server', 'datagram: request #2 (independent)', 0.60),
      msg('Server', 'Client', 'datagram: response #2', 0.85, { isReturn: true }),
    ],
  }),

  fragment('shape-fragment-alt', 'Alt Fragment', '🔀', 'alt', 'UML "alt" combined fragment — alternative branches based on a condition. Drop it behind messages (right-click → Send to back) to enclose them; set the condition by renaming the box.'),
  fragment('shape-fragment-opt', 'Opt Fragment', '❔', 'opt', 'UML "opt" combined fragment — an optional branch that only runs if its condition holds.'),
  fragment('shape-fragment-loop', 'Loop Fragment', '🔁', 'loop', 'UML "loop" combined fragment — the enclosed messages repeat while the condition holds.'),
  fragment('shape-fragment-par', 'Par Fragment', '⏸️', 'par', 'UML "par" combined fragment — the enclosed messages run concurrently/in parallel.'),
];
