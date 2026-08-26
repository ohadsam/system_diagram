import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutErTables } from '../../js/core/erDiagramLayout.js';

test('an empty table list produces no placements', () => {
  assert.deepEqual(layoutErTables([], 0, 0), []);
  assert.deepEqual(layoutErTables(undefined, 0, 0), []);
});

test('a single table is centered on the given point', () => {
  const placed = layoutErTables([{ name: 'users', columns: [{ name: 'id' }] }], 500, 300);
  assert.equal(placed.length, 1);
  assert.equal(placed[0].x, 500 - placed[0].w / 2);
  assert.equal(placed[0].y, 300 - placed[0].h / 2);
});

test('box height grows with the number of columns', () => {
  const placed = layoutErTables([
    { name: 'small', columns: [{ name: 'id' }] },
    { name: 'big', columns: Array.from({ length: 10 }, (_, i) => ({ name: `c${i}` })) },
  ], 0, 0);
  const small = placed.find((p) => p.name === 'small');
  const big = placed.find((p) => p.name === 'big');
  assert.ok(big.h > small.h);
});

test('no two tables overlap (simple grid, distinct x/y per column/row)', () => {
  const tables = Array.from({ length: 5 }, (_, i) => ({ name: `t${i}`, columns: [{ name: 'id' }] }));
  const placed = layoutErTables(tables, 0, 0);
  const positions = new Set(placed.map((p) => `${p.x},${p.y}`));
  assert.equal(positions.size, placed.length);
});

test('preserves table name and columns on each placed entry', () => {
  const tables = [{ name: 'users', columns: [{ name: 'id' }, { name: 'email' }] }];
  const [placed] = layoutErTables(tables, 0, 0);
  assert.equal(placed.name, 'users');
  assert.equal(placed.columns.length, 2);
});
