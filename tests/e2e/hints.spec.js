import { test, expect } from '@playwright/test';

// Deliberately does NOT call the shared dismissHints() helper — these tests
// need the first-run tour to actually be showing.
test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
});

test('a fresh visitor sees the first hint bubble', async ({ page }) => {
  await expect(page.locator('.hint-bubble')).toBeVisible();
});

test('"Skip all" dismisses every hint for good', async ({ page }) => {
  await page.locator('.hint-bubble .btn-link', { hasText: 'Skip all' }).click();
  await expect(page.locator('.hint-bubble')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.hint-bubble')).toHaveCount(0);
});

test('the hints toggle hides the current bubble and future ones, and can be turned back on', async ({ page }) => {
  await expect(page.locator('.hint-bubble')).toBeVisible();

  const toggle = page.locator('#toolbar button[title="Hide hints"]');
  await toggle.click();
  await expect(page.locator('.hint-bubble')).toHaveCount(0);

  // Reloading while hints are off must not resurrect the bubble.
  await page.reload();
  await expect(page.locator('.hint-bubble')).toHaveCount(0);
  await expect(page.locator('#toolbar button[title="Show hints"]')).toBeVisible();

  // Turning it back on resumes the tour from where it left off (nothing
  // was dismissed, just hidden), not just for this session.
  await page.locator('#toolbar button[title="Show hints"]').click();
  await expect(page.locator('.hint-bubble')).toBeVisible();
});

test('"Show hints again" restarts the tour even if the hints toggle was off', async ({ page }) => {
  await page.locator('.hint-bubble .btn-link', { hasText: 'Skip all' }).click();
  await page.locator('#toolbar button[title="Hide hints"]').click();
  await expect(page.locator('#toolbar button[title="Show hints"]')).toBeVisible();

  await page.locator('#toolbar button[title="Show hints again"]').click();
  await expect(page.locator('.toast-info', { hasText: 'Hints restarted' })).toBeVisible();
  await expect(page.locator('.hint-bubble')).toBeVisible();
  // Restarting implies turning the toggle back on too.
  await expect(page.locator('#toolbar button[title="Hide hints"]')).toBeVisible();
});
