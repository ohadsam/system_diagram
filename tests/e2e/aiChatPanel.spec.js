// "🤖 AI Chat" (panel/aiChatPanel.js) — a fast, in-app live chat with
// whichever automatic AI mode is configured, sharing its transcript with
// "🗨️ AI Conversation" (both are the same underlying conversation,
// io/aiConversationStore.js, just two different UIs). Direct calls are
// intercepted via page.route, same convention as ai-provider-direct.spec.js.
import { test, expect } from '@playwright/test';
import { dismissHints, addComponentByName, nodeCount, openToolbarGroup } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await dismissHints(page);
});

async function openAiChat(page) {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'AI Chat' }).click();
  await expect(page.locator('#ai-chat-panel')).toHaveClass(/open/);
}

async function configureDirectClaude(page) {
  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button[title="Default settings for new components"]').click();
  await expect(page.locator('.default-settings-modal')).toBeVisible();
  await page.locator('.ai-provider-settings select').first().selectOption('direct');
  const keyInput = page.locator('.ai-provider-settings-row').first().locator('input[type=password]');
  await keyInput.fill('sk-test-123');
  await keyInput.blur();
  await page.locator('.default-settings-modal button', { hasText: 'Cancel' }).click();
}

test('without Direct API/Local AI configured, opening AI Chat shows a setup nudge instead of a chat box', async ({ page }) => {
  await openAiChat(page);
  await expect(page.locator('.ai-chat-setup')).toBeVisible();
  await expect(page.locator('.ai-chat-input-row')).toHaveCount(0);
  await expect(page.locator('.ai-chat-panel button', { hasText: 'Set up AI now' })).toBeVisible();
  await expect(page.locator('.ai-chat-panel button', { hasText: 'Open AI Conversation' })).toBeVisible();
});

test('a full round trip: send a message, get a plain-text reply, and it stays in the transcript', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await configureDirectClaude(page);
  await openAiChat(page);

  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: 'This diagram has one API Gateway and nothing else yet.' }] }),
  }));

  await page.locator('.ai-chat-input').fill('What does this diagram do?');
  await page.locator('.ai-chat-send-btn').click();

  await expect(page.locator('.ai-conversation-turn-user')).toContainText('What does this diagram do?');
  await expect(page.locator('.ai-conversation-turn-ai')).toContainText('This diagram has one API Gateway and nothing else yet.');
  await expect(page.locator('.ai-chat-input')).toHaveValue('');
});

test('a reply proposing a diagram change previews inline and applies as one step on "Apply update"', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await configureDirectClaude(page);
  await openAiChat(page);

  const existingNodeId = await page.locator('.node').first().getAttribute('data-node-id');
  const replyText = `Sure, adding a cache.

\`\`\`json
{
  "addNodes": [{ "id": "new1", "x": 460, "y": 40, "w": 160, "h": 84, "shape": "cylinder", "text": "Redis Cache", "icon": "⚡" }],
  "addEdges": [{ "id": "newe1", "from": "${existingNodeId}", "to": "new1", "label": "reads/writes" }]
}
\`\`\``;
  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: replyText }] }),
  }));

  await page.locator('.ai-chat-input').fill('Add a cache next to the gateway.');
  await page.locator('.ai-chat-send-btn').click();

  await expect(page.locator('.ai-chat-patch-card')).toBeVisible();
  await expect(page.locator('.ai-chat-patch-card .ai-edit-preview-row')).toHaveCount(2);
  await page.locator('.ai-chat-patch-card button', { hasText: 'Apply update' }).click();

  await expect(page.locator('.toast-success', { hasText: 'Applied' })).toBeVisible();
  await expect.poll(() => nodeCount(page)).toBe(2);
  await expect(page.locator('.ai-conversation-turn-ai .ai-conversation-turn-badge')).toHaveText('✓ diagram updated');
  await expect(page.locator('.ai-chat-patch-card')).toHaveCount(0);
});

test('dismissing a proposed patch leaves the diagram untouched and clears the preview card', async ({ page }) => {
  await addComponentByName(page, 'API Gateway');
  await configureDirectClaude(page);
  await openAiChat(page);

  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: '```json\n{"addNodes": [{"id": "new1", "text": "Extra"}]}\n```' }] }),
  }));

  await page.locator('.ai-chat-input').fill('add something');
  await page.locator('.ai-chat-send-btn').click();
  await expect(page.locator('.ai-chat-patch-card')).toBeVisible();

  await page.locator('.ai-chat-patch-card button', { hasText: 'Dismiss' }).click();
  await expect(page.locator('.ai-chat-patch-card')).toHaveCount(0);
  await expect.poll(() => nodeCount(page)).toBe(1);
});

test('the transcript is shared with "🗨️ AI Conversation" — a message sent from one shows up in the other', async ({ page }) => {
  await configureDirectClaude(page);
  await openAiChat(page);

  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: 'Got it.' }] }),
  }));
  await page.locator('.ai-chat-input').fill('hello from the live chat');
  await page.locator('.ai-chat-send-btn').click();
  await expect(page.locator('.ai-conversation-turn-ai')).toContainText('Got it.');

  await openToolbarGroup(page, 'Create');
  await page.locator('#toolbar button', { hasText: 'AI Conversation' }).click();
  await expect(page.locator('.ai-conversation-modal .ai-conversation-turn-user')).toContainText('hello from the live chat');
  await expect(page.locator('.ai-conversation-modal .ai-conversation-turn-ai')).toContainText('Got it.');
});

test('dock mode buttons switch the panel between right/bottom/floating', async ({ page }) => {
  await configureDirectClaude(page);
  await openAiChat(page);

  await expect(page.locator('#ai-chat-panel')).toHaveClass(/dock-right/);
  await page.locator('.ai-chat-dock-btn[title="Dock to the bottom"]').click();
  await expect(page.locator('#ai-chat-panel')).toHaveClass(/dock-bottom/);
  await page.locator('.ai-chat-dock-btn[title^="Float"]').click();
  await expect(page.locator('#ai-chat-panel')).toHaveClass(/dock-floating/);
});

test('dock-right panel can be resized by dragging its left edge, and the new width persists after reopening', async ({ page }) => {
  await openAiChat(page);
  const panel = page.locator('#ai-chat-panel');
  const before = await panel.boundingBox();
  const handleBox = await page.locator('.ai-chat-resize-w').boundingBox();

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 100, handleBox.y + handleBox.height / 2, { steps: 10 });
  await page.mouse.up();

  const after = await panel.boundingBox();
  expect(after.width).toBeGreaterThan(before.width + 50);

  await page.reload();
  await dismissHints(page);
  await openAiChat(page);
  const reopened = await page.locator('#ai-chat-panel').boundingBox();
  expect(Math.abs(reopened.width - after.width)).toBeLessThan(5);
});

test('dock-bottom panel can be resized by dragging its top edge', async ({ page }) => {
  await openAiChat(page);
  await page.locator('.ai-chat-dock-btn[title="Dock to the bottom"]').click();
  await expect(page.locator('#ai-chat-panel')).toHaveClass(/dock-bottom/);
  const panel = page.locator('#ai-chat-panel');
  const before = await panel.boundingBox();
  const handleBox = await page.locator('.ai-chat-resize-h').boundingBox();

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y - 100, { steps: 10 });
  await page.mouse.up();

  const after = await panel.boundingBox();
  expect(after.height).toBeGreaterThan(before.height + 50);
});

test('floating panel can be resized from its corner grip, changing both width and height', async ({ page }) => {
  await openAiChat(page);
  await page.locator('.ai-chat-dock-btn[title^="Float"]').click();
  await expect(page.locator('#ai-chat-panel')).toHaveClass(/dock-floating/);
  const panel = page.locator('#ai-chat-panel');
  const before = await panel.boundingBox();
  const handleBox = await page.locator('.ai-chat-resize-corner').boundingBox();

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 80, handleBox.y + 80, { steps: 10 });
  await page.mouse.up();

  const after = await panel.boundingBox();
  expect(after.width).toBeGreaterThan(before.width + 40);
  expect(after.height).toBeGreaterThan(before.height + 40);
});

test('"Clear conversation" empties the transcript after confirming', async ({ page }) => {
  await configureDirectClaude(page);
  await openAiChat(page);

  await page.route('https://api.anthropic.com/v1/messages', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ content: [{ type: 'text', text: 'Sure.' }] }),
  }));
  await page.locator('.ai-chat-input').fill('hi');
  await page.locator('.ai-chat-send-btn').click();
  await expect(page.locator('.ai-conversation-turn')).toHaveCount(2);

  await page.locator('.ai-conversation-clear').click();
  await expect(page.locator('.confirm-modal')).toBeVisible();
  await page.locator('.confirm-modal button', { hasText: 'Clear' }).click();
  await expect(page.locator('.ai-conversation-empty')).toBeVisible();
});
