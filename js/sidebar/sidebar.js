// Left sidebar: search box + categorized, alphabetically sorted, draggable
// component library (built-in + the user's "My Components").
import { CATEGORIES, COMPONENTS_BY_CATEGORY } from '../data/index.js';
import {
  getCustomComponents, onCustomComponentsChange, deleteCustomComponent,
  exportCustomComponents, importCustomComponents,
} from '../io/customComponents.js';
import { el, clear } from '../utils/dom.js';
import { filterComponents, normalize } from './search.js';
import { makeDraggable } from './dragSource.js';
import { showContextMenu } from '../canvas/contextMenu.js';
import { confirmAction } from '../modals/confirmModal.js';
import { pickJSONFile } from '../io/fileIO.js';
import { showToast } from '../utils/toast.js';
import { getLibrarySettings, onLibrarySettingsChange } from '../io/librarySettings.js';

const CUSTOM_CATEGORY = { id: '__custom__', label: 'My Components', color: '#0F172A' };
const NO_FOLDER = '';

let rootEl = null;
let searchInput = null;
let listEl = null;
const expanded = new Map();
const folderExpanded = new Map();
let query = '';
let editCustomComponentHandler = null;

export function configureSidebar({ onEditCustomComponent } = {}) {
  editCustomComponentHandler = onEditCustomComponent || null;
}

export function initSidebar(root) {
  rootEl = root;
  rootEl.classList.add('sidebar');

  const searchWrap = el('div', { class: 'sidebar-search' });
  searchInput = el('input', {
    type: 'search',
    placeholder: 'Search components…',
    'aria-label': 'Search components',
    onInput: (e) => {
      query = e.target.value;
      renderList();
    },
  });
  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(el('span', { class: 'sidebar-search-icon', text: '🔎', 'aria-hidden': 'true' }));
  rootEl.appendChild(searchWrap);

  listEl = el('div', { class: 'sidebar-categories' });
  rootEl.appendChild(listEl);

  for (const cat of [CUSTOM_CATEGORY, ...CATEGORIES]) expanded.set(cat.id, false);

  onCustomComponentsChange(() => {
    // Auto-reveal "My Components" whenever it changes, so a just-saved
    // component is immediately visible instead of hidden in a collapsed category.
    expanded.set(CUSTOM_CATEGORY.id, true);
    renderList();
  });
  onLibrarySettingsChange(renderList);
  renderList();
}

const HIDEABLE_CATEGORIES = { hideStateMachines: 'state-machines' };

function renderList() {
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
  for (const cat of categories) {
    const matches = filterComponents(cat.components, query);
    if (cat.id === CUSTOM_CATEGORY.id && !matches.length && !q) {
      // Still show an empty "My Components" hint when not searching.
    } else if (!matches.length) {
      continue;
    }
    anyMatch = true;
    listEl.appendChild(renderCategory(cat, matches, q));
  }
  if (!anyMatch) {
    listEl.appendChild(el('p', { class: 'sidebar-empty', text: `No components match "${query}".` }));
  }
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
    for (const comp of matches) list.appendChild(renderItem(comp, q, false));
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
    for (const comp of byFolder.get(folder)) folderList.appendChild(renderItem(comp, q, true));
    folderWrap.appendChild(folderList);
    list.appendChild(folderWrap);
  }

  for (const comp of byFolder.get(NO_FOLDER) || []) {
    list.appendChild(renderItem(comp, q, true));
  }
}

function renderItem(def, q, isCustom) {
  const kindLabel = def.kind === 'layer' ? 'Drag onto a component to attach, or click to add standalone: ' : def.kind === 'pattern' ? 'Drag or click to add this whole pattern: ' : '';
  const item = el('div', {
    class: 'sidebar-item',
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
  if (def.kind === 'layer') item.appendChild(el('span', { class: 'item-kind-badge kind-layer', text: '+', title: 'Can attach to a component', 'aria-hidden': 'true' }));
  if (def.kind === 'pattern') item.appendChild(el('span', { class: 'item-kind-badge kind-pattern', text: '⎈', title: 'Adds a group of components', 'aria-hidden': 'true' }));

  makeDraggable(item, def.id);
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    }
  });

  if (isCustom) {
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { label: 'Edit component', icon: '✏️', onClick: () => editCustomComponentHandler?.(def) },
        { label: 'Delete', icon: '🗑️', danger: true, onClick: async () => {
          const ok = await confirmAction({ title: 'Delete component', message: `Remove "${def.name}" from My Components? This cannot be undone.` });
          if (ok) deleteCustomComponent(def.id);
        } },
      ]);
    });
  }
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
