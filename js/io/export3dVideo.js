// Exports the live "🧊 3D Presentation" view as a video file — unlike
// io/exportAnimationVideo.js (which re-captures a rasterized frame per
// step, since the 2D canvas isn't already producing a continuous video
// stream), the 3D view's WebGL canvas is *already* rendering every frame
// on its own (js/render3d/scene3dRenderer.js's render loop — ambient
// particle motion, cable flow, camera auto-rotate), so this just records
// that live canvas directly via captureStream()/MediaRecorder while
// driving the Diagram Animation forward at the same real-time pace
// core/animationVideoTiming.js already defines for the 2D export, for the
// same reason: a click-only step becomes a fixed dwell here too, since
// nothing is present to click during an unattended recording.
//
// If the scene has a "🎬 Camera Tour" configured (see
// render3d/scene3dRenderer.js), the tour drives the recording's camera
// motion and duration instead of the passive auto-rotate — it's a much
// better recorded shot (deliberate, per-component framing) than a slow
// constant spin. Any Diagram Animation reveal still runs concurrently on
// its own real-time pace, exactly as before; the two are independent
// timelines that happen to share one recording.
import { downloadBlob, sanitizeFilename } from '../utils/download.js';
import { computeStepDurationMs } from '../core/animationVideoTiming.js';
import { startAnimationPlayback, stopAnimationPlayback } from '../canvas/canvas.js';
import { isAnimationPlaying, setFrozen, nextStep } from '../core/animationPlayback.js';

const FPS = 30;
const AMBIENT_DURATION_MS = 8000;

function pickMimeType() {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || 'video/webm';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {HTMLCanvasElement} canvasEl the live 3D view's own <canvas>
 * @param {object|null} animation the active Diagram Animation, if any —
 *   with no steps, this just records a fixed-length ambient clip instead
 *   (unless a camera tour drives the duration — see `controller` below).
 * @param {object|null} controller the mounted scene's own controller (see
 *   render3d/scene3dRenderer.js#mountScene3D) — when it has camera tour
 *   shots configured, `controller.playTourForExport()` drives the
 *   recording's camera motion and duration instead of the ambient clip.
 */
export async function exportAnimationTo3DVideo(canvasEl, animation, controller) {
  if (typeof MediaRecorder === 'undefined' || typeof canvasEl.captureStream !== 'function') {
    throw new Error('3D video export needs a browser that supports MediaRecorder and canvas.captureStream — try a recent Chrome, Edge, or Firefox.');
  }

  const stream = canvasEl.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();

  const steps = animation?.steps || [];
  const hasTour = !!controller?.getTourShots?.().length;
  const wasAlreadyPlaying = isAnimationPlaying();
  try {
    // The Diagram Animation reveal and the camera tour are independent
    // timelines sharing one recording — start the reveal (fire-and-forget,
    // it advances itself below) and separately await whichever one is the
    // driving clock: the tour if present, or the reveal's own real-time
    // pace, or a fixed ambient clip when neither exists.
    let revealDone = Promise.resolve();
    if (steps.length) {
      if (!wasAlreadyPlaying) startAnimationPlayback();
      // Freezing disables the playback state machine's own auto-advance
      // timers entirely (see core/animationPlayback.js#scheduleCurrent) —
      // this drives every step manually instead, so the two can't race
      // and double-advance.
      setFrozen(true);
      revealDone = (async () => {
        for (const step of steps) {
          // eslint-disable-next-line no-await-in-loop -- steps must play back one after another in real time
          await sleep(computeStepDurationMs(step));
          nextStep();
        }
      })();
    }

    if (hasTour) {
      await controller.playTourForExport();
      // Let the reveal (if any) finish out its own remaining steps rather
      // than cutting the recording off mid-reveal just because the tour's
      // own shot sequence happened to be shorter.
      await revealDone;
      await sleep(500);
    } else if (steps.length) {
      await revealDone;
      await sleep(500);
    } else {
      await sleep(AMBIENT_DURATION_MS);
    }
  } finally {
    if (steps.length && !wasAlreadyPlaying) stopAnimationPlayback();
  }

  recorder.stop();
  await stopped;
  for (const track of stream.getTracks()) track.stop();

  const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
  downloadBlob(blob, `${sanitizeFilename(animation?.name || 'diagram')}-3d.webm`);
}
