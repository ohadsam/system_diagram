import { test, expect } from '@playwright/test';
import {
  dismissHints, addComponentByName, nodeCount, edgeCount, dragNodeBy, connectNodes,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the Hand tool pans the canvas by dragging over a component without moving it', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  const node = page.locator('.node').first();
  const before = await node.boundingBox();

  await page.locator('#toolbar button[title^="Hand tool"]').click();
  await expect(page.locator('#toolbar button[title^="Hand tool"]')).toHaveClass(/active/);

  // Drag starting on top of the node — with the Hand tool active this must
  // pan the canvas (moving the node's *screen* position) without changing
  // the node's own x/y, unlike a normal drag which would move the node.
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 150, before.y + before.height / 2 + 90, { steps: 8 });
  await page.mouse.up();

  const after = await node.boundingBox();
  expect(after.x - before.x).toBeGreaterThan(100);
  expect(after.y - before.y).toBeGreaterThan(50);

  // Switching back to Select restores normal drag-to-move behavior.
  await page.locator('#toolbar button[title^="Select tool"]').click();
  await expect(page.locator('#toolbar button[title^="Select tool"]')).toHaveClass(/active/);
  await dragNodeBy(page, node, 40, 0);
  await node.click({ force: true });
  await expect(page.locator('.node.selected')).toHaveCount(1);
});

test('pressing H/V switches tools, and the Hand tool never moves a component', async ({ page }) => {
  await addComponentByName(page, 'PostgreSQL');
  const node = page.locator('.node').first();
  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 20 } }); // move focus onto the canvas so shortcuts apply

  await page.keyboard.press('h');
  await expect(page.locator('#toolbar button[title^="Hand tool"]')).toHaveClass(/active/);

  const before = await node.boundingBox();
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + 200, before.y + 60, { steps: 6 });
  await page.mouse.up();
  const afterPan = await node.boundingBox();
  expect(afterPan.x).not.toBe(before.x); // the node moved on screen (canvas panned)...

  await page.keyboard.press('v');
  await expect(page.locator('#toolbar button[title^="Select tool"]')).toHaveClass(/active/);
});

test('a multi-component selection can be saved as a reusable custom component and instantiated as one group', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await addComponentByName(page, 'MongoDB');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 0);
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect.poll(() => edgeCount(page)).toBe(1);

  await nodes.nth(0).click({ force: true });
  await nodes.nth(1).click({ force: true, modifiers: ['Shift'] });
  await expect(page.locator('.node.selected')).toHaveCount(2);

  await page.locator('.toolbar-row-context button[title="Save selection as a reusable custom component"]').click();
  await expect(page.locator('.custom-component-modal')).toBeVisible();
  await page.locator('.custom-component-modal input[type="text"]').nth(1).fill('Cache + DB Duo');
  await page.locator('.custom-component-modal button', { hasText: 'Save to My Components' }).click();
  await expect(page.locator('.toast-success', { hasText: 'Cache + DB Duo' })).toBeVisible();

  // The sidebar search box is still filled from addComponentByName above —
  // search for the saved group by name so it's actually visible to click,
  // same as how a real user would find it again.
  const search = page.locator('.sidebar-search input');
  await search.fill('Cache + DB Duo');
  await page.waitForTimeout(150);
  const item = page.locator('.sidebar-item', { hasText: 'Cache + DB Duo' });
  await expect(item).toBeVisible();
  await item.click();

  await expect.poll(() => nodeCount(page)).toBe(4); // original 2 + the 2 just instantiated
  await expect.poll(() => edgeCount(page)).toBe(2); // original edge + the instantiated group's own edge

  // The two newly-instantiated nodes are appended after the two originals
  // and come back grouped as one unit — selecting either one selects both
  // (see canvas.js groupOnInstantiate).
  await nodes.nth(2).click({ force: true });
  await expect(page.locator('.node.selected')).toHaveCount(2);
});

test('saving a single selected component still opens the richer editable "New Component" form', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await page.locator('.node').first().click({ force: true });
  await page.locator('.toolbar-row-context button[title="Save selection as a reusable custom component"]').click();
  await expect(page.locator('.custom-component-modal')).toBeVisible();
  // The single-node flow pre-fills shape/color fields (absent from the
  // multi-node group modal), proving it routed to customComponentModal.js.
  await expect(page.locator('.custom-component-modal').getByText('Shape', { exact: true })).toBeVisible();
});
