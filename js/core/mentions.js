// Lightweight "@mention" highlighting for comment/reply text — this app has
// no user accounts, so a mention can't resolve to a real person or notify
// anyone; it's purely a visual convenience for calling out a name/handle
// when discussing a diagram with teammates outside the app (e.g. "@Alice
// can you check this cache TTL?"). Pure/DOM-free so the splitting logic is
// unit-testable — modals/commentModal.js turns the result into actual
// text-node/span DOM (never innerHTML with dynamic content, per this app's
// security rule — see utils/dom.js's header comment).
const MENTION_RE = /@[A-Za-z0-9_][A-Za-z0-9_-]*/g;

/**
 * @param {string} text
 * @returns {{mention: boolean, text: string}[]} alternating plain-text and
 *   mention segments, in order, that concatenate back to the original text
 */
export function splitMentions(text) {
  const str = text || '';
  const segments = [];
  let lastIndex = 0;
  let match;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(str))) {
    if (match.index > lastIndex) segments.push({ mention: false, text: str.slice(lastIndex, match.index) });
    segments.push({ mention: true, text: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < str.length) segments.push({ mention: false, text: str.slice(lastIndex) });
  return segments;
}
