// Tab strip for switching between multiple open diagrams — a thin UI layer
// over io/projectTabs.js (persistence + save-then-load orchestration) and
// modals/addTabModal.js (the "+" picker). Hidden entirely (not just empty)
// until a second tab actually exists, so a user who never opens more than
// one diagram sees no extra chrome at all.
import * as store from '../core/store.js';
import { el, clear } from '../utils/dom.js';
import { getTabDisplayInfo, switchToProjectTab, closeProjectTab, subscribeTabsChanged } from '../io/projectTabs.js';
import { openAddTabModal } from '../modals/addTabModal.js';

let rowEl = null;

export function initProjectTabsBar(root) {
  rowEl = root;
  store.subscribe('change', render);
  // Covers tab-list-only mutations (e.g. closing a tab that isn't the
  // active one) that never touch store.loadProject and so never fire
  // 'change' — see io/projectTabs.js's subscribeTabsChanged comment.
  subscribeTabsChanged(render);
  render();
}

function render() {
  if (!rowEl) return;
  clear(rowEl);
  const state = store.getState();
  const tabs = getTabDisplayInfo(state);
  rowEl.hidden = tabs.length < 2;
  if (rowEl.hidden) return;

  for (const tab of tabs) {
    const isActive = tab.id === state.id;
    // A <div> wrapper, not a <button> — it holds the close button, and a
    // <button> can't legally contain another <button> (invalid HTML that
    // browsers silently un-nest when parsed from markup; building it via
    // DOM APIs like this avoids that, but the nested click/keyboard
    // semantics would still be wrong, so plain buttons side-by-side instead).
    const tabEl = el('div', { class: `project-tab${isActive ? ' active' : ''}` });
    tabEl.appendChild(el('button', {
      type: 'button',
      class: 'project-tab-name',
      title: tab.name,
      text: tab.name,
      onClick: () => { if (!isActive) switchToProjectTab(tab.id); },
    }));
    tabEl.appendChild(el('button', {
      type: 'button',
      class: 'project-tab-close',
      'aria-label': `Close ${tab.name} tab`,
      text: '✕',
      onClick: () => closeProjectTab(tab.id),
    }));
    rowEl.appendChild(tabEl);
  }

  rowEl.appendChild(el('button', {
    type: 'button',
    class: 'project-tab-add',
    title: 'Open another diagram in a new tab',
    'aria-label': 'Open another diagram in a new tab',
    text: '+',
    onClick: openAddTabModal,
  }));
}
