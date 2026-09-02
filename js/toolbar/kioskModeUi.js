// The floating "Exit Presenter Mode" affordance (plus Spotlight and Remote
// Control) shown only while kiosk mode is active — see core/kioskMode.js.
// The toolbar button that turns kiosk mode ON is itself part of the chrome
// that gets hidden once it's on, so this row (plus the Escape key, wired in
// main.js) is the only way back to the normal editing UI — without it a
// visitor could get stuck looking at a bare canvas.
//
// All three buttons share one `.kiosk-controls` flex row (css/toolbar.css)
// rather than each being independently `position: fixed` with hand-computed
// pixel offsets between them — a flex row lays itself out correctly no
// matter how button text/width changes later, which fixed offsets would
// silently break.
import { el } from '../utils/dom.js';
import { isKioskMode, setKioskMode, onKioskModeChange } from '../core/kioskMode.js';
import { isAnimationPlaying } from '../core/animationPlayback.js';
import { stopAnimationPlayback } from '../canvas/canvas.js';
import { openPresenterRemoteModal } from '../modals/presenterRemoteModal.js';
import { stopPresenterRemoteHost } from '../collab/presenterRemote.js';

// Spotlight — an in-memory-only (not persisted, same as kiosk mode itself)
// dark overlay with a bright circle that tracks the pointer, for drawing an
// audience's eye to one part of the diagram while presenting. Independent
// on/off state from kiosk mode itself: a presenter may want the clean chrome
// without the spotlight, or vice versa mid-talk.
let spotlightActive = false;
let spotlightEl = null;

function handleSpotlightPointerMove(e) {
  spotlightEl.style.setProperty('--spot-x', `${e.clientX}px`);
  spotlightEl.style.setProperty('--spot-y', `${e.clientY}px`);
}

function setSpotlightActive(next, spotlightBtn) {
  spotlightActive = next;
  document.body.classList.toggle('spotlight-mode', next);
  spotlightBtn.classList.toggle('active', next);
  if (next) {
    document.addEventListener('pointermove', handleSpotlightPointerMove);
  } else {
    document.removeEventListener('pointermove', handleSpotlightPointerMove);
  }
}

export function initKioskModeUi() {
  document.body.classList.toggle('kiosk-mode', isKioskMode());

  const controls = el('div', { class: 'kiosk-controls' });

  spotlightEl = el('div', { class: 'kiosk-spotlight', 'aria-hidden': 'true' });
  document.body.appendChild(spotlightEl);

  const spotlightBtn = el('button', {
    type: 'button',
    class: 'kiosk-floating-btn kiosk-spotlight-btn',
    title: 'Toggle Spotlight — dim everything except a circle around your cursor',
    text: '🔦 Spotlight',
    onClick: () => setSpotlightActive(!spotlightActive, spotlightBtn),
  });
  controls.appendChild(spotlightBtn);

  const remoteBtn = el('button', {
    type: 'button',
    class: 'kiosk-floating-btn kiosk-remote-btn',
    title: 'Remote Control — get a QR code to control Next/Prev from your phone',
    text: '📱 Remote',
    onClick: () => openPresenterRemoteModal(),
  });
  controls.appendChild(remoteBtn);

  const exitBtn = el('button', {
    type: 'button',
    class: 'kiosk-floating-btn kiosk-exit-btn',
    title: 'Exit Presenter Mode (Esc)',
    text: '✕ Exit Presenter Mode',
    // Diagram Animation playback (canvas.js#startAnimationPlayback) turns
    // kiosk mode on as its base — exiting must stop the animation's own
    // state machine too, not just hide the chrome back on, or its timers
    // and revealed-step position would keep running invisibly underneath.
    onClick: () => { if (isAnimationPlaying()) stopAnimationPlayback(); else setKioskMode(false); },
  });
  controls.appendChild(exitBtn);

  document.body.appendChild(controls);

  onKioskModeChange((active) => {
    document.body.classList.toggle('kiosk-mode', active);
    // Spotlight and the phone-remote host session only make sense while
    // presenting — force them off (rather than leaving them silently
    // active) the moment kiosk mode itself ends, so a presenter never
    // returns to normal editing with the dimming overlay still up or a
    // stale PeerJS connection still open in the background.
    if (!active && spotlightActive) setSpotlightActive(false, spotlightBtn);
    if (!active) stopPresenterRemoteHost();
  });
}
