// Keyboard-only "connect two components" gesture — the mouse-free
// counterpart of dragging from one node's connection dot to another.
// Triggered by main.js's 'C' shortcut while exactly one node is selected
// (see canvas/node.js's `focus` listener, which keeps store selection in
// sync with Tab-driven keyboard focus so a keyboard-only user has a way to
// select a node at all). Drops a small numbered badge directly onto every
// *other* node (as a real DOM child of that node — so it moves/scales with
// pan and zoom for free, no separate screen-space overlay math needed);
// pressing that number completes the connection via
// canvas.js#connectNodesByKeyboard. Escape cancels.
import { connectNodesByKeyboard } from './canvas.js';
import { showToast } from '../utils/toast.js';

const MAX_TARGETS = 9;

let active = false;
let badgeEls = [];
let targetIds = [];
let keyHandler = null;

export function isKeyboardConnectActive() {
  return active;
}

export function startKeyboardConnect(fromNodeId) {
  cancelKeyboardConnect();

  const candidates = Array.from(document.querySelectorAll('.node[data-node-id]'))
    .filter((elRef) => elRef.dataset.nodeId !== fromNodeId)
    .slice(0, MAX_TARGETS);
  if (!candidates.length) {
    showToast('No other component to connect to.', 'error');
    return;
  }

  active = true;
  targetIds = [];
  badgeEls = candidates.map((elRef, i) => {
    const badge = document.createElement('div');
    badge.className = 'keyboard-connect-badge';
    badge.textContent = String(i + 1);
    elRef.appendChild(badge);
    targetIds.push(elRef.dataset.nodeId);
    return badge;
  });
  showToast(`Press 1-${badgeEls.length} to connect, or Esc to cancel.`, 'info', 4000);

  keyHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelKeyboardConnect();
      return;
    }
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= targetIds.length) {
      e.preventDefault();
      const toNodeId = targetIds[digit - 1];
      cancelKeyboardConnect();
      connectNodesByKeyboard(fromNodeId, toNodeId);
    }
  };
  window.addEventListener('keydown', keyHandler);
}

export function cancelKeyboardConnect() {
  if (!active) return;
  active = false;
  for (const badge of badgeEls) badge.remove();
  badgeEls = [];
  targetIds = [];
  if (keyHandler) window.removeEventListener('keydown', keyHandler);
  keyHandler = null;
}
