// Exports a Diagram Animation (panel/animationPanel.js) to a real .pptx
// file — one slide per step, each showing cumulatively more of the
// diagram revealed than the last (the same reveal order the in-app
// player uses), via the vendored PptxGenJS (see vendor/VENDOR.md).
//
// Real PowerPoint per-shape "entrance" animations and per-slide
// auto-advance timing live in OOXML's <p:timing> tree, which PptxGenJS
// 3.12.0 doesn't expose in either its public API or its bundled
// implementation (confirmed by inspecting vendor/pptxgen.bundle.js itself
// — no `advTm`/`transition` support anywhere in it). Rather than silently
// producing a .pptx that claims to auto-advance and doesn't, each step's
// intended timing (from its own revealMode/delayMs — see core/project.js's
// createAnimationStep) is written into that slide's speaker notes instead,
// alongside the step's own presenter notes if any. One slide per step is
// the standard, fully-supported way presenters already build this kind of
// progressive reveal in PowerPoint by hand.
import { loadScriptOnce, nextFrame } from '../utils/loadScript.js';
import { downloadBlob, sanitizeFilename } from '../utils/download.js';
import { applyAnimationExportVisibility, clearAnimationExportVisibility } from '../canvas/canvas.js';
import { captureDiagramCanvas } from './exportImage.js';

const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN = 0.4;

async function ensurePptxGenJS() {
  if (window.PptxGenJS) return window.PptxGenJS;
  await loadScriptOnce('vendor/pptxgen.bundle.js');
  return window.PptxGenJS;
}

function timingNoteFor(step) {
  return step.revealMode === 'auto'
    ? `Auto-advance after ${(step.delayMs / 1000).toFixed(1)}s in the app's own playback.`
    : "Advances on click in the app's own playback.";
}

/** @returns {Promise<{step: object, dataUrl: string|null}[]>} */
export async function renderAnimationStepsToDataUrls(animation, onProgress) {
  const results = [];
  const revealed = new Set();
  try {
    for (let i = 0; i < animation.steps.length; i++) {
      const step = animation.steps[i];
      for (const t of step.targets) revealed.add(`${t.targetType}:${t.targetId}`);
      onProgress?.(i + 1, animation.steps.length);
      applyAnimationExportVisibility(revealed);
      // eslint-disable-next-line no-await-in-loop -- each capture must
      // finish before the next step's visibility change, since they all
      // share the one live canvas.
      await nextFrame();
      // eslint-disable-next-line no-await-in-loop
      const canvas = await captureDiagramCanvas();
      results.push({ step, dataUrl: canvas ? canvas.toDataURL('image/png') : null });
    }
  } finally {
    clearAnimationExportVisibility();
  }
  return results;
}

export async function exportAnimationToPptx(animation) {
  const slides = await renderAnimationStepsToDataUrls(animation);
  const PptxGenJS = await ensurePptxGenJS();

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'DIAGRAM_16x9', width: SLIDE_W, height: SLIDE_H });
  pptx.layout = 'DIAGRAM_16x9';

  slides.forEach(({ step, dataUrl }, i) => {
    const s = pptx.addSlide();
    s.addText(`Step ${i + 1} of ${slides.length}`, { x: MARGIN, y: 0.2, w: SLIDE_W - MARGIN * 2, h: 0.6, fontSize: 20, bold: true, color: '1E293B' });
    const imageArea = { x: MARGIN, y: 0.9, w: SLIDE_W - MARGIN * 2, h: SLIDE_H - 1.2 };
    if (dataUrl) {
      s.addImage({ data: dataUrl, ...imageArea, sizing: { type: 'contain', w: imageArea.w, h: imageArea.h } });
    } else {
      s.addText('(Nothing to show for this step.)', { x: MARGIN, y: SLIDE_H / 2 - 0.3, w: SLIDE_W - MARGIN * 2, h: 0.6, fontSize: 14, italic: true, color: '888888', align: 'center' });
    }
    const notes = [timingNoteFor(step), step.notes].filter(Boolean).join('\n\n');
    s.addNotes(notes);
  });

  const blob = await pptx.write({ outputType: 'blob' });
  downloadBlob(blob, `${sanitizeFilename(animation.name)}-animation.pptx`);
}
