// Settings' "🔁 Auto-suggest" section (js/modals/defaultSettingsModal.js,
// backed by io/aiProviderKeys.js's autoSuggest config) and the background
// watcher (js/io/autoSuggestWatcher.js) that runs "💡 Suggestions" without
// the AI Design Review panel needing to be open, surfacing a "💡" badge on
// the toolbar button once ready. Direct calls are intercepted via
// page.route, same convention as ai-suggestions.spec.js.
import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

async function openAiProvidersSection(page) {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the Auto-suggest section warns it has no effect until Direct/Local AI is configured', async ({ page }) => {
  await openAiProvidersSection(page);
  await expect(page.locator('.ai-auto-suggest-settings', { hasText: 'Auto-suggest' })).toBeVisible();
  await expect(page.locator('.ai-auto-suggest-warning')).toContainText('Has no effect yet');
});

test('enabling Auto-suggest and setting a threshold persists across a re-open', async ({ page }) => {
  await openAiProvidersSection(page);
  const enableCheckbox = page.locator('.ai-auto-suggest-settings input[type=checkbox]');
  await enableCheckbox.check();
  const countInput = page.locator('.ai-auto-suggest-settings input[type=number]');
  await countInput.fill('2');
  await countInput.blur();
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();

  await openAiProvidersSection(page);
  await expect(page.locator('.ai-auto-suggest-settings input[type=checkbox]')).toBeChecked();
  await expect(page.locator('.ai-auto-suggest-settings input[type=number]')).toHaveValue('2');
});

test('after enough component adds with Auto-suggest on, a badge appears and opens Suggestions with the result', async ({ page }) => {
  await openAiProvidersSection(page);
  await page.locator('.ai-provider-settings select').first().selectOption('direct');
  const keyInput = page.locator('.ai-provider-settings-row').first().locator('input[type=password]');
  await keyInput.fill('sk-test-123');
  await keyInput.blur();

  await page.locator('.ai-auto-suggest-settings input[type=checkbox]').check();
  const countInput = page.locator('.ai-auto-suggest-settings input[type=number]');
  await countInput.fill('2');
  await countInput.blur();
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();

  const reply = JSON.stringify([{ category: 'component', title: 'Redis Cache', detail: 'Speeds up reads.' }]);
  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: reply }] }),
  }));

  await addComponentByName(page, 'RabbitMQ');
  await addComponentByName(page, 'PostgreSQL');
  // The watcher debounces settled changes (~800ms) before counting one.
  await page.waitForTimeout(1200);
  await addComponentByName(page, 'Redis Cache');
  await page.waitForTimeout(1200);

  // The badge lives inside the collapsible "Tools" dropdown panel (same as
  // the existing Comments badge) — opening the group is what a real user
  // would do to see it too, not just a test-only step.
  await openToolbarGroup(page, 'Tools');
  const badge = page.locator('.toolbar-auto-suggest-badge');
  await expect(badge).toBeVisible({ timeout: 5000 });

  await page.locator('#toolbar button', { hasText: '🤖 AI Design Review' }).click();
  await expect(page.locator('#ai-review-panel')).toHaveClass(/open/);
  await expect(page.locator('.ai-review-mode-toggle button.btn-primary')).toHaveText('💡 Suggestions');
  await expect(page.locator('.ai-suggestion-title', { hasText: 'Redis Cache' })).toBeVisible();
  await expect(badge).toBeHidden();
});
