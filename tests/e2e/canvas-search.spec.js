// Coverage for the toolbar's "find on canvas" search box
// (toolbar.js#buildCanvasSearchGroup) — searches components/connectors
// already placed on the canvas by their text/label, distinct from the
// sidebar's own search which searches the component library to add
// something new.
import { test, expect } from '@playwright/test';
import {
  dismissHints, addComponentByName, dragNodeBy, connectNodes, edgeCount, clickEdgeNearNode,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('typing a component name selects and centers on the first match', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 20 } }); // deselect

  await page.locator('.toolbar-canvas-search input').fill('mysql');
  await expect(page.locator('.toolbar-canvas-search-count')).toHaveText('1/1');
  await expect(page.locator('.node.selected')).toHaveCount(1);
  await expect(page.locator('.node-label').first()).toHaveText('MySQL');
});

test('search matches connector labels too, and cycles through multiple matches with Enter', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await addComponentByName(page, 'Nginx Web Server');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160);
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect.poll(() => edgeCount(page)).toBe(1);

  // Give the connector a label matching text also present in a component
  // name, so the search has more than one hit to cycle through. A
  // connector's overall bounding-box center can land on empty space (e.g.
  // inside an elbow route's bend), so click a real point along its
  // rendered path instead — same helper the other connector-selection
  // tests use.
  await clickEdgeNearNode(page);
  const labelInput = page.locator('.toolbar-row-context input[type="text"]').first();
  await labelInput.fill('web traffic');
  await page.keyboard.press('Tab');
  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 20 } });

  const search = page.locator('.toolbar-canvas-search input');
  await search.fill('web');
  await expect(page.locator('.toolbar-canvas-search-count')).toHaveText('1/2');
  const firstSelected = await page.locator('.node.selected, .edge.selected').count();
  expect(firstSelected).toBe(1);

  await search.press('Enter');
  await expect(page.locator('.toolbar-canvas-search-count')).toHaveText('2/2');

  // Wraps back around to the first match.
  await search.press('Enter');
  await expect(page.locator('.toolbar-canvas-search-count')).toHaveText('1/2');
});

test('a query with no matches shows "No matches" and does not throw', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await addComponentByName(page, 'MySQL');

  await page.locator('.toolbar-canvas-search input').fill('zzz-nonexistent-zzz');
  await expect(page.locator('.toolbar-canvas-search-count')).toHaveText('No matches');
  expect(errors).toEqual([]);
});

test('clearing the search hides the match count', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  const search = page.locator('.toolbar-canvas-search input');
  await search.fill('mysql');
  await expect(page.locator('.toolbar-canvas-search-count')).toBeVisible();

  await search.fill('');
  await expect(page.locator('.toolbar-canvas-search-count')).toBeHidden();
});
