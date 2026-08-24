import { c } from '../schema.js';

export const category = { id: 'shapes', label: 'Basic Shapes', color: '#64748B' };

const SH = '#64748B';

export const components = [
  c('shape-circle', 'Circle', '⚪', { shape: 'circle', color: SH, defaultSize: { w: 100, h: 100 } }),
  c('shape-cloud', 'Cloud', '☁️', { shape: 'cloud', color: SH, defaultSize: { w: 180, h: 110 } }),
  c('shape-cylinder', 'Cylinder (Database)', '🛢️', { shape: 'cylinder', color: SH }),
  c('shape-diamond', 'Diamond (Decision)', '🔷', { shape: 'diamond', color: SH, defaultSize: { w: 140, h: 100 } }),
  c('shape-group', 'Group / Container', '🔲', { shape: 'rect', color: SH, defaultSize: { w: 320, h: 220 }, textPosition: 'top', iconVisible: false, description: 'A plain labeled boundary box — drop it behind other components (right-click → Send to back) to visually group them under one caption. Purely visual; components placed on top of it aren\'t actually attached to it.' }),
  c('shape-hexagon', 'Hexagon', '🔶', { shape: 'hexagon', color: SH } ),
  c('shape-lifeline', 'Lifeline', '📶', { shape: 'lifeline', color: SH, defaultSize: { w: 140, h: 640 }, textPosition: 'top', iconVisible: false, description: 'A titled vertical timeline for a sequence/communication-flow diagram — drag a connector between two lifelines\' full-height edge to draw a message at any point in time. See the toolbar\'s "🔀 Sequence Diagram" wizard to create a whole set at once.' }),
  c('shape-note', 'Sticky Note', '🗒️', { shape: 'note', color: '#F5D90A', fill: '#FFF9C4', defaultSize: { w: 160, h: 120 } }),
  c('shape-rectangle', 'Rectangle', '▭', { shape: 'rect', color: SH }),
  c('shape-rounded-rect', 'Rounded Rectangle', '▢', { shape: 'rounded', color: SH }),
  c('shape-server-rows', 'Server (with rows)', '🖥️', { shape: 'rows', color: SH, defaultSize: { w: 200, h: 130 } }),
  c('shape-square', 'Square', '⬛', { shape: 'rect', color: SH, defaultSize: { w: 110, h: 110 } }),
  c('shape-text-label', 'Text Label', '🔤', { shape: 'note', color: 'transparent', fill: 'transparent', defaultSize: { w: 140, h: 40 } }),
];
