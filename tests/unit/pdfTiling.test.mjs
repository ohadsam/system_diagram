import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTileGrid } from '../../js/core/pdfTiling.js';

test('computeTileGrid returns a single tile when content fits on one page', () => {
  const tiles = computeTileGrid(400, 300, 595, 842, 24);
  assert.equal(tiles.length, 1);
  assert.deepEqual(tiles[0], { row: 0, col: 0, x: 0, y: 0, w: 400, h: 300, pageNumber: 1 });
});

test('computeTileGrid splits content wider than one page into multiple columns', () => {
  const tiles = computeTileGrid(1000, 400, 595, 842, 0);
  const cols = new Set(tiles.map((t) => t.col));
  assert.equal(cols.size, 2);
  assert.equal(tiles.length, 2);
  assert.equal(tiles[0].x, 0);
  assert.equal(tiles[1].x, 595);
  // The last column's tile is clamped to the remaining content, not a full page width.
  assert.equal(tiles[1].w, 1000 - 595);
});

test('computeTileGrid splits content into a full row x column grid, in row-major page order', () => {
  const tiles = computeTileGrid(1000, 1000, 595, 595, 0);
  assert.equal(tiles.length, 4); // 2 cols x 2 rows
  assert.deepEqual(tiles.map((t) => t.pageNumber), [1, 2, 3, 4]);
  assert.deepEqual(tiles.map((t) => [t.row, t.col]), [[0, 0], [0, 1], [1, 0], [1, 1]]);
});

test('computeTileGrid subtracts overlap from the stride but keeps every tile a full page size', () => {
  const tiles = computeTileGrid(1000, 300, 595, 842, 50);
  // stride = 595 - 50 = 545; ceil((1000-50)/545) = ceil(1.743) = 2 columns
  assert.equal(tiles.length, 2);
  assert.equal(tiles[0].x, 0);
  assert.equal(tiles[1].x, 545);
  assert.equal(tiles[0].w, 595); // full page width, not shrunk by the overlap
});

test('computeTileGrid returns empty for zero/negative content or page dimensions', () => {
  assert.deepEqual(computeTileGrid(0, 300, 595, 842), []);
  assert.deepEqual(computeTileGrid(300, 0, 595, 842), []);
  assert.deepEqual(computeTileGrid(300, 300, 0, 842), []);
});
