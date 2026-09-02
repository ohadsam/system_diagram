// "📱 Remote Control" — lets a presenter drive Diagram Animation playback
// (Next/Previous step) from their phone instead of reaching back to the
// laptop keyboard while presenting. Reuses collab/peerjsCollab.js's exact
// transport (the same PeerJS room-code pairing Live Collaboration already
// uses) purely as a one-way command channel: remote.html (a separate,
// minimal page opened on the phone) is the "guest" sending
// `{type:'remote-cmd', cmd}` messages, this module (running in the main app
// tab) is the "host" that receives them and drives
// core/animationPlayback.js directly. No project data ever crosses this
// channel, unlike collab/collabSession.js's whole-state sync.
import { createPeerJsTransport } from './peerjsCollab.js';
import { nextStep, prevStep, isAnimationPlaying } from '../core/animationPlayback.js';

let transport = null;
let roomCode = '';

export function isPresenterRemoteHosting() {
  return !!transport;
}

export function getPresenterRemoteRoomCode() {
  return roomCode;
}

/** Claims a room code and starts listening for a phone to connect. Safe to
 * call again while already hosting — returns the existing room code rather
 * than starting a second, redundant PeerJS peer. */
export async function startPresenterRemoteHost() {
  if (transport) return { ok: true, roomCode };
  const t = createPeerJsTransport();
  const result = await t.host();
  if (!result.ok) return result;
  transport = t;
  roomCode = result.roomCode;
  transport.onMessage((msg) => {
    if (!msg || msg.type !== 'remote-cmd' || !isAnimationPlaying()) return;
    if (msg.cmd === 'next') nextStep();
    else if (msg.cmd === 'prev') prevStep();
  });
  return result;
}

/** For the modal's own "🟢 connected" status line. */
export function onPresenterRemoteStatusChange(fn) {
  if (!transport) return () => {};
  return transport.onStatusChange(fn);
}

export function isPresenterRemoteConnected() {
  return transport?.getStatus() === 'connected';
}

export function stopPresenterRemoteHost() {
  transport?.close();
  transport = null;
  roomCode = '';
}

/** Guest side — used only by remote.html on the phone, never by the main app. */
export function createPresenterRemoteGuestTransport() {
  return createPeerJsTransport();
}

export function sendRemoteCommand(guestTransport, cmd) {
  guestTransport.send({ type: 'remote-cmd', cmd });
}
