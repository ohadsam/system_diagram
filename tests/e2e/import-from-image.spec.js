import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, openToolbarGroup } from './helpers.js';

const FIXTURE_IMAGE = new URL('./fixtures/test-diagram.png', import.meta.url).pathname;

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

const AI_RESPONSE = `Sure, here's what I see in the image:

\`\`\`json
{
  "name": "Reconstructed",
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
`;

async function openModal(page) {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'Import from Image' }).click();
  await expect(page.locator('.generate-design-modal')).toBeVisible();
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 1 of 3/);
}

test('Next is blocked until an image is attached, then a preview shows and the wizard advances', async ({ page }) => {
  await openModal(page);
  await expect(page.locator('.generate-design-modal button', { hasText: 'Next' })).toBeDisabled();
  await expect(page.locator('.import-image-preview')).toHaveCount(0);

  await page.locator('.generate-design-modal input[type=file]').setInputFiles(FIXTURE_IMAGE);
  await expect(page.locator('.import-image-preview')).toBeVisible();
  await expect(page.locator('.generate-design-modal button', { hasText: 'Next' })).toBeEnabled();

  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 2 of 3/);
});

test('the full wizard: image → prompt (no spec markers) → pasted AI result → imported diagram', async ({ page }) => {
  await openModal(page);
  await page.locator('.generate-design-modal input[type=file]').setInputFiles(FIXTURE_IMAGE);
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();

  const promptArea = page.locator('.generate-design-modal .ai-review-prompt');
  await expect(promptArea).toHaveValue(/attached image/);
  await expect(promptArea).toHaveValue(/```json/);
  await expect(page.locator('.generate-design-modal', { hasText: 'Download image' })).toBeVisible();

  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 3 of 3/);

  await page.locator('.generate-design-response').fill(AI_RESPONSE);
  await page.locator('.generate-design-modal button', { hasText: 'Import diagram' }).click();

  await expect(page.locator('.toast-success', { hasText: 'Imported a design with 3 components' })).toBeVisible();
  await expect(page.locator('.generate-design-modal')).not.toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(3);
  await expect(page.locator('.node', { hasText: 'Order Service' })).toBeVisible();

  // A 3-component import is also eligible for the walkthrough-animation
  // offer (see tests/e2e/autoAnimationPrompt.spec.js for full coverage).
  await expect(page.locator('.auto-animation-modal')).toBeVisible();
  await page.locator('.auto-animation-modal button', { hasText: 'Skip' }).click();
});

test('pasting unusable text shows an inline error and keeps the modal open for a retry', async ({ page }) => {
  await openModal(page);
  await page.locator('.generate-design-modal input[type=file]').setInputFiles(FIXTURE_IMAGE);
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();

  await page.locator('.generate-design-response').fill('no json in this reply at all');
  await page.locator('.generate-design-modal button', { hasText: 'Import diagram' }).click();

  await expect(page.locator('.generate-design-error')).toContainText("Couldn't find valid JSON");
  await expect(page.locator('.generate-design-modal')).toBeVisible();
});

test('importing when the canvas already has content asks for confirmation before replacing it', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await expect.poll(() => nodeCount(page)).toBe(1);

  await openModal(page);
  await page.locator('.generate-design-modal input[type=file]').setInputFiles(FIXTURE_IMAGE);
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-response').fill(AI_RESPONSE);
  await page.locator('.generate-design-modal button', { hasText: 'Import diagram' }).click();

  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-modal button', { hasText: 'Replace' }).click();

  await expect.poll(() => nodeCount(page)).toBe(3);
});
