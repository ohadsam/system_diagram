import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup, addComponentByName, connectNodes } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('pressing ? opens the Keyboard Shortcuts modal, and it is also reachable from the Command Palette', async ({ page }) => {
  await page.keyboard.press('?');
  await expect(page.locator('.keyboard-shortcuts-modal')).toBeVisible();
  await expect(page.locator('.keyboard-shortcuts-modal')).toContainText('Undo');
  await page.locator('.keyboard-shortcuts-modal .modal-close').click();
  await expect(page.locator('.keyboard-shortcuts-modal')).toBeHidden();

  await page.keyboard.press('Control+k');
  await page.locator('.command-palette-input').fill('keyboard shortcuts');
  await page.locator('.command-palette-item', { hasText: 'Keyboard Shortcuts' }).click();
  await expect(page.locator('.keyboard-shortcuts-modal')).toBeVisible();
});

test('Sketch Mode toggle applies and removes the sketch-mode body class', async ({ page }) => {
  await expect(page.locator('body')).not.toHaveClass(/sketch-mode/);
  await openToolbarGroup(page, 'Tools');
  const btn = page.locator('.toolbar-dropdown-panel button', { hasText: 'Sketch Mode' });
  await btn.click();
  await expect(page.locator('body')).toHaveClass(/sketch-mode/);

  await openToolbarGroup(page, 'Tools');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Sketch Mode' }).click();
  await expect(page.locator('body')).not.toHaveClass(/sketch-mode/);
});

test('Inline Diagnostics toggle shows a lint badge on an orphaned node', async ({ page }) => {
  // diagramLint.js's "orphan node" check only runs once the diagram has at
  // least one edge elsewhere ("the rest of the diagram is wired up") — so
  // this connects two components and adds a third, deliberately unconnected
  // one to be the orphan the badge should flag.
  await addComponentByName(page, 'EC2');
  await addComponentByName(page, 'S3');
  await connectNodes(page, page.locator('.node').nth(0), page.locator('.node').nth(1));
  await addComponentByName(page, 'Lambda');
  await expect(page.locator('.node.has-lint-findings')).toHaveCount(0);

  await openToolbarGroup(page, 'Tools');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Inline Diagnostics' }).click();
  await expect(page.locator('.node.has-lint-findings .node-lint-badge')).toBeVisible();

  await openToolbarGroup(page, 'Tools');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Inline Diagnostics' }).click();
  await expect(page.locator('.node.has-lint-findings')).toHaveCount(0);
});

test('canvas search falls back to category/tag matching when no name matches', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  const search = page.locator('.toolbar-canvas-search input');
  await search.fill('cach');
  await expect(page.locator('.toolbar-canvas-search-count')).toHaveText('1/1');
});

test('Presenter Mode: Spotlight and Remote Control are only present while presenting', async ({ page }) => {
  await expect(page.locator('.kiosk-spotlight-btn')).toBeHidden();
  await expect(page.locator('.kiosk-remote-btn')).toBeHidden();

  await openToolbarGroup(page, 'Tools');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Presenter Mode' }).click();
  await expect(page.locator('.kiosk-spotlight-btn')).toBeVisible();
  await expect(page.locator('.kiosk-remote-btn')).toBeVisible();

  await page.locator('.kiosk-spotlight-btn').click();
  await expect(page.locator('body')).toHaveClass(/spotlight-mode/);
  await expect(page.locator('.kiosk-spotlight')).toBeVisible();

  await page.locator('.kiosk-remote-btn').click();
  await expect(page.locator('.presenter-remote-modal')).toBeVisible();
  await page.locator('.presenter-remote-modal .modal-close').click();

  await page.locator('.kiosk-exit-btn').click();
  await expect(page.locator('.kiosk-spotlight-btn')).toBeHidden();
  // Exiting Presenter Mode also force-clears the spotlight, so it isn't
  // left dimming the screen once back in the normal editing UI.
  await expect(page.locator('body')).not.toHaveClass(/spotlight-mode/);
});
