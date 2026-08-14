import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentMatches, filterComponents, normalize } from '../../js/sidebar/search.js';

const sample = { name: 'EC2 (Elastic Compute Cloud)', description: 'Virtual server in the cloud.', tags: ['compute', 'vm', 'server'] };

test('normalize lowercases and trims', () => {
  assert.equal(normalize('  Hello World  '), 'hello world');
  assert.equal(normalize(undefined), '');
});

test('componentMatches: empty query always matches', () => {
  assert.equal(componentMatches(sample, ''), true);
});

test('componentMatches: matches by name (case-insensitive)', () => {
  assert.equal(componentMatches(sample, 'ec2'), true);
  assert.equal(componentMatches(sample, 'EC2'), true);
});

test('componentMatches: matches by description', () => {
  assert.equal(componentMatches(sample, 'virtual server'), true);
});

test('componentMatches: matches by tag', () => {
  assert.equal(componentMatches(sample, 'vm'), true);
});

test('componentMatches: no match returns false', () => {
  assert.equal(componentMatches(sample, 'kubernetes'), false);
});

test('filterComponents filters a list down to matches', () => {
  const list = [
    sample,
    { name: 'S3', description: 'Object storage', tags: ['storage'] },
    { name: 'Kubernetes', description: 'Container orchestration', tags: ['containers'] },
  ];
  assert.equal(filterComponents(list, '').length, 3);
  assert.equal(filterComponents(list, 'storage').length, 1);
  assert.equal(filterComponents(list, 'nonexistent-term').length, 0);
});
