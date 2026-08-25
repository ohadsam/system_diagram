import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, edgeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('"ER: One-to-Many Relationship" instantiates two entities with their attribute rows and one labeled edge', async ({ page }) => {
  await addComponentByName(page, 'ER: One-to-Many Relationship');
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await expect(page.locator('.node[aria-label="Customer"]')).toBeVisible();
  await expect(page.locator('.node[aria-label="Order"]')).toBeVisible();
  await expect(page.locator('.row-text', { hasText: 'customer_id (FK)' })).toBeVisible();
  await expect(page.locator('.edge-label', { hasText: '1 → N' })).toBeVisible();
});

test('"ER: Many-to-Many with Join Table" instantiates three entities (two sides + join table) with two edges', async ({ page }) => {
  await addComponentByName(page, 'ER: Many-to-Many with Join Table');
  await expect.poll(() => nodeCount(page)).toBe(3);
  await expect.poll(() => edgeCount(page)).toBe(2);

  await expect(page.locator('.node[aria-label="Student"]')).toBeVisible();
  await expect(page.locator('.node[aria-label="Enrollment"]')).toBeVisible();
  await expect(page.locator('.node[aria-label="Course"]')).toBeVisible();
});

test('"ER: Self-Referencing Relationship" instantiates one entity with a self-loop edge back to itself', async ({ page }) => {
  await addComponentByName(page, 'ER: Self-Referencing Relationship');
  await expect.poll(() => nodeCount(page)).toBe(1);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await expect(page.locator('.node', { hasText: 'Employee' })).toBeVisible();
  await expect(page.locator('.row-text', { hasText: 'manager_id' })).toBeVisible();
  await expect(page.locator('.edge-label', { hasText: 'reports to' })).toBeVisible();
});
