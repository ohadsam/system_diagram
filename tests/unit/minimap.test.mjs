import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMinimapLayout, minimapPointToCanvas } from '../../js/core/minimap.js';

const VIEWPORT_SIZE = { width: 800, height: 600 };
const MAP_SIZE = { w: 220, h: 150 };
const IDENTITY_VIEWPORT = { x: 0, y: 0, zoom: 1 };

test('computeMinimapLayout maps every node into the map panel, preserving relative position', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0, w: 100, h: 50 },
    { id: 'b', x: 500, y: 300, w: 100, h: 50 },
  ];
  const layout = computeMinimapLayout(nodes, IDENTITY_VIEWPORT, VIEWPORT_SIZE, MAP_SIZE);
  assert.equal(layout.nodeRects.length, 2);
  const [ra, rb] = layout.nodeRects;
  assert.ok(rb.x > ra.x, 'b sits to the right of a in canvas space, so it must in map space too');
  assert.ok(rb.y > ra.y);
  for (const r of layout.nodeRects) {
    assert.ok(r.x >= 0 && r.x <= MAP_SIZE.w, 'node rects stay inside the map panel bounds');
    assert.ok(r.y >= 0 && r.y <= MAP_SIZE.h);
  }
});

test('computeMinimapLayout includes the visible viewport rect even with zero nodes', () => {
  const layout = computeMinimapLayout([], IDENTITY_VIEWPORT, VIEWPORT_SIZE, MAP_SIZE);
  assert.equal(layout.nodeRects.length, 0);
  assert.ok(layout.viewportRect.w > 0);
  assert.ok(layout.viewportRect.h > 0);
});

test('computeMinimapLayout keeps the viewport indicator inside the panel even panned far from every node', () => {
  const nodes = [{ id: 'a', x: 0, y: 0, w: 100, h: 50 }];
  // Panned so canvas-space (5000, 5000) is at the top-left of the screen — far from node "a".
  const farViewport = { x: -5000, y: -5000, zoom: 1 };
  const layout = computeMinimapLayout(nodes, farViewport, VIEWPORT_SIZE, MAP_SIZE);
  assert.ok(layout.viewportRect.x >= -1 && layout.viewportRect.x <= MAP_SIZE.w + 1);
  assert.ok(layout.viewportRect.y >= -1 && layout.viewportRect.y <= MAP_SIZE.h + 1);
});

test('computeMinimapLayout reflects zoom: a higher zoom means a smaller visible viewport rect in canvas space', () => {
  const nodes = [{ id: 'a', x: 0, y: 0, w: 2000, h: 2000 }];
  const zoomedOut = computeMinimapLayout(nodes, { x: 0, y: 0, zoom: 0.5 }, VIEWPORT_SIZE, MAP_SIZE);
  const zoomedIn = computeMinimapLayout(nodes, { x: 0, y: 0, zoom: 2 }, VIEWPORT_SIZE, MAP_SIZE);
  assert.ok(zoomedIn.viewportRect.w < zoomedOut.viewportRect.w, 'zooming in shows less canvas area, so a smaller box on the shared map scale');
});

test('minimapPointToCanvas is the inverse of computeMinimapLayout\'s mapping', () => {
  const nodes = [{ id: 'a', x: 100, y: 200, w: 100, h: 50 }];
  const layout = computeMinimapLayout(nodes, IDENTITY_VIEWPORT, VIEWPORT_SIZE, MAP_SIZE);
  const node = layout.nodeRects[0];
  const canvasPoint = minimapPointToCanvas(node.x, node.y, layout);
  assert.ok(Math.abs(canvasPoint.x - 100) < 0.001);
  assert.ok(Math.abs(canvasPoint.y - 200) < 0.001);
});

test('computeMinimapLayout never divides by zero when bounds collapse to a single point', () => {
  const nodes = [{ id: 'a', x: 50, y: 50, w: 0, h: 0 }];
  const layout = computeMinimapLayout(nodes, { x: 0, y: 0, zoom: 1 }, { width: 0, height: 0 }, MAP_SIZE);
  assert.ok(Number.isFinite(layout.scale));
  assert.ok(layout.scale > 0);
});
