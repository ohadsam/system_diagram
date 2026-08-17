// Favorites: a personal, folder-organized shortcut list into the component
// library (built-in components/layers/patterns, or "My Components"),
// persisted in localStorage. Folders can nest into subfolders; both folders
// and favorite entries carry a numeric `order` used for manual up/down
// reordering — see sidebar.js's "Favorites" section for the UI.
import { readJSON, writeJSON } from './storage.js';
import { nextId } from '../core/id.js';

const FOLDERS_KEY = 'favoriteFolders';
const ITEMS_KEY = 'favorites';
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn();
}

export function onFavoritesChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getFavoriteFolders() {
  return readJSON(FOLDERS_KEY, []);
}

export function getFavorites() {
  return readJSON(ITEMS_KEY, []);
}

export function isFavorite(defId) {
  return getFavorites().some((f) => f.defId === defId);
}

export function getChildFolders(parentId = null) {
  return getFavoriteFolders().filter((f) => f.parentId === parentId).sort((a, b) => a.order - b.order);
}

export function getFavoritesInFolder(folderId = null) {
  return getFavorites().filter((f) => f.folderId === folderId).sort((a, b) => a.order - b.order);
}

/** Adds defId as a favorite in folderId (null = unfiled, at root), placed
 * after any existing favorites in that folder. No-op if already a favorite —
 * use moveFavoriteToFolder to relocate one that's already saved. */
export function addFavorite(defId, folderId = null) {
  const items = getFavorites();
  if (items.some((f) => f.defId === defId)) return;
  const siblingOrders = items.filter((f) => f.folderId === folderId).map((f) => f.order);
  const order = siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0;
  items.push({ id: nextId('fav'), defId, folderId, order });
  writeJSON(ITEMS_KEY, items);
  emit();
}

export function removeFavorite(defId) {
  const items = getFavorites().filter((f) => f.defId !== defId);
  writeJSON(ITEMS_KEY, items);
  emit();
}

export function toggleFavorite(defId, folderId = null) {
  if (isFavorite(defId)) removeFavorite(defId);
  else addFavorite(defId, folderId);
}

export function moveFavoriteToFolder(defId, folderId) {
  const items = getFavorites();
  const entry = items.find((f) => f.defId === defId);
  if (!entry) return;
  const siblingOrders = items.filter((f) => f.folderId === folderId && f.defId !== defId).map((f) => f.order);
  entry.folderId = folderId;
  entry.order = siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0;
  writeJSON(ITEMS_KEY, items);
  emit();
}

/** Swaps a favorite's order with its immediate neighbor within the same
 * folder ('up' moves it toward index 0). No-op if already at that end. */
export function reorderFavorite(defId, direction) {
  const items = getFavorites();
  const entry = items.find((f) => f.defId === defId);
  if (!entry) return;
  const siblings = items.filter((f) => f.folderId === entry.folderId).sort((a, b) => a.order - b.order);
  const idx = siblings.findIndex((f) => f.defId === defId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  const other = siblings[swapIdx];
  const tmp = entry.order;
  entry.order = other.order;
  other.order = tmp;
  writeJSON(ITEMS_KEY, items);
  emit();
}

export function createFolder(name, parentId = null) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const folders = getFavoriteFolders();
  const siblingOrders = folders.filter((f) => f.parentId === parentId).map((f) => f.order);
  const order = siblingOrders.length ? Math.max(...siblingOrders) + 1 : 0;
  const folder = { id: nextId('favfolder'), name: trimmed, parentId, order };
  folders.push(folder);
  writeJSON(FOLDERS_KEY, folders);
  emit();
  return folder;
}

export function renameFolder(id, name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  const folders = getFavoriteFolders();
  const folder = folders.find((f) => f.id === id);
  if (!folder) return;
  folder.name = trimmed;
  writeJSON(FOLDERS_KEY, folders);
  emit();
}

/** Swaps a folder's order with its immediate sibling ('up' moves it toward
 * index 0), among folders sharing the same parent. No-op at either end. */
export function reorderFolder(id, direction) {
  const folders = getFavoriteFolders();
  const folder = folders.find((f) => f.id === id);
  if (!folder) return;
  const siblings = folders.filter((f) => f.parentId === folder.parentId).sort((a, b) => a.order - b.order);
  const idx = siblings.findIndex((f) => f.id === id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) return;
  const other = siblings[swapIdx];
  const tmp = folder.order;
  folder.order = other.order;
  other.order = tmp;
  writeJSON(FOLDERS_KEY, folders);
  emit();
}

/** Recursively collects id and every descendant subfolder's id (for cascade delete/count). */
function collectFolderIds(id, folders, out = new Set()) {
  out.add(id);
  for (const f of folders) {
    if (f.parentId === id) collectFolderIds(f.id, folders, out);
  }
  return out;
}

/** Counts subfolders + favorites that deleteFolder(id) would remove, for a confirm dialog. */
export function countFolderContents(id) {
  const folders = getFavoriteFolders();
  const idsToRemove = collectFolderIds(id, folders);
  const items = getFavorites();
  return {
    subfolders: folders.filter((f) => idsToRemove.has(f.id) && f.id !== id).length,
    favorites: items.filter((f) => idsToRemove.has(f.folderId)).length,
  };
}

/** Deletes a folder and every descendant subfolder, un-favoriting (never
 * deleting the underlying component itself) anything filed inside any of
 * them. Returns the same counts as countFolderContents(id) reported *before*
 * the delete. */
export function deleteFolder(id) {
  const before = countFolderContents(id);
  const folders = getFavoriteFolders();
  const idsToRemove = collectFolderIds(id, folders);
  writeJSON(FOLDERS_KEY, folders.filter((f) => !idsToRemove.has(f.id)));
  writeJSON(ITEMS_KEY, getFavorites().filter((f) => !idsToRemove.has(f.folderId)));
  emit();
  return before;
}

/** Merges an imported folder+favorite bundle (see io/fullBackup.js). Existing
 * folders/favorites (matched by id) are left untouched; anything with a new
 * id is appended — an additive merge like importCustomComponents, not a full
 * overwrite like nodeDefaults, since this is personal library data a restore
 * should add to rather than replace. Never throws. */
export function importFavoritesBundle(folders, items) {
  const existingFolders = getFavoriteFolders();
  const existingFolderIds = new Set(existingFolders.map((f) => f.id));
  const newFolders = Array.isArray(folders)
    ? folders.filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string' && !existingFolderIds.has(f.id))
    : [];
  writeJSON(FOLDERS_KEY, [...existingFolders, ...newFolders]);

  const existingItems = getFavorites();
  const existingItemIds = new Set(existingItems.map((f) => f.id));
  const newItems = Array.isArray(items)
    ? items.filter((f) => f && typeof f.id === 'string' && typeof f.defId === 'string' && !existingItemIds.has(f.id))
    : [];
  writeJSON(ITEMS_KEY, [...existingItems, ...newItems]);

  emit();
  return { importedFolders: newFolders.length, importedFavorites: newItems.length };
}
