// Pure functions that create/mutate/validate a project object.
// No DOM, no store — trivially unit-testable and reusable by import/export.
import { nextId } from './id.js';

export const FORMAT_VERSION = 1;

export const SHAPES = ['rect', 'rounded', 'circle', 'diamond', 'cylinder', 'hexagon', 'cloud', 'note', 'rows', 'lifeline'];
export const ROUTINGS = ['straight', 'orthogonal', 'curved', 'magic'];
export const ARROW_HEADS = ['none', 'open', 'filled', 'diamond', 'circle'];
export const DASH_STYLES = ['solid', 'dashed', 'dotted'];
// Where an edge's label sits along its own rendered path — see
// canvas/connector.js#labelPointForPosition. 'middle' is the position every
// edge used exclusively before this field existed.
export const EDGE_LABEL_POSITIONS = ['start', 'middle', 'end'];
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
// UML "combined fragment" operator a labeled box represents — see
// docs/SPEC.md "Sequence diagrams" and canvas/node.js's pentagon tag
// rendering. Deliberately just one condition per box (no alt/else divider
// line) — see data/categories/sequence-templates.js's fragment shapes.
export const FRAGMENT_TYPES = ['alt', 'opt', 'loop', 'par', 'critical', 'break', 'ref'];
// How a Diagram Animation step reveals during playback — see
// core/animationPlayback.js and docs/ARCHITECTURE.md's "Diagram Animation"
// section. 'auto' fires on its own after `delayMs`; 'click' waits for the
// presenter to advance manually (mouse click or a keyboard shortcut).
export const ANIMATION_REVEAL_MODES = ['auto', 'click'];

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
    // Named snapshots of this project's own content (nodes/edges/
    // replicationPairs) the user has explicitly captured — see
    // canvas.js#saveDiagramVersion/#revertToVersion and
    // docs/ARCHITECTURE.md's "Diagram Versions" section. Deliberately part
    // of the project itself (not a separate localStorage silo) so it
    // travels with JSON export/import and full backups like everything
    // else here.
    versions: [],
    // An ordered subset of `versions` (by id) assembled into a slideshow —
    // see canvas.js#buildPresentation and the "Presentations" section.
    presentations: [],
    // Figma-style pinned annotations — a free-floating note at a canvas
    // point, not attached to any node (see canvas/commentPins.js and
    // core/project.js#createComment). Part of the project itself, same
    // "travels with export/import/backup" reasoning as `versions` above.
    comments: [],
    // Diagram Animation — an ordered "build" sequence of nodes/edges to
    // progressively reveal during playback (see canvas.js#startAnimationPlayback
    // and docs/ARCHITECTURE.md's "Diagram Animation" section). Order is just
    // the array position (no separate order field to keep in sync); an item
    // never added here is always visible, animated or not.
    animationSteps: [],
  };
}

export function createAnimationStep(targetType, targetId, overrides = {}) {
  return {
    id: nextId('anim'),
    targetType,
    targetId,
    revealMode: 'click',
    delayMs: 2000,
    ...overrides,
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
    // A user-uploaded image/SVG data URL that replaces the emoji `icon`
    // when set (see canvas/node.js#buildIconEl) — null means "use the
    // emoji icon", not merely "no icon" (iconVisible already covers that).
    iconImage: null,
    notes: '',
    labels: [],
    // Estimated cost in US dollars/month, shown as a small badge on the
    // node face and rolled into the toolbar's running total (see
    // core/cost.js) — null means "no estimate entered", distinct from an
    // explicit $0 (e.g. a free-tier service someone still wants to track).
    monthlyCost: null,
    subComponents: (def?.subComponents ?? []).map((sc) => ({ id: nextId('sc'), ...sc })),
    subComponentsDisplay: 'chips',
    rows: def?.shape === 'rows' ? ['Row 1'] : [],
    zIndex: 1,
    groupId: null,
    // Opts this node out of core/replication.js's live mirroring, even while
    // its groupId belongs to an active replication pair's side — see
    // docs/SPEC.md "Live Replication".
    replicationExcluded: false,
    // UML "destroy" marker (lifeline shape only): fraction 0..1 down the
    // lifeline's own dashed line where it terminates (an X mark), or null
    // for a lifeline that's never destroyed (every non-lifeline node also
    // leaves this null — harmless, unused). See
    // canvas.js#setLifelineDestroyOffset for how a right-click sets it.
    destroyOffset: null,
    // UML "activation bar" execution occurrences (lifeline shape only): each
    // {id, startOffset, endOffset} is a 0..1 span down the lifeline where
    // that participant is "busy". See canvas.js#addActivationBar and
    // nodeInteractions.js's drag-to-move/-resize handling.
    activations: [],
    // UML combined-fragment operator (alt/opt/loop/par/ref) or null for an
    // ordinary node — see FRAGMENT_TYPES above. Structural like
    // textPosition/iconVisible below: a def carrying its own fragmentType
    // (the four Fragment shapes in sequence-templates.js) always wins over
    // `overrides`.
    fragmentType: null,
    ...overrides,
    // A def's own textPosition/iconVisible (data/schema.js#c) describes
    // something structural about that specific shape (e.g. a container/
    // frame box wanting its caption at the top, not centered over whatever
    // gets placed inside it) — so it deliberately wins over `overrides`
    // (which carries the user's *global* new-component defaults, see
    // io/nodeDefaults.js#buildCreationOverrides), the same way
    // shape/fill/stroke above already always come from `def` rather than
    // being overridable at creation time. Most components don't set
    // either, so this is a no-op for them and the global default (or a
    // later per-node override) decides as before.
    ...(def?.textPosition ? { textPosition: def.textPosition } : {}),
    ...(def?.iconVisible === false ? { iconVisible: false } : {}),
    ...(def?.fragmentType ? { fragmentType: def.fragmentType } : {}),
  };
}

export function createEdge(fromNodeId, toNodeId, overrides = {}) {
  return {
    id: nextId('edge'),
    from: fromNodeId,
    to: toNodeId,
    fromSide: 'right',
    toSide: 'left',
    // Fraction (0..1) along the anchored side — 0.5 is the midpoint every
    // edge used exclusively before this field existed, so it's a safe
    // default for any diagram that never sets it. A non-default value lets
    // several edges land on the same tall node at different heights instead
    // of stacking on one point — see core/geometry.js#sideAnchor, and
    // canvas/connectorInteractions.js for where a real drag computes one.
    fromOffset: 0.5,
    toOffset: 0.5,
    routing: 'orthogonal',
    color: '#334155',
    width: 2,
    dash: 'solid',
    startArrow: 'none',
    endArrow: 'filled',
    label: '',
    labelPosition: 'middle',
    notes: '',
    // A lifeline-to-lifeline message's displayed badge number is normally
    // purely derived from vertical position (canvas.js#computeMessageSequenceNumbers)
    // — never persisted, so it can't go stale. This is the one deliberate
    // exception: a user-set override the badge shows instead, for the rare
    // case the auto-computed order doesn't match intent. Irrelevant for any
    // other edge (only read when both endpoints are lifelines).
    sequenceNumberOverride: null,
    // User-dragged bend points (canvas-space {x,y}, in order from `from` to
    // `to`) that override every automatic routing algorithm — see
    // canvas/connector.js#buildEdgePath and canvas/waypointHandles.js. Empty
    // means "let routing/fromSide/toSide decide", same as every edge before
    // this field existed. Absolute, not relative to either endpoint — a
    // node moving away just re-routes straight to/from wherever the
    // waypoints already are, the same "manual override, not automatically
    // re-derived" contract fromOffset/toOffset already set for anchoring.
    waypoints: [],
    ...overrides,
  };
}

/** A Figma-style pinned annotation: a free-floating note at a canvas point
 * (`x`,`y`), independent of any node — see canvas/commentPins.js. */
export function createComment(x, y, text = '') {
  return {
    id: nextId('comment'),
    x,
    y,
    text,
    resolved: false,
    createdAt: new Date().toISOString(),
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
  const edgeIdMap = new Map();
  const edges = project.edges
    .filter((e) => nodeIdMap.has(e.from) && nodeIdMap.has(e.to))
    .map((e) => {
      const newId = nextId('edge');
      edgeIdMap.set(e.id, newId);
      return { ...e, id: newId, from: nodeIdMap.get(e.from), to: nodeIdMap.get(e.to) };
    });
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
      edgeMembers: (pair.edgeMembers || [])
        .filter((m) => edgeIdMap.has(m.a) && edgeIdMap.has(m.b))
        .map((m) => ({ a: edgeIdMap.get(m.a), b: edgeIdMap.get(m.b) })),
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
    // A copy's version history/presentations describe the *original*
    // project's own editing timeline — carrying them over into an
    // independent copy (whose future edits are unrelated) would be
    // misleading, so it starts with a clean slate, same as a fresh id.
    versions: [],
    presentations: [],
    // Comments are diagram content (like nodes/edges), not editing history,
    // so — unlike versions/presentations above — they do carry over; only
    // their ids are regenerated, same "never shares identity" contract.
    comments: (project.comments || []).map((c) => ({ ...c, id: nextId('comment') })),
    // Same reasoning as comments: the animation sequence is content, not
    // history, so it carries over — remapped onto the copy's own fresh
    // node/edge ids, dropping any step whose target didn't survive the
    // copy (filtered out above, e.g. an edge whose node no longer exists).
    animationSteps: (project.animationSteps || [])
      .filter((s) => (s.targetType === 'node' ? nodeIdMap.has(s.targetId) : edgeIdMap.has(s.targetId)))
      .map((s) => ({
        ...s,
        id: nextId('anim'),
        targetId: s.targetType === 'node' ? nodeIdMap.get(s.targetId) : edgeIdMap.get(s.targetId),
      })),
  };
}

/** Captures the project's current nodes/edges/replicationPairs as a new
 * named, timestamped entry to append to `project.versions` — pure (doesn't
 * mutate `project` or push into its array itself; see
 * canvas.js#saveDiagramVersion for the dispatch that does). Deep-cloned so
 * later edits to the live project can never retroactively alter a captured
 * version. */
export function createVersionSnapshot(project, name) {
  const ordinal = (project.versions?.length || 0) + 1;
  return {
    id: nextId('ver'),
    name: (name || '').trim() || `Version ${ordinal}`,
    createdAt: new Date().toISOString(),
    snapshot: {
      nodes: structuredClone(project.nodes),
      edges: structuredClone(project.edges),
      replicationPairs: structuredClone(project.replicationPairs || []),
    },
  };
}

/** Deletes a version and cascades to strip it from any presentation slide
 * that referenced it — same "don't leave a dangling reference behind"
 * principle removeNode/removeEdge already follow for their own cascades. */
export function removeVersion(project, versionId) {
  project.versions = project.versions.filter((v) => v.id !== versionId);
  project.presentations = (project.presentations || []).map((p) => ({
    ...p,
    slides: p.slides.filter((s) => s.versionId !== versionId),
  }));
}

export function nextZIndex(project) {
  return project.nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0) + 1;
}

export function removeNode(project, nodeId) {
  const removedEdgeIds = new Set(project.edges.filter((e) => e.from === nodeId || e.to === nodeId).map((e) => e.id));
  project.nodes = project.nodes.filter((n) => n.id !== nodeId);
  project.edges = project.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
  project.animationSteps = (project.animationSteps || []).filter((s) => !(
    (s.targetType === 'node' && s.targetId === nodeId) || (s.targetType === 'edge' && removedEdgeIds.has(s.targetId))
  ));
}

export function removeEdge(project, edgeId) {
  project.edges = project.edges.filter((e) => e.id !== edgeId);
  project.animationSteps = (project.animationSteps || []).filter((s) => !(s.targetType === 'edge' && s.targetId === edgeId));
}

export function touch(project) {
  project.updatedAt = new Date().toISOString();
}

/** Validates one node/edge/replicationPairs "content" triple — shared by
 * the top-level project itself and by every stored version's own snapshot
 * (see `versions` below), so a version snapshot backfills a missing id or
 * clamps an out-of-range offset exactly the same way a freshly-imported
 * project does. Never throws (same contract as validateProject). */
function validateContent(rawNodes, rawEdges, rawReplicationPairs) {
  const nodeIds = new Set();
  const nodes = (Array.isArray(rawNodes) ? rawNodes : [])
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
        iconImage: typeof n.iconImage === 'string' && /^data:image\//.test(n.iconImage) && n.iconImage.length <= 700000 ? n.iconImage : null,
        notes: typeof n.notes === 'string' ? n.notes : '',
        labels: Array.isArray(n.labels) ? n.labels.filter((l) => typeof l === 'string') : [],
        monthlyCost: Number.isFinite(n.monthlyCost) && n.monthlyCost >= 0 ? n.monthlyCost : null,
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
        destroyOffset: Number.isFinite(n.destroyOffset) ? Math.min(1, Math.max(0, n.destroyOffset)) : null,
        activations: Array.isArray(n.activations)
          ? n.activations
              .filter((a) => a && Number.isFinite(a.startOffset) && Number.isFinite(a.endOffset))
              .map((a) => {
                const s = Math.min(1, Math.max(0, a.startOffset));
                const eo = Math.min(1, Math.max(0, a.endOffset));
                return { id: typeof a.id === 'string' ? a.id : nextId('act'), startOffset: Math.min(s, eo), endOffset: Math.max(s, eo) };
              })
          : [],
        fragmentType: FRAGMENT_TYPES.includes(n.fragmentType) ? n.fragmentType : null,
      };
    });
  const edgeIds = new Set();
  const edges = (Array.isArray(rawEdges) ? rawEdges : [])
    .filter((e) => e && typeof e === 'object' && nodeIds.has(e.from) && nodeIds.has(e.to))
    .map((e) => {
      const id = typeof e.id === 'string' && e.id ? e.id : nextId('edge');
      edgeIds.add(id);
      return {
        id,
        from: e.from,
        to: e.to,
        fromSide: ['top', 'right', 'bottom', 'left'].includes(e.fromSide) ? e.fromSide : 'right',
        toSide: ['top', 'right', 'bottom', 'left'].includes(e.toSide) ? e.toSide : 'left',
        fromOffset: Number.isFinite(e.fromOffset) ? Math.min(1, Math.max(0, e.fromOffset)) : 0.5,
        toOffset: Number.isFinite(e.toOffset) ? Math.min(1, Math.max(0, e.toOffset)) : 0.5,
        routing: ROUTINGS.includes(e.routing) ? e.routing : 'orthogonal',
        color: typeof e.color === 'string' ? e.color : '#334155',
        width: Number.isFinite(e.width) ? e.width : 2,
        dash: DASH_STYLES.includes(e.dash) ? e.dash : 'solid',
        startArrow: ARROW_HEADS.includes(e.startArrow) ? e.startArrow : 'none',
        endArrow: ARROW_HEADS.includes(e.endArrow) ? e.endArrow : 'filled',
        label: typeof e.label === 'string' ? e.label : '',
        labelPosition: EDGE_LABEL_POSITIONS.includes(e.labelPosition) ? e.labelPosition : 'middle',
        notes: typeof e.notes === 'string' ? e.notes : '',
        sequenceNumberOverride: Number.isInteger(e.sequenceNumberOverride) && e.sequenceNumberOverride >= 1 ? e.sequenceNumberOverride : null,
        waypoints: Array.isArray(e.waypoints)
          ? e.waypoints.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)).map((p) => ({ x: p.x, y: p.y }))
          : [],
      };
    });

  const replicationPairs = Array.isArray(rawReplicationPairs)
    ? rawReplicationPairs
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
          edgeMembers: Array.isArray(p.edgeMembers)
            ? p.edgeMembers
                .filter((m) => m && typeof m.a === 'string' && edgeIds.has(m.a) && typeof m.b === 'string' && edgeIds.has(m.b))
                .map((m) => ({ a: m.a, b: m.b }))
            : [],
          frozen: p.frozen === true,
        }))
    : [];

  return { nodes, edges, replicationPairs };
}

/** Validates `project.versions` — each entry's own `snapshot` goes through
 * the exact same `validateContent` as the top-level project, so a stored
 * version backfills a missing id / clamps an offset the same way an
 * imported project does, and a version saved by an older/newer app build
 * never crashes a later validate/revert. An entry with no usable
 * `snapshot` object at all is dropped rather than kept as a broken one. */
function validateVersions(rawVersions) {
  if (!Array.isArray(rawVersions)) return [];
  return rawVersions
    .filter((v) => v && typeof v === 'object' && v.snapshot && typeof v.snapshot === 'object')
    .map((v) => ({
      id: typeof v.id === 'string' && v.id ? v.id : nextId('ver'),
      name: typeof v.name === 'string' && v.name.trim() ? v.name : 'Version',
      createdAt: typeof v.createdAt === 'string' ? v.createdAt : new Date().toISOString(),
      snapshot: validateContent(v.snapshot.nodes, v.snapshot.edges, v.snapshot.replicationPairs),
    }));
}

/** Validates `project.comments` — same never-throws, backfill-don't-drop
 * contract as every other validate* helper here. A comment missing/invalid
 * `x`/`y` is dropped outright (a pin with no real position means nothing),
 * everything else gets a sane default. */
function validateComments(rawComments) {
  if (!Array.isArray(rawComments)) return [];
  return rawComments
    .filter((c) => c && typeof c === 'object' && Number.isFinite(c.x) && Number.isFinite(c.y))
    .map((c) => ({
      id: typeof c.id === 'string' && c.id ? c.id : nextId('comment'),
      x: c.x,
      y: c.y,
      text: typeof c.text === 'string' ? c.text : '',
      resolved: c.resolved === true,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
    }));
}

/** Validates `project.presentations` — each slide's `versionId` must
 * resolve against the already-validated `versions` list (a slide pointing
 * at a version that doesn't exist, e.g. because that version was deleted
 * by an older app build that didn't cascade the deletion, is dropped
 * rather than kept as a dangling reference). */
function validatePresentations(rawPresentations, versions) {
  if (!Array.isArray(rawPresentations)) return [];
  const versionIds = new Set(versions.map((v) => v.id));
  return rawPresentations
    .filter((p) => p && typeof p === 'object')
    .map((p) => ({
      id: typeof p.id === 'string' && p.id ? p.id : nextId('pres'),
      name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Presentation',
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
      slides: Array.isArray(p.slides)
        ? p.slides
            .filter((s) => s && typeof s === 'object' && typeof s.versionId === 'string' && versionIds.has(s.versionId))
            .map((s) => ({
              versionId: s.versionId,
              title: typeof s.title === 'string' ? s.title : '',
              notes: typeof s.notes === 'string' ? s.notes : '',
            }))
        : [],
    }));
}

/** Validates `project.animationSteps` — a step whose target node/edge
 * doesn't exist (deleted by an older build that didn't cascade the removal,
 * or an imported animation file applied to the wrong diagram — see
 * io/exportAnimation.js) is dropped rather than kept as a dangling
 * reference, same "never a broken reference" contract as
 * validatePresentations above. */
function validateAnimationSteps(rawSteps, nodeIds, edgeIds) {
  if (!Array.isArray(rawSteps)) return [];
  return rawSteps
    .filter((s) => s && typeof s === 'object' && (s.targetType === 'node' || s.targetType === 'edge') && typeof s.targetId === 'string')
    .filter((s) => (s.targetType === 'node' ? nodeIds.has(s.targetId) : edgeIds.has(s.targetId)))
    .map((s) => ({
      id: typeof s.id === 'string' && s.id ? s.id : nextId('anim'),
      targetType: s.targetType,
      targetId: s.targetId,
      revealMode: ANIMATION_REVEAL_MODES.includes(s.revealMode) ? s.revealMode : 'click',
      delayMs: Number.isFinite(s.delayMs) && s.delayMs > 0 ? s.delayMs : 2000,
    }));
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
    const { nodes, edges, replicationPairs } = validateContent(input.nodes, input.edges, input.replicationPairs);
    const versions = validateVersions(input.versions);
    const presentations = validatePresentations(input.presentations, versions);
    const comments = validateComments(input.comments);
    const animationSteps = validateAnimationSteps(input.animationSteps, new Set(nodes.map((n) => n.id)), new Set(edges.map((e) => e.id)));

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
      versions,
      presentations,
      comments,
      animationSteps,
    };
    return { ok: true, project };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
