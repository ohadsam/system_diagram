import { c } from '../schema.js';

// UML Deployment Diagram — models physical/virtual infrastructure (a
// "node" in UML's own sense — unrelated to this app's own "node" meaning
// any placed component) and the software artifacts running on it. The
// deployment "node" gets its own `shape: 'cuboid'` (see css/node.css) for
// the classic pseudo-3D box UML uses; a "Communication Path" between two
// devices/environments is just a plain edge — no special component needed
// for it, style it (usually just a plain labeled line) like any connector.
export const category = { id: 'uml-deployment', label: 'UML Deployment', color: '#0E7490' };

const UD = '#0E7490';

export const components = [
  c('uml-device', 'Device', '🖥️', { shape: 'cuboid', color: UD, defaultSize: { w: 190, h: 130 }, description: 'A physical piece of hardware — a server, workstation, or IoT device — that something else runs on.', tags: ['uml', 'deployment'], related: ['uml-execution-environment'] }),
  c('uml-execution-environment', 'Execution Environment', '📦', { shape: 'cuboid', color: '#0369A1', defaultSize: { w: 190, h: 130 }, description: 'A virtual host running inside a Device — an OS, a container runtime, a VM, or an application server.', tags: ['uml', 'deployment'], related: ['uml-artifact'] }),
  c('uml-artifact', 'Artifact', '📄', { shape: 'note', color: '#155E75', defaultSize: { w: 150, h: 90 }, description: 'A concrete deployable file — a JAR, a binary, a config file — placed inside an Execution Environment.', tags: ['uml', 'deployment'] }),
];
