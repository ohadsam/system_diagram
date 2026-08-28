import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('Tools dropdown groups its buttons under labeled sections', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  const labels = page.locator('.toolbar-dropdown-section-label');
  await expect(labels).toHaveCount(5); // ai-tools, collaboration, analysis, layout-tools, visual-extras
  await expect(labels.filter({ hasText: 'AI Tools' })).toBeVisible();
  await expect(labels.filter({ hasText: 'Visual & Presentation' })).toBeVisible();
});

test('default (returning-visitor) storage shows every tool — Basic mode is opt-in, not a surprise regression', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('#toolbar button[title="Interview Mode: practice a system design interview question against a timer, then get AI feedback on the diagram you built"]')).toBeVisible();
  await expect(page.locator('#toolbar button', { hasText: '🧊 3D Presentation' })).toBeVisible();
});

test('switching to Basic mode hides gated tools live, without a reload; switching back to Advanced restores them', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();
  await page.locator('.feature-level-settings select').selectOption('basic');
  await page.locator('.modal-actions-primary button', { hasText: 'Cancel' }).click();

  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('#toolbar button', { hasText: '🧊 3D Presentation' })).toBeHidden();
  await expect(page.locator('#toolbar button', { hasText: '🗺️ Auto-arrange' })).toBeHidden();
  // Core buttons never gated stay visible.
  await expect(page.locator('#toolbar button', { hasText: '▦ Toggle Grid' })).toBeVisible();

  await page.keyboard.press('Escape');
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await page.locator('.feature-level-settings select').selectOption('advanced');
  await page.locator('.modal-actions-primary button', { hasText: 'Cancel' }).click();
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('#toolbar button', { hasText: '🧊 3D Presentation' })).toBeVisible();
});

test('Custom mode lets one pack be toggled independently of the rest', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await page.locator('.feature-level-settings select').selectOption('custom');
  const aiToolsCheckbox = page.locator('.feature-pack-row', { hasText: 'AI Tools' }).locator('input[type="checkbox"]');
  await expect(aiToolsCheckbox).toBeChecked(); // custom starts from "everything on"
  await aiToolsCheckbox.uncheck();
  await page.locator('.modal-actions-primary button', { hasText: 'Cancel' }).click();

  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('#toolbar button', { hasText: '🤖 AI Design Review' })).toBeHidden();
  // A different pack (visual-extras) stays on since only ai-tools was unchecked.
  await expect(page.locator('#toolbar button', { hasText: '🧊 3D Presentation' })).toBeVisible();
});

test('Command Palette can jump straight to the Feature Level section', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('Feature Level');
  await page.locator('.command-palette-item', { hasText: '🧩 Feature Level Settings' }).click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();
  await expect(page.locator('.feature-level-settings')).toBeInViewport();
});

test('sidebar compact toggle hides/shows the built-in category browser; search always still works', async ({ page }) => {
  const compactBtn = page.locator('.sidebar-compact-toggle');
  // Default (returning-visitor) storage: full library.
  await expect(page.locator('.sidebar-category', { hasText: 'Databases' })).toBeVisible();

  await compactBtn.click();
  await expect(page.locator('.sidebar-category', { hasText: 'Databases' })).toBeHidden();
  await expect(page.locator('.sidebar-category', { hasText: 'My Components' })).toBeVisible();

  // Search still reaches everything regardless of compact mode.
  await page.locator('.sidebar-search input').fill('PostgreSQL');
  await expect(page.locator('.sidebar-item', { hasText: 'PostgreSQL' })).toBeVisible();
  await page.locator('.sidebar-search input').fill('');

  await compactBtn.click();
  await expect(page.locator('.sidebar-category', { hasText: 'Databases' })).toBeVisible();
});

test.describe('first-time visitor (empty storage)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('starts in Basic mode with a compact sidebar', async ({ page }) => {
    await page.goto('/index.html');
    await dismissHints(page);

    await openToolbarGroup(page, 'Tools');
    await expect(page.locator('#toolbar button', { hasText: '🧊 3D Presentation' })).toBeHidden();
    await page.keyboard.press('Escape');

    await expect(page.locator('.sidebar-category', { hasText: 'Databases' })).toBeHidden();
    await expect(page.locator('.sidebar-compact-toggle')).toHaveClass(/active/);
  });

  // Seeding *any* localStorage key (even just usageStats) before the app's
  // own bootstrap runs would make io/firstVisitDefaults.js's "nothing at
  // all in storage" check see a non-empty browser and wrongly conclude
  // "returning visitor" — so a milestone-banner test has to seed the
  // first-visit decision explicitly too, not lean on the bootstrap to make
  // it, once anything else is pre-seeded alongside it.
  function seedBasicModeAtSession(sessionCount) {
    localStorage.setItem('sdb:v1:firstVisitDefaultsApplied', 'true');
    localStorage.setItem('sdb:v1:featureLevel', JSON.stringify({ featureMode: 'basic', enabledPacks: [] }));
    localStorage.setItem('sdb:v1:usageStats', JSON.stringify({ sessionCount, suggestionsShownAtSessions: [], suggestionDismissedForever: false }));
  }

  test('the progressive-unlock suggestion banner appears once a Basic-mode visitor hits the first session milestone', async ({ page }) => {
    // Land the visitor exactly on the first milestone by pre-seeding
    // usageStats before the app's own boot sequence increments it —
    // simulates "this is their 3rd time opening the app".
    await page.addInitScript(seedBasicModeAtSession, 2);
    await page.goto('/index.html');
    await dismissHints(page);

    const banner = page.locator('.feature-suggestion-banner');
    await expect(banner).toBeVisible();
    await banner.locator('button', { hasText: '⚙️ Show me' }).click();
    await expect(page.locator('.default-settings-modal')).toBeVisible();
    await expect(page.locator('.feature-level-settings')).toBeInViewport();
  });

  test('"Not now" dismisses the banner for this milestone without disabling future ones', async ({ page }) => {
    await page.addInitScript(seedBasicModeAtSession, 2);
    await page.goto('/index.html');
    await dismissHints(page);
    await page.locator('.feature-suggestion-banner button', { hasText: 'Not now' }).click();
    await expect(page.locator('.feature-suggestion-banner')).toBeHidden();

    const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('sdb:v1:usageStats')));
    assertMilestoneRecorded(stats);
  });
});

function assertMilestoneRecorded(stats) {
  if (!stats.suggestionsShownAtSessions.includes(3)) throw new Error('expected milestone 3 to be recorded as shown');
  if (stats.suggestionDismissedForever) throw new Error('"Not now" must not set suggestionDismissedForever');
}
