// Floating playback chrome for Diagram Animation — the prev/next/step-count
// controls, progress dots, presenter notes readout, and the freeze+draw
// annotation overlay. Mounted once at boot (like toolbar/kioskModeUi.js's
// exit button), shown/hidden entirely via core/animationPlayback.js's
// pub-sub rather than being created/destroyed per playback session.
import { el } from '../utils/dom.js';
import {
  onAnimationChange, isAnimationPlaying, isAnimationFrozen, getAnimationPlaybackState,
  nextStep, prevStep, jumpToStep, setFrozen, setAutoPlayAll, isAutoPlayAll, setLoop, isLoopEnabled,
} from '../core/animationPlayback.js';

const DRAW_COLORS = ['#EF4444', '#111827', '#F59E0B', '#3B82F6'];

let controlsEl = null;
let stepIndicatorEl = null;
let prevBtn = null;
let nextBtn = null;
let autoplayToggleBtn = null;
let loopToggleBtn = null;
let drawToggleBtn = null;
let dotsEl = null;
let notesEl = null;
let drawOverlayEl = null;
let drawCanvas = null;
let drawCtx = null;
let currentColor = DRAW_COLORS[0];
let strokeInProgress = false;

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
  prevBtn = el('button', { type: 'button', class: 'anim-playback-btn', 'aria-label': 'Previous step', title: 'Previous step (←)', text: '◀', onClick: (e) => { e.stopPropagation(); prevStep(); } });
  stepIndicatorEl = el('span', { class: 'anim-step-indicator' });
  nextBtn = el('button', { type: 'button', class: 'anim-playback-btn', 'aria-label': 'Next step', title: 'Next step (→)', text: '▶', onClick: (e) => { e.stopPropagation(); nextStep(); } });
  autoplayToggleBtn = el('button', {
    type: 'button', class: 'anim-playback-btn', 'aria-label': 'Auto-play to the end', title: 'Auto-play every remaining step to the end, ignoring each step\'s own Auto/Click setting',
    text: '⏩', onClick: (e) => { e.stopPropagation(); setAutoPlayAll(!isAutoPlayAll()); },
  });
  loopToggleBtn = el('button', {
    type: 'button', class: 'anim-playback-btn', 'aria-label': 'Loop', title: 'Restart from the beginning after the last step (for an unattended display)',
    text: '🔁', onClick: (e) => { e.stopPropagation(); setLoop(!isLoopEnabled()); },
  });
  drawToggleBtn = el('button', { type: 'button', class: 'anim-playback-btn', 'aria-label': 'Freeze and draw', title: 'Freeze and draw on screen (D)', text: '🖊️', onClick: (e) => { e.stopPropagation(); setFrozen(!isAnimationFrozen()); } });
  row.appendChild(prevBtn);
  row.appendChild(stepIndicatorEl);
  row.appendChild(nextBtn);
  row.appendChild(autoplayToggleBtn);
  row.appendChild(loopToggleBtn);
  row.appendChild(drawToggleBtn);
  controlsEl.appendChild(row);

  // One clickable dot per step — filled once revealed, ringed at the
  // current position — for jumping straight to any point instead of
  // stepping through one at a time (see core/animationPlayback.js#jumpToStep).
  dotsEl = el('div', { class: 'anim-progress-dots' });
  controlsEl.appendChild(dotsEl);

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

  const toolbar = el('div', { class: 'anim-draw-toolbar' });
  for (const color of DRAW_COLORS) {
    const swatch = el('button', {
      type: 'button',
      class: `anim-draw-swatch${color === currentColor ? ' active' : ''}`,
      'aria-label': `Draw in ${color}`,
      onClick: () => {
        currentColor = color;
        toolbar.querySelectorAll('.anim-draw-swatch').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
      },
    });
    swatch.style.background = color;
    toolbar.appendChild(swatch);
  }
  toolbar.appendChild(el('button', { type: 'button', class: 'btn btn-sm', text: 'Clear', onClick: clearDrawing }));
  toolbar.appendChild(el('button', { type: 'button', class: 'btn btn-sm btn-primary', text: 'Done', onClick: () => setFrozen(false) }));
  drawOverlayEl.appendChild(toolbar);
  document.body.appendChild(drawOverlayEl);

  sizeDrawCanvas();
  window.addEventListener('resize', sizeDrawCanvas);
  drawCanvas.addEventListener('pointerdown', beginStroke);
}

function sizeDrawCanvas() {
  drawCanvas.width = window.innerWidth;
  drawCanvas.height = window.innerHeight;
  drawCtx = drawCanvas.getContext('2d');
  if (drawCtx) {
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
    drawCtx.lineWidth = 3;
  }
}

function clearDrawing() {
  drawCtx?.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function beginStroke(e) {
  if (!isAnimationFrozen()) return;
  strokeInProgress = true;
  drawCtx.strokeStyle = currentColor;
  drawCtx.beginPath();
  drawCtx.moveTo(e.clientX, e.clientY);
  window.addEventListener('pointermove', continueStroke);
  window.addEventListener('pointerup', endStroke, { once: true });
}

function continueStroke(e) {
  if (!strokeInProgress) return;
  drawCtx.lineTo(e.clientX, e.clientY);
  drawCtx.stroke();
}

function endStroke() {
  strokeInProgress = false;
  window.removeEventListener('pointermove', continueStroke);
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
      onClick: (e) => { e.stopPropagation(); jumpToStep(i + 1); },
    }));
  });
}

function renderNotes(state) {
  const notes = state.steps[state.revealedCount - 1]?.notes?.trim();
  notesEl.textContent = notes || '';
  notesEl.classList.toggle('visible', !!notes);
}

function render(state) {
  controlsEl.classList.toggle('visible', state.playing);
  drawOverlayEl.classList.toggle('visible', state.playing && state.frozen);
  if (!state.playing) return;
  stepIndicatorEl.textContent = `${Math.min(state.revealedCount, state.steps.length)} / ${state.steps.length}`;
  prevBtn.disabled = state.revealedCount <= 0;
  nextBtn.disabled = state.revealedCount >= state.steps.length;
  autoplayToggleBtn.classList.toggle('active', state.autoPlayAll);
  loopToggleBtn.classList.toggle('active', state.loop);
  drawToggleBtn.classList.toggle('active', state.frozen);
  // Each freeze is its own annotation session — clearing on the way out
  // (rather than on the way back in) means the canvas is already blank the
  // instant "Done" is clicked, with no stale marks flashing on the diagram
  // for a frame first.
  if (!state.frozen) clearDrawing();
  renderDots(state);
  renderNotes(state);
}
