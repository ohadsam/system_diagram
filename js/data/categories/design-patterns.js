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

export const components = [
  definePattern('pattern-mvc', 'MVC (Model-View-Controller)', '🎮', {
    description: 'Controller mediates between Model and View.',
    tags: ['architectural', 'frontend', 'backend'],
    nodes: [
      n('controller', 'layer-controller', 0, 0),
      n('model', 'layer-model', -180, 160),
      n('view', 'layer-view', 180, 160),
    ],
    edges: [e('controller', 'model', 'updates'), e('controller', 'view', 'renders'), e('view', 'model', 'reads', dashed)],
  }),

  definePattern('pattern-mvvm', 'MVVM (Model-View-ViewModel)', '🔗', {
    description: 'View binds to a ViewModel that reads/writes the Model.',
    tags: ['architectural', 'frontend'],
    nodes: [n('view', 'layer-view', -220, 0), n('vm', 'layer-viewmodel', 0, 0), n('model', 'layer-model', 220, 0)],
    edges: [e('view', 'vm', 'data binding', twoWay), e('vm', 'model', 'reads/writes')],
  }),

  definePattern('pattern-mvp', 'MVP (Model-View-Presenter)', '🎤', {
    description: 'Presenter drives a passive View and talks to the Model.',
    tags: ['architectural', 'frontend'],
    nodes: [n('view', 'layer-view', -220, 0), n('presenter', 'layer-presenter', 0, 0), n('model', 'layer-model', 220, 0)],
    edges: [e('view', 'presenter', '', twoWay), e('presenter', 'model', 'reads/writes')],
  }),

  definePattern('pattern-layered', 'Layered Architecture (N-Tier)', '🏗️', {
    description: 'Controller → Service → DAL → Database, each layer only calling the one below.',
    tags: ['architectural', 'backend'],
    nodes: [
      n('controller', 'layer-controller', 0, 0),
      n('service', 'layer-service', 0, 150),
      n('dal', 'layer-dal', 0, 300),
      n('db', 'db-generic', 0, 450),
    ],
    edges: [e('controller', 'service'), e('service', 'dal'), e('dal', 'db')],
  }),

  definePattern('pattern-repository', 'Repository Pattern', '📚', {
    description: 'Service talks to a Repository that abstracts the database.',
    tags: ['architectural', 'backend', 'dal'],
    nodes: [n('service', 'layer-service', 0, 0), n('repo', 'layer-repository', 0, 150), n('db', 'db-generic', 0, 300)],
    edges: [e('service', 'repo'), e('repo', 'db')],
  }),

  definePattern('pattern-cqrs', 'CQRS (Command Query Responsibility Segregation)', '🔀', {
    description: 'Separate write (command) and read (query) paths.',
    tags: ['architectural', 'backend'],
    nodes: [
      n('cmd', 'layer-command-handler', -180, 0),
      n('writeDb', 'db-generic', -180, 150, 'Write DB'),
      n('qry', 'layer-query-handler', 180, 0),
      n('readDb', 'db-generic', 180, 150, 'Read DB'),
    ],
    edges: [e('cmd', 'writeDb'), e('qry', 'readDb'), e('writeDb', 'readDb', 'sync', dashed)],
  }),

  definePattern('pattern-api-gateway', 'API Gateway', '🚪', {
    description: 'A single entry point fans requests out to backend services.',
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

  definePattern('pattern-circuit-breaker', 'Circuit Breaker', '🔌', {
    description: 'Guards a call to an unreliable dependency, failing fast when it is unhealthy.',
    tags: ['architectural', 'resilience'],
    nodes: [n('service', 'layer-service', -180, 0), n('breaker', 'layer-circuit-breaker', 60, 0), n('external', 'layer-client-sdk', 300, 0, 'External Service')],
    edges: [e('service', 'breaker'), e('breaker', 'external')],
  }),

  definePattern('pattern-pubsub', 'Publish-Subscribe', '📣', {
    description: 'A publisher pushes events through a broker to many subscribers.',
    tags: ['architectural', 'messaging', 'events'],
    nodes: [
      n('pub', 'layer-service', -220, 0, 'Publisher'),
      n('broker', 'mq-kafka', 0, 0, 'Message Broker'),
      n('subA', 'layer-service', 220, -90, 'Subscriber A'),
      n('subB', 'layer-service', 220, 90, 'Subscriber B'),
    ],
    edges: [e('pub', 'broker'), e('broker', 'subA'), e('broker', 'subB')],
  }),

  definePattern('pattern-event-sourcing', 'Event Sourcing', '📜', {
    description: 'State changes are stored as an append-only sequence of events.',
    tags: ['architectural', 'events'],
    nodes: [
      n('cmd', 'layer-command-handler', -240, 0),
      n('store', 'db-generic', -40, 0, 'Event Store'),
      n('projector', 'layer-event-handler', 160, 0, 'Projector'),
      n('readModel', 'db-generic', 360, 0, 'Read Model'),
    ],
    edges: [e('cmd', 'store'), e('store', 'projector'), e('projector', 'readModel')],
  }),

  definePattern('pattern-saga', 'Saga (Orchestration)', '🧵', {
    description: 'A coordinator drives a multi-step transaction across services.',
    tags: ['architectural', 'microservices', 'workflow'],
    nodes: [
      n('coordinator', 'layer-saga-coordinator', 0, -150),
      n('a', 'layer-service', -220, 60, 'Service A'),
      n('b', 'layer-service', 0, 60, 'Service B'),
      n('c', 'layer-service', 220, 60, 'Service C'),
    ],
    edges: [e('coordinator', 'a'), e('coordinator', 'b'), e('coordinator', 'c')],
  }),

  definePattern('pattern-sidecar', 'Sidecar Pattern', '🚗', {
    description: 'A helper process runs alongside the main service to handle cross-cutting concerns.',
    tags: ['architectural', 'microservices'],
    nodes: [n('app', 'layer-service', -120, 0, 'Application'), n('sidecar', 'layer-sidecar', 140, 0)],
    edges: [e('app', 'sidecar', '', twoWay)],
  }),

  definePattern('pattern-strangler-fig', 'Strangler Fig', '🌿', {
    description: 'New functionality is routed to a new service while legacy traffic keeps flowing, until the legacy system is fully retired.',
    tags: ['architectural', 'migration'],
    nodes: [
      n('client', 'client-browser', 0, -160, 'Client'),
      n('facade', 'layer-facade', 0, 0, 'Routing Facade'),
      n('legacy', 'layer-legacy-system', -180, 160),
      n('modern', 'layer-service', 180, 160, 'New Service'),
    ],
    edges: [e('client', 'facade'), e('facade', 'legacy', 'old flows'), e('facade', 'modern', 'migrated flows')],
  }),

  definePattern('pattern-bff', 'Backend for Frontend (BFF)', '📱', {
    description: 'Each client type gets its own tailored backend.',
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

  definePattern('pattern-hexagonal', 'Hexagonal Architecture (Ports & Adapters)', '⬡', {
    description: 'The core domain is isolated behind ports, reached through adapters.',
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

  definePattern('pattern-service-discovery', 'Service Discovery', '🧭', {
    description: 'Services register themselves and look each other up via a registry.',
    tags: ['architectural', 'microservices'],
    nodes: [n('registry', 'layer-service-discovery', 0, -150), n('a', 'layer-service', -180, 40, 'Service A'), n('b', 'layer-service', 180, 40, 'Service B')],
    edges: [e('a', 'registry', 'register'), e('b', 'registry', 'register'), e('a', 'b', 'discover & call', dashed)],
  }),

  definePattern('pattern-cache-aside', 'Cache-Aside', '⚡', {
    description: 'The service checks the cache first, falling back to the database and populating the cache on a miss.',
    tags: ['architectural', 'performance', 'cache'],
    nodes: [n('service', 'layer-service', 0, -150), n('cache', 'cache-redis', -180, 60), n('db', 'db-generic', 180, 60)],
    edges: [e('service', 'cache', '1. check'), e('service', 'db', '2. on miss'), e('db', 'cache', '3. populate', dashed)],
  }),

  definePattern('pattern-rate-limiting', 'Rate Limiting Gateway', '🚦', {
    description: 'Throttles incoming requests before they reach the service.',
    tags: ['architectural', 'resilience', 'api'],
    nodes: [n('client', 'client-browser', 0, -150, 'Client'), n('limiter', 'layer-rate-limiter', 0, 0), n('service', 'layer-service', 0, 150)],
    edges: [e('client', 'limiter'), e('limiter', 'service')],
  }),

  definePattern('pattern-singleton', 'Singleton', '1️⃣', {
    description: 'One shared instance, reused across the app.',
    tags: ['gof', 'creational'],
    nodes: [n('client', 'layer-client-sdk', 0, -150, 'Client'), n('instance', 'layer-singleton', 0, 30)],
    edges: [e('client', 'instance', 'getInstance()')],
  }),

  definePattern('pattern-factory-method', 'Factory Method', '🏭', {
    description: 'Delegates object creation to a factory instead of a direct constructor call.',
    tags: ['gof', 'creational'],
    nodes: [
      n('client', 'layer-client-sdk', 0, -150, 'Client'),
      n('factory', 'layer-factory', 0, 30),
      n('a', 'layer-product', -180, 210, 'Product A'),
      n('b', 'layer-product', 180, 210, 'Product B'),
    ],
    edges: [e('client', 'factory'), e('factory', 'a', '', dashed), e('factory', 'b', '', dashed)],
  }),

  definePattern('pattern-observer', 'Observer', '👁️', {
    description: 'Observers subscribe to a subject and get notified on change.',
    tags: ['gof', 'behavioral'],
    nodes: [
      n('subject', 'layer-observer-role', 0, -150, 'Subject'),
      n('a', 'layer-observer-role', -220, 60, 'Observer A'),
      n('b', 'layer-observer-role', 0, 60, 'Observer B'),
      n('c', 'layer-observer-role', 220, 60, 'Observer C'),
    ],
    edges: [e('subject', 'a', 'notify'), e('subject', 'b', 'notify'), e('subject', 'c', 'notify')],
  }),

  definePattern('pattern-strategy', 'Strategy', '🎯', {
    description: 'An interchangeable algorithm chosen at runtime.',
    tags: ['gof', 'behavioral'],
    nodes: [
      n('context', 'layer-context-role', 0, -150),
      n('iface', 'layer-strategy', 0, 30, 'Strategy Interface'),
      n('a', 'layer-strategy', -180, 210, 'Concrete Strategy A'),
      n('b', 'layer-strategy', 180, 210, 'Concrete Strategy B'),
    ],
    edges: [e('context', 'iface'), e('iface', 'a', '', dashed), e('iface', 'b', '', dashed)],
  }),

  definePattern('pattern-adapter', 'Adapter', '🔧', {
    description: 'Translates a client’s expected interface into an existing (incompatible) one.',
    tags: ['gof', 'structural'],
    nodes: [n('client', 'layer-client-sdk', -220, 0, 'Client'), n('adapter', 'layer-adapter', 0, 0), n('adaptee', 'layer-adaptee', 220, 0)],
    edges: [e('client', 'adapter'), e('adapter', 'adaptee')],
  }),

  definePattern('pattern-decorator', 'Decorator', '🎀', {
    description: 'Wraps an object in layers that each add behavior.',
    tags: ['gof', 'structural'],
    nodes: [
      n('client', 'layer-client-sdk', -280, 0, 'Client'),
      n('decA', 'layer-decorator', -90, 0, 'Decorator A'),
      n('decB', 'layer-decorator', 100, 0, 'Decorator B'),
      n('component', 'layer-target-interface', 290, 0, 'Component'),
    ],
    edges: [e('client', 'decA'), e('decA', 'decB'), e('decB', 'component')],
  }),

  definePattern('pattern-active-active', 'Active-Active Replication', '🔁', {
    description: 'Two peer instances both actively serve traffic, with data kept in sync in both directions.',
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
    description: 'One instance actively serves traffic while a standby stays in sync, ready to take over on failover.',
    tags: ['availability', 'replication', 'ha', 'failover'],
    nodes: [
      n('app', 'srv-app-server', 0, -160, 'App (Active)'),
      n('primary', 'db-generic', -180, 20, 'Primary DB (Active)'),
      n('standby', 'db-generic', 180, 20, 'Standby DB (Passive)'),
    ],
    edges: [e('app', 'primary', 'reads/writes'), e('primary', 'standby', 'replicates', dashed)],
  }),

  definePattern('pattern-multi-az', 'Multi-AZ Deployment', '🏢', {
    description: 'A standby copy lives in a second Availability Zone, ready to fail over if the primary AZ goes down.',
    tags: ['availability', 'replication', 'ha', 'multi-az'],
    nodes: [
      n('lb', 'net-load-balancer', 0, -170, 'Load Balancer'),
      n('app', 'srv-app-server', -190, 0, 'App (AZ-A)'),
      n('primary', 'db-generic', -190, 170, 'Primary DB (AZ-A)'),
      n('standby', 'db-generic', 190, 170, 'Standby DB (AZ-B)'),
    ],
    edges: [e('lb', 'app'), e('app', 'primary'), e('primary', 'standby', 'sync replication', dashed)],
  }),

  definePattern('pattern-read-replica', 'Read Replica', '📖', {
    description: 'The app writes to a primary database, which replicates to one or more read-only replicas that absorb read traffic.',
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

  definePattern('pattern-multi-region-active-active', 'Multi-Region Active-Active', '🌍', {
    description: 'Independent regional stacks each serve local traffic, routed by DNS/geo-routing, while data replicates across regions.',
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
];
