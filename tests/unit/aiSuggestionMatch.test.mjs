import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findComponentMatch } from '../../js/core/aiSuggestionMatch.js';

const components = [
  { id: 'cache-redis', name: 'Redis Cache' },
  { id: 'storage-s3', name: 'S3' },
  { id: 'queue-sqs', name: 'SQS' },
];

test('findComponentMatch finds an exact name match', () => {
  assert.equal(findComponentMatch('Redis Cache', components).id, 'cache-redis');
});

test('findComponentMatch is case-insensitive', () => {
  assert.equal(findComponentMatch('redis cache', components).id, 'cache-redis');
});

test('findComponentMatch matches when the library name is a substring of a longer suggestion', () => {
  assert.equal(findComponentMatch('a Redis Cache for hot reads', components).id, 'cache-redis');
});

test('findComponentMatch matches when the suggestion is a substring of a longer library name', () => {
  assert.equal(findComponentMatch('Redis', components).id, 'cache-redis');
});

test('findComponentMatch requires an exact match for a too-short query, to avoid noisy substring false positives', () => {
  assert.equal(findComponentMatch('Ca', components), null, 'a 2-character query is too short to substring-match safely');
  assert.equal(findComponentMatch('S3', components).id, 'storage-s3', 'a short query still matches when it is an exact name match');
});

test('findComponentMatch returns null for no match, empty input, or an empty component list', () => {
  assert.equal(findComponentMatch('Kubernetes Cluster', components), null);
  assert.equal(findComponentMatch('', components), null);
  assert.equal(findComponentMatch('Redis Cache', []), null);
});
