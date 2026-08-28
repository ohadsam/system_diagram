import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openDemoProjectsModal(page) {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'Demo Projects' }).click();
  await expect(page.locator('.demo-projects-modal')).toBeVisible();
}

test('the Demo Projects modal lists every demo, and loading one replaces an empty canvas with real components', async ({ page }) => {
  await openDemoProjectsModal(page);
  const rows = page.locator('.demo-projects-row');
  await expect(rows).toHaveCount(9);

  await rows.filter({ hasText: 'Basic Web App' }).locator('.demo-projects-row-load').click();
  await expect(page.locator('.demo-projects-modal')).toHaveCount(0);
  expect(await nodeCount(page)).toBeGreaterThan(0);
});

test('loading a demo onto a non-empty canvas asks for confirmation first', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  const before = await nodeCount(page);

  await openDemoProjectsModal(page);
  await page.locator('.demo-projects-row', { hasText: 'BPMN Approval Process' }).locator('.demo-projects-row-load').click();
  await expect(page.locator('.app-modal', { hasText: 'Replace the current canvas?' })).toBeVisible();
  await page.locator('.app-modal button', { hasText: 'Replace' }).click();

  const after = await nodeCount(page);
  expect(after).not.toBe(before);
  expect(after).toBeGreaterThan(0);
});

test('the combo demo places both a regular system diagram and lifelines on the same canvas', async ({ page }) => {
  await openDemoProjectsModal(page);
  await page.locator('.demo-projects-row', { hasText: 'Combo' }).locator('.demo-projects-row-load').click();
  await expect(page.locator('.demo-projects-modal')).toHaveCount(0);

  await expect(page.locator('.node[data-shape="lifeline"]')).toHaveCount(4);
  const plainNodes = await page.locator('.node:not([data-shape="lifeline"])').count();
  expect(plainNodes).toBeGreaterThan(0);
});

test('"Clear Canvas" in the Demo Projects modal clears a loaded demo back to blank', async ({ page }) => {
  await openDemoProjectsModal(page);
  await page.locator('.demo-projects-row', { hasText: 'ER Diagram' }).locator('.demo-projects-row-load').click();
  expect(await nodeCount(page)).toBeGreaterThan(0);

  await openDemoProjectsModal(page);
  await page.locator('.demo-projects-clear-btn').click();
  await page.locator('.app-modal button.btn-danger', { hasText: 'Clear canvas' }).click();
  expect(await nodeCount(page)).toBe(0);
});
