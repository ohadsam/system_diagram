// Exports a presentation (modals/presentationsModal.js) to a real .pptx
// file via the vendored PptxGenJS (see vendor/VENDOR.md) — loaded lazily,
// only when the user actually exports one. Reuses
// modals/presentationPlayerModal.js#renderSlidesToDataUrls for the actual
// slide rasterization (the same temporary-content-swap + html2canvas
// capture the in-app player uses), so "what you see in Play" and "what
// ends up in the .pptx" are guaranteed to be the same images — one slide
// per presentation slide, its title as a heading, its image filling the
// rest, and its notes (if any) as the slide's speaker notes.
import { loadScriptOnce } from '../utils/loadScript.js';
import { downloadBlob, sanitizeFilename } from '../utils/download.js';
import * as store from '../core/store.js';
import { renderSlidesToDataUrls } from '../modals/presentationPlayerModal.js';

// 13.33x7.5in = standard 16:9 slide size (PptxGenJS's own 'LAYOUT_16x9').
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;
const MARGIN = 0.4;

async function ensurePptxGenJS() {
  if (window.PptxGenJS) return window.PptxGenJS;
  await loadScriptOnce('vendor/pptxgen.bundle.js');
  return window.PptxGenJS;
}

export async function exportPresentationToPptx(presentation) {
  const versions = store.getState().versions || [];
  const slides = await renderSlidesToDataUrls(presentation, versions);
  const PptxGenJS = await ensurePptxGenJS();

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'DIAGRAM_16x9', width: SLIDE_W, height: SLIDE_H });
  pptx.layout = 'DIAGRAM_16x9';

  for (const slide of slides) {
    const s = pptx.addSlide();
    s.addText(slide.title || '', { x: MARGIN, y: 0.2, w: SLIDE_W - MARGIN * 2, h: 0.7, fontSize: 24, bold: true, color: '1E293B' });
    const imageArea = { x: MARGIN, y: 1.0, w: SLIDE_W - MARGIN * 2, h: SLIDE_H - 1.3 };
    if (slide.dataUrl) {
      s.addImage({ data: slide.dataUrl, ...imageArea, sizing: { type: 'contain', w: imageArea.w, h: imageArea.h } });
    } else {
      s.addText('(This slide\'s version is empty, or no longer exists.)', { x: MARGIN, y: SLIDE_H / 2 - 0.3, w: SLIDE_W - MARGIN * 2, h: 0.6, fontSize: 14, italic: true, color: '888888', align: 'center' });
    }
    if (slide.notes) s.addNotes(slide.notes);
  }

  const blob = await pptx.write({ outputType: 'blob' });
  downloadBlob(blob, `${sanitizeFilename(presentation.name)}.pptx`);
}
