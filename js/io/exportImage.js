// PNG export via the vendored html2canvas (see vendor/VENDOR.md). Loaded
// lazily so it never costs anything unless the user actually exports.
import { getContentBounds, getNodesBounds, hideExcept, getSequenceDiagramGroups } from '../canvas/canvas.js';
import * as viewport from '../canvas/viewport.js';
import { loadScriptOnce, nextFrame } from '../utils/loadScript.js';
import { downloadBlob, sanitizeFilename } from '../utils/download.js';

const PADDING = 48;
// Browsers cap a single <canvas>'s width/height (commonly ~16384px, lower
// on some mobile browsers) — past that, html2canvas's own internal canvas
// silently clips instead of erroring. Scale down from the default 2x for
// a diagram whose target size would cross this well under every browser's
// real limit, rather than exporting a cropped image with no indication
// anything went wrong.
const MAX_CANVAS_DIMENSION = 8000;

async function ensureHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;
  await loadScriptOnce('vendor/html2canvas.min.js');
  return window.html2canvas;
}

/** Draws a Diagram Animation step's persisted presenter markup (see
 * core/project.js#createAnnotation) onto an already-captured frame, using
 * the exact same world-to-pixel mapping captureDiagramCanvas itself just
 * used to produce that frame: a canvas/world-space point `(x, y)` lands at
 * `((x - bounds.x + PADDING) * scale, (y - bounds.y + PADDING) * scale)` —
 * the same "shift by the capture's own top-left, then apply its own
 * html2canvas scale" the temporary `viewport.setViewport` + `scale` above
 * amount to, just computed directly instead of round-tripping through the
 * live viewport (which callers baking an *export* frame, sometimes well
 * after the live viewport has been restored to something else, can't rely
 * on — see io/exportAnimationPptx.js/exportAnimationVideo.js). */
function bakeAnnotationsOntoCanvas(canvas, annotations, bounds, scale) {
  if (!annotations?.length) return;
  const ctx = canvas.getContext('2d');
  const toPixel = (x, y) => ({ x: (x - bounds.x + PADDING) * scale, y: (y - bounds.y + PADDING) * scale });
  for (const anno of annotations) {
    if (anno.type === 'text') {
      const pt = toPixel(anno.x, anno.y);
      ctx.save();
      ctx.font = `600 ${Math.round(16 * scale)}px sans-serif`;
      ctx.textBaseline = 'top';
      const metrics = ctx.measureText(anno.text);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(pt.x - 3 * scale, pt.y - 2 * scale, metrics.width + 6 * scale, 22 * scale);
      ctx.fillStyle = anno.color;
      ctx.fillText(anno.text, pt.x, pt.y);
      ctx.restore();
      continue;
    }
    if (!anno.points || anno.points.length < 2) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (anno.tool === 'highlighter') {
      ctx.lineWidth = 14 * scale;
      ctx.globalAlpha = 0.35;
    } else {
      ctx.lineWidth = 3 * scale;
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = anno.color;
    ctx.beginPath();
    const start = toPixel(anno.points[0].x, anno.points[0].y);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < anno.points.length; i++) {
      const pt = toPixel(anno.points[i].x, anno.points[i].y);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** Renders the current diagram to an offscreen <canvas>, or null if the
 * diagram (or, with `nodeIds` given, that specific subset) is empty. Passing
 * `nodeIds` captures *only* those nodes/their internal edges in isolation —
 * used to export each sequence-diagram group as its own separate page/image
 * (see exportPdf.js, exportPNG below, and canvas.js#hideExcept/
 * #getNodesBounds) — everything else on the canvas is hidden for the
 * duration of the capture and restored again immediately after. Passing
 * `annotations` (a Diagram Animation step's own persisted presenter markup)
 * bakes it directly into the returned frame — see
 * io/exportAnimationPptx.js/exportAnimationVideo.js, the only two callers
 * that use it. */
export async function captureDiagramCanvas({ nodeIds, annotations } = {}) {
  const bounds = nodeIds ? getNodesBounds(nodeIds) : getContentBounds();
  if (!bounds) return null;
  const html2canvas = await ensureHtml2Canvas();

  const viewportEl = document.querySelector('.canvas-viewport');
  const prevViewport = viewport.getViewport();
  const prevStyle = { width: viewportEl.style.width, height: viewportEl.style.height, overflow: viewportEl.style.overflow };
  const restoreVisibility = nodeIds ? hideExcept(nodeIds) : null;

  const targetW = Math.max(1, Math.round(bounds.w + PADDING * 2));
  const targetH = Math.max(1, Math.round(bounds.h + PADDING * 2));

  viewport.setViewport({ x: -bounds.x + PADDING, y: -bounds.y + PADDING, zoom: 1 }, { silent: true });
  viewportEl.style.width = `${targetW}px`;
  viewportEl.style.height = `${targetH}px`;
  viewportEl.style.overflow = 'visible';
  viewportEl.classList.add('exporting');
  await nextFrame();

  const scale = Math.min(2, MAX_CANVAS_DIMENSION / Math.max(targetW, targetH));

  let canvas;
  try {
    canvas = await html2canvas(viewportEl, { backgroundColor: '#ffffff', scale, useCORS: true, logging: false });
    bakeAnnotationsOntoCanvas(canvas, annotations, bounds, scale);
  } finally {
    viewportEl.classList.remove('exporting');
    viewportEl.style.width = prevStyle.width;
    viewportEl.style.height = prevStyle.height;
    viewportEl.style.overflow = prevStyle.overflow;
    viewport.setViewport(prevViewport, { silent: true });
    restoreVisibility?.();
  }
  return canvas;
}

/** One <canvas> per sequence-diagram group currently in the project (empty
 * array if there are none), each cropped to just that group's own content —
 * see captureDiagramCanvas's `nodeIds` option above. */
async function captureSequenceDiagramCanvases() {
  const groups = getSequenceDiagramGroups();
  const canvases = [];
  for (const group of groups) {
    const canvas = await captureDiagramCanvas({ nodeIds: group.nodes.map((n) => n.id) });
    if (canvas) canvases.push({ canvas, label: group.label });
  }
  return canvases;
}

async function downloadCanvasAsPng(canvas, filename) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      downloadBlob(blob, filename);
      resolve(true);
    }, 'image/png');
  });
}

/** Exports the main diagram as one PNG, plus one additional PNG per
 * sequence-diagram group (see getSequenceDiagramGroups) — each such group
 * is its own separate image, several if the project has several. */
export async function exportPNG(projectName) {
  const canvas = await captureDiagramCanvas();
  if (!canvas) return { ok: false, error: 'Nothing to export yet — add some components first.' };
  const baseName = sanitizeFilename(projectName);
  const ok = await downloadCanvasAsPng(canvas, `${baseName}.png`);
  if (!ok) return { ok: false, error: 'Export failed.' };

  const seqCanvases = await captureSequenceDiagramCanvases();
  let i = 0;
  for (const { canvas: seqCanvas, label } of seqCanvases) {
    i += 1;
    const suffix = label ? sanitizeFilename(label) : `sequence-diagram-${i}`;
    await downloadCanvasAsPng(seqCanvas, `${baseName} - ${suffix}.png`);
  }
  return { ok: true };
}
