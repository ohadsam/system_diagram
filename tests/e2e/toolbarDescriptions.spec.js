import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('"Show Descriptions" is off by default — dropdown buttons show no inline description', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  const autoArrangeBtn = page.locator('#toolbar button', { hasText: 'Auto-arrange' });
  await expect(autoArrangeBtn).toBeVisible();
  await expect(autoArrangeBtn.locator('.toolbar-dropdown-btn-desc')).toHaveCount(0);
});

test('toggling "Show Descriptions" on renders each button\'s tooltip inline, and off removes it again', async ({ page }) => {
  const descToggle = page.locator('#toolbar button[title^="Show Action Descriptions"]');
  await descToggle.click();
  await expect(descToggle).toHaveClass(/active/);

  await openToolbarGroup(page, 'Tools');
  const autoArrangeBtn = page.locator('#toolbar button', { hasText: 'Auto-arrange' });
  const desc = autoArrangeBtn.locator('.toolbar-dropdown-btn-desc');
  await expect(desc).toHaveCount(1);
  await expect(desc).toHaveText(await autoArrangeBtn.getAttribute('title'));

  await descToggle.click();
  await expect(descToggle).not.toHaveClass(/active/);
  await expect(autoArrangeBtn.locator('.toolbar-dropdown-btn-desc')).toHaveCount(0);
});

test('a dropdown button with its own child elements (the "Check Diagram" nudge badge) still shows correctly with descriptions on', async ({ page }) => {
  await page.locator('#toolbar button[title^="Show Action Descriptions"]').click();
  await openToolbarGroup(page, 'Tools');
  const checkDiagramBtn = page.locator('#toolbar button', { hasText: '🔍 Check Diagram' });
  await expect(checkDiagramBtn).toContainText('Check Diagram');
  await expect(checkDiagramBtn.locator('.toolbar-dropdown-btn-desc')).toHaveCount(1);
});

test('the preference persists across a reload', async ({ page }) => {
  await page.locator('#toolbar button[title^="Show Action Descriptions"]').click();
  await page.reload();
  await dismissHints(page);
  await expect(page.locator('#toolbar button[title^="Show Action Descriptions"]')).toHaveClass(/active/);
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('#toolbar button', { hasText: 'Auto-arrange' }).locator('.toolbar-dropdown-btn-desc')).toHaveCount(1);
});
