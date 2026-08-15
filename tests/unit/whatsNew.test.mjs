import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import { checkWhatsNew, getLastSeenVersion, markVersionSeen, getUnseenHighlights } from '../../js/io/whatsNew.js';
import { APP_VERSION, VERSION_HISTORY } from '../../js/version.js';
import { writeJSON } from '../../js/io/storage.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('a brand-new visitor (nothing at all in storage) never gets the modal', () => {
  const result = checkWhatsNew();
  assert.equal(result.show, false);
  assert.deepEqual(result.highlights, []);
});

test('a returning visitor with prior app data but no tracked version sees every highlight', () => {
  writeJSON('savedProjects', []); // simulates "has used the app before version tracking existed"
  const result = checkWhatsNew();
  assert.equal(result.show, true);
  assert.deepEqual(result.highlights, VERSION_HISTORY);
});

test('a visitor already on the current version does not see the modal', () => {
  markVersionSeen(APP_VERSION);
  const result = checkWhatsNew();
  assert.equal(result.show, false);
});

test('a visitor on an older/unknown version sees the modal with everything newer', () => {
  markVersionSeen('0.9.0');
  const result = checkWhatsNew();
  assert.equal(result.show, true);
  assert.deepEqual(result.highlights, getUnseenHighlights('0.9.0'));
});

test('markVersionSeen defaults to APP_VERSION and getLastSeenVersion reflects it', () => {
  assert.equal(getLastSeenVersion(), null);
  markVersionSeen();
  assert.equal(getLastSeenVersion(), APP_VERSION);
});

test('getUnseenHighlights: exact current version yields nothing, unknown version yields everything', () => {
  assert.deepEqual(getUnseenHighlights(APP_VERSION), []);
  assert.deepEqual(getUnseenHighlights('not-a-real-version'), VERSION_HISTORY);
});
