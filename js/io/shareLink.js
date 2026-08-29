// A read-only-in-spirit "share link" — the whole project JSON, gzip-
// compressed (native CompressionStream/DecompressionStream — no bundled
// dependency) and base64url-encoded into the URL's hash fragment. 100%
// client-side: there's no backend to host anything, so "sharing" just means
// handing someone a URL whose hash *is* the diagram. Opening it loads a
// local copy into their own browser (main.js#boot) — it's "read-only" only
// in that it doesn't sync back to the sender, not because it's locked; the
// recipient can freely edit their local copy same as any other diagram.
import { validateProject } from '../core/project.js';

const HASH_PREFIX = '#share=';
// Matches a share link's hash whether it's pasted bare (just the hash) or
// embedded in a full URL (e.g. an AI CLI tool prints "open this link:
// https://.../index.html#share=H4sI...") — see findShareHashInText below.
const SHARE_HASH_RE = /#share=[A-Za-z0-9_-]+/;

function toBase64Url(buf) {
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** @param {object} project @returns {Promise<string>} a full URL whose hash encodes it. */
export async function buildShareUrl(project) {
  const json = JSON.stringify(project);
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressed = await new Response(stream).arrayBuffer();
  return `${location.origin}${location.pathname}${HASH_PREFIX}${toBase64Url(compressed)}`;
}

/** Pure text scan (no decoding) — pulls a `#share=...` hash out of arbitrary
 * pasted text, whether it's the bare hash or embedded in a full URL. Lets
 * any "paste the AI's result" box (modals/generateDesignModal.js,
 * modals/quickStartModal.js) accept a share link exactly the same way it
 * already accepts raw JSON: an AI CLI tool that built a share link (see
 * docs/AI_INTEGRATION.md) but can't literally open a browser tab itself
 * just prints the link for the user to paste back, same gesture either way.
 * @param {string} text @returns {string|null} the matched "#share=..." hash, or null. */
export function findShareHashInText(text) {
  if (!text) return null;
  const match = text.match(SHARE_HASH_RE);
  return match ? match[0] : null;
}

/** @param {string} hash `location.hash`, e.g. "#share=..."
 * @returns {Promise<object|null>} the decoded, validated project, or null
 *   if `hash` isn't a share link or fails to decode/validate — main.js
 *   falls back to the normal autosave-restore path either way. */
export async function loadProjectFromHash(hash) {
  if (!hash || !hash.startsWith(HASH_PREFIX)) return null;
  try {
    const compressed = fromBase64Url(hash.slice(HASH_PREFIX.length));
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const json = await new Response(stream).text();
    const { ok, project } = validateProject(JSON.parse(json));
    return ok ? project : null;
  } catch {
    return null;
  }
}
