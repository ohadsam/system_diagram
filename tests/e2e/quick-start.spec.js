import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

const QUICK_START_AI_RESPONSE = `Here's a starting point:

\`\`\`json
{
  "name": "Order Service",
  "nodes": [
    { "id": "n1", "x": 40, "y": 40, "text": "API Gateway", "shape": "rounded" },
    { "id": "n2", "x": 320, "y": 40, "text": "Order Service", "shape": "rounded" },
    { "id": "n3", "x": 320, "y": 220, "text": "Orders DB", "shape": "cylinder" }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2", "label": "HTTPS" },
    { "id": "e2", "from": "n2", "to": "n3", "label": "reads/writes" }
  ],
  "rationale": {
    "overview": "A thin gateway fronts a single Order Service that owns its own database.",
    "components": [
      { "id": "n1", "why": "Gives external clients one stable entry point." },
      { "id": "n2", "why": "Owns the order-placement logic described in the request." },
      { "id": "n3", "why": "Orders need to be persisted by the service that writes them." }
    ]
  }
}
\`\`\`
`;

test('the full wizard: setup nudge (skipped) → describe → prompt → pasted AI result → diagram + rationale', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'AI Quick Start' }).click();
  await expect(page.locator('.generate-design-modal')).toBeVisible();

  // No AI mode configured by default, so the setup nudge shows first and is skippable.
  await expect(page.locator('.modal-step-indicator')).toHaveText('Set up AI (optional)');
  await expect(page.locator('.quick-start-warning')).toBeVisible();
  await page.locator('.generate-design-modal button', { hasText: 'Skip' }).click();

  await expect(page.locator('.modal-step-indicator')).toHaveText('Describe your system');
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await expect(page.locator('.toast-error')).toBeVisible();

  await page.locator('.quick-start-description').fill('An online store where customers place orders and pay by card.');
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();

  await expect(page.locator('.modal-step-indicator')).toHaveText('Copy this prompt to your AI');
  const promptArea = page.locator('.generate-design-modal .ai-review-prompt');
  await expect(promptArea).toHaveValue(/customers place orders and pay by card/);
  await expect(promptArea).toHaveValue(/```json/);
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();

  await expect(page.locator('.modal-step-indicator')).toHaveText("Paste the AI's result");
  await page.locator('.generate-design-response').fill(QUICK_START_AI_RESPONSE);
  await page.locator('.generate-design-modal button', { hasText: 'Create diagram' }).click();

  await expect(page.locator('.toast-success', { hasText: 'Generated a design with 3 components' })).toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(3);

  // The modal stays open on a "done" step showing the rationale, unlike
  // Generate Design from Spec which closes immediately.
  await expect(page.locator('.generate-design-modal')).toBeVisible();
  await expect(page.locator('.modal-step-indicator')).toHaveText('Your diagram');
  await expect(page.locator('.quick-start-overview')).toContainText('thin gateway fronts a single Order Service');
  await expect(page.locator('.quick-start-reason-row')).toHaveCount(3);
  await expect(page.locator('.quick-start-reason-row', { hasText: 'API Gateway' })).toContainText('one stable entry point');

  await page.locator('.generate-design-modal button', { hasText: 'Done' }).click();
  await expect(page.locator('.generate-design-modal')).not.toBeVisible();

  // Quick Start's 3-node diagram is also eligible for the walkthrough-
  // animation offer (see tests/e2e/autoAnimationPrompt.spec.js for full
  // coverage of that modal itself).
  await expect(page.locator('.auto-animation-modal')).toBeVisible();
  await page.locator('.auto-animation-modal button', { hasText: 'Skip' }).click();
});

test('the setup nudge is skipped entirely once an automatic AI mode is configured', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('sdb:v1:aiProviderKeys', JSON.stringify({ mode: 'direct', providers: { anthropic: { apiKey: 'sk-test-key' } } }));
  });
  await page.reload();
  await dismissHints(page);

  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'AI Quick Start' }).click();
  await expect(page.locator('.modal-step-indicator')).toHaveText('Describe your system');
});

test('generating a design when the canvas already has content asks for confirmation before replacing it', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await expect.poll(() => nodeCount(page)).toBe(1);

  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'AI Quick Start' }).click();
  await page.locator('.generate-design-modal button', { hasText: 'Skip' }).click();
  await page.locator('.quick-start-description').fill('A simple todo app.');
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-response').fill(QUICK_START_AI_RESPONSE);
  await page.locator('.generate-design-modal button', { hasText: 'Create diagram' }).click();

  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-modal button', { hasText: 'Replace' }).click();

  await expect.poll(() => nodeCount(page)).toBe(3);
});

test('pasting unusable text shows an inline error and keeps the modal open for a retry', async ({ page }) => {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'AI Quick Start' }).click();
  await page.locator('.generate-design-modal button', { hasText: 'Skip' }).click();
  await page.locator('.quick-start-description').fill('A simple todo app.');
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();

  await page.locator('.generate-design-response').fill('no json in this reply at all');
  await page.locator('.generate-design-modal button', { hasText: 'Create diagram' }).click();

  await expect(page.locator('.generate-design-error')).toContainText("Couldn't find valid JSON");
  await expect(page.locator('.generate-design-modal')).toBeVisible();
});
