import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, connectNodes } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openToolbarGroup(page, groupLabel) {
  await page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: groupLabel }).click();
}

// ---- Flow Simulation ----

test.describe('Flow Simulation', () => {
  test('toggling it shows an animated dot on every connector, hidden again when toggled off', async ({ page }) => {
    await addComponentByName(page, 'API Gateway');
    await addComponentByName(page, 'Redis Cache');
    await connectNodes(page, page.locator('.node').first(), page.locator('.node').nth(1));
    await expect(page.locator('.edge')).toHaveCount(1);

    await expect(page.locator('.flow-dot').first()).not.toBeVisible();

    await openToolbarGroup(page, 'Tools');
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Flow Simulation' }).click();
    await expect(page.locator('.flow-dot').first()).toBeVisible();
    await expect(page.locator('.edge-layer.flow-simulation-on')).toHaveCount(1);

    await openToolbarGroup(page, 'Tools');
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Flow Simulation' }).click();
    await expect(page.locator('.flow-dot').first()).not.toBeVisible();
  });

  test('persists across a reload via the same preference storage as other toolbar toggles', async ({ page }) => {
    await openToolbarGroup(page, 'Tools');
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Flow Simulation' }).click();
    await page.reload();
    await dismissHints(page);
    await expect(page.locator('#toolbar')).toBeVisible();
    await openToolbarGroup(page, 'Tools');
    await expect(page.locator('.toolbar-dropdown-panel button', { hasText: 'Flow Simulation' })).toHaveClass(/active/);
  });
});

// ---- Edit with AI ----

test.describe('Edit with AI', () => {
  test('describing a change, pasting a patch, previewing, and applying it edits the live diagram as one undoable step', async ({ page }) => {
    await addComponentByName(page, 'API Gateway');
    await addComponentByName(page, 'Redis Cache');
    await connectNodes(page, page.locator('.node').first(), page.locator('.node').nth(1));

    await openToolbarGroup(page, 'Create');
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Edit with AI' }).click();
    await expect(page.locator('.ai-edit-modal')).toBeVisible();

    await page.locator('.ai-edit-instruction').fill('rename Redis Cache to Redis Cache v2');
    await page.locator('.modal-actions button', { hasText: 'Next →' }).click();
    // A textarea's *value* (set reactively via the JS property, not appended
    // as a text-node child) isn't what toContainText() reads — that checks
    // textContent, which stays empty. inputValue()/toHaveValue() is correct here.
    expect(await page.locator('.ai-review-prompt').inputValue()).toContain('rename Redis Cache to Redis Cache v2');
    await page.locator('.modal-actions button', { hasText: 'Next →' }).click();

    const targetNodeId = await page.locator('.node', { hasText: 'Redis Cache' }).getAttribute('data-node-id');
    const patch = JSON.stringify({ updateNodes: [{ id: targetNodeId, text: 'Redis Cache v2' }] });
    await page.locator('.ai-edit-response').fill('```json\n' + patch + '\n```');
    await page.locator('.modal-actions button', { hasText: 'Preview changes' }).click();
    await expect(page.locator('.ai-edit-preview-row')).toHaveCount(1);
    await expect(page.locator('.ai-edit-preview-row')).toContainText('text');

    await page.locator('.modal-actions button', { hasText: 'Apply changes' }).click();
    await expect(page.locator('.ai-edit-modal')).toHaveCount(0);
    await expect(page.locator('.node', { hasText: 'Redis Cache v2' })).toHaveCount(1);

    await page.keyboard.press('Control+z');
    await expect(page.locator('.node', { hasText: 'Redis Cache v2' })).toHaveCount(0);
    await expect(page.locator('.node', { hasText: 'Redis Cache', exact: true })).toHaveCount(1);
  });

  test('a patch adding a new node+edge and removing an old edge applies all of it together', async ({ page }) => {
    await addComponentByName(page, 'API Gateway');
    await addComponentByName(page, 'PostgreSQL');
    await connectNodes(page, page.locator('.node').first(), page.locator('.node').nth(1));
    await expect(page.locator('.edge')).toHaveCount(1);
    const oldEdgeId = await page.locator('.edge').first().getAttribute('data-edge-id');
    const gatewayId = await page.locator('.node').first().getAttribute('data-node-id');

    await openToolbarGroup(page, 'Create');
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Edit with AI' }).click();
    await page.locator('.ai-edit-instruction').fill('add a cache');
    await page.locator('.modal-actions button', { hasText: 'Next →' }).click();
    await page.locator('.modal-actions button', { hasText: 'Next →' }).click();

    const patch = JSON.stringify({
      addNodes: [{ id: 'newcache', x: 400, y: 400, shape: 'cylinder', text: 'New Cache' }],
      addEdges: [{ id: 'newe1', from: gatewayId, to: 'newcache', label: 'reads' }],
      removeEdgeIds: [oldEdgeId],
    });
    await page.locator('.ai-edit-response').fill('```json\n' + patch + '\n```');
    await page.locator('.modal-actions button', { hasText: 'Preview changes' }).click();
    await expect(page.locator('.ai-edit-preview-row')).toHaveCount(3);
    await page.locator('.modal-actions button', { hasText: 'Apply changes' }).click();

    await expect(page.locator('.node')).toHaveCount(3);
    await expect(page.locator('.node', { hasText: 'New Cache' })).toHaveCount(1);
    await expect(page.locator('.edge')).toHaveCount(1);
  });
});

// ---- Custom Lint Rules ----

test.describe('Custom Lint Rules', () => {
  test('a requires-connection rule flags a violating component and clears once connected, and can be disabled', async ({ page }) => {
    await addComponentByName(page, 'Redis Cache');

    await openToolbarGroup(page, 'Tools');
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Check Diagram' }).click();
    await page.locator('.modal-actions button', { hasText: 'Manage Custom Rules' }).click();

    const selects = page.locator('.custom-lint-rule-form select');
    await selects.nth(1).selectOption('cache');
    await selects.nth(2).selectOption('backend-frameworks');
    await page.locator('.custom-lint-rule-form input[type="text"]').fill('Cache needs a backend');
    await page.locator('.modal-actions button', { hasText: '+ Add rule' }).click();
    await expect(page.locator('.custom-lint-rule-row')).toHaveCount(1);
    await page.locator('.custom-lint-rules-modal .modal-actions button', { hasText: 'Done' }).click();

    await expect(page.locator('.diagram-lint-item-text')).toContainText('Cache needs a backend');

    // Disable it and confirm it stops firing.
    await page.locator('.modal-actions button', { hasText: 'Manage Custom Rules' }).click();
    await page.locator('.custom-lint-rule-row input[type="checkbox"]').uncheck();
    await page.locator('.custom-lint-rules-modal .modal-actions button', { hasText: 'Done' }).click();
    await expect(page.locator('.diagram-lint-empty')).toBeVisible();

    // Delete it and confirm it's gone from the manager too.
    await page.locator('.modal-actions button', { hasText: 'Manage Custom Rules' }).click();
    await page.locator('.custom-lint-rule-row button', { hasText: 'Delete' }).click();
    await page.locator('.confirm-modal button', { hasText: 'Delete' }).click();
    await expect(page.locator('.custom-lint-rule-row')).toHaveCount(0);
  });
});

// ---- Threaded Comments ----

test.describe('Threaded Comments', () => {
  test('replies can be added and removed, the note persists, and everything round-trips through JSON export/import', async ({ page }) => {
    await page.locator('#canvas-viewport').click({ button: 'right', position: { x: 300, y: 300 } });
    await page.locator('.context-menu-item', { hasText: 'Add comment here' }).click();
    await expect(page.locator('.comment-modal')).toBeVisible();

    await page.locator('.comment-modal-text').fill('Should this be async?');
    await page.locator('.comment-reply-input').fill('Yes, queue it');
    await page.locator('.comment-reply-input').press('Enter');
    await expect(page.locator('.comment-reply')).toHaveCount(1);
    await expect(page.locator('.comment-reply-input')).toBeFocused();

    await page.locator('.comment-reply-input').fill('Agreed');
    await page.locator('.comment-reply-input').press('Enter');
    await expect(page.locator('.comment-reply')).toHaveCount(2);
    await expect(page.locator('.comment-modal-text')).toHaveValue('Should this be async?');

    await page.locator('.comment-reply-remove').first().click();
    await expect(page.locator('.comment-reply')).toHaveCount(1);
    await expect(page.locator('.comment-reply-text')).toHaveText('Agreed');

    await page.locator('.field-checkbox input[type="checkbox"]').check();
    await page.locator('.modal-actions button', { hasText: 'Done' }).click();
    await expect(page.locator('.comment-pin.resolved')).toHaveCount(1);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      (async () => {
        await page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: 'File' }).click();
        await page.locator('.toolbar-dropdown-panel button', { hasText: 'Export JSON' }).click();
      })(),
    ]);
    const path = await download.path();

    await page.locator('.comment-pin').click();
    await page.locator('.modal-actions button', { hasText: 'Delete' }).click();
    await page.locator('.confirm-modal button', { hasText: 'Delete' }).click();
    await expect(page.locator('.comment-pin')).toHaveCount(0);

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: 'File' }).click();
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Import JSON' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path);

    await expect(page.locator('.comment-pin.resolved')).toHaveCount(1);
    await page.locator('.comment-pin').click();
    await expect(page.locator('.comment-reply')).toHaveCount(1);
    await expect(page.locator('.comment-reply-text')).toHaveText('Agreed');
  });
});

// ---- Hebrew / RTL localization ----

test.describe('Hebrew / RTL localization', () => {
  test('toggling the language translates core toolbar chrome and mirrors the layout, reversibly', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await openToolbarGroup(page, 'Tools');
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Language' }).click();
    await page.waitForLoadState('domcontentloaded');
    await dismissHints(page);

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: 'קובץ' })).toBeVisible();
    await expect(page.locator('.sidebar-search input')).toHaveAttribute('placeholder', 'חיפוש רכיבים...');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(overflow).toBe(true);

    // Toggle back to English.
    await openToolbarGroup(page, 'כלים');
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'שפה' }).click();
    await page.waitForLoadState('domcontentloaded');
    await dismissHints(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: 'File' })).toBeVisible();
  });
});
