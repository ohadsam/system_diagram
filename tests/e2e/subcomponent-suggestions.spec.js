import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount } from './helpers.js';

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

// A component with curated `relatedPatterns` (flow diagrams) but no
// `relatedLayers` still gets the badge, and its section is independent of
// the sub-component one above — see canvas/suggestions.js#hasSuggestions
// and panel/detailsPanel.js#renderSuggestedPatterns.
test('a component with curated flow-diagram suggestions shows the badge, and the details panel offers them under their own heading', async ({ page }) => {
  await addComponentByName(page, 'OAuth / OIDC'); // sec-oauth: relatedPatterns only, no relatedLayers
  await expect(page.locator('.node-suggestion-badge')).toBeVisible();

  await page.locator('.suggestion-banner-close').click();
  await page.locator('.node-suggestion-badge').click();
  await expect(page.locator('.details-panel')).toHaveClass(/open/);

  // No sub-component suggestions for this one (relatedLayers is empty).
  await expect(page.locator('.suggested-subcomponents')).toHaveCount(0);

  await expect(page.locator('.suggested-patterns')).toBeVisible();
  const rows = page.locator('.suggested-pattern-row');
  await expect(rows).toHaveCount(3); // seq-oauth-handshake, seq-pkce-flow, seq-oauth-client-credentials
  await expect(page.locator('.suggested-pattern-name')).toContainText(['PKCE Authorization Flow']);
});

test('clicking a flow diagram\'s "+ Add" attaches it as a small collapsed indicator on the component (not a full-size diagram next to it), and the suggestion stays available (it isn\'t a one-time attach)', async ({ page }) => {
  await addComponentByName(page, 'OAuth / OIDC');
  await page.locator('.suggestion-banner-close').click();
  await page.locator('.node-suggestion-badge').click();

  await page.locator('.suggested-pattern-row', { hasText: 'PKCE Authorization Flow' }).locator('button', { hasText: '+ Add' }).click();

  // The 1 OAuth node plus PKCE's 3 lifelines all exist in the DOM, but the
  // pattern's own nodes are immediately collapsed into a single small
  // "Group & Shrink" miniature (canvas.js#attachSuggestedPatternAsMiniature)
  // instead of appearing at full size next to the OAuth node — that full-size
  // "separate diagram" look was the literal bug this fixes.
  await expect.poll(() => nodeCount(page)).toBe(4);
  await expect(page.locator('.node[data-shape="lifeline"]')).toHaveCount(3);
  await expect(page.locator('.node[data-shape="lifeline"]:visible')).toHaveCount(1);
  await expect(page.locator('.node:visible', { hasText: 'OAuth / OIDC' }).locator('.node-shrink-thumbnail')).toHaveCount(0);
  await expect(page.locator('.group-bg')).toHaveCount(1);

  // The host node itself stays selected/focused (not the new miniature), so
  // the details panel it was already open on simply keeps showing — adding a
  // flow diagram isn't a one-time "attach": it's still offered right there,
  // unlike a sub-component that disappears from the list once attached.
  await expect(page.locator('.details-panel')).toHaveClass(/open/);
  await expect(page.locator('.suggested-pattern-row', { hasText: 'PKCE Authorization Flow' })).toBeVisible();
});
