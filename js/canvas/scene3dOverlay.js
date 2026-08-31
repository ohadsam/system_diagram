// Floating full-viewport UI for "🧊 3D Presentation" — mounted once at
// boot (same pattern as toolbar/kioskModeUi.js's exit button), shown/
// hidden via core/scene3dMode.js. Lazily mounts js/render3d/scene3dRenderer.js
// (and its vendored Three.js dependency) only the first time it's actually
// opened, and disposes the WebGL context every time it closes — see that
// module's own header comment for why disposal isn't optional here.
import { el } from '../utils/dom.js';
import { isScene3DActive, setScene3DActive, onScene3DChange } from '../core/scene3dMode.js';
import { mountScene3D } from '../render3d/scene3dRenderer.js';
import { getActiveAnimation, startAnimationPlayback, stopAnimationPlayback } from './canvas.js';
import { isAnimationPlaying, nextStep, prevStep, onAnimationChange } from '../core/animationPlayback.js';
import { exportAnimationTo3DVideo } from '../io/export3dVideo.js';
import { showToast } from '../utils/toast.js';

let controllerPromise = null;
let canvasEl = null;

export function initScene3DOverlay() {
  const overlay = el('div', { class: 'scene3d-overlay' });
  canvasEl = el('canvas', { class: 'scene3d-canvas' });
  overlay.appendChild(canvasEl);

  const controls = el('div', { class: 'scene3d-controls' });
  const playBtn = el('button', {
    type: 'button', class: 'btn btn-secondary scene3d-btn',
    onClick: () => { if (isAnimationPlaying()) stopAnimationPlayback(); else startAnimationPlayback(); },
  });
  const prevBtn = el('button', { type: 'button', class: 'btn btn-secondary scene3d-btn', text: '⬅️', title: 'Previous step', onClick: prevStep });
  const nextBtn = el('button', { type: 'button', class: 'btn btn-secondary scene3d-btn', text: '➡️', title: 'Next step', onClick: nextStep });
  const resetViewBtn = el('button', {
    type: 'button', class: 'btn btn-secondary scene3d-btn', text: '🎯 Reset View',
    title: 'Recenter and re-fit the camera on the diagram',
    onClick: () => { controllerPromise?.then((controller) => controller.resetView()); },
  });
  const realisticBtn = el('button', {
    type: 'button', class: 'btn btn-secondary scene3d-btn', text: '🏢 Realistic Room',
    title: 'Toggle a more realistic look: an enclosing room with textured walls, a ceiling, and more detailed component surfaces',
    onClick: async () => {
      const controller = await controllerPromise;
      if (!controller) return;
      const next = !controller.isRealisticMode();
      controller.setRealisticMode(next);
      realisticBtn.classList.toggle('active', next);
    },
  });
  const exportBtn = el('button', {
    type: 'button', class: 'btn btn-secondary scene3d-btn', text: '🎥 Export 3D Video',
    onClick: async () => {
      exportBtn.disabled = true;
      const originalText = exportBtn.textContent;
      exportBtn.textContent = 'Recording…';
      try {
        await exportAnimationTo3DVideo(canvasEl, getActiveAnimation());
        showToast('3D video downloaded.', 'success', 2400);
      } catch (err) {
        showToast(err?.message || 'Could not export 3D video.', 'error', 4000);
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalText;
      }
    },
  });
  const closeBtn = el('button', {
    type: 'button', class: 'btn btn-primary scene3d-btn scene3d-close', text: '✕ Close 3D View',
    onClick: () => setScene3DActive(false),
  });

  function updatePlayBtn() {
    playBtn.textContent = isAnimationPlaying() ? '⏹️ Stop Animation' : '▶️ Play Animation';
    const hasSteps = !!(getActiveAnimation()?.steps?.length);
    playBtn.disabled = !hasSteps && !isAnimationPlaying();
  }
  onAnimationChange(updatePlayBtn);
  updatePlayBtn();

  controls.appendChild(playBtn);
  controls.appendChild(prevBtn);
  controls.appendChild(nextBtn);
  controls.appendChild(resetViewBtn);
  controls.appendChild(realisticBtn);
  controls.appendChild(exportBtn);
  controls.appendChild(closeBtn);
  overlay.appendChild(controls);

  document.body.appendChild(overlay);

  onScene3DChange((active) => {
    overlay.classList.toggle('open', active);
    updatePlayBtn();
    if (active) {
      controllerPromise = mountScene3D(canvasEl);
      // A fresh mount always starts in stylized (non-realistic) mode — keep
      // the toggle button's visual state in sync rather than carrying over
      // whatever it showed from a previous open.
      realisticBtn.classList.remove('active');
    } else if (controllerPromise) {
      controllerPromise.then((controller) => controller.dispose());
      controllerPromise = null;
      if (isAnimationPlaying()) stopAnimationPlayback();
    }
  });
}

export function isScene3DOpen() {
  return isScene3DActive();
}
