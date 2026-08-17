import { c } from '../schema.js';

export const category = { id: 'servers', label: 'Servers & Compute', color: '#4338CA' };

const SV = '#4338CA';

export const components = [
  c('srv-apache', 'Apache HTTP Server', '🪶', { color: '#D22128', related: ['srv-tomcat'] }),
  c('srv-app-server', 'Application Server', '🖥️', { color: SV, shape: 'rows', tags: ['rows', 'internal components'], relatedLayers: ['layer-controller', 'layer-service'] }),
  c('srv-bare-metal', 'Bare Metal Server', '🗄️', { color: SV }),
  c('srv-iis', 'IIS', '🪟', { color: '#5391FE' }),
  c('srv-microservice', 'Microservice', '🧩', { color: SV, related: ['net-service-mesh'] }),
  c('srv-monolith', 'Monolith', '🏛️', { color: SV, defaultSize: { w: 200, h: 120 } }),
  c('srv-nginx', 'Nginx Web Server', '🟩', { popular: true, color: '#009639', related: ['net-load-balancer'] }),
  c('srv-serverless-fn', 'Serverless Function', 'ƒ', { color: SV, related: ['net-api-gateway'] }),
  c('srv-tomcat', 'Apache Tomcat', '🐈', { color: '#F8DC75', related: ['be-spring-boot', 'srv-apache'] }),
  c('srv-vm', 'Virtual Machine', '🖥️', { color: SV }),
  c('srv-web-server', 'Web Server (with rows)', '🌐', { color: SV, shape: 'rows', tags: ['rows', 'internal components'] }),
];
