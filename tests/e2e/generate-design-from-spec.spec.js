import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

const AI_RESPONSE = `Sure, here's a design:

\`\`\`json
{
  "name": "Generated",
  "nodes": [
    { "id": "n1", "x": 40, "y": 40, "text": "API Gateway", "shape": "rounded" },
    { "id": "n2", "x": 320, "y": 40, "text": "Order Service", "shape": "rounded" },
    { "id": "n3", "x": 320, "y": 220, "text": "Orders DB", "shape": "cylinder" }
  ],
  "edges": [
    { "id": "e1", "from": "n1", "to": "n2", "label": "HTTPS" },
    { "id": "e2", "from": "n2", "to": "n3", "label": "reads/writes" }
  ]
}
\`\`\`

Hope that helps!`;

test('the full wizard: spec → prompt → pasted AI result → generated diagram', async ({ page }) => {
  await page.locator('#toolbar button', { hasText: 'Generate Design' }).click();
  await expect(page.locator('.generate-design-modal')).toBeVisible();
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 1 of 3/);

  // Step 1: Next is blocked with no spec text.
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await expect(page.locator('.toast-error')).toBeVisible();

  await page.locator('.generate-design-spec').fill('Must support 10k concurrent users placing orders.');
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();

  // Step 2: prompt embeds the spec text and a JSON few-shot example.
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 2 of 3/);
  const promptArea = page.locator('.generate-design-modal .ai-review-prompt');
  await expect(promptArea).toHaveValue(/10k concurrent users/);
  await expect(promptArea).toHaveValue(/```json/);
  await expect(page.locator('.generate-design-modal .ai-provider-btn')).toHaveCount(4);

  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();

  // Step 3: paste the AI's reply and generate.
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 3 of 3/);
  await page.locator('.generate-design-response').fill(AI_RESPONSE);
  await page.locator('.generate-design-modal button', { hasText: 'Generate design' }).click();

  await expect(page.locator('.toast-success', { hasText: 'Generated a design with 3 components' })).toBeVisible();
  await expect(page.locator('.generate-design-modal')).not.toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(3);
  await expect(page.locator('.node', { hasText: 'Order Service' })).toBeVisible();
});

test('pasting unusable text shows an inline error and keeps the modal open for a retry', async ({ page }) => {
  await page.locator('#toolbar button', { hasText: 'Generate Design' }).click();
  await page.locator('.generate-design-spec').fill('A simple todo app.');
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();

  await page.locator('.generate-design-response').fill('no json in this reply at all');
  await page.locator('.generate-design-modal button', { hasText: 'Generate design' }).click();

  await expect(page.locator('.generate-design-error')).toContainText("Couldn't find valid JSON");
  await expect(page.locator('.generate-design-modal')).toBeVisible();
  await expect(page.locator('.generate-design-response')).toHaveValue('no json in this reply at all');
});

test('generating a design when the canvas already has content asks for confirmation before replacing it', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await expect.poll(() => nodeCount(page)).toBe(1);

  await page.locator('#toolbar button', { hasText: 'Generate Design' }).click();
  await page.locator('.generate-design-spec').fill('A simple todo app.');
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-response').fill(AI_RESPONSE);
  await page.locator('.generate-design-modal button', { hasText: 'Generate design' }).click();

  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-modal button', { hasText: 'Replace' }).click();

  await expect.poll(() => nodeCount(page)).toBe(3);
});

test('the Back button returns to the previous step without losing entered spec text', async ({ page }) => {
  await page.locator('#toolbar button', { hasText: 'Generate Design' }).click();
  await page.locator('.generate-design-spec').fill('Spec text that should survive navigation.');
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 2 of 3/);

  await page.locator('.generate-design-modal button', { hasText: 'Back' }).click();
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 1 of 3/);
  await expect(page.locator('.generate-design-spec')).toHaveValue('Spec text that should survive navigation.');
});
