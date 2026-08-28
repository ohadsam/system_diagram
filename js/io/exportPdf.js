// PDF export via the vendored jsPDF (see vendor/VENDOR.md), reusing the
// same rasterized canvas as PNG export.
import { captureDiagramCanvas } from './exportImage.js';
import { getSequenceDiagramGroups } from '../canvas/canvas.js';
import { loadScriptOnce } from '../utils/loadScript.js';
import { sanitizeFilename } from '../utils/download.js';
import { computeTileGrid } from '../core/pdfTiling.js';

// Usable page size in points (jsPDF's 'pt' unit, matching every other size
// in this file) — a hair under the true paper size to leave a small margin.
export const POSTER_PAGE_SIZES = {
  a4: { label: 'A4', w: 575, h: 822 },
  letter: { label: 'US Letter', w: 592, h: 772 },
};
const TILE_OVERLAP_PT = 24;

async function ensureJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await loadScriptOnce('vendor/jspdf.umd.min.js');
  return window.jspdf.jsPDF;
}

function addCanvasPage(doc, canvas, isFirstPage) {
  const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
  const w = canvas.width / 2;
  const h = canvas.height / 2;
  if (!isFirstPage) doc.addPage([w, h], orientation);
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
}

/** Exports the main diagram as page 1, then one additional page per
 * sequence-diagram group (see getSequenceDiagramGroups) — each such group
 * prints on its own separate page, several if the project has several. */
export async function exportPDF(projectName) {
  const canvas = await captureDiagramCanvas();
  if (!canvas) return { ok: false, error: 'Nothing to export yet — add some components first.' };

  const JsPDF = await ensureJsPDF();
  const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
  const doc = new JsPDF({ orientation, unit: 'pt', format: [canvas.width / 2, canvas.height / 2] });
  addCanvasPage(doc, canvas, true);

  const groups = getSequenceDiagramGroups();
  for (const group of groups) {
    // eslint-disable-next-line no-await-in-loop -- each capture temporarily
    // swaps the live viewport/pan-zoom state; must fully finish (and
    // restore it) before the next one starts, so this can't run in parallel.
    const groupCanvas = await captureDiagramCanvas({ nodeIds: group.nodes.map((n) => n.id) });
    if (groupCanvas) addCanvasPage(doc, groupCanvas, false);
  }

  doc.save(`${sanitizeFilename(projectName)}.pdf`);
  return { ok: true };
}

/** Exports the diagram tiled across several same-size pages meant to be
 * printed and physically assembled edge to edge into one big poster — the
 * single-page exportPDF above has no answer for a diagram larger than one
 * sheet at a legible size, since it always scales the whole thing onto one
 * page. Tiling math is core/pdfTiling.js#computeTileGrid (pure, unit-
 * tested); this function only slices the already-rasterized canvas
 * (captureDiagramCanvas — same source exportPDF/exportPNG use) into each
 * tile's own region and adds it as a page, with a small overlap between
 * neighbors so the printed sheets can be lined up by eye, plus a page
 * number/position label in the corner of each one to help reassemble them
 * in the right order. */
export async function exportPdfTiled(projectName, pageFormat = 'a4') {
  const canvas = await captureDiagramCanvas();
  if (!canvas) return { ok: false, error: 'Nothing to export yet — add some components first.' };

  const page = POSTER_PAGE_SIZES[pageFormat] || POSTER_PAGE_SIZES.a4;
  // Same fixed /2 convention exportPDF (addCanvasPage) above already uses
  // to convert the rasterized canvas back to pt-equals-css-pixel — kept
  // consistent between the two PDF exports rather than trying to recover
  // captureDiagramCanvas's actual (occasionally-capped-below-2x) scale
  // factor, which it doesn't expose to its callers.
  const scale = 2;
  const contentW = canvas.width / scale;
  const contentH = canvas.height / scale;
  const tiles = computeTileGrid(contentW, contentH, page.w, page.h, TILE_OVERLAP_PT);
  if (!tiles.length) return { ok: false, error: 'Nothing to export yet — add some components first.' };

  const orientation = page.w >= page.h ? 'landscape' : 'portrait';
  const JsPDF = await ensureJsPDF();
  const doc = new JsPDF({ orientation, unit: 'pt', format: [page.w, page.h] });
  const rows = Math.max(...tiles.map((t) => t.row)) + 1;
  const cols = Math.max(...tiles.map((t) => t.col)) + 1;

  tiles.forEach((tile, i) => {
    if (i > 0) doc.addPage([page.w, page.h], orientation);
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = Math.round(tile.w * scale);
    tileCanvas.height = Math.round(tile.h * scale);
    tileCanvas.getContext('2d').drawImage(
      canvas,
      tile.x * scale, tile.y * scale, tile.w * scale, tile.h * scale,
      0, 0, tileCanvas.width, tileCanvas.height,
    );
    doc.addImage(tileCanvas.toDataURL('image/png'), 'PNG', 0, 0, tile.w, tile.h);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${tile.pageNumber}/${tiles.length} — row ${tile.row + 1}/${rows}, col ${tile.col + 1}/${cols}`, 10, page.h - 10);
  });

  doc.save(`${sanitizeFilename(projectName)}-poster.pdf`);
  return { ok: true, pageCount: tiles.length };
}
