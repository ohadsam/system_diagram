import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('"Add comment here" drops a pin and opens its editor; typing a note persists across reload', async ({ page }) => {
  await page.locator('#canvas-viewport').click({ button: 'right', position: { x: 300, y: 200 } });
  await page.locator('.context-menu-item', { hasText: 'Add comment here' }).click();

  await expect(page.locator('.comment-modal')).toBeVisible();
  await expect(page.locator('.comment-pin')).toHaveCount(1);

  const textarea = page.locator('.comment-modal-text');
  await textarea.fill('Double-check this region handles retries.');
  await page.locator('.comment-modal button', { hasText: 'Done' }).click();
  await expect(page.locator('.comment-modal')).toHaveCount(0);

  await expect(page.locator('.comment-pin')).toHaveAttribute('title', 'Double-check this region handles retries.');

  await page.waitForTimeout(700); // autosave is debounced ~500ms
  await page.reload();
  await dismissHints(page);
  await expect(page.locator('.comment-pin')).toHaveCount(1);
  await expect(page.locator('.comment-pin')).toHaveAttribute('title', 'Double-check this region handles retries.');
});

test('clicking an existing pin reopens its editor with the saved note, and "Mark as resolved" changes its appearance', async ({ page }) => {
  await page.locator('#canvas-viewport').click({ button: 'right', position: { x: 300, y: 200 } });
  await page.locator('.context-menu-item', { hasText: 'Add comment here' }).click();
  await page.locator('.comment-modal-text').fill('Needs review');
  await page.locator('.comment-modal button', { hasText: 'Done' }).click();

  await page.locator('.comment-pin').click();
  await expect(page.locator('.comment-modal-text')).toHaveValue('Needs review');

  await page.locator('.comment-modal .field-checkbox input').check();
  await page.locator('.comment-modal button', { hasText: 'Done' }).click();
  await expect(page.locator('.comment-pin')).toHaveClass(/resolved/);
});

test('deleting a comment removes its pin, and undo brings it back', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await page.locator('#canvas-viewport').click({ button: 'right', position: { x: 300, y: 400 } });
  await page.locator('.context-menu-item', { hasText: 'Add comment here' }).click();
  await page.locator('.comment-modal button', { hasText: 'Done' }).click();
  await expect(page.locator('.comment-pin')).toHaveCount(1);

  await page.locator('.comment-pin').click();
  await page.locator('.comment-modal button', { hasText: 'Delete' }).click();
  await page.locator('.confirm-modal button', { hasText: 'Delete' }).click();
  await expect(page.locator('.comment-pin')).toHaveCount(0);

  await page.keyboard.press('Control+z');
  await expect(page.locator('.comment-pin')).toHaveCount(1);
});

test('"Fit to screen" includes a comment pin in its bounds, even on an otherwise-empty canvas', async ({ page }) => {
  // No components at all — getContentBounds must not require a node to
  // exist in order to frame a comment (see canvas.js#getContentBounds).
  await page.locator('#canvas-viewport').click({ button: 'right', position: { x: 700, y: 450 } });
  await page.locator('.context-menu-item', { hasText: 'Add comment here' }).click();
  await page.locator('.comment-modal button', { hasText: 'Done' }).click();

  await page.locator('#canvas-viewport').click({ button: 'right', position: { x: 40, y: 40 } });
  await page.locator('.context-menu-item', { hasText: 'Fit to screen' }).click();

  const box = await page.locator('.comment-pin').boundingBox();
  const viewportBox = await page.locator('#canvas-viewport').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(viewportBox.x);
  expect(box.y).toBeGreaterThanOrEqual(viewportBox.y);
  expect(box.x + box.width).toBeLessThanOrEqual(viewportBox.x + viewportBox.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height);
});
