import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup, dragNodeBy, connectNodes } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

/** Drags node B directly on top of node A — the most reliable way to
 * create real overlap in a test, since the app's own click-to-add already
 * actively avoids placing a fresh component on an existing one
 * (canvas.js#findClearCenter) — dragging an *existing* one there by hand
 * is exactly the scenario this feature is for. */
async function dragOnto(page, nodeA, nodeB) {
  const a = await nodeA.boundingBox();
  const b = await nodeB.boundingBox();
  await dragNodeBy(page, nodeB, a.x - b.x, a.y - b.y);
}

test('dragging one component onto another surfaces a dismissible "space it out" suggestion, and Auto-arrange fixes the overlap without reordering', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  const nodes = page.locator('.node');
  await dragOnto(page, nodes.nth(0), nodes.nth(1));

  const beforeBoxes = await Promise.all([nodes.nth(0).boundingBox(), nodes.nth(1).boundingBox()]);
  const leftIsFirst = beforeBoxes[0].x <= beforeBoxes[1].x;

  await page.mouse.click(900, 600); // deselect, so the debounced watcher settles
  await page.waitForTimeout(1200); // past the 800ms debounce

  const banner = page.locator('.crowding-suggestion-banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('crowded');

  await banner.locator('button', { hasText: 'Auto-arrange' }).click();
  await expect(banner).toBeHidden();

  const afterBoxes = await Promise.all([nodes.nth(0).boundingBox(), nodes.nth(1).boundingBox()]);
  function overlap(r1, r2) {
    return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
  }
  expect(overlap(afterBoxes[0], afterBoxes[1])).toBe(false);
  // Order preserved: whichever was more to the left stays more to the left.
  const leftIsFirstAfter = afterBoxes[0].x <= afterBoxes[1].x;
  expect(leftIsFirstAfter).toBe(leftIsFirst);
});

test('Auto-arrange is a single undoable step', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  const nodes = page.locator('.node');
  await dragOnto(page, nodes.nth(0), nodes.nth(1));
  await page.mouse.click(900, 600);
  await page.waitForTimeout(1200);

  await page.locator('.crowding-suggestion-banner button', { hasText: 'Auto-arrange' }).click();
  const fixedBoxes = await Promise.all([nodes.nth(0).boundingBox(), nodes.nth(1).boundingBox()]);

  await page.keyboard.press('ControlOrMeta+z');
  const undoneBoxes = await Promise.all([nodes.nth(0).boundingBox(), nodes.nth(1).boundingBox()]);
  const moved = undoneBoxes[1].x !== fixedBoxes[1].x || undoneBoxes[1].y !== fixedBoxes[1].y;
  expect(moved).toBe(true);
});

test('Dismiss leaves the diagram untouched and does not re-surface the same still-crowded state', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  const nodes = page.locator('.node');
  await dragOnto(page, nodes.nth(0), nodes.nth(1));
  await page.mouse.click(900, 600);
  await page.waitForTimeout(1200);

  const banner = page.locator('.crowding-suggestion-banner');
  await expect(banner).toBeVisible();
  const beforeBox = await nodes.nth(1).boundingBox();
  await banner.locator('button', { hasText: 'Dismiss' }).click();
  await expect(banner).toBeHidden();
  const afterBox = await nodes.nth(1).boundingBox();
  expect(afterBox.x).toBe(beforeBox.x);
  expect(afterBox.y).toBe(beforeBox.y);

  // An unrelated edit elsewhere (renaming a component) settles again, but
  // the exact same still-crowded pair should not re-nag. Both nodes are
  // still stacked on top of each other (Dismiss didn't move anything), so
  // target whichever one is actually on top and clickable.
  await page.locator('.node-label', { hasText: 'Redis Cache' }).dblclick();
  const inlineInput = page.locator('.inline-edit-input');
  await inlineInput.fill('Redis Cache Renamed');
  await inlineInput.press('Enter');
  await page.mouse.click(900, 600);
  await page.waitForTimeout(1200);
  await expect(banner).toBeHidden();
});

test('turning off "Spacing Nudges" stops the banner from appearing', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Spacing Nudges' }).click();

  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  const nodes = page.locator('.node');
  await dragOnto(page, nodes.nth(0), nodes.nth(1));
  await page.mouse.click(900, 600);
  await page.waitForTimeout(1200);

  await expect(page.locator('.crowding-suggestion-banner')).toBeHidden();
});

test('a connector label with no room to fit also triggers the suggestion, even with no node overlap', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  const nodes = page.locator('.node');
  // Bring them close together (but not overlapping) so a long label won't fit.
  const a = await nodes.nth(0).boundingBox();
  const b = await nodes.nth(1).boundingBox();
  await dragNodeBy(page, nodes.nth(1), a.x - b.x + a.width + 10, a.y - b.y);

  await connectNodes(page, nodes.nth(0), nodes.nth(1)); // leaves the new edge selected
  const labelInput = page.locator('[data-focus-key="edge-label"]');
  await expect(labelInput).toBeVisible();
  await labelInput.fill('a fairly long connector label that needs a lot of room to read cleanly');
  await page.mouse.click(900, 600);
  await page.waitForTimeout(1200);

  await expect(page.locator('.crowding-suggestion-banner')).toBeVisible();
});
