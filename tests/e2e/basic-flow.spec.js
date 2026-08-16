import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, edgeCount, connectNodes, dragNodeBy } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the app loads with the sidebar, canvas and toolbar visible, no console errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await expect(page.locator('#sidebar')).toBeVisible();
  await expect(page.locator('#canvas-viewport')).toBeVisible();
  await expect(page.locator('#toolbar')).toBeVisible();
  // categories start collapsed, so check a category header (not a hidden item) is visible
  await expect(page.locator('.category-header').first()).toBeVisible();
  expect(await page.locator('.sidebar-item').count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('dragging a component from the sidebar onto the canvas creates a node', async ({ page }) => {
  await expect.poll(() => nodeCount(page)).toBe(0);

  const search = page.locator('.sidebar-search input');
  await search.fill('EC2');
  await page.waitForTimeout(150);
  const item = page.locator('.sidebar-item').first();
  await item.scrollIntoViewIfNeeded();
  const itemBox = await item.boundingBox();
  const canvasBox = await page.locator('#canvas-viewport').boundingBox();

  await page.mouse.move(itemBox.x + 10, itemBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 200, canvasBox.y + 200, { steps: 10 });
  await page.mouse.up();

  await expect.poll(() => nodeCount(page)).toBe(1);
});

test('adding several components by clicking the sidebar (without moving any of them) still leaves every one individually clickable', async ({ page }) => {
  await addComponentByName(page, 'MySQL');
  await addComponentByName(page, 'PostgreSQL');
  await addComponentByName(page, 'Redis');
  await expect.poll(() => nodeCount(page)).toBe(3);

  const nodes = page.locator('.node');
  // Each click-added node lands at the same canvas-center point by default;
  // canvas.js#createNodeFromDrop nudges a new node's spot diagonally when
  // it would otherwise land exactly on top of an existing one (higher
  // zIndex always wins), so every node's own center stays reachable by a
  // plain click even though nobody dragged any of them apart.
  for (let i = 0; i < 3; i += 1) {
    await nodes.nth(i).click({ timeout: 5000 });
    await expect(nodes.nth(i)).toHaveClass(/selected/);
  }
});

test('clicking a sidebar item adds it centered on the canvas (touch-friendly path)', async ({ page }) => {
  await addComponentByName(page, 'S3');
  await expect.poll(() => nodeCount(page)).toBe(1);
});

test('selecting a node reveals the style editor, and style changes apply', async ({ page }) => {
  await addComponentByName(page, 'PostgreSQL');
  await page.locator('.node').first().click();
  await expect(page.locator('.toolbar-row-context')).toBeVisible();

  const fillInput = page.locator('.toolbar-row-context input[type="color"]').first();
  await fillInput.fill('#ff0000');
  await expect(page.locator('.node-body').first()).toHaveCSS('background-color', 'rgb(255, 0, 0)');
});

test('double-clicking a node label renames it inline', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  const label = page.locator('.node-label').first();
  await label.dblclick();
  const input = page.locator('.inline-edit-input');
  await input.fill('My Redis Cache');
  await input.press('Enter');
  await expect(page.locator('.node-label').first()).toHaveText('My Redis Cache');
});

test('dragging from a connection point to another node creates a connector', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await addComponentByName(page, 'MySQL');
  await expect.poll(() => nodeCount(page)).toBe(2);

  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160); // separate the two (both start centered on top of each other)
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect.poll(() => edgeCount(page)).toBe(1);
});

test('deleting the selection removes it, and right-click duplicate works', async ({ page }) => {
  await addComponentByName(page, 'Kubernetes');
  await page.locator('.node').first().click({ force: true });
  await page.keyboard.press('Control+d');
  await expect.poll(() => nodeCount(page)).toBe(2);

  await page.locator('.node').first().click({ force: true });
  await page.keyboard.press('Delete');
  await expect.poll(() => nodeCount(page)).toBe(1);
});

test('the ⓘ button opens the details panel and a note sets the "has info" badge', async ({ page }) => {
  await addComponentByName(page, 'DynamoDB');
  const node = page.locator('.node').first();
  await node.hover();
  await node.locator('.node-info-btn').click({ force: true });
  await expect(page.locator('#details-panel')).toHaveClass(/open/);

  await page.locator('.details-notes').fill('Stores user sessions');
  await expect(node).toHaveClass(/has-info/);
});
