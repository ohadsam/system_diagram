import { test, expect } from '@playwright/test';
import { dismissHints } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

/** Right-clicks the first sidebar match for `name` and clicks a context-menu
 * item by its visible text — shared by every test below. */
async function contextMenuAction(page, itemLocator, label) {
  await itemLocator.click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: label }).click();
}

async function addToFavoritesByName(page, name) {
  const search = page.locator('.sidebar-search input');
  await search.fill(name);
  await page.waitForTimeout(150);
  await contextMenuAction(page, page.locator('.sidebar-item').first(), 'Add to Favorites');
  await search.fill('');
}

test('adding a component to Favorites shows it in the Favorites section with a bookmark badge', async ({ page }) => {
  await addToFavoritesByName(page, 'PostgreSQL');
  const favSection = page.locator('.sidebar-category', { hasText: 'Favorites' }).first();
  await expect(favSection.locator('.sidebar-item', { hasText: 'PostgreSQL' })).toBeVisible();
  await expect(favSection.locator('.sidebar-item', { hasText: 'PostgreSQL' }).locator('.item-favorite-badge')).toBeVisible();
});

test('removing from Favorites via the context menu takes it back out of the Favorites section', async ({ page }) => {
  await addToFavoritesByName(page, 'PostgreSQL');
  const favSection = page.locator('.sidebar-category', { hasText: 'Favorites' }).first();
  await contextMenuAction(page, favSection.locator('.sidebar-item', { hasText: 'PostgreSQL' }), 'Remove from Favorites');
  await expect(favSection.locator('.sidebar-item', { hasText: 'PostgreSQL' })).toHaveCount(0);
});

test('a favorited component is still fully draggable/clickable to add to the canvas', async ({ page }) => {
  await addToFavoritesByName(page, 'PostgreSQL');
  const favSection = page.locator('.sidebar-category', { hasText: 'Favorites' }).first();
  await favSection.locator('.sidebar-item', { hasText: 'PostgreSQL' }).click();
  await expect.poll(() => page.locator('.node').count()).toBe(1);
});

test('creating a favorites folder, then moving a favorite into it, groups it under the folder', async ({ page }) => {
  await addToFavoritesByName(page, 'PostgreSQL');
  const favHeader = page.locator('.sidebar-category', { hasText: 'Favorites' }).first();
  await favHeader.locator('.category-icon-btn[title="New folder…"]').click();
  await page.locator('.prompt-modal input[type=text]').fill('Databases');
  await page.locator('.prompt-modal button[type=submit]').click();

  const folder = page.locator('.sidebar-folder', { hasText: 'Databases' }).first();
  await expect(folder).toBeVisible();

  await contextMenuAction(page, page.locator('.sidebar-item', { hasText: 'PostgreSQL' }).first(), 'Databases');
  await expect(folder.locator('.sidebar-item', { hasText: 'PostgreSQL' })).toBeVisible();
});

test('reordering two favorites in the same folder via "Move up" swaps their visual order', async ({ page }) => {
  await addToFavoritesByName(page, 'PostgreSQL');
  await addToFavoritesByName(page, 'MySQL');
  const favSection = page.locator('.sidebar-category', { hasText: 'Favorites' }).first();

  const namesBefore = await favSection.locator('.sidebar-item .item-name').allTextContents();
  expect(namesBefore).toEqual(['PostgreSQL', 'MySQL']);

  await contextMenuAction(page, favSection.locator('.sidebar-item', { hasText: 'MySQL' }), 'Move up');
  const namesAfter = await favSection.locator('.sidebar-item .item-name').allTextContents();
  expect(namesAfter).toEqual(['MySQL', 'PostgreSQL']);
});

test('a subfolder can be added under a folder, and deleting the parent cascades and un-favorites its contents (without deleting the components)', async ({ page }) => {
  await addToFavoritesByName(page, 'PostgreSQL');
  const favHeader = page.locator('.sidebar-category', { hasText: 'Favorites' }).first();
  await favHeader.locator('.category-icon-btn[title="New folder…"]').click();
  await page.locator('.prompt-modal input[type=text]').fill('Databases');
  await page.locator('.prompt-modal button[type=submit]').click();

  await contextMenuAction(page, page.locator('.sidebar-item', { hasText: 'PostgreSQL' }).first(), 'Databases');

  const folderHeader = page.locator('.folder-header', { hasText: 'Databases' });
  await folderHeader.locator('..').locator('.category-icon-btn[title^="Options"]').click();
  await page.locator('.context-menu-item', { hasText: 'Add subfolder' }).click();
  await page.locator('.prompt-modal input[type=text]').fill('SQL');
  await page.locator('.prompt-modal button[type=submit]').click();
  await expect(page.locator('.folder-label', { hasText: 'SQL' })).toBeVisible();

  await folderHeader.locator('..').locator('.category-icon-btn[title^="Options"]').click();
  await page.locator('.context-menu-item', { hasText: 'Delete folder' }).click();
  await expect(page.locator('.confirm-modal')).toContainText('1 subfolder');
  await expect(page.locator('.confirm-modal')).toContainText('1 favorite');
  await page.locator('.confirm-modal button.btn-danger', { hasText: 'Delete' }).click();

  await expect(page.locator('.sidebar-folder', { hasText: 'Databases' })).toHaveCount(0);
  // The component itself must still exist in its normal category, only its favorite/folder was removed.
  await page.locator('.sidebar-search input').fill('PostgreSQL');
  await expect(page.locator('.sidebar-item', { hasText: 'PostgreSQL' })).toHaveCount(1);
});

test('renaming a favorites folder via its options menu updates the visible label', async ({ page }) => {
  const favHeader = page.locator('.sidebar-category', { hasText: 'Favorites' }).first();
  await favHeader.locator('.category-icon-btn[title="New folder…"]').click();
  await page.locator('.prompt-modal input[type=text]').fill('Old Name');
  await page.locator('.prompt-modal button[type=submit]').click();

  const folderHeader = page.locator('.folder-header', { hasText: 'Old Name' });
  await folderHeader.locator('..').locator('.category-icon-btn[title^="Options"]').click();
  await page.locator('.context-menu-item', { hasText: 'Rename' }).click();
  await page.locator('.prompt-modal input[type=text]').fill('New Name');
  await page.locator('.prompt-modal button[type=submit]').click();

  await expect(page.locator('.sidebar-folder', { hasText: 'New Name' })).toBeVisible();
  await expect(page.locator('.sidebar-folder', { hasText: 'Old Name' })).toHaveCount(0);
});
