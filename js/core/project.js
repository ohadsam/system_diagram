// Pure functions that create/mutate/validate a project object.
// No DOM, no store — trivially unit-testable and reusable by import/export.
import { nextId } from './id.js';

export const FORMAT_VERSION = 1;

export const SHAPES = ['rect', 'rounded', 'circle', 'diamond', 'cylinder', 'hexagon', 'cloud', 'note', 'rows'];
export const ROUTINGS = ['straight', 'orthogonal', 'curved'];
export const ARROW_HEADS = ['none', 'open', 'filled', 'diamond', 'circle'];
export const DASH_STYLES = ['solid', 'dashed', 'dotted'];
// Where a node's label renders: inside the shape (center/top/bottom) or
// outside it, floating above/below — see docs/SPEC.md 4.2.4.
export const TEXT_POSITIONS = ['center', 'top', 'bottom', 'above', 'below'];
// Whether a node's sub-components render as compact truncated chips or as
// a full untruncated list of rows — see docs/SPEC.md 4.2.4.
export const SUBCOMPONENTS_DISPLAY_MODES = ['chips', 'full'];

export function createEmptyProject(name = 'Untitled Diagram') {
  const now = new Date().toISOString();
  return {
    formatVersion: FORMAT_VERSION,
    id: nextId('proj'),
    name,
    createdAt: now,
    updatedAt: now,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    edges: [],
  };
}

export function createNode(def, x, y, overrides = {}) {
  return {
    id: nextId('node'),
    defId: def?.id ?? null,
    x,
    y,
    w: def?.defaultSize?.w ?? 160,
    h: def?.defaultSize?.h ?? 84,
    shape: def?.shape ?? 'rounded',
    fill: def?.fill ?? '#FFFFFF',
    stroke: def?.color ?? '#4F46E5',
    strokeWidth: 2,
    text: def?.name ?? 'Component',
    fontSize: 13,
    textAlign: 'center',
    textPosition: 'center',
    icon: def?.icon ?? '',
    iconVisible: true,
    notes: '',
    labels: [],
    subComponents: (def?.subComponents ?? []).map((sc) => ({ id: nextId('sc'), ...sc })),
    subComponentsDisplay: 'chips',
    rows: def?.shape === 'rows' ? ['Row 1'] : [],
    zIndex: 1,
    ...overrides,
  };
}

export function createEdge(fromNodeId, toNodeId, overrides = {}) {
  return {
    id: nextId('edge'),
    from: fromNodeId,
    to: toNodeId,
    fromSide: 'right',
    toSide: 'left',
    routing: 'orthogonal',
    color: '#334155',
    width: 2,
    dash: 'solid',
    startArrow: 'none',
    endArrow: 'filled',
    label: '',
    ...overrides,
  };
}

export function nextZIndex(project) {
  return project.nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0) + 1;
}

export function removeNode(project, nodeId) {
  project.nodes = project.nodes.filter((n) => n.id !== nodeId);
  project.edges = project.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
}

export function removeEdge(project, edgeId) {
  project.edges = project.edges.filter((e) => e.id !== edgeId);
}

export function touch(project) {
  project.updatedAt = new Date().toISOString();
}

/**
 * Validate an arbitrary parsed-JSON value as a project, returning
 * { ok: true, project } with unknown/invalid fields coerced to safe
 * defaults, or { ok: false, error } if the shape is fundamentally not a
 * project. Never throws.
 */
export function validateProject(input) {
  try {
    if (!input || typeof input !== 'object') return { ok: false, error: 'Not an object' };
    if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
      return { ok: false, error: 'Missing nodes/edges arrays' };
    }
    const nodeIds = new Set();
    const nodes = input.nodes
      .filter((n) => n && typeof n === 'object' && typeof n.id === 'string')
      .map((n) => {
        nodeIds.add(n.id);
        return {
          id: n.id,
          defId: typeof n.defId === 'string' ? n.defId : null,
          x: Number.isFinite(n.x) ? n.x : 0,
          y: Number.isFinite(n.y) ? n.y : 0,
          w: Number.isFinite(n.w) && n.w > 0 ? n.w : 160,
          h: Number.isFinite(n.h) && n.h > 0 ? n.h : 84,
          shape: SHAPES.includes(n.shape) ? n.shape : 'rounded',
          fill: typeof n.fill === 'string' ? n.fill : '#FFFFFF',
          stroke: typeof n.stroke === 'string' ? n.stroke : '#4F46E5',
          strokeWidth: Number.isFinite(n.strokeWidth) ? n.strokeWidth : 2,
          text: typeof n.text === 'string' ? n.text : '',
          fontSize: Number.isFinite(n.fontSize) ? n.fontSize : 13,
          textAlign: ['left', 'center', 'right'].includes(n.textAlign) ? n.textAlign : 'center',
          textPosition: TEXT_POSITIONS.includes(n.textPosition) ? n.textPosition : 'center',
          icon: typeof n.icon === 'string' ? n.icon : '',
          iconVisible: n.iconVisible !== false,
          notes: typeof n.notes === 'string' ? n.notes : '',
          labels: Array.isArray(n.labels) ? n.labels.filter((l) => typeof l === 'string') : [],
          subComponents: Array.isArray(n.subComponents)
            ? n.subComponents
                .filter((sc) => sc && typeof sc.name === 'string')
                .map((sc) => ({ id: typeof sc.id === 'string' ? sc.id : nextId('sc'), name: sc.name, icon: typeof sc.icon === 'string' ? sc.icon : '' }))
            : [],
          subComponentsDisplay: SUBCOMPONENTS_DISPLAY_MODES.includes(n.subComponentsDisplay) ? n.subComponentsDisplay : 'chips',
          rows: Array.isArray(n.rows) ? n.rows.filter((r) => typeof r === 'string') : [],
          zIndex: Number.isFinite(n.zIndex) ? n.zIndex : 1,
        };
      });
    const edges = input.edges
      .filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && nodeIds.has(e.from) && nodeIds.has(e.to))
      .map((e) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        fromSide: ['top', 'right', 'bottom', 'left'].includes(e.fromSide) ? e.fromSide : 'right',
        toSide: ['top', 'right', 'bottom', 'left'].includes(e.toSide) ? e.toSide : 'left',
        routing: ROUTINGS.includes(e.routing) ? e.routing : 'orthogonal',
        color: typeof e.color === 'string' ? e.color : '#334155',
        width: Number.isFinite(e.width) ? e.width : 2,
        dash: DASH_STYLES.includes(e.dash) ? e.dash : 'solid',
        startArrow: ARROW_HEADS.includes(e.startArrow) ? e.startArrow : 'none',
        endArrow: ARROW_HEADS.includes(e.endArrow) ? e.endArrow : 'filled',
        label: typeof e.label === 'string' ? e.label : '',
      }));

    const project = {
      formatVersion: FORMAT_VERSION,
      id: typeof input.id === 'string' ? input.id : nextId('proj'),
      name: typeof input.name === 'string' && input.name.trim() ? input.name : 'Untitled Diagram',
      createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      viewport: {
        x: Number.isFinite(input.viewport?.x) ? input.viewport.x : 0,
        y: Number.isFinite(input.viewport?.y) ? input.viewport.y : 0,
        zoom: Number.isFinite(input.viewport?.zoom) && input.viewport.zoom > 0 ? input.viewport.zoom : 1,
      },
      nodes,
      edges,
    };
    return { ok: true, project };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
