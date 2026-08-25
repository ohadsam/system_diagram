import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openVersionHistory(page) {
  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Version History' }).click();
  await expect(page.locator('.version-history-modal')).toBeVisible();
}

test('"Save Version" captures a named snapshot that appears in the list', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await openVersionHistory(page);

  await page.locator('.version-history-modal button', { hasText: '📸 Save Version' }).click();
  await page.locator('.prompt-modal input[type=text]').fill('First draft');
  await page.locator('.prompt-modal button[type=submit]').click();

  await expect(page.locator('.version-history-row', { hasText: 'First draft' })).toBeVisible();
  await expect(page.locator('.version-history-row', { hasText: 'First draft' })).toContainText('1 component(s)');
});

test('reverting to an earlier version restores its content, and undo brings the newer content back', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await openVersionHistory(page);
  await page.locator('.version-history-modal button', { hasText: '📸 Save Version' }).click();
  await page.locator('.prompt-modal input[type=text]').fill('One component');
  await page.locator('.prompt-modal button[type=submit]').click();
  await page.locator('.version-history-modal .modal-close').click();

  await addComponentByName(page, 'Nginx');
  await expect.poll(() => nodeCount(page)).toBe(2);

  await openVersionHistory(page);
  await page.locator('.version-history-row', { hasText: 'One component' }).locator('button', { hasText: 'Revert' }).click();
  await page.locator('.confirm-modal button.btn-primary', { hasText: 'Revert' }).click();

  await expect.poll(() => nodeCount(page)).toBe(1);

  await page.locator('#canvas-viewport').click({ position: { x: 40, y: 40 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => nodeCount(page)).toBe(2);
});

test('deleting a version removes it from the list', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await openVersionHistory(page);
  await page.locator('.version-history-modal button', { hasText: '📸 Save Version' }).click();
  await page.locator('.prompt-modal input[type=text]').fill('Temp version');
  await page.locator('.prompt-modal button[type=submit]').click();
  await expect(page.locator('.version-history-row', { hasText: 'Temp version' })).toBeVisible();

  await page.locator('.version-history-row', { hasText: 'Temp version' }).locator('button', { hasText: 'Delete' }).click();
  await page.locator('.confirm-modal button.btn-danger', { hasText: 'Delete' }).click();

  await expect(page.locator('.version-history-row', { hasText: 'Temp version' })).toHaveCount(0);
});

test('"Compare with current" shows an added component after the version was saved', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await openVersionHistory(page);
  await page.locator('.version-history-modal button', { hasText: '📸 Save Version' }).click();
  await page.locator('.prompt-modal input[type=text]').fill('Before Nginx');
  await page.locator('.prompt-modal button[type=submit]').click();
  await page.locator('.version-history-modal .modal-close').click();

  await addComponentByName(page, 'Nginx');
  await openVersionHistory(page);
  await page.locator('.version-history-row', { hasText: 'Before Nginx' }).locator('button', { hasText: 'Compare with current' }).click();

  await expect(page.locator('.diagram-compare-modal')).toBeVisible();
  await expect(page.locator('.diagram-compare-modal')).toContainText('component(s) added');
  await expect(page.locator('.diagram-compare-item', { hasText: 'Nginx' })).toBeVisible();
});

test('clicking an added component in the compare view selects it on the canvas', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await openVersionHistory(page);
  await page.locator('.version-history-modal button', { hasText: '📸 Save Version' }).click();
  await page.locator('.prompt-modal input[type=text]').fill('Before Nginx');
  await page.locator('.prompt-modal button[type=submit]').click();
  await page.locator('.version-history-modal .modal-close').click();

  await addComponentByName(page, 'Nginx');
  await openVersionHistory(page);
  await page.locator('.version-history-row', { hasText: 'Before Nginx' }).locator('button', { hasText: 'Compare with current' }).click();
  await page.locator('.diagram-compare-item', { hasText: 'Nginx' }).click();

  await expect(page.locator('.diagram-compare-modal')).toBeHidden();
  await expect(page.locator('.node.selected')).toHaveCount(1);
});

test('"Compare any two" lets picking two versions (including Current) show no differences when nothing changed', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  await openVersionHistory(page);
  await page.locator('.version-history-modal button', { hasText: '📸 Save Version' }).click();
  await page.locator('.prompt-modal input[type=text]').fill('Snapshot A');
  await page.locator('.prompt-modal button[type=submit]').click();
  await page.locator('.version-history-modal button', { hasText: '📸 Save Version' }).click();
  await page.locator('.prompt-modal input[type=text]').fill('Snapshot B');
  await page.locator('.prompt-modal button[type=submit]').click();

  await expect(page.locator('.version-history-compare-picker')).toBeVisible();
  await page.locator('.version-history-compare-row button', { hasText: 'Compare' }).click();

  await expect(page.locator('.diagram-compare-modal')).toBeVisible();
  await expect(page.locator('.diagram-compare-modal')).toContainText('No differences');
});
