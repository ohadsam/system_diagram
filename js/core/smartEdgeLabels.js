// A freshly-drawn connector always started with a blank label, leaving
// "what does this arrow mean" as yet another manual step on every single
// connection — even though the answer is very often predictable just from
// what the two ends *are* (a service reading from a database is "reads/
// writes", a service publishing onto a queue is "publishes to", etc).
// This guesses a sensible default from the two components' names/categories,
// the same curated-pairing spirit as data/index.js's `related`/`relatedLayers`
// Smart Suggestions — pure and DOM-free (defs are passed in, not looked up)
// so it's unit-testable without data/index.js or io/customComponents.js in
// the loop. Never overrides a label the user already typed or dragged in —
// see canvas/connectorInteractions.js, the only caller.

// Checked before the category-pair table below: a component's own *name*
// sometimes says more than its category does (a "Load Balancer" is still
// categoryId 'networking', same as a plain router, but only the former
// "routes to" whatever it's connected to).
// `whenFromMatches`/`whenToMatches` fire on the source/destination end
// respectively — kept as two separate fields (not one symmetric "matches
// either side") because which side a rule's own regex is *meant* to sit on
// isn't the same for every rule: a gateway is defined by being the source
// ("Load Balancer routes to X"), while a queue's two roles are opposite —
// something publishes *to* it (queue as destination) but the queue itself
// delivers *to* a consumer (queue as source) — so each phrasing only reads
// correctly attached to its own specific side.
const NAME_LABEL_RULES = [
  { re: /load balancer|api gateway|reverse proxy/i, whenFromMatches: 'routes to' },
  { re: /queue|kafka|sns|sqs|pub\/?sub|event bus/i, whenToMatches: 'publishes to', whenFromMatches: 'delivers to' },
];

const CATEGORY_PAIR_LABELS = {
  'client->backend-frameworks': 'calls',
  'client->servers': 'calls',
  'client->frontend-frameworks': 'renders',
  'client->security': 'authenticates via',
  'backend-frameworks->databases': 'reads/writes',
  'servers->databases': 'reads/writes',
  'backend-frameworks->storage': 'reads/writes',
  'servers->storage': 'reads/writes',
  'backend-frameworks->cache': 'reads/writes',
  'servers->cache': 'reads/writes',
  'backend-frameworks->security': 'authenticates via',
  'servers->security': 'authenticates via',
  'backend-frameworks->monitoring': 'reports to',
  'servers->monitoring': 'reports to',
  'backend-frameworks->logging': 'logs to',
  'servers->logging': 'logs to',
  'networking->backend-frameworks': 'routes to',
  'networking->servers': 'routes to',
  'networking->containers': 'routes to',
};

/**
 * @param {{name?: string, categoryId?: string}|null} fromDef
 * @param {{name?: string, categoryId?: string}|null} toDef
 * @returns {string|null} a suggested label, or null if nothing confidently applies
 */
export function suggestEdgeLabel(fromDef, toDef) {
  if (!fromDef || !toDef) return null;

  for (const rule of NAME_LABEL_RULES) {
    if (rule.whenFromMatches && rule.re.test(fromDef.name || '')) return rule.whenFromMatches;
    if (rule.whenToMatches && rule.re.test(toDef.name || '')) return rule.whenToMatches;
  }

  const key = `${fromDef.categoryId}->${toDef.categoryId}`;
  return CATEGORY_PAIR_LABELS[key] || null;
}
