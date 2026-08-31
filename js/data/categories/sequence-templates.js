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
    description: 'A layered login: the server never touches the database directly, delegating credential checks to a dedicated auth service that can be reused, scaled, or swapped independently. The password itself is never compared as plaintext — the stored value is a hash, so the auth service verifies by re-hashing the submitted password and comparing hashes, meaning even a full database leak doesn\'t hand out real passwords. The returned session token (via Set-Cookie) lets the browser stay authenticated on future requests without resending credentials every time.',
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
    description: 'The redirect through the Auth Provider exists so the app server never sees the user\'s actual credentials at all — the user authenticates directly with a provider they already trust, and the app only gets a short-lived, single-use authorization code back. That code is deliberately useless on its own: it must be exchanged server-to-server (with the app\'s own client secret) for the real access/id tokens, so a code intercepted in the browser\'s address bar or referrer headers can\'t be redeemed by an attacker without also holding that secret.',
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
    description: 'Inventory is reserved before payment is charged — the reverse order would let two customers both "successfully" buy the last unit of a sold-out item, so the order service holds stock first and only proceeds to charge once it knows the item is actually available. The order record itself is only created after payment succeeds, keeping "orders that exist" and "orders that were actually paid for" the same set by construction rather than needing a reconciliation step later.',
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
    description: 'Each retry waits longer than the last (100ms, then 200ms, ...) instead of retrying immediately, because a downstream service that\'s already struggling under load gets worse, not better, if every failed caller hammers it again right away — that pattern (a "retry storm") is a common cause of outages spreading rather than recovering. Backoff gives the failing dependency breathing room to recover before the next attempt, trading a bit of latency for a much better chance the request eventually succeeds.',
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
    description: 'Regular OAuth\'s authorization-code flow relies on a client secret to prove that whoever exchanges the code for tokens is really the legitimate app — but a public client like a single-page app or mobile app ships its code to the user\'s device, so any "secret" baked into it can be extracted and isn\'t actually secret. PKCE closes that gap without needing one: the client generates a random code_verifier and sends only a hashed code_challenge up front, so if an attacker intercepts the authorization code in transit (a real risk on mobile, via a malicious app registering the same custom URL scheme), they still can\'t redeem it — the token exchange requires the original, never-transmitted code_verifier, which only the legitimate client that generated it possesses.',
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
    description: 'SCIM standardizes user lifecycle management so a company\'s central identity provider can automatically create, update, and — critically — deactivate accounts across every connected app the moment someone joins or leaves, instead of each app needing its own bespoke sync integration. The deprovisioning step matters as much as provisioning: a stale account that never gets deactivated when an employee leaves is a real, common security gap, so the same standardized API that grants access is also the one trusted to revoke it.',
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
    description: 'This is defense in depth: a password alone (something you know) can be phished, reused from another breach, or guessed, so the session is only issued after also proving possession of a second factor (something you have — the device receiving the OTP). Because the two factors come from fundamentally different attack surfaces, compromising one alone (e.g. a leaked password) isn\'t enough to get in — the attacker would separately need the user\'s device too.',
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
    description: 'Permissions are attached to roles rather than to individual users, so granting or revoking access at scale means reassigning someone\'s role (e.g. "admin" → "viewer") instead of editing a long, error-prone list of individual permissions every time responsibilities change. The gateway decodes the token once to get the caller\'s roles, then checks locally whether that role permits the requested action — centralizing the "who can do what" decision instead of scattering permission checks across every backend service.',
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
    description: 'Where RBAC can only ask "does this role allow this action," ABAC evaluates the full context of a request — who\'s asking, what they\'re asking for, and circumstances like time of day or location — which lets one policy express rules no fixed role hierarchy could, like "finance staff can approve invoices under $10k, but only during business hours from a corporate network." Separating the Policy Enforcement Point (which blocks/allows) from the Policy Decision Point (which evaluates the rules) means the actual policy logic can change without touching every service that enforces it.',
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
    description: 'The service provider never sees or handles the user\'s password at all — it redirects to a shared identity provider, which authenticates the user once and hands back a cryptographically signed assertion vouching for their identity. Because that assertion is signed (not just claimed), the service provider can trust it without an independent check, and because the identity provider already has a session, every other app using the same SSO gets to skip the login screen entirely — that shared trust is what makes it "single" sign-on.',
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
    description: 'Access tokens are kept deliberately short-lived to limit how much damage a stolen one can do, but that means the app needs a way to get a new one without constantly interrupting the user with full-page redirects — a hidden iframe (prompt=none) checks the existing session cookie and silently mints a fresh token if it\'s still valid. Rotating the refresh token on every use (rather than reusing the same one indefinitely) also gives the server a way to detect theft: if an old, already-rotated refresh token is ever presented again, that\'s a signal it was stolen and replayed, not a legitimate retry.',
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
    description: 'A static key trades the richer guarantees of OAuth (expiry, scoped permissions, per-user identity, easy revocation without breaking other integrations) for simplicity — it\'s just a string checked against a lookup table, which is why it fits low-stakes service-to-service or read-only API access better than anything handling sensitive user data. Because the key itself never expires or rotates automatically, "check active + quota" at validation time is the main lever the system has for cutting off a compromised or abused key.',
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
    description: 'Three messages, not two, because each side needs its own proof that the other is really there and really agreed to talk — a SYN alone could be an old, delayed, or spoofed packet, so the responder\'s SYN-ACK proves it received that specific SYN, and the initiator\'s final ACK proves it received that specific SYN-ACK back, synchronizing sequence numbers in both directions before any data flows. Teardown is symmetric but independent — each side sends its own FIN when it is done sending, which is why a connection can be "half-closed" (one side still receiving after it stops sending) rather than closing atomically like the handshake does.',
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
    description: 'There\'s no handshake and no acknowledgment built into the protocol itself, so a lost datagram simply never arrives — nothing here retries it or even notices. That absence of overhead is the entire point: latency-sensitive use cases (real-time voice/video, game state, DNS lookups) would rather occasionally drop a packet than pay the round-trip cost of TCP\'s reliability guarantees for data that\'s often stale by the time a retransmit would arrive anyway.',
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
    description: 'Proving ownership of the registered email address is what substitutes for the forgotten password here — the reset token is the actual credential being checked, so it\'s generated to expire quickly (1 hour) and is meant to be used exactly once, limiting how long a leaked or intercepted email gives an attacker a window to act. Note the flow never confirms or denies whether an email address exists in the system in its response — doing so would let an attacker enumerate valid accounts by testing addresses one at a time.',
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
    description: 'This flips the usual model: instead of a password the user remembers, control of the email inbox itself becomes the credential — anyone who can read that message can log in. That\'s only safe because the token is single-use and short-lived, so even if the email is intercepted or read after the fact, replaying an already-used or expired link doesn\'t work — the security burden shifts entirely onto how well the email account itself is protected.',
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
    description: 'Nothing secret ever crosses the network or gets stored on the server: the authenticator holds a private key that never leaves the device, and the server only ever sees a signature proving that key signed this specific challenge. Because there\'s no shared secret (like a password) to leak, steal, or phish in the first place, this sidesteps entire classes of attacks that plague password-based login — a server data breach here exposes only public keys, which are useless to an attacker without the matching private key locked in the user\'s hardware.',
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
    description: 'Unlike every other OAuth grant here, there\'s no user or browser in this flow at all — the client\'s own identity (its client_id/client_secret) is what\'s being authorized, not a user\'s delegated permission, which is why this grant fits service-to-service calls where "on behalf of which user" doesn\'t apply. Service B independently introspecting the token with the Auth Server (rather than just trusting whatever Service A hands it) means a forged or expired token gets caught by the resource itself, not just at the edge.',
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
    description: 'The connection starts as an ordinary HTTP request specifically so it can pass through existing infrastructure — load balancers, proxies, firewalls — that already knows how to handle HTTP, before "upgrading" in place to a persistent bidirectional channel that plain request/response HTTP can\'t offer. Ping/pong exists because a dropped network connection doesn\'t always announce itself — without an active keep-alive, a client can appear connected indefinitely while actually talking to nothing, so periodic pings let either side detect and close a dead connection instead of leaking it.',
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
    description: 'The HMAC signature exists because a webhook endpoint is a public URL anyone can POST to — signing the payload with a shared secret lets the subscriber verify a request genuinely came from the real source and wasn\'t forged by a third party who found the endpoint. Because delivery isn\'t guaranteed on the first try, retries mean the subscriber may see the same event more than once, so a production webhook handler needs to treat delivery as "at least once" and de-duplicate by event id rather than assuming each POST represents a brand-new event.',
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
    description: 'Continuing to call a service that\'s already failing doesn\'t just waste the caller\'s time — every retried request still consumes the failing service\'s limited resources (connections, threads, queue slots), often making the underlying outage worse and slower to recover from. Once failures cross a threshold, the breaker deliberately stops calling out at all ("failing fast" instead of waiting on a doomed timeout), which protects both the caller (instant, predictable failure instead of hanging) and the downstream service (a chance to recover without a continued flood of traffic) — the breaker only lets a few trial calls through afterward to check if it\'s safe to resume.',
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
    description: '"Aside" describes what the cache does not do: it never talks to the database on its own, and a write to the database doesn\'t automatically update or invalidate it — the application code is entirely responsible for populating it on a miss (as shown here) and for keeping it reasonably fresh otherwise. That trade-off means data read from the cache can be stale until its TTL expires, which is acceptable for data that tolerates a short staleness window in exchange for skipping a database round-trip on every read.',
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
    description: 'A single ACID transaction spanning multiple independent services and databases isn\'t really available in a microservices architecture, so instead of a lock that holds until every step commits, each service completes its own local transaction and publishes an event triggering the next step — there\'s no single moment where the whole operation is atomically all-or-nothing. When a later step fails, there\'s no automatic rollback either — each prior service runs its own compensating action (like the refund shown here) to semantically undo what it already committed, which is why designing a saga means designing the compensations up front, not just the happy path.',
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
    description: 'A client that never receives a response genuinely can\'t tell whether the request failed before reaching the server or the server processed it fine but the response was lost on the way back — from the client\'s side, both look identical, so a "just retry" strategy without protection risks double-charging a card or double-sending an email. Tagging the request with a client-generated idempotency key lets the server recognize "I\'ve already handled this exact request" and return the original cached result instead of re-executing it, making retries safe regardless of which side actually failed.',
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
    description: 'Every participant votes before anyone commits specifically to avoid a state where some participants commit and others don\'t — a single "no" (or timeout) aborts the whole transaction for everyone, giving true all-or-nothing atomicity across independent systems. The well-known weakness this protocol carries is the coordinator itself: if it crashes after collecting votes but before broadcasting the decision, every participant is left blocked, holding its locks and unable to independently decide whether to commit or abort — which is exactly why many distributed systems favor sagas (accepting eventual, compensatable consistency) over 2PC\'s strict blocking guarantee.',
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
    description: 'Writing to a database and separately publishing a message to a broker are two independent operations — if the process crashes between them, or the broker call itself fails, the database and the broker end up disagreeing about what happened (an order exists but no one was ever notified, or vice versa). Writing the event as a row in the same local database transaction as the business change makes that transaction atomic by construction, and only the outbox relay (retrying safely until it succeeds) is left needing to actually reach the broker, moving the "did this really get published" problem out of the request path entirely.',
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
    description: 'Instead of overwriting a row to reflect an order\'s current status, every change is appended as a new, immutable event — the current state is just whatever you get by replaying all events for that entity in order, which means the full history of how something reached its current state is never lost (useful for audit, debugging, or replaying "what would have happened if" scenarios). The read model is kept as a separate projection specifically so it can be shaped and indexed however queries actually need it, rather than forcing the write side\'s event-append model to also serve fast, flexible reads.',
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
    description: 'Protobuf\'s binary, strongly-typed schema (versus JSON\'s untyped text) means smaller payloads and no runtime parsing ambiguity about field types — the contract between client and server is enforced by the generated code itself, not just convention. The explicit deadline in the call metadata matters because without one, a slow or hung server can leave a client waiting indefinitely with no way to know whether to give up — the deadline makes "how long is too long" a decision the caller makes up front, not something discovered by getting stuck.',
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
    description: 'A REST client hitting separate /users and /orders endpoints either over-fetches (gets fields it doesn\'t need) or under-fetches (needs a second round trip for related data) — GraphQL instead lets the client specify exactly the shape of data it wants in one request, and the server resolves each requested field by calling whichever backing service actually owns it. The client never needs to know that "user" and "orders" live in two different services — the GraphQL server\'s resolvers hide that topology and merge the results into the single JSON shape the client asked for.',
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
    description: 'Routing large file uploads through the app server means that server\'s bandwidth, memory, and request-handling capacity are all spent just relaying bytes it has no reason to touch — a presigned URL lets the client upload directly to object storage instead, so the app server\'s only job is deciding whether an upload should be allowed and generating a scoped, time-limited credential for it. Because the URL is short-lived and tied to a specific object key, even if it leaks it\'s only useful for a narrow window and a single intended upload, not standing access to the storage bucket.',
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
    description: 'Exactly one consumer in the group is allowed to own each partition at any moment — that\'s what guarantees messages within a partition are processed in order and not duplicated across consumers — so whenever membership changes (someone joins, leaves, or crashes), every existing assignment has to be revoked and recomputed together, not patched incrementally. That\'s why the coordinator briefly pauses the whole group during a rebalance rather than reassigning just the new member\'s share: a partition can\'t safely be reassigned to a new owner while its previous owner might still be processing from it.',
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
    description: 'The atomic "SET ... NX" (set only if not already set) is what prevents both clients from believing they hold the lock simultaneously — a plain "check if free, then set" done as two separate steps would have a race window where both clients could pass the check before either one sets the key. The lock\'s expiry (PX 30000) is a safety net for the case where the holder crashes and never explicitly releases it, but it\'s a double-edged one: if the client\'s actual work takes longer than the expiry, it can lose the lock — and a second client can acquire it — while the first is still (unknowingly) working, which is why real implementations often extend the lease periodically rather than picking one fixed duration and hoping it\'s enough.',
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
    description: 'Ordinary TLS only proves the server\'s identity to the client — mTLS adds the reverse direction too, so each sidecar also presents its own certificate and the other side verifies it against the mesh\'s shared CA before any application traffic is allowed through. That mutual verification is what makes a service mesh\'s "zero trust" model work in practice: every hop between services is independently authenticated and encrypted rather than trusting a request just because it arrived from inside the network perimeter.',
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
    description: 'Shifting all traffic to a new version at once means any bug in it immediately affects every user with no early warning — routing a small percentage first turns a potential full outage into a contained, cheap-to-notice problem affecting only the canary\'s slice of traffic, which can be rolled back before most users are ever exposed. Monitoring the error rate at each step (rather than shifting on a fixed timer) is what makes the ramp-up conditional: traffic only increases once the canary has actually proven itself healthy under real production load, not just in a staging environment.',
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
    description: 'No single server holds records for the entire internet — each level of the hierarchy only knows how to point toward the next, more specific authority (root knows which servers handle .com, the .com TLD servers know which server is authoritative for example.com, and so on), which is what lets DNS scale to every domain on the internet without any one server being a bottleneck or a single point of failure. Caching the final answer (respecting its TTL) exists purely for performance — without it, every single lookup for the same hostname would have to re-walk this entire hierarchy from scratch, even though the answer rarely changes within the TTL window.',
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
    description: 'The app never sees or stores the user\'s Google password — it only ever receives a token proving Google already verified that identity, so a breach of the app\'s own database can\'t expose credentials that were never stored there in the first place. The "find-or-create local user by email" step is the part that actually links the two identity systems together: the app still needs its own internal user record (for its own permissions, preferences, and data ownership), and email is the shared attribute used to recognize "this is the same person" across logins and across different identity providers.',
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
    description: 'A single login shouldn\'t grant the same level of trust for the rest of the session regardless of what\'s being done — browsing account balances and wiring $50,000 carry very different risk, so the assurance level required should scale with the action\'s risk rather than being all-or-nothing at login time. The step-up token\'s elevated assurance level (acr=high) is scoped and typically short-lived, meaning the fresh re-authentication only covers the sensitive action just performed, not a blanket upgrade to the entire ongoing session.',
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
