// Converts the whole canvas into draw.io / diagrams.net's mxGraph XML —
// downloadable as a .drawio file and opened there via File > Open File...
// (or dragged straight onto the app.diagrams.net canvas). A third export
// format alongside io/exportFlowchartMermaid.js, offered together in
// modals/exportDiagramModal.js. Pure/DOM-free. Best-effort: draw.io's
// shape library doesn't have a 1:1 match for every shape this app has
// (lifeline, note, rows), so those fall back to the closest built-in
// draw.io shape rather than a broken/missing one. Reused as-is for a
// "Lucidchart-compatible" download too, since Lucidchart's own importer
// accepts draw.io XML.
function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** mxGraph style string for a node's shape — see
 * https://www.drawio.com/doc/faq/shape-styles for the vocabulary. Falls
 * back to a plain rectangle for shapes draw.io has no equivalent for
 * (note/rows/lifeline) rather than an invalid or missing style. */
function shapeStyle(node) {
  switch (node.shape) {
    case 'rounded': return 'rounded=1;whiteSpace=wrap;html=1;';
    case 'circle': return 'ellipse;whiteSpace=wrap;html=1;';
    case 'diamond': return 'rhombus;whiteSpace=wrap;html=1;';
    case 'cylinder': return 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;';
    case 'hexagon': return 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;';
    case 'cloud': return 'ellipse;shape=cloud;whiteSpace=wrap;html=1;';
    case 'note': return 'shape=note;whiteSpace=wrap;html=1;';
    default: return 'rounded=0;whiteSpace=wrap;html=1;'; // rect, rows, lifeline
  }
}

const ARROW_STYLE = { none: 'none', open: 'open', filled: 'classic' };

function edgeStyle(edge) {
  const parts = ['html=1;'];
  if (edge.routing === 'orthogonal' || edge.routing === 'magic') parts.push('edgeStyle=orthogonalEdgeStyle;');
  else if (edge.routing === 'curved') parts.push('curved=1;');
  if (edge.dash === 'dashed' || edge.dash === 'dotted') parts.push('dashed=1;');
  parts.push(`startArrow=${ARROW_STYLE[edge.startArrow] || 'none'};`);
  parts.push(`endArrow=${ARROW_STYLE[edge.endArrow] || 'classic'};`);
  parts.push(`strokeColor=${edge.color || '#334155'};`);
  return parts.join('');
}

function nodeLabel(node) {
  const parts = node.rows?.length ? [node.text, ...node.rows].filter(Boolean) : [node.text];
  return esc((parts.join('<br>') || 'Component'));
}

/**
 * @param {{nodes: object[], edges: object[]}} diagram the whole canvas.
 * @returns {string} mxGraph XML, ready to save as a .drawio/.xml file.
 */
export function buildDrawIOXml({ nodes, edges }) {
  const idFor = new Map();
  nodes.forEach((n, i) => idFor.set(n.id, `node${i + 1}`));

  const cells = [
    '<mxCell id="0" />',
    '<mxCell id="1" parent="0" />',
  ];

  nodes.forEach((n) => {
    const id = idFor.get(n.id);
    const style = `${shapeStyle(n)}fillColor=${esc(n.fill || '#FFFFFF')};strokeColor=${esc(n.stroke || '#4F46E5')};`;
    cells.push(
      `<mxCell id="${id}" value="${nodeLabel(n)}" style="${esc(style)}" vertex="1" parent="1">` +
      `<mxGeometry x="${Math.round(n.x)}" y="${Math.round(n.y)}" width="${Math.round(n.w)}" height="${Math.round(n.h)}" as="geometry" /></mxCell>`
    );
  });

  edges.forEach((e, i) => {
    const source = idFor.get(e.from);
    const target = idFor.get(e.to);
    if (!source || !target) return;
    const value = e.label ? ` value="${esc(e.label)}"` : '';
    cells.push(
      `<mxCell id="edge${i + 1}"${value} style="${esc(edgeStyle(e))}" edge="1" parent="1" source="${source}" target="${target}">` +
      '<mxGeometry relative="1" as="geometry" /></mxCell>'
    );
  });

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">\n' +
    `  <root>\n    ${cells.join('\n    ')}\n  </root>\n` +
    '</mxGraphModel>\n'
  );
}
