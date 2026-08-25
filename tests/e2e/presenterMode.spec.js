import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('Presenter Mode hides the toolbar/sidebar/panels and the Exit button brings them back', async ({ page }) => {
  await expect(page.locator('#toolbar')).toBeVisible();
  await expect(page.locator('#sidebar')).toBeVisible();
  await expect(page.locator('.kiosk-exit-btn')).toBeHidden();

  await openToolbarGroup(page, 'Tools');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Presenter Mode' }).click();

  await expect(page.locator('#toolbar')).toBeHidden();
  await expect(page.locator('#sidebar')).toBeHidden();
  await expect(page.locator('.kiosk-exit-btn')).toBeVisible();
  // The canvas itself is still there and unaffected.
  await expect(page.locator('#canvas-viewport')).toBeVisible();

  await page.locator('.kiosk-exit-btn').click();
  await expect(page.locator('#toolbar')).toBeVisible();
  await expect(page.locator('#sidebar')).toBeVisible();
  await expect(page.locator('.kiosk-exit-btn')).toBeHidden();
});

test('Escape also exits Presenter Mode', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Presenter Mode' }).click();
  await expect(page.locator('#toolbar')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(page.locator('#toolbar')).toBeVisible();
  await expect(page.locator('.kiosk-exit-btn')).toBeHidden();
});
