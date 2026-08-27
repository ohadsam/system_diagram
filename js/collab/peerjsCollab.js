// "Quick room code" live-collaboration transport — an alternative to
// webrtcCollab.js's manual offer/answer code exchange, for when copying
// two blobs of text back and forth is more friction than a host and guest
// want. Uses the vendored PeerJS library (vendor/peerjs.min.js, loaded
// lazily only when this connection method is actually picked) purely for
// its free public signaling broker (0.peerjs.com) — finding the other
// browser by a short human-typable room code — while the actual diagram
// data still flows peer-to-peer over WebRTC once connected, exactly like
// the manual method. Same send/onMessage/onStatusChange/close shape as
// createManualTransport() so collab/collabSession.js can drive either one
// identically.
//
// Real end-to-end use of this (crossing PeerJS's real public broker) isn't
// exercised by this repo's e2e suite — same documented sandbox limitation
// as Local AI's WebLLM model download (see vendor/VENDOR.md) — but the
// room-code generation and the transport's plumbing are unit-testable on
// their own (tests/unit/peerjsCollab.test.mjs).
import { loadScriptOnce } from '../utils/loadScript.js';

const PEER_ID_PREFIX = 'sdb-collab-';
// Uppercase letters/digits only, with visually-ambiguous characters
// (0/O, 1/I/L) removed — this code gets read aloud or typed by hand.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;

export function randomRoomCode() {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function describePeerError(err) {
  if (err?.type === 'peer-unavailable') return "That room code isn't active — check it's correct and the host is still waiting.";
  if (err?.type === 'unavailable-id') return 'That room code is already in use — try again for a new one.';
  if (err?.type === 'network' || err?.type === 'server-error') return "Couldn't reach the connection service — check your internet connection and try again.";
  return `Connection error: ${err?.message || err?.type || 'unknown'}.`;
}

export function createPeerJsTransport() {
  let peer = null;
  let conn = null;
  const messageHandlers = new Set();
  const statusHandlers = new Set();
  let status = 'idle';

  function setStatus(next) {
    status = next;
    for (const fn of statusHandlers) fn(status);
  }

  async function ensurePeerJsLoaded() {
    if (!window.Peer) await loadScriptOnce('vendor/peerjs.min.js');
  }

  function wireConnection(connection) {
    conn = connection;
    conn.on('open', () => setStatus('connected'));
    conn.on('close', () => setStatus('closed'));
    conn.on('error', () => setStatus('error'));
    conn.on('data', (data) => { for (const fn of messageHandlers) fn(data); });
  }

  return {
    /** Host: claims a fresh room code on the public broker and waits for a guest to connect. */
    async host() {
      try {
        setStatus('connecting');
        await ensurePeerJsLoaded();
        const roomCode = randomRoomCode();
        return await new Promise((resolve) => {
          peer = new window.Peer(PEER_ID_PREFIX + roomCode);
          peer.on('open', () => resolve({ ok: true, roomCode }));
          peer.on('connection', (connection) => wireConnection(connection));
          // Registered for the life of the peer, not just this initial
          // attempt — a broker-level error arriving after the connection
          // is already up (e.g. the signaling server itself drops) would
          // otherwise never reach onStatusChange, since resolving an
          // already-settled Promise a second time is a silent no-op.
          peer.on('error', (err) => { setStatus('error'); resolve({ ok: false, error: describePeerError(err) }); });
        });
      } catch (err) {
        setStatus('error');
        return { ok: false, error: String(err?.message || err) };
      }
    },
    /** Guest: connects to a host's room code via the public broker. */
    async join(roomCode) {
      const trimmed = (roomCode || '').trim().toUpperCase();
      if (!trimmed) return { ok: false, error: 'Enter the room code first.' };
      try {
        setStatus('connecting');
        await ensurePeerJsLoaded();
        return await new Promise((resolve) => {
          peer = new window.Peer();
          peer.on('open', () => {
            wireConnection(peer.connect(PEER_ID_PREFIX + trimmed));
            resolve({ ok: true });
          });
          // Registered for the life of the peer, not just this initial
          // attempt — a broker-level error arriving after the connection
          // is already up (e.g. the signaling server itself drops) would
          // otherwise never reach onStatusChange, since resolving an
          // already-settled Promise a second time is a silent no-op.
          peer.on('error', (err) => { setStatus('error'); resolve({ ok: false, error: describePeerError(err) }); });
        });
      } catch (err) {
        setStatus('error');
        return { ok: false, error: String(err?.message || err) };
      }
    },
    send(data) {
      if (conn?.open) conn.send(data);
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
      conn?.close();
      peer?.destroy();
      setStatus('closed');
    },
  };
}
