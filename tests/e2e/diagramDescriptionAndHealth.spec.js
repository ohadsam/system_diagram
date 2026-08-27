import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('Describe Diagram shows an instant offline plain-text summary, copyable', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Describe Diagram' }).click();
  await expect(page.locator('.diagram-description-modal')).toBeVisible();
  const text = await page.locator('.diagram-description-text').inputValue();
  expect(text).toMatch(/1 component/);
  await expect(page.locator('.diagram-description-modal button', { hasText: '📋 Copy' })).toBeVisible();
});

test('Check Diagram shows a health-score badge', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Check Diagram' }).click();
  await expect(page.locator('.diagram-lint-modal')).toBeVisible();
  await expect(page.locator('.diagram-health-badge')).toBeVisible();
  await expect(page.locator('.diagram-health-badge')).toContainText('Health score:');
});
