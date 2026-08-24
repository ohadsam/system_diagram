// Shared helpers for the Playwright e2e suite. Using the search box to find
// sidebar items (rather than expanding a category and scrolling to a deep
// item) keeps tests robust regardless of category order/size.

export async function dismissHints(page) {
  const skip = page.locator('.hint-bubble .btn-link', { hasText: 'Skip all' });
  if (await skip.count()) await skip.click();
}

/** Opens one of the toolbar's grouped dropdown menus (see
 * js/toolbar/toolbarDropdown.js — "File", "Create", "Tools", or "Help")
 * so the buttons inside it become visible/clickable. Each dropdown closes
 * itself again after any of its own buttons is used, so this needs calling
 * again before every subsequent interaction with a button in that group. */
export async function openToolbarGroup(page, groupLabel) {
  await page.locator('#toolbar button.toolbar-dropdown-trigger', { hasText: groupLabel }).click();
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

/** Drags a connector from a specific height (0..1 fraction of node A's own
 * height, from its right edge) to a specific height on node B's left edge —
 * unlike connectNodes (which always grabs/drops at the vertical center),
 * this exercises offset-aware anchoring (core/geometry.js#sideAnchor/
 * computeAnchorOffset), e.g. drawing two sequence-diagram messages between
 * the same pair of lifelines at different points in time. */
export async function connectAtHeight(page, nodeALocator, nodeBLocator, yFractionA, yFractionB) {
  const a = await nodeALocator.boundingBox();
  const b = await nodeBLocator.boundingBox();
  await nodeALocator.hover();
  await page.mouse.move(a.x + a.width, a.y + a.height * yFractionA);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y + b.height * yFractionB, { steps: 10 });
  await page.mouse.up();
}

/** Screen-space point along a connector's *rendered* path (via SVG
 * getPointAtLength + getScreenCTM) — not its bounding-box center, which is
 * often empty space inside an elbow route's bend, and not a fixed offset
 * from either endpoint node's edge, since which side a connector actually
 * anchors on is picked automatically from the two nodes' relative position
 * (core/geometry.js#pickBestSides) rather than fixed to whichever side
 * happened to get dragged from — a screen-math assumption like "just right
 * of node A" broke the moment a test's node layout made the real anchor
 * side something other than right/left.
 *
 * Tries a few points along the path (starting at the midpoint, which stays
 * as far as possible from both endpoint nodes' own hit areas for any path
 * shape) and picks the first one that `elementFromPoint` confirms actually
 * belongs to *this* edge — a selected node's floating style-editor card
 * (positioned near the selection, not aware of every other canvas element
 * under it) can otherwise sit directly on top of the midpoint and silently
 * swallow the click. Falls back to the midpoint if every candidate is
 * covered (shouldn't normally happen). `nth` disambiguates when more than
 * one edge is on the canvas. */
export async function edgeClickPoint(page, nth = 0) {
  const edgeId = await page.locator('.edge').nth(nth).getAttribute('data-edge-id');
  return page.locator('.edge-line').nth(nth).evaluate((el, id) => {
    const len = el.getTotalLength();
    const ctm = el.getScreenCTM();
    const toScreen = (p) => ({ x: p.x * ctm.a + p.y * ctm.c + ctm.e, y: p.x * ctm.b + p.y * ctm.d + ctm.f });
    const fractions = [0.5, 0.3, 0.7, 0.15, 0.85];
    let fallback = null;
    for (const f of fractions) {
      const point = toScreen(el.getPointAtLength(len * f));
      if (!fallback) fallback = point;
      const top = document.elementFromPoint(point.x, point.y);
      if (top?.closest(`[data-edge-id="${id}"]`)) return point;
    }
    return fallback;
  }, edgeId);
}

export async function clickEdgeNearNode(page, nth = 0) {
  const point = await edgeClickPoint(page, nth);
  await page.mouse.click(point.x, point.y);
}

export async function rightClickEdgeNearNode(page, nth = 0) {
  const point = await edgeClickPoint(page, nth);
  await page.mouse.click(point.x, point.y, { button: 'right' });
}
