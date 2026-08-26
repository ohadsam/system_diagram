// Pure grid layout for io/sqlDdlImport.js's parsed tables — a simple
// row-wrapping grid, same "safety-net" spirit as io/aiGenerateDesign.js
// spreading ungrounded AI output onto a grid: a foreign-key-aware graph
// layout would be nicer but is real scope on its own, and a predictable
// grid is never worse than a pile of overlapping boxes. DOM-free/pure so
// it's unit-testable — canvas.js#createErDiagramFromDdl turns the result
// into real nodes.
const BOX_W = 220;
const ROW_H = 26;
const BASE_H = 60;
const GAP_X = 60;
const GAP_Y = 60;

/**
 * @param {{name: string, columns: object[]}[]} tables
 * @param {number} centerX
 * @param {number} centerY
 * @returns {{name: string, columns: object[], x: number, y: number, w: number, h: number}[]}
 */
export function layoutErTables(tables, centerX = 0, centerY = 0) {
  if (!tables || !tables.length) return [];
  const boxes = tables.map((t) => ({ ...t, w: BOX_W, h: BASE_H + t.columns.length * ROW_H }));
  const cols = Math.max(1, Math.ceil(Math.sqrt(boxes.length)));

  const rows = [];
  for (let i = 0; i < boxes.length; i += cols) rows.push(boxes.slice(i, i + cols));
  const rowHeights = rows.map((row) => Math.max(...row.map((b) => b.h)));
  const totalWidth = cols * BOX_W + (cols - 1) * GAP_X;
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + (rows.length - 1) * GAP_Y;

  const placed = [];
  let y = centerY - totalHeight / 2;
  for (let r = 0; r < rows.length; r += 1) {
    let x = centerX - totalWidth / 2;
    for (const box of rows[r]) {
      placed.push({ ...box, x, y });
      x += BOX_W + GAP_X;
    }
    y += rowHeights[r] + GAP_Y;
  }
  return placed;
}
