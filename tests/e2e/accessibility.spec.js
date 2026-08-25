import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('arrow keys nudge the selected component by 1px, Shift+Arrow by 10px', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  const node = page.locator('.node').first();
  await node.click();
  const before = await node.boundingBox();

  await page.keyboard.press('ArrowRight');
  let after = await node.boundingBox();
  expect(after.x).toBeCloseTo(before.x + 1, 0);

  await page.keyboard.press('Shift+ArrowDown');
  after = await node.boundingBox();
  expect(after.y).toBeCloseTo(before.y + 10, 0);
});

test('arrow keys do nothing when nothing is selected or while typing in a field', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  const node = page.locator('.node').first();
  const before = await node.boundingBox();

  // Nothing selected — deselect first.
  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 20 } });
  await page.keyboard.press('ArrowRight');
  let after = await node.boundingBox();
  expect(after.x).toBeCloseTo(before.x, 0);

  // Selected, but focus is in a text field (the sidebar search box) — must
  // not hijack normal text-field arrow-key cursor movement.
  await node.click();
  await page.locator('.sidebar-search input').fill('a');
  await page.keyboard.press('ArrowRight');
  after = await node.boundingBox();
  expect(after.x).toBeCloseTo(before.x, 0);
});

test('icon-only toolbar controls expose a real accessible name (undo/redo/zoom)', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fit to screen', exact: true })).toBeVisible();
});

test('the command palette search input keeps a visible focus indicator (not suppressed)', async ({ page }) => {
  await page.keyboard.press('Control+k');
  const input = page.locator('.command-palette-input');
  await expect(input).toBeFocused();
  const outline = await input.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});
