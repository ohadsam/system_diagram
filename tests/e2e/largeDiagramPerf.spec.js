import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('an off-screen node with an external label is still measured correctly (content-visibility safety)', async ({ page }) => {
  // css/node.css gives .node-body `content-visibility: auto` so the browser
  // can skip rendering an off-screen node's heavy inner content on a large
  // diagram — this test proves that optimization doesn't corrupt bounds
  // measurement for a node whose external label (a sibling, not a
  // descendant, of .node-body) extends outside the node's own box.
  await addComponentByName(page, 'Redis Cache');
  const node = page.locator('.node').first();
  await node.click({ force: true });
  await expect(page.locator('.toolbar-row-context')).toBeVisible();
  await page.locator('.toolbar-row-context .field', { hasText: 'Text position' }).locator('select').selectOption('above');
  await expect(node.locator('.node-external-label')).toHaveClass(/pos-above/);

  // Pan the canvas far away with the Hand tool so the node (and its label)
  // end up well outside the browser's actual visible viewport.
  await page.keyboard.press('h');
  const viewportBox = await page.locator('#canvas-viewport').boundingBox();
  const cx = viewportBox.x + viewportBox.width / 2;
  const cy = viewportBox.y + viewportBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 3000, cy - 3000, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.press('v');

  const offscreenBox = await node.boundingBox();
  expect(offscreenBox.x + offscreenBox.width < 0 || offscreenBox.y + offscreenBox.height < 0).toBe(true);

  await page.locator('button[aria-label="Fit to screen"]').click();

  // If the label's true bounds had been silently treated as zero-size while
  // off-screen, "Fit to Screen" would under-reserve space for it and its
  // top edge would land at/above the viewport's own top (y <= 0, clipped).
  // fitToContent's default 60px padding means a correct fit clears that by
  // a wide margin.
  const labelBox = await node.locator('.node-external-label').boundingBox();
  expect(labelBox.y).toBeGreaterThan(20);
  await expect(node).toBeInViewport();
});
