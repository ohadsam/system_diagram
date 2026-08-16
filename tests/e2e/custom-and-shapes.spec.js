import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, connectNodes, edgeCount, dragNodeBy, clickEdgeNearNode, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('creating a custom component saves it into "My Components" and it can be placed', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'New Component' }).click();
  await expect(page.locator('.custom-component-modal')).toBeVisible();

  const inputs = page.locator('.custom-component-modal input[type="text"]');
  await inputs.nth(0).fill('🚀');
  await inputs.nth(1).fill('My Cool Service');
  await page.locator('.custom-component-modal button', { hasText: 'Save to My Components' }).click();

  const myComponents = page.locator('.sidebar-category', { hasText: 'My Components' });
  await expect(myComponents.locator('.sidebar-item', { hasText: 'My Cool Service' })).toBeVisible();

  await myComponents.locator('.sidebar-item', { hasText: 'My Cool Service' }).click();
  await expect.poll(() => nodeCount(page)).toBe(1);
});

test('the Add Shape modal drops a basic shape onto the canvas', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'Add Shape' }).click();
  await expect(page.locator('.shape-picker-modal')).toBeVisible();
  await page.locator('.shape-card', { hasText: 'Diamond' }).click();
  await expect.poll(() => nodeCount(page)).toBe(1);
  await expect(page.locator('.node[data-shape="diamond"]')).toHaveCount(1);
});

test('a "server with rows" node lets you add and remove rows', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'Add Shape' }).click();
  await page.locator('.shape-card', { hasText: 'Server (with rows)' }).click();
  const node = page.locator('.node[data-shape="rows"]');
  await expect(node).toHaveCount(1);
  await expect(node.locator('.row-item')).toHaveCount(1);

  await node.click({ force: true });
  await node.locator('.node-add-row').click({ force: true });
  await expect(node.locator('.row-item')).toHaveCount(2);

  await node.locator('.row-item').first().locator('.row-delete').click({ force: true });
  await expect(node.locator('.row-item')).toHaveCount(1);
});

test('selecting a connector reveals the arrow style editor and routing can be changed', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await addComponentByName(page, 'Nginx Web Server');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160); // separate the two (both start centered on top of each other)
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect.poll(() => edgeCount(page)).toBe(1);

  await clickEdgeNearNode(page, nodes.nth(0));
  await expect(page.locator('.toolbar-row-context')).toBeVisible();
  const selects = page.locator('.toolbar-row-context select');
  await expect(selects).toHaveCount(4); // dash, routing, start arrow, end arrow

  const routingSelect = selects.nth(1);
  await routingSelect.selectOption('curved');
  await expect(routingSelect).toHaveValue('curved');
});
