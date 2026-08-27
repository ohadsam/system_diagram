import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup } from './helpers.js';

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
`;

async function runGenerateDesignFlow(page) {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'Generate Design' }).click();
  await page.locator('.generate-design-spec').fill('A simple order service.');
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-response').fill(AI_RESPONSE);
  await page.locator('.generate-design-modal button', { hasText: 'Generate design' }).click();
  await expect(page.locator('.generate-design-modal')).not.toBeVisible();
}

test('after generating a design, the walkthrough-animation prompt appears and creating one opens the Diagram Animation panel', async ({ page }) => {
  await runGenerateDesignFlow(page);

  await expect(page.locator('.auto-animation-modal')).toBeVisible();
  await expect(page.locator('.auto-animation-delay')).toHaveValue('3');

  await page.locator('.auto-animation-modal button', { hasText: 'Create Animation' }).click();
  await expect(page.locator('.auto-animation-modal')).not.toBeVisible();
  await expect(page.locator('.toast-success', { hasText: 'Walkthrough animation created' })).toBeVisible();

  await expect(page.locator('.animation-panel.open')).toBeVisible();
  await expect(page.locator('.animation-step-row')).toHaveCount(5);
});

test('skipping the prompt leaves the diagram exactly as generated, with no animation created', async ({ page }) => {
  await runGenerateDesignFlow(page);

  await expect(page.locator('.auto-animation-modal')).toBeVisible();
  await page.locator('.auto-animation-modal button', { hasText: 'Skip' }).click();
  await expect(page.locator('.auto-animation-modal')).not.toBeVisible();
  await expect(page.locator('.animation-panel.open')).not.toBeVisible();
});

test('choosing "Advance only on click" disables the delay field and creates click-mode steps', async ({ page }) => {
  await runGenerateDesignFlow(page);

  await expect(page.locator('.auto-animation-modal')).toBeVisible();
  await page.locator('.auto-animation-option', { hasText: 'Advance only on click' }).locator('input[type=radio]').check();
  await expect(page.locator('.auto-animation-delay')).toBeDisabled();

  await page.locator('.auto-animation-modal button', { hasText: 'Create Animation' }).click();
  await expect(page.locator('.animation-panel.open')).toBeVisible();
  // A click-mode step never shows a numeric delay control in the panel.
  await expect(page.locator('.animation-step-delay')).toHaveCount(0);
});

test('a single-component diagram gets no walkthrough prompt at all — nothing to walk through', async ({ page }) => {
  const SINGLE_NODE_RESPONSE = `\`\`\`json
{ "name": "One", "nodes": [{ "id": "n1", "x": 0, "y": 0, "text": "Solo", "shape": "rounded" }], "edges": [] }
\`\`\``;
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'Generate Design' }).click();
  await page.locator('.generate-design-spec').fill('Just one box.');
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-modal button', { hasText: 'Next' }).click();
  await page.locator('.generate-design-response').fill(SINGLE_NODE_RESPONSE);
  await page.locator('.generate-design-modal button', { hasText: 'Generate design' }).click();

  await expect(page.locator('.auto-animation-modal')).not.toBeVisible();
});
