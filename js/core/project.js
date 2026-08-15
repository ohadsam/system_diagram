// Pure functions that create/mutate/validate a project object.
// No DOM, no store — trivially unit-testable and reusable by import/export.
import { nextId } from './id.js';

export const FORMAT_VERSION = 1;

export const SHAPES = ['rect', 'rounded', 'circle', 'diamond', 'cylinder', 'hexagon', 'cloud', 'note', 'rows'];
export const ROUTINGS = ['straight', 'orthogonal', 'curved', 'magic'];
export const ARROW_HEADS = ['none', 'open', 'filled', 'diamond', 'circle'];
export const DASH_STYLES = ['solid', 'dashed', 'dotted'];
// Where a node's label renders: inside the shape (center/top/bottom) or
// outside it, floating above/below — see docs/SPEC.md 4.2.5.
export const TEXT_POSITIONS = ['center', 'top', 'bottom', 'above', 'below'];
// Whether a node's sub-components render as compact truncated chips or as
// a full untruncated list of rows — see docs/SPEC.md 4.2.5.
export const SUBCOMPONENTS_DISPLAY_MODES = ['chips', 'full'];
// Purely a descriptive label on a replication pair — every mode uses the
// exact same live-mirroring engine (core/replication.js); see docs/SPEC.md
// "Live Replication" for why one mechanism covers all of them.
export const REPLICATION_MODES = ['active-active', 'active-passive', 'primary-replica'];

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
    replicationPairs: [],
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
    groupId: null,
    // Opts this node out of core/replication.js's live mirroring, even while
    // its groupId belongs to an active replication pair's side — see
    // docs/SPEC.md "Live Replication".
    replicationExcluded: false,
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

/**
 * Clones a whole project as an independent copy: fresh project id and
 * timestamps, "(Copy)" appended to the name, and every node/edge/
 * sub-component/group id regenerated (so the copy never shares identity
 * with the original — safe to have both around, e.g. in the saved-projects
 * list, without id collisions). Pure — the caller decides what to do with
 * the result (load it as the active canvas, save it, etc).
 */
export function duplicateProject(project) {
  const nodeIdMap = new Map();
  const groupIdMap = new Map();
  const nodes = project.nodes.map((n) => {
    const newId = nextId('node');
    nodeIdMap.set(n.id, newId);
    let newGroupId = null;
    if (n.groupId) {
      if (!groupIdMap.has(n.groupId)) groupIdMap.set(n.groupId, nextId('group'));
      newGroupId = groupIdMap.get(n.groupId);
    }
    return {
      ...n,
      id: newId,
      groupId: newGroupId,
      subComponents: (n.subComponents || []).map((sc) => ({ ...sc, id: nextId('sc') })),
    };
  });
  const edges = project.edges
    .filter((e) => nodeIdMap.has(e.from) && nodeIdMap.has(e.to))
    .map((e) => ({ ...e, id: nextId('edge'), from: nodeIdMap.get(e.from), to: nodeIdMap.get(e.to) }));
  // A pair only survives the copy if both of its groups still have at least
  // one member among the duplicated nodes (i.e. groupIdMap actually has an
  // entry for them) — an orphaned pair (every member since deleted) carries
  // no useful state and would just reference groups that no longer exist.
  const replicationPairs = (project.replicationPairs || [])
    .filter((pair) => groupIdMap.has(pair.groupA) && groupIdMap.has(pair.groupB))
    .map((pair) => ({
      ...pair,
      id: nextId('repl'),
      groupA: groupIdMap.get(pair.groupA),
      groupB: groupIdMap.get(pair.groupB),
      members: pair.members
        .filter((m) => nodeIdMap.has(m.a) && nodeIdMap.has(m.b))
        .map((m) => ({ a: nodeIdMap.get(m.a), b: nodeIdMap.get(m.b) })),
    }));
  const now = new Date().toISOString();
  return {
    ...project,
    id: nextId('proj'),
    name: `${project.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    replicationPairs,
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
      .filter((n) => n && typeof n === 'object')
      .map((n) => {
        // A missing/invalid id gets a fresh one rather than dropping the
        // node — imports we don't fully control the shape of (a pasted AI
        // response, hand-edited JSON) are far more likely to omit an id
        // than to be otherwise malformed, and silently losing a component
        // is worse than assigning it an id.
        const id = typeof n.id === 'string' && n.id ? n.id : nextId('node');
        nodeIds.add(id);
        return {
          id,
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
          groupId: typeof n.groupId === 'string' ? n.groupId : null,
          replicationExcluded: n.replicationExcluded === true,
        };
      });
    const edges = input.edges
      .filter((e) => e && typeof e === 'object' && nodeIds.has(e.from) && nodeIds.has(e.to))
      .map((e) => ({
        id: typeof e.id === 'string' && e.id ? e.id : nextId('edge'),
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

    const replicationPairs = Array.isArray(input.replicationPairs)
      ? input.replicationPairs
          .filter((p) => p && typeof p === 'object' && typeof p.groupA === 'string' && p.groupA && typeof p.groupB === 'string' && p.groupB && p.groupA !== p.groupB)
          .map((p) => ({
            id: typeof p.id === 'string' && p.id ? p.id : nextId('repl'),
            mode: REPLICATION_MODES.includes(p.mode) ? p.mode : 'active-active',
            groupA: p.groupA,
            groupB: p.groupB,
            offsetX: Number.isFinite(p.offsetX) ? p.offsetX : 0,
            offsetY: Number.isFinite(p.offsetY) ? p.offsetY : 0,
            members: Array.isArray(p.members)
              ? p.members
                  .filter((m) => m && typeof m.a === 'string' && nodeIds.has(m.a) && typeof m.b === 'string' && nodeIds.has(m.b))
                  .map((m) => ({ a: m.a, b: m.b }))
              : [],
          }))
      : [];

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
      replicationPairs,
    };
    return { ok: true, project };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
