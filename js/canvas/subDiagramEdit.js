// "Edit" flow for a sequence-diagram drill-down group (see
// modals/subDiagramModal.js) — the default zoom-in view is read-only, this
// is the escape hatch it offers for actually changing something. Reuses the
// *entire* existing canvas/store/undo machinery instead of building a
// second parallel mini-editor: the group's own nodes+edges are temporarily
// swapped in as the whole active project (everything else is stashed),
// the real canvas renders and edits them completely normally, and a fixed
// banner overlay is the only thing that makes it read as "you're editing a
// sub-diagram" rather than the main canvas. "Done" merges the (possibly
// edited/added/deleted) subset back into the stashed parent project.
//
// Known limitation (documented, not engineered around — see
// docs/ARCHITECTURE.md): using New/Load Project/Import while a sub-diagram
// edit is in progress abandons the stashed parent project when "Done" is
// later clicked, since at that point `store.getState()` no longer holds the
// group's content at all. The banner's wording steers away from this rather
// than the toolbar being specially disabled during the edit session, which
// would need touching many more call sites for a narrow, avoidable case.
import * as store from '../core/store.js';
import { el } from '../utils/dom.js';
import { showToast } from '../utils/toast.js';

let editState = null; // { groupId, parentProject }
let bannerEl = null;

export function isEditingSubDiagram() {
  return !!editState;
}

export function enterSubDiagramEdit(groupId) {
  if (editState) return;
  const full = store.getState();
  const memberIds = new Set(full.nodes.filter((n) => n.groupId === groupId).map((n) => n.id));
  if (!memberIds.size) {
    showToast('This sequence diagram no longer exists.', 'error', 2400);
    return;
  }

  const subsetNodes = full.nodes.filter((n) => memberIds.has(n.id));
  const subsetEdges = full.edges.filter((e) => memberIds.has(e.from) && memberIds.has(e.to));
  const otherNodes = full.nodes.filter((n) => !memberIds.has(n.id));
  const otherEdges = full.edges.filter((e) => !memberIds.has(e.from) || !memberIds.has(e.to));

  editState = { groupId, parentProject: full, otherNodes, otherEdges };

  store.loadProject({
    ...full,
    nodes: subsetNodes,
    edges: subsetEdges,
    // The sync engine has nothing useful to do scoped to just this one
    // group, and re-including the full replicationPairs list here would
    // have it try to reconcile pairs whose *other* side was just stashed
    // away — dropped for the duration of the edit, restored untouched by
    // exitSubDiagramEdit below (the parent project's own copy, not this
    // one, wins on merge-back).
    replicationPairs: [],
  });
  showEditBanner();
}

function exitSubDiagramEdit() {
  if (!editState) return;
  const { parentProject, otherNodes, otherEdges, groupId } = editState;
  const edited = store.getState();
  // A brand-new node created during the edit has no groupId at all (see
  // core/project.js#createNode's default) — without this it would silently
  // fall out of the sequence diagram group on merge-back even though it was
  // drawn right there in the group's own editing session.
  const mergedNodes = [
    ...otherNodes,
    ...edited.nodes.map((n) => (n.groupId ? n : { ...n, groupId })),
  ];
  const mergedEdges = [...otherEdges, ...edited.edges];

  store.loadProject({ ...parentProject, nodes: mergedNodes, edges: mergedEdges });
  editState = null;
  hideEditBanner();
  showToast('Saved changes to the sequence diagram.', 'success', 2000);
}

function showEditBanner() {
  bannerEl = el('div', { class: 'subdiagram-edit-banner' });
  bannerEl.appendChild(el('span', {
    class: 'subdiagram-edit-banner-text',
    text: '✏️ Editing this sequence diagram on its own — avoid New/Load/Import until you\'re done.',
  }));
  bannerEl.appendChild(el('button', {
    type: 'button', class: 'btn btn-primary', text: '✅ Done editing', onClick: exitSubDiagramEdit,
  }));
  document.body.appendChild(bannerEl);
}

function hideEditBanner() {
  bannerEl?.remove();
  bannerEl = null;
}
