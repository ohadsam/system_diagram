import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('undo removes the last added node, redo brings it back', async ({ page }) => {
  await addComponentByName(page, 'Grafana');
  await expect.poll(() => nodeCount(page)).toBe(1);

  await page.keyboard.press('Control+z');
  await expect.poll(() => nodeCount(page)).toBe(0);

  await page.keyboard.press('Control+Shift+z');
  await expect.poll(() => nodeCount(page)).toBe(1);
});

test('undo/redo buttons are disabled/enabled appropriately', async ({ page }) => {
  const undoBtn = page.locator('#toolbar button[title*="Undo"]');
  const redoBtn = page.locator('#toolbar button[title*="Redo"]');
  await expect(undoBtn).toBeDisabled();
  await expect(redoBtn).toBeDisabled();

  await addComponentByName(page, 'Jenkins');
  await expect(undoBtn).toBeEnabled();
  await expect(redoBtn).toBeDisabled();

  await undoBtn.click();
  await expect(redoBtn).toBeEnabled();
});

test('a new action after undo clears the redo stack', async ({ page }) => {
  await addComponentByName(page, 'Prometheus');
  await page.keyboard.press('Control+z');
  await expect.poll(() => nodeCount(page)).toBe(0);

  await addComponentByName(page, 'Grafana');
  const redoBtn = page.locator('#toolbar button[title*="Redo"]');
  await expect(redoBtn).toBeDisabled();
});

test('a full node drag is a single undo step (not one step per pointer-move frame)', async ({ page }) => {
  await addComponentByName(page, 'MongoDB');
  const node = page.locator('.node').first();
  const before = await node.boundingBox();

  await node.hover();
  await page.mouse.down();
  await page.mouse.move(before.x + 150, before.y + 120, { steps: 8 });
  await page.mouse.up();

  const afterDrag = await node.boundingBox();
  expect(Math.abs(afterDrag.x - before.x)).toBeGreaterThan(50);

  // One undo should revert the whole drag gesture, not just the last frame of it.
  await page.keyboard.press('Control+z');
  await expect.poll(() => nodeCount(page)).toBe(1, 'the node itself must still exist after undoing only the move');
  const afterUndo = await node.boundingBox();
  expect(Math.abs(afterUndo.x - before.x)).toBeLessThan(5);

  // A second undo removes the node itself (the creation step).
  await page.keyboard.press('Control+z');
  await expect.poll(() => nodeCount(page)).toBe(0);
});
