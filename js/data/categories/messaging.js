import { c } from '../schema.js';

export const category = { id: 'messaging', label: 'Messaging & Streaming', color: '#B45309' };

const MQ = '#B45309';

export const components = [
  c('mq-activemq', 'ActiveMQ', '📮', { color: MQ }),
  c('mq-eventbridge-generic', 'Event Bus', '🚌', { color: MQ }),
  c('mq-google-pubsub', 'Google Pub/Sub', '📡', { color: '#4285F4' }),
  c('mq-kafka', 'Apache Kafka', '🪵', { popular: true, color: '#231F20', related: ['db-elasticsearch'], relatedPatterns: ['seq-outbox-pattern', 'seq-kafka-rebalance'] }),
  c('mq-mqtt', 'MQTT Broker', '📶', { color: MQ }),
  c('mq-nats', 'NATS', '✉️', { color: MQ }),
  c('mq-pulsar', 'Apache Pulsar', '🌟', { color: '#188FFF' }),
  c('mq-rabbitmq', 'RabbitMQ', '🐇', { popular: true, color: '#FF6600' }),
  c('mq-redis-streams', 'Redis Streams', '🧵', { color: '#DC382D' }),
  c('mq-service-bus', 'Azure Service Bus', '🚏', { color: '#0078D4' }),
  c('mq-webhook', 'Webhook', '🪝', { color: MQ }),
  c('mq-zeromq', 'ZeroMQ', '0️⃣', { color: MQ }),
];
