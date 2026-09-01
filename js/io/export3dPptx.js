// Exports the live "🧊 3D Presentation" view (either the stylized default
// or "🏢 Realistic Room") to a real .pptx file — mirrors
// io/exportAnimationPptx.js's 2D pattern (one slide per reveal step) but
// captures the 3D scene's own WebGL canvas per slide instead of the 2D
// canvas, via the mounted scene's `controller.captureStillFrame()` (see
// render3d/scene3dRenderer.js — a synchronous render()+toDataURL() pair,
// which is the safe way to read back a frame from a renderer created
// without `preserveDrawingBuffer`).
//
// One slide per "🎬 Camera Tour" shot, if a tour is configured (each shot
// gets its own labeled slide — the natural presentation unit for a tour);
// otherwise one slide per Diagram Animation step, progressively revealing
// the scene exactly like the 2D export does; otherwise a single overview
// slide of whatever's on screen right now. If both a tour and an animation
// are configured, the reveal state advances alongside the tour shots
// (slide N shows both tour shot N's camera framing and reveal step N's
// visibility) rather than picking one dimension arbitrarily.
import { loadScriptOnce, nextFrame } from '../utils/loadScript.js';
import { downloadBlob, sanitizeFilename } from '../utils/download.js';
import { startAnimationPlayback, stopAnimationPlayback } from '../canvas/canvas.js';
import { isAnimationPlaying, setFrozen, nextStep } from '../core/animationPlayback.js';

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN = 0.4;
// Matches scene3dRenderer.js's own `scene.background`/fog color, so a
// slide's dark navy 3D screenshot doesn't sit on a jarring white PowerPoint
// background with white heading text disappearing into it.
const DARK_BG = '0F1420';

async function ensurePptxGenJS() {
  if (window.PptxGenJS) return window.PptxGenJS;
  await loadScriptOnce('vendor/pptxgen.bundle.js');
  return window.PptxGenJS;
}

/** @returns {Promise<{dataUrl: string, label: string, step: object|null}[]>} */
async function renderScene3DSlides(controller, animation) {
  const shots = controller.getTourShots();
  const steps = animation?.steps || [];
  const slideCount = Math.max(shots.length, steps.length, 1);
  const wasAlreadyPlaying = isAnimationPlaying();
  const slides = [];
  try {
    if (steps.length) {
      if (!wasAlreadyPlaying) startAnimationPlayback();
      // Freezing disables the playback state machine's own auto-advance
      // timers (core/animationPlayback.js#scheduleCurrent) — each slide
      // below advances it manually instead, one step per slide, exactly
      // the same "reveal one more step, then capture" order the 2D pptx
      // export and the 3D video export both already use.
      setFrozen(true);
    }
    for (let i = 0; i < slideCount; i++) {
      if (shots.length) controller.setCameraToShot(Math.min(i, shots.length - 1));
      if (steps.length && i < steps.length) nextStep();
      // eslint-disable-next-line no-await-in-loop -- each slide's capture must land before the next shot/reveal change, since they all share the one live scene
      await nextFrame();
      const dataUrl = controller.captureStillFrame();
      const label = shots.length ? (shots[Math.min(i, shots.length - 1)].label || `Shot ${i + 1}`) : `Step ${i + 1}`;
      slides.push({ dataUrl, label, step: steps[Math.min(i, steps.length - 1)] || null });
    }
  } finally {
    if (steps.length && !wasAlreadyPlaying) stopAnimationPlayback();
  }
  return slides;
}

export async function exportScene3DToPptx(controller, animation) {
  const slides = await renderScene3DSlides(controller, animation);
  const PptxGenJS = await ensurePptxGenJS();

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'SCENE3D_16x9', width: SLIDE_W, height: SLIDE_H });
  pptx.layout = 'SCENE3D_16x9';

  slides.forEach(({ dataUrl, label, step }, i) => {
    const s = pptx.addSlide();
    s.background = { color: DARK_BG };
    s.addText(`${i + 1}. ${label}`, {
      x: MARGIN, y: 0.2, w: SLIDE_W - MARGIN * 2, h: 0.6, fontSize: 20, bold: true, color: 'F9FAFB',
    });
    const imageArea = { x: MARGIN, y: 0.9, w: SLIDE_W - MARGIN * 2, h: SLIDE_H - 1.2 };
    if (dataUrl) {
      s.addImage({ data: dataUrl, ...imageArea, sizing: { type: 'contain', w: imageArea.w, h: imageArea.h } });
    } else {
      s.addText('(Nothing captured for this slide.)', {
        x: MARGIN, y: SLIDE_H / 2 - 0.3, w: SLIDE_W - MARGIN * 2, h: 0.6, fontSize: 14, italic: true, color: 'CBD5E1', align: 'center',
      });
    }
    if (step?.notes) s.addNotes(step.notes);
  });

  const blob = await pptx.write({ outputType: 'blob' });
  downloadBlob(blob, `${sanitizeFilename(animation?.name || 'diagram')}-3d-presentation.pptx`);
}
