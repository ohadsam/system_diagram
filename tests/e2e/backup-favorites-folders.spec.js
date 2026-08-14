import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function saveAs(page, name) {
  await page.locator('#toolbar button', { hasText: 'Save As' }).click();
  await page.locator('.save-as-modal input[type="text"]').fill(name);
  await page.locator('.save-as-modal button', { hasText: 'Save' }).click();
  await expect(page.locator('.save-as-modal')).toHaveCount(0);
}

async function startNewDiagram(page) {
  await page.locator('#toolbar button[title="New diagram"]').click();
  await page.locator('.confirm-modal button', { hasText: 'Start new' }).click();
  await expect.poll(() => nodeCount(page)).toBe(0);
}

test('favoriting a saved project sorts it first and the favorites-only filter narrows the list', async ({ page }) => {
  await addComponentByName(page, 'Terraform');
  await saveAs(page, 'Project A');
  await startNewDiagram(page);
  await addComponentByName(page, 'Docker');
  await saveAs(page, 'Project B');

  await page.locator('#toolbar button', { hasText: 'Load' }).click();
  const rows = page.locator('.saved-project-row');
  await expect(rows).toHaveCount(2);

  // "Project A" was saved first (so sorts second by recency) — favoriting it should move it to the top.
  await rows.filter({ hasText: 'Project A' }).locator('.saved-project-fav-btn').click();
  await expect(rows.first()).toContainText('Project A');

  await page.locator('.saved-project-fav-filter input[type="checkbox"]').check();
  await expect(page.locator('.saved-project-row')).toHaveCount(1);
  await expect(page.locator('.saved-project-row')).toContainText('Project A');
});

test('Load modal "Export all… / Import all…" round-trips saved projects, overwriting on id match', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await saveAs(page, 'Bulk Test Project');

  await page.locator('#toolbar button', { hasText: 'Load' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.load-project-modal button', { hasText: 'Export all…' }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('.load-project-modal button', { hasText: 'Import all…' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path);
  await expect(page.locator('.toast-success', { hasText: 'Imported' })).toBeVisible();
  await expect(page.locator('.saved-project-row')).toHaveCount(1);
});

test('a custom component with a folder groups into a collapsible sidebar sub-group', async ({ page }) => {
  await page.locator('#toolbar button', { hasText: 'New Component' }).click();
  const inputs = page.locator('.custom-component-modal input[type="text"]');
  await inputs.nth(0).fill('☁️');
  await inputs.nth(1).fill('Folder Test Component');
  await inputs.nth(3).fill('AWS Tools'); // Icon(0), Name(1), Description(2), Folder(3)
  await page.locator('.custom-component-modal button', { hasText: 'Save to My Components' }).click();

  const folder = page.locator('.sidebar-folder', { hasText: 'AWS Tools' });
  await expect(folder).toBeVisible();
  await expect(folder.locator('.sidebar-item', { hasText: 'Folder Test Component' })).toBeVisible();

  await folder.locator('.folder-header').click();
  await expect(folder.locator('.folder-list')).toBeHidden();
});

test('sidebar "My Components" header quick-exports and re-imports the whole library', async ({ page }) => {
  await page.locator('#toolbar button', { hasText: 'New Component' }).click();
  const inputs = page.locator('.custom-component-modal input[type="text"]');
  await inputs.nth(0).fill('🚀');
  await inputs.nth(1).fill('Quick Export Test');
  await page.locator('.custom-component-modal button', { hasText: 'Save to My Components' }).click();

  const myComponents = page.locator('.sidebar-category', { hasText: 'My Components' });
  await expect(myComponents.locator('.sidebar-item', { hasText: 'Quick Export Test' })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    myComponents.locator('button[title="Export My Components…"]').click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await myComponents.locator('button[title="Import My Components…"]').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path);
  await expect(page.locator('.toast-success', { hasText: 'Imported' })).toBeVisible();
  await expect(myComponents.locator('.sidebar-item', { hasText: 'Quick Export Test' })).toHaveCount(1);
});

test('Backup & Restore exports a full backup and restores it into a fresh canvas', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await expect.poll(() => nodeCount(page)).toBe(1);

  await page.locator('#toolbar button[title="Backup & restore everything"]').click();
  await expect(page.locator('.backup-modal')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.backup-modal button', { hasText: 'Export full backup…' }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.locator('.backup-modal .modal-close').click();

  await startNewDiagram(page);

  await page.locator('#toolbar button[title="Backup & restore everything"]').click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('.backup-modal button', { hasText: 'Restore full backup…' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path);
  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-modal button', { hasText: 'Restore' }).click();

  await expect.poll(() => nodeCount(page)).toBe(1);
  await expect(page.locator('.toast-success')).toBeVisible();
});
