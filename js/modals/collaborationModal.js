// "🤝 Live Collaboration" — real-time two-person P2P co-editing over
// WebRTC, no server or account. Offers a choice of two connection
// methods (collab/webrtcCollab.js's manual offline code exchange, or
// collab/peerjsCollab.js's quick room code via a public broker), picked
// at connect time by whoever's setting up the session — see the header
// comments on those two modules and on collab/collabSession.js (which
// actually syncs the connected transport with the canvas) for why each
// exists and how the sync itself works.
//
// The connection and its live sync (collab/collabSession.js) intentionally
// outlive this modal — closing the dialog doesn't disconnect, so a host or
// guest can keep working on the canvas with the modal out of the way and
// reopen it later just to check status or disconnect. Every bit of this
// wizard's own state (which screen, the codes typed/generated so far)
// therefore lives at module scope too, not inside openCollaborationModal()'s
// closure — otherwise closing the modal mid-handshake (say, right after
// generating an offer code, before the other side has answered) would
// forget that code entirely the next time the modal opens, even though the
// underlying transport is still alive and waiting for it.
import { openModal } from './modal.js';
import { el, clear } from '../utils/dom.js';
import { showToast } from '../utils/toast.js';
import { confirmAction } from './confirmModal.js';
import * as store from '../core/store.js';
import { createManualTransport } from '../collab/webrtcCollab.js';
import { createPeerJsTransport } from '../collab/peerjsCollab.js';
import { startCollabSession } from '../collab/collabSession.js';

let transport = null;
let session = null;
let role = null; // 'host' | 'guest'
let method = null; // 'manual' | 'peerjs'
let screen = 'choose';
let pendingRole = null;
let offerCode = '';
let answerCode = '';
let hostOfferCodeInput = '';
let roomCodeInput = '';
let hostedRoomCode = '';
let pasteError = '';
let statusText = '';
const statusListeners = new Set();

function notifyStatus() {
  for (const fn of statusListeners) fn(isCollabConnected());
}

/** Registered on every transport the moment it's created (see the four
 * `transport = create*Transport()` call sites below) — not tied to the
 * modal being open, since a connection can finish (a guest connects, ICE
 * negotiation completes) after the person who set it up has already
 * closed this dialog to go back to editing. Starting collab/
 * collabSession.js's sync here, rather than from the modal's "connected"
 * screen render, is what makes that work: the sync starts the instant the
 * transport actually connects, whether or not anything is rendering it. */
function handleTransportStatusChange() {
  if (transport?.getStatus() === 'connected' && !session) {
    session = startCollabSession(transport);
    if (role === 'host') session.sendInitialState();
    screen = 'connected';
  }
  notifyStatus();
}

export function isCollabConnected() {
  return transport?.getStatus() === 'connected';
}

/** For toolbar.js's status indicator — called immediately with the current state, then again on every change. */
export function onCollabStatusChange(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

function resetFlowState() {
  role = null;
  method = null;
  pendingRole = null;
  offerCode = '';
  answerCode = '';
  hostOfferCodeInput = '';
  roomCodeInput = '';
  hostedRoomCode = '';
  pasteError = '';
  statusText = '';
}

function disconnect() {
  session?.stop();
  transport?.close();
  session = null;
  transport = null;
  screen = 'choose';
  resetFlowState();
  notifyStatus();
}

export function openCollaborationModal() {
  let unsubscribe = null;

  openModal({
    title: '🤝 Live Collaboration',
    className: 'generate-design-modal collaboration-modal',
    render: (body, api) => {
      unsubscribe = onCollabStatusChange(() => { if (screen === 'connected') renderScreen(); });

      const renderScreen = () => {
        clear(body);
        if (screen === 'choose') renderChoose();
        else if (screen === 'method') renderMethod();
        else if (screen === 'host-manual') renderHostManual();
        else if (screen === 'join-manual') renderJoinManual();
        else if (screen === 'host-peerjs') renderHostPeerJs();
        else if (screen === 'join-peerjs') renderJoinPeerJs();
        else renderConnected();

        function renderChoose() {
          body.appendChild(el('p', { class: 'modal-hint', text: 'Work on the same diagram with one other person in real time — no account, no server, changes sync directly between your two browsers as you both edit.' }));
          const actions = el('div', { class: 'modal-actions collab-choose-actions' });
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: '🖥️ Host a session',
            onClick: () => { pendingRole = 'host'; screen = 'method'; renderScreen(); },
          }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: '🔗 Join a session',
            onClick: async () => {
              if (store.getState().nodes.length > 0) {
                const proceed = await confirmAction({
                  title: 'Join a live session?',
                  message: "Once connected, your canvas syncs with the host's — expect what you see to be replaced by their diagram. Undo (Ctrl/Cmd+Z) can bring your own version back after disconnecting.",
                  confirmLabel: 'Join anyway',
                  danger: false,
                });
                if (!proceed) return;
              }
              pendingRole = 'guest';
              screen = 'method';
              renderScreen();
            },
          }));
          body.appendChild(actions);
        }

        function renderMethod() {
          body.appendChild(el('p', { class: 'modal-hint', text: 'How should the two browsers find each other?' }));
          const actions = el('div', { class: 'modal-actions collab-choose-actions' });
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-secondary', text: '📋 Manual code exchange',
            title: 'Works fully offline — copy a short code to the other person yourself (chat, email, read it aloud) and paste theirs back.',
            onClick: () => { screen = pendingRole === 'host' ? 'host-manual' : 'join-manual'; renderScreen(); },
          }));
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-secondary', text: '🌐 Quick room code',
            title: 'Uses a public relay service just to find each other by a short room code — the diagram itself still syncs directly between your two browsers.',
            onClick: () => { screen = pendingRole === 'host' ? 'host-peerjs' : 'join-peerjs'; renderScreen(); },
          }));
          body.appendChild(actions);
          body.appendChild(backButton(() => { screen = 'choose'; renderScreen(); }));
        }

        function renderHostManual() {
          role = 'host';
          method = 'manual';
          body.appendChild(el('p', { class: 'modal-hint', text: '1. Copy this code and send it to the other person. 2. Paste back the answer code they send you.' }));

          if (!offerCode) {
            body.appendChild(el('p', { class: 'collab-status-text', text: 'Generating connection code…' }));
            if (!transport) {
              transport = createManualTransport();
              transport.onStatusChange(handleTransportStatusChange);
              transport.createOffer().then((result) => {
                if (!result.ok) { showToast(result.error, 'error', 5000); disconnect(); screen = 'method'; renderScreen(); return; }
                offerCode = result.code;
                renderScreen();
              });
            }
            return;
          }

          const offerArea = el('textarea', { class: 'collab-code-area', rows: 4, readOnly: true });
          offerArea.value = offerCode;
          body.appendChild(offerArea);
          body.appendChild(el('button', {
            type: 'button', class: 'btn btn-secondary', text: '📋 Copy code',
            onClick: async () => { await navigator.clipboard.writeText(offerCode); showToast('Code copied — send it to the other person.', 'success', 2000); },
          }));

          body.appendChild(el('h3', { class: 'modal-subheading', text: "Paste their answer code" }));
          const answerArea = el('textarea', {
            class: 'collab-code-area', rows: 4, placeholder: "Paste the answer code here…",
            onInput: (e) => { answerCode = e.target.value; pasteError = ''; },
          });
          answerArea.value = answerCode;
          body.appendChild(answerArea);
          const errorEl = el('p', { class: 'generate-design-error' });
          if (pasteError) errorEl.textContent = pasteError;
          body.appendChild(errorEl);

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Connect',
            onClick: async () => {
              const result = await transport.acceptAnswer(answerCode);
              if (!result.ok) { pasteError = result.error; renderScreen(); return; }
              showToast('Connecting…', 'success', 1600);
            },
          }));
          body.appendChild(actions);
          body.appendChild(backButton(() => { disconnect(); screen = 'method'; renderScreen(); }));
        }

        function renderJoinManual() {
          role = 'guest';
          method = 'manual';
          body.appendChild(el('p', { class: 'modal-hint', text: "1. Paste the code the host sent you. 2. Send back the answer code this generates." }));

          const offerInput = el('textarea', {
            class: 'collab-code-area', rows: 4, placeholder: 'Paste the host\'s code here…',
            onInput: (e) => { pasteError = ''; hostOfferCodeInput = e.target.value; },
          });
          offerInput.value = hostOfferCodeInput;
          body.appendChild(offerInput);
          const errorEl = el('p', { class: 'generate-design-error' });
          if (pasteError) errorEl.textContent = pasteError;
          body.appendChild(errorEl);

          if (!answerCode) {
            const actions = el('div', { class: 'modal-actions' });
            actions.appendChild(el('button', {
              type: 'button', class: 'btn btn-primary', text: 'Generate answer code',
              onClick: async () => {
                if (!transport) {
                  transport = createManualTransport();
                  transport.onStatusChange(handleTransportStatusChange);
                }
                const result = await transport.createAnswer(hostOfferCodeInput);
                if (!result.ok) { pasteError = result.error; renderScreen(); return; }
                answerCode = result.code;
                renderScreen();
              },
            }));
            body.appendChild(actions);
          } else {
            const answerArea = el('textarea', { class: 'collab-code-area', rows: 4, readOnly: true });
            answerArea.value = answerCode;
            body.appendChild(el('h3', { class: 'modal-subheading', text: 'Send this answer code back to the host' }));
            body.appendChild(answerArea);
            body.appendChild(el('button', {
              type: 'button', class: 'btn btn-secondary', text: '📋 Copy code',
              onClick: async () => { await navigator.clipboard.writeText(answerCode); showToast('Code copied — send it back to the host.', 'success', 2000); },
            }));
            body.appendChild(el('p', { class: 'collab-status-text', text: 'Waiting for the host to finish connecting…' }));
          }
          body.appendChild(backButton(() => { disconnect(); screen = 'method'; renderScreen(); }));
        }

        function renderHostPeerJs() {
          role = 'host';
          method = 'peerjs';
          if (!hostedRoomCode) {
            body.appendChild(el('p', { class: 'collab-status-text', text: 'Setting up your room…' }));
            if (!transport) {
              transport = createPeerJsTransport();
              transport.onStatusChange(handleTransportStatusChange);
              transport.host().then((result) => {
                if (!result.ok) { showToast(result.error, 'error', 5000); disconnect(); screen = 'method'; renderScreen(); return; }
                hostedRoomCode = result.roomCode;
                renderScreen();
              });
            }
            return;
          }
          body.appendChild(el('p', { class: 'modal-hint', text: 'Share this room code with the other person — they enter it on their side to connect.' }));
          body.appendChild(el('p', { class: 'collab-room-code', text: hostedRoomCode }));
          body.appendChild(el('button', {
            type: 'button', class: 'btn btn-secondary', text: '📋 Copy room code',
            onClick: async () => { await navigator.clipboard.writeText(hostedRoomCode); showToast('Room code copied.', 'success', 1800); },
          }));
          body.appendChild(el('p', { class: 'collab-status-text', text: 'Waiting for someone to join…' }));
          body.appendChild(backButton(() => { disconnect(); screen = 'method'; renderScreen(); }));
        }

        function renderJoinPeerJs() {
          role = 'guest';
          method = 'peerjs';
          body.appendChild(el('p', { class: 'modal-hint', text: "Enter the room code the host shared with you." }));
          const input = el('input', { type: 'text', class: 'collab-room-input', placeholder: 'e.g. AB12CD', value: roomCodeInput, onInput: (e) => { roomCodeInput = e.target.value; } });
          body.appendChild(input);
          const errorEl = el('p', { class: 'generate-design-error' });
          if (pasteError) errorEl.textContent = pasteError;
          body.appendChild(errorEl);

          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', {
            type: 'button', class: 'btn btn-primary', text: 'Connect',
            onClick: async () => {
              if (!transport) {
                transport = createPeerJsTransport();
                transport.onStatusChange(handleTransportStatusChange);
              }
              statusText = 'Connecting…';
              renderScreen();
              const result = await transport.join(input.value);
              if (!result.ok) { pasteError = result.error; statusText = ''; renderScreen(); return; }
            },
          }));
          body.appendChild(actions);
          if (statusText) body.appendChild(el('p', { class: 'collab-status-text', text: statusText }));
          body.appendChild(backButton(() => { disconnect(); screen = 'method'; renderScreen(); }));
        }

        function renderConnected() {
          body.appendChild(el('p', { class: 'collab-status-text collab-status-connected', text: '🟢 Connected — live sync active' }));
          body.appendChild(el('p', { class: 'modal-hint', text: 'Keep editing the canvas as usual — your changes reach the other person automatically, and theirs reach you. You can close this window; the session keeps running.' }));
          const actions = el('div', { class: 'modal-actions' });
          actions.appendChild(el('button', {
            type: 'button', class: 'btn', text: 'Disconnect',
            onClick: () => { disconnect(); renderScreen(); },
          }));
          actions.appendChild(el('button', { type: 'button', class: 'btn btn-primary', text: 'Close', onClick: () => api.close() }));
          body.appendChild(actions);
        }

        function backButton(onClick) {
          return el('div', { class: 'modal-actions' }, [el('button', { type: 'button', class: 'btn', text: '← Back', onClick })]);
        }
      };

      renderScreen();
    },
    onClose: () => { unsubscribe?.(); },
  });
}
