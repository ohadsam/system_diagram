import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('toolbar button opens the command palette', async ({ page }) => {
  await page.locator('#toolbar button[title*="Quick Actions"]').click();
  await expect(page.locator('.command-palette-modal')).toBeVisible();
  await expect(page.locator('.command-palette-input')).toBeFocused();
});

test('Ctrl/Cmd+K opens the command palette from anywhere, including while typing', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('.command-palette-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.command-palette-modal')).toBeHidden();

  // Also works while a text input elsewhere on the page is focused.
  await page.locator('.sidebar-search input').click();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('.command-palette-modal')).toBeVisible();
});

test('typing an app-action query filters to matching actions under "Actions"', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('arrange');
  await expect(page.locator('.command-palette-heading', { hasText: 'Actions' })).toBeVisible();
  await expect(page.locator('.command-palette-item', { hasText: 'Auto-arrange' })).toBeVisible();
});

test('typing a component name shows an "Add a component" result that adds it to the canvas', async ({ page }) => {
  const before = await nodeCount(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('redis');
  await expect(page.locator('.command-palette-heading', { hasText: 'Add a component' })).toBeVisible();
  await page.locator('.command-palette-item', { hasText: 'Add Redis' }).first().click();
  await expect(page.locator('.command-palette-modal')).toBeHidden();
  await expect.poll(() => nodeCount(page)).toBe(before + 1);
});

test('selecting a component first shows its contextual actions ahead of general results', async ({ page }) => {
  await addComponentByName(page, 'Redis Cache');
  await page.locator('.node').first().click();
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('.command-palette-modal')).toBeVisible();
  const headings = page.locator('.command-palette-heading');
  await expect(headings.first()).toContainText('For "Redis Cache"');
});

test('keyboard navigation (ArrowDown/ArrowUp) moves the active highlight, and Enter runs the active item', async ({ page }) => {
  const before = await nodeCount(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('.command-palette-input').fill('redis');
  const items = page.locator('.command-palette-item');
  await expect(items.first()).toHaveClass(/is-active/);

  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toHaveClass(/is-active/);
  await expect(items.first()).not.toHaveClass(/is-active/);

  await page.keyboard.press('ArrowUp');
  await expect(items.first()).toHaveClass(/is-active/);

  await page.keyboard.press('Enter');
  await expect(page.locator('.command-palette-modal')).toBeHidden();
  await expect.poll(() => nodeCount(page)).toBe(before + 1);
});

test('every action added across recent batches is reachable from the palette (release-checklist audit)', async ({ page }) => {
  const expectedLabels = [
    '🔎 Search All Projects', '🗂️ Open in New Tab...', '🕘 Undo History', '🪄 AI Quick Start',
    '🖼️ Import from Image', '💬 Edit with AI', '🧩 C4 Context Diagram', '📥 Import from SQL',
    '🖼️ Template Gallery', '🎓 Demo Projects', '🤝 Collaborate', '💬 Comments', '📋 Outline',
    '🪄 AI Beautify Layout', '📃 Describe Diagram', '🖥️ Presenter Mode', '🎞️ Diagram Animation',
    '💫 Flow Simulation', '🧊 3D Presentation', "🆕 What's New",
  ];
  for (const label of expectedLabels) {
    await page.keyboard.press('ControlOrMeta+k');
    await page.locator('.command-palette-input').fill(label.replace(/^\S+\s/, ''));
    await expect(page.locator('.command-palette-item', { hasText: label })).toBeVisible();
    await page.keyboard.press('Escape');
  }
});
