import { c } from '../schema.js';

export const category = { id: 'frontend-frameworks', label: 'Frontend Frameworks', color: '#06B6D4' };

const FE = '#06B6D4';

export const components = [
  c('fe-alpinejs', 'Alpine.js', '🏔️', { color: FE }),
  c('fe-angular', 'Angular', '🅰️', { color: '#DD0031', relatedLayers: ['layer-angular-component', 'layer-angular-service'] }),
  c('fe-astro', 'Astro', '🚀', { color: FE }),
  c('fe-ember', 'Ember.js', '🐹', { color: '#E04E39' }),
  c('fe-gatsby', 'Gatsby', '🟣', { color: '#663399', related: ['fe-react'] }),
  c('fe-htmx', 'htmx', '🔗', { color: FE }),
  c('fe-jquery', 'jQuery', '💲', { color: '#0769AD' }),
  c('fe-nextjs', 'Next.js', '▲', { popular: true, color: '#111827', related: ['fe-react', 'cloud-vercel'], relatedLayers: ['layer-react-hook', 'layer-react-component'] }),
  c('fe-nuxt', 'Nuxt', '💚', { color: '#00DC82', related: ['fe-vue'], relatedLayers: ['layer-vue-component', 'layer-vue-store'] }),
  c('fe-preact', 'Preact', '💠', { color: '#673AB8', relatedLayers: ['layer-react-hook', 'layer-react-component'] }),
  c('fe-qwik', 'Qwik', '⚡', { color: '#AC7EF4' }),
  c('fe-react', 'React', '⚛️', { popular: true, color: '#61DAFB', related: ['fe-nextjs'], relatedLayers: ['layer-react-hook', 'layer-react-component'] }),
  c('fe-remix', 'Remix', '💿', { color: FE, related: ['fe-react'], relatedLayers: ['layer-react-hook', 'layer-react-component'] }),
  c('fe-solidjs', 'SolidJS', '🔷', { color: '#2C4F7C' }),
  c('fe-svelte', 'Svelte', '🔥', { color: '#FF3E00' }),
  c('fe-vue', 'Vue.js', '💚', { popular: true, color: '#42B883', related: ['fe-nuxt'], relatedLayers: ['layer-vue-component', 'layer-vue-store'] }),
];
