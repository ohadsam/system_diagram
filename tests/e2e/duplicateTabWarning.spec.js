import { test, expect } from '@playwright/test';
import { dismissHints } from './helpers.js';

test('opening a second tab of the app warns both tabs about editing the same diagram', async ({ context }) => {
  const pageA = await context.newPage();
  await pageA.goto('/index.html');
  await dismissHints(pageA);

  // A lone tab shows no warning.
  await expect(pageA.locator('.toast-error')).toHaveCount(0);

  const pageB = await context.newPage();
  await pageB.goto('/index.html');
  await dismissHints(pageB);

  // Both tabs should now see the "already open elsewhere" warning toast —
  // BroadcastChannel is scoped to the browser context (same as same-origin
  // tabs sharing localStorage), which is exactly what context.newPage() gives.
  await expect(pageA.locator('.toast-error')).toBeVisible();
  await expect(pageB.locator('.toast-error')).toBeVisible();
  await expect(pageA.locator('.toast-error')).toContainText('already open in another browser tab');

  await pageA.close();
  await pageB.close();
});
