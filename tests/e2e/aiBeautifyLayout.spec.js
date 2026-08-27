import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('AI Beautify Layout: prompt includes both component ids, and applying a valid reply repositions them', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await addComponentByName(page, 'PostgreSQL');

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'AI Beautify Layout' }).click();
  await expect(page.locator('.ai-layout-modal')).toBeVisible();

  const ids = await page.locator('.node').evaluateAll((nodes) => nodes.map((n) => n.dataset.nodeId));
  const prompt = await page.locator('.ai-layout-modal .ai-review-prompt').inputValue();
  for (const id of ids) expect(prompt).toContain(id);

  await page.locator('.ai-layout-modal button', { hasText: 'Next' }).click();
  const reply = `\`\`\`json\n{ "repositions": [ { "id": "${ids[0]}", "x": 500, "y": 500 }, { "id": "${ids[1]}", "x": 900, "y": 500 } ] }\n\`\`\``;
  await page.locator('.ai-layout-modal .ai-review-response').fill(reply);
  await page.locator('.ai-layout-modal button', { hasText: 'Apply new layout' }).click();
  await expect(page.locator('.ai-layout-modal')).not.toBeVisible();
  await expect(page.locator('.toast', { hasText: 'Repositioned 2 components' })).toBeVisible();
});

test('AI Beautify Layout refuses to open with fewer than 2 components', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'AI Beautify Layout' }).click();
  await expect(page.locator('.ai-layout-modal')).not.toBeVisible();
  await expect(page.locator('.toast', { hasText: 'Add at least 2 components' })).toBeVisible();
});
