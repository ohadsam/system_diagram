import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('a component with curated sub-component suggestions shows a badge, and it stays even after dismissing the placement-time banner', async ({ page }) => {
  await addComponentByName(page, 'Express (Node.js)'); // be-express: relatedLayers Controller/Middleware
  await expect(page.locator('.node-suggestion-badge')).toBeVisible();

  // Dismissing the one-time placement banner must not remove the
  // persistent badge — the whole point is being able to revisit these
  // suggestions later, not just in the few seconds right after placement.
  await page.locator('.suggestion-banner-close').click();
  await expect(page.locator('.suggestion-banner')).toBeHidden();
  await expect(page.locator('.node-suggestion-badge')).toBeVisible();
});

test('a component with no curated sub-component suggestions shows no badge', async ({ page }) => {
  // The badge button is always in the DOM (createNodeEl renders it
  // unconditionally, same as the replication badge) and only hidden via
  // CSS's `.has-suggestions` class toggle — so this checks visibility, not
  // DOM presence.
  await addComponentByName(page, 'PostgreSQL');
  await expect(page.locator('.node-suggestion-badge')).toBeHidden();
});

test('clicking the badge opens the details panel with a checkbox per suggestion', async ({ page }) => {
  await addComponentByName(page, 'Express (Node.js)');
  await page.locator('.suggestion-banner-close').click();

  await page.locator('.node-suggestion-badge').click();
  await expect(page.locator('.details-panel')).toHaveClass(/open/);
  await expect(page.locator('.suggested-subcomponents')).toBeVisible();
  await expect(page.locator('.suggested-subcomponent-row')).toHaveCount(2);
  await expect(page.locator('.suggested-subcomponent-name')).toContainText(['Controller', 'Middleware']);
});

test('selecting multiple suggestions and clicking "Add selected" attaches all of them in one step, and the badge/section disappear once none remain', async ({ page }) => {
  await addComponentByName(page, 'Express (Node.js)');
  await page.locator('.suggestion-banner-close').click();
  await page.locator('.node-suggestion-badge').click();

  const addBtn = page.locator('.suggested-subcomponents button', { hasText: 'Add selected' });
  await expect(addBtn).toBeDisabled();

  const checkboxes = page.locator('.suggested-subcomponent-row input[type=checkbox]');
  await checkboxes.nth(0).check();
  await expect(addBtn).toHaveText('+ Add selected (1)');
  await checkboxes.nth(1).check();
  await expect(addBtn).toHaveText('+ Add selected (2)');

  await addBtn.click();

  await expect(page.locator('.suggested-subcomponents')).toHaveCount(0);
  await expect(page.locator('.subcomponent-row input:not(.sub-icon-input)')).toHaveCount(2);
  const names = await page.locator('.subcomponent-row input:not(.sub-icon-input)').evaluateAll((els) => els.map((el) => el.value));
  expect(names.sort()).toEqual(['Controller', 'Middleware']);

  // The canvas node itself picks up both sub-chips, and its badge is gone
  // now that every curated suggestion is attached.
  await expect(page.locator('.node-subchip', { hasText: 'Controller' })).toBeVisible();
  await expect(page.locator('.node-subchip', { hasText: 'Middleware' })).toBeVisible();
  await expect(page.locator('.node-suggestion-badge')).toBeHidden();
});

test('adding just one selected suggestion leaves the still-unattached one available, badge included', async ({ page }) => {
  await addComponentByName(page, 'Express (Node.js)');
  await page.locator('.suggestion-banner-close').click();
  await page.locator('.node-suggestion-badge').click();

  await page.locator('.suggested-subcomponent-row', { hasText: 'Controller' }).locator('input[type=checkbox]').check();
  await page.locator('.suggested-subcomponents button', { hasText: 'Add selected' }).click();

  await expect(page.locator('.suggested-subcomponent-row')).toHaveCount(1);
  await expect(page.locator('.suggested-subcomponent-name')).toHaveText('Middleware');
  await expect(page.locator('.node-suggestion-badge')).toBeVisible();
});
