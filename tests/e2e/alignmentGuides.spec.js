import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, dragNodeBy } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('dragging a component close to another\'s left edge snaps into exact alignment and shows a guide line', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await addComponentByName(page, 'RabbitMQ');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 250, 150); // separate the two, both start at canvas center

  const targetBox = await nodes.nth(0).boundingBox();
  const movingBox = await nodes.nth(1).boundingBox();
  // Drag node 1 so its left edge lands 3 screen px right of node 0's left edge — within the snap threshold.
  const dx = (targetBox.x + 3) - movingBox.x;
  const dy = 40;
  await page.mouse.move(movingBox.x + movingBox.width / 2, movingBox.y + movingBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(movingBox.x + movingBox.width / 2 + dx, movingBox.y + movingBox.height / 2 + dy, { steps: 6 });

  await expect(page.locator('.align-guide')).toHaveCount(1);
  await page.mouse.up();

  const finalTarget = await nodes.nth(0).boundingBox();
  const finalMoving = await nodes.nth(1).boundingBox();
  expect(Math.round(finalMoving.x)).toBe(Math.round(finalTarget.x));
  await expect(page.locator('.align-guide')).toHaveCount(0);
});

test('dragging far from any other component shows no guide and does not snap', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await addComponentByName(page, 'RabbitMQ');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 400, 300);

  const movingBox = await nodes.nth(0).boundingBox();
  await page.mouse.move(movingBox.x + movingBox.width / 2, movingBox.y + movingBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(movingBox.x + movingBox.width / 2 + 15, movingBox.y + movingBox.height / 2 + 15, { steps: 6 });
  await expect(page.locator('.align-guide')).toHaveCount(0);
  await page.mouse.up();
});

test('turning off "Snap Guides" in Tools disables snapping', async ({ page }) => {
  await page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: 'Tools' }).click();
  await page.locator('#toolbar button', { hasText: 'Snap Guides' }).click(); // toggle off

  await addComponentByName(page, 'Nginx Web Server');
  await addComponentByName(page, 'RabbitMQ');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 250, 150);

  const targetBox = await nodes.nth(0).boundingBox();
  const movingBox = await nodes.nth(1).boundingBox();
  const dx = (targetBox.x + 3) - movingBox.x;
  await page.mouse.move(movingBox.x + movingBox.width / 2, movingBox.y + movingBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(movingBox.x + movingBox.width / 2 + dx, movingBox.y + movingBox.height / 2 + 40, { steps: 6 });
  await expect(page.locator('.align-guide')).toHaveCount(0);
  await page.mouse.up();
});
