// Manual/offline live-collaboration transport: one RTCPeerConnection +
// one ordered, reliable RTCDataChannel per session, with non-trickle ICE
// (wait for gathering to fully complete before producing a code) so the
// whole connection handshake reduces to two short copy/pasteable text
// blobs — an "offer" code from the host, an "answer" code back from the
// guest — with no signaling server of this app's own. See
// collab/peerjsCollab.js for the alternative "quick room code" method
// (same send/onMessage/onStatusChange/close shape, so collab/
// collabSession.js can drive either transport identically), and
// modals/collaborationModal.js for the UI that walks a host+guest pair
// through exchanging these codes.
//
// STUN-only (see ICE_SERVERS below) — there's no TURN relay here since
// that would require a server this app doesn't have. Two devices on
// restrictive/symmetric NATs (many corporate networks, some mobile
// carriers) may fail to connect; this is a known, documented limitation
// of the manual method, matching this app's existing "some things need a
// network the first time" precedent (vendor/VENDOR.md's WebLLM model
// download note).
//
// Scoped to exactly one guest per host session, matching how
// collab/collabSession.js's whole-project-state broadcast is designed —
// see its header comment.
import { encodeSignal, decodeSignal } from './collabProtocol.js';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// Non-trickle ICE means the connection code can only be produced once
// candidate gathering is done — but "done" waiting on the STUN server
// specifically is exactly the part that can't be guaranteed: a blocked or
// slow network shouldn't leave someone staring at "Generating connection
// code…" forever. GATHER_TIMEOUT_MS caps the wait so the code always
// generates promptly with whatever candidates showed up in time — for two
// devices on the same LAN (the common case this method targets) that's
// just the host candidates, gathered near-instantly, with or without STUN
// ever answering.
const GATHER_TIMEOUT_MS = 4000;

function waitForIceGatheringComplete(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pc.removeEventListener('icegatheringstatechange', check);
      clearTimeout(timer);
      resolve();
    };
    function check() {
      if (pc.iceGatheringState === 'complete') finish();
    }
    pc.addEventListener('icegatheringstatechange', check);
    const timer = setTimeout(finish, GATHER_TIMEOUT_MS);
  });
}

export function createManualTransport() {
  let pc = null;
  let channel = null;
  const messageHandlers = new Set();
  const statusHandlers = new Set();
  let status = 'idle'; // idle | connecting | connected | closed | error

  function setStatus(next) {
    status = next;
    for (const fn of statusHandlers) fn(status);
  }

  function wireChannel(ch) {
    channel = ch;
    channel.addEventListener('open', () => setStatus('connected'));
    channel.addEventListener('close', () => setStatus('closed'));
    channel.addEventListener('error', () => setStatus('error'));
    channel.addEventListener('message', (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      for (const fn of messageHandlers) fn(data);
    });
  }

  function newPeerConnection() {
    pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') setStatus('error');
    });
    return pc;
  }

  return {
    /** Host, step 1: produce the offer code to send to the guest out-of-band. */
    async createOffer() {
      try {
        setStatus('connecting');
        newPeerConnection();
        wireChannel(pc.createDataChannel('sdb-collab'));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIceGatheringComplete(pc);
        return { ok: true, code: encodeSignal({ type: 'offer', description: pc.localDescription }) };
      } catch (err) {
        setStatus('error');
        return { ok: false, error: String(err?.message || err) };
      }
    },
    /** Host, step 2: apply the guest's answer code to finish connecting. */
    async acceptAnswer(answerCode) {
      const decoded = decodeSignal(answerCode);
      if (!decoded.ok) return decoded;
      if (!pc) return { ok: false, error: 'Create an offer first.' };
      try {
        await pc.setRemoteDescription(decoded.data.description);
        return { ok: true };
      } catch (err) {
        setStatus('error');
        return { ok: false, error: String(err?.message || err) };
      }
    },
    /** Guest, step 1: consume the host's offer code and produce an answer code to send back. */
    async createAnswer(offerCode) {
      const decoded = decodeSignal(offerCode);
      if (!decoded.ok) return decoded;
      try {
        setStatus('connecting');
        newPeerConnection();
        pc.addEventListener('datachannel', (e) => wireChannel(e.channel));
        await pc.setRemoteDescription(decoded.data.description);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitForIceGatheringComplete(pc);
        return { ok: true, code: encodeSignal({ type: 'answer', description: pc.localDescription }) };
      } catch (err) {
        setStatus('error');
        return { ok: false, error: String(err?.message || err) };
      }
    },
    send(data) {
      if (channel?.readyState === 'open') channel.send(JSON.stringify(data));
    },
    onMessage(fn) {
      messageHandlers.add(fn);
      return () => messageHandlers.delete(fn);
    },
    onStatusChange(fn) {
      statusHandlers.add(fn);
      return () => statusHandlers.delete(fn);
    },
    getStatus() {
      return status;
    },
    close() {
      channel?.close();
      pc?.close();
      setStatus('closed');
    },
  };
}
