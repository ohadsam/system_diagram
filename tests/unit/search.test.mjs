import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentMatches, filterComponents, normalize, nameMatches, nameMatchRank, rankComponents } from '../../js/sidebar/search.js';

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

test('nameMatches: true only for a name-level match, not a description/tag-only one', () => {
  assert.equal(nameMatches(sample, 'ec2'), true);
  assert.equal(nameMatches(sample, 'EC2'), true);
  assert.equal(nameMatches(sample, 'virtual server'), false, 'matches the description, not the name');
  assert.equal(nameMatches(sample, 'vm'), false, 'matches a tag, not the name');
  assert.equal(nameMatches(sample, ''), false, 'an empty query is not a name match');
});

test('nameMatchRank: exact match ranks better (lower) than any partial name match', () => {
  const device = { name: 'Device', description: '', tags: [] };
  const iotDevice = { name: 'IoT Device', description: '', tags: [] };
  assert.equal(nameMatchRank(device, 'Device'), 0, 'exact name match');
  assert.ok(nameMatchRank(sample, 'ec2') > 0, 'a prefix match still ranks below an exact one');
  assert.ok(nameMatchRank(device, 'Device') < nameMatchRank(iotDevice, 'Device'), 'the exact match must outrank the substring one');
  assert.equal(nameMatchRank(sample, 'virtual server'), null, 'a description-only match is not a name match at all');
  assert.equal(nameMatchRank(sample, ''), null);
});

test('nameMatchRank: a short, closely-matching name outranks a much longer name that merely starts with the same word', () => {
  // Regression: "Apache Kafka" (the actual component) is only a *substring*
  // match for the query "Kafka", while "Kafka Consumer-Group Rebalance" (a
  // sequence-diagram template) is a *prefix* match — a naive prefix-beats-
  // substring rule ranks the much longer, more specific template first,
  // which broke real e2e tests (addComponentByName's search-and-click-first
  // picked the template and instantiated a whole lifeline cluster instead
  // of the single expected node). Coverage (how little of the name is left
  // over once the query is removed) must win over raw match position.
  const apacheKafka = { name: 'Apache Kafka', description: '', tags: [] };
  const kafkaTemplate = { name: 'Kafka Consumer-Group Rebalance', description: '', tags: [] };
  assert.ok(nameMatchRank(apacheKafka, 'Kafka') < nameMatchRank(kafkaTemplate, 'Kafka'));
});

test('rankComponents: an exact name match outranks an alphabetically-earlier substring match', () => {
  // "Preact" sorts before "React" alphabetically and *does* technically
  // contain "react" as a substring — without ranking, it would win a plain
  // alphabetical or declaration-order list, surfacing the wrong framework
  // as the first search result for its own, unrelated, exact name.
  const preact = { name: 'Preact', description: '', tags: [] };
  const react = { name: 'React', description: '', tags: [] };
  const ranked = rankComponents([preact, react], 'React');
  assert.deepEqual(ranked.map((c) => c.name), ['React', 'Preact']);
});

test('rankComponents: a real product outranks a much longer, differently-purposed item whose name merely starts with the same word', () => {
  const apacheKafka = { name: 'Apache Kafka', description: '', tags: [] };
  const kafkaTemplate = { name: 'Kafka Consumer-Group Rebalance', description: '', tags: [] };
  const ranked = rankComponents([kafkaTemplate, apacheKafka], 'Kafka');
  assert.deepEqual(ranked.map((c) => c.name), ['Apache Kafka', 'Kafka Consumer-Group Rebalance']);
});

test('rankComponents leaves an empty query untouched', () => {
  const list = [{ name: 'B', description: '', tags: [] }, { name: 'A', description: '', tags: [] }];
  assert.deepEqual(rankComponents(list, ''), list);
});

test('rankComponents is a stable sort: ties (including two description-only matches) keep their original relative order', () => {
  const a = { name: 'Zeta', description: 'does a thing', tags: [] };
  const b = { name: 'Alpha', description: 'does a thing', tags: [] };
  const ranked = rankComponents([a, b], 'does a thing');
  assert.deepEqual(ranked.map((c) => c.name), ['Zeta', 'Alpha'], 'neither matches by name, so original order is preserved');
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
