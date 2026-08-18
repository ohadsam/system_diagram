import { c } from '../schema.js';

export const category = { id: 'backend-frameworks', label: 'Backend Frameworks & Languages', color: '#7C3AED' };

const BE = '#7C3AED';

export const components = [
  c('be-actix', 'Actix (Rust)', '🦀', { color: '#DE3F24', relatedLayers: ['layer-handler', 'layer-middleware'] }),
  c('be-aspnet', 'ASP.NET Core', '🟣', { color: '#512BD4', relatedLayers: ['layer-controller', 'layer-model'] }),
  c('be-django', 'Django (Python)', '🐍', { popular: true, color: '#092E20', relatedLayers: ['layer-model', 'layer-view'] }),
  c('be-dotnet', '.NET / C#', '🔷', { color: '#512BD4' }),
  c('be-express', 'Express (Node.js)', '🚂', { popular: true, color: '#111827', relatedLayers: ['layer-controller', 'layer-middleware'] }),
  c('be-fastapi', 'FastAPI (Python)', '⚡', { color: '#009688', relatedLayers: ['layer-validator', 'layer-dto'] }),
  c('be-fastify', 'Fastify (Node.js)', '🐦', { color: BE, relatedLayers: ['layer-controller', 'layer-middleware'] }),
  c('be-fiber', 'Fiber (Go)', '🐹', { color: '#00ADD8', relatedLayers: ['layer-handler', 'layer-middleware'] }),
  c('be-flask', 'Flask (Python)', '🧪', { color: '#111827' }),
  c('be-go', 'Go', '🐹', { color: '#00ADD8' }),
  c('be-gin', 'Gin (Go)', '🍸', { color: '#00ADD8', relatedLayers: ['layer-handler', 'layer-middleware'] }),
  c('be-java', 'Java', '☕', { color: '#EA2D2E' }),
  c('be-laravel', 'Laravel (PHP)', '🎭', { color: '#FF2D20', relatedLayers: ['layer-model', 'layer-controller'] }),
  c('be-nestjs', 'NestJS (Node.js)', '🐈', { color: '#E0234E', relatedLayers: ['layer-controller', 'layer-service'] }),
  c('be-nodejs', 'Node.js', '🟢', { popular: true, color: '#339933' }),
  c('be-phoenix', 'Phoenix (Elixir)', '🔥', { color: '#FD4F00', relatedLayers: ['layer-controller', 'layer-model'] }),
  c('be-python', 'Python', '🐍', { color: '#3776AB' }),
  c('be-rails', 'Ruby on Rails', '💎', { color: '#CC0000', relatedLayers: ['layer-model', 'layer-controller'] }),
  c('be-spring-boot', 'Spring Boot (Java)', '🍃', { popular: true, color: '#6DB33F', related: ['srv-tomcat'], relatedLayers: ['layer-controller', 'layer-service'] }),
];
