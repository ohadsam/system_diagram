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
    description: 'The ID generator is pulled out as its own dedicated step rather than letting the database auto-increment a primary key, because a short code needs to be unpredictable (so users can\'t guess adjacent codes) and because a single shared counter would become a write bottleneck once the API scales horizontally across many instances. Click analytics is fired at "publish and forget" (the dashed async edge) instead of being written synchronously in the same request, since a redirect needs to happen fast — the read is the whole point of a URL shortener — and losing an occasional analytics event is a far smaller cost than making every redirect wait on an analytics write.',
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
    description: 'Splitting the WebSocket Gateway from the REST API reflects that these two things have fundamentally different connection lifecycles — a chat connection needs to stay open indefinitely to push messages the instant they arrive, while auth and history lookups are one-shot request/response calls that don\'t benefit from (and would just tie up resources on) a persistent connection. Publishing a sent message to the bus, rather than writing directly to storage and directly pushing to offline users, is what lets one send fan out to multiple independent concerns without the Chat Service needing to know about or wait on all of them.',
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
    description: 'The counters live in Redis specifically because a sliding-window check needs an atomic increment-and-compare performed in single-digit milliseconds on every request across every gateway instance — a relational database could do the same job but would add far more latency to a check that has to happen before every forwarded request. Separating the Rule Config Store from the counters matters too: rules (how many requests per window, per client tier) change rarely and can tolerate being cached, while the counters change on every request — conflating the two would mean every rule lookup pays the same latency cost as a counter increment.',
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
    description: 'Fanning a new post out to every follower\'s feed cache at write time — rather than the alternative "fan-out-on-read" (querying everyone you follow fresh every time you open your feed) — trades a slower, more expensive write for a fast, cheap read, the right trade for a feed most people check far more often than they post to. That trade breaks down for accounts with an unusually large follower count: fanning out one post to millions of followers at once is a very different write than fanning out to a typical user\'s few hundred, which is why real systems often special-case celebrity accounts back to a read-time fan-out instead.',
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
    description: 'Live driver locations are kept in a geohash-indexed cache rather than the primary trip database because "find nearby drivers" needs to run in real time against constantly-changing positions — a relational database\'s indexing isn\'t built for that access pattern the way a geospatial index is, and every location update would otherwise be a write contending with the same store handling trip records. Matching and notification are decoupled through a queue (the dashed edges) rather than Dispatch calling the Driver App directly, because a driver might be offline or slow to respond — the queue lets the offer be retried or reassigned to a different driver without Dispatch blocking on one driver\'s response.',
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
