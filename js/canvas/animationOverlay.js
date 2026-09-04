// Floating playback chrome for Diagram Animation — the prev/next/restart/
// pause-play controls, progress dots, presenter notes readout, and the
// freeze+draw annotation overlay. Mounted once at boot (like
// toolbar/kioskModeUi.js's exit button), shown/hidden entirely via
// core/animationPlayback.js's pub-sub rather than being created/destroyed
// per playback session.
import { el } from '../utils/dom.js';
import { createAnnotation } from '../core/project.js';
import { saveAnimationStepAnnotations, getActiveAnimation } from './canvas.js';
import * as viewport from './viewport.js';
import {
  onAnimationChange, isAnimationPlaying, isAnimationFrozen, getAnimationPlaybackState,
  nextStep, prevStep, jumpToStep, goToStart, setFrozen, setDrawingActive, isDrawingActive,
  setAutoPlayAll, isAutoPlayAll, setLoop, isLoopEnabled,
} from '../core/animationPlayback.js';

const DRAW_COLORS = ['#EF4444', '#111827', '#F59E0B', '#3B82F6'];
const TOOLS = [
  { id: 'pen', icon: '✏️', label: 'Pen' },
  { id: 'highlighter', icon: '🖍️', label: 'Highlighter' },
  { id: 'text', icon: '🔤', label: 'Text' },
];

let controlsEl = null;
let stepIndicatorEl = null;
let restartBtn = null;
let prevBtn = null;
let nextBtn = null;
let pausePlayBtn = null;
let autoplayToggleBtn = null;
let loopToggleBtn = null;
let drawToggleBtn = null;
let dotsEl = null;
let overviewNotesEl = null;
let notesEl = null;
let drawOverlayEl = null;
let drawCanvas = null;
let drawCtx = null;
let drawToolbarEl = null;
let toolButtonsEl = null;
let currentColor = DRAW_COLORS[0];
let currentTool = TOOLS[0].id;
let strokeInProgress = false;
let currentStrokePoints = null;

// This session's working copy of annotations per step id — seeded from a
// step's own persisted `annotations` (core/animationPlayback.js's `steps`
// snapshot) the first time that step is drawn on, then kept here so a
// second freeze+draw round on the same step during the same playback
// session builds on top of the first, without waiting for a round-trip
// through the store (which the frozen `steps` snapshot wouldn't reflect
// anyway — see core/animationPlayback.js's own header comment on why it
// holds its own copy). Persisted for real (via canvas.js#
// saveAnimationStepAnnotations) every time drawing mode is exited, whatever
// route that happens through (Done, the 🖊️ toggle, or ending playback
// mid-draw), so nothing drawn is ever silently lost.
const sessionAnnotationsByStepId = new Map();
let drawingStepId = null;
let wasDrawingActive = false;
let lastState = null;

export function initAnimationOverlay() {
  buildPlaybackControls();
  buildDrawOverlay();
  // A click anywhere on the canvas (that isn't one of this overlay's own
  // controls) advances a pending 'click'-mode step — see
  // core/project.js's ANIMATION_REVEAL_MODES: that setting describes *how*
  // a step reveals, not a dedicated "next" button the presenter has to aim
  // for specifically.
  document.addEventListener('click', handleGlobalClick, true);
  onAnimationChange(render);
  viewport.onViewportChange(() => redrawAnnotationLayer(lastState));
  render(getAnimationPlaybackState());
}

function handleGlobalClick(e) {
  if (!isAnimationPlaying() || isAnimationFrozen()) return;
  if (controlsEl.contains(e.target) || drawOverlayEl.contains(e.target)) return;
  nextStep();
}

function buildPlaybackControls() {
  controlsEl = el('div', { class: 'anim-playback-controls' });

  const row = el('div', { class: 'anim-playback-row' });
  restartBtn = el('button', { type: 'button', class: 'anim-playback-btn', 'aria-label': 'Restart', title: 'Restart from the beginning (Home)', text: '⏮', onClick: (e) => { e.stopPropagation(); if (!isDrawingActive()) goToStart(); } });
  prevBtn = el('button', { type: 'button', class: 'anim-playback-btn', 'aria-label': 'Previous step', title: 'Previous step (←)', text: '◀', onClick: (e) => { e.stopPropagation(); if (!isDrawingActive()) prevStep(); } });
  stepIndicatorEl = el('span', { class: 'anim-step-indicator' });
  nextBtn = el('button', { type: 'button', class: 'anim-playback-btn', 'aria-label': 'Next step', title: 'Next step (→)', text: '▶', onClick: (e) => { e.stopPropagation(); if (!isDrawingActive()) nextStep(); } });
  pausePlayBtn = el('button', {
    type: 'button', class: 'anim-playback-btn', 'aria-label': 'Pause', title: 'Pause / resume (Space)',
    text: '⏸', onClick: (e) => { e.stopPropagation(); setFrozen(!isAnimationFrozen()); },
  });
  autoplayToggleBtn = el('button', {
    type: 'button', class: 'anim-playback-btn', 'aria-label': 'Auto-play to the end', title: 'Auto-play every remaining step to the end, ignoring each step\'s own Auto/Click setting',
    text: '⏩', onClick: (e) => { e.stopPropagation(); setAutoPlayAll(!isAutoPlayAll()); },
  });
  loopToggleBtn = el('button', {
    type: 'button', class: 'anim-playback-btn', 'aria-label': 'Loop', title: 'Restart from the beginning after the last step (for an unattended display)',
    text: '🔁', onClick: (e) => { e.stopPropagation(); setLoop(!isLoopEnabled()); },
  });
  drawToggleBtn = el('button', { type: 'button', class: 'anim-playback-btn', 'aria-label': 'Draw', title: 'Draw on screen — sketch, highlight or type over this step (D)', text: '🖊️', onClick: (e) => { e.stopPropagation(); setDrawingActive(!isDrawingActive()); } });
  row.appendChild(restartBtn);
  row.appendChild(prevBtn);
  row.appendChild(stepIndicatorEl);
  row.appendChild(nextBtn);
  row.appendChild(pausePlayBtn);
  row.appendChild(autoplayToggleBtn);
  row.appendChild(loopToggleBtn);
  row.appendChild(drawToggleBtn);
  controlsEl.appendChild(row);

  // One clickable dot per step — filled once revealed, ringed at the
  // current position — for jumping straight to any point instead of
  // stepping through one at a time (see core/animationPlayback.js#jumpToStep).
  dotsEl = el('div', { class: 'anim-progress-dots' });
  controlsEl.appendChild(dotsEl);

  // Presenter-only overview for the whole animation (see
  // core/project.js#createAnimation's `notes` field) — shown for the whole
  // presentation, unlike the per-step notesEl below which changes with
  // every reveal.
  overviewNotesEl = el('div', { class: 'anim-overview-notes' });
  controlsEl.appendChild(overviewNotesEl);

  // Presenter-only reminder for whatever was just revealed (see
  // core/project.js#createAnimationStep's `notes` field) — never shown to
  // the audience beyond whatever's already visible on this same screen,
  // same single-monitor limitation as everything else in this overlay.
  notesEl = el('div', { class: 'anim-step-notes' });
  controlsEl.appendChild(notesEl);

  document.body.appendChild(controlsEl);
}

function buildDrawOverlay() {
  drawOverlayEl = el('div', { class: 'anim-draw-overlay' });
  drawCanvas = el('canvas', { class: 'anim-draw-canvas' });
  drawOverlayEl.appendChild(drawCanvas);

  drawToolbarEl = el('div', { class: 'anim-draw-toolbar' });

  toolButtonsEl = el('div', { class: 'anim-draw-tools' });
  for (const tool of TOOLS) {
    const btn = el('button', {
      type: 'button',
      class: `anim-tool-btn${tool.id === currentTool ? ' active' : ''}`,
      'aria-label': tool.label,
      title: tool.label,
      text: tool.icon,
      onClick: () => {
        currentTool = tool.id;
        toolButtonsEl.querySelectorAll('.anim-tool-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      },
    });
    toolButtonsEl.appendChild(btn);
  }
  drawToolbarEl.appendChild(toolButtonsEl);

  const swatchesEl = el('div', { class: 'anim-draw-swatches' });
  for (const color of DRAW_COLORS) {
    const swatch = el('button', {
      type: 'button',
      class: `anim-draw-swatch${color === currentColor ? ' active' : ''}`,
      'aria-label': `Draw in ${color}`,
      onClick: () => {
        currentColor = color;
        swatchesEl.querySelectorAll('.anim-draw-swatch').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
      },
    });
    swatch.style.background = color;
    swatchesEl.appendChild(swatch);
  }
  drawToolbarEl.appendChild(swatchesEl);

  drawToolbarEl.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: 'Clear', onClick: clearCurrentStepAnnotations }));
  drawToolbarEl.appendChild(el('button', { type: 'button', class: 'btn btn-sm btn-primary', text: 'Done', onClick: () => setFrozen(false) }));
  drawOverlayEl.appendChild(drawToolbarEl);
  document.body.appendChild(drawOverlayEl);

  sizeDrawCanvas();
  window.addEventListener('resize', sizeDrawCanvas);
  drawCanvas.addEventListener('pointerdown', onPointerDown);
}

function sizeDrawCanvas() {
  drawCanvas.width = window.innerWidth;
  drawCanvas.height = window.innerHeight;
  drawCtx = drawCanvas.getContext('2d');
  redrawAnnotationLayer(lastState);
}

function currentStepOf(state) {
  return state?.steps?.[state.revealedCount - 1] || null;
}

/** This session's working annotation list for a step — seeded once from
 * whatever was already persisted on it, then kept here for the rest of the
 * playback session (see `sessionAnnotationsByStepId`'s own header comment). */
function annotationsFor(step) {
  if (!step) return [];
  if (!sessionAnnotationsByStepId.has(step.id)) {
    sessionAnnotationsByStepId.set(step.id, [...(step.annotations || [])]);
  }
  return sessionAnnotationsByStepId.get(step.id);
}

function clearCurrentStepAnnotations() {
  const step = currentStepOf(lastState);
  if (!step) return;
  sessionAnnotationsByStepId.set(step.id, []);
  redrawAnnotationLayer(lastState);
}

/** Redraws the read-only annotation layer for whichever step is currently
 * revealed — called on every playback-state change, every pan/zoom, and
 * every window resize, so persisted marks always land in the right screen
 * position even though they're stored in canvas/world-space coordinates
 * (see core/project.js#createAnnotation) rather than screen pixels. */
function redrawAnnotationLayer(state) {
  if (!drawCtx) return;
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  if (!state?.playing) return;
  const step = currentStepOf(state);
  if (!step) return;
  for (const anno of annotationsFor(step)) drawAnnotation(anno);
}

function drawAnnotation(anno) {
  if (anno.type === 'text') {
    const pt = viewport.canvasToScreen(anno.x, anno.y);
    drawCtx.save();
    drawCtx.font = '600 16px sans-serif';
    drawCtx.textBaseline = 'top';
    const metrics = drawCtx.measureText(anno.text);
    drawCtx.fillStyle = 'rgba(255,255,255,0.85)';
    drawCtx.fillRect(pt.x - 3, pt.y - 2, metrics.width + 6, 22);
    drawCtx.fillStyle = anno.color;
    drawCtx.fillText(anno.text, pt.x, pt.y);
    drawCtx.restore();
    return;
  }
  if (!anno.points || anno.points.length < 2) return;
  drawCtx.save();
  applyStrokeStyle(anno.tool);
  drawCtx.strokeStyle = anno.color;
  drawCtx.beginPath();
  const start = viewport.canvasToScreen(anno.points[0].x, anno.points[0].y);
  drawCtx.moveTo(start.x, start.y);
  for (let i = 1; i < anno.points.length; i++) {
    const pt = viewport.canvasToScreen(anno.points[i].x, anno.points[i].y);
    drawCtx.lineTo(pt.x, pt.y);
  }
  drawCtx.stroke();
  drawCtx.restore();
}

function applyStrokeStyle(tool) {
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';
  if (tool === 'highlighter') {
    drawCtx.lineWidth = 14;
    drawCtx.globalAlpha = 0.35;
  } else {
    drawCtx.lineWidth = 3;
    drawCtx.globalAlpha = 1;
  }
}

function onPointerDown(e) {
  if (!isDrawingActive()) return;
  const step = currentStepOf(lastState);
  if (!step) return;
  if (currentTool === 'text') {
    const text = window.prompt('Annotation text:');
    if (text && text.trim()) {
      const pt = viewport.screenToCanvas(e.clientX, e.clientY);
      annotationsFor(step).push(createAnnotation({ type: 'text', x: pt.x, y: pt.y, text: text.trim(), color: currentColor }));
      redrawAnnotationLayer(lastState);
    }
    return;
  }
  strokeInProgress = true;
  currentStrokePoints = [viewport.screenToCanvas(e.clientX, e.clientY)];
  applyStrokeStyle(currentTool);
  drawCtx.strokeStyle = currentColor;
  drawCtx.beginPath();
  drawCtx.moveTo(e.clientX, e.clientY);
  window.addEventListener('pointermove', continueStroke);
  window.addEventListener('pointerup', endStroke, { once: true });
}

function continueStroke(e) {
  if (!strokeInProgress) return;
  currentStrokePoints.push(viewport.screenToCanvas(e.clientX, e.clientY));
  drawCtx.lineTo(e.clientX, e.clientY);
  drawCtx.stroke();
}

function endStroke() {
  strokeInProgress = false;
  window.removeEventListener('pointermove', continueStroke);
  const step = currentStepOf(lastState);
  if (step && currentStrokePoints && currentStrokePoints.length >= 2) {
    annotationsFor(step).push(createAnnotation({ type: 'stroke', tool: currentTool, color: currentColor, points: currentStrokePoints }));
  }
  currentStrokePoints = null;
  // Redraw through the shared transform-based renderer (rather than leaving
  // the raw live stroke as-is) so this mark and any earlier ones are always
  // pixel-consistent with each other and with a future re-render after a
  // pan/zoom change.
  redrawAnnotationLayer(lastState);
}

/** Writes whatever was drawn on `stepId` this session back to the project
 * (via canvas.js, which validates before persisting) — called every time
 * drawing mode is exited, no matter the route, so a presenter's marks are
 * never lost even if they exit by some path other than the "Done" button. */
function persistIfNeeded(stepId) {
  if (!stepId) return;
  const annotations = sessionAnnotationsByStepId.get(stepId);
  if (!annotations) return;
  saveAnimationStepAnnotations(stepId, annotations);
}

function renderDots(state) {
  // Rebuilt from scratch each time — the count only ever changes when a new
  // playback starts (steps.length is fixed for the whole session, per
  // core/animationPlayback.js's own snapshot), so this is cheap and avoids
  // a parallel diff-by-index bookkeeping structure for something this small.
  dotsEl.replaceChildren();
  if (state.steps.length <= 1) return;
  state.steps.forEach((step, i) => {
    const revealed = i < state.revealedCount;
    const current = i === state.revealedCount;
    dotsEl.appendChild(el('button', {
      type: 'button',
      class: `anim-progress-dot${revealed ? ' revealed' : ''}${current ? ' current' : ''}`,
      'aria-label': `Jump to step ${i + 1}`,
      title: `Step ${i + 1}`,
      disabled: state.drawingActive,
      onClick: (e) => { e.stopPropagation(); if (!isDrawingActive()) jumpToStep(i + 1); },
    }));
  });
}

function renderOverviewNotes() {
  const notes = getActiveAnimation()?.notes?.trim();
  overviewNotesEl.textContent = notes || '';
  overviewNotesEl.classList.toggle('visible', !!notes);
}

function renderNotes(state) {
  const notes = state.steps[state.revealedCount - 1]?.notes?.trim();
  notesEl.textContent = notes || '';
  notesEl.classList.toggle('visible', !!notes);
}

function render(state) {
  lastState = state;
  controlsEl.classList.toggle('visible', state.playing);
  // The annotation layer itself (persisted, read-only marks) shows for the
  // whole time an animation is playing, not just while actively drawing —
  // that's the whole point of persisting them. It only becomes pointer-
  // interactive (and shows its toolbar) while `drawingActive` is true.
  drawOverlayEl.classList.toggle('visible', state.playing);
  drawOverlayEl.classList.toggle('drawing', state.playing && state.drawingActive);
  drawToolbarEl.classList.toggle('visible', state.playing && state.drawingActive);

  // Entering/exiting drawing mode — seed or flush this session's working
  // annotation list for whichever step drawing applies to. Checked on every
  // state change (not just via the toggle button) so ending playback, or
  // navigating away, mid-draw still persists rather than silently dropping
  // whatever was drawn.
  if (state.drawingActive && !wasDrawingActive) {
    drawingStepId = currentStepOf(state)?.id || null;
  } else if (!state.drawingActive && wasDrawingActive) {
    persistIfNeeded(drawingStepId);
    drawingStepId = null;
  }
  wasDrawingActive = state.drawingActive;

  if (!state.playing) {
    redrawAnnotationLayer(state);
    return;
  }
  stepIndicatorEl.textContent = `${Math.min(state.revealedCount, state.steps.length)} / ${state.steps.length}`;
  restartBtn.disabled = state.drawingActive;
  prevBtn.disabled = state.revealedCount <= 0 || state.drawingActive;
  nextBtn.disabled = state.revealedCount >= state.steps.length || state.drawingActive;
  pausePlayBtn.textContent = state.frozen ? '▶' : '⏸';
  pausePlayBtn.title = state.frozen ? 'Resume (Space)' : 'Pause (Space)';
  pausePlayBtn.setAttribute('aria-label', state.frozen ? 'Play' : 'Pause');
  autoplayToggleBtn.classList.toggle('active', state.autoPlayAll);
  loopToggleBtn.classList.toggle('active', state.loop);
  drawToggleBtn.classList.toggle('active', state.drawingActive);
  renderDots(state);
  renderOverviewNotes();
  renderNotes(state);
  redrawAnnotationLayer(state);
}
