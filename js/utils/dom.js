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
