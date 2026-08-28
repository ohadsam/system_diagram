// Pure tiling math for io/exportPdf.js#exportPdfTiled — splits a large
// diagram's full rasterized bounds into a grid of page-sized tiles for
// printing a big diagram as a physically-assembled poster (several sheets
// taped/glued edge to edge), the way the single-page PDF export
// (exportPDF) can't for anything larger than one sheet. DOM-free and
// unit-testable, same reasoning as core/systemMap.js for keeping layout
// math out of the module that actually touches a <canvas>.

/**
 * @param {number} contentW total content width, in the same unit as pageW/pageH (points)
 * @param {number} contentH total content height
 * @param {number} pageW usable page width
 * @param {number} pageH usable page height
 * @param {number} overlap how much adjacent tiles overlap, so the printed
 *   sheets can be aligned by eye when assembled — subtracted from each
 *   page's own stride, not from its size (every tile is still a full page
 *   worth of content, just re-showing a strip already printed on its
 *   neighbor).
 * @returns {{row: number, col: number, x: number, y: number, w: number, h: number, pageNumber: number}[]}
 *   in row-major page order (page 1 = top-left), empty if content has no size.
 */
export function computeTileGrid(contentW, contentH, pageW, pageH, overlap = 0) {
  if (contentW <= 0 || contentH <= 0 || pageW <= 0 || pageH <= 0) return [];
  const strideW = Math.max(1, pageW - overlap);
  const strideH = Math.max(1, pageH - overlap);
  const cols = Math.max(1, Math.ceil((contentW - overlap) / strideW) || 1);
  const rows = Math.max(1, Math.ceil((contentH - overlap) / strideH) || 1);

  const tiles = [];
  let pageNumber = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      pageNumber += 1;
      const x = col * strideW;
      const y = row * strideH;
      // The last row/column's tile is clamped to the actual remaining
      // content instead of running past it — a diagram whose size isn't an
      // exact multiple of (page - overlap) shouldn't print blank margin as
      // if it were real content.
      const w = Math.min(pageW, contentW - x);
      const h = Math.min(pageH, contentH - y);
      tiles.push({ row, col, x, y, w, h, pageNumber });
    }
  }
  return tiles;
}
