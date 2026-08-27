import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKubernetesManifests } from '../../js/io/exportKubernetes.js';

test('buildKubernetesManifests: explains the narrow scope when no Pod components exist', () => {
  const yaml = buildKubernetesManifests([]);
  assert.match(yaml, /No "Pod" components/);
  assert.doesNotMatch(yaml, /kind: Deployment/);
});

test('buildKubernetesManifests: a Pod component becomes a Deployment + Service pair', () => {
  const nodes = [{ id: 'n1', defId: 'ctr-pod', text: 'Order Service' }];
  const yaml = buildKubernetesManifests(nodes);
  assert.match(yaml, /kind: Deployment/);
  assert.match(yaml, /kind: Service/);
  assert.match(yaml, /name: order-service/);
  assert.match(yaml, /matchLabels: \{ app: order-service \}/);
});

test('buildKubernetesManifests: two Pods with the same name get disambiguated names', () => {
  const nodes = [
    { id: 'n1', defId: 'ctr-pod', text: 'Worker' },
    { id: 'n2', defId: 'ctr-pod', text: 'Worker' },
  ];
  const yaml = buildKubernetesManifests(nodes);
  assert.match(yaml, /name: worker\n/);
  assert.match(yaml, /name: worker-2\n/);
});

test('buildKubernetesManifests: other Containers & Orchestration components are listed as recognized-but-unmapped, not silently dropped', () => {
  const nodes = [{ id: 'n1', defId: 'ctr-helm', text: 'Helm' }];
  const yaml = buildKubernetesManifests(nodes);
  assert.doesNotMatch(yaml, /kind: Deployment/);
  assert.match(yaml, /no direct manifest/);
  assert.match(yaml, /- Helm/);
});

test('buildKubernetesManifests: an unrelated component is skipped without comment', () => {
  const nodes = [{ id: 'n1', defId: 'shape-client', text: 'Browser' }];
  const yaml = buildKubernetesManifests(nodes);
  assert.doesNotMatch(yaml, /Browser/);
});
