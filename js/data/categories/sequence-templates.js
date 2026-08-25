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

  definePattern('seq-password-reset', 'Password Reset Flow', '🔁', {
    description: 'A user requests a password reset link by email, then uses it to set a new password.',
    tags: ['sequence', 'auth', 'password'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Auth Server', 'Email Service', 'Users DB'),
    edges: [
      msg('Client', 'Auth Server', 'POST /forgot-password (email)', 0.06),
      msg('Auth Server', 'Users DB', 'find user by email', 0.16),
      msg('Users DB', 'Auth Server', 'user found', 0.26, { isReturn: true }),
      msg('Auth Server', 'Auth Server', 'generate reset token (expires in 1h)', 0.36, { isSelf: true }),
      msg('Auth Server', 'Email Service', 'send reset link', 0.48),
      msg('Email Service', 'Client', 'reset link email', 0.58, { isReturn: true }),
      msg('Client', 'Auth Server', 'POST /reset-password (token + new password)', 0.72),
      msg('Auth Server', 'Users DB', 'update password hash', 0.84),
      msg('Auth Server', 'Client', '200 OK — password updated', 0.94, { isReturn: true }),
    ],
  }),

  definePattern('seq-magic-link-login', 'Passwordless Magic Link Login', '🪄', {
    description: 'A user logs in via a one-time link emailed to them instead of a password.',
    tags: ['sequence', 'auth', 'passwordless'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Auth Server', 'Email Service'),
    edges: [
      msg('Client', 'Auth Server', 'POST /login/magic-link (email)', 0.08),
      msg('Auth Server', 'Auth Server', 'generate one-time login token', 0.20, { isSelf: true }),
      msg('Auth Server', 'Email Service', 'send magic link', 0.32),
      msg('Email Service', 'Client', 'magic link email', 0.46, { isReturn: true }),
      msg('Client', 'Auth Server', 'GET /login/verify?token=...', 0.62),
      msg('Auth Server', 'Auth Server', 'validate token (single-use, not expired)', 0.74, { isSelf: true }),
      msg('Auth Server', 'Client', 'session token + redirect', 0.90, { isReturn: true }),
    ],
  }),

  definePattern('seq-webauthn-passkey', 'WebAuthn / Passkey Authentication', '🔏', {
    description: 'A user authenticates with a device passkey (biometric/PIN) instead of a password, per the WebAuthn standard.',
    tags: ['sequence', 'auth', 'webauthn', 'passkey'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Auth Server', 'Authenticator'),
    edges: [
      msg('Client', 'Auth Server', 'GET /webauthn/challenge', 0.06),
      msg('Auth Server', 'Client', 'challenge + allowed credentials', 0.16, { isReturn: true }),
      msg('Client', 'Authenticator', 'navigator.credentials.get(challenge)', 0.28),
      msg('Authenticator', 'Authenticator', 'user verifies (biometric/PIN), signs challenge', 0.38, { isSelf: true }),
      msg('Authenticator', 'Client', 'signed assertion', 0.50, { isReturn: true }),
      msg('Client', 'Auth Server', 'POST /webauthn/verify (assertion)', 0.64),
      msg('Auth Server', 'Auth Server', 'verify signature against stored public key', 0.74, { isSelf: true }),
      msg('Auth Server', 'Client', 'session token', 0.90, { isReturn: true }),
    ],
  }),

  definePattern('seq-oauth-client-credentials', 'OAuth Client Credentials (M2M)', '🤖', {
    description: 'A machine-to-machine service call authorized with the OAuth client-credentials grant — no user involved.',
    tags: ['sequence', 'auth', 'oauth', 'machine-to-machine'],
    groupOnInstantiate: true,
    nodes: lifelines('Service A', 'Auth Server', 'Service B'),
    edges: [
      msg('Service A', 'Auth Server', 'POST /token (client_id + client_secret)', 0.10),
      msg('Auth Server', 'Auth Server', 'validate client credentials', 0.24, { isSelf: true }),
      msg('Auth Server', 'Service A', 'access_token (scoped, short-lived)', 0.38, { isReturn: true }),
      msg('Service A', 'Service B', 'GET /resource (Bearer token)', 0.55),
      msg('Service B', 'Auth Server', 'introspect token', 0.68),
      msg('Auth Server', 'Service B', 'token valid, scopes', 0.78, { isReturn: true }),
      msg('Service B', 'Service A', '200 OK + data', 0.92, { isReturn: true }),
    ],
  }),

  definePattern('seq-websocket-handshake', 'WebSocket Handshake & Messaging', '🔌', {
    description: 'HTTP-to-WebSocket protocol upgrade, followed by bidirectional messages and a keep-alive ping/pong.',
    tags: ['sequence', 'networking', 'websocket', 'realtime'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Server'),
    edges: [
      msg('Client', 'Server', 'GET /ws (Upgrade: websocket)', 0.08),
      msg('Server', 'Client', '101 Switching Protocols', 0.20, { isReturn: true }),
      msg('Client', 'Server', 'message: subscribe channel', 0.34),
      msg('Server', 'Client', 'message: ack', 0.46, { isReturn: true }),
      msg('Server', 'Client', 'message: event push', 0.62),
      msg('Client', 'Server', 'ping', 0.76),
      msg('Server', 'Client', 'pong', 0.86, { isReturn: true }),
    ],
  }),

  definePattern('seq-webhook-delivery', 'Webhook Delivery with Retry', '🪝', {
    description: 'A source service delivers a signed webhook event; a failed delivery is retried with backoff.',
    tags: ['sequence', 'messaging', 'webhook', 'resilience'],
    groupOnInstantiate: true,
    nodes: lifelines('Source Service', 'Subscriber Endpoint'),
    edges: [
      msg('Source Service', 'Source Service', 'event occurs (order.created)', 0.06, { isSelf: true }),
      msg('Source Service', 'Subscriber Endpoint', 'POST /webhook (payload + HMAC signature)', 0.20),
      msg('Subscriber Endpoint', 'Subscriber Endpoint', 'verify signature', 0.32, { isSelf: true }),
      msg('Subscriber Endpoint', 'Source Service', '500 Internal Server Error', 0.44, { isReturn: true }),
      msg('Source Service', 'Source Service', 'wait backoff, schedule retry', 0.56, { isSelf: true }),
      msg('Source Service', 'Subscriber Endpoint', 'POST /webhook (retry #2, same payload)', 0.70),
      msg('Subscriber Endpoint', 'Subscriber Endpoint', 'verify signature', 0.82, { isSelf: true }),
      msg('Subscriber Endpoint', 'Source Service', '200 OK', 0.94, { isReturn: true }),
    ],
  }),

  definePattern('seq-circuit-breaker', 'Circuit Breaker Pattern', '🧯', {
    description: 'Repeated downstream failures trip a circuit breaker, which then fails fast without calling the downstream service.',
    tags: ['sequence', 'resilience', 'circuit-breaker'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Circuit Breaker', 'Downstream Service'),
    edges: [
      msg('Client', 'Circuit Breaker', 'call downstream service', 0.06),
      msg('Circuit Breaker', 'Circuit Breaker', 'state = closed, allow call', 0.15, { isSelf: true }),
      msg('Circuit Breaker', 'Downstream Service', 'forward request', 0.26),
      msg('Downstream Service', 'Circuit Breaker', 'timeout / error', 0.36, { isReturn: true }),
      msg('Circuit Breaker', 'Circuit Breaker', 'increment failure count', 0.46, { isSelf: true }),
      msg('Circuit Breaker', 'Client', 'error (failure recorded)', 0.56, { isReturn: true }),
      msg('Circuit Breaker', 'Circuit Breaker', 'failure threshold reached — state = open', 0.68, { isSelf: true }),
      msg('Client', 'Circuit Breaker', 'call downstream service', 0.80),
      msg('Circuit Breaker', 'Client', 'fail fast (short-circuited, no call made)', 0.94, { isReturn: true }),
    ],
  }),

  definePattern('seq-cache-aside', 'Cache-Aside Pattern', '🗂️', {
    description: 'A cache miss falls through to the database, populates the cache, then a repeat request hits the cache.',
    tags: ['sequence', 'caching', 'performance'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Service', 'Cache', 'Database'),
    edges: [
      msg('Client', 'Service', 'GET /product/123', 0.05),
      msg('Service', 'Cache', 'GET product:123', 0.14),
      msg('Cache', 'Service', 'cache miss', 0.23, { isReturn: true }),
      msg('Service', 'Database', 'SELECT * FROM products WHERE id=123', 0.34),
      msg('Database', 'Service', 'product row', 0.45, { isReturn: true }),
      msg('Service', 'Cache', 'SET product:123 (TTL 5m)', 0.56),
      msg('Service', 'Client', '200 OK + product', 0.66, { isReturn: true }),
      msg('Client', 'Service', 'GET /product/123 (again)', 0.80),
      msg('Service', 'Client', '200 OK + product (cache hit)', 0.92, { isReturn: true }),
    ],
  }),

  definePattern('seq-saga-choreography', 'Saga Pattern (Choreography)', '🧵', {
    description: 'A distributed transaction across services coordinated by events, with a compensating transaction when a step fails.',
    tags: ['sequence', 'architectural', 'saga', 'distributed-transaction'],
    groupOnInstantiate: true,
    nodes: lifelines('Order Service', 'Payment Service', 'Inventory Service'),
    edges: [
      msg('Order Service', 'Order Service', 'create order (pending)', 0.05, { isSelf: true }),
      msg('Order Service', 'Payment Service', 'event: OrderCreated', 0.16),
      msg('Payment Service', 'Payment Service', 'charge payment', 0.26, { isSelf: true }),
      msg('Payment Service', 'Inventory Service', 'event: PaymentCompleted', 0.38),
      msg('Inventory Service', 'Inventory Service', 'reserve stock (fails — out of stock)', 0.50, { isSelf: true }),
      msg('Inventory Service', 'Payment Service', 'event: InventoryReservationFailed', 0.62, { isReturn: true }),
      msg('Payment Service', 'Payment Service', 'refund payment (compensating transaction)', 0.74, { isSelf: true }),
      msg('Payment Service', 'Order Service', 'event: PaymentRefunded', 0.86, { isReturn: true }),
      msg('Order Service', 'Order Service', 'mark order cancelled', 0.95, { isSelf: true }),
    ],
  }),

  definePattern('seq-idempotency-key', 'Idempotent Request Handling', '🔁', {
    description: 'A client retries the same request with an idempotency key; the second attempt returns the cached result instead of double-processing it.',
    tags: ['sequence', 'resilience', 'api', 'idempotency'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'API Gateway', 'Payment Service'),
    edges: [
      msg('Client', 'API Gateway', 'POST /charge (Idempotency-Key: abc123)', 0.08),
      msg('API Gateway', 'Payment Service', 'forward request + idempotency key', 0.20),
      msg('Payment Service', 'Payment Service', 'check key store — not seen before', 0.32, { isSelf: true }),
      msg('Payment Service', 'Payment Service', 'process charge, store result under key', 0.46, { isSelf: true }),
      msg('Payment Service', 'API Gateway', '200 OK + charge id', 0.58, { isReturn: true }),
      msg('API Gateway', 'Client', '200 OK + charge id', 0.68, { isReturn: true }),
      msg('Client', 'API Gateway', 'POST /charge (same key, retry after timeout)', 0.80),
      msg('API Gateway', 'Payment Service', 'forward request + idempotency key', 0.88),
      msg('Payment Service', 'API Gateway', '200 OK + charge id (cached, not re-charged)', 0.96, { isReturn: true }),
    ],
  }),

  definePattern('seq-two-phase-commit', 'Two-Phase Commit', '🤝', {
    description: 'A coordinator asks all participants to vote, then commits (or aborts) only once every vote is in — the classic distributed-transaction protocol.',
    tags: ['sequence', 'architectural', 'distributed-transaction', '2pc'],
    groupOnInstantiate: true,
    nodes: lifelines('Coordinator', 'Participant A', 'Participant B'),
    edges: [
      msg('Coordinator', 'Participant A', 'PREPARE', 0.05),
      msg('Coordinator', 'Participant B', 'PREPARE', 0.14),
      msg('Participant A', 'Coordinator', 'VOTE COMMIT', 0.24, { isReturn: true }),
      msg('Participant B', 'Coordinator', 'VOTE COMMIT', 0.34, { isReturn: true }),
      msg('Coordinator', 'Coordinator', 'all votes yes — decide COMMIT', 0.44, { isSelf: true }),
      msg('Coordinator', 'Participant A', 'COMMIT', 0.58),
      msg('Coordinator', 'Participant B', 'COMMIT', 0.68),
      msg('Participant A', 'Coordinator', 'ACK', 0.80, { isReturn: true }),
      msg('Participant B', 'Coordinator', 'ACK', 0.92, { isReturn: true }),
    ],
  }),

  definePattern('seq-outbox-pattern', 'Outbox Pattern', '📤', {
    description: 'A service writes its business row and an outbox event in one local transaction; a relay polls the outbox and publishes to a broker, avoiding the dual-write problem.',
    tags: ['sequence', 'architectural', 'messaging', 'outbox'],
    groupOnInstantiate: true,
    nodes: lifelines('Service', 'Database', 'Outbox Relay', 'Message Broker'),
    edges: [
      msg('Service', 'Database', 'INSERT order row + INSERT outbox event (same tx)', 0.06),
      msg('Database', 'Service', 'COMMIT ok', 0.16, { isReturn: true }),
      msg('Outbox Relay', 'Database', 'poll unprocessed outbox rows', 0.30),
      msg('Database', 'Outbox Relay', 'rows', 0.40, { isReturn: true }),
      msg('Outbox Relay', 'Message Broker', 'publish event', 0.54),
      msg('Message Broker', 'Outbox Relay', 'ack', 0.64, { isReturn: true }),
      msg('Outbox Relay', 'Database', 'mark row processed', 0.78),
      msg('Database', 'Outbox Relay', 'ok', 0.90, { isReturn: true }),
    ],
  }),

  definePattern('seq-event-sourcing-cqrs', 'Event Sourcing / CQRS Command Flow', '🧾', {
    description: 'A command is validated and appended as an event to an event store, which then publishes it to update a separate read-model projection.',
    tags: ['sequence', 'architectural', 'event-sourcing', 'cqrs'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Command Handler', 'Event Store', 'Projection'),
    edges: [
      msg('Client', 'Command Handler', 'POST /orders (PlaceOrder command)', 0.06),
      msg('Command Handler', 'Command Handler', 'validate command', 0.16, { isSelf: true }),
      msg('Command Handler', 'Event Store', 'append OrderPlaced event', 0.30),
      msg('Event Store', 'Command Handler', 'appended, version 1', 0.42, { isReturn: true }),
      msg('Command Handler', 'Client', '202 Accepted', 0.54, { isReturn: true }),
      msg('Event Store', 'Projection', 'publish OrderPlaced event', 0.70),
      msg('Projection', 'Projection', 'update read model', 0.85, { isSelf: true }),
    ],
  }),

  definePattern('seq-grpc-unary', 'gRPC Unary Call', '📡', {
    description: 'A client sends a single protobuf request and gets a single response back, with call metadata and a deadline.',
    tags: ['sequence', 'networking', 'grpc', 'rpc'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'gRPC Server'),
    edges: [
      msg('Client', 'Client', 'build request message (protobuf)', 0.10, { isSelf: true }),
      msg('Client', 'gRPC Server', 'UnaryCall(request) + metadata (deadline=5s)', 0.30),
      msg('gRPC Server', 'gRPC Server', 'deserialize, handle request', 0.50, { isSelf: true }),
      msg('gRPC Server', 'Client', 'response message + status=OK', 0.75, { isReturn: true }),
    ],
  }),

  definePattern('seq-graphql-query', 'GraphQL Query Resolution', '◈', {
    description: 'A GraphQL server parses one query and resolves its fields by calling multiple backing services, then merges the results into one response.',
    tags: ['sequence', 'api', 'graphql'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'GraphQL Server', 'Users Service', 'Orders Service'),
    edges: [
      msg('Client', 'GraphQL Server', 'POST /graphql { user { orders } }', 0.06),
      msg('GraphQL Server', 'GraphQL Server', 'parse & validate query', 0.16, { isSelf: true }),
      msg('GraphQL Server', 'Users Service', 'resolve user(id)', 0.30),
      msg('Users Service', 'GraphQL Server', 'user data', 0.42, { isReturn: true }),
      msg('GraphQL Server', 'Orders Service', 'resolve orders(userId)', 0.56),
      msg('Orders Service', 'GraphQL Server', 'orders data', 0.68, { isReturn: true }),
      msg('GraphQL Server', 'Client', '200 OK + merged JSON', 0.85, { isReturn: true }),
    ],
  }),

  definePattern('seq-presigned-upload', 'Presigned URL File Upload', '📎', {
    description: 'An app server issues a short-lived presigned URL, then the client uploads the file bytes directly to object storage without routing them through the server.',
    tags: ['sequence', 'storage', 'upload', 'presigned-url'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'App Server', 'Object Storage'),
    edges: [
      msg('Client', 'App Server', 'POST /uploads/presign (filename)', 0.05),
      msg('App Server', 'App Server', 'generate presigned PUT URL', 0.14, { isSelf: true }),
      msg('App Server', 'Client', 'presigned URL', 0.24, { isReturn: true }),
      msg('Client', 'Object Storage', 'PUT <presigned URL> (file bytes)', 0.40),
      msg('Object Storage', 'Client', '200 OK', 0.52, { isReturn: true }),
      msg('Client', 'App Server', 'POST /uploads/complete (key)', 0.66),
      msg('App Server', 'App Server', 'record upload metadata', 0.76, { isSelf: true }),
      msg('App Server', 'Client', '200 OK', 0.90, { isReturn: true }),
    ],
  }),

  definePattern('seq-kafka-rebalance', 'Kafka Consumer-Group Rebalance', '🔄', {
    description: 'A new consumer joining a group triggers the group coordinator to pause, recompute, and reassign partitions across all members.',
    tags: ['sequence', 'messaging', 'kafka', 'rebalance'],
    groupOnInstantiate: true,
    nodes: lifelines('Consumer A', 'Consumer B', 'Group Coordinator'),
    edges: [
      msg('Consumer B', 'Group Coordinator', 'JoinGroup (new member)', 0.05),
      msg('Group Coordinator', 'Group Coordinator', 'trigger rebalance', 0.14, { isSelf: true }),
      msg('Group Coordinator', 'Consumer A', 'revoke partitions (rebalance in progress)', 0.24),
      msg('Consumer A', 'Group Coordinator', 'JoinGroup (rejoin)', 0.36),
      msg('Group Coordinator', 'Group Coordinator', 'compute new partition assignment', 0.46, { isSelf: true }),
      msg('Group Coordinator', 'Consumer A', 'SyncGroup response (partitions 0-2)', 0.58, { isReturn: true }),
      msg('Group Coordinator', 'Consumer B', 'SyncGroup response (partitions 3-5)', 0.68, { isReturn: true }),
      msg('Consumer A', 'Consumer A', 'resume consuming assigned partitions', 0.80, { isSelf: true }),
      msg('Consumer B', 'Consumer B', 'resume consuming assigned partitions', 0.92, { isSelf: true }),
    ],
  }),

  definePattern('seq-distributed-lock', 'Distributed Lock Acquisition', '🔒', {
    description: 'Two clients race for the same lock key; only one gets it and the other waits and retries once it\'s released.',
    tags: ['sequence', 'resilience', 'concurrency', 'distributed-lock'],
    groupOnInstantiate: true,
    nodes: lifelines('Client A', 'Client B', 'Lock Service'),
    edges: [
      msg('Client A', 'Lock Service', 'SET lock:resource NX PX 30000', 0.05),
      msg('Lock Service', 'Client A', 'OK (lock acquired)', 0.14, { isReturn: true }),
      msg('Client B', 'Lock Service', 'SET lock:resource NX PX 30000', 0.26),
      msg('Lock Service', 'Client B', 'null (already locked)', 0.36, { isReturn: true }),
      msg('Client B', 'Client B', 'wait and retry', 0.46, { isSelf: true }),
      msg('Client A', 'Client A', 'perform critical section work', 0.58, { isSelf: true }),
      msg('Client A', 'Lock Service', 'DEL lock:resource (release)', 0.70),
      msg('Client B', 'Lock Service', 'SET lock:resource NX PX 30000 (retry)', 0.82),
      msg('Lock Service', 'Client B', 'OK (lock acquired)', 0.94, { isReturn: true }),
    ],
  }),

  definePattern('seq-mtls-handshake', 'Service Mesh mTLS Handshake', '🔐', {
    description: 'Two sidecar proxies mutually authenticate each other\'s certificates against the mesh CA before letting application traffic through.',
    tags: ['sequence', 'networking', 'security', 'mtls', 'service-mesh'],
    groupOnInstantiate: true,
    nodes: lifelines('Service A Sidecar', 'Service B Sidecar'),
    edges: [
      msg('Service A Sidecar', 'Service B Sidecar', 'TLS ClientHello (offers cert)', 0.06),
      msg('Service B Sidecar', 'Service A Sidecar', 'ServerHello + server cert', 0.18, { isReturn: true }),
      msg('Service A Sidecar', 'Service A Sidecar', 'verify server cert against mesh CA', 0.30, { isSelf: true }),
      msg('Service A Sidecar', 'Service B Sidecar', 'client cert + Finished', 0.46),
      msg('Service B Sidecar', 'Service B Sidecar', 'verify client cert, check SPIFFE identity', 0.58, { isSelf: true }),
      msg('Service B Sidecar', 'Service A Sidecar', 'Finished — mTLS established', 0.72, { isReturn: true }),
      msg('Service A Sidecar', 'Service B Sidecar', 'encrypted application request', 0.90),
    ],
  }),

  definePattern('seq-canary-deployment', 'Blue-Green / Canary Deployment Traffic Shift', '🐤', {
    description: 'A load balancer gradually shifts traffic from the stable version to a canary release while monitoring for errors, then drains the old version once it\'s healthy.',
    tags: ['sequence', 'devops', 'deployment', 'canary', 'blue-green'],
    groupOnInstantiate: true,
    nodes: lifelines('Load Balancer', 'Stable (Blue)', 'Canary (Green)'),
    edges: [
      msg('Load Balancer', 'Stable (Blue)', 'request (100% traffic)', 0.04),
      msg('Stable (Blue)', 'Load Balancer', 'response', 0.12, { isReturn: true }),
      msg('Load Balancer', 'Load Balancer', 'shift 10% traffic to canary', 0.22, { isSelf: true }),
      msg('Load Balancer', 'Canary (Green)', 'request (10% traffic)', 0.34),
      msg('Canary (Green)', 'Load Balancer', 'response', 0.44, { isReturn: true }),
      msg('Load Balancer', 'Load Balancer', 'monitor error rate — healthy, increase to 100%', 0.54, { isSelf: true }),
      msg('Load Balancer', 'Canary (Green)', 'request (100% traffic)', 0.66),
      msg('Canary (Green)', 'Load Balancer', 'response', 0.76, { isReturn: true }),
      msg('Load Balancer', 'Stable (Blue)', 'drain connections', 0.86),
      msg('Load Balancer', 'Stable (Blue)', 'terminate old version', 0.95),
    ],
  }),

  definePattern('seq-dns-resolution', 'DNS Resolution Flow', '🧭', {
    description: 'A recursive resolver walks the DNS hierarchy — root, TLD, then authoritative server — to resolve a hostname, and caches the result.',
    tags: ['sequence', 'networking', 'dns'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'Resolver', 'Root Server', 'TLD Server', 'Authoritative Server'),
    edges: [
      msg('Client', 'Resolver', 'resolve www.example.com', 0.04),
      msg('Resolver', 'Root Server', 'query www.example.com', 0.14),
      msg('Root Server', 'Resolver', 'referral: .com TLD servers', 0.24, { isReturn: true }),
      msg('Resolver', 'TLD Server', 'query www.example.com', 0.36),
      msg('TLD Server', 'Resolver', 'referral: example.com authoritative NS', 0.46, { isReturn: true }),
      msg('Resolver', 'Authoritative Server', 'query www.example.com', 0.58),
      msg('Authoritative Server', 'Resolver', 'A record: 93.184.216.34', 0.68, { isReturn: true }),
      msg('Resolver', 'Resolver', 'cache result (TTL)', 0.78, { isSelf: true }),
      msg('Resolver', 'Client', '93.184.216.34', 0.92, { isReturn: true }),
    ],
  }),

  definePattern('seq-social-login', 'Social / Federated Login', '🌍', {
    description: 'A user signs in through a third-party identity provider (e.g. Google) instead of a local password, and the app finds or creates a matching local account.',
    tags: ['sequence', 'auth', 'oauth', 'social-login', 'federated'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'App Server', 'Google (Identity Provider)'),
    edges: [
      msg('Client', 'App Server', 'GET /login/google', 0.04),
      msg('App Server', 'Client', '302 redirect to Google OAuth consent', 0.12, { isReturn: true }),
      msg('Client', 'Google (Identity Provider)', 'GET /oauth/authorize?client_id=...', 0.22),
      msg('Google (Identity Provider)', 'Client', 'user approves, redirect w/ code', 0.32, { isReturn: true }),
      msg('Client', 'App Server', 'GET /callback?code=...', 0.42),
      msg('App Server', 'Google (Identity Provider)', 'POST /token (exchange code)', 0.52),
      msg('Google (Identity Provider)', 'App Server', 'access_token + id_token', 0.62, { isReturn: true }),
      msg('App Server', 'Google (Identity Provider)', 'GET /userinfo', 0.72),
      msg('Google (Identity Provider)', 'App Server', 'profile (email, name)', 0.80, { isReturn: true }),
      msg('App Server', 'App Server', 'find-or-create local user by email', 0.88, { isSelf: true }),
      msg('App Server', 'Client', '200 OK + session', 0.96, { isReturn: true }),
    ],
  }),

  definePattern('seq-step-up-auth', 'Step-Up Authentication', '⬆️', {
    description: 'A sensitive action triggers a fresh, stronger authentication challenge even though the user already has a valid session.',
    tags: ['sequence', 'auth', 'step-up', 'authorization'],
    groupOnInstantiate: true,
    nodes: lifelines('Client', 'App Server', 'Auth Server'),
    edges: [
      msg('Client', 'App Server', 'POST /transfer (amount=$50000)', 0.04),
      msg('App Server', 'App Server', 'check action risk — requires step-up', 0.13, { isSelf: true }),
      msg('App Server', 'Client', '401 step_up_required', 0.24, { isReturn: true }),
      msg('Client', 'Auth Server', 'POST /mfa/challenge (re-authenticate)', 0.36),
      msg('Auth Server', 'Client', 'deliver OTP', 0.46, { isReturn: true }),
      msg('Client', 'Auth Server', 'POST /mfa/verify (otp)', 0.58),
      msg('Auth Server', 'Client', 'step-up token (acr=high)', 0.68, { isReturn: true }),
      msg('Client', 'App Server', 'POST /transfer (amount=$50000, step-up token)', 0.80),
      msg('App Server', 'App Server', 'verify step-up token satisfies required assurance level', 0.88, { isSelf: true }),
      msg('App Server', 'Client', '200 OK — transfer completed', 0.96, { isReturn: true }),
    ],
  }),

  fragment('shape-fragment-alt', 'Alt Fragment', '🔀', 'alt', 'UML "alt" combined fragment — alternative branches based on a condition. Drop it behind messages (right-click → Send to back) to enclose them; set the condition by renaming the box.'),
  fragment('shape-fragment-opt', 'Opt Fragment', '❔', 'opt', 'UML "opt" combined fragment — an optional branch that only runs if its condition holds.'),
  fragment('shape-fragment-loop', 'Loop Fragment', '🔁', 'loop', 'UML "loop" combined fragment — the enclosed messages repeat while the condition holds.'),
  fragment('shape-fragment-par', 'Par Fragment', '⏸️', 'par', 'UML "par" combined fragment — the enclosed messages run concurrently/in parallel.'),
  fragment('shape-fragment-critical', 'Critical Fragment', '⚠️', 'critical', 'UML "critical" combined fragment — the enclosed messages form a critical region that cannot be interrupted (e.g. must run atomically).'),
  fragment('shape-fragment-break', 'Break Fragment', '🛑', 'break', 'UML "break" combined fragment — an exceptional branch that, once entered, stops the rest of the enclosing sequence from running.'),
];
