import { test, expect } from '@playwright/test';
import { dismissHints, nodeCount, edgeCount, openToolbarGroup, connectAtHeight, rightClickEdgeNearNode, clickEdgeNearNode, dragNodeBy, addComponentByName } from './helpers.js';

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
  // The same notes field also drives a native hover tooltip on the
  // connector itself (an SVG <title> child — see connector.js), so the
  // extra context is visible without opening the details panel.
  await expect(page.locator('.edge title')).toHaveText('Sends the initial request');

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

test('a sequence diagram can be saved as a reusable component and re-instantiated with its messages intact', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.3, 0.3);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await nodes.nth(0).click({ force: true });
  await nodes.nth(1).click({ force: true, modifiers: ['Shift'] });
  await expect(page.locator('.node.selected')).toHaveCount(2);

  await page.locator('.toolbar-row-context button[title="Save selection as a reusable custom component"]').click();
  await expect(page.locator('.custom-component-modal')).toBeVisible();
  await page.locator('.custom-component-modal input[type="text"]').nth(1).fill('Request/Response Flow');
  await page.locator('.custom-component-modal button', { hasText: 'Save to My Components' }).click();
  await expect(page.locator('.toast-success', { hasText: 'Request/Response Flow' })).toBeVisible();

  const search = page.locator('.sidebar-search input');
  await search.fill('Request/Response Flow');
  await page.waitForTimeout(150);
  await page.locator('.sidebar-item', { hasText: 'Request/Response Flow' }).click();

  await expect.poll(() => nodeCount(page)).toBe(4); // original 2 lifelines + the 2 just instantiated
  await expect.poll(() => edgeCount(page)).toBe(2); // original message + the instantiated copy's own message
  await expect(page.locator('.node[data-shape="lifeline"]')).toHaveCount(4);
});

test('a message\'s label position (start/middle/end) can be changed from the connector style editor', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.3, 0.3);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await clickEdgeNearNode(page);
  const labelInput = page.locator('.toolbar-row-context input[data-focus-key="edge-label"]');
  await labelInput.fill('Request');
  await expect(page.locator('.edge-label')).toHaveText('Request');
  const middleX = await page.locator('.edge-label').getAttribute('x');

  const positionSelect = page.locator('.toolbar-row-context select', { has: page.locator('option', { hasText: 'Near start' }) });
  await positionSelect.selectOption('start');
  const startX = await page.locator('.edge-label').getAttribute('x');
  expect(startX).not.toBe(middleX);

  await positionSelect.selectOption('end');
  const endX = await page.locator('.edge-label').getAttribute('x');
  expect(endX).not.toBe(startX);
  expect(endX).not.toBe(middleX);
});

test('"Distribute Evenly" re-spaces lifeline columns and message heights while keeping message order', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server', 'Database']);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  // Drag the middle lifeline off the wizard's even spacing (sideways only —
  // dragNodeBy moves by a screen-pixel offset from wherever hover() lands,
  // which is the node's own center, so this keeps its vertical position).
  await dragNodeBy(page, nodes.nth(1), 40, 0);
  // Deselect it — otherwise its floating style-editor row stays open and can
  // sit right on top of where the next connector gesture needs to drop.
  await page.locator('#canvas-viewport').click({ position: { x: 40, y: 40 } });

  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.15, 0.15);
  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.85, 0.85);
  await expect.poll(() => edgeCount(page)).toBe(2);
  const xsBefore = await nodes.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x));

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Distribute Evenly' }).click();
  await expect(page.locator('.toast-success', { hasText: 'Distributed' })).toBeVisible();

  const xsAfter = await nodes.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x));
  expect(xsAfter).not.toEqual(xsBefore);
  const gap1 = xsAfter[1] - xsAfter[0];
  const gap2 = xsAfter[2] - xsAfter[1];
  expect(Math.abs(gap1 - gap2)).toBeLessThan(1);

  // Message order preserved: badge "1" still above badge "2".
  const badge1Y = await page.locator('.edge-seq-badge').nth(0).locator('circle').getAttribute('cy');
  const badge2Y = await page.locator('.edge-seq-badge').nth(1).locator('circle').getAttribute('cy');
  expect(Number(badge1Y)).toBeLessThan(Number(badge2Y));
});

test('a selected message\'s endpoint handle can be dragged to a different height, reconnecting it in place instead of deleting and redrawing it', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.2, 0.2);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await clickEdgeNearNode(page);
  await expect(page.locator('.edge.selected')).toHaveCount(1);

  const beforeD = await page.locator('.edge-line').first().getAttribute('d');
  const toHandle = page.locator('.edge-endpoint-to');
  const handleBox = await toHandle.boundingBox();
  const serverBox = await nodes.nth(1).boundingBox();

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(serverBox.x + 2, serverBox.y + serverBox.height * 0.85, { steps: 10 });
  await page.mouse.up();

  // Still exactly one edge (reconnected, not duplicated), but its path
  // changed to reflect the new lower drop height.
  await expect.poll(() => edgeCount(page)).toBe(1);
  const afterD = await page.locator('.edge-line').first().getAttribute('d');
  expect(afterD).not.toBe(beforeD);
});

test('a lifeline can send a message to itself (self-call), rendered as a loop, with an editable label', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');

  // Same lifeline both as source and target, at two different heights —
  // connectAtHeight grabs from A's right edge and drops at B's left-edge x,
  // which for A===B still lands over the same node, exercising the new
  // same-node drop path in connectorInteractions.js.
  await connectAtHeight(page, nodes.nth(0), nodes.nth(0), 0.3, 0.5);
  await expect.poll(() => edgeCount(page)).toBe(1);

  const d = await page.locator('.edge-line').first().getAttribute('d');
  // A self-loop path has 4 points (3 segments: out, across, back in) —
  // straight-line or elbow paths between two different nodes never produce
  // this many distinct points for a single connector.
  expect(d.trim().split(/[ML]/).filter(Boolean).length).toBeGreaterThanOrEqual(4);

  await rightClickEdgeNearNode(page);
  await page.locator('.context-menu-item', { hasText: 'Open details' }).click();
  await expect(page.locator('.details-panel.open')).toBeVisible();
  await page.locator('.details-panel .details-title-input').fill('Validate input');
  await expect(page.locator('.edge-label')).toHaveText('Validate input');
});

test('grouping a sequence diagram shows a zoom-in icon that opens a read-only preview, with an Edit flow that saves changes back', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.3, 0.3);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await nodes.nth(0).click({ force: true });
  await nodes.nth(1).click({ force: true, modifiers: ['Shift'] });
  await page.locator('.toolbar-row-context button[title="Group selection"]').click();
  await page.keyboard.press('Escape');
  // A 640px-tall lifeline pair taller than the viewport starts with its top
  // (and the group background's own top-edge icons) scrolled off-screen at
  // the wizard's default centered placement — fit-to-screen first, same as
  // a real user would before trying to click anything near the top edge.
  await page.locator('button[title="Fit to screen"]').click();

  const zoomBtn = page.locator('.group-bg-zoom');
  await expect(zoomBtn).toHaveCount(1);
  await zoomBtn.click({ force: true });
  await expect(page.locator('.subdiagram-modal')).toBeVisible();
  await expect(page.locator('.subdiagram-modal .node[data-shape="lifeline"]')).toHaveCount(2);
  await expect(page.locator('.subdiagram-modal .edge')).toHaveCount(1);

  // The preview is read-only — clicking a node inside it must not create an
  // editable inline-rename input.
  await page.locator('.subdiagram-modal .node').first().dblclick({ force: true });
  await expect(page.locator('.subdiagram-modal .inline-edit-input')).toHaveCount(0);

  await page.locator('.subdiagram-modal button', { hasText: '✏️ Edit' }).click();
  await expect(page.locator('.subdiagram-edit-banner')).toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(2); // only this group's lifelines are on the (temporarily swapped) canvas

  const editNodes = page.locator('.node[data-shape="lifeline"]');
  await connectAtHeight(page, editNodes.nth(0), editNodes.nth(1), 0.6, 0.6);
  await expect.poll(() => edgeCount(page)).toBe(2);

  await page.locator('.subdiagram-edit-banner button', { hasText: 'Done editing' }).click();
  await expect(page.locator('.subdiagram-edit-banner')).toHaveCount(0);
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect.poll(() => edgeCount(page)).toBe(2); // the message added while editing came back with it

  // Pin it — the modal closes and a docked panel takes its place, live-
  // updating as the store changes.
  await zoomBtn.click({ force: true });
  await page.locator('.subdiagram-modal button', { hasText: '📌 Pin to side panel' }).click();
  await expect(page.locator('.subdiagram-modal')).toHaveCount(0);
  const pinPanel = page.locator('.subdiagram-pin-panel');
  await expect(pinPanel).toBeVisible();
  await expect(pinPanel.locator('.node[data-shape="lifeline"]')).toHaveCount(2);
  await pinPanel.locator('button[title="Unpin"]').click();
  await expect(pinPanel).toHaveCount(0);
});

test('exporting PNG/PDF with a grouped sequence diagram on the canvas produces an extra file/page just for it', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await createSequenceDiagram(page, ['Client', 'Server']);
  const lifelines = page.locator('.node[data-shape="lifeline"]');
  await connectAtHeight(page, lifelines.nth(0), lifelines.nth(1), 0.3, 0.3);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await lifelines.nth(0).click({ force: true });
  await lifelines.nth(1).click({ force: true, modifiers: ['Shift'] });
  await page.locator('.toolbar-row-context button[title="Group selection"]').click();
  await page.keyboard.press('Escape');

  await openToolbarGroup(page, 'File');
  const [pngDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#toolbar button[title="Export diagram as PNG image"]').click(),
  ]);
  expect(pngDownload.suggestedFilename()).toMatch(/\.png$/);
  // A second PNG for the sequence diagram group follows the main one.
  const secondPng = await page.waitForEvent('download', { timeout: 5000 });
  expect(secondPng.suggestedFilename()).toMatch(/\.png$/);
  expect(secondPng.suggestedFilename()).not.toBe(pngDownload.suggestedFilename());

  await openToolbarGroup(page, 'File');
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#toolbar button[title="Export diagram as PDF"]').click(),
  ]);
  expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfPath = await pdfDownload.path();
  const pdfBytes = await import('node:fs').then((fs) => fs.promises.readFile(pdfPath));
  const pdfText = pdfBytes.toString('latin1');
  // jsPDF's saved file lists each page's own object — 2 pages (main diagram
  // + the one sequence-diagram group) means 2 "/Type /Page" entries.
  const pageCount = (pdfText.match(/\/Type\s*\/Page[^s]/g) || []).length;
  expect(pageCount).toBe(2);
});

test('replicating a sequence-diagram selection mirrors its message onto side B, and a message drawn later between the mirrors is mirrored back to side A', async ({ page }) => {
  // Wider than the default viewport — side B's mirrored lifelines are
  // offset well to the right of side A (see core/replication.js's
  // REPLICATION_GAP), and both sides need to be genuinely on-screen to
  // drag a new connector on side B.
  await page.setViewportSize({ width: 1600, height: 900 });
  await createSequenceDiagram(page, ['Client', 'Server']);
  const allNodes = page.locator('.node[data-shape="lifeline"]');
  await connectAtHeight(page, allNodes.nth(0), allNodes.nth(1), 0.3, 0.3);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await allNodes.nth(0).click({ force: true });
  await allNodes.nth(1).click({ force: true, modifiers: ['Shift'] });
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title^="Replicate"]').click();
  await expect(page.locator('.replication-modal')).toBeVisible();
  await page.locator('.replication-modal button', { hasText: 'Create replication pair' }).click();
  await expect(page.locator('.toast-success', { hasText: 'Created a replication pair' })).toBeVisible();

  await expect.poll(() => nodeCount(page)).toBe(4); // 2 lifelines + 2 mirrors
  await expect.poll(() => edgeCount(page)).toBe(2); // the message + its freshly-mirrored counterpart on side B

  // Draw a brand-new message directly between side B's two mirror lifelines
  // — it should appear back on side A automatically on the next sync pass.
  const mirrors = page.locator('.node[data-shape="lifeline"].is-replicated');
  await expect(mirrors).toHaveCount(4); // both sides show the replication badge
  const sideBNodes = allNodes; // re-query: now 4 lifelines total, sides are nth(0,1)=A and nth(2,3)=B by creation order
  await connectAtHeight(page, sideBNodes.nth(2), sideBNodes.nth(3), 0.6, 0.6);
  await expect.poll(() => edgeCount(page)).toBe(4);
});
