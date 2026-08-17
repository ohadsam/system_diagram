// Full-project backup: bundles the live canvas, global default settings,
// the "My Components" library and every saved project into one JSON file,
// and restores all of it back in one shot.
import * as store from '../core/store.js';
import { validateProject } from '../core/project.js';
import { downloadJSON } from '../utils/download.js';
import { getNodeDefaults, saveNodeDefaults } from './nodeDefaults.js';
import { getCustomComponents, importCustomComponents } from './customComponents.js';
import { getRawSavedProjects, importSavedProjectsBundle } from './projects.js';
import { getFavoriteFolders, getFavorites, importFavoritesBundle } from './favorites.js';

export function exportFullBackup() {
  const backup = {
    formatVersion: 1,
    kind: 'sdb-full-backup',
    exportedAt: new Date().toISOString(),
    currentProject: store.getState(),
    nodeDefaults: getNodeDefaults(),
    customComponents: getCustomComponents(),
    savedProjects: getRawSavedProjects(),
    favoriteFolders: getFavoriteFolders(),
    favorites: getFavorites(),
  };
  downloadJSON(backup, 'system-diagram-backup.json');
}

/**
 * Restore a full backup: replaces the live canvas, merges the custom
 * components library and saved-projects library (see their own
 * collision-handling rules), and overwrites the global default settings.
 * Never throws.
 */
export function importFullBackupFile(parsed) {
  if (!parsed || parsed.kind !== 'sdb-full-backup') return { ok: false, error: 'Not a valid full-backup file' };

  let loadedProject = false;
  if (parsed.currentProject) {
    const result = validateProject(parsed.currentProject);
    if (result.ok) { store.loadProject(result.project); loadedProject = true; }
  }

  if (parsed.nodeDefaults && typeof parsed.nodeDefaults === 'object') {
    saveNodeDefaults(parsed.nodeDefaults);
  }

  const componentsResult = Array.isArray(parsed.customComponents)
    ? importCustomComponents({ components: parsed.customComponents })
    : { imported: 0 };
  const projectsResult = Array.isArray(parsed.savedProjects)
    ? importSavedProjectsBundle({ projects: parsed.savedProjects })
    : { imported: 0 };
  const favoritesResult = (parsed.favoriteFolders || parsed.favorites)
    ? importFavoritesBundle(parsed.favoriteFolders, parsed.favorites)
    : { importedFolders: 0, importedFavorites: 0 };

  return {
    ok: true,
    loadedProject,
    importedComponents: componentsResult.imported || 0,
    importedProjects: projectsResult.imported || 0,
    importedFavorites: favoritesResult.importedFavorites || 0,
  };
}
