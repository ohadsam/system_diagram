import { c } from '../schema.js';

export const category = { id: 'monitoring', label: 'Monitoring & Observability', color: '#0891B2' };

const MO = '#0891B2';

export const components = [
  c('mon-appdynamics', 'AppDynamics', '📉', { color: MO }),
  c('mon-datadog', 'Datadog', '🐶', { color: '#632CA6' }),
  c('mon-grafana', 'Grafana', '📊', { color: '#F46800', related: ['mon-prometheus'] }),
  c('mon-jaeger', 'Jaeger', '🩺', { color: '#66CFE3' }),
  c('mon-nagios', 'Nagios', '👁️', { color: MO }),
  c('mon-newrelic', 'New Relic', '🚗', { color: '#008C99' }),
  c('mon-opentelemetry', 'OpenTelemetry', '📶', { color: MO }),
  c('mon-pagerduty', 'PagerDuty', '🚨', { color: '#06AC38' }),
  c('mon-prometheus', 'Prometheus', '🔥', { color: '#E6522C', related: ['mon-grafana'] }),
  c('mon-sentry', 'Sentry', '🐛', { color: '#362D59' }),
  c('mon-status-page', 'Status Page', '🟢', { color: MO }),
  c('mon-uptime-check', 'Uptime / Health Check', '💓', { color: MO }),
  c('mon-zabbix', 'Zabbix', '🔴', { color: '#D40000' }),
  c('mon-zipkin', 'Zipkin', '🧵', { color: MO }),
];
