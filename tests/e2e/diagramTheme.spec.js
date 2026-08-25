import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('"Diagram Theme" recolors components to the chosen palette', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  const node = page.locator('.node').first();
  const strokeBefore = await node.locator('.node-body').evaluate((el) => getComputedStyle(el).borderColor || getComputedStyle(el).stroke);

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Diagram Theme' }).click();
  await expect(page.locator('.diagram-theme-modal')).toBeVisible();

  await page.locator('.diagram-theme-card', { hasText: 'Monochrome' }).click();
  await page.locator('.diagram-theme-modal button', { hasText: '🎨 Apply Theme' }).click();
  await expect(page.locator('.toast-success', { hasText: 'Applied the "Monochrome" theme' })).toBeVisible();

  const strokeAfter = await node.locator('.node-body').evaluate((el) => getComputedStyle(el).borderColor || getComputedStyle(el).stroke);
  expect(strokeAfter).not.toEqual(strokeBefore);
});

test('"Diagram Theme" on an empty canvas shows a guard toast and does not open a recolor', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Diagram Theme' }).click();
  await page.locator('.diagram-theme-modal button', { hasText: '🎨 Apply Theme' }).click();
  await expect(page.locator('.toast-info', { hasText: 'Nothing to recolor yet' })).toBeVisible();
});

test('"Diagram Theme" is reachable from the Command Palette', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await page.keyboard.press('Control+k');
  await expect(page.locator('.command-palette-modal')).toBeVisible();
  await page.locator('.command-palette-input').fill('theme');
  await page.locator('.command-palette-item', { hasText: 'Diagram Theme' }).first().click();
  await expect(page.locator('.diagram-theme-modal')).toBeVisible();
});
