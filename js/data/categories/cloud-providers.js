import { c } from '../schema.js';

export const category = { id: 'cloud-providers', label: 'Cloud Providers', color: '#0F172A' };

export const components = [
  c('cloud-alibaba', 'Alibaba Cloud', '☁️', { color: '#FF6A00' }),
  c('cloud-aws', 'AWS Cloud', '☁️', { color: '#FF9900', shape: 'cloud', defaultSize: { w: 220, h: 140 } }),
  c('cloud-azure', 'Microsoft Azure', '☁️', { color: '#0078D4', shape: 'cloud', defaultSize: { w: 220, h: 140 } }),
  c('cloud-digitalocean', 'DigitalOcean', '🌊', { color: '#0080FF' }),
  c('cloud-gcp', 'Google Cloud Platform', '☁️', { color: '#4285F4', shape: 'cloud', defaultSize: { w: 220, h: 140 } }),
  c('cloud-heroku', 'Heroku', '🟣', { color: '#430098' }),
  c('cloud-netlify', 'Netlify', '🟦', { color: '#00C7B7', related: ['client-static-site'] }),
  c('cloud-vercel', 'Vercel', '▲', { color: '#000000', related: ['fe-nextjs'] }),
];
