import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

// A plain substring search for "Load Balancer" also matches "Elastic Load
// Balancer" (which has no curated Smart Suggestions of its own), and
// ordering between the two isn't guaranteed — so these tests need the
// *exact* "Load Balancer" / "Nginx Web Server" items, not whatever the
// search ranks first. addComponentByName() (from helpers.js) is fine for
// unambiguous names elsewhere in this suite. Matching on `.item-name`'s own
// full text (not just `getByText(exact:true)` anywhere in the item) matters
// because the search's <mark> highlight wraps just the matched substring —
// "Elastic Load Balancer" contains a `<mark>Load Balancer</mark>` whose own
// text is an exact match too, so a plain exact-text search still finds both.
// Some names exist in more than one category with the exact same text (e.g.
// "API Gateway" is both a Networking component and an AWS one, and also an
// unrelated Design Pattern) — an optional categoryLabel scopes the match to
// the right `.sidebar-category` section instead of picking whichever one
// happens to render first.
async function addExactComponent(page, name, categoryLabel) {
  const search = page.locator('.sidebar-search input');
  await search.fill(name);
  await page.waitForTimeout(150);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const itemMatch = page.locator('.sidebar-item').filter({ has: page.locator('.item-name', { hasText: new RegExp(`^${escaped}$`) }) });
  const scoped = categoryLabel
    ? page.locator('.sidebar-category').filter({ has: page.locator('.category-label', { hasText: categoryLabel }) }).locator('.sidebar-item').filter({ has: page.locator('.item-name', { hasText: new RegExp(`^${escaped}$`) }) })
    : itemMatch;
  await scoped.first().click();
  await page.waitForTimeout(100);
}

test('placing a component with curated companions shows a suggestions banner, and accepting one adds it', async ({ page }) => {
  await addExactComponent(page, 'Load Balancer');
  await expect(page.locator('.suggestion-banner')).toBeVisible();
  await expect(page.locator('.suggestion-banner')).toContainText('Goes well with Load Balancer');
  await expect(page.locator('.suggestion-banner-btn')).toHaveCount(2); // Nginx Web Server, Auto Scaling Group

  await page.locator('.suggestion-banner-btn', { hasText: 'Nginx Web Server' }).click();
  await expect(page.locator('.suggestion-banner')).toBeHidden();
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect(page.locator('.node', { hasText: 'Nginx Web Server' })).toBeVisible();
});

test('the dismiss (✕) button closes the banner without adding anything', async ({ page }) => {
  await addExactComponent(page, 'Load Balancer');
  await expect(page.locator('.suggestion-banner')).toBeVisible();
  await page.locator('.suggestion-banner-close').click();
  await expect(page.locator('.suggestion-banner')).toBeHidden();
  await expect.poll(() => nodeCount(page)).toBe(1);
});

test('a component with no curated companions shows no banner', async ({ page }) => {
  await addComponentByName(page, 'DNS');
  await expect(page.locator('.suggestion-banner')).toHaveCount(0);
});

test('already-present companions are not re-suggested', async ({ page }) => {
  await addExactComponent(page, 'Load Balancer');
  await page.locator('.suggestion-banner-close').click();
  await addExactComponent(page, 'Nginx Web Server');
  // Load Balancer's other companion (Auto Scaling Group) still offered, but
  // Nginx itself is already on the canvas so shouldn't be re-suggested by
  // its own placement banner (its related list only points back to LB,
  // which is also already present) — no banner at all this time.
  await expect(page.locator('.suggestion-banner')).toBeHidden();
});

test('turning off Smart Suggestions in Default Settings suppresses the banner', async ({ page }) => {
  await page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: 'Create' }).click();
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await page.locator('.default-settings-modal .field-checkbox', { hasText: 'Smart Suggestions' }).locator('input[type=checkbox]').uncheck();
  await page.locator('.default-settings-modal .modal-close').click();

  await addExactComponent(page, 'Load Balancer');
  await expect(page.locator('.suggestion-banner')).toHaveCount(0);
});

// Batch 2: `relatedLayers` — sub-component ("attach as a layer") suggestions,
// offered alongside/instead of the plain `related` companion-component row.
test('placing a component with curated sub-component suggestions shows an "attach" row, and accepting one attaches a layer instead of creating a new node', async ({ page }) => {
  await addComponentByName(page, 'Express (Node.js)'); // be-express: relatedLayers only, no plain `related`
  await expect(page.locator('.suggestion-banner')).toBeVisible();
  await expect(page.locator('.suggestion-banner')).toContainText('Common building blocks for Express');
  await expect(page.locator('.suggestion-banner-btn')).toHaveCount(2); // Controller, Middleware
  await expect(page.locator('.suggestion-banner-btn-layer')).toHaveCount(2);

  await page.locator('.suggestion-banner-btn-layer', { hasText: 'Controller' }).click();
  await expect(page.locator('.suggestion-banner')).toBeHidden();
  await expect.poll(() => nodeCount(page)).toBe(1); // attached, not a new standalone node
  await expect(page.locator('.node-subchip', { hasText: 'Controller' })).toBeVisible();
});

test('a component with both companion and sub-component suggestions shows both rows together, dismissible as one banner', async ({ page }) => {
  await addExactComponent(page, 'API Gateway', 'Networking'); // net-api-gateway: has both `related` and `relatedLayers`
  await expect(page.locator('.suggestion-banner')).toBeVisible();
  await expect(page.locator('.suggestion-banner')).toContainText('Goes well with API Gateway');
  await expect(page.locator('.suggestion-banner')).toContainText('Common building blocks for API Gateway');
  await expect(page.locator('.suggestion-banner-btn-layer')).toHaveCount(2); // Authentication, Rate Limiter

  await page.locator('.suggestion-banner-close').click();
  await expect(page.locator('.suggestion-banner')).toBeHidden();
  await expect.poll(() => nodeCount(page)).toBe(1);
});
