import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the diagram autosaves and is restored after a reload', async ({ page }) => {
  await addComponentByName(page, 'Terraform');
  await addComponentByName(page, 'Docker');
  await expect.poll(() => nodeCount(page)).toBe(2);
  await page.waitForTimeout(700); // autosave is debounced ~500ms

  await page.reload();
  await dismissHints(page);
  await expect.poll(() => nodeCount(page)).toBe(2);
});

test('Save As stores a named project that Load can reopen after clearing the canvas', async ({ page }) => {
  await addComponentByName(page, 'Istio');
  await page.locator('#toolbar button', { hasText: 'Save As' }).click();
  await page.locator('.save-as-modal input[type="text"]').fill('Service Mesh Diagram');
  await page.locator('.save-as-modal button', { hasText: 'Save' }).click();
  await expect(page.locator('.save-as-modal')).toHaveCount(0);

  // start a new (empty) diagram
  await page.locator('#toolbar button[title="New diagram"]').click();
  await page.locator('.confirm-modal button', { hasText: 'Start new' }).click();
  await expect.poll(() => nodeCount(page)).toBe(0);

  // reopen the saved project
  await page.locator('#toolbar button', { hasText: 'Load' }).click();
  await expect(page.locator('.saved-project-name', { hasText: 'Service Mesh Diagram' })).toBeVisible();
  await page.locator('.saved-project-row', { hasText: 'Service Mesh Diagram' }).locator('button', { hasText: 'Load' }).click();
  await expect.poll(() => nodeCount(page)).toBe(1);
});

test('Ctrl/Cmd+S saves a checkpoint that appears in the Load list', async ({ page }) => {
  await addComponentByName(page, 'CockroachDB');
  await page.keyboard.press('Control+s');
  await expect(page.locator('.toast-success')).toBeVisible();

  await page.locator('#toolbar button', { hasText: 'Load' }).click();
  await expect(page.locator('.saved-project-row')).toHaveCount(1);
});

test('Export JSON downloads a file, and Import JSON restores it into a fresh canvas', async ({ page }) => {
  await addComponentByName(page, 'RabbitMQ');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#toolbar button', { hasText: 'JSON' }).first().click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();

  await page.locator('#toolbar button[title="New diagram"]').click();
  await page.locator('.confirm-modal button', { hasText: 'Start new' }).click();
  await expect.poll(() => nodeCount(page)).toBe(0);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('#toolbar button', { hasText: 'JSON' }).nth(1).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path);
  await expect.poll(() => nodeCount(page)).toBe(1);
});
