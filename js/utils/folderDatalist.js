// Shared, lazily-rebuilt <datalist> of existing "My Components" folder
// names, so the New/Edit Component modal's folder field gets native
// autocomplete without retyping folder names.
import { el, clear } from './dom.js';
import { getCustomComponentFolders } from '../io/customComponents.js';

export const FOLDER_DATALIST_ID = 'custom-component-folder-suggestions';

export function ensureFolderDatalist() {
  let datalist = document.getElementById(FOLDER_DATALIST_ID);
  if (!datalist) {
    datalist = el('datalist', { id: FOLDER_DATALIST_ID });
    document.body.appendChild(datalist);
  }
  clear(datalist);
  for (const folder of getCustomComponentFolders()) {
    datalist.appendChild(el('option', { value: folder }));
  }
}
