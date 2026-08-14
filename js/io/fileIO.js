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
