import { test, expect } from '@playwright/test';
import { dismissHints, openToolbarGroup, addComponentByName, nodeCount } from './helpers.js';

// Two tabs of the same app, in the same browser context — same pattern as
// duplicateTabWarning.spec.js. Each page has its own JS module state
// (transport/session live at module scope in modals/collaborationModal.js,
// per page, not per browsing context), so this genuinely exercises two
// independent RTCPeerConnections negotiating with each other, not a shared
// in-memory mock — the manual code-exchange method needs no server at all,
// so this loopback works even in a sandboxed CI browser. The "quick room
// code" method (collab/peerjsCollab.js) crosses a real public broker and
// is documented as untested here — see vendor/VENDOR.md's WebLLM note for
// the same category of sandbox limitation.
async function openCollab(page) {
  await openToolbarGroup(page, 'Tools');
  await page.locator('#toolbar button', { hasText: 'Collaborate' }).click();
  await expect(page.locator('.collaboration-modal')).toBeVisible();
}

test('two tabs connect via manual code exchange and sync edits both ways', async ({ context }) => {
  test.setTimeout(60000);
  const host = await context.newPage();
  await host.goto('/index.html');
  await dismissHints(host);
  await addComponentByName(host, 'Redis');
  await expect.poll(() => nodeCount(host)).toBe(1);

  await openCollab(host);
  await host.locator('.collaboration-modal button', { hasText: 'Host a session' }).click();
  await host.locator('.collaboration-modal button', { hasText: 'Manual code exchange' }).click();

  const offerArea = host.locator('.collaboration-modal .collab-code-area').first();
  await expect(offerArea).not.toHaveValue('', { timeout: 15000 });
  const offerCode = await offerArea.inputValue();
  expect(offerCode.length).toBeGreaterThan(10);

  const guest = await context.newPage();
  await guest.goto('/index.html');
  await dismissHints(guest);

  await openCollab(guest);
  await guest.locator('.collaboration-modal button', { hasText: 'Join a session' }).click();
  // The guest tab shares this browser context's localStorage with the host
  // tab (same as duplicateTabWarning.spec.js), so it inherits the host's
  // autosaved Redis node and gets asked to confirm before syncing over it —
  // a real host/guest pair would be on separate devices with no such
  // overlap, but the confirmation still needs handling here.
  const confirmBtn = guest.locator('.confirm-modal button', { hasText: 'Join anyway' });
  const confirmAppeared = await confirmBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);
  if (confirmAppeared) await confirmBtn.click();
  await guest.locator('.collaboration-modal button', { hasText: 'Manual code exchange' }).click();
  await guest.locator('.collaboration-modal .collab-code-area').first().fill(offerCode);
  await guest.locator('.collaboration-modal button', { hasText: 'Generate answer code' }).click();

  const answerArea = guest.locator('.collaboration-modal .collab-code-area[readonly]');
  await expect(answerArea).not.toHaveValue('', { timeout: 15000 });
  const answerCode = await answerArea.inputValue();
  expect(answerCode.length).toBeGreaterThan(10);

  // Back on the host: paste the guest's answer and finish connecting.
  await host.locator('.collaboration-modal .collab-code-area:not([readonly])').fill(answerCode);
  await host.locator('.collaboration-modal button', { hasText: 'Connect' }).click();

  await expect(host.locator('.collab-status-connected')).toBeVisible({ timeout: 20000 });
  await expect(guest.locator('.collab-status-connected')).toBeVisible({ timeout: 20000 });

  // The host pushes its current canvas the moment the connection opens —
  // note addComponentByName's search-then-click-first-match isn't a
  // reliable way to assert *which* component landed (searching "Redis"
  // can also match "Redis Cache"/"Redis Streams"/etc depending on sidebar
  // order), so the count is the meaningful assertion that the whole-state
  // sync actually happened.
  await expect.poll(() => nodeCount(guest), { timeout: 10000 }).toBe(1);

  // Host adds a component — it should reach the guest.
  await host.locator('.collaboration-modal .modal-close').click();
  await addComponentByName(host, 'PostgreSQL');
  await expect.poll(() => nodeCount(guest), { timeout: 10000 }).toBe(2);

  // Guest adds a component — it should reach the host (bidirectional sync).
  await guest.locator('.collaboration-modal .modal-close').click();
  await addComponentByName(guest, 'Kafka');
  await expect.poll(() => nodeCount(host), { timeout: 10000 }).toBe(3);

  await host.close();
  await guest.close();
});

test('the toolbar shows a connected badge once live sync is active, even after the modal is closed', async ({ context }) => {
  test.setTimeout(60000);
  const host = await context.newPage();
  await host.goto('/index.html');
  await dismissHints(host);

  await openCollab(host);
  await host.locator('.collaboration-modal button', { hasText: 'Host a session' }).click();
  await host.locator('.collaboration-modal button', { hasText: 'Manual code exchange' }).click();
  const offerArea = host.locator('.collaboration-modal .collab-code-area').first();
  await expect(offerArea).not.toHaveValue('', { timeout: 15000 });
  const offerCode = await offerArea.inputValue();
  // Close the modal before anyone joins — the session must still complete once a guest connects.
  await host.locator('.collaboration-modal .modal-close').click();

  const guest = await context.newPage();
  await guest.goto('/index.html');
  await dismissHints(guest);
  await openCollab(guest);
  await guest.locator('.collaboration-modal button', { hasText: 'Join a session' }).click();
  await guest.locator('.collaboration-modal button', { hasText: 'Manual code exchange' }).click();
  await guest.locator('.collaboration-modal .collab-code-area').first().fill(offerCode);
  await guest.locator('.collaboration-modal button', { hasText: 'Generate answer code' }).click();
  const answerArea = guest.locator('.collaboration-modal .collab-code-area[readonly]');
  await expect(answerArea).not.toHaveValue('', { timeout: 15000 });
  const answerCode = await answerArea.inputValue();

  await openCollab(host);
  await host.locator('.collaboration-modal .collab-code-area:not([readonly])').fill(answerCode);
  await host.locator('.collaboration-modal button', { hasText: 'Connect' }).click();
  await expect(host.locator('.collab-status-connected')).toBeVisible({ timeout: 20000 });
  await host.locator('.collaboration-modal .modal-close').click();

  await openToolbarGroup(host, 'Tools');
  await expect(host.locator('.toolbar-collab-badge')).toBeVisible();

  await host.close();
  await guest.close();
});
