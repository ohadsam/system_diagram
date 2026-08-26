import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutC4Context } from '../../js/core/c4Context.js';

const SIZE = { w: 160, h: 84 };

test('centers the system box on the given point', () => {
  const { system } = layoutC4Context('My System', [], [], 500, 300, SIZE);
  assert.equal(system.text, 'My System');
  assert.equal(system.x, 500 - SIZE.w / 2);
  assert.equal(system.y, 300);
});

test('places people above the system and external systems below it', () => {
  const { system, people, externalSystems } = layoutC4Context('Sys', ['User'], ['Payments API'], 0, 0, SIZE);
  assert.equal(people.length, 1);
  assert.equal(externalSystems.length, 1);
  assert.ok(people[0].y < system.y);
  assert.ok(externalSystems[0].y > system.y);
});

test('spaces multiple people/external systems evenly and preserves order', () => {
  const { people, externalSystems } = layoutC4Context('Sys', ['A', 'B', 'C'], ['X', 'Y'], 0, 0, SIZE);
  assert.deepEqual(people.map((p) => p.text), ['A', 'B', 'C']);
  assert.deepEqual(externalSystems.map((p) => p.text), ['X', 'Y']);
  assert.ok(people[0].x < people[1].x);
  assert.ok(people[1].x < people[2].x);
});

test('an empty people/externalSystems list produces no rows', () => {
  const { people, externalSystems } = layoutC4Context('Sys', [], [], 0, 0, SIZE);
  assert.deepEqual(people, []);
  assert.deepEqual(externalSystems, []);
});

test('every row is horizontally centered on centerX', () => {
  const { people } = layoutC4Context('Sys', ['A', 'B'], [], 400, 0, SIZE);
  const midpoint = (people[0].x + people[1].x + SIZE.w) / 2;
  assert.equal(midpoint, 400);
});
