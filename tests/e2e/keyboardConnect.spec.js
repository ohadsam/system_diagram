import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('Tab-focusing a node selects it, and "C" then a digit connects it to another node with no mouse drag', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');

  // Deselect everything first (a fresh add leaves the new node selected).
  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 20 } });
  await expect(page.locator('.node.selected')).toHaveCount(0);

  // Keyboard-only focus (no pointerdown) must select the node.
  await page.evaluate(() => document.querySelectorAll('.node')[0].focus());
  await expect(page.locator('.node').first()).toHaveClass(/selected/);

  await page.keyboard.press('c');
  await expect(page.locator('.keyboard-connect-badge')).toHaveCount(1);

  await page.keyboard.press('1');
  await expect(page.locator('.edge')).toHaveCount(1);
  await expect(page.locator('.keyboard-connect-badge')).toHaveCount(0, { timeout: 1000 });
});

test('Escape cancels keyboard-connect mode without creating a connector', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');
  await page.locator('#canvas-viewport').click({ position: { x: 20, y: 20 } });
  await page.evaluate(() => document.querySelectorAll('.node')[0].focus());
  await page.keyboard.press('c');
  await expect(page.locator('.keyboard-connect-badge')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.keyboard-connect-badge')).toHaveCount(0);
  await expect(page.locator('.edge')).toHaveCount(0);
});
