// PNG export via the vendored html2canvas (see vendor/VENDOR.md). Loaded
// lazily so it never costs anything unless the user actually exports.
import { getContentBounds } from '../canvas/canvas.js';
import * as viewport from '../canvas/viewport.js';
import { loadScriptOnce, nextFrame } from '../utils/loadScript.js';
import { downloadBlob, sanitizeFilename } from '../utils/download.js';

const PADDING = 48;

async function ensureHtml2Canvas() {
  if (window.html2canvas) return window.html2canvas;
  await loadScriptOnce('vendor/html2canvas.min.js');
  return window.html2canvas;
}

/** Renders the current diagram to an offscreen <canvas>, or null if the diagram is empty. */
export async function captureDiagramCanvas() {
  const bounds = getContentBounds();
  if (!bounds) return null;
  const html2canvas = await ensureHtml2Canvas();

  const viewportEl = document.querySelector('.canvas-viewport');
  const prevViewport = viewport.getViewport();
  const prevStyle = { width: viewportEl.style.width, height: viewportEl.style.height, overflow: viewportEl.style.overflow };

  const targetW = Math.max(1, Math.round(bounds.w + PADDING * 2));
  const targetH = Math.max(1, Math.round(bounds.h + PADDING * 2));

  viewport.setViewport({ x: -bounds.x + PADDING, y: -bounds.y + PADDING, zoom: 1 }, { silent: true });
  viewportEl.style.width = `${targetW}px`;
  viewportEl.style.height = `${targetH}px`;
  viewportEl.style.overflow = 'visible';
  viewportEl.classList.add('exporting');
  await nextFrame();

  let canvas;
  try {
    canvas = await html2canvas(viewportEl, { backgroundColor: '#ffffff', scale: 2, useCORS: true, logging: false });
  } finally {
    viewportEl.classList.remove('exporting');
    viewportEl.style.width = prevStyle.width;
    viewportEl.style.height = prevStyle.height;
    viewportEl.style.overflow = prevStyle.overflow;
    viewport.setViewport(prevViewport, { silent: true });
  }
  return canvas;
}

export async function exportPNG(projectName) {
  const canvas = await captureDiagramCanvas();
  if (!canvas) return { ok: false, error: 'Nothing to export yet — add some components first.' };
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve({ ok: false, error: 'Export failed.' });
        return;
      }
      downloadBlob(blob, `${sanitizeFilename(projectName)}.png`);
      resolve({ ok: true });
    }, 'image/png');
  });
}
