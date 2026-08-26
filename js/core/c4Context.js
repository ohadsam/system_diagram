// Pure layout math for the "C4 Context Diagram" wizard (see
// modals/c4ContextModal.js): turns a system name + a flat list of person/
// external-system entries into a simple, readable C4 System Context layout
// — the system centered, people in a row above it, external systems in a
// row below it, each connected to the central system by an edge. No DOM/
// store access — see canvas/canvas.js#createC4ContextDiagram for where the
// result becomes real nodes/edges. Deliberately only builds a Context
// diagram (the most common C4 starting point); a Container/Component
// diagram is built the same way as any other diagram — drag the "Container"
// / "Component" shapes from the C4 Model sidebar category and connect them.
const ROW_GAP = 220;
const V_GAP = 180;

/**
 * @param {string} systemName label for the central system box
 * @param {string[]} people person/actor names, left-to-right above the system
 * @param {string[]} externalSystems external system names, left-to-right below the system
 * @param {number} centerX canvas-space x to center everything on
 * @param {number} centerY canvas-space y for the central system box
 * @param {{w:number,h:number}} size box size shared by every node
 * @returns {{system:{text:string,x:number,y:number,w:number,h:number}, people:object[], externalSystems:object[]}}
 */
export function layoutC4Context(systemName, people, externalSystems, centerX, centerY, size) {
  const row = (names, y) => {
    const totalWidth = names.length > 0 ? (names.length - 1) * ROW_GAP + size.w : size.w;
    const startX = centerX - totalWidth / 2;
    return names.map((text, i) => ({ text, x: startX + i * ROW_GAP, y, w: size.w, h: size.h }));
  };

  return {
    system: { text: systemName, x: centerX - size.w / 2, y: centerY, w: size.w, h: size.h },
    people: row(people, centerY - V_GAP - size.h),
    externalSystems: row(externalSystems, centerY + V_GAP + size.h),
  };
}
