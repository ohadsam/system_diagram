// Pure layout math for the "Sequence Diagram" wizard (see
// modals/sequenceDiagramModal.js): turns a flat list of participant names
// into evenly-spaced lifeline rects, centered on a given point. No DOM/store
// access — see canvas/canvas.js#createSequenceDiagram for where the result
// actually becomes real nodes.
const GAP = 220;

/**
 * @param {string[]} names participant names, in left-to-right order
 * @param {number} centerX canvas-space x to center the whole row on
 * @param {number} centerY canvas-space y for the top of every lifeline
 * @param {{w:number,h:number}} size each lifeline's size
 * @returns {{text:string, x:number, y:number, w:number, h:number}[]}
 */
export function layoutLifelines(names, centerX, centerY, size) {
  const totalWidth = names.length > 0 ? (names.length - 1) * GAP + size.w : size.w;
  const startX = centerX - totalWidth / 2;
  return names.map((text, i) => ({
    text,
    x: startX + i * GAP,
    y: centerY,
    w: size.w,
    h: size.h,
  }));
}
