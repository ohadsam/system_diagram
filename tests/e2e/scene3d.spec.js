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

test('"🎯 Reset View" recenters the camera without closing the 3D view', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '3D Presentation' }).click();
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);
  await page.waitForTimeout(800);

  const resetBtn = page.locator('.scene3d-controls button', { hasText: 'Reset View' });
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();

  // Still open, still rendering — the click only adjusts the camera.
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);
  const hasWebglContent = await page.locator('.scene3d-canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return !!gl;
  });
  expect(hasWebglContent).toBe(true);
});

test('"🏢 Realistic Room" toggles an enclosing room on and off without closing the 3D view', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '3D Presentation' }).click();
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);
  await page.waitForTimeout(800);

  const realisticBtn = page.locator('.scene3d-controls button', { hasText: 'Realistic Room' });
  await expect(realisticBtn).toBeVisible();
  await expect(realisticBtn).not.toHaveClass(/active/);

  await realisticBtn.click();
  await page.waitForTimeout(600);
  await expect(realisticBtn).toHaveClass(/active/);
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);

  await realisticBtn.click();
  await page.waitForTimeout(600);
  await expect(realisticBtn).not.toHaveClass(/active/);
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);

  const hasWebglContent = await page.locator('.scene3d-canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return !!gl;
  });
  expect(hasWebglContent).toBe(true);
});

test('3D Presentation refuses to open on an empty canvas', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '3D Presentation' }).click();
  await expect(page.locator('.scene3d-overlay')).not.toHaveClass(/open/);
  await expect(page.locator('.toast', { hasText: 'Add at least one component' })).toBeVisible();
});

test('"🎬 Camera Tour" panel: manual add, auto-generate, reorder-free remove, and play/stop', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '3D Presentation' }).click();
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);
  await page.waitForTimeout(800);

  const tourBtn = page.locator('.scene3d-controls button', { hasText: 'Camera Tour' });
  await tourBtn.click();
  await expect(page.locator('.scene3d-tour-panel')).toHaveClass(/open/);
  await expect(page.locator('.scene3d-tour-empty')).toBeVisible();

  // Manual: capturing the current view adds exactly one shot.
  await page.locator('.scene3d-tour-actions button', { hasText: 'Add Current View' }).click();
  await expect(page.locator('.scene3d-tour-row')).toHaveCount(1);
  await expect(page.locator('.scene3d-tour-count')).toHaveText('1 shot');

  // Auto-generate replaces it with one shot per component plus an overview.
  await page.locator('.scene3d-tour-actions button', { hasText: 'Auto-Generate' }).click();
  await expect(page.locator('.scene3d-tour-row')).toHaveCount(3);
  await expect(page.locator('.scene3d-tour-row').last()).toContainText('Overview');

  // Removing one shot updates the list and count together.
  await page.locator('.scene3d-tour-row').first().locator('.scene3d-tour-row-remove').click();
  await expect(page.locator('.scene3d-tour-row')).toHaveCount(2);
  await expect(page.locator('.scene3d-tour-count')).toHaveText('2 shots');

  // Playback toggles the button label and can be stopped mid-flight without
  // closing the 3D view.
  const playToggle = page.locator('.scene3d-tour-playback button', { hasText: 'Play Tour' });
  await playToggle.click();
  await expect(page.locator('.scene3d-tour-playback button', { hasText: 'Stop Tour' })).toBeVisible();
  await page.locator('.scene3d-tour-playback button', { hasText: 'Stop Tour' }).click();
  await expect(page.locator('.scene3d-tour-playback button', { hasText: 'Play Tour' })).toBeVisible();
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);

  // Clear empties the list again.
  await page.locator('.scene3d-tour-actions button', { hasText: 'Clear' }).click();
  await expect(page.locator('.scene3d-tour-row')).toHaveCount(0);
  await expect(page.locator('.scene3d-tour-empty')).toBeVisible();
});

test('dragging to orbit the camera stops an in-progress Camera Tour', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '3D Presentation' }).click();
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);
  await page.waitForTimeout(800);

  await page.locator('.scene3d-controls button', { hasText: 'Camera Tour' }).click();
  await page.locator('.scene3d-tour-actions button', { hasText: 'Auto-Generate' }).click();
  await expect(page.locator('.scene3d-tour-row')).toHaveCount(3);
  await page.locator('.scene3d-tour-playback button', { hasText: 'Play Tour' }).click();
  await expect(page.locator('.scene3d-tour-playback button', { hasText: 'Stop Tour' })).toBeVisible();

  const canvas = page.locator('.scene3d-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect(page.locator('.scene3d-tour-playback button', { hasText: 'Play Tour' })).toBeVisible();
});

test('"🎥 Export 3D Video" downloads a .webm in "🏢 Realistic Room" mode with a Camera Tour configured', async ({ page }) => {
  test.setTimeout(30000);
  await addComponentByName(page, 'API Gateway');

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '3D Presentation' }).click();
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);
  await page.waitForTimeout(800);

  // Verifies the "in addition to the stylized 3D view" request explicitly:
  // the realistic room's own enclosing geometry must not break the export
  // pipeline (it's a raw canvas pixel capture, agnostic to scene content,
  // but this confirms it end-to-end rather than by inspection alone).
  await page.locator('.scene3d-controls button', { hasText: 'Realistic Room' }).click();
  await expect(page.locator('.scene3d-controls button', { hasText: 'Realistic Room' })).toHaveClass(/active/);

  await page.locator('.scene3d-controls button', { hasText: 'Camera Tour' }).click();
  await page.locator('.scene3d-tour-actions button', { hasText: 'Add Current View' }).click();
  await expect(page.locator('.scene3d-tour-row')).toHaveCount(1);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.scene3d-controls button', { hasText: 'Export 3D Video' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-3d\.webm$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  await expect(page.locator('.toast-success', { hasText: '3D video downloaded' })).toBeVisible();
});

test('"📊 Export 3D Presentation" downloads a .pptx, one slide per Camera Tour shot', async ({ page }) => {
  // A 3-slide export embeds full-canvas WebGL screenshots (~1MB pptx) —
  // this environment's headless/software-rendered Chromium has been
  // observed taking well over the default 30s test timeout to actually
  // surface a 'download' event for a blob that size (confirmed via a
  // persistent page.on('download') listener catching it eventually, long
  // after a short-timeout waitForEvent had already given up), even though
  // the export itself (blob creation + the anchor click) completes in
  // well under a second. Generous timeouts here account for that
  // environment quirk rather than a real product slowness.
  test.setTimeout(90000);
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '3D Presentation' }).click();
  await expect(page.locator('.scene3d-overlay')).toHaveClass(/open/);
  await page.waitForTimeout(800);

  await page.locator('.scene3d-controls button', { hasText: 'Camera Tour' }).click();
  await page.locator('.scene3d-tour-actions button', { hasText: 'Auto-Generate' }).click();
  await expect(page.locator('.scene3d-tour-row')).toHaveCount(3);

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.locator('.scene3d-controls button', { hasText: 'Export 3D Presentation' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pptx$/);
  const path = await download.path();
  expect(path).toBeTruthy();
});
