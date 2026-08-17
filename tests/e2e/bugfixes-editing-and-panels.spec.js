// Regression coverage for a batch of reported bugs: inline-edit/style-field
// focus loss on every keystroke, double-click dead zones, the details
// panel's resize handle and selection-sync behavior, the edge context
// menu's missing Duplicate, the "Toggle Grid" button, and the sidebar's
// scroll-position reset on category expand/collapse.
import { test, expect } from '@playwright/test';
import {
  dismissHints, addComponentByName, edgeCount, connectNodes, openToolbarGroup, dragNodeBy, rightClickEdgeNearNode,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('typing multiple characters into a style-editor field keeps focus the whole time (no per-keystroke reset)', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await page.locator('.node').first().click();
  const textField = page.locator('.field').filter({ has: page.locator('.field-label', { hasText: /^Text$/ }) }).locator('input');
  await textField.click();
  await textField.fill('');
  await textField.pressSequentially('My Renamed Database', { delay: 20 });
  await expect(textField).toBeFocused();
  await expect(textField).toHaveValue('My Renamed Database');
});

test('typing multiple characters into the details panel title field keeps focus the whole time', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await page.locator('.node-info-btn').click();
  const title = page.locator('.details-title-input');
  await title.click();
  await title.fill('');
  await title.pressSequentially('Primary DB Instance', { delay: 20 });
  await expect(title).toBeFocused();
  await expect(title).toHaveValue('Primary DB Instance');
});

test('double-clicking a node\'s icon/padding (not just its exact label text) still opens inline rename', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  // .node-icon has pointer-events:none (see node.css) so a real click there
  // falls through to .node-body underneath it — dblclick .node-body itself
  // at an offset away from the centered label to reproduce that exact
  // fallthrough case (Playwright's actionability check won't click a
  // pointer-events:none element directly, unlike a real browser click).
  const body = page.locator('.node-body').first();
  const box = await body.boundingBox();
  await page.mouse.dblclick(box.x + 10, box.y + 10);
  await expect(page.locator('.inline-edit-input')).toBeVisible();
  await page.locator('.inline-edit-input').fill('Renamed via icon dblclick');
  await page.keyboard.press('Enter');
  await expect(page.locator('.node-label').first()).toHaveText('Renamed via icon dblclick');
});

test('the details panel has a working drag-to-resize handle', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await page.locator('.node-info-btn').click();
  const panel = page.locator('#details-panel');
  const before = await panel.evaluate((el) => el.getBoundingClientRect().width);

  const handle = page.locator('.details-resize-handle');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();

  const after = await panel.evaluate((el) => el.getBoundingClientRect().width);
  expect(after).toBeGreaterThan(before + 50);
});

test('selecting a different node while the details panel is open switches it to the new node; deselecting closes it', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');
  await nodes.nth(0).click();
  await page.locator('.node-info-btn').first().click();
  await expect(page.locator('.details-title-input')).toHaveValue('MySQL');

  await nodes.nth(1).click();
  await expect(page.locator('.details-title-input')).toHaveValue('PostgreSQL');

  await page.locator('.canvas-viewport').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('#details-panel')).not.toHaveClass(/open/);
});

test('right-clicking a connector offers Duplicate, and it works', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160); // separate the two (both start centered on top of each other)
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect.poll(() => edgeCount(page)).toBe(1);

  await rightClickEdgeNearNode(page);
  const duplicateItem = page.locator('.context-menu-item', { hasText: 'Duplicate' });
  await expect(duplicateItem).toBeVisible();
  await duplicateItem.click();
  await expect.poll(() => edgeCount(page)).toBe(2);
});

test('"Toggle Grid" actually changes the canvas background', async ({ page }) => {
  const viewport = page.locator('.canvas-viewport');
  const before = await viewport.evaluate((el) => getComputedStyle(el).backgroundImage);

  await openToolbarGroup(page, 'Tools');
  await page.locator('button', { hasText: 'Toggle Grid' }).click();

  const after = await viewport.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(after).not.toBe(before);
  expect(after).toContain('linear-gradient');
});

test('expanding a sidebar category preserves scroll position instead of jumping to top', async ({ page }) => {
  const list = page.locator('.sidebar-categories');
  // Expand a handful of categories so the list actually has scroll room.
  const headers = page.locator('.category-toggle');
  const count = Math.min(await headers.count(), 6);
  for (let i = 0; i < count; i += 1) await headers.nth(i).click();

  await list.evaluate((el) => { el.scrollTop = 200; });
  const scrolledTo = await list.evaluate((el) => el.scrollTop);
  expect(scrolledTo).toBeGreaterThan(0);

  // Toggling one more category re-renders the whole list — scroll position
  // should survive that rebuild instead of resetting to 0.
  await headers.nth(count).click();
  const after = await list.evaluate((el) => el.scrollTop);
  expect(after).toBeGreaterThan(0);
});
