// The AI Design Review panel's "🛡️ Security" mode (js/panel/aiReviewPanel.js)
// — unlike "💡 Suggestions", this one is offered even in Copy/Paste-only
// setups (like Review/Explain), since a security review is worth a manual
// round trip. Direct calls are intercepted via page.route, same convention
// as ai-provider-direct.spec.js/ai-suggestions.spec.js.
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
  await page.locator('#toolbar button', { hasText: '🤖 AI Design Review' }).click();
  await expect(page.locator('#ai-review-panel')).toHaveClass(/open/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('"🛡️ Security" mode is offered even in Copy/Paste-only mode, unlike "💡 Suggestions"', async ({ page }) => {
  await openAiReviewPanel(page);
  await expect(page.locator('.ai-review-mode-toggle button', { hasText: 'Security' })).toHaveCount(1);
  await expect(page.locator('.ai-review-mode-toggle button', { hasText: 'Suggestions' })).toHaveCount(0);

  await page.locator('.ai-review-mode-toggle button', { hasText: 'Security' }).click();
  await expect(page.locator('.ai-review-prompt')).toHaveValue(/security reviewer/);
  // Hand-off buttons still work here, same as Review/Explain.
  await expect(page.locator('.ai-provider-btn', { hasText: 'Claude' })).toBeVisible();
});

test('a hand-off-only user can paste a response back and parse it manually', async ({ page }) => {
  await openAiReviewPanel(page);
  await page.locator('.ai-review-mode-toggle button', { hasText: 'Security' }).click();

  const textarea = page.locator('.ai-review-response');
  await textarea.fill('[{"severity":"high","title":"Public DB","detail":"No firewall in front of it."}]');
  await page.locator('button', { hasText: '🛡️ Parse findings' }).click();

  await expect(page.locator('.ai-suggestions-group-title', { hasText: 'High severity' })).toBeVisible();
  await expect(page.locator('.ai-suggestion-title', { hasText: 'Public DB' })).toBeVisible();
  // No "+ Add" style action button for security findings.
  await expect(page.locator('.ai-suggestion-add-btn')).toHaveCount(0);
});

test('sending automatically renders severity-grouped findings with no add button', async ({ page }) => {
  await enableDirectMode(page);
  await openAiReviewPanel(page);
  await page.locator('.ai-review-mode-toggle button', { hasText: 'Security' }).click();

  const reply = JSON.stringify([
    { severity: 'high', title: 'Public S3 bucket', detail: 'No access controls shown.' },
    { severity: 'medium', title: 'No encryption at rest mentioned', detail: 'Consider enabling it.' },
    { severity: 'low', title: 'No audit logging shown', detail: 'Add CloudTrail or similar.' },
  ]);
  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: reply }] }),
  }));

  await page.locator('.ai-provider-direct-btn', { hasText: 'Send directly' }).click();

  await expect(page.locator('.ai-suggestions-group-title')).toHaveText([
    '🔴 High severity', '🟠 Medium severity', '🟡 Low severity',
  ]);
  await expect(page.locator('.ai-suggestion-title', { hasText: 'Public S3 bucket' })).toBeVisible();
  await expect(page.locator('.ai-suggestion-add-btn')).toHaveCount(0);

  await page.locator('button', { hasText: '🔄 Ask again' }).click();
  await expect(page.locator('.ai-suggestions-group-title')).toHaveCount(0);
});

test('switching from Security to Suggestions and back clears findings each time', async ({ page }) => {
  await enableDirectMode(page);
  await openAiReviewPanel(page);
  await page.locator('.ai-review-mode-toggle button', { hasText: 'Security' }).click();

  const textarea = page.locator('.ai-review-response');
  await textarea.fill('[{"severity":"low","title":"Minor gap"}]');
  await page.locator('button', { hasText: '🛡️ Parse findings' }).click();
  await expect(page.locator('.ai-suggestion-title', { hasText: 'Minor gap' })).toBeVisible();

  await page.locator('.ai-review-mode-toggle button', { hasText: 'Suggestions' }).click();
  await expect(page.locator('.ai-suggestion-title', { hasText: 'Minor gap' })).toHaveCount(0);
  await expect(page.locator('.ai-review-prompt')).toHaveValue(/JSON array/);
});
