import { c } from '../schema.js';

export const category = { id: 'client', label: 'Client & Frontend', color: '#0EA5E9' };

const CL = '#0EA5E9';

export const components = [
  c('client-browser', 'Web Browser', '🌐', { color: CL, tags: ['client'] }),
  c('client-cli', 'CLI Tool', '⌨️', { color: CL, tags: ['client', 'terminal'] }),
  c('client-desktop-app', 'Desktop App', '🖥️', { color: CL, tags: ['client', 'electron'] }),
  c('client-iot-device', 'IoT Device', '📟', { color: CL, tags: ['client', 'edge'] }),
  c('client-kiosk', 'Kiosk App', '🖲️', { color: CL, tags: ['client'] }),
  c('client-mobile-android', 'Mobile App (Android)', '🤖', { color: CL, tags: ['client', 'mobile'] }),
  c('client-mobile-ios', 'Mobile App (iOS)', '📱', { color: CL, tags: ['client', 'mobile'] }),
  c('client-pwa', 'Progressive Web App', '📲', { color: CL, tags: ['client', 'pwa'] }),
  c('client-smart-tv', 'Smart TV App', '📺', { color: CL, tags: ['client'] }),
  c('client-spa', 'Single Page App', '🧭', { color: CL, tags: ['client', 'spa'] }),
  c('client-static-site', 'Static Site', '📄', { color: CL, tags: ['client', 'hosting'] }),
  c('client-user', 'User / Actor', '🧑', { shape: 'circle', color: '#475569', tags: ['actor', 'end-user'], defaultSize: { w: 72, h: 72 } }),
  c('client-wearable', 'Wearable App', '⌚', { color: CL, tags: ['client', 'wearable'] }),
  c('client-widget', 'Embedded Widget', '🧩', { color: CL, tags: ['client', 'widget'] }),
];
