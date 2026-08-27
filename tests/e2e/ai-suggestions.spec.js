// The AI Design Review panel's "💡 Suggestions" mode (js/panel/aiReviewPanel.js)
// — only offered once a Direct API provider or Local AI model is actually
// usable (js/panel/aiReviewPanel.js#suggestionsAvailable), since asking
// someone to hand-copy a JSON array in and out would defeat the point of an
// "automatic" suggestion. Direct calls are intercepted via page.route, same
// convention as ai-provider-direct.spec.js — no real external network calls.
import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup } from './helpers.js';

async function openAiProvidersSection(page) {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();
}

async function enableDirectMode(page) {
  await openAiProvidersSection(page);
  await page.locator('.ai-provider-settings select').first().selectOption('direct');
  const keyInput = page.locator('.ai-provider-settings-row').first().locator('input[type=password]');
  await keyInput.fill('sk-test-123');
  await keyInput.blur();
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();
}

async function openAiReviewPanel(page) {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button[title="AI Design Review"]').click();
  await expect(page.locator('#ai-review-panel')).toHaveClass(/open/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('the "💡 Suggestions" mode is hidden in Copy/Paste mode and appears once Direct API mode is configured', async ({ page }) => {
  await openAiReviewPanel(page);
  await expect(page.locator('.ai-review-mode-toggle button', { hasText: 'Suggestions' })).toHaveCount(0);
  await page.locator('.details-close', { hasText: '✕' }).click();

  await enableDirectMode(page);
  await openAiReviewPanel(page);
  await expect(page.locator('.ai-review-mode-toggle button', { hasText: 'Suggestions' })).toHaveCount(1);
});

test('switching to Suggestions mode shows a suggestions-specific prompt and hides the saved-reviews section', async ({ page }) => {
  await enableDirectMode(page);
  await openAiReviewPanel(page);
  await page.locator('.ai-review-mode-toggle button', { hasText: 'Suggestions' }).click();
  await expect(page.locator('.ai-review-prompt')).toHaveValue(/Respond with ONLY a JSON array/);
  await expect(page.locator('h3', { hasText: 'Suggestions' }).last()).toBeVisible();
});

test('sending automatically in Suggestions mode renders grouped, categorized cards with a working "+ Add" button', async ({ page }) => {
  await enableDirectMode(page);
  await openAiReviewPanel(page);
  await page.locator('.ai-review-mode-toggle button', { hasText: 'Suggestions' }).click();

  const reply = JSON.stringify([
    { category: 'component', title: 'Redis Cache', detail: 'Speeds up repeated reads.' },
    { category: 'pricing', title: 'Watch egress costs', detail: 'Cross-region traffic adds up.' },
    { category: 'improvement', title: 'Add a health check', detail: 'No liveness probe is shown.' },
  ]);
  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: reply }] }),
  }));

  await page.locator('.ai-provider-direct-btn', { hasText: 'Send directly' }).click();

  await expect(page.locator('.ai-suggestions-group-title')).toHaveText([
    '🧩 Suggested components', '💰 Pricing notes', '✨ Improvements',
  ]);
  await expect(page.locator('.ai-suggestion-title', { hasText: 'Redis Cache' })).toBeVisible();
  await expect(page.locator('.ai-suggestion-detail', { hasText: 'Speeds up repeated reads' })).toBeVisible();
  await expect(page.locator('.ai-suggestion-title', { hasText: 'Watch egress costs' })).toBeVisible();
  await expect(page.locator('.ai-suggestion-title', { hasText: 'Add a health check' })).toBeVisible();

  const addBtn = page.locator('.ai-suggestion-add-btn', { hasText: 'Add Redis Cache' });
  await expect(addBtn).toHaveCount(1);
  await expect(page.locator('.node')).toHaveCount(0);
  await addBtn.click();
  await expect(page.locator('.node')).toHaveCount(1);
  await expect(page.locator('.toast-success', { hasText: 'Added Redis Cache' })).toBeVisible();

  // "Ask again" clears the cards and returns to the send step.
  await page.locator('button', { hasText: '🔄 Ask again' }).click();
  await expect(page.locator('.ai-suggestions-group-title')).toHaveCount(0);
});

test('an unparseable response falls back to a raw-text box with a manual "Parse suggestions" retry', async ({ page }) => {
  await enableDirectMode(page);
  await openAiReviewPanel(page);
  await page.locator('.ai-review-mode-toggle button', { hasText: 'Suggestions' }).click();

  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: 'Sorry, I cannot help with that in JSON form.' }] }),
  }));

  await page.locator('.ai-provider-direct-btn', { hasText: 'Send directly' }).click();
  await expect(page.locator('.toast-error', { hasText: "couldn't read it as a suggestions list" })).toBeVisible();

  const textarea = page.locator('.ai-review-response');
  await expect(textarea).toHaveValue('Sorry, I cannot help with that in JSON form.');

  await textarea.fill('[{"category":"improvement","title":"Retry worked","detail":"parsed on the second try"}]');
  await page.locator('button', { hasText: '💡 Parse suggestions' }).click();
  await expect(page.locator('.ai-suggestion-title', { hasText: 'Retry worked' })).toBeVisible();
});
