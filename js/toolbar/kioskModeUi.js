// The floating "Exit Presenter Mode" affordance shown only while kiosk mode
// is active — see core/kioskMode.js. The toolbar button that turns kiosk
// mode ON is itself part of the chrome that gets hidden once it's on, so
// this (plus the Escape key, wired in main.js) is the only way back to the
// normal editing UI — without it a visitor could get stuck looking at a
// bare canvas.
import { el } from '../utils/dom.js';
import { isKioskMode, setKioskMode, onKioskModeChange } from '../core/kioskMode.js';

export function initKioskModeUi() {
  document.body.classList.toggle('kiosk-mode', isKioskMode());

  const btn = el('button', {
    type: 'button',
    class: 'kiosk-exit-btn',
    title: 'Exit Presenter Mode (Esc)',
    text: '✕ Exit Presenter Mode',
    onClick: () => setKioskMode(false),
  });
  document.body.appendChild(btn);

  onKioskModeChange((active) => {
    document.body.classList.toggle('kiosk-mode', active);
  });
}
