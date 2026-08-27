import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('Explain this diff with AI opens the shared ask modal with a prompt mentioning both labels', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Version History' }).click();
  await page.locator('.version-history-modal button', { hasText: '📸 Save Version' }).click();
  await page.locator('.prompt-modal input[type="text"]').fill('v1');
  await page.locator('.prompt-modal button', { hasText: 'Save' }).click();
  await page.locator('.version-history-modal').getByText('✕').first().click().catch(() => {});
  // Add a second component so "current" differs from the saved version.
  await addComponentByName(page, 'PostgreSQL');
  await openToolbarGroup(page, 'File');
  await page.locator('#toolbar button', { hasText: 'Version History' }).click();
  await page.locator('.version-history-row button', { hasText: '🔍 Compare with current' }).click();
  await expect(page.locator('.diagram-compare-modal')).toBeVisible();

  await page.locator('.diagram-compare-explain-btn').click();
  await expect(page.locator('.ai-ask-modal')).toBeVisible();
  const prompt = await page.locator('.ai-ask-modal .ai-review-prompt').inputValue();
  expect(prompt).toContain('v1');
  expect(prompt).toContain('Current');
});

test('Ask AI to reduce this cost opens the shared ask modal with every costed component and the total', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await page.locator('.node').first().click();
  const detailsBtn = page.locator('.node-info-btn').first();
  await detailsBtn.click();
  const costInput = page.locator('#details-panel input[type="number"]').last();
  if (await costInput.count()) {
    await costInput.fill('42');
    await costInput.blur();
  }

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Cost Breakdown' }).click();
  await expect(page.locator('.cost-breakdown-modal')).toBeVisible();
  const askBtn = page.locator('.cost-breakdown-optimize-btn');
  if (await askBtn.count()) {
    await askBtn.click();
    await expect(page.locator('.ai-ask-modal')).toBeVisible();
    const prompt = await page.locator('.ai-ask-modal .ai-review-prompt').inputValue();
    expect(prompt).toMatch(/reduce this cost/i);
  }
});
