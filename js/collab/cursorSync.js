// Live collaboration cursors — a small colored dot showing where the other
// person in a collab/collabSession.js session is currently pointing.
// Deliberately its own module, wired alongside (not inside) collabSession.js:
// this is transient, purely-visual presence data, not project state, so it
// has no business going through store.dispatch/undo history the way the
// project-state sync does. It shares the same transport (transport.onMessage
// supports multiple independent listeners — see webrtcCollab.js/
// peerjsCollab.js's `messageHandlers` Set) and is filtered by its own
// `type: 'cursor'`, so it never collides with collabSession.js's `type:
// 'state'` messages on the same channel.
import { screenToCanvas } from '../canvas/viewport.js';

const THROTTLE_MS = 80;

/**
 * @param {{send:(data:object)=>void, onMessage:(fn:(data:object)=>void)=>()=>void}} transport
 * @returns {{stop: () => void}}
 */
export function startCursorSync(transport) {
  const viewportEl = document.querySelector('.canvas-viewport') || document.getElementById('canvas-viewport');
  const contentEl = document.querySelector('.canvas-content');
  if (!viewportEl || !contentEl) return { stop() {} };

  let cursorEl = null;
  let lastSent = 0;
  let hideTimer = null;

  function handlePointerMove(e) {
    const now = performance.now();
    if (now - lastSent < THROTTLE_MS) return;
    lastSent = now;
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    transport.send({ type: 'cursor', x, y });
  }

  function ensureCursorEl() {
    if (cursorEl) return cursorEl;
    cursorEl = document.createElement('div');
    cursorEl.className = 'collab-remote-cursor';
    cursorEl.innerHTML = '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M2 2 L18 9 L10 11 L8 18 Z" /></svg><span class="collab-remote-cursor-label">Collaborator</span>';
    contentEl.appendChild(cursorEl);
    return cursorEl;
  }

  const unsubscribeMessage = transport.onMessage((msg) => {
    if (!msg || msg.type !== 'cursor' || typeof msg.x !== 'number' || typeof msg.y !== 'number') return;
    const el = ensureCursorEl();
    el.style.left = `${msg.x}px`;
    el.style.top = `${msg.y}px`;
    el.classList.add('visible');
    // A cursor left idle (the other person stopped moving, switched tabs, or
    // disconnected mid-session) fades back out rather than staying frozen on
    // screen forever looking like a stuck/ghost pointer.
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => el.classList.remove('visible'), 4000);
  });

  viewportEl.addEventListener('pointermove', handlePointerMove);

  return {
    stop() {
      viewportEl.removeEventListener('pointermove', handlePointerMove);
      unsubscribeMessage();
      clearTimeout(hideTimer);
      cursorEl?.remove();
    },
  };
}
