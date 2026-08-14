import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the "AI Providers & Agents" category is present with a rich set of items', async ({ page }) => {
  const category = page.locator('.sidebar-category', { hasText: 'AI Providers & Agents' });
  await expect(category).toBeVisible();
  await category.locator('.category-header').click();
  const count = await category.locator('.sidebar-item').count();
  expect(count).toBeGreaterThanOrEqual(40);
});

test('an AI provider component can be added to the canvas', async ({ page }) => {
  await page.locator('.sidebar-search input').fill('OpenAI');
  await page.waitForTimeout(150);
  await page.locator('.sidebar-item[data-name="OpenAI"]').click();
  await expect.poll(() => nodeCount(page)).toBe(1);
  await expect(page.locator('.node-label').first()).toHaveText('OpenAI');
});

test('an MCP Server component can be added and styled like any other component', async ({ page }) => {
  await addComponentByName(page, 'MCP Server');
  await expect.poll(() => nodeCount(page)).toBe(1);
  await page.locator('.node').first().click({ force: true });
  await expect(page.locator('.toolbar-row-context')).toBeVisible();
});
