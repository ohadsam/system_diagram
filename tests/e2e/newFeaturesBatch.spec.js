import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup, connectNodes } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('Blast Radius: right-clicking a connected component shows what depends on it and what it depends on', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await addComponentByName(page, 'API Gateway');
  const nodes = page.locator('.node');
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect(page.locator('.edge')).toHaveCount(1);

  await nodes.nth(0).click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: 'Blast Radius' }).click();
  await expect(page.locator('.blast-radius-modal')).toBeVisible();
  await expect(page.locator('.blast-radius-item')).toHaveCount(1);
});

test('Blast Radius: an unconnected component reports nothing would be affected', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await page.locator('.node').first().click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: 'Blast Radius' }).click();
  await expect(page.locator('.blast-radius-modal')).toBeVisible();
  await expect(page.locator('.blast-radius-empty')).toContainText("isn't connected");
});

test('Interview Mode: starting a practice question shows a live countdown badge and lets grading open an AI ask modal', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Interview Mode' }).click();
  await expect(page.locator('.interview-mode-modal')).toBeVisible();
  await page.locator('.interview-duration-btn', { hasText: '15m' }).click();
  await page.locator('.interview-prompt-row', { hasText: 'Design a URL Shortener' }).locator('button', { hasText: 'Start' }).click();
  await expect(page.locator('.interview-mode-modal')).toBeHidden();
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('.toolbar-interview-badge')).toBeVisible();
  await expect(page.locator('.toolbar-interview-badge')).toContainText(':');

  await page.locator('#toolbar button', { hasText: 'Interview Mode' }).click();
  await expect(page.locator('.interview-timer')).toContainText('remaining');
  await page.locator('button', { hasText: 'Submit for Grading' }).click();
  await expect(page.locator('.ai-ask-modal')).toBeVisible();
  await expect(page.locator('.ai-ask-modal .ai-review-prompt')).toHaveValue(/Design a URL Shortener/);
});

test('Interview Mode: ending practice hides the countdown badge', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Interview Mode' }).click();
  await page.locator('.interview-prompt-row', { hasText: 'Design a Rate Limiter' }).locator('button', { hasText: 'Start' }).click();
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('.toolbar-interview-badge')).toBeVisible();

  await page.locator('#toolbar button', { hasText: 'Interview Mode' }).click();
  await page.locator('button', { hasText: 'End Practice' }).click();
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('.toolbar-interview-badge')).toBeHidden();
});

test('Import from URL/Gist: a bad URL shows a clear error without touching the canvas', async ({ page }) => {
  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Import from URL/Gist' }).click();
  await expect(page.locator('.import-url-modal')).toBeVisible();
  await page.locator('.import-url-input').fill('not-a-url');
  await page.locator('.import-url-modal button', { hasText: 'Import' }).click();
  await expect(page.locator('.import-url-error')).toContainText(/http/i);
  await expect(page.locator('.node')).toHaveCount(0);
});

test('Import from URL/Gist: a successful fetch loads the diagram onto the canvas', async ({ page }) => {
  await page.route('https://example.com/my-diagram.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ name: 'Shared Diagram', nodes: [{ id: 'n1', x: 0, y: 0, w: 160, h: 84 }], edges: [] }),
  }));
  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Import from URL/Gist' }).click();
  await page.locator('.import-url-input').fill('https://example.com/my-diagram.json');
  await page.locator('.import-url-modal button', { hasText: 'Import' }).click();
  await expect(page.locator('.import-url-modal')).toBeHidden();
  await expect(page.locator('.node')).toHaveCount(1);
  await expect(page.locator('.toast-success')).toContainText('Shared Diagram');
});

test('System Map: saving a second diagram and linking to it shows both nodes and the link', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.locator('.toast-success').last()).toBeVisible();

  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button[title="New diagram"]').click();
  await page.locator('.confirm-modal button', { hasText: 'Start new' }).click();
  await addComponentByName(page, 'Redis Cache');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(page.locator('.toast-success').last()).toBeVisible();

  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'System Map' }).click();
  await expect(page.locator('.system-map-modal')).toBeVisible();
  await expect(page.locator('.system-map-node')).toHaveCount(2);

  await page.locator('.system-map-label-input').fill('related backend');
  await page.locator('.system-map-add-row button', { hasText: 'Add Link' }).click();
  await expect(page.locator('.system-map-link-row')).toHaveCount(1);
  await expect(page.locator('.system-map-link')).toHaveCount(1);
});

test('Export PDF (Poster): produces a downloadable, valid poster PDF', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await addComponentByName(page, 'API Gateway');

  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Export PDF (Poster)' }).click();
  await expect(page.locator('.export-poster-modal')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.export-poster-modal button', { hasText: 'Export' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/-poster\.pdf$/);
  const path = await download.path();
  const bytes = await import('node:fs').then((fs) => fs.promises.readFile(path));
  expect(bytes.toString('latin1')).toContain('%PDF');
});

test('Review Status: starts as Draft, and marking Approved with a name updates the toolbar badge', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('.toolbar-review-status-badge')).toHaveText('Draft');

  await page.locator('#toolbar button', { hasText: 'Review Status' }).click();
  await expect(page.locator('.review-status-modal')).toBeVisible();
  await page.locator('.review-status-name-input').fill('Ada');
  await page.locator('.review-status-btn', { hasText: 'Approved' }).click();
  await expect(page.locator('.review-status-meta')).toContainText('Ada');

  await page.locator('.modal-close').click();
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('.toolbar-review-status-badge')).toHaveText('Approved');
  await expect(page.locator('.toolbar-review-status-badge')).toHaveClass(/toolbar-review-status-approved/);
});
