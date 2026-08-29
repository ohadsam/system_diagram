import { test } from 'node:test';
import assert from 'node:assert/strict';

// buildShareUrl reads location.origin/pathname — stub a minimal global
// before importing, same as this file would see in a real browser tab.
globalThis.location = { origin: 'https://example.com', pathname: '/index.html' };

const { buildShareUrl, loadProjectFromHash, findShareHashInText } = await import('../../js/io/shareLink.js');
const { createEmptyProject, createNode } = await import('../../js/core/project.js');

test('loadProjectFromHash returns null for a hash that is not a share link', async () => {
  assert.equal(await loadProjectFromHash(''), null);
  assert.equal(await loadProjectFromHash('#'), null);
  assert.equal(await loadProjectFromHash('#somethingelse=abc'), null);
});

test('loadProjectFromHash returns null for garbage after the "#share=" prefix', async () => {
  assert.equal(await loadProjectFromHash('#share=not-valid-base64url-gzip-data!!!'), null);
});

test('findShareHashInText finds a bare hash or one embedded in a full URL', () => {
  assert.equal(findShareHashInText('#share=H4sIAA_-abc'), '#share=H4sIAA_-abc');
  assert.equal(
    findShareHashInText('Open this link to see your diagram: https://example.com/index.html#share=H4sIAA_-abc — enjoy!'),
    '#share=H4sIAA_-abc',
  );
  assert.equal(findShareHashInText('just some plain JSON reply, no link here'), null);
  assert.equal(findShareHashInText(''), null);
  assert.equal(findShareHashInText(null), null);
});

test('buildShareUrl + loadProjectFromHash round-trips a project\'s nodes/edges', async () => {
  const project = createEmptyProject('My Diagram');
  const a = createNode(null, 10, 20, { text: 'Client' });
  const b = createNode(null, 300, 20, { text: 'Server' });
  project.nodes.push(a, b);

  const url = await buildShareUrl(project);
  assert.ok(url.startsWith('https://example.com/index.html#share='));

  const hash = url.slice(url.indexOf('#'));
  const restored = await loadProjectFromHash(hash);
  assert.ok(restored);
  assert.equal(restored.name, 'My Diagram');
  assert.equal(restored.nodes.length, 2);
  assert.equal(restored.nodes[0].text, 'Client');
  assert.equal(restored.nodes[1].text, 'Server');
});
