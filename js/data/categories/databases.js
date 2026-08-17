import { c } from '../schema.js';

export const category = { id: 'databases', label: 'Databases', color: '#059669' };

const DB = '#059669';
const CYL = { shape: 'cylinder' };

export const components = [
  c('db-cassandra', 'Cassandra', '🌸', { ...CYL, color: '#1287B1', tags: ['nosql', 'wide-column'] }),
  c('db-clickhouse', 'ClickHouse', '🏠', { ...CYL, color: '#FFCC01', tags: ['olap', 'analytics'] }),
  c('db-cockroachdb', 'CockroachDB', '🪳', { ...CYL, color: '#6933FF', tags: ['sql', 'distributed'] }),
  c('db-couchdb', 'CouchDB', '🛋️', { ...CYL, color: '#E42528', tags: ['nosql', 'document'] }),
  c('db-elasticsearch', 'Elasticsearch', '🔎', { ...CYL, color: '#005571', tags: ['search', 'nosql'], related: ['mq-kafka'] }),
  c('db-firestore', 'Firebase Firestore', '🔥', { ...CYL, color: '#FFA000', tags: ['nosql', 'realtime'] }),
  c('db-generic', 'Database', '🗄️', { ...CYL, color: DB, tags: ['sql', 'generic'] }),
  c('db-influxdb', 'InfluxDB', '📈', { ...CYL, color: '#22ADF6', tags: ['time-series'] }),
  c('db-mariadb', 'MariaDB', '🦭', { ...CYL, color: '#003545', tags: ['sql'], related: ['db-redis'] }),
  c('db-mongodb', 'MongoDB', '🍃', { ...CYL, color: '#47A248', tags: ['nosql', 'document'], related: ['db-redis'] }),
  c('db-mysql', 'MySQL', '🐬', { ...CYL, color: '#4479A1', tags: ['sql'], related: ['db-redis'] }),
  c('db-neo4j', 'Neo4j', '🕸️', { ...CYL, color: '#008CC1', tags: ['graph'] }),
  c('db-oracle', 'Oracle DB', '🔴', { ...CYL, color: '#F80000', tags: ['sql'] }),
  c('db-planetscale', 'PlanetScale', '🪐', { ...CYL, color: '#000000', tags: ['sql', 'serverless'] }),
  c('db-postgres', 'PostgreSQL', '🐘', { ...CYL, color: '#336791', tags: ['sql'], related: ['db-redis'] }),
  c('db-redis', 'Redis', '🧵', { ...CYL, color: '#DC382D', tags: ['nosql', 'key-value', 'cache'], related: ['db-postgres', 'db-mysql', 'db-mongodb'] }),
  c('db-snowflake', 'Snowflake', '❄️', { ...CYL, color: '#29B5E8', tags: ['warehouse', 'analytics'] }),
  c('db-sqlite', 'SQLite', '🪶', { ...CYL, color: '#003B57', tags: ['sql', 'embedded'] }),
  c('db-sqlserver', 'SQL Server', '🪟', { ...CYL, color: '#CC2927', tags: ['sql'] }),
  c('db-supabase', 'Supabase', '🟩', { ...CYL, color: '#3ECF8E', tags: ['sql', 'baas'] }),
  c('db-timescaledb', 'TimescaleDB', '⏳', { ...CYL, color: '#FDB515', tags: ['time-series', 'sql'] }),
  c('db-vector', 'Vector Database', '🧭', { ...CYL, color: '#8B5CF6', tags: ['ai', 'embeddings', 'search'] }),
];
