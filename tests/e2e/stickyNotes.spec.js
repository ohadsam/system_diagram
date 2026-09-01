import { test, expect } from '@playwright/test';
import { dismissHints, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('"🗒️ Add Sticky Note" toolbar button drops a selected, icon-free note at the canvas center', async ({ page }) => {
  await expect.poll(() => nodeCount(page)).toBe(0);
  await page.locator('#toolbar button', { hasText: 'Add Sticky Note' }).click();
  await expect.poll(() => nodeCount(page)).toBe(1);

  const note = page.locator('.node[data-shape="note"]');
  await expect(note).toHaveCount(1);
  await expect(note).toHaveClass(/selected/);
  await expect(note.locator('.node-icon')).toHaveCount(0);
});

test('right-clicking empty canvas and choosing "Add sticky note here" drops a note at that exact point', async ({ page }) => {
  const viewportBox = await page.locator('#canvas-viewport').boundingBox();
  // Playwright's click `position` is relative to the target element, but
  // the app's own click handler reads absolute page coordinates (clientX/Y)
  // — convert so the assertion below compares like with like.
  const clickX = viewportBox.x + 350;
  const clickY = viewportBox.y + 260;
  await page.locator('#canvas-viewport').click({ button: 'right', position: { x: 350, y: 260 } });
  await page.locator('.context-menu-item', { hasText: 'Add sticky note here' }).click();

  const note = page.locator('.node[data-shape="note"]');
  await expect(note).toHaveCount(1);
  const box = await note.boundingBox();
  // The note is centered on the click point, so its bounding box should
  // straddle the click rather than land somewhere unrelated to it.
  expect(box.x).toBeLessThan(clickX);
  expect(box.x + box.width).toBeGreaterThan(clickX);
  expect(box.y).toBeLessThan(clickY);
  expect(box.y + box.height).toBeGreaterThan(clickY);
});

test('a selected sticky note\'s color, font size, rotation and size can all be changed from the style editor', async ({ page }) => {
  await page.locator('#toolbar button', { hasText: 'Add Sticky Note' }).click();
  const note = page.locator('.node[data-shape="note"]');

  const fillField = page.locator('.field').filter({ has: page.locator('.field-label', { hasText: /^Fill$/ }) }).locator('input[type="color"]');
  await fillField.fill('#34D399');
  await expect(note.locator('.node-body')).toHaveCSS('background-color', 'rgb(52, 211, 153)');

  const fontSizeField = page.locator('.field').filter({ has: page.locator('.field-label', { hasText: /^Font size$/ }) }).locator('input');
  await fontSizeField.fill('22');
  await fontSizeField.blur();
  await expect(note.locator('.node-body')).toHaveCSS('font-size', '22px');

  // A quick-added sticky note gets a small randomized tilt by design (see
  // canvas.js#addStickyNote), so its Rotation field's starting value isn't
  // asserted here — just that setting an explicit value takes effect.
  const rotationField = page.locator('.field').filter({ has: page.locator('.field-label', { hasText: /^Rotation$/ }) }).locator('input');
  await rotationField.fill('20');
  await rotationField.blur();
  await expect(note.locator('.node-body')).toHaveCSS('transform', /matrix/);

  const widthField = page.locator('.field').filter({ has: page.locator('.field-label', { hasText: /^Width$/ }) }).locator('input');
  const heightField = page.locator('.field').filter({ has: page.locator('.field-label', { hasText: /^Height$/ }) }).locator('input');
  await widthField.fill('300');
  await widthField.blur();
  await heightField.fill('200');
  await heightField.blur();
  await expect(note).toHaveCSS('width', '300px');
  await expect(note).toHaveCSS('height', '200px');
});

test('rotation also works on a plain (non-note) shape, and resetting it to 0 removes the transform override', async ({ page }) => {
  await page.locator('#toolbar button', { hasText: 'Add Shape' }).click();
  await page.locator('.shape-card[title="Rectangle"]').click();
  const rect = page.locator('.node[data-shape="rect"]');
  await expect(rect).toHaveCount(1);
  // `rotate(var(--node-rotation, 0deg))` is always an active transform
  // function, so the computed style is the identity matrix rather than the
  // literal keyword "none" even at the default 0deg — see css/node.css.
  const identityMatrix = 'matrix(1, 0, 0, 1, 0, 0)';
  await expect(rect.locator('.node-body')).toHaveCSS('transform', identityMatrix);

  const rotationField = page.locator('.field').filter({ has: page.locator('.field-label', { hasText: /^Rotation$/ }) }).locator('input');
  await rotationField.fill('45');
  await rotationField.blur();
  const tiltedTransform = await rect.locator('.node-body').evaluate((el) => getComputedStyle(el).transform);
  expect(tiltedTransform).not.toBe(identityMatrix);

  await rotationField.fill('0');
  await rotationField.blur();
  await expect(rect.locator('.node-body')).toHaveCSS('transform', identityMatrix);
});
