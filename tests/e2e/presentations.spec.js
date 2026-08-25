import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function saveVersion(page, name) {
  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Version History' }).click();
  await expect(page.locator('.version-history-modal')).toBeVisible();
  await page.locator('.version-history-modal button', { hasText: '📸 Save Version' }).click();
  await page.locator('.prompt-modal input[type=text]').fill(name);
  await page.locator('.prompt-modal button[type=submit]').click();
  await page.locator('.version-history-modal .modal-close').click();
}

async function openPresentations(page) {
  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Presentations' }).click();
  await expect(page.locator('.presentations-modal')).toBeVisible();
}

test('building a presentation from two saved versions lists both as ordered slides', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await saveVersion(page, 'Draft 1');
  await addComponentByName(page, 'Nginx');
  await saveVersion(page, 'Draft 2');

  await openPresentations(page);
  await page.locator('.presentations-modal button', { hasText: '+ New Presentation' }).click();
  await page.locator('.presentations-available-row', { hasText: 'Draft 1' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.presentations-available-row', { hasText: 'Draft 2' }).locator('button', { hasText: '+ Add' }).click();

  const slides = page.locator('.presentations-slide-row');
  await expect(slides).toHaveCount(2);
  await expect(slides.nth(0).locator('input')).toHaveValue('Draft 1');
  await expect(slides.nth(1).locator('input')).toHaveValue('Draft 2');

  await page.locator('.presentations-modal button', { hasText: 'Save Presentation' }).click();
  await expect(page.locator('.presentations-row', { hasText: 'Presentation 1' })).toBeVisible();
  await expect(page.locator('.presentations-row', { hasText: 'Presentation 1' })).toContainText('2 slide(s)');
});

test('moving a slide up in the builder swaps its order', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await saveVersion(page, 'Draft 1');
  await addComponentByName(page, 'Nginx');
  await saveVersion(page, 'Draft 2');

  await openPresentations(page);
  await page.locator('.presentations-modal button', { hasText: '+ New Presentation' }).click();
  await page.locator('.presentations-available-row', { hasText: 'Draft 1' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.presentations-available-row', { hasText: 'Draft 2' }).locator('button', { hasText: '+ Add' }).click();

  await page.locator('.presentations-slide-row').nth(1).locator('button[title="Move up"]').click();

  const slides = page.locator('.presentations-slide-row');
  await expect(slides.nth(0).locator('input')).toHaveValue('Draft 2');
  await expect(slides.nth(1).locator('input')).toHaveValue('Draft 1');
});

test('playing a presentation shows the first slide, and Next/Previous navigate between slides', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await saveVersion(page, 'Draft 1');
  await addComponentByName(page, 'Nginx');
  await saveVersion(page, 'Draft 2');

  await openPresentations(page);
  await page.locator('.presentations-modal button', { hasText: '+ New Presentation' }).click();
  await page.locator('.presentations-available-row', { hasText: 'Draft 1' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.presentations-available-row', { hasText: 'Draft 2' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.presentations-modal button', { hasText: 'Save Presentation' }).click();

  await page.locator('.presentations-row').first().locator('button', { hasText: '▶️ Play' }).click();
  await expect(page.locator('.presentation-player-modal')).toBeVisible();
  await expect(page.locator('.presentation-player-progress')).toHaveText('1 / 2', { timeout: 10000 });
  await expect(page.locator('.presentation-player-title')).toHaveText('Draft 1');
  await expect(page.locator('.presentation-player-image')).toBeVisible();

  await page.locator('.presentation-player-nav button', { hasText: 'Next' }).click();
  await expect(page.locator('.presentation-player-progress')).toHaveText('2 / 2');
  await expect(page.locator('.presentation-player-title')).toHaveText('Draft 2');

  await page.locator('.presentation-player-nav button', { hasText: 'Previous' }).click();
  await expect(page.locator('.presentation-player-progress')).toHaveText('1 / 2');
});

test('deleting a presentation removes it from the list', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await saveVersion(page, 'Draft 1');

  await openPresentations(page);
  await page.locator('.presentations-modal button', { hasText: '+ New Presentation' }).click();
  await page.locator('.presentations-available-row', { hasText: 'Draft 1' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.presentations-modal button', { hasText: 'Save Presentation' }).click();
  await expect(page.locator('.presentations-row')).toHaveCount(1);

  await page.locator('.presentations-row').first().locator('button', { hasText: '🗑️ Delete' }).click();
  await page.locator('.confirm-modal button.btn-danger', { hasText: 'Delete' }).click();
  await expect(page.locator('.presentations-row')).toHaveCount(0);
});

test('exporting a presentation to PPTX downloads a .pptx file', async ({ page }) => {
  test.setTimeout(30000);
  await addComponentByName(page, 'RabbitMQ');
  await saveVersion(page, 'Draft 1');

  await openPresentations(page);
  await page.locator('.presentations-modal button', { hasText: '+ New Presentation' }).click();
  await page.locator('.presentations-available-row', { hasText: 'Draft 1' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.presentations-modal button', { hasText: 'Save Presentation' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('.presentations-row').first().locator('button', { hasText: '🎬 Export PPTX' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pptx$/);
  const path = await download.path();
  expect(path).toBeTruthy();
});
