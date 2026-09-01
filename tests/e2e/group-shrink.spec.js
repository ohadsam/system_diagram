import { test, expect } from '@playwright/test';
import {
  dismissHints, addComponentByName, nodeCount, dragNodeBy,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

/** Selects the two nodes on the canvas (click + shift-click) and returns the
 * `.node` locator, ready for a right-click on an already-selected member. */
async function selectBoth(page) {
  const nodes = page.locator('.node');
  await nodes.nth(0).click({ force: true });
  await nodes.nth(1).click({ force: true, modifiers: ['Shift'] });
  await expect(page.locator('.node.selected')).toHaveCount(2);
  return nodes;
}

test('"Group & Shrink" collapses a 2-component selection to one visible placeholder with a zoom badge', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await addComponentByName(page, 'MongoDB');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 0);

  await selectBoth(page);
  // Right-clicking a node that's already part of the current multi-selection
  // must not collapse the selection first (see canvas/node.js's pointerdown
  // handler) — this is what makes the menu item operate on both.
  await nodes.nth(0).click({ button: 'right', force: true });
  await page.locator('.context-menu-item', { hasText: 'Group & Shrink' }).click();

  await expect.poll(() => nodeCount(page)).toBe(2); // both still exist in the DOM
  await expect(page.locator('.node:visible')).toHaveCount(1); // only the anchor is shown
  await expect(page.locator('.node-shrunk-anchor')).toHaveCount(1);
  await expect(page.locator('.shrink-badge')).toHaveCount(1);
  await expect(page.locator('.shrink-badge-label')).toHaveText('🗂️ 2 grouped');
  // The regular dashed group-background box is suppressed while shrunk —
  // the badge on the placeholder itself communicates "this is a group".
  await expect(page.locator('.group-bg')).toHaveCount(0);
});

test('the zoom button opens a read-only preview of both grouped components', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await addComponentByName(page, 'MongoDB');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 0);
  await selectBoth(page);
  await nodes.nth(0).click({ button: 'right', force: true });
  await page.locator('.context-menu-item', { hasText: 'Group & Shrink' }).click();

  await page.locator('.shrink-badge-zoom').click();
  const modal = page.locator('.subdiagram-modal');
  await expect(modal).toBeVisible();
  await expect(modal.locator('h2')).toHaveText('🔍 Grouped Components');
  // Not a sequence diagram, so the lifeline-only Mermaid/PlantUML export
  // buttons must not appear (see subDiagramModal.js's isSequenceDiagramGroup).
  await expect(modal.getByText('Copy as Mermaid')).toHaveCount(0);
  await expect(modal.locator('.subdiagram-preview .node')).toHaveCount(2);
  await modal.locator('button', { hasText: 'Close' }).click();
  await expect(modal).toBeHidden();
});

test('"Expand" restores full size while keeping the group, "Ungroup" also dissolves it', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await addComponentByName(page, 'MongoDB');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 0);
  await selectBoth(page);
  await nodes.nth(0).click({ button: 'right', force: true });
  await page.locator('.context-menu-item', { hasText: 'Group & Shrink' }).click();
  await expect(page.locator('.node:visible')).toHaveCount(1);

  // The shrunk placeholder's own context menu offers Expand/Ungroup instead
  // of "Group & Shrink" (which only makes sense before it's shrunk).
  const anchor = page.locator('.node-shrunk-anchor');
  await anchor.click({ button: 'right', force: true });
  await expect(page.locator('.context-menu-item', { hasText: 'Group & Shrink' })).toHaveCount(0);
  await page.locator('.context-menu-item', { hasText: 'Expand' }).click();
  await expect(page.locator('.node:visible')).toHaveCount(2);
  await expect(page.locator('.node-shrunk-anchor')).toHaveCount(0);
  // Still grouped — clicking one member selects both (see canvas.js#selectNode).
  await nodes.nth(0).click({ force: true });
  await expect(page.locator('.node.selected')).toHaveCount(2);

  // Re-shrink, then fully dissolve via "Ungroup" this time. Both are
  // already selected (the group-select above), so right-click straight away
  // — an extra shift-click here would just toggle node[1] back off.
  await nodes.nth(0).click({ button: 'right', force: true });
  await page.locator('.context-menu-item', { hasText: 'Group & Shrink' }).click();
  await page.locator('.node-shrunk-anchor').click({ button: 'right', force: true });
  await page.locator('.context-menu-item', { hasText: 'Ungroup' }).click();
  await expect(page.locator('.node:visible')).toHaveCount(2);
  await nodes.nth(0).click({ force: true });
  await expect(page.locator('.node.selected')).toHaveCount(1, 'no longer grouped — selecting one must not select the other');
});

test('a shrunk group saved as a custom component reopens shrunk when placed again', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await addComponentByName(page, 'MongoDB');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 0);
  await selectBoth(page);
  await nodes.nth(0).click({ button: 'right', force: true });
  await page.locator('.context-menu-item', { hasText: 'Group & Shrink' }).click();

  // Clicking the shrunk placeholder selects the whole (hidden) group, so the
  // usual multi-node save flow captures both members even though only one
  // is currently visible.
  await page.locator('.node-shrunk-anchor').click({ force: true });
  await expect(page.locator('.node.selected')).toHaveCount(2);
  await page.locator('.toolbar-row-context button[title="Save selection as a reusable custom component"]').click();
  await expect(page.locator('.custom-component-modal')).toBeVisible();
  await page.locator('.custom-component-modal input[type="text"]').nth(1).fill('Shrunk Duo');
  await page.locator('.custom-component-modal button', { hasText: 'Save to My Components' }).click();
  await expect(page.locator('.toast-success', { hasText: 'Shrunk Duo' })).toBeVisible();

  const search = page.locator('.sidebar-search input');
  await search.fill('Shrunk Duo');
  await page.waitForTimeout(150);
  const item = page.locator('.sidebar-item', { hasText: 'Shrunk Duo' });
  await expect(item).toBeVisible();
  await item.click();

  await expect.poll(() => nodeCount(page)).toBe(4); // original 2 + newly-instantiated 2
  await expect(page.locator('.node:visible')).toHaveCount(2); // original anchor + new anchor
  await expect(page.locator('.node-shrunk-anchor')).toHaveCount(2);
});
