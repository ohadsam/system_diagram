// Full-project JSON export/import as a downloadable/uploadable file.
import { validateProject } from '../core/project.js';
import { downloadJSON, sanitizeFilename } from '../utils/download.js';

export function exportProjectToFile(project) {
  downloadJSON(project, `${sanitizeFilename(project.name)}.json`);
}

/** @returns {Promise<{ok:true, project:object}|{ok:false, error:string}>} */
export function parseProjectFile(text) {
  try {
    const parsed = JSON.parse(text);
    return validateProject(parsed);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err.message}` };
  }
}

/** Opens a native file picker and resolves with the chosen file's text, or null if cancelled. */
export function pickJSONFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    input.click();
  });
}

// A generous cap on the *encoded* data URL a custom node icon can carry —
// large enough for any reasonably-sized icon/logo, small enough that a
// project full of them still saves fine to localStorage (see
// io/storage.js's quota handling) and isn't a silent bloat trap.
const MAX_ICON_IMAGE_DATA_URL_LENGTH = 700000; // ~500KB of raw image data, base64-encoded

/** Opens a native file picker for an image (raster or SVG) and resolves
 * with its contents as a data URL — the format canvas/node.js#buildIconEl
 * and core/project.js's `node.iconImage` field expect — or an error string
 * if cancelled, unreadable, or over the size cap.
 * @returns {Promise<{ok:true, dataUrl:string}|{ok:false, error:string}|null>} null means the user cancelled
 */
export function pickImageFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.svg';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        if (dataUrl.length > MAX_ICON_IMAGE_DATA_URL_LENGTH) {
          resolve({ ok: false, error: 'That image is too large — please use one under ~500KB.' });
          return;
        }
        resolve({ ok: true, dataUrl });
      };
      reader.onerror = () => resolve({ ok: false, error: 'Could not read that file.' });
      reader.readAsDataURL(file);
    });
    document.body.appendChild(input);
    input.click();
  });
}
