// Covers three Tools-dropdown-specific UX additions: a "Search actions..."
// box that live-filters its buttons (toolbar/toolbarDropdown.js), per-
// section collapse/expand persisted across reopens/reloads
// (io/uiPrefs.js#collapsedToolsSections, toolbar.js#buildGatedButtonList),
// and a descriptive tooltip audit (every button already had one before this
// batch except "🤖 AI Design Review", fixed here).
import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the Tools dropdown search box filters its buttons live, and clears on reopen', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  const panel = page.locator('.toolbar-dropdown-panel:not([hidden])');
  const search = panel.locator('.toolbar-dropdown-search');
  await expect(search).toBeVisible();
  await expect(search).toBeFocused();

  await search.fill('flow simulation');
  await expect(panel.locator('button', { hasText: '💫 Flow Simulation' })).toBeVisible();
  await expect(panel.locator('button', { hasText: '🗺️ Auto-arrange' })).toBeHidden();
  // A whole section with zero matches disappears, label included.
  await expect(panel.locator('.toolbar-dropdown-section-label', { hasText: 'Collaboration' })).toBeHidden();

  await search.fill('');
  await expect(panel.locator('button', { hasText: '🗺️ Auto-arrange' })).toBeVisible();
  await expect(panel.locator('.toolbar-dropdown-section-label', { hasText: 'Collaboration' })).toBeVisible();

  // Reopening starts with a clean slate — no leftover query or filtering.
  await search.fill('flow simulation');
  await page.keyboard.press('Escape');
  await openToolbarGroup(page, 'Tools');
  await expect(panel.locator('.toolbar-dropdown-search')).toHaveValue('');
  await expect(panel.locator('button', { hasText: '🗺️ Auto-arrange' })).toBeVisible();
});

test('a search with no matches shows "No matching actions."', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  const panel = page.locator('.toolbar-dropdown-panel:not([hidden])');
  await panel.locator('.toolbar-dropdown-search').fill('zzz-nonexistent-action');
  await expect(panel.locator('.toolbar-dropdown-no-results')).toBeVisible();
  await expect(panel.locator('.toolbar-dropdown-no-results')).toHaveText('No matching actions.');
});

test('collapsing a Tools section hides its buttons, keeps its label, and persists across reopen and reload', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  const panel = page.locator('.toolbar-dropdown-panel:not([hidden])');
  const analysisLabel = panel.locator('.toolbar-dropdown-section-toggle', { hasText: 'Analysis & QA' });
  await expect(analysisLabel).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.locator('button', { hasText: '🔍 Check Diagram' })).toBeVisible();

  await analysisLabel.click();
  await expect(analysisLabel).toHaveAttribute('aria-expanded', 'false');
  await expect(analysisLabel).toBeVisible();
  await expect(panel.locator('button', { hasText: '🔍 Check Diagram' })).toBeHidden();
  // Collapsing a section is not itself an "action" — the dropdown stays open.
  await expect(panel).toBeVisible();

  await page.keyboard.press('Escape');
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('.toolbar-dropdown-panel:not([hidden]) .toolbar-dropdown-section-toggle', { hasText: 'Analysis & QA' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.toolbar-dropdown-panel:not([hidden]) button', { hasText: '🔍 Check Diagram' })).toBeHidden();

  await page.reload();
  await dismissHints(page);
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('.toolbar-dropdown-panel:not([hidden]) .toolbar-dropdown-section-toggle', { hasText: 'Analysis & QA' })).toHaveAttribute('aria-expanded', 'false');

  // Re-expanding restores the buttons and the persisted state.
  await page.locator('.toolbar-dropdown-panel:not([hidden]) .toolbar-dropdown-section-toggle', { hasText: 'Analysis & QA' }).click();
  await expect(page.locator('.toolbar-dropdown-panel:not([hidden]) button', { hasText: '🔍 Check Diagram' })).toBeVisible();
});

test('searching for a match inside a collapsed section force-opens it without changing its persisted collapse state', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  const panel = page.locator('.toolbar-dropdown-panel:not([hidden])');
  const analysisLabel = panel.locator('.toolbar-dropdown-section-toggle', { hasText: 'Analysis & QA' });
  await analysisLabel.click();
  await expect(panel.locator('button', { hasText: '🔍 Check Diagram' })).toBeHidden();

  await panel.locator('.toolbar-dropdown-search').fill('check diagram');
  await expect(panel.locator('button', { hasText: '🔍 Check Diagram' })).toBeVisible();
  // The persisted choice itself is untouched — the chevron still reads collapsed.
  await expect(analysisLabel).toHaveAttribute('aria-expanded', 'false');

  await panel.locator('.toolbar-dropdown-search').fill('');
  await expect(panel.locator('button', { hasText: '🔍 Check Diagram' })).toBeHidden();
});

test('every button in the Tools dropdown has a non-empty, descriptive title', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  const panel = page.locator('.toolbar-dropdown-panel:not([hidden])');
  const titles = await panel.locator('button:not(.toolbar-dropdown-section-toggle)').evaluateAll(
    (buttons) => buttons.map((b) => (b.title || '').trim()),
  );
  for (const title of titles) {
    expect(title.length).toBeGreaterThan(0);
  }
  // Spot-check: "AI Design Review" used to be the button's whole title with
  // no explanation of what it actually does — this batch gave it one.
  await expect(panel.locator('button', { hasText: '🤖 AI Design Review' })).toHaveAttribute('title', /AI Design Review:/);
});
