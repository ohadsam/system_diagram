import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, dragNodeBy } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('creating a replication pair from a selection mirrors it as a linked side B', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await page.locator('.node').first().click();
  await page.locator('#toolbar button[title^="Replicate"]').click();
  await expect(page.locator('.replication-modal')).toBeVisible();

  await page.locator('.replication-modal button', { hasText: 'Create replication pair' }).click();
  await expect(page.locator('.toast-success', { hasText: 'Created a replication pair' })).toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect(page.locator('.node.is-replicated')).toHaveCount(2);
});

test('adding a new component to a replicated side auto-mirrors it to the other side', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await page.locator('.node').first().click();
  await page.locator('#toolbar button[title^="Replicate"]').click();
  await page.locator('.replication-modal button', { hasText: 'Create replication pair' }).click();
  await expect.poll(() => nodeCount(page)).toBe(2);

  // Add a brand-new node, then join it (together with the original side-A
  // member) to side A via the modal.
  await addComponentByName(page, 'PostgreSQL');
  await expect.poll(() => nodeCount(page)).toBe(3);
  const pgNode = page.locator('.node', { hasText: 'PostgreSQL' });
  await dragNodeBy(page, pgNode, 0, 160);
  await pgNode.click();
  await page.locator('.node.is-replicated').first().click({ modifiers: ['Shift'] });
  await page.locator('#toolbar button[title^="Replicate"]').click();
  await page.locator('.replication-pair-row button', { hasText: 'Add as side A' }).click();

  await expect(page.locator('.toast-success', { hasText: /Added 1 component|mirroring/ })).toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(4); // pg + its new mirror, on top of the original pair
  await expect(page.locator('.node', { hasText: 'PostgreSQL' })).toHaveCount(2);
});

test('renaming a replicated node propagates the new text to its mirror', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await page.locator('.node').first().click();
  await page.locator('#toolbar button[title^="Replicate"]').click();
  await page.locator('.replication-modal button', { hasText: 'Create replication pair' }).click();
  await expect.poll(() => nodeCount(page)).toBe(2);

  // Creating the pair leaves both sides selected; settle on just this one
  // node first (its own click) so the selection count is stable *before*
  // the double-click gesture starts — double-clicking straight out of a
  // wider selection lets the first click's own selection-shrink reflow the
  // contextual toolbar row under the pointer, which can make the second
  // click land somewhere else entirely.
  const label = page.locator('.node-label').first();
  await label.click();
  await label.dblclick();
  await page.locator('.inline-edit-input').fill('Primary Cache');
  await page.locator('.inline-edit-input').press('Enter');

  await expect(page.locator('.node-label')).toHaveText(['Primary Cache', 'Primary Cache']);
});

test('deleting a replicated node cascade-deletes its mirror too', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await page.locator('.node').first().click();
  await page.locator('#toolbar button[title^="Replicate"]').click();
  await page.locator('.replication-modal button', { hasText: 'Create replication pair' }).click();
  await expect.poll(() => nodeCount(page)).toBe(2);

  await page.locator('.node').first().click();
  await page.keyboard.press('Delete');
  await expect.poll(() => nodeCount(page)).toBe(0);
});

test('excluding a component from replication severs the link without deleting its peer', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await page.locator('.node').first().click();
  await page.locator('#toolbar button[title^="Replicate"]').click();
  await page.locator('.replication-modal button', { hasText: 'Create replication pair' }).click();
  await expect.poll(() => nodeCount(page)).toBe(2);

  await page.locator('.node').first().locator('.node-info-btn').click();
  await expect(page.locator('.details-replication')).toBeVisible();
  await page.locator('.details-replication input[type=checkbox]').check();

  // node count must stay at 2 — excluding must never delete the peer.
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect(page.locator('.details-close')).toBeVisible();
  await page.locator('.details-close').click();

  // Renaming the now-excluded node must no longer propagate. Settle the
  // selection with a plain click first — see the note in the "renaming a
  // replicated node" test above.
  const label = page.locator('.node-label').first();
  await label.click();
  await label.dblclick();
  await page.locator('.inline-edit-input').fill('Solo Now');
  await page.locator('.inline-edit-input').press('Enter');
  await expect(page.locator('.node-label').first()).toHaveText('Solo Now');
  await expect(page.locator('.node-label').nth(1)).not.toHaveText('Solo Now');
});

test('breaking a replication pair from the modal stops future mirroring but keeps both sides as they are', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await page.locator('.node').first().click();
  await page.locator('#toolbar button[title^="Replicate"]').click();
  await page.locator('.replication-modal button', { hasText: 'Create replication pair' }).click();
  await expect.poll(() => nodeCount(page)).toBe(2);

  await page.locator('#canvas-viewport').click({ position: { x: 40, y: 40 } });
  await page.locator('#toolbar button[title^="Replicate"]').click();
  await page.locator('.replication-pair-row button[title="Break this replication pair"]').click();
  await page.locator('.confirm-modal button', { hasText: 'Break' }).click();

  await expect(page.locator('.toast-success', { hasText: 'Replication pair broken' })).toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(2); // both sides untouched
  await expect(page.locator('.node.is-replicated')).toHaveCount(0);
});

test('the new AWS cluster/node/pod components and the replication design patterns are in the library', async ({ page }) => {
  await addComponentByName(page, 'EKS Cluster');
  await expect.poll(() => nodeCount(page)).toBe(1);

  await page.locator('.sidebar-search input').fill('Active-Active Replication');
  await page.waitForTimeout(150);
  await page.locator('.sidebar-item').first().click();
  await page.waitForTimeout(150);
  await expect.poll(() => nodeCount(page)).toBe(1 + 5); // the pattern's 5 nodes
});
