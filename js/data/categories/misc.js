import { c } from '../schema.js';

export const category = { id: 'misc', label: 'Integrations & Misc', color: '#78716C' };

const MI = '#78716C';

export const components = [
  c('misc-cdn-provider', 'CDN Provider (Cloudflare, Fastly...)', '🌍', { color: '#F38020' }),
  c('misc-cron', 'Cron Job / Scheduler', '⏰', { color: MI }),
  c('misc-email-service', 'Email Service', '📧', { color: MI }),
  c('misc-external-api', 'Third-Party API', '🔌', { color: MI }),
  c('misc-external-system', 'External System', '🏢', { shape: 'rect', color: MI }),
  c('misc-feature-flags', 'Feature Flags', '🚩', { color: MI }),
  c('misc-graphql', 'GraphQL Server', '◈', { color: '#E10098', related: ['net-api-gateway'] }),
  c('misc-grpc', 'gRPC Service', '📡', { color: MI }),
  c('misc-payment-gateway', 'Payment Gateway', '💳', { color: MI }),
  c('misc-push-notification', 'Push Notification Service', '🔔', { color: MI }),
  c('misc-rest-api', 'REST API', '🔗', { color: MI }),
  c('misc-search-engine', 'Search Engine', '🔍', { color: MI }),
  c('misc-sms-service', 'SMS Service', '💬', { color: MI }),
  c('misc-third-party-auth', 'Social/Third-Party Login', '👤', { color: MI, related: ['sec-oauth'] }),
  c('misc-webhook', 'Webhook', '🪝', { color: MI }),
  c('misc-worker', 'Background Worker', '⚙️', { color: MI }),
];
