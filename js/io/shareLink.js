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
