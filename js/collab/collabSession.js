// Wires either live-collaboration transport (webrtcCollab.js's manual
// codes or peerjsCollab.js's quick room code — both expose the same
// send/onMessage shape) to core/store.js: broadcast this browser's own
// edits out, apply the other side's edits in. Deliberately the simplest
// sync model that works for exactly one host + one guest (see
// modals/collaborationModal.js — this app has no server, so there's
// nowhere to arbitrate more than two writers):
//
//   - Whole-project-state broadcast, not per-op diffs. Simpler, and this
//     app already treats "whole state" as the unit of change everywhere
//     else (undo/redo, JSON import/export, versions) — no separate
//     operation log to invent and keep correct.
//   - Last-write-wins. A WebRTC DataChannel is ordered and reliable, so
//     within one connection messages are applied in the order they were
//     sent; if both sides happen to edit around the same moment, whichever
//     change lands last (locally or remotely) simply wins. Fine for two
//     people actively looking at the same screen, which is this
//     feature's whole use case.
//   - Debounced (DEBOUNCE_MS), same reasoning as io/autoSuggestWatcher.js:
//     a drag/resize gesture fires store 'change' on every frame, and
//     broadcasting every one of those would flood the data channel for no
//     benefit — only the settled result matters to the other side.
//   - Echo-loop prevention via a synchronous `applyingRemote` flag around
//     the local store.dispatch call: without it, applying a remote update
//     would itself fire 'change', which would broadcast it right back.
//   - Applied via `store.dispatch(..., { coalesce: true })` rather than
//     `store.loadProject` — matching this app's existing drag-gesture
//     coalesce convention — so a stream of incoming remote updates doesn't
//     spam the local undo/redo history with one entry per update, and
//     selection/history aren't reset on every single incoming change the
//     way a full loadProject would.
import * as store from '../core/store.js';

const DEBOUNCE_MS = 400;

/**
 * @param {{send:(data:object)=>void, onMessage:(fn:(data:object)=>void)=>()=>void}} transport
 * @returns {{sendInitialState: () => void, stop: () => void}}
 */
export function startCollabSession(transport) {
  let applyingRemote = false;
  let debounceTimer = null;

  function broadcastState() {
    transport.send({ type: 'state', project: store.getState() });
  }

  const unsubscribeChange = store.subscribe('change', () => {
    if (applyingRemote) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(broadcastState, DEBOUNCE_MS);
  });

  const unsubscribeMessage = transport.onMessage((msg) => {
    if (!msg || msg.type !== 'state' || !msg.project || typeof msg.project !== 'object') return;
    applyingRemote = true;
    try {
      store.dispatch((draft) => Object.assign(draft, structuredClone(msg.project)), { coalesce: true });
    } finally {
      applyingRemote = false;
    }
  });

  return {
    /** The host sends its current canvas the moment the connection opens, so the guest starts in sync. */
    sendInitialState: broadcastState,
    stop() {
      clearTimeout(debounceTimer);
      unsubscribeChange();
      unsubscribeMessage();
    },
  };
}
