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
  await page.locator('#toolbar button', { hasText: 'Add Shape' }).click();
  await expect(page.locator('.shape-picker-modal')).toBeVisible();
  await page.locator('.shape-card', { hasText: 'Diamond' }).click();
  await expect.poll(() => nodeCount(page)).toBe(1);
  await expect(page.locator('.node[data-shape="diamond"]')).toHaveCount(1);
});

test('adding the same shape twice from "Add Shape" (without moving either) still leaves both individually clickable', async ({ page }) => {
  for (let i = 0; i < 2; i += 1) {
    await page.locator('#toolbar button', { hasText: 'Add Shape' }).click();
    await page.locator('.shape-card', { hasText: 'Circle' }).click();
  }
  await expect.poll(() => nodeCount(page)).toBe(2);

  const nodes = page.locator('.node');
  for (let i = 0; i < 2; i += 1) {
    await nodes.nth(i).click({ timeout: 5000 });
    await expect(nodes.nth(i)).toHaveClass(/selected/);
  }
});

test('a "server with rows" node lets you add and remove rows', async ({ page }) => {
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

test('diamond and hexagon shapes render a border that hugs their clip-path outline, not the rectangular box underneath', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  const node = page.locator('.node').first();
  await node.click();

  const shapeSelect = page.locator('.toolbar-row-context select').first();
  for (const shape of ['diamond', 'hexagon']) {
    await shapeSelect.selectOption(shape);
    await expect(page.locator(`.node[data-shape="${shape}"]`)).toHaveCount(1);
    const body = node.locator('.node-body');
    const styles = await body.evaluate((el) => {
      const before = getComputedStyle(el, '::before');
      return {
        bodyBackground: getComputedStyle(el).backgroundColor,
        beforeBackground: before.backgroundColor,
        beforeClipPath: before.clipPath,
        bodyClipPath: getComputedStyle(el).clipPath,
      };
    });
    // The outer .node-body is the "stroke" layer (filled with the border
    // color across the whole clipped polygon); the inset ::before is the
    // "fill" layer sitting on top of it — see css/node.css's header comment
    // on this shape group for why a plain `border` can't follow clip-path.
    expect(styles.bodyBackground).not.toBe(styles.beforeBackground);
    expect(styles.beforeClipPath).toBe(styles.bodyClipPath);
    expect(styles.bodyClipPath).not.toBe('none');
  }
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
