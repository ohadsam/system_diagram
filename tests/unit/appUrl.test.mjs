import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAppBaseUrl } from '../../js/core/appUrl.js';

test('computeAppBaseUrl strips a trailing index.html', () => {
  assert.equal(computeAppBaseUrl('https://ohadsam.github.io/system_diagram/index.html'), 'https://ohadsam.github.io/system_diagram/');
});

test('computeAppBaseUrl leaves an already-directory URL untouched', () => {
  assert.equal(computeAppBaseUrl('https://ohadsam.github.io/system_diagram/'), 'https://ohadsam.github.io/system_diagram/');
});

test('computeAppBaseUrl handles a bare-domain deployment (custom CNAME) with no subpath', () => {
  assert.equal(computeAppBaseUrl('https://diagrams.example.com/index.html'), 'https://diagrams.example.com/');
});

test('computeAppBaseUrl handles a local dev server with a port', () => {
  assert.equal(computeAppBaseUrl('http://localhost:4173/index.html'), 'http://localhost:4173/');
});

test('computeAppBaseUrl ignores query strings and hashes', () => {
  assert.equal(computeAppBaseUrl('https://ohadsam.github.io/system_diagram/index.html?x=1#share=abc'), 'https://ohadsam.github.io/system_diagram/');
});
