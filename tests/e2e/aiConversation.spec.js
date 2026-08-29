import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openConversation(page) {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'AI Conversation' }).click();
  await expect(page.locator('.ai-conversation-modal')).toBeVisible();
}

function buildPatchReply(existingNodeId) {
  return `Sure, I'll add a cache for you.

\`\`\`json
{
  "addNodes": [
    { "id": "new1", "x": 460, "y": 40, "w": 160, "h": 84, "shape": "cylinder", "text": "Redis Cache", "icon": "⚡" }
  ],
  "addEdges": [
    { "id": "newe1", "from": "${existingNodeId}", "to": "new1", "label": "reads/writes" }
  ]
}
\`\`\`

Let me know if you'd like anything else!`;
}

test('a full round trip: message → prompt → pasted patch reply → applied, transcript records both turns', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await expect.poll(() => nodeCount(page)).toBe(1);
  const existingNodeId = await page.locator('.node').first().getAttribute('data-node-id');
  const PATCH_REPLY = buildPatchReply(existingNodeId);

  await openConversation(page);
  await expect(page.locator('.ai-conversation-empty')).toHaveText('No messages yet — start below.');
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 1 of 3/);

  await page.locator('.ai-conversation-draft').fill('Add a cache next to the gateway.');
  await page.locator('.ai-conversation-modal button', { hasText: 'Next' }).click();

  // Step 2: the built prompt embeds the message and the current diagram.
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 2 of 3/);
  const promptArea = page.locator('.ai-conversation-modal .ai-review-prompt');
  await expect(promptArea).toHaveValue(/Add a cache next to the gateway\./);
  await expect(promptArea).toHaveValue(/API Gateway/);
  // The user's own turn is already recorded once "Next" moved past step 1.
  await expect(page.locator('.ai-conversation-turn-user')).toContainText('Add a cache next to the gateway.');

  await page.locator('.ai-conversation-modal button', { hasText: 'Next' }).click();

  // Step 3: paste the reply, preview the patch, and apply it.
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 3 of 3/);
  await page.locator('.ai-conversation-response').fill(PATCH_REPLY);
  await page.locator('.ai-conversation-modal button', { hasText: 'Continue' }).click();

  await expect(page.locator('.ai-conversation-preview-message')).toContainText("Sure, I'll add a cache for you.");
  await expect(page.locator('.ai-edit-preview-row')).toHaveCount(2); // +node, +edge
  await page.locator('.ai-conversation-modal button', { hasText: 'Apply update & continue' }).click();

  await expect(page.locator('.toast-success', { hasText: 'Applied' })).toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect(page.locator('.node', { hasText: 'Redis Cache' })).toBeVisible();

  // Back at step 1, ready for another round — and the transcript now shows
  // both turns, the AI one flagged as having updated the diagram.
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 1 of 3/);
  await expect(page.locator('.ai-conversation-turn')).toHaveCount(2);
  await expect(page.locator('.ai-conversation-turn-ai')).toContainText("Sure, I'll add a cache for you.");
  await expect(page.locator('.ai-conversation-turn-ai .ai-conversation-turn-badge')).toHaveText('✓ diagram updated');
});

test('the transcript persists across reopening the modal, and every new prompt replays it', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openConversation(page);

  await page.locator('.ai-conversation-draft').fill('What does this diagram do?');
  await page.locator('.ai-conversation-modal button', { hasText: 'Next' }).click();
  await page.locator('.ai-conversation-modal button', { hasText: 'Next' }).click();
  await page.locator('.ai-conversation-response').fill('This is a simple API gateway with no backend yet.');
  await page.locator('.ai-conversation-modal button', { hasText: 'Continue' }).click();
  // A pure-text reply (no JSON block) has nothing to preview — one button adds it straight away.
  await page.locator('.ai-conversation-modal button', { hasText: 'Add to conversation' }).click();

  await expect(page.locator('.ai-conversation-turn')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ai-conversation-modal')).not.toBeVisible();

  // Reopening resumes the same transcript instead of starting fresh.
  await openConversation(page);
  await expect(page.locator('.ai-conversation-turn')).toHaveCount(2);

  await page.locator('.ai-conversation-draft').fill('Now add a database too.');
  await page.locator('.ai-conversation-modal button', { hasText: 'Next' }).click();
  const promptArea = page.locator('.ai-conversation-modal .ai-review-prompt');
  await expect(promptArea).toHaveValue(/CONVERSATION SO FAR/);
  await expect(promptArea).toHaveValue(/What does this diagram do\?/);
  await expect(promptArea).toHaveValue(/This is a simple API gateway with no backend yet\./);
  await expect(promptArea).toHaveValue(/Now add a database too\./);
});

test('"Clear conversation" empties the transcript after confirming', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openConversation(page);
  await page.locator('.ai-conversation-draft').fill('hello');
  await page.locator('.ai-conversation-modal button', { hasText: 'Next' }).click();
  await expect(page.locator('.ai-conversation-turn')).toHaveCount(1);

  await page.locator('.ai-conversation-clear').click();
  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-modal button', { hasText: 'Clear' }).click();

  await expect(page.locator('.ai-conversation-empty')).toBeVisible();
  await expect(page.locator('.modal-step-indicator')).toHaveText(/Step 1 of 3/);
});

test('pasting a reply that changes nothing recognizable can still be added to the conversation', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await openConversation(page);
  await page.locator('.ai-conversation-draft').fill('remove something that does not exist');
  await page.locator('.ai-conversation-modal button', { hasText: 'Next' }).click();
  await page.locator('.ai-conversation-modal button', { hasText: 'Next' }).click();
  await page.locator('.ai-conversation-response').fill('```json\n{"removeNodeIds": ["nope"]}\n```');
  await page.locator('.ai-conversation-modal button', { hasText: 'Continue' }).click();

  await page.locator('.ai-conversation-modal button', { hasText: 'Add to conversation' }).click();
  await expect(page.locator('.ai-conversation-turn')).toHaveCount(2);
  await expect(page.locator('.ai-conversation-turn-ai .ai-conversation-turn-badge')).toHaveCount(0); // never applied
});
