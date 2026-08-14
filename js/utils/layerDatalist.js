// Shared, lazily-built <datalist> of every "layer" name (Controller,
// Service, DAL, React Hook, ...) so any sub-component name field in the app
// (details panel, custom component modal) gets the same native-browser
// autocomplete, matched against data/categories/layers.js.
import { el } from './dom.js';
import { getLayerComponents } from '../data/index.js';

export const LAYER_DATALIST_ID = 'layer-name-suggestions';

export function ensureLayerDatalist() {
  if (document.getElementById(LAYER_DATALIST_ID)) return;
  const datalist = el('datalist', { id: LAYER_DATALIST_ID });
  for (const layer of getLayerComponents()) {
    datalist.appendChild(el('option', { value: layer.name }));
  }
  document.body.appendChild(datalist);
}

/** The layer def whose name exactly matches `name`, or null. */
export function findLayerByName(name) {
  return getLayerComponents().find((layer) => layer.name === name) || null;
}
