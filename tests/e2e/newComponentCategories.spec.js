import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('BPMN, UML Deployment, and new networking components are searchable and placeable', async ({ page }) => {
  await addComponentByName(page, 'Exclusive Gateway');
  await expect(page.locator('.node')).toHaveCount(1);

  await addComponentByName(page, 'Bastion Host');
  await expect(page.locator('.node')).toHaveCount(2);

  await addComponentByName(page, 'Network ACL');
  await expect(page.locator('.node')).toHaveCount(3);
});

test('a UML Deployment "Device" node renders with the Cuboid shape and its 3D-box CSS faces', async ({ page }) => {
  const search = page.locator('.sidebar-search input');
  await search.fill('Execution Environment');
  await page.waitForTimeout(150);
  await page.locator('.sidebar-item', { hasText: 'Execution Environment' }).first().click();
  await page.waitForTimeout(150);
  const node = page.locator('.node').first();
  await expect(node).toHaveAttribute('data-shape', 'cuboid');

  const hasFaces = await node.evaluate((el) => {
    const before = getComputedStyle(el, '::before');
    const after = getComputedStyle(el, '::after');
    return before.content !== 'none' && after.content !== 'none';
  });
  expect(hasFaces).toBe(true);
});
