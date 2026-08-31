// Pure text-wrapping helpers for on-canvas edge labels. SVG `<text>` has no
// native wrapping the way an HTML element with `overflow-wrap` does (see
// css/node.css's `.node-label` for that side of the app) — a long label
// (e.g. a sequence-diagram message like "verify code_verifier matches
// challenge") renders as one long single-line string that overlaps its
// neighbors, especially between narrow lifeline columns. This estimates
// (rather than measures live, which would need a DOM/canvas context this
// module deliberately stays free of) how many characters fit per line and
// wraps at word boundaries, mirroring the same "pure, DOM-free, unit-
// testable" shape as core/sequenceDiagram.js.
const AVG_CHAR_WIDTH_PX = 6.2; // ~11px bold-ish sans-serif — matches css/connector.css's .edge-label font-size
export const DEFAULT_LABEL_MAX_WIDTH = 150;

export function estimateTextWidth(text) {
  return (text || '').length * AVG_CHAR_WIDTH_PX;
}

/** Wraps `text` into lines of roughly `maxWidthPx` each, breaking only at
 * whitespace (never mid-word) — a single word longer than the whole budget
 * still gets its own line rather than being cut. Returns `[]` for empty
 * text, `[text]` unchanged if it already fits on one line. */
export function wrapLabelLines(text, maxWidthPx = DEFAULT_LABEL_MAX_WIDTH) {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  const maxChars = Math.max(4, Math.floor(maxWidthPx / AVG_CHAR_WIDTH_PX));
  if (trimmed.length <= maxChars) return [trimmed];

  const words = trimmed.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** The rendered block's own {width, height, lines} for a wrapped label —
 * `lineHeightPx` should match whatever the caller actually renders each
 * line at (connector.js's tspan `dy`). Used wherever something needs to
 * reserve enough room for the label rather than just draw it (see
 * core/labelSpacing.js and core/sequenceDiagram.js#widenLifelinesForLabels). */
export function estimateWrappedBlockSize(text, maxWidthPx = DEFAULT_LABEL_MAX_WIDTH, lineHeightPx = 12) {
  const lines = wrapLabelLines(text, maxWidthPx);
  if (!lines.length) return { width: 0, height: 0, lines };
  const width = Math.max(...lines.map((l) => estimateTextWidth(l)));
  return { width, height: lines.length * lineHeightPx, lines };
}
