import { test, expect } from '@playwright/test';
import {
  dismissHints, addComponentByName, nodeCount, edgeCount, dragNodeBy, connectNodes, clickEdgeNearNode, openToolbarGroup,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('a State Machine pattern instantiates a whole connected cluster', async ({ page }) => {
  await addComponentByName(page, 'Traffic Light State Machine');
  await expect.poll(() => nodeCount(page)).toBe(4);
  await expect.poll(() => edgeCount(page)).toBe(4);
  const labels = await page.locator('.node-label, .node-external-label').allTextContents();
  expect(labels).toEqual(expect.arrayContaining(['Red', 'Green', 'Yellow']));
});

test('hiding "State Machines" removes it from the sidebar without touching the canvas', async ({ page }) => {
  await addComponentByName(page, 'Traffic Light State Machine');
  await expect.poll(() => nodeCount(page)).toBe(4);

  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await page.locator('.default-settings-modal input[type=checkbox]').nth(2).check();
  await page.locator('.default-settings-modal .modal-close').click();

  await expect(page.locator('.sidebar-category', { hasText: 'State Machines' })).toHaveCount(0);
  await expect.poll(() => nodeCount(page)).toBe(4); // existing canvas content untouched

  // toggling back off brings it back
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await page.locator('.default-settings-modal input[type=checkbox]').nth(2).uncheck();
  await page.locator('.default-settings-modal .modal-close').click();
  await expect(page.locator('.sidebar-category', { hasText: 'State Machines' })).toHaveCount(1);
});

test('Ctrl/Cmd+"+"/"-"/"0" zoom the canvas in, out, and reset to 100%', async ({ page }) => {
  const zoomLabel = page.locator('.zoom-percent');
  await expect(zoomLabel).toHaveText('100%');

  await page.keyboard.press('Control+=');
  await expect(zoomLabel).toHaveText('110%');

  await page.keyboard.press('Control+-');
  await page.keyboard.press('Control+-');
  await expect(zoomLabel).toHaveText('90%');

  await page.keyboard.press('Control+0');
  await expect(zoomLabel).toHaveText('100%');
});

test('deleting a component cascades to delete every connector attached to it', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await addComponentByName(page, 'Nginx Web Server');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160);
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect.poll(() => edgeCount(page)).toBe(1);

  await nodes.nth(0).click({ force: true });
  await page.keyboard.press('Delete');

  await expect.poll(() => nodeCount(page)).toBe(1);
  await expect.poll(() => edgeCount(page)).toBe(0);
});

test('Group ties components together so selecting one selects the whole group; Ungroup releases them', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 0);

  await nodes.nth(0).click({ force: true });
  await nodes.nth(1).click({ force: true, modifiers: ['Shift'] });
  await expect(page.locator('.node.selected')).toHaveCount(2);

  await page.locator('.toolbar-row-context button[title="Group selection"]').click();

  // clicking empty canvas clears selection, then clicking just one grouped node should reselect both
  await page.keyboard.press('Escape');
  await expect(page.locator('.node.selected')).toHaveCount(0);
  await nodes.nth(0).click({ force: true });
  await expect(page.locator('.node.selected')).toHaveCount(2);

  await page.locator('.toolbar-row-context button[title="Ungroup"]').click();
  await page.keyboard.press('Escape');
  await nodes.nth(0).click({ force: true });
  await expect(page.locator('.node.selected')).toHaveCount(1);
});

test('a mixed component+connector selection duplicates and deletes together', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await addComponentByName(page, 'Elasticsearch');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160);
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect.poll(() => edgeCount(page)).toBe(1);

  await nodes.nth(0).click({ force: true });
  const box = await nodes.nth(0).boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + box.width + 15, box.y + box.height / 2);
  await page.keyboard.up('Shift');
  await expect(page.locator('.node.selected')).toHaveCount(1);
  await expect(page.locator('.edge.selected')).toHaveCount(1);

  // Both the component and connector style editors must render at once —
  // they're rendered into separate containers specifically because both
  // renderNodeStyleEditor/renderEdgeStyleEditor clear() their container on
  // entry, so sharing one would let the second wipe out the first's fields.
  await expect(page.locator('.toolbar-context-controls-group')).toHaveCount(2);
  await expect(page.locator('.toolbar-row-context').getByText('Shape', { exact: true })).toBeVisible();
  await expect(page.locator('.toolbar-row-context').getByText('Routing', { exact: true })).toBeVisible();

  await page.locator('.toolbar-row-context button[title="Duplicate (Ctrl+D)"]').click();
  await expect.poll(() => nodeCount(page)).toBe(3);
  await expect.poll(() => edgeCount(page)).toBe(2);

  await page.locator('.toolbar-row-context button[title="Delete (Del)"]').click();
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect.poll(() => edgeCount(page)).toBe(1);
});

test('Magic Arrow mode draws a connector with magic routing', async ({ page }) => {
  await addComponentByName(page, 'Docker');
  await addComponentByName(page, 'Kubernetes');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 260, 0);

  await page.locator('.magic-arrow-btn').click();
  await expect(page.locator('.magic-arrow-btn')).toHaveClass(/active/);

  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect.poll(() => edgeCount(page)).toBe(1);

  await clickEdgeNearNode(page, nodes.nth(0));
  const routingSelect = page.locator('.toolbar-row-context select').nth(1);
  await expect(routingSelect).toHaveValue('magic');
});

test('the toolbar\'s "What\'s new" button opens the version-highlights modal', async ({ page }) => {
  await openToolbarGroup(page, 'Help');
  await page.locator('#toolbar button[title="What\'s new"]').click();
  await expect(page.locator('.whats-new-modal')).toBeVisible();
  await expect(page.locator('.whats-new-entry')).not.toHaveCount(0);
  await page.locator('.whats-new-modal button', { hasText: 'Got it' }).click();
  await expect(page.locator('.whats-new-modal')).toHaveCount(0);
});

test('a brand-new visitor does not see the "What\'s New" modal automatically', async ({ page }) => {
  await expect(page.locator('.whats-new-modal')).toHaveCount(0);
});

test('a returning visitor whose last-seen version differs sees "What\'s New" automatically', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('sdb:v1:savedProjects', '[]');
    window.localStorage.setItem('sdb:v1:lastSeenVersion', '"0.9.0"');
  });
  await page.goto('/index.html');
  await dismissHints(page);
  await expect(page.locator('.whats-new-modal')).toBeVisible();
});
