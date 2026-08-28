// Demo Projects — ready-made example diagrams covering the app's different
// diagram "kinds" (a plain system diagram, a sequence diagram, BPMN, UML
// Deployment, an ER diagram, a State Machine, a C4 Context diagram) plus one
// combo demo showing two kinds coexisting on the same canvas — see
// modals/demoProjectsModal.js for the picker UI and
// canvas/canvas.js#loadDemoProject for how a demo actually replaces the
// live canvas (same "load a whole new project" flow as Generate Design/AI
// Quick Start: build a plain project-shaped object, validateProject() it,
// then store.loadProject() it in one step — see that function's own
// comment for why undo can't reach across this boundary, same as New/Load).
//
// Deliberately reuses the exact same building blocks a human already uses
// interactively — an existing pattern's own `nodes`/`edges` blueprint
// (`data/categories/*.js#definePattern`), `core/sequenceDiagram.js#layoutLifelines`,
// `core/c4Context.js#layoutC4Context` — rather than hand-placing every demo
// node's x/y, so a demo can't visually drift out of sync with what
// `canvas.js#instantiatePatternAtPoint`/`createSequenceDiagram`/
// `createC4ContextDiagram` build when a *user* does the same thing.
import { getComponentById } from '../data/index.js';
import { createNode, createEdge, createEmptyProject } from './project.js';
import { nextId } from './id.js';
import { layoutLifelines } from './sequenceDiagram.js';
import { layoutC4Context } from './c4Context.js';

/** Same recipe as canvas.js#instantiatePatternAtPoint's node/edge mapping,
 * duplicated here as a pure function (no store/viewport) since a demo
 * project is built entirely before anything is loaded. Kept in sync by
 * being this simple — if that recipe ever changes, this one-screen
 * function is the only other place to update (see docs/AI_AGENT_GUIDE.md's
 * Demo Projects entry). */
function buildPatternPieces(patternId, anchorX, anchorY, zStart) {
  const patternDef = getComponentById(patternId);
  if (!patternDef?.pattern) return { nodes: [], edges: [], zNext: zStart };
  let z = zStart;
  const idByKey = new Map();
  const nodes = patternDef.pattern.nodes.map((spec) => {
    const def = getComponentById(spec.defId);
    const w = spec.overrides?.w ?? def?.defaultSize.w ?? 160;
    const h = spec.overrides?.h ?? def?.defaultSize.h ?? 84;
    const node = createNode(def, anchorX + spec.dx - w / 2, anchorY + spec.dy - h / 2, {
      zIndex: z++,
      text: spec.label || def?.name || spec.key,
      ...(spec.overrides || {}),
    });
    idByKey.set(spec.key, node.id);
    return node;
  });
  if (patternDef.groupOnInstantiate && nodes.length > 1) {
    const groupId = nextId('group');
    for (const n of nodes) n.groupId = groupId;
  }
  const edges = (patternDef.pattern.edges || [])
    .filter((e) => idByKey.has(e.from) && idByKey.has(e.to))
    .map((e) => createEdge(idByKey.get(e.from), idByKey.get(e.to), e.overrides || {
      label: e.label || '',
      routing: e.routing || 'orthogonal',
      dash: e.dash || 'solid',
      startArrow: e.startArrow || 'none',
      endArrow: e.endArrow || 'filled',
    }));
  return { nodes, edges, zNext: z };
}

function buildLifelinePieces(names, anchorX, anchorY, zStart) {
  const def = getComponentById('shape-lifeline');
  if (!def) return { nodes: [], zNext: zStart };
  let z = zStart;
  const layout = layoutLifelines(names, anchorX, anchorY, def.defaultSize);
  const nodes = layout.map((spec) => createNode(def, spec.x, spec.y, { zIndex: z++, text: spec.text }));
  return { nodes, zNext: z };
}

function manualChain(specs, zStart) {
  // specs: [{defId, x, y, text}] placed in order, connected 0->1->2->...
  let z = zStart;
  const nodes = specs.map((s) => createNode(getComponentById(s.defId), s.x, s.y, { zIndex: z++, text: s.text }));
  const edges = nodes.slice(1).map((n, i) => createEdge(nodes[i].id, n.id, {}));
  return { nodes, edges, zNext: z };
}

export const DEMO_PROJECTS = [
  {
    id: 'demo-basic-web-app',
    name: 'Demo: Basic Web App',
    icon: '🌐',
    description: 'A classic layered system diagram — client, API layer, business logic, and a database.',
    build() {
      const { nodes, edges } = buildPatternPieces('pattern-layered', 500, 320, 1);
      return { nodes, edges };
    },
  },
  {
    id: 'demo-microservices-ha',
    name: 'Demo: Highly-Available Microservices',
    icon: '🏢',
    description: 'A multi-AZ, load-balanced deployment showing Live Replication in action.',
    build() {
      const { nodes, edges } = buildPatternPieces('pattern-multi-az', 500, 320, 1);
      return { nodes, edges };
    },
  },
  {
    id: 'demo-sequence-login',
    name: 'Demo: Sequence Diagram (Login Flow)',
    icon: '🔀',
    description: 'A UML sequence diagram — lifelines and time-ordered messages for a login handshake.',
    build() {
      const { nodes, edges } = buildPatternPieces('seq-login-flow', 500, 320, 1);
      return { nodes, edges };
    },
  },
  {
    id: 'demo-bpmn-approval',
    name: 'Demo: BPMN Approval Process',
    icon: '📋',
    description: 'A BPMN business-process diagram — start/end events, tasks, and a gateway.',
    build() {
      const { nodes, edges } = buildPatternPieces('bpmn-approval-process', 500, 320, 1);
      return { nodes, edges };
    },
  },
  {
    id: 'demo-uml-deployment',
    name: 'Demo: UML Deployment Diagram',
    icon: '🧊',
    description: 'A physical device hosting an execution environment, running a deployable artifact.',
    build() {
      const { nodes, edges } = manualChain([
        { defId: 'uml-device', x: 260, y: 300, text: 'Production Server' },
        { defId: 'uml-execution-environment', x: 560, y: 300, text: 'Docker Runtime' },
        { defId: 'uml-artifact', x: 860, y: 310, text: 'app.jar' },
      ], 1);
      return { nodes, edges };
    },
  },
  {
    id: 'demo-er-diagram',
    name: 'Demo: ER Diagram (Blog)',
    icon: '🗄️',
    description: 'An entity-relationship diagram — a one-to-many relationship between two tables.',
    build() {
      const { nodes, edges } = buildPatternPieces('pattern-er-one-to-many', 500, 320, 1);
      return { nodes, edges };
    },
  },
  {
    id: 'demo-state-machine',
    name: 'Demo: State Machine (Traffic Light)',
    icon: '🚦',
    description: 'A finite-state machine — states and the transitions between them.',
    build() {
      const { nodes, edges } = buildPatternPieces('pattern-sm-traffic-light', 500, 320, 1);
      return { nodes, edges };
    },
  },
  {
    id: 'demo-c4-context',
    name: 'Demo: C4 Context Diagram',
    icon: '🧩',
    description: 'A C4 Model System Context diagram — a central system, its users, and an external dependency.',
    build() {
      const systemDef = getComponentById('c4-system');
      const personDef = getComponentById('c4-person');
      const externalDef = getComponentById('c4-system-external');
      const layout = layoutC4Context('Order System', ['Customer'], ['Payment Provider'], 500, 320, systemDef.defaultSize);
      let z = 1;
      const systemNode = createNode(systemDef, layout.system.x, layout.system.y, { zIndex: z++, text: layout.system.text });
      const peopleNodes = layout.people.map((p) => createNode(personDef, p.x, p.y, { zIndex: z++, text: p.text }));
      const externalNodes = layout.externalSystems.map((s) => createNode(externalDef, s.x, s.y, { zIndex: z++, text: s.text }));
      const edges = [
        ...peopleNodes.map((n) => createEdge(n.id, systemNode.id, {})),
        ...externalNodes.map((n) => createEdge(systemNode.id, n.id, {})),
      ];
      return { nodes: [systemNode, ...peopleNodes, ...externalNodes], edges };
    },
  },
  {
    id: 'demo-combo-system-and-sequence',
    name: 'Demo: Combo — System Diagram + Embedded Sequence Diagram',
    icon: '🔗',
    description: 'Shows two diagram kinds together on one canvas: a regular system diagram, plus a sequence diagram detailing one of its request flows.',
    build() {
      const system = buildPatternPieces('pattern-api-gateway', 380, 280, 1);
      const sequence = buildLifelinePieces(['Client', 'API Gateway', 'Service', 'DB'], 1050, 320, system.zNext);
      return { nodes: [...system.nodes, ...sequence.nodes], edges: system.edges };
    },
  },
];

export function getDemoProjectById(id) {
  return DEMO_PROJECTS.find((d) => d.id === id) || null;
}

/** Builds a full, `validateProject`-ready project object for the given
 * demo — pure, DOM-free, unit-testable. `canvas.js#loadDemoProject` is the
 * only thing that actually calls `store.loadProject()` with the result.
 * "Clearing" a loaded demo needs no special tracking of its own — it's
 * just the existing `canvas.js#clearCanvas()`, offered right in the same
 * modal for convenience (see modals/demoProjectsModal.js). */
export function buildDemoProject(demoId) {
  const demo = getDemoProjectById(demoId);
  if (!demo) return null;
  const { nodes, edges } = demo.build();
  return { ...createEmptyProject(demo.name), nodes, edges };
}
