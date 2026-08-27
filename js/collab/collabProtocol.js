// Pure, DOM-free helpers for the manual (offline) WebRTC signaling method
// in webrtcCollab.js — turning an RTCSessionDescriptionInit into a short
// opaque text "code" a host and guest can exchange by any channel they
// like (chat, email, reading it aloud) without this app running a
// signaling server of its own. Split out from webrtcCollab.js specifically
// so this encode/decode round-trip is unit-testable without touching any
// real WebRTC API.
export function encodeSignal(obj) {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeSignal(code) {
  if (!code || !code.trim()) return { ok: false, error: 'Paste a connection code first.' };
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') throw new Error('not an object');
    return { ok: true, data };
  } catch {
    return { ok: false, error: "That code looks invalid or was cut off — copy the whole thing and try again." };
  }
}
