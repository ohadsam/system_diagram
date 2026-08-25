import { c } from '../schema.js';

export const category = { id: 'misc', label: 'Integrations & Misc', color: '#78716C' };

const MI = '#78716C';

export const components = [
  c('misc-cdn-provider', 'CDN Provider (Cloudflare, Fastly...)', '🌍', { color: '#F38020' }),
  c('misc-cron', 'Cron Job / Scheduler', '⏰', { color: MI, relatedLayers: ['layer-scheduler'] }),
  c('misc-email-service', 'Email Service', '📧', { color: MI, relatedPatterns: ['seq-password-reset', 'seq-magic-link-login'] }),
  c('misc-external-api', 'Third-Party API', '🔌', { color: MI }),
  c('misc-external-system', 'External System', '🏢', { shape: 'rect', color: MI }),
  c('misc-feature-flags', 'Feature Flags', '🚩', { color: MI }),
  c('misc-graphql', 'GraphQL Server', '◈', { color: '#E10098', related: ['net-api-gateway'], relatedPatterns: ['seq-graphql-query'] }),
  c('misc-grpc', 'gRPC Service', '📡', { color: MI, relatedLayers: ['layer-service', 'layer-dto'], relatedPatterns: ['seq-grpc-unary'] }),
  c('misc-payment-gateway', 'Payment Gateway', '💳', { color: MI, relatedPatterns: ['seq-idempotency-key'] }),
  c('misc-push-notification', 'Push Notification Service', '🔔', { color: MI }),
  c('misc-rest-api', 'REST API', '🔗', { color: MI, relatedLayers: ['layer-controller', 'layer-dto'] }),
  c('misc-search-engine', 'Search Engine', '🔍', { color: MI }),
  c('misc-sms-service', 'SMS Service', '💬', { color: MI }),
  c('misc-third-party-auth', 'Social/Third-Party Login', '👤', { color: MI, related: ['sec-oauth'] }),
  c('misc-webhook', 'Webhook', '🪝', { color: MI, relatedLayers: ['layer-webhook-handler'], relatedPatterns: ['seq-webhook-delivery'] }),
  c('misc-worker', 'Background Worker', '⚙️', { color: MI, relatedLayers: ['layer-event-handler'] }),
];
