// Pure-data helper for defining a predefined component. No logic/behavior
// lives here — see docs/AI_AGENT_GUIDE.md "Add a predefined component".

/**
 * @param {string} id unique across the whole library, kebab-case, e.g. 'aws-ec2'
 * @param {string} name display name
 * @param {string} icon a single emoji used as the visual icon
 * @param {object} [opts]
 * @param {string} [opts.shape] one of core/project.js SHAPES, default 'rounded'
 * @param {string} [opts.color] hex border/accent color
 * @param {string} [opts.fill] hex fill color, default derived from color
 * @param {string} [opts.description] one-line description shown in tooltip/search
 * @param {string[]} [opts.tags] extra search keywords
 * @param {{name:string, icon:string}[]} [opts.subComponents] pre-attached sub-components
 * @param {{w:number,h:number}} [opts.defaultSize]
 * @param {'component'|'layer'} [opts.kind] 'layer' items (see categories/layers.js)
 *   can also be dropped onto an existing node (or added via its details panel)
 *   to attach as one of its sub-components, instead of only standing alone.
 * @param {string[]} [opts.related] ids of other components commonly used
 *   alongside this one in real designs (e.g. a load balancer → a web
 *   server), offered as one-click "Smart Suggestions" when this component
 *   is placed — see canvas/suggestions.js. Curated by hand, deliberately
 *   sparse: only add a pairing you'd confidently draw yourself, not every
 *   component that could plausibly connect to this one — see
 *   docs/AI_AGENT_GUIDE.md "Add a predefined component" and
 *   .claude/skills/add-library-item/SKILL.md for the bar to clear.
 */
export function c(id, name, icon, opts = {}) {
  return {
    id,
    name,
    icon,
    kind: opts.kind || 'component',
    shape: opts.shape || 'rounded',
    color: opts.color || '#4F46E5',
    fill: opts.fill || tint(opts.color || '#4F46E5'),
    description: opts.description || '',
    tags: opts.tags || [],
    subComponents: opts.subComponents || [],
    defaultSize: opts.defaultSize || { w: 160, h: 84 },
    related: opts.related || [],
  };
}

/**
 * Defines a "design pattern": not a single placeable node but a small
 * blueprint of nodes (each referencing a real component/layer defId, with a
 * position offset from the drop point) and the edges connecting them.
 * Dropping/clicking a pattern in the sidebar instantiates the whole cluster
 * at once — see canvas/canvas.js#instantiatePattern.
 *
 * @param {{key:string, defId:string, dx:number, dy:number, label?:string}[]} nodes
 * @param {{from:string, to:string, label?:string, dash?:string, startArrow?:string, endArrow?:string, routing?:string}[]} edges
 */
export function definePattern(id, name, icon, { description = '', tags = [], nodes, edges } = {}) {
  return {
    id,
    name,
    icon,
    kind: 'pattern',
    shape: 'rounded',
    color: '#0F766E',
    fill: '#F0FDFA',
    description,
    tags,
    subComponents: [],
    defaultSize: { w: 1, h: 1 }, // patterns never render as a single node — see instantiatePattern
    pattern: { nodes, edges: edges || [] },
  };
}

// Very light tint of a hex color toward white, used as a component's default
// fill so text/icon stay legible without every component needing its own
// fill value.
function tint(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const mix = (channel) => Math.round(channel + (255 - channel) * 0.88);
  return `#${[r, g, b].map((ch) => mix(ch).toString(16).padStart(2, '0')).join('')}`;
}
