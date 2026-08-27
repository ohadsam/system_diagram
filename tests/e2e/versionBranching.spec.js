import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('branching a saved version adds a new branch, filterable via the branch selector', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Version History' }).click();
  await page.locator('.version-history-modal button', { hasText: '📸 Save Version' }).click();
  await page.locator('.prompt-modal input[type="text"]').fill('v1');
  await page.locator('.prompt-modal button', { hasText: 'Save' }).click();

  // Only one branch (main) exists so far, so the branch selector shouldn't show yet.
  await expect(page.locator('.version-history-branch-row')).toHaveCount(0);

  await page.locator('.version-history-row button', { hasText: '🌿 Branch from here' }).click();
  await page.locator('.prompt-modal input[type="text"]').fill('experiment');
  await page.locator('.prompt-modal button', { hasText: 'Create branch' }).click();

  await expect(page.locator('.version-history-branch-row')).toBeVisible();
  await expect(page.locator('.version-history-meta', { hasText: 'branch: experiment' })).toBeVisible();
});
