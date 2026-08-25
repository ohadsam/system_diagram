import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

function recentSection(page) {
  return page.locator('.sidebar-category', { hasText: 'Recently Used' }).first();
}

async function expandRecent(page) {
  // addComponentByName leaves the sidebar search filled in (deliberately, so
  // it doesn't steal focus from the just-created node) — clear it first so
  // the Recently Used section isn't narrowed down to just the last query.
  await page.locator('.sidebar-search input').fill('');
  const section = recentSection(page);
  await section.locator('.category-toggle').click();
  return section;
}

test('placing a component adds it to the "Recently Used" sidebar section', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  const section = await expandRecent(page);
  await expect(section.locator('.sidebar-item', { hasText: 'RabbitMQ' })).toBeVisible();
});

test('the most recently placed component appears first', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await addComponentByName(page, 'Nginx');
  const section = await expandRecent(page);
  const names = await section.locator('.sidebar-item .item-name').allTextContents();
  expect(names[0]).toBe('Nginx');
  expect(names[1]).toBe('RabbitMQ');
});

test('re-placing an already-recent component moves it to the front instead of duplicating it', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await addComponentByName(page, 'Nginx');
  await addComponentByName(page, 'RabbitMQ');
  const section = await expandRecent(page);
  const names = await section.locator('.sidebar-item .item-name').allTextContents();
  expect(names).toEqual(['RabbitMQ', 'Nginx']);
});

test('a recently-used item is still clickable to add another instance to the canvas', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  const section = await expandRecent(page);
  await section.locator('.sidebar-item', { hasText: 'RabbitMQ' }).click();
  await expect.poll(() => page.locator('.node').count()).toBe(2);
});
