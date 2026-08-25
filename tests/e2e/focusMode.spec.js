import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, connectNodes, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('Focus Mode dims everything except the selection and its direct neighbors', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'Node.js');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');
  await connectNodes(page, nodes.nth(0), nodes.nth(1)); // API Gateway -> Node.js
  // PostgreSQL (nth 2) stays unconnected — it should be the one that dims.

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Focus Mode' }).click();

  // Nothing selected yet — focus mode has no visible effect.
  await expect(nodes.nth(0)).not.toHaveClass(/dimmed/);
  await expect(nodes.nth(2)).not.toHaveClass(/dimmed/);

  await nodes.nth(0).click();
  await expect(nodes.nth(0)).not.toHaveClass(/dimmed/); // the selection itself
  await expect(nodes.nth(1)).not.toHaveClass(/dimmed/); // direct neighbor via the edge
  await expect(nodes.nth(2)).toHaveClass(/dimmed/); // unconnected — dimmed
  await expect(page.locator('.edge').first()).not.toHaveClass(/dimmed/);

  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 20 } }); // deselect
  await expect(nodes.nth(2)).not.toHaveClass(/dimmed/);
});

test('Focus Mode toggles off cleanly, clearing any dimming', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');

  await openToolbarGroup(page, 'Tools');
  const focusBtn = page.locator('#toolbar button', { hasText: 'Focus Mode' });
  await focusBtn.click();
  await nodes.nth(0).click();
  await expect(nodes.nth(1)).toHaveClass(/dimmed/);

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Focus Mode' }).click();
  await expect(nodes.nth(1)).not.toHaveClass(/dimmed/);
});
