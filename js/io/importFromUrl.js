// Fetches a diagram JSON file from a URL the user pastes in, so community
// templates can be shared as a plain link/Gist with no backend of this
// app's own — the counterpart to io/shareLink.js's read-only encoded link
// (which carries the *whole diagram in the URL itself*, capped by URL
// length), for when the file already lives somewhere public instead. A
// `gist.github.com/...` URL is special-cased to GitHub's own read API
// (public gists need no auth) since fetching that page directly returns
// HTML, not the file's JSON content; any other URL is fetched as-is and
// expected to already be a raw JSON response (e.g. a GitHub "raw" link,
// or any static JSON file).
import { validateProject } from '../core/project.js';

const GIST_URL_RE = /^https?:\/\/gist\.github\.com\/[^/]+\/([0-9a-f]+)/i;

async function fetchGistText(gistId) {
  const res = await fetch(`https://api.github.com/gists/${gistId}`);
  if (!res.ok) throw new Error(`GitHub returned an error (${res.status}) looking up that Gist.`);
  const gist = await res.json();
  const files = Object.values(gist.files || {});
  if (!files.length) throw new Error('That Gist has no files in it.');
  const file = files.find((f) => f.filename?.toLowerCase().endsWith('.json')) || files[0];
  // A very large gist file comes back truncated from the summary endpoint —
  // its own raw_url always has the full content.
  if (file.truncated && file.raw_url) {
    const rawRes = await fetch(file.raw_url);
    return rawRes.text();
  }
  return file.content || '';
}

function describeFetchError(err) {
  if (err instanceof SyntaxError) return "That URL didn't return valid JSON.";
  if (err instanceof TypeError) {
    return "Could not reach that URL — it may not allow cross-origin requests (CORS). A GitHub raw file link or a Gist URL usually works.";
  }
  return err.message || 'Could not load that URL.';
}

/** @returns {Promise<{ok:true, project:object}|{ok:false, error:string}>} */
export async function fetchProjectFromUrl(rawUrl) {
  const url = (rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'Enter a valid http:// or https:// URL.' };
  try {
    const gistMatch = url.match(GIST_URL_RE);
    const text = gistMatch ? await fetchGistText(gistMatch[1]) : await (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`That URL returned an error (${res.status}).`);
      return res.text();
    })();
    if (!text.trim()) return { ok: false, error: "That URL's response was empty." };
    const parsed = JSON.parse(text);
    const result = validateProject(parsed);
    if (!result.ok) return { ok: false, error: `That JSON isn't a diagram this app understands: ${result.error}` };
    return result;
  } catch (err) {
    return { ok: false, error: describeFetchError(err) };
  }
}
