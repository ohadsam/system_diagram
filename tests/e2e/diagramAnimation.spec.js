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

test('exporting to PPTX downloads a .pptx file, one slide per step', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-add-row', { hasText: 'Redis Cache' }).locator('button', { hasText: '+ Add' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.animation-io-row button', { hasText: 'Export to PPTX' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pptx$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  await expect(page.locator('.toast-success', { hasText: 'Exported the animation to a .pptx' })).toBeVisible();
});

test('the PPTX/video export buttons stay disabled until the animation has at least one step', async ({ page }) => {
  await openAnimationPanel(page);
  await expect(page.locator('.animation-io-row button', { hasText: 'Export to PPTX' })).toBeDisabled();
  await expect(page.locator('.animation-io-row button', { hasText: 'Export to Video' })).toBeDisabled();
});

test('exporting to video downloads a .webm file', async ({ page }) => {
  test.setTimeout(30000);
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();
  // Auto mode + a short delay, so the test doesn't sit through the default
  // 2s click-dwell the video export falls back to for a 'click' step.
  await page.locator('.animation-step-row select').selectOption('auto');
  await page.locator('.animation-step-delay').fill('0.5');

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.locator('.animation-io-row button', { hasText: 'Export to Video' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.webm$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  await expect(page.locator('.toast-success', { hasText: 'Exported the animation to a video' })).toBeVisible();
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

test('works on any shape regardless of diagram type — a sequence-diagram lifeline, a flowchart decision diamond, and their connectors can all be animated', async ({ page }) => {
  await addComponentByName(page, 'Lifeline');
  await addComponentByName(page, 'Diamond (Decision)');
  await connectNodes(page, page.locator('.node[data-shape="lifeline"]'), page.locator('.node[data-shape="diamond"]'));
  await expect(page.locator('.edge')).toHaveCount(1);

  await openAnimationPanel(page);
  await expect(page.locator('.animation-add-row')).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await page.locator('.animation-add-row').first().locator('button', { hasText: '+ Add' }).click();
  }
  await expect(page.locator('.animation-step-row')).toHaveCount(3);

  // The order badge over a very tall shape (a lifeline defaults to 640px)
  // stays near its readable title/icon instead of sliding to the bottom of
  // the shape — see canvas.js#renderAnimationBadges's height cap.
  const lifelineBox = await page.locator('.node[data-shape="lifeline"]').boundingBox();
  const lifelineBadge = await page.locator('.anim-badge').first().boundingBox();
  expect(lifelineBadge.y).toBeLessThan(lifelineBox.y + 90);

  await page.locator('.animation-play-btn').click();
  await expect(page.locator('.node[data-shape="lifeline"]')).toHaveClass(/anim-hidden/);
  await expect(page.locator('.node[data-shape="diamond"]')).toHaveClass(/anim-hidden/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.node[data-shape="lifeline"]')).not.toHaveClass(/anim-hidden/);
  await expect(page.locator('.node[data-shape="diamond"]')).not.toHaveClass(/anim-hidden/);
  await expect(page.locator('.edge')).not.toHaveClass(/anim-hidden/);
});

test('multiple named animations: New/Rename/Delete keep separate sequences that don\'t interfere with each other', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();
  await expect(page.locator('.animation-step-row')).toHaveCount(1);

  await page.locator('.animation-switcher button', { hasText: '+ New' }).click();
  await page.locator('.prompt-modal input').fill('Failure scenario');
  await page.locator('.prompt-modal button[type="submit"]').click();
  // The new animation is now active and starts empty — the previous one's
  // step isn't visible here even though the underlying component still is.
  await expect(page.locator('.animation-step-row')).toHaveCount(0);
  await page.locator('.animation-add-row', { hasText: 'Redis Cache' }).locator('button', { hasText: '+ Add' }).click();
  await expect(page.locator('.animation-step-row')).toHaveCount(1);
  await expect(page.locator('.animation-step-row')).toContainText('Redis Cache');

  // Switching back shows the first animation's own step again, untouched.
  await page.locator('.animation-switcher select').selectOption({ index: 0 });
  await expect(page.locator('.animation-step-row')).toHaveCount(1);
  await expect(page.locator('.animation-step-row')).toContainText('API Gateway');

  await page.locator('.animation-switcher button[title="Rename this animation"]').click();
  await page.locator('.prompt-modal input').fill('Normal flow');
  await page.locator('.prompt-modal button[type="submit"]').click();
  await expect(page.locator('.animation-switcher select')).toContainText('Normal flow');

  await page.locator('.animation-switcher button[title="Delete this animation"]').click();
  await page.locator('.confirm-modal button', { hasText: 'Delete' }).click();
  // Deleting the active one falls back to the remaining animation.
  await expect(page.locator('.animation-step-row')).toContainText('Redis Cache');
});

test('a step\'s presenter notes are editable, shown during playback, and never visible to a plain diagram viewer', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();

  await expect(page.locator('.animation-step-notes-row')).toHaveCount(0);
  await page.locator('.animation-step-notes-toggle').click();
  await page.locator('.animation-step-notes-input').fill('Mention rate limiting here');
  await expect(page.locator('.animation-step-notes-toggle')).toHaveClass(/has-notes/);

  await page.locator('.animation-play-btn').click();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.anim-step-notes')).toHaveText('Mention rate limiting here');
});

test('group-reveal: checking several items and "Add Selected" creates one step that reveals them together under one order number', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await addComponentByName(page, 'PostgreSQL');
  await openAnimationPanel(page);

  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('.animation-add-row-check').check();
  await page.locator('.animation-add-row', { hasText: 'Redis Cache' }).locator('.animation-add-row-check').check();
  await expect(page.locator('.animation-add-selected-btn')).toHaveText('+ Add Selected (2) as one step');
  await page.locator('.animation-add-selected-btn').click();

  await expect(page.locator('.animation-step-row')).toHaveCount(1);
  await expect(page.locator('.animation-step-row')).toContainText('API Gateway, Redis Cache');
  await expect(page.locator('.animation-step-target-chip')).toHaveCount(2);

  // Both targets share the same order badge number.
  await expect(page.locator('.anim-badge')).toHaveCount(2);
  await expect(page.locator('.anim-badge').first()).toHaveText('1');
  await expect(page.locator('.anim-badge').nth(1)).toHaveText('1');

  await page.locator('.animation-play-btn').click();
  await expect(page.locator('.node', { hasText: 'API Gateway' })).toHaveClass(/anim-hidden/);
  await expect(page.locator('.node', { hasText: 'Redis Cache' })).toHaveClass(/anim-hidden/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.node', { hasText: 'API Gateway' })).not.toHaveClass(/anim-hidden/);
  await expect(page.locator('.node', { hasText: 'Redis Cache' })).not.toHaveClass(/anim-hidden/);
});

test('group-reveal via right-click: "Add Selection to Animation" on a multi-selection groups it into one step', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await page.locator('.node', { hasText: 'API Gateway' }).click();
  await page.locator('.node', { hasText: 'Redis Cache' }).click({ modifiers: ['Control'] });
  await page.locator('.node', { hasText: 'Redis Cache' }).click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: 'Add Selection to Animation' }).click();

  await openAnimationPanel(page);
  await expect(page.locator('.animation-step-row')).toHaveCount(1);
  await expect(page.locator('.animation-step-target-chip')).toHaveCount(2);
});

test('removing one target from a grouped step via its chip leaves the rest of the group intact', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('.animation-add-row-check').check();
  await page.locator('.animation-add-row', { hasText: 'Redis Cache' }).locator('.animation-add-row-check').check();
  await page.locator('.animation-add-selected-btn').click();
  await expect(page.locator('.animation-step-target-chip')).toHaveCount(2);

  await page.locator('.animation-step-target-chip', { hasText: 'API Gateway' }).locator('.animation-step-target-remove').click();
  await expect(page.locator('.animation-step-row')).toHaveCount(1, { timeout: 2000 });
  await expect(page.locator('.animation-step-targets')).toHaveCount(0, { timeout: 2000 }); // back to a single-target step, chips row hidden
  await expect(page.locator('.animation-step-row')).toContainText('Redis Cache');
});

test('progress dots jump straight to any step during playback', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await addComponentByName(page, 'PostgreSQL');
  await openAnimationPanel(page);
  for (const name of ['API Gateway', 'Redis Cache', 'PostgreSQL']) {
    await page.locator('.animation-add-row', { hasText: name }).locator('button', { hasText: '+ Add' }).click();
  }
  await page.locator('.animation-play-btn').click();

  await expect(page.locator('.anim-progress-dot')).toHaveCount(3);
  await page.locator('.anim-progress-dot').nth(2).click();
  await expect(page.locator('.anim-step-indicator')).toHaveText('3 / 3');
  await expect(page.locator('.node', { hasText: 'PostgreSQL' })).not.toHaveClass(/anim-hidden/);

  await page.locator('.anim-progress-dot').first().click();
  await expect(page.locator('.anim-step-indicator')).toHaveText('1 / 3');
  await expect(page.locator('.node', { hasText: 'PostgreSQL' })).toHaveClass(/anim-hidden/);
});

test('Autoplay-to-end forces a "Click" step to advance on its own, and Loop restarts from the beginning', async ({ page }) => {
  await addComponentByName(page, 'Redis Cache');
  await addComponentByName(page, 'PostgreSQL');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'Redis Cache' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-add-row', { hasText: 'PostgreSQL' }).locator('button', { hasText: '+ Add' }).click();
  // Both stay "Click" (the default) — Autoplay must override that.
  await page.locator('.animation-play-btn').click();

  await page.locator('[aria-label="Auto-play to the end"]').click();
  await expect(page.locator('.anim-step-indicator')).toHaveText('2 / 2', { timeout: 5000 });

  await page.locator('[aria-label="Loop"]').click();
  await expect(page.locator('.anim-step-indicator')).toHaveText('0 / 2', { timeout: 5000 });
});

test('auto-focus pans/zooms the canvas to frame each newly-revealed step', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.field-checkbox', { hasText: 'Auto-focus' }).locator('input').check();

  // Move the component far from the current view so a real pan is
  // observable, then play — the node should end up framed on screen.
  await page.locator('.animation-close').click();
  const node = page.locator('.node', { hasText: 'API Gateway' });
  const box = await node.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 900, box.y + 700, { steps: 10 });
  await page.mouse.up();

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.toolbar-dropdown-trigger', { hasText: 'Tools' }).click();
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Diagram Animation' }).click();
  await page.locator('.animation-play-btn').click();
  await page.keyboard.press('ArrowRight');

  await expect(node).not.toHaveClass(/anim-hidden/);
  const framedBox = await node.boundingBox();
  const viewport = page.viewportSize();
  expect(framedBox.x).toBeGreaterThan(-50);
  expect(framedBox.x).toBeLessThan(viewport.width + 50);
  expect(framedBox.y).toBeGreaterThan(-50);
  expect(framedBox.y).toBeLessThan(viewport.height + 50);
});

test('a revealed item gets a one-shot pulse class that clears itself shortly after', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-play-btn').click();

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.node', { hasText: 'API Gateway' })).toHaveClass(/anim-just-revealed/);
  await expect(page.locator('.node', { hasText: 'API Gateway' })).not.toHaveClass(/anim-just-revealed/, { timeout: 2000 });
});

test('a full project JSON export/import round-trips animations, groups, and notes intact', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('.animation-add-row-check').check();
  await page.locator('.animation-add-row', { hasText: 'Redis Cache' }).locator('.animation-add-row-check').check();
  await page.locator('.animation-add-selected-btn').click();
  await page.locator('.animation-step-notes-toggle').click();
  await page.locator('.animation-step-notes-input').fill('Grouped intro');
  await page.locator('.animation-close').click();

  await page.locator('.toolbar-dropdown-trigger', { hasText: 'File' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.toolbar-dropdown-panel button', { hasText: 'Export JSON' }).click(),
  ]);
  const path = await download.path();

  await page.reload();
  await dismissHints(page);
  await page.locator('.toolbar-dropdown-trigger', { hasText: 'File' }).click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Import JSON' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path);

  await openAnimationPanel(page);
  await expect(page.locator('.animation-step-row')).toHaveCount(1);
  await expect(page.locator('.animation-step-target-chip')).toHaveCount(2);
  await page.locator('.animation-step-notes-toggle').click();
  await expect(page.locator('.animation-step-notes-input')).toHaveValue('Grouped intro');
});

test('"+ Add All" adds every remaining component/connector as its own step, in one click', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await connectNodes(page, page.locator('.node').first(), page.locator('.node').nth(1));
  await openAnimationPanel(page);

  await expect(page.locator('.animation-add-row')).toHaveCount(3); // 2 components + 1 connector
  await page.locator('button', { hasText: '+ Add All' }).click();

  await expect(page.locator('.animation-step-row')).toHaveCount(3);
  await expect(page.locator('.animation-add-row')).toHaveCount(0);
  // "+ Add All" itself stays visible (always reachable near the top of the
  // panel, not buried below a growing step list) but disables once nothing
  // is left to add, showing "(0)" rather than disappearing outright.
  await expect(page.locator('button', { hasText: '+ Add All' })).toBeDisabled();
  await expect(page.locator('button', { hasText: '+ Add All (0)' })).toBeVisible();
});

test('"+ Add All" and "+ Add Selected From Canvas" are both visible right under Play Animation, with no scrolling needed', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  // addComponentByName leaves the just-placed component selected — deselect
  // so this test's own assertion below reflects an empty canvas selection.
  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 400 } });
  await openAnimationPanel(page);

  const playBtnBox = await page.locator('.animation-play-btn').boundingBox();
  const quickAddRow = page.locator('.animation-quick-add-row');
  const quickAddBox = await quickAddRow.boundingBox();
  expect(quickAddBox.y).toBeGreaterThan(playBtnBox.y);
  expect(quickAddBox.y - playBtnBox.y).toBeLessThan(150); // right below it, not buried under other sections

  await expect(quickAddRow.locator('button', { hasText: '+ Add All (2)' })).toBeVisible();
  await expect(quickAddRow.locator('button', { hasText: '+ Add Selected From Canvas (0)' })).toBeVisible();
});

test('"+ Add Selected From Canvas" adds the current canvas multi-selection as one grouped step, and its own count tracks the live selection', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await addComponentByName(page, 'PostgreSQL');

  await page.locator('.node', { hasText: 'API Gateway' }).click();
  await page.locator('.node', { hasText: 'Redis Cache' }).click({ modifiers: ['Control'] });

  await openAnimationPanel(page);
  const addSelectedBtn = page.locator('button', { hasText: '+ Add Selected From Canvas' });
  await expect(addSelectedBtn).toHaveText('+ Add Selected From Canvas (2)');
  await expect(addSelectedBtn).toBeEnabled();

  await addSelectedBtn.click();
  await expect(page.locator('.animation-step-row')).toHaveCount(1);
  await expect(page.locator('.animation-step-row')).toContainText('API Gateway, Redis Cache');
  await expect(page.locator('.animation-step-target-chip')).toHaveCount(2);
});

test('"+ Add Selected From Canvas" is disabled with nothing selected, and its count updates live as the canvas selection changes while the panel is open', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  // addComponentByName leaves the just-placed component selected — deselect
  // first so this test starts from a real empty-selection state.
  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 400 } });
  await openAnimationPanel(page);

  const addSelectedBtn = page.locator('button', { hasText: '+ Add Selected From Canvas' });
  await expect(addSelectedBtn).toHaveText('+ Add Selected From Canvas (0)');
  await expect(addSelectedBtn).toBeDisabled();

  await page.locator('.node', { hasText: 'API Gateway' }).click();
  await expect(addSelectedBtn).toHaveText('+ Add Selected From Canvas (1)');
  await expect(addSelectedBtn).toBeEnabled();

  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 400 } });
  await expect(addSelectedBtn).toHaveText('+ Add Selected From Canvas (0)');
  await expect(addSelectedBtn).toBeDisabled();
});

test('bulk "Set all steps to" buttons change every step\'s reveal mode at once', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('button', { hasText: '+ Add All' }).click();
  await expect(page.locator('.animation-step-row')).toHaveCount(2);

  // Every step starts as 'click' by default — switch all to auto-play.
  await page.locator('button', { hasText: '⏱️ Auto-play' }).click();
  const modeSelects = page.locator('.animation-step-controls select');
  await expect(modeSelects.nth(0)).toHaveValue('auto');
  await expect(modeSelects.nth(1)).toHaveValue('auto');
  await expect(page.locator('.animation-step-delay')).toHaveCount(2);

  await page.locator('button', { hasText: '🖱️ Click' }).click();
  await expect(modeSelects.nth(0)).toHaveValue('click');
  await expect(modeSelects.nth(1)).toHaveValue('click');
});

test('a step\'s entrance style defaults to Fade and can be changed per-step', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();

  const entranceSelect = page.locator('.animation-step-appearance-row select');
  await expect(entranceSelect).toHaveValue('fade');
  await entranceSelect.selectOption('slide-up');
  await expect(entranceSelect).toHaveValue('slide-up');
});

test('a node set to "Slide up" carries the matching data-anim-entrance attribute while hidden, then reveals normally', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-step-appearance-row select').selectOption('slide-up');

  await page.locator('.animation-play-btn').click();
  const node = page.locator('.node', { hasText: 'API Gateway' });
  await expect(node).toHaveClass(/anim-hidden/);
  await expect(node).toHaveAttribute('data-anim-entrance', 'slide-up');

  await page.keyboard.press('ArrowRight');
  await expect(node).not.toHaveClass(/anim-hidden/);
});

test('an edge set to "Draw" animates its line\'s stroke-dashoffset to 0 once revealed, having started at its full drawn length while hidden', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await connectNodes(page, page.locator('.node').first(), page.locator('.node').nth(1));
  await openAnimationPanel(page);
  await page.locator('button', { hasText: '+ Add All' }).click();
  // 3rd step (after the 2 components) is the connector.
  await page.locator('.animation-step-appearance-row').nth(2).locator('select').selectOption('draw');

  await page.locator('.animation-play-btn').click();
  const line = page.locator('.edge-line');
  const offsetWhileHidden = await line.evaluate((el) => el.style.strokeDashoffset);
  const dasharrayWhileHidden = await line.evaluate((el) => el.style.strokeDasharray);
  expect(offsetWhileHidden).toBe(dasharrayWhileHidden);
  expect(Number(offsetWhileHidden)).toBeGreaterThan(0);

  await page.keyboard.press('ArrowRight'); // API Gateway
  await page.keyboard.press('ArrowRight'); // Redis Cache
  await page.keyboard.press('ArrowRight'); // the connector itself
  await expect.poll(() => line.evaluate((el) => el.style.strokeDashoffset)).toBe('0');
});

test('a step with "Hide after" enabled auto-hides its target a few seconds after it reveals during playback', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-step-appearance-row .field-checkbox input').check();
  await page.locator('.animation-step-appearance-row input[type=number]').fill('0.5');

  await page.locator('.animation-play-btn').click();
  const node = page.locator('.node', { hasText: 'API Gateway' });
  await page.keyboard.press('ArrowRight');
  await expect(node).not.toHaveClass(/anim-hidden/);
  await expect(node).toHaveClass(/anim-hidden/, { timeout: 2000 });
});

test('going back before an auto-hidden step and forward again reveals it for a fresh countdown', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('button', { hasText: '+ Add All' }).click();
  await page.locator('.animation-step-appearance-row').nth(0).locator('.field-checkbox input').check();
  await page.locator('.animation-step-appearance-row').nth(0).locator('input[type=number]').fill('0.5');

  await page.locator('.animation-play-btn').click();
  const node = page.locator('.node', { hasText: 'API Gateway' });
  await page.keyboard.press('ArrowRight');
  await expect(node).toHaveClass(/anim-hidden/, { timeout: 2000 }); // auto-hid after 0.5s

  await page.keyboard.press('ArrowLeft'); // back before it — un-reveals it
  await expect(node).toHaveClass(/anim-hidden/);
  await page.keyboard.press('ArrowRight'); // reveal again — fresh countdown
  await expect(node).not.toHaveClass(/anim-hidden/);
  await expect(node).toHaveClass(/anim-hidden/, { timeout: 2000 });
});

test('bulk "Entrance for all steps" applies one entrance style to every step at once', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('button', { hasText: '+ Add All' }).click();
  await expect(page.locator('.animation-step-row')).toHaveCount(2);

  await page.locator('.animation-bulk-row select').selectOption('zoom');
  const entranceSelects = page.locator('.animation-step-appearance-row select');
  await expect(entranceSelects.nth(0)).toHaveValue('zoom');
  await expect(entranceSelects.nth(1)).toHaveValue('zoom');
});

test('bulk "Hide every step after" Apply/Never hide toggle auto-hide for every step at once', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('button', { hasText: '+ Add All' }).click();

  await page.locator('.animation-bulk-row input[type=number]').fill('3');
  await page.locator('.animation-bulk-row button', { hasText: 'Apply' }).click();
  const hideChecks = page.locator('.animation-step-appearance-row .field-checkbox input');
  await expect(hideChecks.nth(0)).toBeChecked();
  await expect(hideChecks.nth(1)).toBeChecked();

  await page.locator('.animation-bulk-row button', { hasText: 'Never hide' }).click();
  await expect(hideChecks.nth(0)).not.toBeChecked();
  await expect(hideChecks.nth(1)).not.toBeChecked();
});

test('"Remove All" clears every step from the active animation (with confirmation for 2+)', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('button', { hasText: '+ Add All' }).click();
  await expect(page.locator('.animation-step-row')).toHaveCount(2);

  await page.locator('.animation-remove-all-btn').click();
  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-modal button', { hasText: 'Remove' }).click();

  await expect(page.locator('.animation-step-row')).toHaveCount(0);
  await expect(page.locator('.animation-play-btn')).toBeDisabled();
});

test('"Remove All" on a single step skips the confirmation dialog', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();

  await page.locator('.animation-remove-all-btn').click();
  await expect(page.locator('.confirm-modal')).toHaveCount(0);
  await expect(page.locator('.animation-step-row')).toHaveCount(0);
});

test('checking steps in "In animation" scopes every bulk action to just the selection, and the row labels/button text reflect the count', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await addComponentByName(page, 'PostgreSQL');
  await openAnimationPanel(page);
  await page.locator('button', { hasText: '+ Add All' }).click();
  await expect(page.locator('.animation-step-row')).toHaveCount(3);

  // Nothing checked yet — every label/button reads "all steps".
  await expect(page.locator('.animation-bulk-label').first()).toHaveText('Set all steps to:');
  await expect(page.locator('.animation-remove-all-btn')).toHaveText('🗑️ Remove All');

  const stepChecks = page.locator('.animation-step-select');
  await stepChecks.nth(0).check();
  await stepChecks.nth(1).check();

  await expect(page.locator('.animation-bulk-label').first()).toHaveText('Set 2 selected steps to:');
  await expect(page.locator('.animation-remove-all-btn')).toHaveText('🗑️ Remove Selected (2)');

  // Applying a bulk change now only touches the 2 checked steps.
  await page.locator('.animation-bulk-row select').selectOption('zoom');
  const entranceSelects = page.locator('.animation-step-appearance-row select');
  await expect(entranceSelects.nth(0)).toHaveValue('zoom');
  await expect(entranceSelects.nth(1)).toHaveValue('zoom');
  await expect(entranceSelects.nth(2)).toHaveValue('fade'); // untouched — not checked

  // Removing while 2 are checked only removes those 2.
  await page.locator('.animation-remove-all-btn').click();
  await page.locator('.confirm-modal button', { hasText: 'Remove' }).click();
  await expect(page.locator('.animation-step-row')).toHaveCount(1);
  await expect(page.locator('.animation-step-row')).toContainText('PostgreSQL');
});

test('"Select all" checks every step at once, and unchecking one step drops it back to a partial selection', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await openAnimationPanel(page);
  await page.locator('button', { hasText: '+ Add All' }).click();

  await page.locator('.field-checkbox', { hasText: 'Select all' }).locator('input').check();
  const stepChecks = page.locator('.animation-step-select');
  await expect(stepChecks.nth(0)).toBeChecked();
  await expect(stepChecks.nth(1)).toBeChecked();
  await expect(page.locator('.animation-remove-all-btn')).toHaveText('🗑️ Remove Selected (2)');

  await stepChecks.nth(0).uncheck();
  await expect(page.locator('.field-checkbox', { hasText: 'Select all' }).locator('input')).not.toBeChecked();
  await expect(page.locator('.animation-remove-all-btn')).toHaveText('🗑️ Remove Selected (1)');
});

test('entranceStyle and hideAfterMs survive a full project JSON export/import round-trip', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openAnimationPanel(page);
  await page.locator('.animation-add-row', { hasText: 'API Gateway' }).locator('button', { hasText: '+ Add' }).click();
  await page.locator('.animation-step-appearance-row select').selectOption('zoom');
  await page.locator('.animation-step-appearance-row .field-checkbox input').check();
  await page.locator('.animation-step-appearance-row input[type=number]').fill('7');
  await page.locator('.animation-close').click();

  await page.locator('.toolbar-dropdown-trigger', { hasText: 'File' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.toolbar-dropdown-panel button', { hasText: 'Export JSON' }).click(),
  ]);
  const path = await download.path();

  await page.reload();
  await dismissHints(page);
  await page.locator('.toolbar-dropdown-trigger', { hasText: 'File' }).click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Import JSON' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path);

  await openAnimationPanel(page);
  await expect(page.locator('.animation-step-appearance-row select')).toHaveValue('zoom');
  await expect(page.locator('.animation-step-appearance-row .field-checkbox input')).toBeChecked();
  await expect(page.locator('.animation-step-appearance-row input[type=number]')).toHaveValue('7');
});

test('"Auto-Play Diagram" builds a walkthrough from the whole canvas and starts playing immediately, with no manual setup', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Redis Cache');
  await connectNodes(page, page.locator('.node').first(), page.locator('.node').nth(1));

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Auto-Play Diagram' }).click();

  // Playback takes over (kiosk mode) with no animation panel interaction at all.
  await expect(page.locator('.anim-playback-controls')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.anim-step-indicator')).toContainText('1');
});
