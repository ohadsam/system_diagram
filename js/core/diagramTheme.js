// Pure recolor logic for "🎨 Diagram Theme" (see canvas.js#applyDiagramTheme)
// — a permanent, undoable, diagram-wide restyle, the same category of
// action as core/scaleDiagram.js's "Scale Diagram". Only node stroke/fill
// are touched; edges stay whatever neutral color they already were (arrows
// conventionally read as structure, not category, in most diagramming
// tools, and leaving them alone also means a theme swap never has to guess
// which edges were deliberately hand-colored vs. left at the default).
import { tint } from '../data/schema.js';

export const DIAGRAM_THEMES = {
  ocean: { label: 'Ocean', colors: ['#0369A1', '#0891B2', '#0D9488', '#1D4ED8', '#0E7490', '#075985', '#0284C7', '#155E75'] },
  sunset: { label: 'Sunset', colors: ['#EA580C', '#DB2777', '#C026D3', '#D97706', '#DC2626', '#E11D48', '#F59E0B', '#BE185D'] },
  forest: { label: 'Forest', colors: ['#15803D', '#4D7C0F', '#65A30D', '#166534', '#059669', '#3F6212', '#047857', '#365314'] },
  monochrome: { label: 'Monochrome', colors: ['#1E293B', '#334155', '#475569', '#0F172A', '#64748B', '#1F2937', '#374151', '#4B5563'] },
  pastel: { label: 'Pastel', colors: ['#7C9CBF', '#B08BBF', '#7FBF9E', '#BF9B7F', '#BF7F9B', '#9BBF7F', '#7FA8BF', '#BFA87F'] },
};

/**
 * Recolors every node to a chosen theme's palette. Every node currently
 * sharing the same `stroke` gets mapped to the *same* new color (assigned
 * in first-seen order, cycling through the palette if there are more
 * distinct original colors than palette entries) — so components that
 * already read as one visual "group" (e.g. every AWS-category box sharing
 * AWS's orange) keep reading as a group afterward, just in the new theme's
 * hue, rather than each node landing on an independent, uncoordinated color.
 * A node with `fill: 'transparent'` ("No background" in the style editor)
 * keeps that — recoloring a fill that was deliberately turned off would be
 * surprising. Returns new node objects; the input array is untouched.
 */
export function applyDiagramTheme(nodes, themeKey) {
  const theme = DIAGRAM_THEMES[themeKey];
  if (!theme) return nodes;

  const colorMap = new Map();
  let nextIndex = 0;
  const nextColor = (original) => {
    if (!colorMap.has(original)) {
      colorMap.set(original, theme.colors[nextIndex % theme.colors.length]);
      nextIndex += 1;
    }
    return colorMap.get(original);
  };

  return nodes.map((n) => {
    const stroke = nextColor(n.stroke);
    return { ...n, stroke, fill: n.fill === 'transparent' ? n.fill : tint(stroke) };
  });
}
