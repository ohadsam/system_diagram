import { c } from '../schema.js';

export const category = { id: 'security', label: 'Security & Identity', color: '#B91C1C' };

const SEC = '#B91C1C';

export const components = [
  c('sec-antivirus', 'Antivirus / Endpoint Protection', '🦠', { color: SEC }),
  c('sec-api-key', 'API Key', '🗝️', { color: SEC }),
  c('sec-certificate', 'SSL/TLS Certificate', '📜', { color: SEC }),
  c('sec-ddos', 'DDoS Protection', '🛡️', { color: SEC }),
  c('sec-firewall', 'Firewall', '🧱', { color: SEC }),
  c('sec-identity-provider', 'Identity Provider (IdP)', '🪪', { color: SEC }),
  c('sec-jwt', 'JWT', '🎫', { color: SEC }),
  c('sec-ldap', 'LDAP / Active Directory', '🗃️', { color: SEC }),
  c('sec-oauth', 'OAuth / OIDC', '🔓', { color: SEC }),
  c('sec-secrets-manager', 'Secrets Manager', '🤫', { color: SEC }),
  c('sec-siem', 'SIEM', '🕵️', { color: SEC }),
  c('sec-sso', 'Single Sign-On (SSO)', '🔑', { color: SEC }),
  c('sec-vault', 'HashiCorp Vault', '🏦', { color: '#000000' }),
  c('sec-waf', 'Web Application Firewall', '🧱', { color: SEC }),
];
