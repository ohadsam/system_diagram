import { test, expect } from '@playwright/test';
import { dismissHints, nodeCount, edgeCount, openToolbarGroup, connectAtHeight, rightClickEdgeNearNode } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function createSequenceDiagram(page, names) {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'Sequence Diagram' }).click();
  const rows = page.locator('.sequence-participant-list .field-row input');
  for (let i = 0; i < names.length; i++) {
    if (i >= (await rows.count())) {
      await page.locator('.sequence-diagram-modal button', { hasText: '+ Add participant' }).click();
    }
    await page.locator('.sequence-participant-list .field-row input').nth(i).fill(names[i]);
  }
  await page.locator('.sequence-diagram-modal button', { hasText: '🔀 Create' }).click();
}

test('the "Sequence Diagram" wizard creates one titled lifeline per participant, evenly spaced', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server', 'Database']);
  await expect.poll(() => nodeCount(page)).toBe(3);

  const nodes = page.locator('.node[data-shape="lifeline"]');
  await expect(nodes).toHaveCount(3);
  await expect(nodes.nth(0)).toContainText('Client');
  await expect(nodes.nth(1)).toContainText('Server');
  await expect(nodes.nth(2)).toContainText('Database');

  const boxes = await Promise.all([0, 1, 2].map((i) => nodes.nth(i).boundingBox()));
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
  expect(boxes[2].x).toBeGreaterThan(boxes[1].x);
});

test('the wizard requires at least 2 non-empty participant names', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'Sequence Diagram' }).click();
  await page.locator('.sequence-participant-list .field-row input').nth(0).fill('Solo');
  await page.locator('.sequence-participant-list .field-row input').nth(1).fill('');
  await page.locator('.sequence-diagram-modal button', { hasText: '🔀 Create' }).click();
  await expect(page.locator('.sequence-diagram-error')).toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(0);
});

test('two messages between the same pair of lifelines at different heights render as distinct, non-overlapping arrows, each auto-numbered', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');

  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.2, 0.2);
  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.6, 0.6);
  await expect.poll(() => edgeCount(page)).toBe(2);

  const [d0, d1] = await page.locator('.edge-line').evaluateAll((els) => els.map((el) => el.getAttribute('d')));
  expect(d0).not.toBe(d1);

  // Both messages connect two lifelines, so each gets an auto-numbered badge.
  await expect(page.locator('.edge-seq-badge text').nth(0)).toHaveText('1');
  await expect(page.locator('.edge-seq-badge text').nth(1)).toHaveText('2');
});

test('a message\'s "Open details" context menu item opens the details panel with an editable notes field that persists', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.3, 0.3);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await rightClickEdgeNearNode(page);
  await page.locator('.context-menu-item', { hasText: 'Open details' }).click();
  await expect(page.locator('.details-panel.open')).toBeVisible();
  const notes = page.locator('.details-panel textarea.details-notes');
  await notes.fill('Sends the initial request');
  await expect(page.locator('.details-panel')).toContainText('Message 1');

  // Deselect and reselect via the same right-click path — the note should
  // have persisted on the edge (selecting the edge alone, without
  // "Open details", does not by itself keep the panel showing it — see
  // detailsPanel.js's selection-sync guard).
  await page.locator('#canvas-viewport').click({ position: { x: 40, y: 40 } });
  await rightClickEdgeNearNode(page);
  await page.locator('.context-menu-item', { hasText: 'Open details' }).click();
  await expect(page.locator('.details-panel textarea.details-notes')).toHaveValue('Sends the initial request');
});

test('Auto-arrange is skipped (with an explanatory toast) while a sequence diagram is on the canvas', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  const before = await nodes.nth(0).boundingBox();

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Auto-arrange' }).click();
  await expect(page.locator('.toast-info', { hasText: 'sequence diagram' })).toBeVisible();

  const after = await nodes.nth(0).boundingBox();
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);
});
