// Settings -> AI Providers -> "🧩 Local AI (in-browser)" (io/webllmEngine.js,
// LOCAL_MODEL_CHOICES in io/aiProviderKeys.js) and the "🧩 Send to Local AI"
// button it unlocks across the AI-assisted flows (utils/aiProviderActions.js).
//
// Unlike io/aiDirectCall.js's plain `fetch()` calls (stubbable with
// page.route, see ai-provider-direct.spec.js), io/webllmEngine.js loads the
// vendored engine via a dynamic `import()` of a local ES module — confirmed
// empirically that Playwright's page.route does NOT intercept that request
// in this environment/version (a real request to vendor/web-llm.min.js goes
// through untouched even with a catch-all `**/*` route registered before
// navigation), so the actual model-load/generate call can't be faked here
// the way a direct-API fetch can. See docs/AI_AGENT_GUIDE.md's "Common
// pitfalls" before trying to route-intercept a dynamic import again.
//
// What IS deterministically testable without a real WebGPU device or a
// multi-GB download: the Settings UI, the WebGPU-unsupported short-circuit
// (which returns before ever touching the vendored module), and that the
// button/wiring appears in the right places — all covered below.
// navigator.gpu is forced to a known value via addInitScript rather than
// relying on whatever the test browser happens to support.
import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, openToolbarGroup } from './helpers.js';

async function forceWebGpuSupport(page, supported) {
  await page.addInitScript((isSupported) => {
    Object.defineProperty(window.navigator, 'gpu', { value: isSupported ? {} : undefined, configurable: true });
  }, supported);
}

async function openAiProvidersSection(page) {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('AI Providers mode dropdown offers a Local AI option, with a model picker and preload button below it', async ({ page }) => {
  await forceWebGpuSupport(page, true);
  await page.goto('/index.html');
  await dismissHints(page);
  await openAiProvidersSection(page);

  const modeSelect = page.locator('.ai-provider-settings select').first();
  const options = await modeSelect.locator('option').allTextContents();
  expect(options.some((o) => o.includes('Local AI'))).toBe(true);

  await expect(page.locator('.ai-local-settings')).toBeVisible();
  await expect(page.locator('.ai-local-settings')).toContainText('Runs a small open model');
  await expect(page.locator('.ai-local-settings select')).toBeVisible();
  await expect(page.locator('.ai-local-settings button', { hasText: 'Preload model' })).toBeEnabled();
});

test('a WebGPU-unsupported browser sees a clear warning and a disabled preload button', async ({ page }) => {
  await forceWebGpuSupport(page, false);
  await page.goto('/index.html');
  await dismissHints(page);
  await openAiProvidersSection(page);

  await expect(page.locator('.ai-local-settings .ai-provider-settings-warning')).toContainText("doesn't support WebGPU");
  await expect(page.locator('.ai-local-settings button', { hasText: 'Preload model' })).toBeDisabled();
});

test('switching to Local AI mode shows a "Send to Local AI" button in AI Design Review, additive alongside every hand-off button', async ({ page }) => {
  await forceWebGpuSupport(page, true);
  await page.goto('/index.html');
  await dismissHints(page);
  await addComponentByName(page, 'PostgreSQL');

  await openAiProvidersSection(page);
  await page.locator('.ai-provider-settings select').first().selectOption('local');
  await expect(page.locator('.toast-success', { hasText: 'Local AI (in-browser) enabled' })).toBeVisible();
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '🤖 AI Design Review' }).click();
  await expect(page.locator('#ai-review-panel')).toHaveClass(/open/);

  const localBtn = page.locator('.ai-provider-direct-btn', { hasText: 'Send to Local AI' });
  await expect(localBtn).toHaveCount(1);
  await expect(localBtn).toContainText('Llama 3.2'); // the default LOCAL_MODEL_CHOICES entry's short name
  // The hand-off buttons are still there too — additive, not a mode switch in the UI.
  await expect(page.locator('.ai-provider-btn', { hasText: 'Claude' })).toBeVisible();
  await expect(page.locator('.ai-provider-btn', { hasText: 'ChatGPT' })).toBeVisible();
  await expect(page.locator('.ai-provider-btn', { hasText: 'Gemini' })).toBeVisible();
});

test('a picked local model shows up in the "Send to Local AI" button label', async ({ page }) => {
  await forceWebGpuSupport(page, true);
  await page.goto('/index.html');
  await dismissHints(page);
  await openAiProvidersSection(page);
  await page.locator('.ai-provider-settings select').first().selectOption('local');
  await page.locator('.ai-local-settings select').selectOption('Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '🤖 AI Design Review' }).click();
  await expect(page.locator('.ai-provider-direct-btn', { hasText: 'Send to Local AI (Qwen2.5 1.5B)' })).toHaveCount(1);
});

test('clicking "Send to Local AI" on a WebGPU-unsupported browser fails fast with a clear error, hand-off still usable', async ({ page }) => {
  await forceWebGpuSupport(page, false);
  await page.goto('/index.html');
  await dismissHints(page);

  await openAiProvidersSection(page);
  await page.locator('.ai-provider-settings select').first().selectOption('local');
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();

  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: '🤖 AI Design Review' }).click();

  await page.locator('.ai-provider-direct-btn', { hasText: 'Send to Local AI' }).click();
  await expect(page.locator('.toast-error', { hasText: 'WebGPU' })).toBeVisible();
  await expect(page.locator('.ai-provider-btn', { hasText: 'Claude' })).toBeEnabled();
});

test('switching mode away from Local AI never triggers the "delete API keys" confirmation, since there is nothing to delete', async ({ page }) => {
  await forceWebGpuSupport(page, true);
  await page.goto('/index.html');
  await dismissHints(page);
  await openAiProvidersSection(page);

  const modeSelect = page.locator('.ai-provider-settings select').first();
  await modeSelect.selectOption('local');
  await expect(page.locator('.toast-success', { hasText: 'Local AI (in-browser) enabled' })).toBeVisible();

  await modeSelect.selectOption('handoff');
  await expect(page.locator('.confirm-modal')).toHaveCount(0);
  await expect(modeSelect).toHaveValue('handoff');
});
