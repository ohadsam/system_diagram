import { definePattern } from '../schema.js';

// "Design Patterns" — each entry is a small blueprint (nodes + edges), not a
// single placeable component. Dropping/clicking one instantiates the whole
// cluster at once, positioned relative to the drop point — see
// canvas/canvas.js#instantiatePattern. Node `defId`s reference real
// components/layers elsewhere in the library, so every generated node gets
// consistent styling for free and the blueprint data stays tiny.
export const category = { id: 'design-patterns', label: 'Design Patterns', color: '#0F766E' };

const n = (key, defId, dx, dy, label) => ({ key, defId, dx, dy, label });
const e = (from, to, label, extra = {}) => ({ from, to, label, ...extra });
const twoWay = { startArrow: 'filled', endArrow: 'filled' };
const dashed = { dash: 'dashed' };

/** An ER-diagram "entity" — reuses the generic rows shape (data/categories/shapes.js
 * #shape-server-rows is the only `shape: 'rows'` def in the library) via
 * `overrides` rather than a dedicated ER shape, listing its attributes as
 * rows the same way any other rows-shaped component does. Height grows
 * with the attribute count so the box doesn't clip them. */
function entity(key, dx, dy, title, attributes) {
  return { key, defId: 'shape-server-rows', dx, dy, label: title, overrides: { icon: '🗂️', rows: attributes, w: 220, h: 60 + attributes.length * 26 } };
}

export const components = [
  definePattern('pattern-active-active', 'Active-Active Replication', '🔁', {
    description: 'Both instances handle live traffic simultaneously rather than one sitting idle as a backup, which maximizes hardware utilization and halves the load either side absorbs alone — but that same bidirectional write path is exactly what makes conflict resolution the hard part: if both sides accept a write to the same record before sync catches up, something has to decide which write wins (last-write-wins, vector clocks, an application-level merge), a problem an active-passive setup never has to face.',
    tags: ['availability', 'replication', 'ha'],
    nodes: [
      n('lb', 'net-load-balancer', 0, -170, 'Load Balancer'),
      n('appA', 'srv-app-server', -190, 0, 'App A'),
      n('appB', 'srv-app-server', 190, 0, 'App B'),
      n('dbA', 'db-generic', -190, 170, 'DB A'),
      n('dbB', 'db-generic', 190, 170, 'DB B'),
    ],
    edges: [e('lb', 'appA'), e('lb', 'appB'), e('appA', 'dbA'), e('appB', 'dbB'), e('dbA', 'dbB', 'sync replication', { ...twoWay, ...dashed })],
  }),

  definePattern('pattern-active-passive', 'Active-Passive Replication (Primary-Standby)', '🛟', {
    description: 'Keeping the standby passive (accepting replicated data but never live traffic) sidesteps the write-conflict problem Active-Active has entirely — there\'s only ever one writer, so there\'s nothing to reconcile. The trade-off is that failover isn\'t instant: something has to detect the primary is actually down (not just slow) and promote the standby, and any writes still in flight to the standby at the moment of failure are lost — meanwhile the standby sits at half-utilized capacity for a scenario that, hopefully, rarely happens.',
    tags: ['availability', 'replication', 'ha', 'failover'],
    nodes: [
      n('app', 'srv-app-server', 0, -160, 'App (Active)'),
      n('primary', 'db-generic', -180, 20, 'Primary DB (Active)'),
      n('standby', 'db-generic', 180, 20, 'Standby DB (Passive)'),
    ],
    edges: [e('app', 'primary', 'reads/writes'), e('primary', 'standby', 'replicates', dashed)],
  }),

  definePattern('pattern-api-gateway', 'API Gateway', '🚪', {
    description: 'Without a gateway, every client would need to know each service\'s individual address and re-implement auth, rate limiting, and routing itself — duplicated in every client and impossible to change without redeploying them all. Centralizing that behind one entry point means cross-cutting concerns live in exactly one place, at the cost of that gateway now being a single hop every request passes through — its own availability and latency budget become the whole system\'s.',
    tags: ['architectural', 'microservices', 'networking'],
    nodes: [
      n('client', 'client-browser', 0, -160, 'Client'),
      n('gw', 'net-api-gateway', 0, 0),
      n('a', 'layer-service', -220, 160, 'Service A'),
      n('b', 'layer-service', 0, 160, 'Service B'),
      n('c', 'layer-service', 220, 160, 'Service C'),
    ],
    edges: [e('client', 'gw'), e('gw', 'a'), e('gw', 'b'), e('gw', 'c')],
  }),

  definePattern('pattern-bff', 'Backend for Frontend (BFF)', '📱', {
    description: 'A mobile app and a web app often need the same underlying data shaped very differently — mobile wants one aggregated payload to minimize round trips on a cellular connection, while a browser might prefer finer-grained calls it can cache separately — and one shared API forced to serve both ends up compromising for each. A BFF per client type lets each aggregate and shape calls to the core services exactly how its client needs, at the cost of duplicating some aggregation logic across BFFs instead of maintaining one shared API layer.',
    tags: ['architectural', 'api'],
    nodes: [
      n('mobile', 'client-mobile-ios', -180, -160, 'Mobile'),
      n('web', 'client-browser', 180, -160, 'Web'),
      n('bffMobile', 'layer-bff', -180, 0, 'Mobile BFF'),
      n('bffWeb', 'layer-bff', 180, 0, 'Web BFF'),
      n('core', 'layer-service', 0, 160, 'Core Services'),
    ],
    edges: [e('mobile', 'bffMobile'), e('web', 'bffWeb'), e('bffMobile', 'core'), e('bffWeb', 'core')],
  }),

  definePattern('pattern-cache-aside', 'Cache-Aside', '⚡', {
    description: '"Aside" describes what the cache never does on its own: it doesn\'t proactively load or invalidate itself, so it\'s entirely the service\'s job to check it first, fall through to the database on a miss, and write the result back before returning — the numbered edges here show that exact three-step contract. This keeps the cache simple and general-purpose, but every miss now pays the full database round-trip on top of the wasted cache lookup, and the service has to consciously decide when cached data is stale enough to bypass.',
    tags: ['architectural', 'performance', 'cache'],
    nodes: [n('service', 'layer-service', 0, -150), n('cache', 'cache-redis', -180, 60), n('db', 'db-generic', 180, 60)],
    edges: [e('service', 'cache', '1. check'), e('service', 'db', '2. on miss'), e('db', 'cache', '3. populate', dashed)],
  }),

  definePattern('pattern-cdc-pipeline', 'Change Data Capture (CDC) Pipeline', '🔄', {
    description: 'A connector tails the database\'s write-ahead log and streams every change as an event, fanning out to a search index and a cache invalidator without the app ever double-writing.',
    tags: ['architectural', 'data', 'events', 'database'],
    nodes: [
      n('db', 'db-generic', -320, 0, 'Primary Database'),
      n('connector', 'misc-worker', -80, 0, 'CDC Connector (Debezium)'),
      n('kafka', 'mq-kafka', 180, 0, 'Kafka (Change Events)'),
      n('search', 'db-elasticsearch', 420, -110, 'Search Index'),
      n('cache', 'cache-redis', 420, 110, 'Cache'),
    ],
    edges: [
      e('db', 'connector', 'reads WAL / binlog'),
      e('connector', 'kafka', 'publishes change events'),
      e('kafka', 'search', 'sync index'),
      e('kafka', 'cache', 'invalidate', dashed),
    ],
  }),

  definePattern('pattern-cqrs', 'CQRS (Command Query Responsibility Segregation)', '🔀', {
    description: 'Reads and writes usually have very different scaling needs — a typical app might see 100x more reads than writes, or need a very different query shape for reporting than the transactional model that produced the data — but a single shared model has to compromise between both. Splitting them lets each side scale and be modeled independently (a denormalized read model tuned for fast queries, a normalized write model tuned for correctness), at the cost of the two only agreeing once the sync between them (the dashed edge) actually completes — a read can briefly return stale data right after a write.',
    tags: ['architectural', 'backend'],
    nodes: [
      n('cmd', 'layer-command-handler', -180, 0),
      n('writeDb', 'db-generic', -180, 150, 'Write DB'),
      n('qry', 'layer-query-handler', 180, 0),
      n('readDb', 'db-generic', 180, 150, 'Read DB'),
    ],
    edges: [e('cmd', 'writeDb'), e('qry', 'readDb'), e('writeDb', 'readDb', 'sync', dashed)],
  }),

  definePattern('pattern-db-sharding', 'Database Sharding', '🧩', {
    description: 'A shard router splits traffic across multiple independent databases by a routing key, so each shard only holds a slice of the data.',
    tags: ['architectural', 'database', 'scaling'],
    nodes: [
      n('service', 'layer-service', 0, -180, 'Application'),
      n('router', 'net-load-balancer', 0, 0, 'Shard Router (by Key)'),
      n('shard1', 'db-generic', -260, 200, 'Shard 1 (Users A–H)'),
      n('shard2', 'db-generic', 0, 200, 'Shard 2 (Users I–P)'),
      n('shard3', 'db-generic', 260, 200, 'Shard 3 (Users Q–Z)'),
    ],
    edges: [
      e('service', 'router'),
      e('router', 'shard1', 'range A–H'),
      e('router', 'shard2', 'range I–P'),
      e('router', 'shard3', 'range Q–Z'),
    ],
  }),

  definePattern('pattern-er-ecommerce', 'ER: E-Commerce Order Schema', '🛒', {
    description: 'Order Item is a join entity that exists specifically to resolve the many-to-many between Order and Product — a single Order can contain many Products and a single Product can appear on many Orders, and neither table alone can hold both foreign keys, so the join entity carries the relationship itself plus per-line data (quantity, price) that belongs to the pairing, not to either side alone. Payment is modeled as its own entity rather than columns on Order because a real order can have a more complex payment history (partial payments, later refunds) — one order to one payment here is the simplified starting point, not a hard constraint of the design.',
    tags: ['er-diagram', 'database', 'schema'],
    nodes: [
      entity('customer', -380, -170, 'Customer', ['id (PK)', 'name', 'email']),
      entity('order', 0, -170, 'Order', ['id (PK)', 'customer_id (FK)', 'status', 'created_at']),
      entity('payment', 380, -170, 'Payment', ['id (PK)', 'order_id (FK)', 'amount', 'status']),
      entity('orderItem', -190, 170, 'Order Item', ['id (PK)', 'order_id (FK)', 'product_id (FK)', 'quantity', 'price']),
      entity('product', 190, 170, 'Product', ['id (PK)', 'name', 'price', 'stock']),
    ],
    edges: [
      e('customer', 'order', '1 → N'),
      e('order', 'orderItem', '1 → N'),
      e('product', 'orderItem', '1 → N'),
      e('order', 'payment', '1 → 1'),
    ],
  }),

  definePattern('pattern-er-self-referencing', 'ER: Self-Referencing Relationship', '🔁', {
    description: 'Modeling "who manages whom" doesn\'t need a separate Manager table — since a manager is just another Employee, a nullable foreign key pointing back at the same table\'s own primary key captures the whole hierarchy in one place. The trade-off is that traversing it (e.g. "everyone under this manager, three levels deep") needs a recursive query, which relational databases support but which reads and performs very differently from an ordinary single-level join.',
    tags: ['er-diagram', 'database', 'schema'],
    nodes: [entity('employee', 0, 0, 'Employee', ['id (PK)', 'name', 'manager_id (FK, self)'])],
    edges: [{
      from: 'employee',
      to: 'employee',
      overrides: { label: 'reports to', routing: 'straight', fromOffset: 0.3, toOffset: 0.7, fromSide: 'right', toSide: 'right', dash: 'solid', startArrow: 'none', endArrow: 'filled' },
    }],
  }),

  definePattern('pattern-event-sourcing', 'Event Sourcing', '📜', {
    description: 'Instead of overwriting a row to reflect its current value, every state change is appended as a new, immutable event — current state is derived by replaying all of an entity\'s events in order, which means the complete history of how it got there is never lost (useful for audit, debugging, and rebuilding a read model from scratch if its shape ever needs to change). The trade-off is that reading current state isn\'t a simple row lookup anymore — either the whole event log gets replayed each time, or a separate projection (the read model shown here) has to be kept in sync as new events arrive.',
    tags: ['architectural', 'events'],
    nodes: [
      n('cmd', 'layer-command-handler', -240, 0),
      n('store', 'db-generic', -40, 0, 'Event Store'),
      n('projector', 'layer-event-handler', 160, 0, 'Projector'),
      n('readModel', 'db-generic', 360, 0, 'Read Model'),
    ],
    edges: [e('cmd', 'store'), e('store', 'projector'), e('projector', 'readModel')],
  }),

  definePattern('pattern-hexagonal', 'Hexagonal Architecture (Ports & Adapters)', '⬡', {
    description: 'The core domain only knows about its own ports (interfaces it defines) — it has no idea whether the real caller is a REST API or a CLI, or whether persistence is Postgres or a mock in a test — so swapping any of that (REST adapter → GraphQL, DB adapter → an in-memory fake for testing) never touches business logic at all. The cost of that isolation is indirection: every real technology has to be wrapped in an adapter implementing the port\'s interface, which is more moving parts than calling a driver directly.',
    tags: ['architectural', 'ddd'],
    nodes: [
      n('adapterIn', 'layer-adapter', -420, 0, 'REST Adapter'),
      n('portIn', 'layer-port', -220, 0, 'Inbound Port'),
      n('core', 'layer-core-domain', 0, 0),
      n('portOut', 'layer-port', 220, 0, 'Outbound Port'),
      n('adapterOut', 'layer-adapter', 420, 0, 'DB Adapter'),
    ],
    edges: [e('adapterIn', 'portIn'), e('portIn', 'core'), e('core', 'portOut'), e('portOut', 'adapterOut')],
  }),

  definePattern('pattern-layered', 'Layered Architecture (N-Tier)', '🏗️', {
    description: 'Restricting each layer to only calling the one directly below it — never skipping ahead, never calling upward — keeps changes local: swapping the database technology only touches the DAL, not the Controller, and the codebase\'s dependencies stay easy to reason about since they only ever point one direction. The trade-off shows up at scale: a request needing data from deep in the stack still has to pass through every layer above it, and a change that genuinely spans multiple layers (a new field threaded from DB to API) still means touching all of them.',
    tags: ['architectural', 'backend'],
    nodes: [
      n('controller', 'layer-controller', 0, 0),
      n('service', 'layer-service', 0, 150),
      n('dal', 'layer-dal', 0, 300),
      n('db', 'db-generic', 0, 450),
    ],
    edges: [e('controller', 'service'), e('service', 'dal'), e('dal', 'db')],
  }),

  definePattern('pattern-leader-election', 'Leader Election', '👑', {
    description: 'Peer nodes race to hold a lease on a coordination service; only the elected leader is allowed to write, while followers watch for it to expire.',
    tags: ['architectural', 'distributed-systems', 'microservices'],
    nodes: [
      n('coordinator', 'layer-service-discovery', 0, -180, 'Coordination Service (etcd/ZooKeeper)'),
      n('nodeA', 'srv-app-server', -280, 40, 'Node A (Leader)'),
      n('nodeB', 'srv-app-server', 0, 40, 'Node B (Follower)'),
      n('nodeC', 'srv-app-server', 280, 40, 'Node C (Follower)'),
      n('db', 'db-generic', -280, 260, 'Shared Database'),
    ],
    edges: [
      e('nodeA', 'coordinator', 'holds lease'),
      e('nodeB', 'coordinator', 'watches', dashed),
      e('nodeC', 'coordinator', 'watches', dashed),
      e('nodeA', 'db', 'writes (leader only)'),
    ],
  }),

  definePattern('pattern-multi-az', 'Multi-AZ Deployment', '🏢', {
    description: 'An Availability Zone is a physically distinct data center with its own power and networking — a standby in a *second* AZ survives a failure mode a same-AZ replica couldn\'t (the whole AZ losing power or connectivity, not just one server dying). This is deliberately a smaller blast radius than multi-region: it protects against a single data-center-level outage at low latency cost between AZs, but not against something that takes out an entire geographic region.',
    tags: ['availability', 'replication', 'ha', 'multi-az'],
    nodes: [
      n('lb', 'net-load-balancer', 0, -170, 'Load Balancer'),
      n('app', 'srv-app-server', -190, 0, 'App (AZ-A)'),
      n('primary', 'db-generic', -190, 170, 'Primary DB (AZ-A)'),
      n('standby', 'db-generic', 190, 170, 'Standby DB (AZ-B)'),
    ],
    edges: [e('lb', 'app'), e('app', 'primary'), e('primary', 'standby', 'sync replication', dashed)],
  }),

  definePattern('pattern-multi-region-active-active', 'Multi-Region Active-Active', '🌍', {
    description: 'Serving each user from their nearest region cuts round-trip latency dramatically versus routing every request to one central region continents away, and it survives an entire region going down (unlike Multi-AZ, which only tolerates losing one data center within a region). The real cost is the cross-region replication itself: light-speed network latency between distant regions makes synchronously confirming a write in both places impractical, so this pattern almost always implies eventual consistency and the same conflict-resolution problem Active-Active Replication has, just at continental distance.',
    tags: ['availability', 'replication', 'ha', 'multi-region'],
    nodes: [
      n('dns', 'net-dns', 0, -220, 'DNS / Geo-Routing'),
      n('regionA', 'shape-cloud', -220, -20, 'Region A'),
      n('regionB', 'shape-cloud', 220, -20, 'Region B'),
      n('dbA', 'db-generic', -220, 170, 'DB (Region A)'),
      n('dbB', 'db-generic', 220, 170, 'DB (Region B)'),
    ],
    edges: [
      e('dns', 'regionA'),
      e('dns', 'regionB'),
      e('regionA', 'dbA'),
      e('regionB', 'dbB'),
      e('dbA', 'dbB', 'cross-region replication', { ...twoWay, ...dashed }),
    ],
  }),

  definePattern('pattern-mvc', 'MVC (Model-View-Controller)', '🎮', {
    description: 'Routing all updates through the Controller — rather than letting the View mutate the Model directly — keeps business logic (what a valid state transition looks like) out of the presentation layer, so the same Model and Controller could in principle drive a completely different View (a CLI instead of a web UI) unchanged. The View reading the Model directly (the dashed edge) is a common relaxation for read-only display, but it means the View now depends on the Model\'s shape too, not just the Controller\'s.',
    tags: ['architectural', 'frontend', 'backend'],
    nodes: [
      n('controller', 'layer-controller', 0, 0),
      n('model', 'layer-model', -180, 160),
      n('view', 'layer-view', 180, 160),
    ],
    edges: [e('controller', 'model', 'updates'), e('controller', 'view', 'renders'), e('view', 'model', 'reads', dashed)],
  }),

  definePattern('pattern-mvvm', 'MVVM (Model-View-ViewModel)', '🔗', {
    description: 'The two-way data binding between View and ViewModel (the bidirectional arrow) is what distinguishes this from MVC — instead of a Controller manually pushing updates into the View, the framework\'s binding layer keeps them in sync automatically, so the View re-renders whenever the ViewModel\'s state changes and user input flows back the same way with no manual wiring. That automatic sync is also the main cost: it depends entirely on the framework\'s binding implementation, and debugging why a value changed can mean tracing through binding machinery instead of a single method call.',
    tags: ['architectural', 'frontend'],
    nodes: [n('view', 'layer-view', -220, 0), n('vm', 'layer-viewmodel', 0, 0), n('model', 'layer-model', 220, 0)],
    edges: [e('view', 'vm', 'data binding', twoWay), e('vm', 'model', 'reads/writes')],
  }),

  definePattern('pattern-pubsub', 'Publish-Subscribe', '📣', {
    description: 'The publisher never knows how many subscribers exist or what they do with an event — it just publishes to the broker and moves on, which decouples producers from consumers completely: a new subscriber can start listening for events that already existed without the publisher changing anything. That decoupling costs the publisher any feedback on whether a subscriber actually processed an event successfully or is even still alive, so error handling and retries become entirely the subscriber\'s problem.',
    tags: ['architectural', 'messaging', 'events'],
    nodes: [
      n('pub', 'layer-service', -220, 0, 'Publisher'),
      n('broker', 'mq-kafka', 0, 0, 'Message Broker'),
      n('subA', 'layer-service', 220, -90, 'Subscriber A'),
      n('subB', 'layer-service', 220, 90, 'Subscriber B'),
    ],
    edges: [e('pub', 'broker'), e('broker', 'subA'), e('broker', 'subB')],
  }),

  definePattern('pattern-read-replica', 'Read Replica', '📖', {
    description: 'Read-heavy workloads (the common case for most apps) scale horizontally just by adding more replicas, since reads can be spread across any of them — but writes still all go through the single primary, because allowing multiple writers would reintroduce the same conflict problem Active-Active Replication has. The catch is replication lag: a read hitting a replica right after a write to the primary can return stale data until that replica catches up, which is why the dashed "async replication" edges matter — anything requiring strictly up-to-date reads has to go to the primary instead.',
    tags: ['availability', 'replication', 'database', 'scaling'],
    nodes: [
      n('app', 'srv-app-server', 0, -170, 'App'),
      n('primary', 'db-generic', 0, 10, 'Primary DB'),
      n('replicaA', 'db-generic', -190, 190, 'Read Replica 1'),
      n('replicaB', 'db-generic', 190, 190, 'Read Replica 2'),
    ],
    edges: [
      e('app', 'primary', 'writes'),
      e('app', 'replicaA', 'reads', dashed),
      e('primary', 'replicaA', 'async replication', dashed),
      e('primary', 'replicaB', 'async replication', dashed),
    ],
  }),

  definePattern('pattern-repository', 'Repository Pattern', '📚', {
    description: 'The Service only calls repository methods like "findById" or "save," never raw queries, so it has no idea whether the underlying storage is Postgres, MongoDB, or an in-memory list — that abstraction is what makes swapping databases or mocking persistence in tests possible without touching business logic. The trade-off is indirection: a repository method has to stay general enough to serve every caller, which can make a highly specific, performance-critical query awkward to express through it.',
    tags: ['architectural', 'backend', 'dal'],
    nodes: [n('service', 'layer-service', 0, 0), n('repo', 'layer-repository', 0, 150), n('db', 'db-generic', 0, 300)],
    edges: [e('service', 'repo'), e('repo', 'db')],
  }),

  definePattern('pattern-resilience-stack', 'Resilience Stack (Rate Limiter + Circuit Breaker)', '🛡️', {
    description: 'A rate limiter throttles bursts before a circuit breaker guards the call to a downstream service, failing over to a cached response when that service is unhealthy.',
    tags: ['architectural', 'resilience', 'api'],
    nodes: [
      n('client', 'client-browser', -380, 0, 'Client'),
      n('limiter', 'layer-rate-limiter', -140, 0, 'Rate Limiter'),
      n('breaker', 'layer-circuit-breaker', 100, 0, 'Circuit Breaker'),
      n('service', 'layer-service', 340, -110, 'Downstream Service'),
      n('fallback', 'cache-redis', 340, 110, 'Fallback Cache'),
    ],
    edges: [
      e('client', 'limiter', 'throttles bursts'),
      e('limiter', 'breaker', 'forwards'),
      e('breaker', 'service', 'calls when healthy'),
      e('breaker', 'fallback', 'serves cached response when open', dashed),
    ],
  }),

  definePattern('pattern-saga', 'Saga (Orchestration)', '🧵', {
    description: 'Orchestration puts one coordinator explicitly in charge of the whole multi-step transaction — calling each service in turn and, in a full implementation, invoking the right compensating action if a later step fails — which makes the entire process easy to see and reason about from one place. That centralization is the trade-off versus a choreographed saga (services reacting to each other\'s events with no central coordinator): the coordinator becomes a single service every step depends on, and adding a step means changing its logic rather than just having a new service listen for an event.',
    tags: ['architectural', 'microservices', 'workflow'],
    nodes: [
      n('coordinator', 'layer-saga-coordinator', 0, -150),
      n('a', 'layer-service', -220, 60, 'Service A'),
      n('b', 'layer-service', 0, 60, 'Service B'),
      n('c', 'layer-service', 220, 60, 'Service C'),
    ],
    edges: [e('coordinator', 'a'), e('coordinator', 'b'), e('coordinator', 'c')],
  }),

  definePattern('pattern-service-discovery', 'Service Discovery', '🧭', {
    description: 'In an environment where instances come and go constantly (autoscaling, deploys, crashes), hardcoding IP addresses breaks the moment anything moves — so each instance registers itself on startup and deregisters on shutdown, and callers look up a current, healthy instance by name instead of a fixed address. The registry itself becomes critical infrastructure this way: if it\'s down or serving stale entries, services can\'t find each other even though they\'re all individually healthy.',
    tags: ['architectural', 'microservices'],
    nodes: [n('registry', 'layer-service-discovery', 0, -150), n('a', 'layer-service', -180, 40, 'Service A'), n('b', 'layer-service', 180, 40, 'Service B')],
    edges: [e('a', 'registry', 'register'), e('b', 'registry', 'register'), e('a', 'b', 'discover & call', dashed)],
  }),

  definePattern('pattern-sidecar', 'Sidecar Pattern', '🚗', {
    description: 'Cross-cutting concerns like TLS termination, logging, or retries are needed by every service in a fleet, but baking that logic into each service\'s own codebase means reimplementing (and separately maintaining) it in every language and framework the fleet uses. Running it as a separate sidecar process instead — deployed alongside the main service, sharing its lifecycle — means that logic is written once and attached to any service regardless of what it\'s written in, at the cost of an extra process (and its own resource footprint) per service instance.',
    tags: ['architectural', 'microservices'],
    nodes: [n('app', 'layer-service', -120, 0, 'Application'), n('sidecar', 'layer-sidecar', 140, 0)],
    edges: [e('app', 'sidecar', '', twoWay)],
  }),

  definePattern('pattern-strangler-fig', 'Strangler Fig', '🌿', {
    description: 'Rewriting a large legacy system in one shot is risky — a big-bang cutover means every bug in the new system surfaces at once, for every user, with no easy way back. The facade instead routes new functionality to the new service incrementally, one flow at a time, while everything not yet migrated keeps working exactly as before — the legacy system gradually gets "strangled" as more traffic shifts away from it, and if a newly migrated flow has a problem, only that flow needs routing back, not the whole system.',
    tags: ['architectural', 'migration'],
    nodes: [
      n('client', 'client-browser', 0, -160, 'Client'),
      n('facade', 'layer-facade', 0, 0, 'Routing Facade'),
      n('legacy', 'layer-legacy-system', -180, 160),
      n('modern', 'layer-service', 180, 160, 'New Service'),
    ],
    edges: [e('client', 'facade'), e('facade', 'legacy', 'old flows'), e('facade', 'modern', 'migrated flows')],
  }),
];
