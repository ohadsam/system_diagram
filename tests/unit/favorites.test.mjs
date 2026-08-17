import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from './testSupport.mjs';
import {
  getFavorites, addFavorite, removeFavorite, toggleFavorite, isFavorite,
  moveFavoriteToFolder, reorderFavorite, getFavoritesInFolder,
  createFolder, renameFolder, reorderFolder, getChildFolders,
  countFolderContents, deleteFolder, getFavoriteFolders, importFavoritesBundle,
} from '../../js/io/favorites.js';

const resetStorage = installMemoryLocalStorage();
beforeEach(() => resetStorage());

test('addFavorite adds an unfiled favorite; adding the same defId again is a no-op', () => {
  addFavorite('db-postgres');
  addFavorite('db-postgres');
  assert.equal(getFavorites().length, 1);
  assert.equal(isFavorite('db-postgres'), true);
  assert.equal(isFavorite('db-mysql'), false);
});

test('toggleFavorite adds when absent and removes when present', () => {
  toggleFavorite('db-redis');
  assert.equal(isFavorite('db-redis'), true);
  toggleFavorite('db-redis');
  assert.equal(isFavorite('db-redis'), false);
  assert.equal(getFavorites().length, 0);
});

test('removeFavorite on a defId that was never favorited is a safe no-op', () => {
  assert.doesNotThrow(() => removeFavorite('nope'));
  assert.equal(getFavorites().length, 0);
});

test('favorites in the same folder get increasing order; unfiled (null) and a folder are independent', () => {
  const folder = createFolder('Databases');
  addFavorite('db-postgres', folder.id);
  addFavorite('db-mysql', folder.id);
  addFavorite('ctr-docker'); // unfiled
  const inFolder = getFavoritesInFolder(folder.id);
  assert.deepEqual(inFolder.map((f) => f.defId), ['db-postgres', 'db-mysql']);
  assert.equal(inFolder[0].order < inFolder[1].order, true);
  assert.deepEqual(getFavoritesInFolder(null).map((f) => f.defId), ['ctr-docker']);
});

test('moveFavoriteToFolder relocates an existing favorite and re-orders it after the target folder\'s existing items', () => {
  const a = createFolder('A');
  const b = createFolder('B');
  addFavorite('db-postgres', a.id);
  addFavorite('db-mysql', b.id);
  moveFavoriteToFolder('db-postgres', b.id);
  assert.deepEqual(getFavoritesInFolder(a.id), []);
  assert.deepEqual(getFavoritesInFolder(b.id).map((f) => f.defId), ['db-mysql', 'db-postgres']);
});

test('reorderFavorite swaps order with its neighbor and is a no-op past either end', () => {
  addFavorite('db-postgres');
  addFavorite('db-mysql');
  addFavorite('db-redis');
  assert.deepEqual(getFavoritesInFolder(null).map((f) => f.defId), ['db-postgres', 'db-mysql', 'db-redis']);

  reorderFavorite('db-mysql', 'up');
  assert.deepEqual(getFavoritesInFolder(null).map((f) => f.defId), ['db-mysql', 'db-postgres', 'db-redis']);

  reorderFavorite('db-mysql', 'up'); // already first, no-op
  assert.deepEqual(getFavoritesInFolder(null).map((f) => f.defId), ['db-mysql', 'db-postgres', 'db-redis']);

  reorderFavorite('db-redis', 'down'); // already last, no-op
  assert.deepEqual(getFavoritesInFolder(null).map((f) => f.defId), ['db-mysql', 'db-postgres', 'db-redis']);
});

test('createFolder trims the name and rejects an empty/whitespace-only one', () => {
  const folder = createFolder('  My Stack  ');
  assert.equal(folder.name, 'My Stack');
  assert.equal(createFolder('   '), null);
  assert.equal(createFolder(''), null);
});

test('createFolder(parentId) creates a subfolder; getChildFolders scopes to the right parent', () => {
  const root = createFolder('Backend');
  const sub = createFolder('Databases', root.id);
  assert.equal(sub.parentId, root.id);
  assert.deepEqual(getChildFolders(root.id).map((f) => f.id), [sub.id]);
  assert.deepEqual(getChildFolders(null).map((f) => f.id), [root.id]);
});

test('renameFolder trims and ignores an empty name', () => {
  const folder = createFolder('Original');
  renameFolder(folder.id, '  Renamed  ');
  assert.equal(getChildFolders(null)[0].name, 'Renamed');
  renameFolder(folder.id, '   ');
  assert.equal(getChildFolders(null)[0].name, 'Renamed'); // unchanged
});

test('reorderFolder swaps sibling order and is a no-op past either end', () => {
  const a = createFolder('A');
  const b = createFolder('B');
  const c = createFolder('C');
  assert.deepEqual(getChildFolders(null).map((f) => f.id), [a.id, b.id, c.id]);
  reorderFolder(b.id, 'up');
  assert.deepEqual(getChildFolders(null).map((f) => f.id), [b.id, a.id, c.id]);
  reorderFolder(b.id, 'up'); // already first
  assert.deepEqual(getChildFolders(null).map((f) => f.id), [b.id, a.id, c.id]);
  reorderFolder(c.id, 'down'); // already last
  assert.deepEqual(getChildFolders(null).map((f) => f.id), [b.id, a.id, c.id]);
});

test('countFolderContents / deleteFolder cascade through subfolders and un-favorite (never delete) their contents', () => {
  const root = createFolder('Backend');
  const sub = createFolder('Databases', root.id);
  addFavorite('db-postgres', root.id);
  addFavorite('db-mysql', sub.id);
  addFavorite('ctr-docker'); // unrelated, unfiled

  const counts = countFolderContents(root.id);
  assert.equal(counts.subfolders, 1);
  assert.equal(counts.favorites, 2);

  const removed = deleteFolder(root.id);
  assert.deepEqual(removed, counts);
  assert.deepEqual(getChildFolders(null), []);
  assert.deepEqual(getFavorites().map((f) => f.defId), ['ctr-docker']);
});

test('deleteFolder on a leaf folder with no contents just removes the folder', () => {
  const folder = createFolder('Empty');
  const removed = deleteFolder(folder.id);
  assert.deepEqual(removed, { subfolders: 0, favorites: 0 });
  assert.deepEqual(getChildFolders(null), []);
});

test('importFavoritesBundle (full-backup restore) adds new folders/favorites and leaves existing ones (by id) untouched', () => {
  const existingFolder = createFolder('Existing');
  addFavorite('db-postgres', existingFolder.id);

  const result = importFavoritesBundle(
    [
      { id: existingFolder.id, name: 'Existing (from backup, should be ignored)', parentId: null, order: 5 },
      { id: 'favfolder_new', name: 'From Backup', parentId: null, order: 0 },
    ],
    [
      { id: 'fav_new', defId: 'db-mysql', folderId: 'favfolder_new', order: 0 },
    ],
  );

  assert.deepEqual(result, { importedFolders: 1, importedFavorites: 1 });
  assert.equal(getFavoriteFolders().find((f) => f.id === existingFolder.id).name, 'Existing'); // unchanged, not overwritten
  assert.ok(getFavoriteFolders().some((f) => f.id === 'favfolder_new'));
  assert.equal(isFavorite('db-mysql'), true);
  assert.equal(isFavorite('db-postgres'), true); // pre-existing favorite untouched
});

test('importFavoritesBundle tolerates missing/malformed input without throwing', () => {
  assert.doesNotThrow(() => importFavoritesBundle(undefined, undefined));
  assert.deepEqual(importFavoritesBundle(null, 'not-an-array'), { importedFolders: 0, importedFavorites: 0 });
});
