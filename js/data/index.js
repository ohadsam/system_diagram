// Aggregates every category module into the searchable component library.
// To add a category: create js/data/categories/<name>.js exporting
// { category, components } and add one import + entry below.
import * as aiMl from './categories/ai-ml.js';
import * as aiProvidersAgents from './categories/ai-providers-agents.js';
import * as aws from './categories/aws.js';
import * as backendFrameworks from './categories/backend-frameworks.js';
import * as cache from './categories/cache.js';
import * as client from './categories/client.js';
import * as cloudProviders from './categories/cloud-providers.js';
import * as containers from './categories/containers.js';
import * as databases from './categories/databases.js';
import * as designPatterns from './categories/design-patterns.js';
import * as devops from './categories/devops.js';
import * as frontendFrameworks from './categories/frontend-frameworks.js';
import * as layers from './categories/layers.js';
import * as logging from './categories/logging.js';
import * as messaging from './categories/messaging.js';
import * as misc from './categories/misc.js';
import * as monitoring from './categories/monitoring.js';
import * as networking from './categories/networking.js';
import * as security from './categories/security.js';
import * as servers from './categories/servers.js';
import * as shapes from './categories/shapes.js';
import * as storage from './categories/storage.js';

const MODULES = [
  aiMl, aiProvidersAgents, aws, backendFrameworks, cache, client, cloudProviders,
  containers, databases, designPatterns, devops, frontendFrameworks, layers, logging,
  messaging, misc, monitoring, networking, security, servers, shapes, storage,
];

function build() {
  const categories = [];
  const componentsByCategory = new Map();
  const allComponents = [];
  const seenIds = new Set();

  for (const mod of MODULES) {
    const sortedComponents = [...mod.components].sort((a, b) => a.name.localeCompare(b.name));
    for (const comp of sortedComponents) {
      if (seenIds.has(comp.id)) {
        throw new Error(`Duplicate component id "${comp.id}" in category "${mod.category.id}"`);
      }
      seenIds.add(comp.id);
      allComponents.push({ ...comp, categoryId: mod.category.id });
    }
    categories.push(mod.category);
    componentsByCategory.set(mod.category.id, sortedComponents);
  }

  categories.sort((a, b) => a.label.localeCompare(b.label));

  return { categories, componentsByCategory, allComponents };
}

const { categories, componentsByCategory, allComponents } = build();

export const CATEGORIES = categories;
export const COMPONENTS_BY_CATEGORY = componentsByCategory;
export const ALL_COMPONENTS = allComponents;

export function getComponentById(id) {
  return ALL_COMPONENTS.find((comp) => comp.id === id) || null;
}

export function getComponentsForCategory(categoryId) {
  return COMPONENTS_BY_CATEGORY.get(categoryId) || [];
}

/** All "layer" components (see categories/layers.js), used by the details
 * panel's sub-component autocomplete and by drag-onto-node attachment. */
export function getLayerComponents() {
  return ALL_COMPONENTS.filter((comp) => comp.kind === 'layer');
}
