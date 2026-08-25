import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openCostModal(page) {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Cost Breakdown' }).click();
  await expect(page.locator('.cost-breakdown-modal')).toBeVisible();
}

test('entering a monthly cost in the details panel shows a cost badge on the node face', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await page.locator('.node-info-btn').click();
  await page.locator('.details-cost input[type="number"]').fill('45.5');
  await page.locator('.details-cost input[type="number"]').blur();

  await expect(page.locator('.node-cost')).toBeVisible();
  await expect(page.locator('.node-cost')).toContainText('$45.50/mo');
});

test('clearing a monthly cost removes the badge', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await page.locator('.node-info-btn').click();
  await page.locator('.details-cost input[type="number"]').fill('20');
  await page.locator('.details-cost input[type="number"]').blur();
  await expect(page.locator('.node-cost')).toBeVisible();

  await page.locator('.details-cost button', { hasText: 'Clear' }).click();
  await expect(page.locator('.node-cost')).toHaveCount(0);
});

test('adding a label in the details panel shows a label chip on the node face', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await page.locator('.node-info-btn').click();
  const labelInput = page.locator('.details-labels input[type="text"]');
  await labelInput.fill('99.9% SLA');
  await labelInput.press('Enter');

  await expect(page.locator('.node-label-chip')).toHaveText('99.9% SLA');
});

test('"Cost Breakdown" shows an empty state with no costed components, then lists components and a total', async ({ page }) => {
  await openCostModal(page);
  await expect(page.locator('.cost-breakdown-empty')).toBeVisible();
  await page.locator('.modal-close').click();

  await addComponentByName(page, 'Nginx Web Server');
  await page.locator('.node-info-btn').click();
  await page.locator('.details-cost input[type="number"]').fill('10');
  await page.locator('.details-cost input[type="number"]').blur();
  await page.locator('.details-close').click();

  await addComponentByName(page, 'RabbitMQ');
  await page.locator('.node').nth(1).click();
  await page.locator('.node-info-btn').nth(1).click();
  await page.locator('.details-cost input[type="number"]').fill('25');
  await page.locator('.details-cost input[type="number"]').blur();

  await openCostModal(page);
  await expect(page.locator('.cost-breakdown-row')).toHaveCount(2);
  await expect(page.locator('.cost-breakdown-total-amount')).toHaveText('$35/mo');
  // Sorted highest-cost first.
  await expect(page.locator('.cost-breakdown-row').first()).toContainText('RabbitMQ');
});

test('clicking a row in the cost breakdown modal jumps to and selects that component', async ({ page }) => {
  await addComponentByName(page, 'Nginx Web Server');
  await page.locator('.node-info-btn').click();
  await page.locator('.details-cost input[type="number"]').fill('10');
  await page.locator('.details-cost input[type="number"]').blur();
  await page.locator('.details-close').click();

  await openCostModal(page);
  await page.locator('.cost-breakdown-row').first().click();
  await expect(page.locator('.cost-breakdown-modal')).toBeHidden();
  await expect(page.locator('.node.selected')).toHaveCount(1);
});
