// Left sidebar: search box + categorized, alphabetically sorted, draggable
// component library (built-in + the user's "My Components" + "Favorites").
import { CATEGORIES, COMPONENTS_BY_CATEGORY, getComponentById } from '../data/index.js';
import {
  getCustomComponents, onCustomComponentsChange, deleteCustomComponent,
  exportCustomComponents, importCustomComponents,
} from '../io/customComponents.js';
import {
  getFavorites, onFavoritesChange, isFavorite, toggleFavorite, removeFavorite,
  moveFavoriteToFolder, reorderFavorite, getFavoritesInFolder,
  getFavoriteFolders, getChildFolders, createFolder, renameFolder, reorderFolder,
  countFolderContents, deleteFolder,
} from '../io/favorites.js';
import { el, clear } from '../utils/dom.js';
import { filterComponents, normalize, componentMatches } from './search.js';
import { makeDraggable } from './dragSource.js';
import { attachPatternPreview, isSequenceDiagramPattern, hidePatternPreview } from './patternPreview.js';
import { showContextMenu } from '../canvas/contextMenu.js';
import { confirmAction } from '../modals/confirmModal.js';
import { promptText } from '../modals/promptModal.js';
import { pickJSONFile } from '../io/fileIO.js';
import { showToast } from '../utils/toast.js';
import { getLibrarySettings, onLibrarySettingsChange, saveLibrarySettings } from '../io/librarySettings.js';
import { getRecentComponentIds, onRecentComponentsChange } from '../io/recentComponents.js';
import { t } from '../io/i18n.js';

const CUSTOM_CATEGORY = { id: '__custom__', label: 'My Components', color: '#0F172A' };
const FAVORITES_CATEGORY = { id: '__favorites__', label: 'Favorites', color: '#F59E0B' };
const RECENT_CATEGORY = { id: '__recent__', label: 'Recently Used', color: '#0EA5E9' };
const NO_FOLDER = '';

let rootEl = null;
let searchInput = null;
let listEl = null;
const expanded = new Map();
const folderExpanded = new Map();
const favFolderExpanded = new Map();
let query = '';
let popularOnly = false;
let editCustomComponentHandler = null;

/** Resolves a favorite's stored defId back to its full component definition
 * — either a built-in library component or one of the user's own "My
 * Components" — so it can render the same as any other sidebar item. */
function resolveFavoriteDef(defId) {
  return getComponentById(defId) || getCustomComponents().find((c) => c.id === defId) || null;
}

/** Same resolution as resolveFavoriteDef, for the Recently Used list. */
function resolveRecentDef(defId) {
  return getComponentById(defId) || getCustomComponents().find((c) => c.id === defId) || null;
}

export function configureSidebar({ onEditCustomComponent } = {}) {
  editCustomComponentHandler = onEditCustomComponent || null;
}

export function initSidebar(root) {
  rootEl = root;
  rootEl.classList.add('sidebar');

  const searchWrap = el('div', { class: 'sidebar-search' });
  searchInput = el('input', {
    type: 'search',
    placeholder: t('sidebar.search.placeholder'),
    'aria-label': t('sidebar.search.placeholder'),
    onInput: (e) => {
      query = e.target.value;
      renderList();
    },
  });
  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(el('span', { class: 'sidebar-search-icon', text: '🔎', 'aria-hidden': 'true' }));
  rootEl.appendChild(searchWrap);

  const popularBtn = el('button', {
    type: 'button',
    class: 'sidebar-popular-toggle',
    'aria-pressed': 'false',
    title: 'Show only ★ popular components — the most commonly-used building block in each category',
    onClick: () => {
      popularOnly = !popularOnly;
      popularBtn.classList.toggle('active', popularOnly);
      popularBtn.setAttribute('aria-pressed', String(popularOnly));
      renderList();
    },
  });
  popularBtn.appendChild(el('span', { text: '★', 'aria-hidden': 'true' }));
  popularBtn.appendChild(el('span', { text: t('sidebar.popularOnly') }));
  const togglesRow = el('div', { class: 'sidebar-toggles-row' });
  togglesRow.appendChild(popularBtn);
  rootEl.appendChild(togglesRow);

  // Compact library: hide the full built-in category browser by default,
  // keeping only Favorites/Recently Used/My Components (plus whatever a
  // search matches, regardless of this setting — see renderList) — a new
  // visitor otherwise lands on ~28 collapsed categories with no sense of
  // which matter to them yet. Same persisted setting reachable from
  // Default Settings (modals/defaultSettingsModal.js) for discoverability;
  // this button is just the fast, in-context way to flip it.
  const compactBtn = el('button', {
    type: 'button',
    class: 'sidebar-compact-toggle',
    'aria-pressed': 'false',
    onClick: () => saveLibrarySettings({ compactSidebar: !getLibrarySettings().compactSidebar }),
  });
  compactBtn.appendChild(el('span', { text: '🗂️', 'aria-hidden': 'true' }));
  const compactBtnLabel = el('span');
  compactBtn.appendChild(compactBtnLabel);
  togglesRow.appendChild(compactBtn);
  const syncCompactBtn = (settings) => {
    const compact = !!settings.compactSidebar;
    compactBtn.classList.toggle('active', compact);
    compactBtn.setAttribute('aria-pressed', String(compact));
    compactBtn.title = compact
      ? 'Compact library is on — showing only Favorites, Recently Used and My Components. Click to show every category, or just search (search always looks everywhere).'
      : 'Show only Favorites, Recently Used and My Components by default, hiding the full category list until you search or click this again.';
    compactBtnLabel.textContent = compact ? 'Browse all categories' : 'Compact library';
  };

  listEl = el('div', { class: 'sidebar-categories' });
  rootEl.appendChild(listEl);

  for (const cat of [FAVORITES_CATEGORY, RECENT_CATEGORY, CUSTOM_CATEGORY, ...CATEGORIES]) expanded.set(cat.id, false);

  onCustomComponentsChange(() => {
    // Auto-reveal "My Components" whenever it changes, so a just-saved
    // component is immediately visible instead of hidden in a collapsed category.
    expanded.set(CUSTOM_CATEGORY.id, true);
    renderList();
  });
  onFavoritesChange(() => {
    // Auto-reveal "Favorites" whenever it changes, same reasoning as above.
    expanded.set(FAVORITES_CATEGORY.id, true);
    renderList();
  });
  syncCompactBtn(getLibrarySettings());
  onLibrarySettingsChange((settings) => { syncCompactBtn(settings); renderList(); });
  // Unlike Favorites (a deliberate action), a component lands here on every
  // single placement — auto-expanding the section each time would yank
  // attention/scroll on normal canvas work, so just re-render in place.
  onRecentComponentsChange(renderList);
  renderList();
}

const HIDEABLE_CATEGORIES = { hideStateMachines: 'state-machines' };

function renderList() {
  // renderList() fully tears down and rebuilds .sidebar-categories on every
  // call (expanding/collapsing a category, toggling a folder, editing the
  // search, custom components changing, ...) — while the list is briefly
  // empty mid-rebuild its scrollHeight collapses, which clamps scrollTop
  // down, and nothing restored it afterwards. Save/restore around every
  // call rather than just the expand/collapse ones: restoring an
  // out-of-range scrollTop (e.g. after a search narrows the list) is a
  // harmless no-op clamp, so this is safe for every call site.
  const savedScrollTop = listEl.scrollTop;
  hidePatternPreview(); // an item a preview popup is anchored to is about to be torn down below
  clear(listEl);
  const q = normalize(query);
  const custom = getCustomComponents();
  const librarySettings = getLibrarySettings();
  const hiddenCategoryIds = new Set(
    Object.entries(HIDEABLE_CATEGORIES).filter(([settingKey]) => librarySettings[settingKey]).map(([, categoryId]) => categoryId),
  );
  const categories = [
    { ...CUSTOM_CATEGORY, components: custom },
    ...CATEGORIES.filter((cat) => !hiddenCategoryIds.has(cat.id)).map((cat) => ({ ...cat, components: COMPONENTS_BY_CATEGORY.get(cat.id) || [] })),
  ];

  let anyMatch = false;

  if (!q || favoritesMatchQuery(q)) {
    anyMatch = true;
    listEl.appendChild(renderFavoritesCategory(q));
  }

  const recentDefs = getRecentComponentIds().map(resolveRecentDef).filter(Boolean);
  if (recentDefs.length && (!q || recentDefs.some((def) => componentMatches(def, q)))) {
    anyMatch = true;
    listEl.appendChild(renderRecentCategory(q, recentDefs));
  }

  // Compact mode hides the full built-in category browser (everything but
  // "My Components", which stays — it's the user's own content, not
  // library noise) until there's an active search query: search must
  // always look everywhere regardless of this setting, or a compact-mode
  // user could search for something and be told it doesn't exist.
  const showBuiltinCategories = q || !librarySettings.compactSidebar;

  for (const cat of categories) {
    if (!showBuiltinCategories && cat.id !== CUSTOM_CATEGORY.id) continue;
    let matches = filterComponents(cat.components, query);
    // "Popular only" is scoped to the built-in library — `popular` is a
    // curated per-component data flag (see data/schema.js), not something
    // "My Components" (the user's own, unrated) or Favorites (already a
    // deliberate personal shortlist) ever carry, so filtering those the
    // same way would just make already-curated sections vanish instead of
    // narrowing them.
    if (popularOnly && cat.id !== CUSTOM_CATEGORY.id) matches = matches.filter((c) => c.popular);
    if (cat.id === CUSTOM_CATEGORY.id && !matches.length && !q) {
      // Still show an empty "My Components" hint when not searching.
    } else if (!matches.length) {
      continue;
    }
    anyMatch = true;
    listEl.appendChild(renderCategory(cat, matches, q));
  }
  if (!anyMatch) {
    const reason = popularOnly && !query ? 'No ★ popular components match the current filters.' : `No components match "${query}".`;
    listEl.appendChild(el('p', { class: 'sidebar-empty', text: reason }));
  }
  listEl.scrollTop = savedScrollTop;
}

function renderCategory(cat, matches, q) {
  const isCustom = cat.id === CUSTOM_CATEGORY.id;
  const isOpen = q ? true : expanded.get(cat.id);
  const wrap = el('div', { class: 'sidebar-category', 'data-open': isOpen ? 'true' : 'false' });

  const header = el('div', { class: 'category-header' });
  const toggle = el('button', {
    class: 'category-toggle',
    type: 'button',
    'aria-expanded': String(isOpen),
    onClick: () => {
      expanded.set(cat.id, !expanded.get(cat.id));
      renderList();
    },
  });
  toggle.appendChild(el('span', { class: 'category-dot', style: `background:${cat.color}` }));
  toggle.appendChild(el('span', { class: 'category-label', text: cat.label }));
  toggle.appendChild(el('span', { class: 'category-count', text: String(matches.length) }));
  toggle.appendChild(el('span', { class: 'category-chevron', text: '▸' }));
  header.appendChild(toggle);

  if (isCustom) {
    header.appendChild(el('button', {
      type: 'button', class: 'category-icon-btn', title: 'Export My Components…', 'aria-label': 'Export My Components', text: '📤',
      onClick: (e) => { e.stopPropagation(); exportCustomComponents(); },
    }));
    header.appendChild(el('button', {
      type: 'button', class: 'category-icon-btn', title: 'Import My Components…', 'aria-label': 'Import My Components', text: '📥',
      onClick: async (e) => {
        e.stopPropagation();
        const text = await pickJSONFile();
        if (!text) return;
        try {
          const result = importCustomComponents(JSON.parse(text));
          if (result.ok) showToast(`Imported ${result.imported} component(s).`, 'success');
          else showToast(result.error, 'error');
        } catch {
          showToast('Invalid JSON file.', 'error');
        }
      },
    }));
  }
  wrap.appendChild(header);

  const list = el('div', { class: 'category-list' });
  if (isCustom && !matches.length) {
    list.appendChild(el('p', { class: 'sidebar-empty small', text: 'Build your own from the toolbar "New Component" button.' }));
  }
  if (isCustom) {
    renderCustomComponentsGrouped(list, matches, q);
  } else {
    for (const comp of matches) list.appendChild(renderItem(comp, q));
  }
  wrap.appendChild(list);
  return wrap;
}

function renderCustomComponentsGrouped(list, matches, q) {
  const byFolder = new Map();
  for (const comp of matches) {
    const folder = comp.folder || NO_FOLDER;
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(comp);
  }
  const folderNames = [...byFolder.keys()].filter((f) => f !== NO_FOLDER).sort((a, b) => a.localeCompare(b));

  for (const folder of folderNames) {
    const key = `custom:${folder}`;
    const isOpen = q ? true : (folderExpanded.get(key) ?? true);
    const folderWrap = el('div', { class: 'sidebar-folder', 'data-open': isOpen ? 'true' : 'false' });
    const folderHeader = el('button', {
      class: 'folder-header',
      type: 'button',
      'aria-expanded': String(isOpen),
      onClick: () => { folderExpanded.set(key, !isOpen); renderList(); },
    });
    folderHeader.appendChild(el('span', { class: 'folder-chevron', text: '▸' }));
    folderHeader.appendChild(el('span', { class: 'folder-icon', text: '📁', 'aria-hidden': 'true' }));
    folderHeader.appendChild(el('span', { class: 'folder-label', text: folder }));
    folderHeader.appendChild(el('span', { class: 'category-count', text: String(byFolder.get(folder).length) }));
    folderWrap.appendChild(folderHeader);

    const folderList = el('div', { class: 'folder-list' });
    for (const comp of byFolder.get(folder)) folderList.appendChild(renderItem(comp, q, { isCustom: true }));
    folderWrap.appendChild(folderList);
    list.appendChild(folderWrap);
  }

  for (const comp of byFolder.get(NO_FOLDER) || []) {
    list.appendChild(renderItem(comp, q, { isCustom: true }));
  }
}

// --- Favorites: folder tree + CRUD ------------------------------------
// A favorite is a {id, defId, folderId, order} entry (see io/favorites.js)
// pointing at any built-in or "My Components" definition; folderId===null
// means it sits unfiled at the Favorites root. Folders nest arbitrarily
// (subfolders) via their own parentId, each carrying an independent
// `order` among same-parent siblings — this tree renderer walks that
// structure recursively, one level of <div class="sidebar-folder"> per
// folder, mirroring (but generalizing to N levels) the single-level
// "My Components" folder grouping above.

function renderFavoritesCategory(q) {
  const isOpen = q ? true : expanded.get(FAVORITES_CATEGORY.id);
  const wrap = el('div', { class: 'sidebar-category', 'data-open': isOpen ? 'true' : 'false' });

  const header = el('div', { class: 'category-header' });
  const toggle = el('button', {
    class: 'category-toggle',
    type: 'button',
    'aria-expanded': String(isOpen),
    onClick: () => {
      expanded.set(FAVORITES_CATEGORY.id, !expanded.get(FAVORITES_CATEGORY.id));
      renderList();
    },
  });
  toggle.appendChild(el('span', { class: 'category-dot', style: `background:${FAVORITES_CATEGORY.color}` }));
  toggle.appendChild(el('span', { class: 'category-label', text: FAVORITES_CATEGORY.label }));
  toggle.appendChild(el('span', { class: 'category-count', text: String(countFavoritesRecursive(null)) }));
  toggle.appendChild(el('span', { class: 'category-chevron', text: '▸' }));
  header.appendChild(toggle);

  header.appendChild(el('button', {
    type: 'button', class: 'category-icon-btn', title: 'New folder…', 'aria-label': 'New favorites folder', text: '📁',
    onClick: async (e) => {
      e.stopPropagation();
      const name = await promptText({ title: 'New favorites folder', label: 'Folder name', confirmLabel: 'Create' });
      if (name) createFolder(name, null);
    },
  }));
  wrap.appendChild(header);

  const list = el('div', { class: 'category-list' });
  if (!getFavorites().length && !getFavoriteFolders().length) {
    list.appendChild(el('p', { class: 'sidebar-empty small', text: 'Right-click any component below and choose "Add to Favorites".' }));
  }
  renderFavoritesTree(list, null, q);
  wrap.appendChild(list);
  return wrap;
}

/** Flat (no folders) pinned section for the last few components actually
 * placed on the canvas — see io/recentComponents.js. Mirrors
 * renderFavoritesCategory's header/toggle shell but with a plain item list,
 * since recency has no concept of user-organized folders. */
function renderRecentCategory(q, recentDefs) {
  const isOpen = q ? true : expanded.get(RECENT_CATEGORY.id);
  const wrap = el('div', { class: 'sidebar-category', 'data-open': isOpen ? 'true' : 'false' });

  const header = el('div', { class: 'category-header' });
  const toggle = el('button', {
    class: 'category-toggle',
    type: 'button',
    'aria-expanded': String(isOpen),
    onClick: () => {
      expanded.set(RECENT_CATEGORY.id, !expanded.get(RECENT_CATEGORY.id));
      renderList();
    },
  });
  toggle.appendChild(el('span', { class: 'category-dot', style: `background:${RECENT_CATEGORY.color}` }));
  toggle.appendChild(el('span', { class: 'category-label', text: RECENT_CATEGORY.label }));
  toggle.appendChild(el('span', { class: 'category-count', text: String(recentDefs.length) }));
  toggle.appendChild(el('span', { class: 'category-chevron', text: '▸' }));
  header.appendChild(toggle);
  wrap.appendChild(header);

  const list = el('div', { class: 'category-list' });
  const customIds = new Set(getCustomComponents().map((c) => c.id));
  for (const def of recentDefs) {
    if (q && !componentMatches(def, q)) continue;
    list.appendChild(renderItem(def, q, { isCustom: customIds.has(def.id) }));
  }
  wrap.appendChild(list);
  return wrap;
}

function renderFavoritesTree(container, parentId, q) {
  for (const folder of getChildFolders(parentId)) {
    if (q && !folderContainsMatch(folder.id, q)) continue;
    container.appendChild(renderFavoriteFolder(folder, q));
  }

  const items = getFavoritesInFolder(parentId);
  const customIds = new Set(getCustomComponents().map((c) => c.id));
  items.forEach((fav, idx) => {
    const def = resolveFavoriteDef(fav.defId);
    if (!def) return; // stale reference (its component was deleted elsewhere) — silently skip
    if (q && !componentMatches(def, q)) return;
    const menuItems = buildFavoriteMenuItems(fav, idx, items.length);
    container.appendChild(renderItem(def, q, { isCustom: customIds.has(def.id), favoriteMenuItems: menuItems }));
  });
}

function renderFavoriteFolder(folder, q) {
  const key = `fav:${folder.id}`;
  const isOpen = q ? true : (favFolderExpanded.get(key) ?? true);
  const wrap = el('div', { class: 'sidebar-folder', 'data-open': isOpen ? 'true' : 'false' });

  const headerRow = el('div', { class: 'folder-header-row' });
  const toggle = el('button', {
    class: 'folder-header',
    type: 'button',
    'aria-expanded': String(isOpen),
    onClick: () => { favFolderExpanded.set(key, !isOpen); renderList(); },
  });
  toggle.appendChild(el('span', { class: 'folder-chevron', text: '▸' }));
  toggle.appendChild(el('span', { class: 'folder-icon', text: '📁', 'aria-hidden': 'true' }));
  toggle.appendChild(el('span', { class: 'folder-label', text: folder.name }));
  toggle.appendChild(el('span', { class: 'category-count', text: String(countFavoritesRecursive(folder.id)) }));
  headerRow.appendChild(toggle);

  headerRow.appendChild(el('button', {
    type: 'button',
    class: 'category-icon-btn',
    title: `Options for "${folder.name}"`,
    'aria-label': `Options for folder ${folder.name}`,
    text: '⋮',
    onClick: (e) => { e.stopPropagation(); showContextMenu(e.clientX, e.clientY, folderContextMenuItems(folder)); },
  }));
  headerRow.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, folderContextMenuItems(folder));
  });
  wrap.appendChild(headerRow);

  const body = el('div', { class: 'folder-list' });
  renderFavoritesTree(body, folder.id, q);
  wrap.appendChild(body);
  return wrap;
}

function folderContextMenuItems(folder) {
  const siblings = getChildFolders(folder.parentId);
  const idx = siblings.findIndex((f) => f.id === folder.id);
  return [
    { label: 'Add subfolder', icon: '📁', onClick: async () => {
      const name = await promptText({ title: `New subfolder in "${folder.name}"`, label: 'Folder name', confirmLabel: 'Create' });
      if (name) createFolder(name, folder.id);
    } },
    { label: 'Rename', icon: '✏️', onClick: async () => {
      const name = await promptText({ title: 'Rename folder', label: 'Folder name', defaultValue: folder.name, confirmLabel: 'Rename' });
      if (name) renameFolder(folder.id, name);
    } },
    'separator',
    { label: 'Move up', icon: '⬆️', disabled: idx <= 0, onClick: () => reorderFolder(folder.id, 'up') },
    { label: 'Move down', icon: '⬇️', disabled: idx === -1 || idx >= siblings.length - 1, onClick: () => reorderFolder(folder.id, 'down') },
    'separator',
    { label: 'Delete folder', icon: '🗑️', danger: true, onClick: async () => {
      const counts = countFolderContents(folder.id);
      const parts = [];
      if (counts.subfolders) parts.push(`${counts.subfolders} subfolder${counts.subfolders === 1 ? '' : 's'}`);
      if (counts.favorites) parts.push(`${counts.favorites} favorite${counts.favorites === 1 ? '' : 's'}`);
      const message = parts.length
        ? `Delete "${folder.name}" and its ${parts.join(' + ')}? The favorited components themselves won't be deleted, only removed from Favorites. This cannot be undone.`
        : `Delete "${folder.name}"? This cannot be undone.`;
      const ok = await confirmAction({ title: 'Delete folder', message });
      if (ok) deleteFolder(folder.id);
    } },
  ];
}

function buildFavoriteMenuItems(fav, idx, siblingCount) {
  const items = [{ label: 'Remove from Favorites', icon: '🔖', danger: true, onClick: () => removeFavorite(fav.defId) }];
  if (getFavoriteFolders().length) {
    items.push('separator', ...moveToFolderMenuItems(fav));
  }
  items.push(
    'separator',
    { label: 'Move up', icon: '⬆️', disabled: idx <= 0, onClick: () => reorderFavorite(fav.defId, 'up') },
    { label: 'Move down', icon: '⬇️', disabled: idx === -1 || idx >= siblingCount - 1, onClick: () => reorderFavorite(fav.defId, 'down') },
  );
  return items;
}

function moveToFolderMenuItems(fav) {
  const items = [{
    label: 'Unfiled (root)',
    icon: fav.folderId === null ? '✓' : '　',
    disabled: fav.folderId === null,
    onClick: () => moveFavoriteToFolder(fav.defId, null),
  }];
  for (const { folder, depth } of flattenFoldersWithDepth()) {
    items.push({
      label: `${'　'.repeat(depth)}${folder.name}`,
      icon: fav.folderId === folder.id ? '✓' : '　',
      disabled: fav.folderId === folder.id,
      onClick: () => moveFavoriteToFolder(fav.defId, folder.id),
    });
  }
  return items;
}

function flattenFoldersWithDepth(parentId = null, depth = 0, out = []) {
  for (const folder of getChildFolders(parentId)) {
    out.push({ folder, depth });
    flattenFoldersWithDepth(folder.id, depth + 1, out);
  }
  return out;
}

function folderContainsMatch(folderId, q) {
  if (getFavoritesInFolder(folderId).some((f) => { const def = resolveFavoriteDef(f.defId); return def && componentMatches(def, q); })) return true;
  return getChildFolders(folderId).some((sub) => folderContainsMatch(sub.id, q));
}

function countFavoritesRecursive(folderId) {
  let count = getFavoritesInFolder(folderId).length;
  for (const sub of getChildFolders(folderId)) count += countFavoritesRecursive(sub.id);
  return count;
}

function favoritesMatchQuery(q) {
  return getFavorites().some((f) => {
    const def = resolveFavoriteDef(f.defId);
    return def && componentMatches(def, q);
  });
}

function renderItem(def, q, opts = {}) {
  const { isCustom = false, favoriteMenuItems = null } = opts;
  const kindLabel = def.kind === 'layer' ? 'Drag onto a component to attach, or click to add standalone: ' : def.kind === 'pattern' ? 'Drag or click to add this whole pattern: ' : '';
  const item = el('div', {
    class: def.popular ? 'sidebar-item item-popular' : 'sidebar-item',
    'data-name': def.name,
    'data-kind': def.kind,
    title: `${kindLabel}${def.description || def.name}`,
    tabIndex: 0,
    role: 'button',
    'aria-label': def.kind === 'layer' ? `Add or attach layer ${def.name}` : def.kind === 'pattern' ? `Add pattern ${def.name}` : `Add ${def.name}`,
  });
  item.appendChild(el('span', { class: 'item-icon', text: def.icon, 'aria-hidden': 'true' }));
  const nameEl = el('span', { class: 'item-name' });
  renderHighlighted(nameEl, def.name, q);
  item.appendChild(nameEl);
  if (def.popular) item.appendChild(el('span', { class: 'item-popular-badge', text: '★', title: 'Commonly used in real designs', 'aria-hidden': 'true' }));
  if (isFavorite(def.id)) item.appendChild(el('span', { class: 'item-favorite-badge', text: '🔖', title: 'In your Favorites', 'aria-hidden': 'true' }));
  if (def.kind === 'layer') item.appendChild(el('span', { class: 'item-kind-badge kind-layer', text: '+', title: 'Can attach to a component', 'aria-hidden': 'true' }));
  if (def.kind === 'pattern') item.appendChild(el('span', { class: 'item-kind-badge kind-pattern', text: '⎈', title: 'Adds a group of components', 'aria-hidden': 'true' }));
  if (isSequenceDiagramPattern(def)) attachPatternPreview(item, def);

  makeDraggable(item, def.id);
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    }
  });

  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const menuItems = [];
    if (isCustom) {
      menuItems.push(
        { label: 'Edit component', icon: '✏️', onClick: () => editCustomComponentHandler?.(def) },
        { label: 'Delete', icon: '🗑️', danger: true, onClick: async () => {
          const ok = await confirmAction({ title: 'Delete component', message: `Remove "${def.name}" from My Components? This cannot be undone.` });
          if (ok) deleteCustomComponent(def.id);
        } },
        'separator',
      );
    }
    if (favoriteMenuItems) {
      menuItems.push(...favoriteMenuItems);
    } else {
      const fav = isFavorite(def.id);
      menuItems.push({
        label: fav ? 'Remove from Favorites' : 'Add to Favorites',
        icon: fav ? '🔖' : '☆',
        onClick: () => toggleFavorite(def.id),
      });
    }
    showContextMenu(e.clientX, e.clientY, menuItems);
  });
  return item;
}

function renderHighlighted(container, text, q) {
  clear(container);
  if (!q) {
    container.textContent = text;
    return;
  }
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) {
    container.textContent = text;
    return;
  }
  if (idx > 0) container.appendChild(document.createTextNode(text.slice(0, idx)));
  const mark = document.createElement('mark');
  mark.textContent = text.slice(idx, idx + q.length);
  container.appendChild(mark);
  if (idx + q.length < text.length) container.appendChild(document.createTextNode(text.slice(idx + q.length)));
}
