import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

// A minimal valid 1x1 red PNG, used as a stand-in "uploaded icon" file.
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('uploading an image sets it as the node\'s icon, replacing the emoji, and "Remove Image" reverts it', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await page.locator('.node').first().click();

  const contextRow = page.locator('.toolbar-row-context');
  await expect(contextRow.locator('button', { hasText: 'Upload Image' })).toBeVisible();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await contextRow.locator('button', { hasText: 'Upload Image' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({ name: 'icon.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG_BASE64, 'base64') });

  const iconImg = page.locator('.node').first().locator('.node-icon-image');
  await expect(iconImg).toBeVisible();
  await expect(iconImg).toHaveAttribute('src', /^data:image\/png;base64,/);

  await expect(contextRow.locator('button', { hasText: 'Replace Image' })).toBeVisible();
  await contextRow.locator('button', { hasText: 'Remove Image' }).click();
  await expect(page.locator('.node').first().locator('.node-icon-image')).toHaveCount(0);
});

test('a custom icon image survives reload (persisted in the project)', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await page.locator('.node').first().click();
  const contextRow = page.locator('.toolbar-row-context');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await contextRow.locator('button', { hasText: 'Upload Image' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({ name: 'icon.png', mimeType: 'image/png', buffer: Buffer.from(TINY_PNG_BASE64, 'base64') });
  await expect(page.locator('.node').first().locator('.node-icon-image')).toBeVisible();
  await page.waitForTimeout(700); // autosave is debounced ~500ms

  await page.reload();
  await expect(page.locator('.node').first().locator('.node-icon-image')).toBeVisible();
});
