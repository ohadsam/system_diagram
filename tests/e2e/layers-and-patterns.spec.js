import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, edgeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('dragging a "layer" item onto an existing node attaches it as a sub-component instead of creating a new node', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await expect.poll(() => nodeCount(page)).toBe(1);

  await page.locator('.sidebar-search input').fill('Controller');
  await page.waitForTimeout(150);
  const controllerItem = page.locator('.sidebar-item[data-name="Controller"]');
  await controllerItem.scrollIntoViewIfNeeded();
  const itemBox = await controllerItem.boundingBox();
  const nodeBox = await page.locator('.node').first().boundingBox();

  await page.mouse.move(itemBox.x + 10, itemBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + nodeBox.height / 2, { steps: 10 });
  await expect(page.locator('.node').first()).toHaveClass(/layer-drop-target/);
  await page.mouse.up();

  await expect.poll(() => nodeCount(page)).toBe(1); // still one node, not two
  await expect(page.locator('.node').first()).toHaveClass(/has-info/);
});

test('clicking a "layer" item while a single node is selected attaches it there', async ({ page }) => {
  await addComponentByName(page, 'Lambda');
  await page.locator('.node').first().click({ force: true });

  await page.locator('.sidebar-search input').fill('Authentication');
  await page.waitForTimeout(150);
  await page.locator('.sidebar-item[data-name="Authentication"]').click();

  await expect.poll(() => nodeCount(page)).toBe(1);
  await expect(page.locator('.node').first()).toHaveClass(/has-info/);
});

test('a "layer" item dropped on empty canvas becomes a normal standalone node', async ({ page }) => {
  await page.locator('.sidebar-search input').fill('Service');
  await page.waitForTimeout(150);
  await page.locator('.sidebar-item[data-name="Service"]').click();
  await expect.poll(() => nodeCount(page)).toBe(1);
  await expect(page.locator('.node-label').first()).toHaveText('Service');
});

test('a design pattern instantiates a whole connected cluster in one action', async ({ page }) => {
  await addComponentByName(page, 'Repository Pattern');
  await expect.poll(() => nodeCount(page)).toBe(3);
  await expect.poll(() => edgeCount(page)).toBe(2);
  const labels = await page.locator('.node-label').allTextContents();
  expect(labels).toEqual(expect.arrayContaining(['Service', 'Repository']));
});

test('undoing a pattern instantiation removes the whole cluster in one step', async ({ page }) => {
  await addComponentByName(page, 'Singleton');
  await expect.poll(() => nodeCount(page)).toBe(2);
  await page.keyboard.press('Control+z');
  await expect.poll(() => nodeCount(page)).toBe(0);
});
