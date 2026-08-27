// Exports a Diagram Animation (panel/animationPanel.js) as a real video
// file — no vendored library needed, unlike the PNG/PDF/PPTX exports:
// every browser capable of running this app's Local AI mode (WebGPU) also
// ships the native `HTMLCanvasElement.captureStream()` + `MediaRecorder`
// APIs this uses. Each step's already-rasterized frame (the same
// html2canvas capture io/exportAnimationPptx.js's slide export shares —
// see canvas/canvas.js#applyAnimationExportVisibility) is drawn onto one
// persistent recording <canvas> and held for that step's own screen-time
// (core/animationVideoTiming.js), so the resulting video plays back at
// the same pace core/animationPlayback.js would during a live "▶️ Play
// Animation" — just without anyone there to click through the 'click'
// steps, hence their fixed CLICK_STEP_DWELL_MS dwell instead.
import { applyAnimationExportVisibility, clearAnimationExportVisibility } from '../canvas/canvas.js';
import { captureDiagramCanvas } from './exportImage.js';
import { nextFrame } from '../utils/loadScript.js';
import { downloadBlob, sanitizeFilename } from '../utils/download.js';
import { computeStepDurationMs } from '../core/animationVideoTiming.js';

const FPS = 30;

function pickMimeType() {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || 'video/webm';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object} animation
 * @param {(done:number, total:number, phase:'capturing'|'recording') => void} [onProgress]
 * @returns {Promise<{ok:true}|{ok:false,error:string}>}
 */
export async function exportAnimationToVideo(animation, onProgress) {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    return { ok: false, error: 'Video export needs a browser that supports MediaRecorder and canvas.captureStream — try a recent Chrome, Edge, or Firefox.' };
  }
  if (!animation.steps.length) return { ok: false, error: 'This animation has no steps yet.' };

  // Capture every step's frame up front (same visibility mechanism
  // exportAnimationPptx.js's slide export uses) so the recording pass
  // itself is just steady frame-holding in real time, not interleaved
  // with the DOM/CSS work each capture needs.
  const frames = [];
  const revealed = new Set();
  try {
    for (let i = 0; i < animation.steps.length; i++) {
      const step = animation.steps[i];
      for (const t of step.targets) revealed.add(`${t.targetType}:${t.targetId}`);
      onProgress?.(i + 1, animation.steps.length, 'capturing');
      applyAnimationExportVisibility(revealed);
      // eslint-disable-next-line no-await-in-loop -- each capture must
      // finish before the next step's visibility change, since they all
      // share the one live canvas.
      await nextFrame();
      // eslint-disable-next-line no-await-in-loop
      const canvas = await captureDiagramCanvas();
      if (canvas) frames.push({ canvas, durationMs: computeStepDurationMs(step) });
    }
  } finally {
    clearAnimationExportVisibility();
  }
  if (!frames.length) return { ok: false, error: 'Nothing to record — every step is empty.' };

  const width = Math.max(...frames.map((f) => f.canvas.width));
  const height = Math.max(...frames.map((f) => f.canvas.height));
  const recordCanvas = document.createElement('canvas');
  recordCanvas.width = width;
  recordCanvas.height = height;
  const ctx = recordCanvas.getContext('2d');

  function drawFrame(canvas) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(canvas, Math.round((width - canvas.width) / 2), Math.round((height - canvas.height) / 2));
  }

  drawFrame(frames[0].canvas); // a real frame is on screen before the stream/recorder ever starts
  const stream = recordCanvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

  recorder.start();
  for (let i = 0; i < frames.length; i++) {
    onProgress?.(i + 1, frames.length, 'recording');
    drawFrame(frames[i].canvas);
    // eslint-disable-next-line no-await-in-loop -- steps must play back one after another in real time
    await sleep(frames[i].durationMs);
  }
  recorder.stop();
  await stopped;
  for (const track of stream.getTracks()) track.stop();

  const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
  downloadBlob(blob, `${sanitizeFilename(animation.name)}-animation.webm`);
  return { ok: true };
}
