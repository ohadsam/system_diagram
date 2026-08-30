// Covers the batch of small "ease the user" additions: a smart default
// edge label on connect (core/smartEdgeLabels.js), auto-incrementing a
// duplicated component's name (core/duplicateNaming.js), "Fit to selection"
// (canvas.js#fitToSelection), Find & Replace (core/findReplace.js), the
// pinnable toolbar quick-access row (toolbar/pinnedActionsBar.js), and the
// proactive "Check Diagram" nudge (io/lintWatcher.js).
import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup, addComponentByName, dragNodeBy, connectNodes, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('connecting a backend service to a database auto-fills a sensible default label', async ({ page }) => {
  await addComponentByName(page, 'NestJS');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160);
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect(page.locator('.edge-label', { hasText: 'reads/writes' })).toBeVisible();
});

test('connecting from a load balancer auto-fills "routes to" from its name, even with no category-pair mapping', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await addComponentByName(page, 'Datadog');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160);
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect(page.locator('.edge-label', { hasText: 'routes to' })).toBeVisible();
});

test('connecting two components with no confident pairing leaves the label blank', async ({ page }) => {
  await addComponentByName(page, 'Sticky Note');
  await addComponentByName(page, 'Rectangle');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160);
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect(page.locator('.edge-label')).toHaveText('');
  await expect(page.locator('.edge-label')).toBeHidden();
});

test('duplicating a component auto-increments its name instead of leaving an identical twin', async ({ page }) => {
  await addComponentByName(page, 'NestJS');
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect(page.locator('.node', { hasText: 'NestJS (Node.js) 2' })).toBeVisible();
  // duplicating the duplicate increments again rather than colliding
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(() => nodeCount(page)).toBe(3);
  await expect(page.locator('.node', { hasText: 'NestJS (Node.js) 3' })).toBeVisible();
});

test('"Duplicate entire canvas" (whole-canvas mirror) does not rename anything', async ({ page }) => {
  await addComponentByName(page, 'NestJS');
  await page.locator('#canvas-viewport').click({ position: { x: 40, y: 40 } }); // deselect, land the context menu on empty canvas
  await page.locator('#canvas-viewport').click({ button: 'right', position: { x: 40, y: 40 } });
  await page.locator('.context-menu-item', { hasText: 'Duplicate entire canvas' }).click();
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect(page.locator('.node', { hasText: 'NestJS (Node.js) 2' })).toHaveCount(0);
  await expect(page.locator('.node', { hasText: 'NestJS (Node.js)' })).toHaveCount(2);
});

test('the zoom "Fit" button reflects the current selection, switching between "Fit to screen" and "Fit to selection"', async ({ page }) => {
  await addComponentByName(page, 'NestJS');
  const fitBtn = page.locator('.zoom-controls button.btn-icon', { hasText: '⛶' });
  // Adding a component via the sidebar leaves it selected — the button
  // already reflects that immediately, with no extra click needed.
  await expect(fitBtn).toHaveAttribute('title', 'Fit to selection (1 selected)');
  await page.keyboard.press('Escape');
  await expect(fitBtn).toHaveAttribute('title', 'Fit to screen');
  await page.locator('.node').first().click();
  await expect(fitBtn).toHaveAttribute('title', 'Fit to selection (1 selected)');
});

test('Find & Replace renames a term across every matching label in one step', async ({ page }) => {
  await addComponentByName(page, 'NestJS');
  await page.locator('.node').first().dblclick();
  const inlineInput = page.locator('.inline-edit-input');
  await inlineInput.fill('API Gateway');
  await inlineInput.press('Enter');
  await expect(page.locator('.node', { hasText: 'API Gateway' })).toBeVisible();

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Find & Replace' }).click();
  await expect(page.locator('.find-replace-modal')).toBeVisible();
  await page.locator('.find-replace-modal input[type=text]').first().fill('API Gateway');
  await page.locator('.find-replace-modal input[type=text]').nth(1).fill('Edge Gateway');
  await expect(page.locator('.find-replace-count')).toContainText('1 label');
  await page.locator('.find-replace-modal button', { hasText: 'Replace All' }).click();

  await expect(page.locator('.toast-success', { hasText: 'Replaced in 1 place' })).toBeVisible();
  await expect(page.locator('.node', { hasText: 'Edge Gateway' })).toBeVisible();
  await expect(page.locator('.node', { hasText: 'API Gateway' })).toHaveCount(0);
});

test('pinning an action from the Manage Pinned Toolbar Actions modal adds it as an always-visible toolbar button', async ({ page }) => {
  await expect(page.locator('.toolbar-row-pinned')).toBeHidden();

  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('Manage Pinned');
  await page.locator('.command-palette-item', { hasText: 'Manage Pinned Toolbar Actions' }).click();
  await expect(page.locator('.manage-pinned-actions-modal')).toBeVisible();

  await page.locator('.manage-pinned-actions-modal .pinned-actions-search').fill('Toggle Grid');
  await page.locator('.pinned-actions-all .pinned-actions-checkbox-row input[type=checkbox]').first().check();
  await expect(page.locator('.manage-pinned-actions-modal .pinned-actions-list').first().locator('.pinned-actions-label')).toHaveText('▦ Toggle Grid');
  await page.keyboard.press('Escape');

  const pinnedBtn = page.locator('.toolbar-row-pinned button', { hasText: 'Toggle Grid' });
  await expect(pinnedBtn).toBeVisible();
  await pinnedBtn.click();
  await expect(page.locator('.canvas-viewport.show-grid')).toBeVisible();

  // Unpin again and confirm the row hides once nothing is pinned.
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('Manage Pinned');
  await page.locator('.command-palette-item', { hasText: 'Manage Pinned Toolbar Actions' }).click();
  await page.locator('.pinned-actions-list').first().locator('button', { hasText: '✕' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.toolbar-row-pinned')).toBeHidden();
});

test('a new "Check Diagram" finding surfaces a badge on the toolbar button without opening anything', async ({ page }) => {
  // A connected pair first, so edges.length > 0 (core/diagramLint.js only
  // runs its orphan check once the diagram has at least one connector) —
  // then a third, deliberately unconnected component is the actual finding.
  await addComponentByName(page, 'NestJS');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160);
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await addComponentByName(page, 'Redis');
  await page.mouse.click(600, 550); // deselect, so the debounced watcher settles
  await page.waitForTimeout(1200); // past the 800ms debounce

  await openToolbarGroup(page, 'Tools');
  const lintBtn = page.locator('#toolbar button', { hasText: 'Check Diagram' });
  await expect(lintBtn.locator('.toolbar-lint-nudge-badge')).toBeVisible();

  await lintBtn.click();
  await expect(page.locator('.diagram-lint-modal')).toBeVisible();
  await expect(page.locator('.diagram-lint-item', { hasText: "isn't connected" })).toBeVisible();

  await page.keyboard.press('Escape');
  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('#toolbar button', { hasText: 'Check Diagram' }).locator('.toolbar-lint-nudge-badge')).toBeHidden();
});

test('turning off "Diagram Nudges" stops the badge from appearing', async ({ page }) => {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Diagram Nudges' }).click();

  await addComponentByName(page, 'NestJS');
  await addComponentByName(page, 'PostgreSQL');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160);
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await addComponentByName(page, 'Redis');
  await page.mouse.click(600, 550);
  await page.waitForTimeout(1200);

  await openToolbarGroup(page, 'Tools');
  await expect(page.locator('#toolbar button', { hasText: 'Check Diagram' }).locator('.toolbar-lint-nudge-badge')).toBeHidden();
});
