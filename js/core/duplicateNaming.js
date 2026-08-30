// Duplicating a component previously left an exact-name twin sitting right
// next to the original (two identical "Auth Service" boxes), so telling them
// apart meant a manual rename every single time. This computes the next
// distinct name the same way a file manager suggests "copy 2", "copy 3" —
// automatic, no AI/API call needed. Pure and DOM-free so it's unit-testable
// without canvas/canvas.js's store/DOM dependencies in the loop.

const TRAILING_NUMBER_RE = /^(.*) (\d+)$/;

/**
 * @param {string} baseName the name being duplicated (e.g. "Auth Service", or
 *   "Auth Service 2" if duplicating an already-incremented copy)
 * @param {string[]} existingNames every name currently in use — the result
 *   is guaranteed not to collide with any of these
 * @returns {string} e.g. "Auth Service 2", or "Auth Service 3" if "2" is taken
 */
export function nextDuplicateName(baseName, existingNames) {
  if (!baseName) return baseName;
  const used = new Set(existingNames);
  const match = baseName.match(TRAILING_NUMBER_RE);
  const stem = match ? match[1] : baseName;
  let n = match ? parseInt(match[2], 10) + 1 : 2;
  let candidate = `${stem} ${n}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${stem} ${n}`;
  }
  return candidate;
}
