import { c } from '../schema.js';

export const category = { id: 'networking', label: 'Networking', color: '#0284C7' };

const NW = '#0284C7';

export const components = [
  c('net-api-gateway', 'API Gateway', '🚪', { popular: true, color: NW, related: ['srv-app-server', 'misc-graphql', 'sec-oauth'], relatedLayers: ['layer-authentication', 'layer-rate-limiter'], relatedPatterns: ['seq-rbac-check', 'seq-api-key-auth'] }),
  c('net-cdn', 'CDN', '🌍', { popular: true, color: NW, related: ['aws-s3', 'storage-object'] }),
  c('net-dns', 'DNS', '🧭', { popular: true, color: NW }),
  c('net-firewall', 'Firewall', '🧱', { color: '#B91C1C' }),
  c('net-load-balancer', 'Load Balancer', '⚖️', { popular: true, color: NW, related: ['srv-nginx', 'aws-auto-scaling'] }),
  c('net-nat', 'NAT', '🔀', { color: NW }),
  c('net-nginx', 'Nginx', '🟩', { color: '#009639' }),
  c('net-proxy', 'Proxy Server', '🛰️', { color: NW }),
  c('net-reverse-proxy', 'Reverse Proxy', '🔁', { color: NW }),
  c('net-router', 'Router', '📡', { color: NW, relatedPatterns: ['seq-tcp-handshake', 'seq-udp-exchange'] }),
  c('net-service-mesh', 'Service Mesh', '🕸️', { color: NW, related: ['srv-microservice'], relatedLayers: ['layer-sidecar'] }),
  c('net-subnet', 'Subnet', '🔲', { shape: 'rect', color: NW, defaultSize: { w: 220, h: 140 } }),
  c('net-vpn-gateway', 'VPN Gateway', '🔐', { color: NW }),
  c('net-vpc', 'Virtual Network / VPC', '🕸️', { shape: 'rect', color: NW, defaultSize: { w: 260, h: 180 } }),
];
