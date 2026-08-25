import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the tab strip stays hidden with only one diagram open', async ({ page }) => {
  await expect(page.locator('.toolbar-row-tabs')).toBeHidden();
});

test('"Open in New Tab..." on a blank diagram opens a second tab and switches to it', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');

  await openToolbarGroup(page, 'File');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Open in New Tab' }).click();
  await expect(page.locator('.add-tab-modal')).toBeVisible();
  await page.locator('.add-tab-modal button', { hasText: '🆕 New blank diagram' }).click();

  await expect(page.locator('.toolbar-row-tabs')).toBeVisible();
  await expect(page.locator('.project-tab')).toHaveCount(2);
  await expect(page.locator('.project-tab.active')).toContainText('Untitled Diagram');
  // The new tab is blank — the API Gateway from the first tab isn't here.
  await expect(page.locator('.node')).toHaveCount(0);
});

test('switching tabs preserves each tab\'s own content', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openToolbarGroup(page, 'File');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Open in New Tab' }).click();
  await page.locator('.add-tab-modal button', { hasText: '🆕 New blank diagram' }).click();
  await addComponentByName(page, 'Redis Cache');
  await expect(page.locator('.node')).toHaveCount(1);

  const tabs = page.locator('.project-tab');
  await tabs.first().click();
  await expect(page.locator('.node')).toHaveCount(1);
  await expect(page.locator('.node')).toContainText('API Gateway');

  await tabs.nth(1).click();
  await expect(page.locator('.node')).toContainText('Redis Cache');
});

test('closing a tab removes it from the strip without deleting the saved project', async ({ page }) => {
  await openToolbarGroup(page, 'File');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Open in New Tab' }).click();
  await page.locator('.add-tab-modal button', { hasText: '🆕 New blank diagram' }).click();
  await expect(page.locator('.project-tab')).toHaveCount(2);

  await page.locator('.project-tab').first().locator('.project-tab-close').click();
  await expect(page.locator('.project-tab')).toHaveCount(0); // back below 2 -> strip hides
  await expect(page.locator('.toolbar-row-tabs')).toBeHidden();

  // The closed tab's project is still reachable from Load — it wasn't deleted.
  await openToolbarGroup(page, 'File');
  await page.locator('.toolbar-dropdown-panel button', { hasText: '📂 Load' }).click();
  await expect(page.locator('.saved-project-row')).toHaveCount(2);
});

test('"Open in New Tab..." can also reopen an already-saved project not currently open', async ({ page }) => {
  await openToolbarGroup(page, 'File');
  await page.locator('.toolbar-dropdown-panel button', { hasText: '💾 Save As' }).click();
  await page.locator('.save-as-modal input').fill('My Saved Diagram');
  await page.locator('.save-as-modal button', { hasText: 'Save' }).click();

  await openToolbarGroup(page, 'File');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Open in New Tab' }).click();
  await page.locator('.add-tab-modal button', { hasText: '🆕 New blank diagram' }).click();
  await expect(page.locator('.project-tab')).toHaveCount(2);

  // Close "My Saved Diagram" — it's still saved, just no longer an open tab,
  // which is what makes it a valid "reopen" candidate below (a project
  // that's already open can't be reopened as a second, duplicate tab).
  await page.locator('.project-tab', { hasText: 'My Saved Diagram' }).locator('.project-tab-close').click();
  await expect(page.locator('.project-tab')).toHaveCount(0);

  await openToolbarGroup(page, 'File');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Open in New Tab' }).click();
  await expect(page.locator('.add-tab-modal .saved-project-row')).toContainText('My Saved Diagram');
  await page.locator('.add-tab-modal .saved-project-row button', { hasText: 'Open' }).click();

  await expect(page.locator('.project-tab')).toHaveCount(2);
  await expect(page.locator('.project-tab.active')).toContainText('My Saved Diagram');
});
