import { definePattern } from '../schema.js';

// "Reference Architectures" — ready-made "Design X" system-design-interview
// blueprints (URL Shortener, Chat App, Rate Limiter, ...), one step up from
// the small architectural snippets in design-patterns.js: each of these is a
// complete, if simplified, whole-system starting point meant to be dropped
// in and then customized, not a single reusable building block. Every node
// still references a real component/layer defId (see design-patterns.js's
// own header comment for why), so styling stays consistent for free.
// `groupOnInstantiate: true` on every entry here (unlike most of
// design-patterns.js) — a "Design X" is meant to read and move as one whole
// design, not a loose cluster of parts, so it comes in as a single group
// with the same background frame + drill-down affordance a saved
// multi-component custom component gets.
export const category = { id: 'reference-architectures', label: 'Reference Architectures', color: '#BE185D' };

const n = (key, defId, dx, dy, label) => ({ key, defId, dx, dy, label });
const e = (from, to, label, extra = {}) => ({ from, to, label, ...extra });
const dashed = { dash: 'dashed' };

const TAGS = ['reference-architecture', 'interview', 'system-design'];

export const components = [
  definePattern('refarch-url-shortener', 'Design: URL Shortener', '🔗', {
    description: 'Client → LB → API, with Redis cache-aside in front of the URL-mapping DB, a dedicated ID generator, and an async click-analytics stream.',
    tags: TAGS,
    groupOnInstantiate: true,
    nodes: [
      n('client', 'client-browser', -320, -220, 'Client'),
      n('lb', 'net-load-balancer', 0, -220, 'Load Balancer'),
      n('api', 'srv-app-server', 0, -60, 'Shortener API'),
      n('idgen', 'srv-serverless-fn', 220, -60, 'ID Generator'),
      n('cache', 'cache-redis', -220, 110, 'Cache (code → URL)'),
      n('db', 'db-postgres', 0, 110, 'URL Mappings DB'),
      n('analytics', 'mq-kafka', 220, 110, 'Click Events'),
    ],
    edges: [
      e('client', 'lb'),
      e('lb', 'api'),
      e('api', 'idgen', 'generate short code'),
      e('api', 'cache', 'cache-aside read'),
      e('cache', 'db', 'on miss', dashed),
      e('api', 'db', 'write mapping'),
      e('api', 'analytics', 'click event', dashed),
    ],
  }),

  definePattern('refarch-chat-app', 'Design: Chat Application', '💬', {
    description: 'A WebSocket gateway carries real-time messages while a REST API handles auth/history; a message bus fans messages out to storage and offline push.',
    tags: TAGS,
    groupOnInstantiate: true,
    nodes: [
      n('client', 'client-mobile-ios', -340, -220, 'Mobile Client'),
      n('ws', 'net-websocket', -120, -220, 'WebSocket Gateway'),
      n('api', 'net-api-gateway', 120, -220, 'REST API (auth, history)'),
      n('presence', 'cache-redis', -340, -40, 'Presence Store'),
      n('chat', 'srv-microservice', -120, -40, 'Chat Service'),
      n('bus', 'mq-kafka', 120, -40, 'Message Bus'),
      n('db', 'db-cassandra', -120, 140, 'Message Store'),
      n('push', 'misc-push-notification', 120, 140, 'Push Notifications'),
    ],
    edges: [
      e('client', 'ws', 'persistent connection'),
      e('client', 'api', 'login / history'),
      e('ws', 'chat'),
      e('api', 'chat'),
      e('chat', 'presence', 'online status'),
      e('chat', 'bus', 'publish message'),
      e('bus', 'db', 'persist'),
      e('bus', 'push', 'notify offline users', dashed),
    ],
  }),

  definePattern('refarch-rate-limiter', 'Design: Rate Limiter Service', '🚦', {
    description: 'A standalone rate-limiter service that other requests are checked against before being forwarded — sliding-window counters in Redis, rules in a config store.',
    tags: TAGS,
    groupOnInstantiate: true,
    nodes: [
      n('client', 'client-browser', -320, -140, 'Client'),
      n('gateway', 'net-api-gateway', -100, -140, 'API Gateway'),
      n('limiter', 'srv-microservice', -100, 30, 'Rate Limiter Service'),
      n('counters', 'cache-redis', -320, 30, 'Counters (sliding window)'),
      n('config', 'db-generic', 120, 30, 'Rule Config Store'),
      n('backend', 'srv-app-server', -100, 200, 'Backend Service'),
    ],
    edges: [
      e('client', 'gateway'),
      e('gateway', 'limiter', 'check limit'),
      e('limiter', 'counters', 'INCR & check'),
      e('limiter', 'config', 'load rules'),
      e('limiter', 'gateway', 'allow / 429', dashed),
      e('gateway', 'backend', 'forward if allowed'),
    ],
  }),

  definePattern('refarch-social-feed', 'Design: Social Media Feed', '📰', {
    description: 'A push (fan-out-on-write) news feed: new posts are fanned out via the social graph into per-follower feed caches read at request time.',
    tags: TAGS,
    groupOnInstantiate: true,
    nodes: [
      n('client', 'client-mobile-android', -360, -220, 'Mobile Client'),
      n('api', 'net-api-gateway', -120, -220, 'API Gateway'),
      n('post', 'srv-microservice', 140, -220, 'Post Service'),
      n('cache', 'cache-redis', -360, -40, 'Feed Cache'),
      n('feed', 'srv-microservice', -120, -40, 'Feed Service'),
      n('fanout', 'mq-kafka', 140, -40, 'Fan-out Queue'),
      n('graph', 'db-neo4j', -120, 140, 'Social Graph'),
      n('db', 'db-cassandra', 140, 140, 'Post Store'),
    ],
    edges: [
      e('client', 'api'),
      e('api', 'feed', 'get feed'),
      e('feed', 'cache', 'read cached feed'),
      e('api', 'post', 'create post'),
      e('post', 'db', 'store post'),
      e('post', 'fanout', 'publish new post'),
      e('fanout', 'graph', 'find followers'),
      e('fanout', 'cache', 'push into feeds', dashed),
    ],
  }),

  definePattern('refarch-ride-sharing', 'Design: Ride-Sharing Dispatch', '🚕', {
    description: 'Riders request a trip and drivers stream location updates; dispatch matches them using a live geo-index, then notifies the matched driver.',
    tags: TAGS,
    groupOnInstantiate: true,
    nodes: [
      n('rider', 'client-mobile-ios', -380, -200, 'Rider App'),
      n('driver', 'client-mobile-android', 380, -200, 'Driver App'),
      n('api', 'net-api-gateway', 0, -200, 'API Gateway'),
      n('geo', 'cache-redis', -220, -20, 'Live Location Index (geohash)'),
      n('dispatch', 'srv-microservice', 0, -20, 'Dispatch / Matching Service'),
      n('trips', 'db-postgres', 220, -20, 'Trip / Ride Store'),
      n('notify', 'mq-rabbitmq', 0, 160, 'Driver Notification Queue'),
    ],
    edges: [
      e('rider', 'api', 'request ride'),
      e('driver', 'api', 'location updates'),
      e('api', 'geo', 'update location', dashed),
      e('api', 'dispatch'),
      e('dispatch', 'geo', 'find nearby drivers'),
      e('dispatch', 'trips', 'create trip'),
      e('dispatch', 'notify', 'notify matched driver', dashed),
      e('notify', 'driver', 'push offer', dashed),
    ],
  }),
];
