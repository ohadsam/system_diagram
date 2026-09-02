// "📱 Remote Control" wizard — shown from Presenter Mode (toolbar/
// kioskModeUi.js). Hosts a collab/presenterRemote.js session and renders a
// QR code (vendor/qrcode.js, loaded lazily — same pattern as
// peerjsCollab.js's own PeerJS loading) linking straight to remote.html
// with the room code pre-filled, so scanning it with a phone's camera is
// the entire setup on that side. The underlying host session deliberately
// outlives this modal (same convention as modals/collaborationModal.js) —
// closing the dialog doesn't disconnect the phone, only exiting Presenter
// Mode does (see kioskModeUi.js).
import { openModal } from './modal.js';
import { el } from '../utils/dom.js';
import { loadScriptOnce } from '../utils/loadScript.js';
import {
  startPresenterRemoteHost, onPresenterRemoteStatusChange, isPresenterRemoteConnected,
} from '../collab/presenterRemote.js';

function remoteUrl(roomCode) {
  const basePath = location.pathname.replace(/[^/]*$/, '');
  return `${location.origin}${basePath}remote.html?code=${roomCode}`;
}

export function openPresenterRemoteModal() {
  let unsubscribe = null;

  openModal({
    title: '📱 Remote Control',
    className: 'generate-design-modal presenter-remote-modal',
    render: async (body, api) => {
      body.appendChild(el('p', { class: 'modal-hint', text: 'Scan this with your phone to get Next/Previous buttons for Diagram Animation playback — no app or account needed. Start playback on this screen first (▶ Animation), then scan.' }));
      const statusEl = el('p', { class: 'collab-status-text', text: 'Setting up…' });
      body.appendChild(statusEl);

      const result = await startPresenterRemoteHost();
      if (!result.ok) {
        statusEl.textContent = result.error;
        return;
      }

      const url = remoteUrl(result.roomCode);
      try {
        await loadScriptOnce('vendor/qrcode.js');
        const qr = window.qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        const qrWrap = el('div', { class: 'presenter-remote-qr' });
        qrWrap.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2 });
        body.appendChild(qrWrap);
      } catch {
        body.appendChild(el('p', { class: 'generate-design-error', text: "Couldn't generate the QR code — use the room code below instead." }));
      }

      body.appendChild(el('p', { class: 'collab-room-code', text: result.roomCode }));
      body.appendChild(el('p', { class: 'modal-hint', text: `Or open ${location.origin}${location.pathname.replace(/[^/]*$/, '')}remote.html manually and enter this code.` }));

      const updateStatus = () => {
        statusEl.textContent = isPresenterRemoteConnected()
          ? '🟢 Phone connected — its Next/Prev buttons now control playback here'
          : 'Waiting for your phone to connect…';
      };
      updateStatus();
      unsubscribe = onPresenterRemoteStatusChange(updateStatus);

      const actions = el('div', { class: 'modal-actions' });
      actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Close', onClick: () => api.close() }));
      body.appendChild(actions);
    },
    onClose: () => { unsubscribe?.(); },
  });
}
