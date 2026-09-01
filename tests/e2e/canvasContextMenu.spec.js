import { test, expect } from '@playwright/test';
import { dismissHints, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function rightClickCanvas(page, x = 350, y = 260) {
  await page.locator('#canvas-viewport').click({ button: 'right', position: { x, y } });
}

test('canvas right-click menu opens the Command Palette', async ({ page }) => {
  await rightClickCanvas(page);
  await page.locator('.context-menu-item', { hasText: 'Command Palette' }).click();
  await expect(page.locator('.command-palette-modal')).toBeVisible();
});

test('canvas right-click menu Undo/Redo act on real history and disable when nothing to do', async ({ page }) => {
  await rightClickCanvas(page);
  const undoItem = page.locator('.context-menu-item', { hasText: 'Undo' });
  const redoItem = page.locator('.context-menu-item', { hasText: 'Redo' });
  await expect(undoItem).toBeDisabled();
  await expect(redoItem).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.locator('#toolbar button', { hasText: 'Add Sticky Note' }).click();
  await expect.poll(() => nodeCount(page)).toBe(1);

  await rightClickCanvas(page);
  await expect(page.locator('.context-menu-item', { hasText: 'Undo' })).toBeEnabled();
  await page.locator('.context-menu-item', { hasText: 'Undo' }).click();
  await expect.poll(() => nodeCount(page)).toBe(0);

  await rightClickCanvas(page);
  await expect(page.locator('.context-menu-item', { hasText: 'Redo' })).toBeEnabled();
  await page.locator('.context-menu-item', { hasText: 'Redo' }).click();
  await expect.poll(() => nodeCount(page)).toBe(1);
});

test('canvas right-click menu opens Check Diagram', async ({ page }) => {
  await rightClickCanvas(page);
  await page.locator('.context-menu-item', { hasText: 'Check Diagram' }).click();
  await expect(page.locator('.diagram-lint-modal')).toBeVisible();
});

test('canvas right-click menu opens AI Design Review', async ({ page }) => {
  await rightClickCanvas(page);
  await page.locator('.context-menu-item', { hasText: 'AI Design Review' }).click();
  await expect(page.locator('.ai-review-panel')).toHaveClass(/open/);
});

test('canvas right-click menu Auto-arrange runs without error', async ({ page }) => {
  await page.locator('#toolbar button', { hasText: 'Add Sticky Note' }).click();
  await page.locator('#toolbar button', { hasText: 'Add Sticky Note' }).click();
  await expect.poll(() => nodeCount(page)).toBe(2);

  await rightClickCanvas(page);
  await page.locator('.context-menu-item', { hasText: 'Auto-arrange' }).click();
  await expect.poll(() => nodeCount(page)).toBe(2);
});
