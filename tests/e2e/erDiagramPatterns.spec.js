import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, edgeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('"ER: E-Commerce Order Schema" instantiates five entities with their attribute rows and four relationship edges', async ({ page }) => {
  await addComponentByName(page, 'ER: E-Commerce Order Schema');
  await expect.poll(() => nodeCount(page)).toBe(5);
  await expect.poll(() => edgeCount(page)).toBe(4);

  await expect(page.locator('.node[aria-label="Customer"]')).toBeVisible();
  await expect(page.locator('.node[aria-label="Order"]')).toBeVisible();
  await expect(page.locator('.node[aria-label="Order Item"]')).toBeVisible();
  await expect(page.locator('.node[aria-label="Product"]')).toBeVisible();
  await expect(page.locator('.node[aria-label="Payment"]')).toBeVisible();
  await expect(page.locator('.row-text', { hasText: 'customer_id (FK)' })).toBeVisible();
  await expect(page.locator('.edge-label', { hasText: '1 → N' }).first()).toBeVisible();
});

test('"ER: Self-Referencing Relationship" instantiates one entity with a self-loop edge back to itself', async ({ page }) => {
  await addComponentByName(page, 'ER: Self-Referencing Relationship');
  await expect.poll(() => nodeCount(page)).toBe(1);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await expect(page.locator('.node', { hasText: 'Employee' })).toBeVisible();
  await expect(page.locator('.row-text', { hasText: 'manager_id' })).toBeVisible();
  await expect(page.locator('.edge-label', { hasText: 'reports to' })).toBeVisible();
});
