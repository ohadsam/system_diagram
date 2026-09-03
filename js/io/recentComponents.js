// "Recently Used" components — the last few component defIds actually
// placed on the canvas (see canvas.js#createNodeFromDrop, the single choke
// point both drag-from-sidebar and click-to-add go through), shown as a
// pinned sidebar section alongside Favorites. A thin, semantically-named
// wrapper around io/recentItems.js's generic 'components' scope — kept as
// its own module (rather than inlining the scope id at every call site) so
// canvas.js/sidebar.js read as domain code, not storage plumbing. The
// actual list length is user-configurable in Default Settings > "Recently
// Used" (io/recentItems.js#RECENT_SCOPES).
import { getRecentItemIds, recordItemUsed, onRecentItemsChange } from './recentItems.js';

const SCOPE = 'components';

export function getRecentComponentIds() {
  return getRecentItemIds(SCOPE);
}

/** Called once per real placement, not for every internal node-creation
 * path (pattern/layer/replication-mirror sub-nodes aren't "you chose this
 * component from the sidebar" in the same sense). */
export function recordComponentUsed(defId) {
  recordItemUsed(SCOPE, defId);
}

export function onRecentComponentsChange(fn) {
  return onRecentItemsChange(SCOPE, fn);
}
