import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

// Stubs window.open to record its argument instead of letting it actually
// navigate — same pattern as tests/e2e/exportDiagram.spec.js.
async function captureWindowOpenUrl(page) {
  return page.evaluate(() => {
    window.__openedUrl = null;
    window.open = (url) => { window.__openedUrl = url; return null; };
  });
}

test('Help menu\'s "AI / CLI Integration" button opens docs/AI_INTEGRATION.md', async ({ page }) => {
  await captureWindowOpenUrl(page);
  await openToolbarGroup(page, 'Help');
  await page.locator('#toolbar button', { hasText: 'AI / CLI Integration' }).click();
  await page.waitForFunction(() => window.__openedUrl != null);
  expect(await page.evaluate(() => window.__openedUrl)).toBe('docs/AI_INTEGRATION.md');
});

test('the same action is reachable from the Command Palette', async ({ page }) => {
  await captureWindowOpenUrl(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('AI / CLI Integration');
  await page.locator('.command-palette-item', { hasText: '🤖 AI / CLI Integration' }).click();
  await page.waitForFunction(() => window.__openedUrl != null);
  expect(await page.evaluate(() => window.__openedUrl)).toBe('docs/AI_INTEGRATION.md');
});
