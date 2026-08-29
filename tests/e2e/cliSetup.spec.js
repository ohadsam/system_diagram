// "🖥️ Working with CLI" (modals/cliSetupModal.js) — answers "what address do
// I give an AI CLI tool" using the *live* URL this exact page is running at
// (core/appUrl.js), not a guess.
import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openCliSetup(page) {
  await openToolbarGroup(page, 'Help');
  await page.locator('#toolbar button', { hasText: 'Working with CLI' }).click();
  await expect(page.locator('.cli-setup-modal')).toBeVisible();
}

test('shows the live base URL of this exact page, not a guess', async ({ page }) => {
  await openCliSetup(page);
  await expect(page.locator('.cli-setup-url')).toHaveValue('http://localhost:4173/');
  await expect(page.locator('.cli-setup-prompt')).toHaveValue(/http:\/\/localhost:4173\/llms\.txt/);
});

test('the "Copy" button copies the same address shown in the field', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await openCliSetup(page);
  await page.locator('.cli-setup-modal button', { hasText: '📋 Copy' }).first().click();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe('http://localhost:4173/');
  await expect(page.locator('.toast-success', { hasText: 'copied' })).toBeVisible();
});

test('reachable from the Command Palette too', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('Working with CLI');
  await page.locator('.command-palette-item', { hasText: 'Working with CLI' }).click();
  await expect(page.locator('.cli-setup-modal')).toBeVisible();
});
