import { c } from '../schema.js';

export const category = { id: 'cache', label: 'Cache', color: '#DC2626' };

const CA = '#DC2626';

export const components = [
  c('cache-browser', 'Browser Cache', '🗃️', { color: CA }),
  c('cache-cdn', 'CDN Edge Cache', '🌍', { color: CA }),
  c('cache-hazelcast', 'Hazelcast', '🧠', { shape: 'cylinder', color: CA }),
  c('cache-memcached', 'Memcached', '📦', { shape: 'cylinder', color: CA }),
  c('cache-memory', 'In-Memory Cache', '💾', { shape: 'cylinder', color: CA }),
  c('cache-redis', 'Redis Cache', '🧵', { shape: 'cylinder', color: '#DC382D' }),
  c('cache-reverse-proxy', 'Reverse Proxy Cache', '🛡️', { color: CA }),
  c('cache-varnish', 'Varnish', '🐆', { color: CA }),
];
