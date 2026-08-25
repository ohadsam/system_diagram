import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, connectNodes } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

// connectNodes' drag-to-draw gesture auto-selects the freshly-drawn edge
// (see connectorInteractions.js), so waypoint handles are already showing
// by the time each test starts — no extra click-to-select needed (an extra
// click at the edge's own midpoint would actually land on the add-handle
// already sitting there instead of the edge itself).
async function dragAddHandleAway(page) {
  const addHandle = page.locator('.waypoint-add-handle').first();
  const box = await addHandle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 150, { steps: 10 });
  await page.mouse.up();
}

test('dragging a segment midpoint adds a manual waypoint and bends the connector', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');
  await connectNodes(page, nodes.nth(0), nodes.nth(1));

  await expect(page.locator('.waypoint-add-handle').first()).toBeVisible();
  const dBefore = await page.locator('.edge-line').first().getAttribute('d');

  await dragAddHandleAway(page);

  await expect(page.locator('.waypoint-handle')).toHaveCount(1);
  const dAfter = await page.locator('.edge-line').first().getAttribute('d');
  expect(dAfter).not.toEqual(dBefore);
});

test('right-clicking a waypoint handle removes it', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');
  await connectNodes(page, nodes.nth(0), nodes.nth(1));

  await dragAddHandleAway(page);
  await expect(page.locator('.waypoint-handle')).toHaveCount(1);

  await page.locator('.waypoint-handle').first().click({ button: 'right', force: true });
  await expect(page.locator('.waypoint-handle')).toHaveCount(0);
});

test('"Straighten connector" in the right-click menu clears all waypoints', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');
  await connectNodes(page, nodes.nth(0), nodes.nth(1));

  await dragAddHandleAway(page);
  await expect(page.locator('.waypoint-handle')).toHaveCount(1);

  // Dispatched directly on the edge's own <g> rather than a real
  // coordinate-based right-click — the just-added waypoint/add-handles now
  // cover most of the path visually, so there's no pixel reliably still
  // hit-testing to the edge itself; this still exercises the same
  // contextmenu handler (canvas.js#openEdgeContextMenu) either way.
  await page.evaluate(() => {
    const g = document.querySelector('.edge');
    const rect = g.getBoundingClientRect();
    g.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left, clientY: rect.top }));
  });
  await page.locator('.context-menu-item', { hasText: 'Straighten connector' }).click();
  await expect(page.locator('.waypoint-handle')).toHaveCount(0);
});
