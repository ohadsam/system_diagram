import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('3D Presentation opens a full-viewport 3D canvas with playback/export controls, and closes cleanly', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '3D Presentation' }).click();
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);
  await expect(page.locator('.scene3d-canvas')).toBeVisible();
  await expect(page.locator('.scene3d-controls button', { hasText: 'Export 3D Video' })).toBeVisible();

  // Give the vendored Three.js module + first render loop pass a moment.
  await page.waitForTimeout(800);
  const hasWebglContent = await page.locator('.scene3d-canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return !!gl;
  });
  expect(hasWebglContent).toBe(true);

  await page.locator('.scene3d-close').click();
  await expect(page.locator('.scene3d-overlay')).not.toHaveClass(/open/);
});

test('3D Presentation refuses to open on an empty canvas', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '3D Presentation' }).click();
  await expect(page.locator('.scene3d-overlay')).not.toHaveClass(/open/);
  await expect(page.locator('.toast', { hasText: 'Add at least one component' })).toBeVisible();
});
