// Small DOM helpers. No innerHTML with dynamic content anywhere in this app —
// see docs/ARCHITECTURE.md "Security notes".

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node && key !== 'list') {
      try {
        node[key] = value;
      } catch {
        node.setAttribute(key, value);
      }
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    node.setAttribute(key, value);
  }
  return node;
}

/**
 * Rebuilds `root`'s contents via `buildFn()`, preserving whatever a user was
 * mid-interaction with across a full destructive rebuild. Several panels in
 * this app (details panel, toolbar contextual row) fully `clear()` +
 * rebuild their DOM on every store `'change'` event rather than diffing —
 * simple, but it means a live text field dispatches on every keystroke
 * (see formControls.js `textInput`/`numberInput`/`colorInput`), which would
 * otherwise steal focus away from the very field the user is typing into,
 * and reset the scroll position of any scrollable region back to the top.
 *
 * - Focus: if the currently focused element is inside `root` and carries a
 *   `data-focus-key`, look up the element with the same key after the
 *   rebuild and restore focus (and text selection range, for text inputs).
 * - Scroll: if `scrollSelector` is given, the matching descendant's
 *   `scrollTop` is captured before the rebuild and restored after.
 *
 * @param {HTMLElement} root
 * @param {() => void} buildFn rebuilds root's contents (typically clear(root) + append)
 * @param {string} [scrollSelector] selector (relative to root) for a scrollable descendant to preserve scrollTop for
 */
export function rerenderPreservingUiState(root, buildFn, scrollSelector) {
  const active = document.activeElement;
  let focusRestore = null;
  if (active && root.contains(active) && active.dataset?.focusKey) {
    focusRestore = {
      key: active.dataset.focusKey,
      start: 'selectionStart' in active ? active.selectionStart : null,
      end: 'selectionEnd' in active ? active.selectionEnd : null,
    };
  }
  const scrollTop = scrollSelector ? root.querySelector(scrollSelector)?.scrollTop : null;

  buildFn();

  if (focusRestore) {
    const next = root.querySelector(`[data-focus-key="${CSS.escape(focusRestore.key)}"]`);
    if (next) {
      next.focus({ preventScroll: true });
      if (focusRestore.start != null && typeof next.setSelectionRange === 'function') {
        try { next.setSelectionRange(focusRestore.start, focusRestore.end); } catch { /* not a range-selectable input type */ }
      }
    }
  }
  if (scrollSelector && scrollTop != null) {
    const nextScrollEl = root.querySelector(scrollSelector);
    if (nextScrollEl) nextScrollEl.scrollTop = scrollTop;
  }
}

export function on(target, type, selectorOrHandler, maybeHandler) {
  if (typeof selectorOrHandler === 'function') {
    target.addEventListener(type, selectorOrHandler);
    return () => target.removeEventListener(type, selectorOrHandler);
  }
  const selector = selectorOrHandler;
  const handler = (event) => {
    const match = event.target.closest(selector);
    if (match && target.contains(match)) maybeHandler(event, match);
  };
  target.addEventListener(type, handler);
  return () => target.removeEventListener(type, handler);
}
