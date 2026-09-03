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

test('searching a literal product name surfaces the category that matches by name ahead of one that only mentions it in a description', async ({ page }) => {
  // AWS ElastiCache's own description ("a managed Redis or Memcached
  // store") matches the query too, and its category ("AWS") sorts
  // alphabetically before "Databases"/"Cache" — without ranking name
  // matches first, that unrelated-by-name AWS category would render (and
  // get auto-added by a first-match-wins helper) ahead of the real "Redis"
  // component the user actually typed.
  await page.locator('.sidebar-search input').fill('Redis');
  const firstCategoryLabel = await page.locator('.sidebar-category .category-label').first().textContent();
  expect(firstCategoryLabel).not.toMatch(/^AWS$/);
  await expect(page.locator('.sidebar-item[data-name="Redis"]')).toBeVisible();
});

test('searching an exact component name surfaces it ahead of an unrelated component whose name merely contains the same word', async ({ page }) => {
  // "IoT Device" (Client & Frontend) also matches by name — its category
  // label just happens to sort alphabetically before "UML Deployment" — so
  // without ranking an exact match above a mere substring match, clicking
  // the very first search result for "Device" would grab the wrong thing.
  await page.locator('.sidebar-search input').fill('Device');
  await expect(page.locator('.sidebar-item').first()).toHaveAttribute('data-name', 'Device');
});

test('searching an exact component name surfaces it ahead of an alphabetically-earlier component in the same category whose name merely contains the same letters', async ({ page }) => {
  // "Preact" (Frontend Frameworks) sorts before "React" alphabetically and
  // also technically contains "react" as a substring — without ranking
  // within a category (not just across categories), clicking the very
  // first search result for "React" would add the wrong framework.
  await page.locator('.sidebar-search input').fill('React');
  await expect(page.locator('.sidebar-item').first()).toHaveAttribute('data-name', 'React');
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
