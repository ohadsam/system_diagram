import { c } from '../schema.js';

export const category = { id: 'security', label: 'Security & Identity', color: '#B91C1C' };

const SEC = '#B91C1C';

export const components = [
  c('sec-antivirus', 'Antivirus / Endpoint Protection', '🦠', { color: SEC }),
  c('sec-api-key', 'API Key', '🗝️', { color: SEC, relatedPatterns: ['seq-api-key-auth'] }),
  c('sec-certificate', 'SSL/TLS Certificate', '📜', { color: SEC, related: ['net-load-balancer', 'net-cdn'] }),
  c('sec-ddos', 'DDoS Protection', '🛡️', { color: SEC, related: ['sec-waf'] }),
  c('sec-firewall', 'Firewall', '🧱', { color: SEC }),
  c('sec-identity-provider', 'Identity Provider (IdP)', '🪪', { color: SEC, related: ['sec-sso'], relatedPatterns: ['seq-scim-provisioning', 'seq-sso-saml'] }),
  c('sec-jwt', 'JWT', '🎫', { color: SEC, relatedPatterns: ['seq-rbac-check'] }),
  c('sec-ldap', 'LDAP / Active Directory', '🗃️', { color: SEC }),
  c('sec-oauth', 'OAuth / OIDC', '🔓', { popular: true, color: SEC, related: ['sec-jwt'], relatedPatterns: ['seq-oauth-handshake', 'seq-pkce-flow'] }),
  c('sec-secrets-manager', 'Secrets Manager', '🤫', { color: SEC }),
  c('sec-siem', 'SIEM', '🕵️', { color: SEC }),
  c('sec-sso', 'Single Sign-On (SSO)', '🔑', { color: SEC, relatedPatterns: ['seq-sso-saml'] }),
  c('sec-vault', 'HashiCorp Vault', '🏦', { color: '#000000' }),
  c('sec-waf', 'Web Application Firewall', '🧱', { color: SEC, related: ['net-cdn', 'sec-ddos'] }),
];
