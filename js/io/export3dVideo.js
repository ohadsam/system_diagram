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
 *   with no steps, this just records a fixed-length ambient clip instead.
 */
export async function exportAnimationTo3DVideo(canvasEl, animation) {
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
  const wasAlreadyPlaying = isAnimationPlaying();
  try {
    if (steps.length) {
      if (!wasAlreadyPlaying) startAnimationPlayback();
      // Freezing disables the playback state machine's own auto-advance
      // timers entirely (see core/animationPlayback.js#scheduleCurrent) —
      // this loop drives every step manually instead, so the two can't
      // race and double-advance.
      setFrozen(true);
      for (const step of steps) {
        // eslint-disable-next-line no-await-in-loop -- steps must play back one after another in real time
        await sleep(computeStepDurationMs(step));
        nextStep();
      }
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
