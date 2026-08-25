import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup, connectNodes, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openLintModal(page) {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Check Diagram' }).click();
  await expect(page.locator('.diagram-lint-modal')).toBeVisible();
}

test('"Check Diagram" reports no issues on an empty canvas', async ({ page }) => {
  await openLintModal(page);
  await expect(page.locator('.diagram-lint-empty')).toContainText('No issues found');
});

test('"Check Diagram" flags an unconnected component while other components are wired up', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await addComponentByName(page, 'Nginx');
  const nodes = page.locator('.node');
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await addComponentByName(page, 'RabbitMQ'); // left unconnected
  await expect.poll(() => nodeCount(page)).toBe(3);

  await openLintModal(page);
  await expect(page.locator('.diagram-lint-item')).toHaveCount(1);
  await expect(page.locator('.diagram-lint-item')).toContainText('RabbitMQ');
  await expect(page.locator('.diagram-lint-item')).toContainText("isn't connected");
});

test('clicking a finding closes the modal and selects the flagged component', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await addComponentByName(page, 'Nginx');
  const nodes = page.locator('.node');
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await addComponentByName(page, 'RabbitMQ'); // left unconnected
  await expect.poll(() => nodeCount(page)).toBe(3);

  await openLintModal(page);
  await page.locator('.diagram-lint-item').first().click();
  await expect(page.locator('.diagram-lint-modal')).toBeHidden();
  await expect(page.locator('.node.selected')).toHaveCount(1);
});
