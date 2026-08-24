// PDF export via the vendored jsPDF (see vendor/VENDOR.md), reusing the
// same rasterized canvas as PNG export.
import { captureDiagramCanvas } from './exportImage.js';
import { getSequenceDiagramGroups } from '../canvas/canvas.js';
import { loadScriptOnce } from '../utils/loadScript.js';
import { sanitizeFilename } from '../utils/download.js';

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
