import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the Default Settings modal changes apply to newly created components', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();

  await page.locator('.default-settings-modal input[type=checkbox]').nth(0).check(); // no background
  await page.locator('.default-settings-modal input[type=checkbox]').nth(1).uncheck(); // hide icon
  await page.locator('.default-settings-modal select').nth(0).selectOption('above'); // text position
  await page.locator('.default-settings-modal select').nth(1).selectOption('full'); // sub-components display
  await page.locator('.default-settings-modal button', { hasText: 'Save' }).click();
  await expect(page.locator('.default-settings-modal')).toHaveCount(0);

  await addComponentByName(page, 'Redis');
  const node = page.locator('.node').first();
  await expect.poll(() => nodeCount(page)).toBe(1);
  await expect(node.locator('.node-icon')).toHaveCount(0);
  await expect(node.locator('.node-external-label')).toHaveCount(1);
  await expect(node.locator('.node-external-label')).toHaveClass(/pos-above/);
  const bg = await node.locator('.node-body').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgba(0, 0, 0, 0)');
});

test('"Apply to all existing components now" bulk-updates every node on the canvas', async ({ page }) => {
  await addComponentByName(page, 'PostgreSQL');
  await addComponentByName(page, 'MongoDB');
  await expect.poll(() => nodeCount(page)).toBe(2);

  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await page.locator('.default-settings-modal input[type=checkbox]').nth(1).uncheck(); // hide icon
  await page.locator('.default-settings-modal button', { hasText: 'Apply to all existing components now' }).click();
  await expect(page.locator('.toast-success')).toBeVisible();

  await expect(page.locator('.node .node-icon')).toHaveCount(0);
});

test('per-node style editor can override text position and icon visibility independently', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await page.locator('.node').first().click({ force: true });
  await expect(page.locator('.toolbar-row-context')).toBeVisible();

  const showIconCheckbox = page.locator('.toolbar-row-context input[type=checkbox]').nth(1);
  await showIconCheckbox.uncheck();
  await expect(page.locator('.node').first().locator('.node-icon')).toHaveCount(0);

  // select order in styleEditor.js: Shape(0), Align(1), Text position(2)
  await page.locator('.toolbar-row-context select').nth(2).selectOption('below');
  await expect(page.locator('.node').first().locator('.node-external-label')).toHaveClass(/pos-below/);
});

test('sub-components display mode ("chips" vs "full") is controllable per node from the details panel', async ({ page }) => {
  await addComponentByName(page, 'DynamoDB');
  const node = page.locator('.node').first();
  await node.hover();
  await node.locator('.node-info-btn').click({ force: true });

  const addBtn = page.locator('.details-body .subcomponent-editor button', { hasText: '+ Add sub-component' });
  await addBtn.click();
  const nameInputs = page.locator('.details-body .subcomponent-row input[type=text]');
  await nameInputs.nth(1).fill('Table');

  await expect(node.locator('.node-subchip')).toHaveCount(1);
  await expect(node.locator('.node-subcomponent-row')).toHaveCount(0);

  await page.locator('.details-body select').first().selectOption('full');
  await expect(node.locator('.node-subcomponent-row')).toHaveCount(1);
  await expect(node.locator('.node-subchip')).toHaveCount(0);
});

test('details panel collapse toggle shrinks it without closing, X fully closes it', async ({ page }) => {
  await addComponentByName(page, 'GraphQL Server');
  const node = page.locator('.node').first();
  await node.hover();
  await node.locator('.node-info-btn').click({ force: true });
  await expect(page.locator('#details-panel')).toHaveClass(/open/);

  await page.locator('.details-collapse-toggle').click();
  await expect(page.locator('#details-panel')).toHaveClass(/collapsed/);
  await expect(page.locator('.details-body')).toBeHidden();

  await page.locator('.details-collapse-toggle').click();
  await expect(page.locator('#details-panel')).not.toHaveClass(/collapsed/);
  await expect(page.locator('.details-body')).toBeVisible();

  await page.locator('.details-close').click();
  await expect(page.locator('#details-panel')).not.toHaveClass(/open/);
});
