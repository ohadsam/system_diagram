import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('Command Palette shows a "Recently Used" section for a previously-run action, gone while searching', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('Toggle Grid');
  await page.locator('.command-palette-item', { hasText: 'Toggle Grid' }).click();
  await expect(page.locator('.command-palette-modal')).toBeHidden();

  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('.command-palette-heading', { hasText: 'Recently Used' })).toBeVisible();
  const recentItem = page.locator('.command-palette-heading', { hasText: 'Recently Used' })
    .locator('xpath=following-sibling::button[1]');
  await expect(recentItem).toHaveText(/Toggle Grid/);

  // Typing a real search query hides the recent section again.
  await page.locator('.command-palette-input').fill('arrange');
  await expect(page.locator('.command-palette-heading', { hasText: 'Recently Used' })).toBeHidden();
});

test('re-running a command from the "Recently Used" section works and keeps it at the front', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('Toggle Focus Mode');
  await page.locator('.command-palette-item', { hasText: 'Toggle Focus Mode' }).click();
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('Toggle Grid');
  await page.locator('.command-palette-item', { hasText: 'Toggle Grid' }).click();

  await page.keyboard.press('ControlOrMeta+k');
  const recentItems = page.locator('.command-palette-heading', { hasText: 'Recently Used' })
    .locator('xpath=following-sibling::button');
  await expect(recentItems.first()).toHaveText(/Toggle Grid/);
  await expect(recentItems.nth(1)).toHaveText(/Toggle Focus Mode/);
});

test('a toolbar dropdown remembers recently used actions in a "Recently Used" section with a separator, without duplicating the button', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('.toolbar-dropdown-panel button', { hasText: 'Default Settings' }).click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.default-settings-modal')).toBeHidden();

  await openToolbarGroup(page, 'Create');
  const recentWrap = page.locator('.toolbar-dropdown-panel:not([hidden]) .toolbar-dropdown-recent-wrap');
  await expect(recentWrap).toBeVisible();
  await expect(recentWrap.locator('.toolbar-dropdown-section-label')).toHaveText('🕐 Recently Used');
  await expect(recentWrap.locator('.toolbar-dropdown-separator')).toBeVisible();

  // The button is MOVED into the recent section, not cloned — exactly one
  // "Default Settings" button exists in the panel at a time (a cloned proxy
  // broke every pre-existing toolbar-button locator across the suite the
  // moment an action was used twice in one test — see toolbarDropdown.js's
  // buildRecentSection comment).
  await expect(page.locator('.toolbar-dropdown-panel:not([hidden]) button', { hasText: 'Default Settings' })).toHaveCount(1);
  const recentBtn = recentWrap.locator('button', { hasText: 'Default Settings' });
  await expect(recentBtn).toBeVisible();
  await recentBtn.click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();
});

test('Default Settings lets each "Recently Used" area\'s retention limit be configured, and it\'s applied immediately', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();

  const componentsField = page.locator('.recent-items-settings .field', { hasText: 'Components sidebar' });
  await expect(componentsField).toBeVisible();
  await componentsField.locator('input[type=number]').fill('6');
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();

  for (const name of ['RabbitMQ', 'Nginx', 'Redis Cache', 'PostgreSQL', 'MongoDB', 'Kafka', 'Elasticsearch', 'Memcached']) {
    await addComponentByName(page, name);
  }
  await page.locator('.sidebar-search input').fill('');
  const recentSection = page.locator('.sidebar-category', { hasText: 'Recently Used' }).first();
  await recentSection.locator('.category-toggle').click();
  await expect(recentSection.locator('.sidebar-item')).toHaveCount(6);
});

test('"Clear all Recently Used lists" empties the Command Palette\'s recent section', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('Toggle Grid');
  await page.locator('.command-palette-item', { hasText: 'Toggle Grid' }).click();

  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await page.locator('.default-settings-modal button', { hasText: 'Clear all' }).click();
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();

  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('.command-palette-heading', { hasText: 'Recently Used' })).toBeHidden();
});
