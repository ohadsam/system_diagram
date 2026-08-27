import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await dismissHints(page);
});

test('a mic button appears on the Quick Start describe textarea when SpeechRecognition is supported', async ({ page }) => {
  await page.addInitScript(() => { window.SpeechRecognition = function () {}; });
  await page.goto('/index.html');
  await dismissHints(page);
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'AI Quick Start' }).click();
  // Skip the optional AI-setup nudge if it appears first.
  const skipSetup = page.locator('.app-modal button', { hasText: 'Skip' });
  if (await skipSetup.count()) await skipSetup.first().click();
  await expect(page.locator('.quick-start-description').locator('..').locator('.speech-input-btn')).toBeVisible();
});

test('no mic button appears when the browser has no SpeechRecognition support at all', async ({ page }) => {
  await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  await page.goto('/index.html');
  await dismissHints(page);
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'AI Quick Start' }).click();
  const skipSetup = page.locator('.app-modal button', { hasText: 'Skip' });
  if (await skipSetup.count()) await skipSetup.first().click();
  await expect(page.locator('.speech-input-btn')).toHaveCount(0);
  await expect(page.locator('.quick-start-description')).toBeVisible();
});
