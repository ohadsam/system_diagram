import { c } from '../schema.js';

export const category = { id: 'logging', label: 'Logging', color: '#4B5563' };

const LG = '#4B5563';

export const components = [
  c('log-cloudwatch-logs', 'CloudWatch Logs', '📄', { color: '#FF9900' }),
  c('log-elk', 'ELK Stack', '🦌', { color: LG }),
  c('log-filebeat', 'Filebeat', '🥁', { color: LG }),
  c('log-fluentd', 'Fluentd', '💧', { color: '#0E83C8' }),
  c('log-graylog', 'Graylog', '🐺', { color: '#F4952C' }),
  c('log-kibana', 'Kibana', '🧭', { color: '#005571' }),
  c('log-logstash', 'Logstash', '🚂', { color: '#005571' }),
  c('log-loki', 'Loki', '🪵', { color: '#F5A623' }),
  c('log-splunk', 'Splunk', '💡', { color: '#000000' }),
  c('log-store', 'Log Store', '🗂️', { shape: 'cylinder', color: LG }),
];
