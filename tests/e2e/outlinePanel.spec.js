import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openOutlinePanel(page) {
  await openToolbarGroup(page, 'Tools');
  await page.locator('.toolbar-dropdown-panel button', { hasText: '📋 Outline' }).click();
  await expect(page.locator('#outline-panel.open')).toBeVisible();
}

test('the Outline panel lists every component and connector, grouped and counted', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openOutlinePanel(page);

  await expect(page.locator('.outline-section-toggle').first()).toContainText('Components (2)');
  await expect(page.locator('.outline-item')).toHaveCount(2);
  await expect(page.locator('.outline-item')).toContainText(['API Gateway', 'Redis Cache']);
});

test('typing in the search box filters the list live', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openOutlinePanel(page);

  await page.locator('.outline-search').fill('redis');
  await expect(page.locator('.outline-item')).toHaveCount(1);
  await expect(page.locator('.outline-item')).toContainText('Redis Cache');
});

test('clicking a component row selects it on the canvas', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openOutlinePanel(page);

  await page.locator('.outline-item', { hasText: 'API Gateway' }).click();
  await expect(page.locator('.node.selected')).toHaveCount(1);
});

test('selecting a component on the canvas highlights its row in the Outline panel', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openOutlinePanel(page);

  await page.locator('.node', { hasText: 'Redis Cache' }).click();
  const redisRow = page.locator('.outline-item', { hasText: 'Redis Cache' });
  await expect(redisRow).toHaveClass(/active/);
  await expect(page.locator('.outline-item', { hasText: 'API Gateway' })).not.toHaveClass(/active/);
});

test('collapsing a section hides its rows, and expanding it again shows them', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openOutlinePanel(page);

  await page.locator('.outline-section-toggle', { hasText: 'Components' }).click();
  await expect(page.locator('.outline-item')).toHaveCount(0);

  await page.locator('.outline-section-toggle', { hasText: 'Components' }).click();
  await expect(page.locator('.outline-item')).toHaveCount(1);
});

test('the ✕ button closes the panel', async ({ page }) => {
  await openOutlinePanel(page);
  await page.locator('.outline-close').click();
  await expect(page.locator('#outline-panel.open')).toHaveCount(0);
});
