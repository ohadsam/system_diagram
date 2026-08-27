// Aggregates every category module into the searchable component library.
// To add a category: create js/data/categories/<name>.js exporting
// { category, components } and add one import + entry below.
import * as aiMl from './categories/ai-ml.js';
import * as aiProvidersAgents from './categories/ai-providers-agents.js';
import * as aws from './categories/aws.js';
import * as backendFrameworks from './categories/backend-frameworks.js';
import * as bpmn from './categories/bpmn.js';
import * as c4Model from './categories/c4-model.js';
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
import * as referenceArchitectures from './categories/reference-architectures.js';
import * as security from './categories/security.js';
import * as sequenceTemplates from './categories/sequence-templates.js';
import * as servers from './categories/servers.js';
import * as shapes from './categories/shapes.js';
import * as stateMachines from './categories/state-machines.js';
import * as storage from './categories/storage.js';
import * as umlDeployment from './categories/uml-deployment.js';

const MODULES = [
  aiMl, aiProvidersAgents, aws, backendFrameworks, bpmn, c4Model, cache, client, cloudProviders,
  containers, databases, designPatterns, devops, frontendFrameworks, layers, logging,
  messaging, misc, monitoring, networking, referenceArchitectures, security, sequenceTemplates, servers, shapes, stateMachines, storage, umlDeployment,
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

/** Resolves a component's curated `related` ids (see schema.js#c) to their
 * actual definitions, for the canvas "Smart Suggestions" banner (see
 * canvas/suggestions.js) — silently drops any id that doesn't resolve
 * (e.g. a custom component was since deleted) rather than surfacing a
 * broken suggestion. */
export function getRelatedComponents(id) {
  const def = getComponentById(id);
  if (!def?.related?.length) return [];
  return def.related.map((relId) => getComponentById(relId)).filter(Boolean);
}

/** Resolves a component's curated `relatedLayers` ids (see schema.js#c) to
 * their actual `kind: 'layer'` definitions, for the "Smart Suggestions"
 * banner's "attach as sub-component" row (see canvas/suggestions.js) —
 * silently drops any id that doesn't resolve or isn't actually a layer,
 * same defensive spirit as getRelatedComponents. */
export function getRelatedLayers(id) {
  const def = getComponentById(id);
  if (!def?.relatedLayers?.length) return [];
  return def.relatedLayers.map((relId) => getComponentById(relId)).filter((d) => d?.kind === 'layer');
}

/** Resolves a component's curated `relatedPatterns` ids (see schema.js#c) to
 * their actual `kind: 'pattern'` definitions, for the "Smart Suggestions"
 * banner's "instantiate this sequence diagram nearby" row (see
 * canvas/suggestions.js) — e.g. placing an "Auth Server" suggests the
 * "PKCE Authorization Flow" template. Same defensive drop-unresolvable
 * spirit as getRelatedComponents/getRelatedLayers. */
export function getRelatedPatterns(id) {
  const def = getComponentById(id);
  if (!def?.relatedPatterns?.length) return [];
  return def.relatedPatterns.map((relId) => getComponentById(relId)).filter((d) => d?.kind === 'pattern');
}
