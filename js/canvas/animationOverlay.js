// Floating playback chrome for Diagram Animation — the prev/next/step-count
// controls and the freeze+draw annotation overlay. Mounted once at boot
// (like toolbar/kioskModeUi.js's exit button), shown/hidden entirely via
// core/animationPlayback.js's pub-sub rather than being created/destroyed
// per playback session.
import { el } from '../utils/dom.js';
import {
  onAnimationChange, isAnimationPlaying, isAnimationFrozen, getAnimationPlaybackState,
  nextStep, prevStep, setFrozen,
} from '../core/animationPlayback.js';

const DRAW_COLORS = ['#EF4444', '#111827', '#F59E0B', '#3B82F6'];

let controlsEl = null;
let stepIndicatorEl = null;
let prevBtn = null;
let nextBtn = null;
let drawToggleBtn = null;
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
  prevBtn = el('button', { type: 'button', class: 'anim-playback-btn', 'aria-label': 'Previous step', title: 'Previous step (←)', text: '◀', onClick: (e) => { e.stopPropagation(); prevStep(); } });
  stepIndicatorEl = el('span', { class: 'anim-step-indicator' });
  nextBtn = el('button', { type: 'button', class: 'anim-playback-btn', 'aria-label': 'Next step', title: 'Next step (→)', text: '▶', onClick: (e) => { e.stopPropagation(); nextStep(); } });
  drawToggleBtn = el('button', { type: 'button', class: 'anim-playback-btn', 'aria-label': 'Freeze and draw', title: 'Freeze and draw on screen (D)', text: '🖊️', onClick: (e) => { e.stopPropagation(); setFrozen(!isAnimationFrozen()); } });
  controlsEl.appendChild(prevBtn);
  controlsEl.appendChild(stepIndicatorEl);
  controlsEl.appendChild(nextBtn);
  controlsEl.appendChild(drawToggleBtn);
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

function render(state) {
  controlsEl.classList.toggle('visible', state.playing);
  drawOverlayEl.classList.toggle('visible', state.playing && state.frozen);
  if (!state.playing) return;
  stepIndicatorEl.textContent = `${Math.min(state.revealedCount, state.steps.length)} / ${state.steps.length}`;
  prevBtn.disabled = state.revealedCount <= 0;
  nextBtn.disabled = state.revealedCount >= state.steps.length;
  drawToggleBtn.classList.toggle('active', state.frozen);
  // Each freeze is its own annotation session — clearing on the way out
  // (rather than on the way back in) means the canvas is already blank the
  // instant "Done" is clicked, with no stale marks flashing on the diagram
  // for a frame first.
  if (!state.frozen) clearDrawing();
}
