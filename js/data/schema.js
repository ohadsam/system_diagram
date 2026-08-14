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
 */
export function c(id, name, icon, opts = {}) {
  return {
    id,
    name,
    icon,
    shape: opts.shape || 'rounded',
    color: opts.color || '#4F46E5',
    fill: opts.fill || tint(opts.color || '#4F46E5'),
    description: opts.description || '',
    tags: opts.tags || [],
    subComponents: opts.subComponents || [],
    defaultSize: opts.defaultSize || { w: 160, h: 84 },
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
