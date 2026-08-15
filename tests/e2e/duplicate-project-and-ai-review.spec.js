import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, edgeCount, dragNodeBy, connectNodes } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

test('"Duplicate Project" clones the canvas into a new project and leaves the original saved copy untouched', async ({ page }) => {
  await addComponentByName(page, 'Redis');
  await page.locator('#toolbar button', { hasText: 'Save As' }).click();
  await page.locator('.save-as-modal input[type="text"]').fill('Original Project');
  await page.locator('.save-as-modal button', { hasText: 'Save' }).click();
  await expect.poll(() => nodeCount(page)).toBe(1);

  await page.locator('#toolbar button[title^="Duplicate this project"]').click();
  await expect(page.locator('.toast-success', { hasText: 'Duplicated into a new project' })).toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(1); // same content, not doubled — it's a *new* project

  await page.locator('#toolbar button', { hasText: 'Load' }).click();
  await expect(page.locator('.saved-project-name', { hasText: 'Original Project' })).toBeVisible();
  await expect(page.locator('.saved-project-row')).toHaveCount(1); // the duplicate was never auto-saved as a named project
});

test('"Duplicate entire canvas" (canvas right-click) copies every component and connector in place', async ({ page }) => {
  await addComponentByName(page, 'Load Balancer');
  await addComponentByName(page, 'Nginx Web Server');
  const nodes = page.locator('.node');
  await dragNodeBy(page, nodes.nth(1), 220, 160);
  await connectNodes(page, nodes.nth(0), nodes.nth(1));
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect.poll(() => edgeCount(page)).toBe(1);

  await page.locator('#canvas-viewport').click({ position: { x: 40, y: 40 } }); // deselect, land the context menu on empty canvas
  await page.locator('#canvas-viewport').click({ button: 'right', position: { x: 40, y: 40 } });
  await page.locator('.context-menu-item', { hasText: 'Duplicate entire canvas' }).click();

  await expect.poll(() => nodeCount(page)).toBe(4);
  await expect.poll(() => edgeCount(page)).toBe(2);
});

test('the AI Design Review panel opens, builds a prompt from the diagram, and accepts a spec attachment', async ({ page }) => {
  await addComponentByName(page, 'PostgreSQL');
  await page.locator('#toolbar button[title="AI Design Review"]').click();
  await expect(page.locator('#ai-review-panel')).toHaveClass(/open/);

  const prompt = page.locator('.ai-review-prompt');
  await expect(prompt).toHaveValue(/PostgreSQL/);
  await expect(prompt).toHaveValue(/1 component/);

  const specInput = page.locator('.ai-review-spec input[type=file]');
  await specInput.setInputFiles({ name: 'spec.txt', mimeType: 'text/plain', buffer: Buffer.from('Must handle 10k concurrent users.') });
  await expect(page.locator('.ai-review-spec-name')).toContainText('spec.txt');
  await expect(prompt).toHaveValue(/10k concurrent users/);

  await page.locator('.ai-review-panel .details-close').click();
  await expect(page.locator('#ai-review-panel')).not.toHaveClass(/open/);
});

test('pasting an AI response back into the panel saves it for the session with copy/remove controls', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await page.locator('#toolbar button[title="AI Design Review"]').click();

  await page.locator('.ai-review-response').fill('Consider adding a dead-letter queue.');
  await page.locator('.ai-review-pasteback button', { hasText: 'Save to this session' }).click();

  await expect(page.locator('.ai-review-saved-card')).toHaveCount(1);
  await expect(page.locator('.ai-review-saved-text')).toHaveText('Consider adding a dead-letter queue.');

  await page.locator('.ai-review-saved-card button[aria-label="Remove this saved review"]').click();
  await expect(page.locator('.ai-review-saved-card')).toHaveCount(0);
});

test('switching to a genuinely different project resets the AI review panel\'s scratch state', async ({ page }) => {
  await addComponentByName(page, 'Kafka');
  await page.locator('#toolbar button[title="AI Design Review"]').click();
  await page.locator('.ai-review-response').fill('Old response for the old project.');
  await page.locator('.ai-review-pasteback button', { hasText: 'Save to this session' }).click();
  await expect(page.locator('.ai-review-saved-card')).toHaveCount(1);

  await page.locator('#toolbar button[title="New diagram"]').click();
  await page.locator('.confirm-modal button', { hasText: 'Start new' }).click();

  await expect(page.locator('.ai-review-saved-card')).toHaveCount(0);
  await expect(page.locator('.ai-review-prompt')).toHaveValue(/0 components/);
});
