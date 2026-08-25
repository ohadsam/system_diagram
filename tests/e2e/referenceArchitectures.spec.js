import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, edgeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the sidebar lists all 5 "Design:" reference architecture templates', async ({ page }) => {
  await page.locator('.sidebar-search input').fill('Design:');
  await page.waitForTimeout(150);
  await expect(page.locator('.sidebar-item')).toHaveCount(5);
  const names = await page.locator('.sidebar-item').allTextContents();
  expect(names.join(' ')).toContain('URL Shortener');
  expect(names.join(' ')).toContain('Chat Application');
  expect(names.join(' ')).toContain('Rate Limiter Service');
  expect(names.join(' ')).toContain('Social Media Feed');
  expect(names.join(' ')).toContain('Ride-Sharing Dispatch');
});

test('instantiating "Design: URL Shortener" creates a full connected, grouped cluster', async ({ page }) => {
  await addComponentByName(page, 'Design: URL Shortener');
  await expect.poll(() => nodeCount(page)).toBe(7);
  await expect.poll(() => edgeCount(page)).toBe(7);
  await expect(page.locator('.group-bg-label')).toHaveText('7 grouped');
  const labels = await page.locator('.node-label').allTextContents();
  expect(labels).toEqual(expect.arrayContaining(['Shortener API', 'ID Generator', 'URL Mappings DB']));
});

test('undoing a reference architecture instantiation removes the whole cluster in one step', async ({ page }) => {
  await addComponentByName(page, 'Design: Rate Limiter Service');
  await expect.poll(() => nodeCount(page)).toBe(6);
  await page.locator('#canvas-viewport').click({ position: { x: 40, y: 40 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => nodeCount(page)).toBe(0);
});
