import { c } from '../schema.js';

export const category = { id: 'containers', label: 'Containers & Orchestration', color: '#2563EB' };

const CT = '#2563EB';

export const components = [
  c('ctr-docker', 'Docker', '🐳', { color: '#2496ED', related: ['ctr-kubernetes'] }),
  c('ctr-docker-compose', 'Docker Compose', '🧵', { color: '#2496ED', related: ['ctr-docker'] }),
  c('ctr-envoy', 'Envoy Proxy', '🚦', { color: '#AC6199', related: ['ctr-istio'] }),
  c('ctr-helm', 'Helm', '⎈', { color: '#0F1689', related: ['ctr-kubernetes'] }),
  c('ctr-istio', 'Istio', '🕸️', { color: '#466BB0', related: ['ctr-kubernetes', 'ctr-envoy'] }),
  c('ctr-k3s', 'k3s', '☸️', { color: '#FFC61C' }),
  c('ctr-kubernetes', 'Kubernetes', '☸️', { color: '#326CE5', related: ['ctr-docker', 'ctr-pod'] }),
  c('ctr-nomad', 'Nomad', '🧭', { color: '#00CA8E' }),
  c('ctr-openshift', 'OpenShift', '🔴', { color: '#EE0000' }),
  c('ctr-pod', 'Pod', '🫛', { color: '#326CE5', related: ['ctr-kubernetes'] }),
  c('ctr-podman', 'Podman', '🦭', { color: '#892CA0' }),
  c('ctr-rancher', 'Rancher', '🐄', { color: '#0075A8', related: ['ctr-kubernetes'] }),
];
