// Vector SVG export — the one export format PNG/PDF (html2canvas-based,
// see exportImage.js) can't offer: infinite zoom with no quality loss, and
// a file a downstream vector tool can still edit. Unlike the PNG/PDF
// exporters, this never touches the *live* page: it deep-clones
// `.canvas-content` (nodes are plain HTML, edges are already real SVG —
// see canvas/canvas.js#initCanvas), wraps the clone in a <foreignObject>,
// and embeds this app's own CSS (concrete resolved values for every
// `--custom-property` it uses, since a saved standalone .svg file becomes
// its own document when reopened — `:root` there means the exported <svg>
// itself, not this page's <html>, so a copy-pasted selector-based dark-mode
// override wouldn't reliably re-match; a flat, already-resolved block does).
// Best-effort, like every other export here — a very unusual custom icon
// or font may not round-trip into every downstream tool perfectly.
import { getContentBounds, getNodesBounds, hideExcept, getSequenceDiagramGroups } from '../canvas/canvas.js';
import { downloadBlob, sanitizeFilename } from '../utils/download.js';

const PADDING = 48;
const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

function collectStylesheetText() {
  const parts = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) parts.push(rule.cssText);
    } catch {
      // A cross-origin stylesheet's cssRules throws (SecurityError) — this
      // app serves its own CSS same-origin, so this only ever skips
      // something we never needed (e.g. a browser extension's injected sheet).
    }
  }
  return parts.join('\n');
}

/** Every distinct `--custom-property` name referenced anywhere in the
 * page's stylesheets, resolved to its live value right now (so it already
 * reflects whichever theme — light/dark/a diagram color theme — is
 * currently applied) — see this file's header comment for why a flat
 * `:root { ... }` block of concrete values travels more reliably than the
 * selector-based rules it was computed from. */
function collectResolvedRootVariables() {
  const names = new Set();
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const style = rule.style;
        if (!style) continue;
        for (let i = 0; i < style.length; i += 1) {
          const prop = style[i];
          if (prop.startsWith('--')) names.add(prop);
        }
      }
    } catch {
      /* cross-origin sheet — see collectStylesheetText */
    }
  }
  const computed = getComputedStyle(document.documentElement);
  const declarations = [];
  for (const name of names) {
    const value = computed.getPropertyValue(name).trim();
    if (value) declarations.push(`${name}: ${value};`);
  }
  return `:root { ${declarations.join(' ')} }`;
}

/** Deep-clones `.canvas-content` for the given bounds, dropping the
 * edit-only overlay layers (selection/reconnect handles, alignment guides,
 * animation order badges — affordances for editing, not part of a
 * shareable diagram) — mirrors exportImage.js's `hideExcept` for isolating
 * one sequence-diagram group, but on a detached clone: the live page is
 * never touched, so there's nothing to restore afterward for the clone
 * itself (hideExcept's own live-DOM toggle is still restored in a
 * `finally`, same as the PNG exporter). */
function buildContentClone(bounds, nodeIds) {
  const restoreVisibility = nodeIds ? hideExcept(nodeIds) : null;
  let clone;
  try {
    clone = document.querySelector('.canvas-content').cloneNode(true);
  } finally {
    restoreVisibility?.();
  }
  clone.querySelectorAll('.edge-handle-layer, .align-guide-layer, .anim-badge-layer').forEach((n) => n.remove());
  const dx = Math.round(-bounds.x + PADDING);
  const dy = Math.round(-bounds.y + PADDING);
  clone.style.transform = `translate(${dx}px, ${dy}px)`;
  clone.style.transformOrigin = '0 0';
  return clone;
}

function serializeSvg(clone, width, height) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('xmlns:xhtml', XHTML_NS);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', '100%');
  bg.setAttribute('height', '100%');
  bg.setAttribute('fill', '#ffffff');
  svg.appendChild(bg);

  const defs = document.createElementNS(SVG_NS, 'defs');
  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = `${collectResolvedRootVariables()}\n${collectStylesheetText()}`;
  defs.appendChild(style);
  svg.appendChild(defs);

  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  fo.setAttribute('x', '0');
  fo.setAttribute('y', '0');
  fo.setAttribute('width', String(width));
  fo.setAttribute('height', String(height));
  const host = document.createElementNS(XHTML_NS, 'div');
  host.setAttribute('style', `width:${width}px;height:${height}px;overflow:hidden;position:relative;`);
  host.appendChild(clone);
  fo.appendChild(host);
  svg.appendChild(fo);

  return new XMLSerializer().serializeToString(svg);
}

/** One SVG string for the given bounds/nodeIds, or null if there's nothing
 * to export (mirrors exportImage.js#captureDiagramCanvas's contract). */
function buildSvgString({ nodeIds } = {}) {
  const bounds = nodeIds ? getNodesBounds(nodeIds) : getContentBounds();
  if (!bounds) return null;
  const width = Math.max(1, Math.round(bounds.w + PADDING * 2));
  const height = Math.max(1, Math.round(bounds.h + PADDING * 2));
  const clone = buildContentClone(bounds, nodeIds);
  return serializeSvg(clone, width, height);
}

function downloadSvgString(svgText, filename) {
  downloadBlob(new Blob([svgText], { type: 'image/svg+xml' }), filename);
}

/** Exports the main diagram as one SVG, plus one additional SVG per
 * sequence-diagram group — same "main export + one per group" shape as
 * exportImage.js#exportPNG. */
export async function exportSVG(projectName) {
  const svg = buildSvgString();
  if (!svg) return { ok: false, error: 'Nothing to export yet — add some components first.' };
  const baseName = sanitizeFilename(projectName);
  downloadSvgString(svg, `${baseName}.svg`);

  const groups = getSequenceDiagramGroups();
  let i = 0;
  for (const group of groups) {
    i += 1;
    const groupSvg = buildSvgString({ nodeIds: group.nodes.map((n) => n.id) });
    if (!groupSvg) continue;
    const suffix = group.label ? sanitizeFilename(group.label) : `sequence-diagram-${i}`;
    downloadSvgString(groupSvg, `${baseName} - ${suffix}.svg`);
  }
  return { ok: true };
}
