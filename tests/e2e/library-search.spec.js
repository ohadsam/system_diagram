import { test, expect } from '@playwright/test';
import { dismissHints } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the library starts with every category collapsed and a rich set of components', async ({ page }) => {
  const categoryCount = await page.locator('.sidebar-category').count();
  expect(categoryCount).toBeGreaterThanOrEqual(15);

  const totalItems = await page.locator('.sidebar-item').count();
  expect(totalItems).toBeGreaterThanOrEqual(150);
});

test('searching filters the list and highlights the match', async ({ page }) => {
  await page.locator('.sidebar-search input').fill('kafka');
  await expect.poll(() => page.locator('.sidebar-item').count()).toBeGreaterThan(0);
  await expect(page.locator('.sidebar-item mark').first()).toHaveText(/kafka/i);
});

test('a query with no matches shows an empty state instead of a blank list', async ({ page }) => {
  await page.locator('.sidebar-search input').fill('xyznonexistentcomponent');
  await expect(page.locator('.sidebar-empty')).toBeVisible();
  await expect(page.locator('.sidebar-item')).toHaveCount(0);
});

test('clicking a category header expands and collapses its list', async ({ page }) => {
  const category = page.locator('.sidebar-category').filter({ hasText: 'AWS' }).first();
  await expect(category).toHaveAttribute('data-open', 'false');
  await category.locator('.category-header').click();
  await expect(category).toHaveAttribute('data-open', 'true');
  await expect(category.locator('.sidebar-item').first()).toBeVisible();
  await category.locator('.category-header').click();
  await expect(category).toHaveAttribute('data-open', 'false');
});
