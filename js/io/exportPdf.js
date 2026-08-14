// PDF export via the vendored jsPDF (see vendor/VENDOR.md), reusing the
// same rasterized canvas as PNG export.
import { captureDiagramCanvas } from './exportImage.js';
import { loadScriptOnce } from '../utils/loadScript.js';
import { sanitizeFilename } from '../utils/download.js';

async function ensureJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  await loadScriptOnce('vendor/jspdf.umd.min.js');
  return window.jspdf.jsPDF;
}

export async function exportPDF(projectName) {
  const canvas = await captureDiagramCanvas();
  if (!canvas) return { ok: false, error: 'Nothing to export yet — add some components first.' };

  const JsPDF = await ensureJsPDF();
  const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
  const doc = new JsPDF({ orientation, unit: 'pt', format: [canvas.width / 2, canvas.height / 2] });
  const imageData = canvas.toDataURL('image/png');
  doc.addImage(imageData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
  doc.save(`${sanitizeFilename(projectName)}.pdf`);
  return { ok: true };
}
