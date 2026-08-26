import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, connectNodes, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openAnimationPanel(page) {
  await openToolbarGroup(page, 'Tools');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Diagram Animation' }).click();
  await expect(page.locator('#animation-panel.open')).toBeVisible();
}

test('the panel lists components/connectors to add, and adding one moves it into the ordered sequence', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);

  await expect(page.locator('.animation-add-row')).toHaveCount(2);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();

  await expect(page.locator('.animation-step-row')).toHaveCount(1);
  await expect(page.locator('.animation-step-row')).toContainText('API Gateway');
  await expect(page.locator('.animation-add-row')).toHaveCount(1, { timeout: 2000 }); // no longer offered once added
  await expect(page.locator('.animation-play-btn')).toBeEnabled();
});

test('a numbered order badge appears on canvas for each item in the sequence', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();

  await expect(page.locator('.anim-badge')).toHaveCount(1);
  await expect(page.locator('.anim-badge')).toHaveText('1');
});

test('reordering with the ▲/▼ buttons changes the badge numbers', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-add-row', { hasText: 'Redis Cache' }).locator('button', { hasText: '+ Add' }).click();

  const rows = page.locator('.animation-step-row');
  await expect(rows.nth(0)).toContainText('API Gateway');
  await rows.nth(1).locator('.animation-step-move', { hasText: '▲' }).click();
  await expect(rows.nth(0)).toContainText('Redis Cache');
  await expect(rows.nth(0).locator('.animation-step-order')).toHaveText('1');
  await expect(rows.nth(1).locator('.animation-step-order')).toHaveText('2');
});

test('removing a step takes it out of the sequence and its badge disappears', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();
  await expect(page.locator('.animation-step-row')).toHaveCount(1);

  await page.locator('.animation-step-remove').click();
  await expect(page.locator('.animation-step-row')).toHaveCount(0);
  await expect(page.locator('.anim-badge')).toHaveCount(0);
  await expect(page.locator('.animation-play-btn')).toBeDisabled();
});

test('setting a step to Auto reveals a delay input, which is hidden again for Click', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();

  await expect(page.locator('.animation-step-delay')).toHaveCount(0);
  await page.locator('.animation-step-row select').selectOption('auto');
  await expect(page.locator('.animation-step-delay')).toHaveCount(1);
  await page.locator('.animation-step-row select').selectOption('click');
  await expect(page.locator('.animation-step-delay')).toHaveCount(0);
});

test('right-clicking a component offers "Add to Animation" / "Remove from Animation"', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await page.locator('.node').first().click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: 'Add to Animation' }).click();

  await openAnimationPanel(page);
  await expect(page.locator('.animation-step-row')).toHaveCount(1);

  await page.locator('.node').first().click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: 'Remove from Animation' }).click();
  await expect(page.locator('.animation-step-row')).toHaveCount(0);
});

test('playing the animation hides sequenced items behind kiosk mode, revealing them one at a time via click/arrow keys, and Esc exits cleanly', async ({ page }) => {
  await addComponentByName(page, 'API Gateway'); // never added to the animation — stays visible throughout
  await addComponentByName(page, 'Redis Cache');
  await addComponentByName(page, 'PostgreSQL');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'Redis Cache' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-add-row', { hasText: 'PostgreSQL' }).locator('button', { hasText: '+ Add' }).click();

  await page.locator('.animation-play-btn').click();

  await expect(page.locator('#toolbar')).toBeHidden();
  await expect(page.locator('.kiosk-exit-btn')).toBeVisible();
  await expect(page.locator('.anim-playback-controls')).toBeVisible();
  await expect(page.locator('.anim-step-indicator')).toHaveText('0 / 2');

  await expect(page.locator('.node', { hasText: 'API Gateway' })).not.toHaveClass(/anim-hidden/);
  await expect(page.locator('.node', { hasText: 'Redis Cache' })).toHaveClass(/anim-hidden/);
  await expect(page.locator('.node', { hasText: 'PostgreSQL' })).toHaveClass(/anim-hidden/);

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.anim-step-indicator')).toHaveText('1 / 2');
  await expect(page.locator('.node', { hasText: 'Redis Cache' })).not.toHaveClass(/anim-hidden/);
  await expect(page.locator('.node', { hasText: 'PostgreSQL' })).toHaveClass(/anim-hidden/);

  // A plain click on empty canvas also advances (the reveal-mode setting
  // describes *how* a step appears, click mode isn't tied to one button).
  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('.anim-step-indicator')).toHaveText('2 / 2');
  await expect(page.locator('.node', { hasText: 'PostgreSQL' })).not.toHaveClass(/anim-hidden/);

  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.anim-step-indicator')).toHaveText('1 / 2');
  await expect(page.locator('.node', { hasText: 'PostgreSQL' })).toHaveClass(/anim-hidden/);

  await page.keyboard.press('Escape');
  await expect(page.locator('#toolbar')).toBeVisible();
  await expect(page.locator('.anim-playback-controls')).toBeHidden();
  await expect(page.locator('.node', { hasText: 'PostgreSQL' })).not.toHaveClass(/anim-hidden/, { timeout: 2000 });
});

test('an "Auto" step advances on its own after its delay without any input', async ({ page }) => {
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'Redis Cache' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-step-row select').selectOption('auto');
  await page.locator('.animation-step-delay').fill('0.5');

  await page.locator('.animation-play-btn').click();
  await expect(page.locator('.node', { hasText: 'Redis Cache' })).toHaveClass(/anim-hidden/);
  await expect(page.locator('.node', { hasText: 'Redis Cache' })).not.toHaveClass(/anim-hidden/, { timeout: 3000 });
});

test('freezing and drawing pauses advancement, and Done clears the overlay and resumes', async ({ page }) => {
  await addComponentByName(page, 'Redis Cache');
  await addComponentByName(page, 'PostgreSQL');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'Redis Cache' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-add-row', { hasText: 'PostgreSQL' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-play-btn').click();

  await page.keyboard.press('d');
  await expect(page.locator('.anim-draw-overlay')).toBeVisible();

  const canvas = page.locator('.anim-draw-canvas');
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 50, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 150);
  await page.mouse.up();

  // Drawing on the overlay must not itself advance the animation.
  await expect(page.locator('.anim-step-indicator')).toHaveText('0 / 2');

  await page.locator('.anim-draw-toolbar button', { hasText: 'Done' }).click();
  await expect(page.locator('.anim-draw-overlay')).toBeHidden();
  await expect(page.locator('.anim-step-indicator')).toHaveText('0 / 2');

  // Playback resumed — a plain click now advances again.
  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('.anim-step-indicator')).toHaveText('1 / 2');
});

test('exporting downloads a file, and importing it back restores the sequence', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.animation-io-row button', { hasText: 'Export Animation' }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();

  await page.locator('.animation-step-remove').click();
  await expect(page.locator('.animation-step-row')).toHaveCount(0);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('.animation-io-row button', { hasText: 'Import Animation' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path);

  await expect(page.locator('.animation-step-row')).toHaveCount(1);
  await expect(page.locator('.animation-step-row')).toContainText('API Gateway');
});

test('a connector can be added to the animation and reveals during playback like a component', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await connectNodes(page, page.locator('.node').first(), page.locator('.node').nth(1));
  await expect(page.locator('.edge')).toHaveCount(1);

  await openAnimationPanel(page);
  const connectorRow = page.locator('.animation-add-row').filter({ has: page.locator('.animation-step-icon', { hasText: '➔' }) });
  await expect(connectorRow).toHaveCount(1);
  await connectorRow.locator('button', { hasText: '+ Add' }).click();
  await expect(page.locator('.animation-step-row')).toHaveCount(1);

  await page.locator('.animation-play-btn').click();
  await expect(page.locator('.edge')).toHaveClass(/anim-hidden/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.edge')).not.toHaveClass(/anim-hidden/);
});

test('the ✕ button closes the panel', async ({ page }) => {
  await openAnimationPanel(page);
  await page.locator('.animation-close').click();
  await expect(page.locator('#animation-panel.open')).toHaveCount(0);
});
