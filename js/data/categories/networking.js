import { c } from '../schema.js';

export const category = { id: 'networking', label: 'Networking', color: '#0284C7' };

const NW = '#0284C7';

export const components = [
  c('net-api-gateway', 'API Gateway', '🚪', { popular: true, color: NW, related: ['srv-app-server', 'misc-graphql', 'sec-oauth'], relatedLayers: ['layer-authentication', 'layer-rate-limiter'], relatedPatterns: ['seq-rbac-check', 'seq-api-key-auth'] }),
  c('net-bastion-host', 'Bastion Host', '🏰', { color: NW, description: 'A hardened, minimal-access jump box — the single approved entry point for administrative SSH/RDP into a private network.', tags: ['jump-box', 'ssh'], related: ['net-vpn-gateway'] }),
  c('net-cdn', 'CDN', '🌍', { popular: true, color: NW, related: ['aws-s3', 'storage-object'] }),
  c('net-dns', 'DNS', '🧭', { popular: true, color: NW, relatedPatterns: ['seq-dns-resolution'] }),
  c('net-firewall', 'Firewall', '🧱', { color: '#B91C1C' }),
  c('net-ids-ips', 'IDS / IPS', '🚨', { color: '#B91C1C', description: 'Intrusion Detection/Prevention System — inspects traffic for known attack patterns, alerting (IDS) or actively blocking (IPS).', tags: ['security', 'intrusion-detection'], related: ['net-firewall'] }),
  c('net-load-balancer', 'Load Balancer', '⚖️', { popular: true, color: NW, related: ['srv-nginx', 'aws-auto-scaling'] }),
  c('net-nacl', 'Network ACL', '📋', { color: NW, description: 'A stateless, subnet-level allow/deny rule list — evaluated before traffic reaches a security group or host firewall.', tags: ['security', 'acl'], related: ['net-subnet'] }),
  c('net-nat', 'NAT', '🔀', { color: NW }),
  c('net-nginx', 'Nginx', '🟩', { color: '#009639' }),
  c('net-proxy', 'Proxy Server', '🛰️', { color: NW }),
  c('net-reverse-proxy', 'Reverse Proxy', '🔁', { color: NW }),
  c('net-router', 'Router', '📡', { color: NW, relatedPatterns: ['seq-tcp-handshake', 'seq-udp-exchange'] }),
  c('net-service-mesh', 'Service Mesh', '🕸️', { color: NW, related: ['srv-microservice'], relatedLayers: ['layer-sidecar'], relatedPatterns: ['seq-mtls-handshake'] }),
  c('net-subnet', 'Subnet', '🔲', { shape: 'rect', color: NW, defaultSize: { w: 220, h: 140 } }),
  c('net-switch', 'Switch', '🔀', { color: NW, description: 'Forwards traffic between devices on the same local network segment, based on MAC address.', tags: ['layer-2', 'lan'] }),
  c('net-vpn-gateway', 'VPN Gateway', '🔐', { color: NW }),
  c('net-vpc', 'Virtual Network / VPC', '🕸️', { shape: 'rect', color: NW, defaultSize: { w: 260, h: 180 } }),
  c('net-websocket', 'WebSocket Server', '🔌', { color: NW, description: 'A persistent, full-duplex connection for real-time push (chat, live updates, notifications) — upgraded from an ordinary HTTP request.', tags: ['realtime', 'websocket'], relatedPatterns: ['seq-websocket-handshake'] }),
];
