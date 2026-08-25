import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the minimap is hidden by default and toggles on via the Tools dropdown', async ({ page }) => {
  await expect(page.locator('.minimap')).toBeHidden();

  await openToolbarGroup(page, 'Tools');
  const minimapBtn = page.locator('#toolbar button', { hasText: 'Minimap' });
  await minimapBtn.click();
  await expect(page.locator('.minimap')).toBeVisible();
  await expect(minimapBtn).toHaveClass(/active/);

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Minimap' }).click();
  await expect(page.locator('.minimap')).toBeHidden();
});

test('the minimap shows one rect per component and stays visible across a reload', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Minimap' }).click();
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');
  await expect(page.locator('.minimap-node')).toHaveCount(2);

  await page.waitForTimeout(700); // autosave is debounced ~500ms
  await page.reload();
  await dismissHints(page);
  await expect(page.locator('.minimap')).toBeVisible();
  await expect(page.locator('.minimap-node')).toHaveCount(2);
});

test('clicking the minimap pans the main view', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Minimap' }).click();
  await addComponentByName(page, 'API Gateway');

  const node = page.locator('.node').first();
  const before = await node.boundingBox();

  const minimapSvg = page.locator('.minimap-svg');
  const box = await minimapSvg.boundingBox();
  // Click near a corner of the minimap, far from wherever the node's own
  // dot happens to be, so the pan is guaranteed to actually move the view.
  await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.1);

  const after = await node.boundingBox();
  expect(after.x !== before.x || after.y !== before.y).toBeTruthy();
});
