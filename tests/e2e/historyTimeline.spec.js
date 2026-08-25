import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('"Undo History" lists each step with an auto-generated label, and the last one is marked "You are here"', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Load Balancer');

  await openToolbarGroup(page, 'File');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Undo History' }).click();

  const rows = page.locator('.history-timeline-row');
  await expect(rows).toHaveCount(3); // Start, +API Gateway, +Load Balancer
  await expect(rows.last()).toHaveClass(/current/);
  await expect(rows.last()).toContainText('You are here');
  await expect(rows.nth(1)).toContainText('Added');
});

test('clicking an earlier entry jumps straight to it, restoring that point in history', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Load Balancer');
  await addComponentByName(page, 'Redis Cache');
  await expect(page.locator('.node')).toHaveCount(3);

  await openToolbarGroup(page, 'File');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Undo History' }).click();
  await page.locator('.history-timeline-row').nth(1).click(); // back to just "API Gateway"

  await expect(page.locator('.history-timeline-modal')).toHaveCount(0);
  await expect(page.locator('.node')).toHaveCount(1);

  // Redo is available again after a jump into the past, same as a normal undo.
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('.node')).toHaveCount(2);
});
