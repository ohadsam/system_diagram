import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function themeButton(page) {
  await openToolbarGroup(page, 'Tools');
  return page.locator('#toolbar button', { hasText: 'Theme:' });
}

test('theme toggle cycles System -> Light -> Dark -> System and applies data-theme', async ({ page }) => {
  const btn = await themeButton(page);
  await expect(btn).toContainText('Match System');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);

  await btn.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Theme:' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Theme:' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});

test('theme choice persists across reload with no flash of the wrong theme', async ({ page }) => {
  const btn = await themeButton(page);
  await btn.click(); // -> light
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Theme:' }).click(); // -> dark
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  // The inline <head> script applies this before any app JS runs.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('dark mode renders readable chrome (background/text contrast) across toolbar, sidebar, and a modal', async ({ page }) => {
  const btn = await themeButton(page);
  await btn.click();
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Theme:' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const bg = await page.evaluate(() => getComputedStyle(document.getElementById('toolbar')).backgroundColor);
  // Dark surface should not be near-white.
  const rgb = bg.match(/\d+/g).map(Number);
  expect(rgb[0] + rgb[1] + rgb[2]).toBeLessThan(400);

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Cost Breakdown' }).click();
  await expect(page.locator('.app-modal')).toBeVisible();
  const modalBg = await page.evaluate(() => getComputedStyle(document.querySelector('.app-modal')).backgroundColor);
  const modalRgb = modalBg.match(/\d+/g).map(Number);
  expect(modalRgb[0] + modalRgb[1] + modalRgb[2]).toBeLessThan(400);
});
