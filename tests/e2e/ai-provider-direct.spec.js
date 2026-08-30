// Settings -> AI Providers (js/modals/defaultSettingsModal.js's "🤖 AI
// Providers" section, backed by io/aiProviderKeys.js) and the "⚡ Send
// directly" wiring it unlocks across the AI-assisted flows (see
// js/utils/aiProviderActions.js). Direct calls are intercepted via
// page.route rather than hitting real provider APIs, consistent with this
// repo's "no real external network calls in tests" convention.
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

test('AI Providers section shows the security warning and one row per built-in provider', async ({ page }) => {
  await openAiProvidersSection(page);
  await expect(page.locator('.default-settings-modal', { hasText: 'AI Providers' })).toBeVisible();
  await expect(page.locator('.ai-provider-settings-warning')).toContainText('Not fully secure');
  await expect(page.locator('.ai-provider-settings-row')).toHaveCount(3);
  await expect(page.locator('.ai-provider-settings-name')).toHaveText(['Claude (Anthropic)', 'ChatGPT (OpenAI)', 'Gemini (Google)']);
});

test('the "Clear API Keys" button is disabled until a key is saved, then clears it after confirmation', async ({ page }) => {
  await openAiProvidersSection(page);
  const clearBtn = page.locator('button', { hasText: '🗑️ Clear API Keys' });
  await expect(clearBtn).toBeDisabled();

  const keyInput = page.locator('.ai-provider-settings-row').first().locator('input[type=password]');
  await keyInput.fill('sk-test-123');
  await keyInput.blur();
  await expect(clearBtn).toBeEnabled();

  await clearBtn.click();
  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-modal button.btn-danger', { hasText: 'Clear keys' }).click();
  await expect(page.locator('.toast-success', { hasText: 'Every saved API key was deleted' })).toBeVisible();
  await expect(clearBtn).toBeDisabled();
});

test('switching to Direct mode with saved keys, then back to Copy/Paste, requires confirmation and wipes the keys', async ({ page }) => {
  await openAiProvidersSection(page);
  const keyInput = page.locator('.ai-provider-settings-row').first().locator('input[type=password]');
  await keyInput.fill('sk-test-123');
  await keyInput.blur();

  const modeSelect = page.locator('.ai-provider-settings select').first();
  await modeSelect.selectOption('direct');
  await expect(page.locator('.toast-success', { hasText: 'Direct API calls enabled' })).toBeVisible();

  // Cancel: the select should revert to 'direct' and the key should survive.
  await modeSelect.selectOption('handoff');
  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-modal button.btn', { hasText: 'Cancel' }).click();
  await expect(page.locator('.confirm-modal')).toHaveCount(0);
  await expect(page.locator('.ai-provider-settings select').first()).toHaveValue('direct');
  await expect(page.locator('.ai-provider-settings-row').first().locator('input[type=password]')).toHaveValue('sk-test-123');

  // Confirm: the key is wiped and the mode actually switches.
  await modeSelect.selectOption('handoff');
  await page.locator('.confirm-modal button.btn-danger', { hasText: 'Switch & delete keys' }).click();
  await expect(page.locator('.toast-success', { hasText: 'every saved API key was deleted' })).toBeVisible();
  await expect(page.locator('.ai-provider-settings select').first()).toHaveValue('handoff');
  await expect(page.locator('.ai-provider-settings-row').first().locator('input[type=password]')).toHaveValue('');
});

test('adding and removing a custom provider row', async ({ page }) => {
  await openAiProvidersSection(page);
  await page.locator('button', { hasText: '+ Add custom provider…' }).click();
  const customRow = page.locator('.ai-provider-settings-custom');
  await expect(customRow).toHaveCount(1);
  await customRow.locator('input[placeholder="Full endpoint URL (…/chat/completions)"]').fill('https://example.com/v1/chat/completions');
  await customRow.locator('input[type=password]').fill('custom-key');

  await customRow.locator('button[aria-label^="Remove"]').click();
  await expect(page.locator('.ai-provider-settings-custom')).toHaveCount(0);
});

test('AI Design Review shows a "⚡ Send directly" button only once Direct mode is configured for Claude, and it fills the paste-back field', async ({ page }) => {
  await addComponentByName(page, 'PostgreSQL');

  await openAiProvidersSection(page);
  await page.locator('.ai-provider-settings select').first().selectOption('direct');
  const keyInput = page.locator('.ai-provider-settings-row').first().locator('input[type=password]');
  await keyInput.fill('sk-test-123');
  await keyInput.blur();
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '🤖 AI Design Review' }).click();
  await expect(page.locator('#ai-review-panel')).toHaveClass(/open/);

  const directBtn = page.locator('.ai-provider-direct-btn', { hasText: 'Send directly' });
  await expect(directBtn).toHaveCount(1);

  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: 'Looks solid overall.' }] }),
  }));

  await directBtn.click();
  await expect(page.locator('.toast-success', { hasText: 'Got a response from Claude' })).toBeVisible();
  await expect(page.locator('.ai-review-response')).toHaveValue('Looks solid overall.');
});

test('a failed direct call shows an error toast and leaves the hand-off button usable', async ({ page }) => {
  await openAiProvidersSection(page);
  await page.locator('.ai-provider-settings select').first().selectOption('direct');
  const keyInput = page.locator('.ai-provider-settings-row').first().locator('input[type=password]');
  await keyInput.fill('sk-bad-key');
  await keyInput.blur();
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '🤖 AI Design Review' }).click();

  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: { message: 'invalid x-api-key' } }),
  }));

  await page.locator('.ai-provider-direct-btn', { hasText: 'Send directly' }).click();
  await expect(page.locator('.toast-error', { hasText: 'rejected' })).toBeVisible();
  // The hand-off button for Claude is still right there, unaffected by the failed direct call.
  await expect(page.locator('.ai-provider-btn', { hasText: 'Claude' })).toBeEnabled();
});
