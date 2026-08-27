// Best-effort Kubernetes manifest export — a sibling of
// io/exportTerraform.js/exportPulumi.js/exportCloudFormation.js, but
// deliberately narrower in scope: unlike a cloud provider (where every
// component maps fairly unambiguously to one resource type), a box on this
// canvas labeled e.g. "Order Service" could reasonably become a Deployment,
// a StatefulSet, a CronJob, or nothing at all — guessing wrong would be
// worse than not guessing. So this only maps the one component that's
// explicitly a Kubernetes workload unit already (`ctr-pod`, "Pod" in the
// Containers & Orchestration category) to a Deployment + Service pair;
// every other Containers & Orchestration component (Docker, Helm, Istio,
// the Kubernetes cluster icon itself, ...) is listed in a trailing comment
// instead, exactly like an unmapped AWS component in the other exporters.
// Pure, DOM-free.
const K8S_WORKLOAD_DEF_ID = 'ctr-pod';
const OTHER_K8S_DEF_IDS = new Set([
  'ctr-docker', 'ctr-docker-compose', 'ctr-envoy', 'ctr-helm', 'ctr-istio',
  'ctr-k3s', 'ctr-kubernetes', 'ctr-nomad', 'ctr-openshift', 'ctr-podman', 'ctr-rancher',
]);

function toK8sName(text, fallback) {
  const cleaned = (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || fallback;
}

/**
 * @param {object[]} nodes
 * @returns {string} a multi-document .yaml skeleton — real syntax, placeholder values
 */
export function buildKubernetesManifests(nodes) {
  const workloads = nodes.filter((n) => n.defId === K8S_WORKLOAD_DEF_ID);
  const otherRecognized = nodes.filter((n) => OTHER_K8S_DEF_IDS.has(n.defId));

  const lines = [
    '# Auto-generated from a System Design Diagram Builder diagram.',
    '# Best-effort skeleton only — fill in the container image and ports before `kubectl apply`.',
  ];

  if (!workloads.length) {
    lines.push('#');
    lines.push('# No "Pod" components (Containers & Orchestration category) found on this');
    lines.push('# diagram — that\'s the only component this exporter turns into a manifest,');
    lines.push('# since guessing a workload type from a generic labeled box would likely be wrong.');
  }

  const usedNames = new Set();
  for (const node of workloads) {
    let name = toK8sName(node.text, node.id);
    let unique = name;
    for (let i = 2; usedNames.has(unique); i++) unique = `${name}-${i}`;
    usedNames.add(unique);

    lines.push('---');
    lines.push('apiVersion: apps/v1');
    lines.push('kind: Deployment');
    lines.push('metadata:');
    lines.push(`  name: ${unique}`);
    lines.push('spec:');
    lines.push('  replicas: 1');
    lines.push('  selector:');
    lines.push(`    matchLabels: { app: ${unique} }`);
    lines.push('  template:');
    lines.push('    metadata:');
    lines.push(`      labels: { app: ${unique} }`);
    lines.push('    spec:');
    lines.push('      containers:');
    lines.push(`        - name: ${unique}`);
    lines.push('          image: "TODO: your-image:tag"');
    lines.push('          ports:');
    lines.push('            - containerPort: 8080 # TODO: set the real port');
    lines.push('---');
    lines.push('apiVersion: v1');
    lines.push('kind: Service');
    lines.push('metadata:');
    lines.push(`  name: ${unique}`);
    lines.push('spec:');
    lines.push(`  selector: { app: ${unique} }`);
    lines.push('  ports:');
    lines.push('    - port: 80');
    lines.push('      targetPort: 8080 # TODO: match the container port above');
  }
  lines.push('');

  if (otherRecognized.length) {
    lines.push('# Recognized Containers & Orchestration components with no direct manifest');
    lines.push('# mapping (tooling/platform choices, not individual workloads):');
    for (const n of otherRecognized) lines.push(`#   - ${n.text || n.defId}`);
    lines.push('');
  }

  return lines.join('\n');
}
