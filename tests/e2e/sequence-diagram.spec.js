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
  // Deselect the first message before drawing the second — otherwise the
  // floating contextual style row (toolbar.js#positionFloatingRow), which
  // grows downward from the first message's anchor, can itself overlap the
  // second drag's target point on a short lifeline.
  await page.keyboard.press('Escape');
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

// Task #192: an instantiated *built-in* template, edited, must be saveable
// as a reusable custom component and favoritable through the exact same
// generic flows every other component/group already has — not a new
// mechanism, so this only verifies the existing save-as-component
// (task #96) and favorites (task #135) machinery also covers this case.
test('an instantiated sequence-diagram template can be edited, saved as a reusable custom component, favorited, and re-instantiated with the edit intact', async ({ page }) => {
  await addComponentByName(page, 'Login Flow');
  await expect.poll(() => nodeCount(page)).toBe(4);

  // Edit: rename the "Client" lifeline before saving.
  const clientLifeline = page.locator('.node[data-shape="lifeline"]', { hasText: 'Client' });
  const clientLabel = clientLifeline.locator('.node-label, .node-external-label');
  await clientLabel.dblclick();
  await page.keyboard.type('Mobile Client');
  await page.keyboard.press('Enter');
  await expect(clientLifeline).toContainText('Mobile Client');

  // Clicking any one grouped lifeline selects the whole group (see
  // canvas.js#selectNode) — groupOnInstantiate already made this a real
  // group the moment it was instantiated.
  await page.locator('.node[data-shape="lifeline"]').first().click({ force: true });
  await expect(page.locator('.node.selected')).toHaveCount(4);

  await page.locator('.toolbar-row-context button[title="Save selection as a reusable custom component"]').click();
  await expect(page.locator('.custom-component-modal')).toBeVisible();
  await page.locator('.custom-component-modal input[type="text"]').nth(1).fill('My Login Flow');
  await page.locator('.custom-component-modal button', { hasText: 'Save to My Components' }).click();
  await expect(page.locator('.toast-success', { hasText: 'My Login Flow' })).toBeVisible();

  const search = page.locator('.sidebar-search input');
  await search.fill('My Login Flow');
  await page.waitForTimeout(150);
  const savedItem = page.locator('.sidebar-item', { hasText: 'My Login Flow' });
  await savedItem.click({ button: 'right' });
  await page.locator('.context-menu-item', { hasText: 'Add to Favorites' }).click();

  await search.fill('');
  const favSection = page.locator('.sidebar-category', { hasText: 'Favorites' }).first();
  await expect(favSection.locator('.sidebar-item', { hasText: 'My Login Flow' })).toBeVisible();
  await expect(favSection.locator('.sidebar-item', { hasText: 'My Login Flow' }).locator('.item-favorite-badge')).toBeVisible();

  await favSection.locator('.sidebar-item', { hasText: 'My Login Flow' }).click();
  await expect.poll(() => nodeCount(page)).toBe(8); // original 4 + the re-instantiated copy's 4
  await expect(page.locator('.node[data-shape="lifeline"]', { hasText: 'Mobile Client' })).toHaveCount(2);
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

test('sync/async/return message presets are offered only for lifeline-to-lifeline messages and set dash+arrowhead together', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.3, 0.3);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await clickEdgeNearNode(page);
  const presetSelect = page.locator('.toolbar-row-context select', { has: page.locator('option', { hasText: 'Async call' }) });
  await expect(presetSelect).toBeVisible();

  await presetSelect.selectOption('async');
  await expect(page.locator('.edge-line')).toHaveAttribute('stroke-dasharray', 'none');
  const asyncMarker = await page.locator('.edge-line').getAttribute('marker-end');
  expect(asyncMarker).toContain('open');

  await presetSelect.selectOption('return');
  const dash = await page.locator('.edge-line').getAttribute('stroke-dasharray');
  expect(dash).not.toBe('none');

  await presetSelect.selectOption('sync');
  await expect(page.locator('.edge-line')).toHaveAttribute('stroke-dasharray', 'none');
  const syncMarker = await page.locator('.edge-line').getAttribute('marker-end');
  expect(syncMarker).toContain('filled');
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

test('right-click a lifeline for "Add lifeline to the right" — a quick way to add one more participant', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  await expect(nodes).toHaveCount(2);
  const before = await nodes.nth(1).boundingBox();

  await nodes.nth(1).click({ button: 'right', force: true });
  await page.locator('.context-menu-item', { hasText: 'Add lifeline to the right' }).click();

  await expect(nodes).toHaveCount(3);
  const after = await nodes.nth(2).boundingBox();
  expect(after.x).toBeGreaterThan(before.x);
  await expect(page.locator('.node', { hasText: 'New Participant' })).toBeVisible();
});

test('right-click a lifeline for "Mark destroyed here" renders an X and can be cleared again', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const lifeline = page.locator('.node[data-shape="lifeline"]').nth(1);
  const box = await lifeline.boundingBox();

  await lifeline.click({ button: 'right', force: true, position: { x: box.width / 2, y: box.height * 0.6 } });
  await page.locator('.context-menu-item', { hasText: 'Mark destroyed here' }).click();

  const marker = lifeline.locator('.lifeline-destroy-marker');
  await expect(lifeline).toHaveClass(/has-destroy-marker/);
  await expect(marker).toBeVisible();

  await lifeline.click({ button: 'right', force: true });
  await page.locator('.context-menu-item', { hasText: 'Clear destroy marker' }).click();
  await expect(lifeline).not.toHaveClass(/has-destroy-marker/);
});

test('right-click a lifeline for "Add activation bar", drag it to move, drag an end to resize, then remove it', async ({ page }) => {
  await createSequenceDiagram(page, ['Client', 'Server']);
  const lifeline = page.locator('.node[data-shape="lifeline"]').nth(1);
  const box = await lifeline.boundingBox();

  await lifeline.click({ button: 'right', force: true, position: { x: box.width / 2, y: box.height * 0.4 } });
  await page.locator('.context-menu-item', { hasText: 'Add activation bar' }).click();

  const bar = lifeline.locator('.lifeline-activation');
  await expect(bar).toHaveCount(1);
  const beforeMove = await bar.boundingBox();

  // Drag the bar body down to move it (both offsets shift together).
  await page.mouse.move(beforeMove.x + beforeMove.width / 2, beforeMove.y + beforeMove.height / 2);
  await page.mouse.down();
  await page.mouse.move(beforeMove.x + beforeMove.width / 2, beforeMove.y + beforeMove.height / 2 + 60, { steps: 5 });
  await page.mouse.up();
  const afterMove = await bar.boundingBox();
  expect(afterMove.y).toBeGreaterThan(beforeMove.y + 30);
  expect(afterMove.height).toBeCloseTo(beforeMove.height, 0);

  // Drag the bottom handle down to resize (grow) it.
  const handle = bar.locator('.activation-handle[data-edge="end"]');
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  const afterResize = await bar.boundingBox();
  expect(afterResize.height).toBeGreaterThan(afterMove.height + 20);

  // Right-click the bar itself removes just that bar.
  await bar.click({ button: 'right', force: true });
  await page.locator('.context-menu-item', { hasText: 'Remove activation bar' }).click();
  await expect(lifeline.locator('.lifeline-activation')).toHaveCount(0);
});

test('"Copy as Mermaid" in the drill-down modal copies valid sequenceDiagram text with the message and participant names', async ({ page }) => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await createSequenceDiagram(page, ['Client', 'Server']);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  await connectAtHeight(page, nodes.nth(0), nodes.nth(1), 0.3, 0.3);
  await expect.poll(() => edgeCount(page)).toBe(1);
  await clickEdgeNearNode(page);
  const labelInput = page.locator('.toolbar-row-context input[data-focus-key="edge-label"]');
  await labelInput.fill('Ping');
  await page.keyboard.press('Escape');

  await nodes.nth(0).click({ force: true });
  await nodes.nth(1).click({ force: true, modifiers: ['Shift'] });
  await page.locator('.toolbar-row-context button[title="Group selection"]').click();
  await page.keyboard.press('Escape');
  await page.locator('button[title="Fit to screen"]').click();
  await page.locator('.group-bg-zoom').click({ force: true });
  await expect(page.locator('.subdiagram-modal')).toBeVisible();

  await page.locator('.subdiagram-modal button', { hasText: '📋 Copy as Mermaid' }).click();
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain('sequenceDiagram');
  expect(clipboardText).toContain('participant P1 as Client');
  expect(clipboardText).toContain('participant P2 as Server');
  expect(clipboardText).toContain(': Ping');

  await page.locator('.subdiagram-modal button', { hasText: '📋 Copy as PlantUML' }).click();
  const plantUmlText = await page.evaluate(() => navigator.clipboard.readText());
  expect(plantUmlText).toContain('@startuml');
  expect(plantUmlText).toContain('@enduml');
  expect(plantUmlText).toContain('participant "Client" as P1');
  expect(plantUmlText).toContain('participant "Server" as P2');
  expect(plantUmlText).toContain(': Ping');
});

test('an "Alt Fragment" box renders its UML pentagon operator tag and is renamable like any other node', async ({ page }) => {
  await addComponentByName(page, 'Alt Fragment');
  await expect.poll(() => nodeCount(page)).toBe(1);

  const node = page.locator('.node').first();
  await expect(node).toHaveClass(/has-fragment-tag/);
  await expect(node.locator('.fragment-tag')).toHaveText('alt');

  const label = node.locator('.node-label, .node-external-label');
  await label.dblclick();
  await page.keyboard.type('user is premium');
  await page.keyboard.press('Enter');
  await expect(node).toContainText('user is premium');
  // Renaming the condition never touches the operator tag itself.
  await expect(node.locator('.fragment-tag')).toHaveText('alt');
});

test('a "Sequence Diagram Templates" pattern instantiates as a real, grouped sequence diagram with correctly-timed messages', async ({ page }) => {
  await addComponentByName(page, 'Login Flow');
  await expect.poll(() => nodeCount(page)).toBe(4);
  await expect(page.locator('.node[data-shape="lifeline"]')).toHaveCount(4);
  await expect.poll(() => edgeCount(page)).toBe(7);

  // groupOnInstantiate: true means it's a real group already — the 🔍
  // zoom-in icon should be available without the user grouping it manually.
  await expect(page.locator('.group-bg')).toHaveCount(1);
  await expect(page.locator('.group-bg-zoom')).toHaveCount(1);

  // Every message landed at a distinct height (not all stacked on the
  // schema's 0.5 default) — 7 messages means 7 distinct sequence badges.
  const badgeTexts = await page.locator('.edge-seq-badge text').allTextContents();
  expect(new Set(badgeTexts).size).toBe(7);
});

test('the new auth/identity/networking templates (PKCE, MFA, RBAC, ABAC, SSO, SCIM, SPA refresh, API key, TCP, UDP) all instantiate as grouped sequence diagrams', async ({ page }) => {
  const templates = [
    ['PKCE Authorization Flow', 3, 8],
    ['SCIM User Provisioning', 3, 9],
    ['MFA Challenge', 3, 8],
    ['RBAC Authorization Check', 3, 6],
    ['ABAC Authorization Check', 4, 7],
    ['SSO (SAML / OIDC)', 3, 8],
    ['SPA Silent Token Refresh', 3, 10],
    ['API Key Authentication', 4, 7],
    ['TCP 3-Way Handshake', 2, 7],
    ['UDP Request/Response', 2, 5],
  ];
  let expectedNodes = 0;
  let expectedEdges = 0;
  for (const [name, lifelineCount, messageCount] of templates) {
    await addComponentByName(page, name);
    expectedNodes += lifelineCount;
    expectedEdges += messageCount;
    await expect.poll(() => nodeCount(page)).toBe(expectedNodes);
    await expect.poll(() => edgeCount(page)).toBe(expectedEdges);
  }
  await expect(page.locator('.group-bg')).toHaveCount(templates.length);
});

test('the second batch of new templates (Password Reset, Magic Link, WebAuthn, Client Credentials, WebSocket, Webhook, Circuit Breaker, Cache-Aside, Saga, Idempotency) all instantiate as grouped sequence diagrams', async ({ page }) => {
  const templates = [
    ['Password Reset Flow', 4, 9],
    ['Passwordless Magic Link Login', 3, 7],
    ['WebAuthn / Passkey Authentication', 3, 8],
    ['OAuth Client Credentials (M2M)', 3, 7],
    ['WebSocket Handshake & Messaging', 2, 7],
    ['Webhook Delivery with Retry', 2, 8],
    ['Circuit Breaker Pattern', 3, 9],
    ['Cache-Aside Pattern', 4, 9],
    ['Saga Pattern (Choreography)', 3, 9],
    ['Idempotent Request Handling', 3, 9],
  ];
  let expectedNodes = 0;
  let expectedEdges = 0;
  for (const [name, lifelineCount, messageCount] of templates) {
    await addComponentByName(page, name);
    expectedNodes += lifelineCount;
    expectedEdges += messageCount;
    await expect.poll(() => nodeCount(page)).toBe(expectedNodes);
    await expect.poll(() => edgeCount(page)).toBe(expectedEdges);
  }
  await expect(page.locator('.group-bg')).toHaveCount(templates.length);
});

test('dragging a "Sequence Diagram Templates" pattern onto an existing node instantiates it positioned next to that node', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await expect.poll(() => nodeCount(page)).toBe(1);
  const gatewayNode = page.locator('.node').first();
  const gatewayBox = await gatewayNode.boundingBox();

  await page.locator('.sidebar-search input').fill('PKCE Authorization Flow');
  await page.waitForTimeout(150);
  const templateItem = page.locator('.sidebar-item[data-name="PKCE Authorization Flow"]');
  await templateItem.scrollIntoViewIfNeeded();
  const itemBox = await templateItem.boundingBox();

  await page.mouse.move(itemBox.x + 10, itemBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(gatewayBox.x + gatewayBox.width / 2, gatewayBox.y + gatewayBox.height / 2, { steps: 10 });
  await expect(gatewayNode).toHaveClass(/pattern-drop-target/);
  await page.mouse.up();

  // The 1 API Gateway node plus PKCE's 3 lifelines, grouped as a real
  // sequence diagram, positioned to the right of (not overlapping) the node.
  await expect.poll(() => nodeCount(page)).toBe(4);
  await expect(page.locator('.node[data-shape="lifeline"]')).toHaveCount(3);
  await expect(page.locator('.group-bg-zoom')).toHaveCount(1);
  const lifelineBox = await page.locator('.node[data-shape="lifeline"]').first().boundingBox();
  expect(lifelineBox.x).toBeGreaterThan(gatewayBox.x + gatewayBox.width);
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

// Batch 4 (this session's third sequence-diagram round): "📥 Import from
// Mermaid" — the inverse of "📋 Copy as Mermaid", reachable from the same
// Create dropdown as the wizard above.
async function openImportMermaidModal(page) {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'Import from Mermaid' }).click();
}

test('"Import from Mermaid" turns pasted sequenceDiagram text into lifelines and messages', async ({ page }) => {
  await openImportMermaidModal(page);
  await page.locator('.import-sequence-mermaid-modal textarea').fill(
    'sequenceDiagram\n' +
    '    participant Client\n' +
    '    participant Server\n' +
    '    Client->>Server: GET /data\n' +
    '    Server-->>Client: 200 OK'
  );
  await page.locator('.import-sequence-mermaid-modal button', { hasText: '📥 Import' }).click();
  await expect(page.locator('.import-sequence-mermaid-modal')).toBeHidden();

  await expect.poll(() => nodeCount(page)).toBe(2);
  const nodes = page.locator('.node[data-shape="lifeline"]');
  await expect(nodes.nth(0)).toContainText('Client');
  await expect(nodes.nth(1)).toContainText('Server');
  await expect.poll(() => edgeCount(page)).toBe(2);
  await expect(page.locator('.group-bg-zoom')).toHaveCount(1); // grouped like the wizard's own output
});

test('"Import from Mermaid" shows an error and creates nothing for text with no participants', async ({ page }) => {
  await openImportMermaidModal(page);
  await page.locator('.import-sequence-mermaid-modal textarea').fill('not mermaid text');
  await page.locator('.import-sequence-mermaid-modal button', { hasText: '📥 Import' }).click();
  await expect(page.locator('.import-sequence-mermaid-modal .sequence-diagram-error')).toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(0);
});

test('hovering a sequence-diagram template in the sidebar shows a preview thumbnail, which disappears on mouseleave', async ({ page }) => {
  await page.locator('.sidebar-search input').fill('PKCE Authorization Flow');
  await page.waitForTimeout(150);
  const templateItem = page.locator('.sidebar-item[data-name="PKCE Authorization Flow"]');
  await templateItem.scrollIntoViewIfNeeded();
  await expect(page.locator('.pattern-preview-popup')).toHaveCount(0);

  await templateItem.hover();
  await expect(page.locator('.pattern-preview-popup')).toBeVisible();
  // PKCE Authorization Flow has 3 lifelines and 8 messages (see
  // data/categories/sequence-templates.js's seq-pkce-flow definition).
  await expect(page.locator('.pattern-preview-lifeline')).toHaveCount(3);
  await expect(page.locator('.pattern-preview-message')).toHaveCount(8);

  await page.mouse.move(0, 0);
  await expect(page.locator('.pattern-preview-popup')).toHaveCount(0);
});

test('typing in the sidebar search while a preview thumbnail is showing does not leave it stuck on screen', async ({ page }) => {
  await page.locator('.sidebar-search input').fill('PKCE Authorization Flow');
  await page.waitForTimeout(150);
  const templateItem = page.locator('.sidebar-item[data-name="PKCE Authorization Flow"]');
  await templateItem.scrollIntoViewIfNeeded();
  await templateItem.hover();
  await expect(page.locator('.pattern-preview-popup')).toBeVisible();

  // Narrowing the search re-renders the sidebar list (sidebar.js#renderList
  // tears down and rebuilds every item), removing the hovered item's DOM
  // node without the mouse ever actually leaving it — the popup must not
  // be left orphaned on screen.
  await page.locator('.sidebar-search input').fill('PKCE Authorization Flow Nonexistent');
  await page.waitForTimeout(150);
  await expect(page.locator('.pattern-preview-popup')).toHaveCount(0);
});

test('hovering a plain (non-sequence-diagram) sidebar item shows no preview thumbnail', async ({ page }) => {
  await page.locator('.sidebar-search input').fill('Load Balancer');
  await page.waitForTimeout(150);
  const item = page.locator('.sidebar-item[data-name="Load Balancer"]').first();
  await item.scrollIntoViewIfNeeded();
  await item.hover();
  await page.waitForTimeout(400); // longer than the preview's own show delay
  await expect(page.locator('.pattern-preview-popup')).toHaveCount(0);
});
