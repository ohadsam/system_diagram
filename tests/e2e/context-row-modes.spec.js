// Regression + feature coverage for the contextual style-editor row's three
// display modes (floating/pinned-top/pinned-bottom), the pin/unpin toggle,
// and the Default Settings selector that picks the default mode — see
// js/toolbar/toolbar.js and js/io/uiPrefs.js.
import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('floating mode (the default) shows the style card next to the selection instead of in the toolbar', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await page.locator('.node').first().click();
  const row = page.locator('.toolbar-row-context');
  await expect(row).toHaveClass(/floating/);
  await expect(row).toBeVisible();
  // Mounted straight under <body>, not inside #toolbar or #app's flow.
  const parentTag = await row.evaluate((el) => el.parentElement.tagName);
  expect(parentTag).toBe('BODY');
  const position = await row.evaluate((el) => getComputedStyle(el).position);
  expect(position).toBe('fixed');
});

test('the floating card never covers the node it is anchored to', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  const node = page.locator('.node').first();
  await node.click();
  const nodeBox = await node.boundingBox();
  const rowBox = await page.locator('.toolbar-row-context').boundingBox();
  const overlaps = nodeBox.x < rowBox.x + rowBox.width && nodeBox.x + nodeBox.width > rowBox.x
    && nodeBox.y < rowBox.y + rowBox.height && nodeBox.y + nodeBox.height > rowBox.y;
  expect(overlaps).toBe(false);
});

test('the floating card stays within the canvas area, never over the toolbar/sidebar/details panel', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await page.locator('.node').first().click();
  const rowBox = await page.locator('.toolbar-row-context').boundingBox();
  const canvasBox = await page.locator('#canvas-viewport').boundingBox();
  expect(rowBox.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
  expect(rowBox.y).toBeGreaterThanOrEqual(canvasBox.y - 1);
  expect(rowBox.x + rowBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);
});

test('the pin button switches floating to pinned-top, and unpin returns to floating', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await page.locator('.node').first().click();
  const row = page.locator('.toolbar-row-context');
  await expect(row).toHaveClass(/floating/);

  await page.locator('.toolbar-context-pin').click();
  await expect(row).toHaveClass(/pinned-top/);
  const parentTag = await row.evaluate((el) => el.parentElement.id);
  expect(parentTag).toBe('toolbar');

  await page.locator('.toolbar-context-pin').click();
  await expect(row).toHaveClass(/floating/);
});

test('the floating card hides itself while a toolbar dropdown is open, and reappears once closed', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await page.locator('.node').first().click();
  const row = page.locator('.toolbar-row-context');
  await expect(row).toBeVisible();

  await openToolbarGroup(page, 'Create');
  await expect(row).toBeHidden();
  // The dropdown's own buttons must still be reachable — this is the actual
  // regression this behavior fixes (the floating card could otherwise sit
  // on top of a dropdown panel's buttons).
  const replicateBtn = page.locator('#toolbar button[title^="Replicate"]');
  await expect(replicateBtn).toBeVisible();
  await replicateBtn.click();
  await expect(page.locator('.replication-modal')).toBeVisible();
});

test('the floating card never renders underneath the Smart Suggestions banner', async ({ page }) => {
  // Kafka has a curated "related" suggestion (Elasticsearch), which pops up
  // the bottom-center "Smart Suggestions" banner — a separate `position:
  // fixed` element the floating card doesn't know about through
  // #canvas-viewport's own bounds alone.
  await addComponentByName(page, 'Kafka');
  const banner = page.locator('.suggestion-banner.visible');
  await expect(banner).toBeVisible();

  const rowBox = await page.locator('.toolbar-row-context').boundingBox();
  const bannerBox = await banner.boundingBox();
  const overlaps = rowBox.x < bannerBox.x + bannerBox.width && rowBox.x + rowBox.width > bannerBox.x
    && rowBox.y < bannerBox.y + bannerBox.height && rowBox.y + rowBox.height > bannerBox.y;
  expect(overlaps).toBe(false);
});

test('Default Settings can set the default style-editor mode to pinned-bottom', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'Default Settings' }).click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();

  await page.locator('.default-settings-modal select').nth(2).selectOption('pinned-bottom');
  await page.locator('.default-settings-modal button', { hasText: 'Save' }).click();
  await expect(page.locator('.default-settings-modal')).toHaveCount(0);

  await addComponentByName(page, 'MySQL');
  await page.locator('.node').first().click();
  const row = page.locator('.toolbar-row-context');
  await expect(row).toHaveClass(/pinned-bottom/);
  const parentId = await row.evaluate((el) => el.parentElement.id);
  expect(parentId).toBe('app');
});
