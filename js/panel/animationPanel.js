// Right slide-in "Diagram Animation" panel — build/edit any number of named,
// independently-playable reveal sequences, each played back by
// core/animationPlayback.js (see canvas.js's animation actions and
// docs/ARCHITECTURE.md's "Diagram Animation" section). Structurally mirrors
// panel/outlinePanel.js: same rerenderPreservingUiState + data-focus-key
// mechanism for the "add more" search box, same own store subscription
// rather than living inside canvas.js's render().
import * as store from '../core/store.js';
import { el, clear, rerenderPreservingUiState } from '../utils/dom.js';
import { selectInput, numberInput, checkbox, textInput } from '../utils/formControls.js';
import {
  getAnimations, getActiveAnimation, getAnimationSteps,
  createNewAnimation, renameAnimation, deleteAnimation, setActiveAnimation, setAnimationAutoFocus,
  addAnimationStep, removeAnimationStep, removeAnimationSteps, removeAnimationTarget, reorderAnimationStep,
  updateAnimationStepSettings, setAnimations, startAnimationPlayback,
  addAllToActiveAnimation, setAllStepsRevealMode, setAllStepsEntranceStyle, setAllStepsHideAfterMs,
} from '../canvas/canvas.js';
import { exportAnimation, parseAnimationFile } from '../io/exportAnimation.js';
import { exportAnimationToPptx } from '../io/exportAnimationPptx.js';
import { exportAnimationToVideo } from '../io/exportAnimationVideo.js';
import { pickJSONFile } from '../io/fileIO.js';
import { confirmAction } from '../modals/confirmModal.js';
import { promptText } from '../modals/promptModal.js';
import { showToast } from '../utils/toast.js';
import { ANIMATION_REVEAL_MODES, ANIMATION_ENTRANCE_STYLES } from '../core/project.js';

let rootEl = null;
let isOpen = false;
let searchQuery = '';
let unsubChange = null;
let unsubSelection = null;
// Which steps currently show their notes textarea expanded — ephemeral UI
// state, not part of the step itself, reset only when the panel closes (a
// re-render from an unrelated store change should never collapse a textarea
// the presenter is actively editing).
const expandedNotesStepIds = new Set();
// `${targetType}:${targetId}` keys checked in the "Add more" list for the
// bulk "Add Selected as one step" action — same ephemeral-UI reasoning as
// expandedNotesStepIds above.
const selectedForGroup = new Set();
// The bulk "hide all steps after Ns" field's own pending value — unlike the
// bulk revealMode buttons (a plain one-click action with no value to pick
// first), this needs a number typed in before applying it to every step,
// so it's tracked the same ephemeral, panel-session-only way as the above
// rather than trying to reflect some single "current" value across
// steps that may well not agree with each other.
let bulkHideAfterSeconds = 5;
// Step ids checked in the "In animation" list — scopes every bulk action
// below (reveal mode, entrance style, hide-after, remove) to just these
// steps instead of the whole animation the moment 1+ are checked; empty
// means "every step," same ephemeral-UI reasoning as selectedForGroup
// above (cleared on close, not part of any step's own saved data).
const selectedStepIds = new Set();

export function initAnimationPanel(root) {
  rootEl = root;
  rootEl.classList.add('animation-panel');
}

export function toggleAnimationPanel() {
  if (isOpen) close();
  else open();
}

function open() {
  isOpen = true;
  rootEl.classList.add('open');
  unsubChange = store.subscribe('change', render);
  // The "+ Add Selected From Canvas" quick-add button's own count needs to
  // stay live as the user selects/deselects things on the canvas while the
  // panel is open — selection changes fire their own 'selection' event,
  // separate from 'change' (which only fires on actual project edits).
  unsubSelection = store.subscribe('selection', render);
  render();
}

export function close() {
  isOpen = false;
  rootEl.classList.remove('open');
  unsubChange?.();
  unsubChange = null;
  unsubSelection?.();
  unsubSelection = null;
  expandedNotesStepIds.clear();
  selectedForGroup.clear();
  selectedStepIds.clear();
}

function nodeLabel(n) {
  return n.text || n.defId || 'Component';
}

function edgeLabel(e, nodesById) {
  if (e.label) return e.label;
  const from = nodesById.get(e.from);
  const to = nodesById.get(e.to);
  return `${from ? nodeLabel(from) : '?'} → ${to ? nodeLabel(to) : '?'}`;
}

function targetLabel(target, state, nodesById) {
  if (target.targetType === 'node') {
    const n = nodesById.get(target.targetId);
    return n ? nodeLabel(n) : null;
  }
  const e = state.edges.find((x) => x.id === target.targetId);
  return e ? edgeLabel(e, nodesById) : null;
}

/** A step's header label — every target's own label joined together, capped
 * at 2 named outright plus a "+N more" tail so a large group never blows up
 * the row's height. Individual targets (with their own remove button) still
 * get listed in full in the chips row below, for a step with 2+ targets. */
function stepHeaderLabel(labels) {
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')}, +${labels.length - 2} more`;
}

function render() {
  if (!rootEl || !isOpen) return;
  rerenderPreservingUiState(rootEl, buildContents, '.animation-body');
}

function buildContents() {
  clear(rootEl);
  const state = store.getState();
  const nodesById = new Map(state.nodes.map((n) => [n.id, n]));
  const animations = getAnimations();
  const active = getActiveAnimation();

  const header = el('div', { class: 'animation-header' });
  header.appendChild(el('h2', { text: 'Diagram Animation' }));
  header.appendChild(el('button', { type: 'button', class: 'animation-close', 'aria-label': 'Close animation panel', text: '✕', onClick: close }));
  rootEl.appendChild(header);

  const body = el('div', { class: 'animation-body' });
  body.appendChild(buildAnimationSwitcher(animations, active));

  // No active animation yet (a brand-new diagram, or every animation was
  // deleted) doesn't block adding a first item — addAnimationStep() creates
  // "Animation 1" implicitly the moment something is actually added, same
  // as the node/edge context menu's "Add to Animation" already does without
  // requiring the panel to be open at all. The switcher's own "+ New" above
  // is only needed for a deliberate *second*, separately-named animation.
  const steps = active?.steps || [];

  if (active) {
    body.appendChild(checkbox(active.autoFocus, (v) => setAnimationAutoFocus(active.id, v), '🔎 Auto-focus: pan/zoom to each step as it reveals'));
  }

  const playBtn = el('button', {
    type: 'button',
    class: 'btn btn-primary animation-play-btn',
    text: '▶️ Play Animation',
    disabled: steps.length === 0,
    onClick: () => { close(); startAnimationPlayback(); },
  });
  body.appendChild(playBtn);
  if (!steps.length) {
    body.appendChild(el('p', { class: 'animation-empty-hint', text: 'Add at least one component or connector to build an animation — see the quick-add buttons just below, or search further down.' }));
  }
  body.appendChild(buildQuickAddRow(steps, state));

  const ioRow = el('div', { class: 'animation-io-row' });
  ioRow.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-sm',
    text: '⬇️ Export Animation',
    disabled: animations.every((a) => !a.steps.length),
    onClick: () => {
      const edgesById = new Map(state.edges.map((e) => [e.id, e]));
      exportAnimation(animations, state.name, nodesById, edgesById);
    },
  }));
  ioRow.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-sm',
    text: '⬆️ Import Animation',
    onClick: async () => {
      const text = await pickJSONFile();
      if (!text) return;
      const existingNodeIds = new Set(store.getState().nodes.map((n) => n.id));
      const existingEdgeIds = new Set(store.getState().edges.map((e) => e.id));
      const result = parseAnimationFile(text, existingNodeIds, existingEdgeIds);
      if (!result.ok) { showToast(`Could not import: ${result.error}`, 'error'); return; }
      if (getAnimations().some((a) => a.steps.length)) {
        const proceed = await confirmAction({
          title: 'Replace current animations?',
          message: 'Importing replaces every animation on this diagram entirely. This can\'t be undone with Ctrl/Cmd+Z.',
          confirmLabel: 'Replace',
        });
        if (!proceed) return;
      }
      setAnimations(result.animations, result.activeAnimationId);
      showToast(
        result.skippedCount
          ? `Imported ${result.appliedCount} step${result.appliedCount === 1 ? '' : 's'} across ${result.animations.length} animation${result.animations.length === 1 ? '' : 's'} — ${result.skippedCount} skipped (not on this diagram).`
          : `Imported ${result.appliedCount} step${result.appliedCount === 1 ? '' : 's'} across ${result.animations.length} animation${result.animations.length === 1 ? '' : 's'}.`,
        'success',
      );
    },
  }));
  body.appendChild(ioRow);

  const exportRow = el('div', { class: 'animation-io-row' });
  const pptxBtn = el('button', {
    type: 'button',
    class: 'btn btn-sm',
    text: '🎬 Export to PPTX',
    title: 'One slide per step, cumulatively revealing the diagram — each slide\'s speaker notes carry that step\'s intended timing (PowerPoint itself has no built-in way to auto-advance a slide from this app)',
    disabled: !steps.length,
    onClick: async () => {
      pptxBtn.disabled = true;
      pptxBtn.textContent = 'Exporting…';
      try {
        await exportAnimationToPptx(active);
        showToast('Exported the animation to a .pptx.', 'success', 2200);
      } catch (err) {
        showToast(`Could not export: ${err.message || err}`, 'error', 4500);
      } finally {
        pptxBtn.disabled = !steps.length;
        pptxBtn.textContent = '🎬 Export to PPTX';
      }
    },
  });
  exportRow.appendChild(pptxBtn);

  const videoBtn = el('button', {
    type: 'button',
    class: 'btn btn-sm',
    text: '🎥 Export to Video',
    title: 'Plays the animation start to finish and saves it as a .webm video — a "Click" step holds for 2 seconds since there\'s no presenter to click for it',
    disabled: !steps.length,
    onClick: async () => {
      videoBtn.disabled = true;
      const originalLabel = videoBtn.textContent;
      try {
        const result = await exportAnimationToVideo(active, (done, total, phase) => {
          videoBtn.textContent = phase === 'capturing' ? `Capturing ${done}/${total}…` : `Recording ${done}/${total}…`;
        });
        if (!result.ok) showToast(result.error, 'error', 4500);
        else showToast('Exported the animation to a video.', 'success', 2200);
      } catch (err) {
        showToast(`Could not export: ${err.message || err}`, 'error', 4500);
      } finally {
        videoBtn.disabled = !steps.length;
        videoBtn.textContent = originalLabel;
      }
    },
  });
  exportRow.appendChild(videoBtn);
  body.appendChild(exportRow);

  body.appendChild(buildInAnimationSection(steps, state, nodesById));
  body.appendChild(buildAddMoreSection(steps, state, nodesById));

  rootEl.appendChild(body);
}

/** A dropdown of every named animation plus New/Rename/Delete — lets one
 * diagram carry several independent sequences (e.g. "Normal flow" vs
 * "Failure scenario") without them interfering with each other; only the
 * `activeAnimationId` one is ever shown/edited/played at a time. */
function buildAnimationSwitcher(animations, active) {
  const row = el('div', { class: 'animation-switcher' });
  if (animations.length) {
    row.appendChild(selectInput(
      animations.map((a) => a.id),
      active?.id ?? '',
      (id) => setActiveAnimation(id),
      Object.fromEntries(animations.map((a) => [a.id, `${a.name} (${a.steps.length})`])),
    ));
  }
  row.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-sm',
    title: 'Create a new, separate animation on this diagram',
    text: '+ New',
    onClick: async () => {
      const name = await promptText({ title: 'New animation', label: 'Name', defaultValue: `Animation ${animations.length + 1}`, confirmLabel: 'Create' });
      if (name) createNewAnimation(name);
    },
  }));
  if (active) {
    row.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-sm',
      title: 'Rename this animation',
      text: '✎',
      'aria-label': 'Rename animation',
      onClick: async () => {
        const name = await promptText({ title: 'Rename animation', label: 'Name', defaultValue: active.name, confirmLabel: 'Rename' });
        if (name) renameAnimation(active.id, name);
      },
    }));
    row.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-sm',
      title: 'Delete this animation',
      text: '🗑',
      'aria-label': 'Delete animation',
      onClick: async () => {
        const proceed = await confirmAction({ title: 'Delete animation?', message: `Delete "${active.name}"? This can't be undone with Ctrl/Cmd+Z.`, confirmLabel: 'Delete', danger: true });
        if (proceed) deleteAnimation(active.id);
      },
    }));
  }
  return row;
}

/** The two fastest ways to populate an animation, surfaced right under
 * "Play Animation" rather than buried under the (now much longer) "In
 * animation" list and the "Add more" section below it — both were found
 * to be easy to miss once a diagram had a handful of steps and the panel
 * needed real scrolling to reach them. "+ Add All" is the exact same
 * action `buildAddMoreSection` used to render inline (moved here, not
 * duplicated — a second identically-labeled button would both confuse a
 * user and break every existing `hasText: '+ Add All'` locator in this
 * suite's e2e tests, which assume exactly one match). "+ Add Selected From
 * Canvas" is new: the panel's own reachable equivalent of right-clicking a
 * multi-selection and choosing "Add Selection to Animation" — same
 * `addAnimationStep` call, same "one grouped step" result, just discoverable
 * without knowing that context-menu item exists. */
function buildQuickAddRow(steps, state) {
  const inAnimation = new Set(steps.flatMap((s) => s.targets).map((t) => `${t.targetType}:${t.targetId}`));
  const remainingCount = state.nodes.filter((n) => !inAnimation.has(`node:${n.id}`)).length
    + state.edges.filter((e) => !inAnimation.has(`edge:${e.id}`)).length;
  const selection = store.getSelection();
  const selectionCount = selection.nodeIds.length + selection.edgeIds.length;

  const row = el('div', { class: 'animation-bulk-row animation-quick-add-row' });
  row.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-sm',
    text: `+ Add All (${remainingCount})`,
    title: 'Adds every remaining component and connector as its own separate step, in canvas order — no manual configuration needed',
    disabled: remainingCount === 0,
    onClick: () => {
      const added = addAllToActiveAnimation();
      if (added) showToast(`Added ${added} step${added === 1 ? '' : 's'} to the animation.`, 'success', 2000);
    },
  }));
  row.appendChild(el('button', {
    type: 'button',
    class: 'btn btn-sm',
    text: `+ Add Selected From Canvas (${selectionCount})`,
    title: 'Adds whatever is currently selected on the canvas as one step that reveals together — the panel equivalent of right-clicking a multi-selection and choosing "Add Selection to Animation"',
    disabled: selectionCount === 0,
    onClick: () => {
      const targets = [
        ...selection.nodeIds.map((id) => ({ targetType: 'node', targetId: id })),
        ...selection.edgeIds.map((id) => ({ targetType: 'edge', targetId: id })),
      ];
      const step = addAnimationStep(targets);
      if (step) showToast(`Added the current canvas selection (${targets.length} item${targets.length === 1 ? '' : 's'}) as one step.`, 'success', 2000);
      else showToast('Everything currently selected is already in this animation.', 'error', 2500);
    },
  }));
  return row;
}

function buildInAnimationSection(steps, state, nodesById) {
  const section = el('div', { class: 'animation-section' });
  section.appendChild(el('h3', { text: `In animation (${steps.length})` }));
  if (!steps.length) return section;

  // Checked steps no longer offered (removed since, e.g. via a per-step ✕)
  // shouldn't silently linger in the selection or its count — same pruning
  // reasoning as buildAddMoreSection's own selectedForGroup handling below.
  const stepIdSet = new Set(steps.map((s) => s.id));
  for (const id of [...selectedStepIds]) if (!stepIdSet.has(id)) selectedStepIds.delete(id);
  const selectedCount = selectedStepIds.size;
  // Every bulk action below reads this once per render: "every step" while
  // nothing is checked, "just the checked ones" the moment 1+ are — see
  // canvas.js's own `stepIds = null` convention on each bulk function.
  const scopeIds = selectedCount ? selectedStepIds : null;
  const scopeLabel = selectedCount ? `${selectedCount} selected step${selectedCount === 1 ? '' : 's'}` : 'all steps';

  const selectAllRow = el('div', { class: 'animation-bulk-row' });
  selectAllRow.appendChild(checkbox(
    selectedCount > 0 && selectedCount === steps.length,
    (v) => { selectedStepIds.clear(); if (v) for (const s of steps) selectedStepIds.add(s.id); render(); },
    selectedCount ? `Select all (${selectedCount} selected)` : 'Select all',
  ));
  selectAllRow.appendChild(el('button', {
    type: 'button', class: 'btn btn-sm animation-remove-all-btn',
    text: selectedCount ? `🗑️ Remove Selected (${selectedCount})` : '🗑️ Remove All',
    title: selectedCount ? 'Remove every checked step from this animation' : 'Remove every step from this animation, leaving it empty',
    onClick: async () => {
      const ids = scopeIds ? [...scopeIds] : steps.map((s) => s.id);
      if (ids.length > 1) {
        const proceed = await confirmAction({
          title: 'Remove steps?',
          message: `Remove ${ids.length} step${ids.length === 1 ? '' : 's'} from this animation? This can be undone with Ctrl/Cmd+Z.`,
          confirmLabel: 'Remove',
          danger: true,
        });
        if (!proceed) return;
      }
      const removed = removeAnimationSteps(scopeIds);
      selectedStepIds.clear();
      if (removed) showToast(`Removed ${removed} step${removed === 1 ? '' : 's'} from the animation.`, 'success', 2000);
    },
  }));
  section.appendChild(selectAllRow);

  // Bulk mode-change — sets every step's (or every *checked* step's, once
  // 1+ are checked above) revealMode at once instead of clicking through
  // each row's own dropdown one at a time, which gets tedious fast on a
  // walkthrough with a dozen+ steps (e.g. right after "+ Add All" above, or
  // an imported animation whose steps came in mixed).
  const bulkRow = el('div', { class: 'animation-bulk-row' });
  bulkRow.appendChild(el('span', { class: 'animation-bulk-label', text: `Set ${scopeLabel} to:` }));
  bulkRow.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: '⏱️ Auto-play', title: `Change ${scopeLabel} in this animation to auto-advance`, onClick: () => setAllStepsRevealMode('auto', scopeIds) }));
  bulkRow.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: '🖱️ Click', title: `Change ${scopeLabel} in this animation to advance only on click`, onClick: () => setAllStepsRevealMode('click', scopeIds) }));
  section.appendChild(bulkRow);

  // Bulk entrance-style change — same one-click convenience as the
  // revealMode row above, for picking one consistent look across a whole
  // walkthrough (or just the checked steps) instead of setting each step's
  // own "Entrance" dropdown by hand (most useful right after "+ Add All"
  // above).
  const entranceBulkRow = el('div', { class: 'animation-bulk-row' });
  entranceBulkRow.appendChild(el('span', { class: 'animation-bulk-label', text: `Entrance for ${scopeLabel}:` }));
  entranceBulkRow.appendChild(selectInput(
    ['', ...ANIMATION_ENTRANCE_STYLES],
    '',
    (v) => { if (v) setAllStepsEntranceStyle(v, scopeIds); },
    { '': 'Choose…', fade: 'Fade', 'slide-up': 'Slide up', zoom: 'Zoom in', draw: 'Draw (edges only)' },
  ));
  section.appendChild(entranceBulkRow);

  // Bulk auto-hide — a "flash card" style walkthrough (every step appears,
  // then disappears again a few seconds later) needs this set on many
  // steps at once at least as often as it needs one step configured
  // individually, so it gets the same one-click bulk treatment as revealMode
  // and entrance style above rather than only being reachable per-step.
  const hideAfterBulkRow = el('div', { class: 'animation-bulk-row' });
  hideAfterBulkRow.appendChild(el('span', { class: 'animation-bulk-label', text: `Hide ${scopeLabel} after:` }));
  hideAfterBulkRow.appendChild(numberInput(
    bulkHideAfterSeconds,
    0.5, 300, 0.5,
    (v) => { bulkHideAfterSeconds = v; },
    { class: 'animation-step-hide-after', title: 'Seconds after each step reveals before it auto-hides itself again' },
  ));
  hideAfterBulkRow.appendChild(el('button', {
    type: 'button', class: 'btn btn-sm', text: '⏱️ Apply',
    title: `Set ${scopeLabel} in this animation to auto-hide after the entered number of seconds`,
    onClick: () => setAllStepsHideAfterMs(Math.max(500, Math.round(bulkHideAfterSeconds * 1000)), scopeIds),
  }));
  hideAfterBulkRow.appendChild(el('button', {
    type: 'button', class: 'btn btn-sm', text: '🚫 Never hide',
    title: `Turn off auto-hide for ${scopeLabel} in this animation`,
    onClick: () => setAllStepsHideAfterMs(0, scopeIds),
  }));
  section.appendChild(hideAfterBulkRow);

  const list = el('div', { class: 'animation-step-list' });
  steps.forEach((step, index) => {
    const labeledTargets = step.targets
      .map((t) => ({ target: t, label: targetLabel(t, state, nodesById) }))
      .filter((x) => x.label != null); // orphaned reference — validateProject would have already dropped it on load; defensive only
    if (!labeledTargets.length) return;
    const headerLabel = stepHeaderLabel(labeledTargets.map((x) => x.label));

    const row = el('div', { class: 'animation-step-row' });
    row.appendChild(el('input', {
      type: 'checkbox',
      class: 'animation-step-select',
      'aria-label': `Select ${headerLabel} for bulk actions`,
      checked: selectedStepIds.has(step.id),
      onChange: (e) => { if (e.target.checked) selectedStepIds.add(step.id); else selectedStepIds.delete(step.id); render(); },
    }));
    row.appendChild(el('span', { class: 'animation-step-order', text: String(index + 1) }));
    row.appendChild(el('span', {
      class: 'animation-step-icon',
      text: labeledTargets.length > 1 ? '🎞️' : (labeledTargets[0].target.targetType === 'node' ? '🔲' : '➔'),
      'aria-hidden': 'true',
    }));
    row.appendChild(el('span', { class: 'animation-step-label', text: headerLabel }));

    const controls = el('div', { class: 'animation-step-controls' });
    controls.appendChild(selectInput(
      ANIMATION_REVEAL_MODES,
      step.revealMode,
      (v) => updateAnimationStepSettings(step.id, { revealMode: v }),
      { auto: 'Auto', click: 'Click' },
    ));
    if (step.revealMode === 'auto') {
      controls.appendChild(numberInput(
        step.delayMs / 1000,
        0.5, 60, 0.5,
        (v) => updateAnimationStepSettings(step.id, { delayMs: Math.max(500, Math.round(v * 1000)) }),
        { class: 'animation-step-delay', title: 'Seconds before this step reveals automatically' },
      ));
    }
    row.appendChild(controls);

    const notesOpen = expandedNotesStepIds.has(step.id);
    row.appendChild(el('button', {
      type: 'button',
      class: `animation-step-notes-toggle${step.notes ? ' has-notes' : ''}`,
      title: 'Presenter notes for this step',
      'aria-label': 'Toggle presenter notes',
      text: '📝',
      onClick: () => { if (notesOpen) expandedNotesStepIds.delete(step.id); else expandedNotesStepIds.add(step.id); render(); },
    }));

    const moveUp = el('button', { type: 'button', class: 'animation-step-move', 'aria-label': 'Move earlier', text: '▲', disabled: index === 0, onClick: () => reorderAnimationStep(step.id, -1) });
    const moveDown = el('button', { type: 'button', class: 'animation-step-move', 'aria-label': 'Move later', text: '▼', disabled: index === steps.length - 1, onClick: () => reorderAnimationStep(step.id, 1) });
    row.appendChild(moveUp);
    row.appendChild(moveDown);
    row.appendChild(el('button', { type: 'button', class: 'animation-step-remove', 'aria-label': `Remove ${headerLabel} from animation`, text: '✕', onClick: () => removeAnimationStep(step.id) }));
    list.appendChild(row);

    // A separate row (rather than cramming into `controls` above, which
    // already governs *when this step advances*) for *how it looks* while
    // it's on screen: its entrance style, and an optional auto-hide timer —
    // kept always visible (not behind a toggle like the notes row) since
    // both are core to what "Diagram Animation" actually presents, not a
    // secondary/rarely-used detail.
    const appearanceRow = el('div', { class: 'animation-step-appearance-row' });
    appearanceRow.appendChild(el('span', { class: 'animation-step-appearance-label', text: 'Entrance:' }));
    appearanceRow.appendChild(selectInput(
      ANIMATION_ENTRANCE_STYLES,
      step.entranceStyle,
      (v) => updateAnimationStepSettings(step.id, { entranceStyle: v }),
      { fade: 'Fade', 'slide-up': 'Slide up', zoom: 'Zoom in', draw: 'Draw (edges only)' },
    ));
    appearanceRow.appendChild(checkbox(
      step.hideAfterMs > 0,
      (v) => updateAnimationStepSettings(step.id, { hideAfterMs: v ? 5000 : 0 }),
      'Hide after',
    ));
    if (step.hideAfterMs > 0) {
      appearanceRow.appendChild(numberInput(
        step.hideAfterMs / 1000,
        0.5, 300, 0.5,
        (v) => updateAnimationStepSettings(step.id, { hideAfterMs: Math.max(500, Math.round(v * 1000)) }),
        { class: 'animation-step-hide-after', title: 'Seconds after revealing before this step auto-hides itself again' },
      ));
    }
    list.appendChild(appearanceRow);

    if (notesOpen) {
      list.appendChild(el('div', { class: 'animation-step-notes-row' }, [
        textInput(step.notes, (v) => updateAnimationStepSettings(step.id, { notes: v }), {
          class: 'animation-step-notes-input',
          placeholder: 'Presenter-only reminder — never shown to the audience, just to you during playback',
        }),
      ]));
    }

    // Only shown for an actual group (2+ targets) — a single-target step's
    // own row ✕ above already covers removing it, so this stays out of the
    // way for the common, non-grouped case.
    if (labeledTargets.length > 1) {
      const chips = el('div', { class: 'animation-step-targets' });
      for (const { target, label } of labeledTargets) {
        chips.appendChild(el('span', { class: 'animation-step-target-chip' }, [
          el('span', { text: `${target.targetType === 'node' ? '🔲' : '➔'} ${label}` }),
          el('button', {
            type: 'button',
            class: 'animation-step-target-remove',
            'aria-label': `Remove ${label} from this step`,
            text: '✕',
            onClick: () => removeAnimationTarget(step.id, target.targetType, target.targetId),
          }),
        ]));
      }
      list.appendChild(chips);
    }
  });
  section.appendChild(list);
  return section;
}

function buildAddMoreSection(steps, state, nodesById) {
  const inAnimation = new Set(steps.flatMap((s) => s.targets).map((t) => `${t.targetType}:${t.targetId}`));
  const q = searchQuery.trim().toLowerCase();

  const section = el('div', { class: 'animation-section' });
  section.appendChild(el('h3', { text: 'Add more' }));

  const search = el('input', {
    type: 'search',
    class: 'animation-search',
    placeholder: 'Search components & connectors…',
    value: searchQuery,
    'data-focus-key': 'animation-search',
    onInput: (e) => { searchQuery = e.target.value; render(); },
  });
  section.appendChild(search);

  const candidateNodes = state.nodes.filter((n) => !inAnimation.has(`node:${n.id}`) && (!q || nodeLabel(n).toLowerCase().includes(q)));
  const candidateEdges = state.edges.filter((e) => !inAnimation.has(`edge:${e.id}`) && (!q || edgeLabel(e, nodesById).toLowerCase().includes(q)));
  // Checked items no longer offered (removed from the canvas, or search
  // filtered them out) shouldn't silently linger in the bulk-add count.
  const candidateKeys = new Set([...candidateNodes.map((n) => `node:${n.id}`), ...candidateEdges.map((e) => `edge:${e.id}`)]);
  for (const key of [...selectedForGroup]) if (!candidateKeys.has(key)) selectedForGroup.delete(key);

  if (candidateNodes.length + candidateEdges.length > 1) {
    const bulkAddRow = el('div', { class: 'animation-bulk-row' });
    bulkAddRow.appendChild(el('button', {
      type: 'button',
      class: 'btn btn-sm animation-add-selected-btn',
      text: `+ Add Selected (${selectedForGroup.size}) as one step`,
      disabled: selectedForGroup.size === 0,
      title: 'Groups every checked item below into a single step that reveals all together, sharing one order number',
      onClick: () => {
        const targets = [...selectedForGroup].map((key) => {
          const [targetType, targetId] = key.split(':');
          return { targetType, targetId };
        });
        addAnimationStep(targets);
        selectedForGroup.clear();
      },
    }));
    section.appendChild(bulkAddRow);
  }

  const list = el('div', { class: 'animation-add-list' });
  for (const n of candidateNodes) {
    list.appendChild(buildAddRow('🔲', nodeLabel(n), `node:${n.id}`, () => addAnimationStep({ targetType: 'node', targetId: n.id })));
  }
  for (const e of candidateEdges) {
    list.appendChild(buildAddRow('➔', edgeLabel(e, nodesById), `edge:${e.id}`, () => addAnimationStep({ targetType: 'edge', targetId: e.id })));
  }
  if (!candidateNodes.length && !candidateEdges.length) {
    list.appendChild(el('p', { class: 'animation-empty-hint', text: q ? 'No matches.' : 'Everything on the canvas is already in the animation.' }));
  }
  section.appendChild(list);
  return section;
}

function buildAddRow(icon, label, key, onAdd) {
  const row = el('div', { class: 'animation-add-row' });
  row.appendChild(el('input', {
    type: 'checkbox',
    class: 'animation-add-row-check',
    'aria-label': `Select ${label} for group add`,
    checked: selectedForGroup.has(key),
    onChange: (e) => { if (e.target.checked) selectedForGroup.add(key); else selectedForGroup.delete(key); render(); },
  }));
  row.appendChild(el('span', { class: 'animation-step-icon', text: icon, 'aria-hidden': 'true' }));
  row.appendChild(el('span', { class: 'animation-step-label', text: label }));
  row.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: '+ Add', onClick: onAdd }));
  return row;
}
