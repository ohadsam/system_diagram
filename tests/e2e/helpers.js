// Shared helpers for the Playwright e2e suite. Using the search box to find
// sidebar items (rather than expanding a category and scrolling to a deep
// item) keeps tests robust regardless of category order/size.

export async function dismissHints(page) {
  const skip = page.locator('.hint-bubble .btn-link', { hasText: 'Skip all' });
  if (await skip.count()) await skip.click();
}

/** Adds a component to the canvas by exact sidebar item name (via search + click).
 * Deliberately does not re-focus/clear the search box afterwards — the app
 * focuses the newly created node so keyboard shortcuts work right away, and
 * clearing search here would steal that focus back. */
export async function addComponentByName(page, name) {
  const search = page.locator('.sidebar-search input');
  await search.fill(name);
  await page.waitForTimeout(150);
  await page.locator('.sidebar-item').first().click();
  await page.waitForTimeout(100);
}

export async function nodeCount(page) {
  return page.locator('.node').count();
}

export async function edgeCount(page) {
  return page.locator('.edge').count();
}

/** Drags a node by (dx, dy) screen pixels — useful to separate two nodes that were both added at the canvas center. */
export async function dragNodeBy(page, nodeLocator, dx, dy) {
  const box = await nodeLocator.boundingBox();
  await nodeLocator.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
}

/** Drags a connector from the right connection point of node A to the center of node B. */
export async function connectNodes(page, nodeALocator, nodeBLocator) {
  const a = await nodeALocator.boundingBox();
  const b = await nodeBLocator.boundingBox();
  await nodeALocator.hover();
  await page.mouse.move(a.x + a.width, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  await page.mouse.up();
}

/** Clicks a connector at a point guaranteed to be on its first (straight) segment,
 * just outside node A's right edge — an elbow-routed path's overall bounding-box
 * center is often on empty space inside the bend, so that's not a safe click target. */
export async function clickEdgeNearNode(page, nodeALocator) {
  const a = await nodeALocator.boundingBox();
  await page.mouse.click(a.x + a.width + 15, a.y + a.height / 2);
}
