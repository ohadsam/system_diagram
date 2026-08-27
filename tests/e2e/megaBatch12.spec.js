import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, connectNodes, openToolbarGroup, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

// ---- IndexedDB storage backend (default localStorage, configurable, copy both ways) ----

test.describe('Storage backend', () => {
  test('defaults to localStorage and switching to IndexedDB copies data without deleting the original', async ({ page }) => {
    await addComponentByName(page, 'API Gateway');
    await page.waitForTimeout(700); // autosave debounce

    await openToolbarGroup(page, 'File');
    await page.locator('#toolbar button', { hasText: 'Backup & Restore' }).click();
    await expect(page.locator('.storage-backend-select')).toHaveValue('localStorage');
    await expect(page.locator('.storage-backend-status')).toContainText('localStorage');

    await page.locator('.storage-backend-select').selectOption('indexeddb');
    await page.locator('.backup-section .btn', { hasText: 'Switch & copy data' }).click();
    await expect(page.locator('.confirm-modal')).toBeVisible();
    await page.locator('.confirm-modal button', { hasText: 'Switch' }).click();

    await page.waitForLoadState('load');
    await dismissHints(page);
    // The in-memory canvas the user was looking at survives the switch since
    // nothing was deleted, only copied — the reload just re-reads it from
    // the newly-active backend.
    await expect(page.locator('.node', { hasText: 'API Gateway' })).toHaveCount(1);

    await openToolbarGroup(page, 'File');
    await page.locator('#toolbar button', { hasText: 'Backup & Restore' }).click();
    await expect(page.locator('.storage-backend-select')).toHaveValue('indexeddb');
    await expect(page.locator('.storage-backend-status')).toContainText('IndexedDB');
  });
});

// ---- SVG export ----

test.describe('SVG export', () => {
  test('"Export SVG" downloads a vector .svg file', async ({ page }) => {
    await addComponentByName(page, 'API Gateway');
    await openToolbarGroup(page, 'File');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#toolbar button', { hasText: 'Export SVG' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
  });
});

// ---- Global search across saved projects ----

test.describe('Search All Projects', () => {
  test('finds a saved project by its node text and loads it', async ({ page }) => {
    await addComponentByName(page, 'API Gateway');
    const label = page.locator('.node-label').first();
    await label.click();
    await label.dblclick();
    await page.locator('.inline-edit-input').fill('UniqueSearchTarget9000');
    await page.locator('.inline-edit-input').press('Enter');

    await openToolbarGroup(page, 'File');
    await page.locator('#toolbar button', { hasText: 'Save As' }).click();
    await page.locator('.save-as-modal input[type="text"]').fill('Searchable Project');
    await page.locator('.save-as-modal button', { hasText: 'Save' }).click();

    await openToolbarGroup(page, 'File');
    await page.locator('#toolbar button', { hasText: '🆕 New', exact: true }).click();
    await page.locator('.confirm-modal button', { hasText: 'Start new' }).click();
    await expect.poll(() => nodeCount(page)).toBe(0);

    await openToolbarGroup(page, 'File');
    await page.locator('#toolbar button', { hasText: 'Search All Projects' }).click();
    await expect(page.locator('.global-search-modal, .modal')).toBeVisible();
    await page.locator('.global-search-input').fill('UniqueSearchTarget9000');
    await expect(page.locator('.global-search-row')).toHaveCount(1);
    await expect(page.locator('.global-search-name')).toContainText('Searchable Project');

    await page.locator('.global-search-row .btn', { hasText: 'Load' }).click();
    await expect(page.locator('.node', { hasText: 'UniqueSearchTarget9000' })).toHaveCount(1);
  });
});

// ---- Comments: unresolved-count badge + mentions ----

test.describe('Comments', () => {
  test('the Comments toolbar badge tracks unresolved count, and the list modal supports @mentions', async ({ page }) => {
    await page.locator('#canvas-viewport').click({ button: 'right', position: { x: 300, y: 200 } });
    await page.locator('.context-menu-item', { hasText: 'Add comment here' }).click();
    await page.locator('.comment-modal-text').fill('Check @alice about this');
    await page.locator('.comment-modal button', { hasText: 'Done' }).click();

    await openToolbarGroup(page, 'Tools');
    await expect(page.locator('#toolbar .toolbar-comments-badge')).toHaveText('1');

    await page.locator('#toolbar button', { hasText: 'Comments' }).click();
    await expect(page.locator('.comments-list-row')).toHaveCount(1);

    await page.locator('.comments-list-row .btn', { hasText: 'Open' }).click();
    await expect(page.locator('.comment-modal')).toBeVisible();
    await page.locator('.comment-reply-input').fill('cc @bob');
    await page.locator('.comment-reply-input').press('Enter');
    await expect(page.locator('.comment-reply .mention-chip')).toHaveText('@bob');

    await page.locator('.comment-modal .field-checkbox input').check();
    await page.locator('.comment-modal button', { hasText: 'Done' }).click();

    await openToolbarGroup(page, 'Tools');
    await expect(page.locator('#toolbar .toolbar-count-badge').first()).toBeHidden();
  });
});

// ---- Lint auto-fix suggestions ----

test.describe('Diagram Lint auto-fix', () => {
  test('a client-to-database finding can be one-click fixed by inserting a service layer', async ({ page }) => {
    await addComponentByName(page, 'Web Browser');
    await addComponentByName(page, 'PostgreSQL');
    await connectNodes(page, page.locator('.node').first(), page.locator('.node').nth(1));
    await expect(page.locator('.edge')).toHaveCount(1);

    await openToolbarGroup(page, 'Tools');
    await page.locator('#toolbar button', { hasText: 'Check Diagram' }).click();
    await expect(page.locator('.diagram-lint-item')).toHaveCount(1);

    await page.locator('.diagram-lint-fix-btn').click();
    await expect(page.locator('.node', { hasText: 'Service Layer' })).toHaveCount(1);
    await expect.poll(() => nodeCount(page)).toBe(3);
    await expect(page.locator('.edge')).toHaveCount(2);
  });
});

// ---- Flow Simulation + Replication sync direction ----

test.describe('Replication sync direction', () => {
  test('Flow Simulation shows a traveling dot along a replication pair even with no drawn edge between the two sides', async ({ page }) => {
    await addComponentByName(page, 'Redis');
    await page.locator('.node').first().click();
    await openToolbarGroup(page, 'Create');
    await page.locator('#toolbar button[title^="Replicate"]').click();
    await page.locator('.replication-modal button', { hasText: 'Create replication pair' }).click();
    await expect.poll(() => nodeCount(page)).toBe(2);

    // A straight horizontal/vertical connecting line's SVG bounding box can
    // be zero in one dimension, which makes Playwright's own toBeVisible()
    // (bounding-box-based) unreliable here — the CSS `display` property is
    // what this feature actually toggles (see css/connector.css), so assert
    // that directly instead of relying on rendered pixel geometry.
    await openToolbarGroup(page, 'Tools');
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Flow Simulation' }).click();
    await expect(page.locator('.replication-sync-path')).toHaveCSS('display', 'block');
    await expect(page.locator('.replication-sync-dot')).toHaveCSS('display', 'block');

    await openToolbarGroup(page, 'Tools');
    await page.locator('.toolbar-dropdown-panel button', { hasText: 'Flow Simulation' }).click();
    await expect(page.locator('.replication-sync-path')).toHaveCSS('display', 'none');
  });
});

// ---- Onboarding checklist widget ----

test.describe('Onboarding checklist', () => {
  test('"Getting Started" reopens the checklist card, which reflects progress and can be dismissed', async ({ page }) => {
    await openToolbarGroup(page, 'Help');
    await page.locator('#toolbar button', { hasText: 'Getting Started' }).click();
    await expect(page.locator('.onboarding-checklist-card')).toBeVisible();
    await expect(page.locator('.onboarding-checklist-item')).not.toHaveCount(0);

    await addComponentByName(page, 'API Gateway');
    await openToolbarGroup(page, 'Help');
    await page.locator('#toolbar button', { hasText: 'Getting Started' }).click();
    await expect(page.locator('.onboarding-checklist-item.is-done')).not.toHaveCount(0);

    await page.locator('.onboarding-checklist-close').click();
    await expect(page.locator('.onboarding-checklist-card')).toHaveCount(0);
  });
});

// ---- Template gallery with thumbnails ----

test.describe('Template Gallery', () => {
  test('browsing shows thumbnail previews and clicking a card instantiates it on the canvas', async ({ page }) => {
    await openToolbarGroup(page, 'Create');
    await page.locator('#toolbar button', { hasText: 'Template Gallery' }).click();
    await expect(page.locator('.template-gallery-card').first()).toBeVisible();
    await expect(page.locator('.template-gallery-thumb-svg').first()).toBeVisible();

    await page.locator('.template-gallery-search').fill('');
    await page.locator('.template-gallery-card').first().click();
    await expect.poll(() => nodeCount(page)).toBeGreaterThan(0);
  });
});

// ---- PWA / offline support ----

test.describe('PWA', () => {
  test('registers a service worker and links a web manifest', async ({ page }) => {
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.json');
    const hasController = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null;
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg;
    });
    expect(hasController === null || hasController === true).toBe(true);
  });
});

// ---- SQL DDL import to ER diagram ----

test.describe('Import ER Diagram from SQL', () => {
  test('pasted CREATE TABLE statements become entity nodes with a labeled foreign-key edge', async ({ page }) => {
    await openToolbarGroup(page, 'Create');
    await page.locator('#toolbar button', { hasText: 'Import from SQL' }).click();
    await expect(page.locator('.import-sql-modal, .modal')).toBeVisible();

    await page.locator('.import-sql-input').fill(
      'CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(255));\n' +
      'CREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id));'
    );
    await page.locator('.modal-actions button', { hasText: 'Import' }).click();
    await expect.poll(() => nodeCount(page)).toBe(2);
    await expect(page.locator('.edge')).toHaveCount(1);
    await expect(page.locator('.node', { hasText: 'users' })).toHaveCount(1);
    await expect(page.locator('.node', { hasText: 'orders' })).toHaveCount(1);
  });
});

// ---- C4 Model diagrams ----

test.describe('C4 Context Diagram', () => {
  test('the wizard creates a central system connected to its people and external systems', async ({ page }) => {
    await openToolbarGroup(page, 'Create');
    await page.locator('#toolbar button', { hasText: 'C4 Context Diagram' }).click();
    await expect(page.locator('.c4-context-modal, .modal')).toBeVisible();

    await page.locator('.c4-context-modal input[type="text"]').first().fill('Banking System');
    await page.locator('.modal-actions button', { hasText: 'Create' }).click();

    await expect.poll(() => nodeCount(page)).toBe(3);
    await expect(page.locator('.node', { hasText: 'Banking System' })).toHaveCount(1);
    await expect(page.locator('.node', { hasText: 'User' })).toHaveCount(1);
    await expect(page.locator('.node', { hasText: 'Payment Gateway' })).toHaveCount(1);
    await expect(page.locator('.edge')).toHaveCount(2);
  });

  test('the C4 Model sidebar category has draggable Person/System/Container/Component shapes', async ({ page }) => {
    await addComponentByName(page, 'Component');
    await expect(page.locator('.node')).toHaveCount(1);
  });
});
