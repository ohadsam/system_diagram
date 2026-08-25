import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('"Share" generates a link, and opening it in a fresh tab loads the same diagram', async ({ page, context }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await addComponentByName(page, 'RabbitMQ');
  await expect.poll(() => nodeCount(page)).toBe(1);

  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Share' }).click();
  await expect(page.locator('.share-link-modal')).toBeVisible();
  const shareUrl = await page.locator('.share-link-input').inputValue();
  expect(shareUrl).toContain('#share=');

  const newPage = await context.newPage();
  await newPage.goto(shareUrl);
  await dismissHints(newPage);
  await expect.poll(() => nodeCount(newPage)).toBe(1);
  await expect(newPage.locator('.node', { hasText: 'RabbitMQ' })).toBeVisible();
  await expect(newPage.locator('.toast-info', { hasText: 'share link' })).toBeVisible();

  // The share hash is stripped after loading, so a reload of the *new* tab
  // doesn't re-import the same project on top of whatever the user does next.
  expect(new URL(newPage.url()).hash).toBe('');
});

test('the "Copy Link" button copies the same URL shown in the field', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await addComponentByName(page, 'RabbitMQ');
  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Share' }).click();
  await expect(page.locator('.share-link-modal')).toBeVisible();
  const shareUrl = await page.locator('.share-link-input').inputValue();

  await page.locator('.share-link-modal button', { hasText: 'Copy Link' }).click();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe(shareUrl);
});
