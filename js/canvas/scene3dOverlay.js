// Floating full-viewport UI for "🧊 3D Presentation" — mounted once at
// boot (same pattern as toolbar/kioskModeUi.js's exit button), shown/
// hidden via core/scene3dMode.js. Lazily mounts js/render3d/scene3dRenderer.js
// (and its vendored Three.js dependency) only the first time it's actually
// opened, and disposes the WebGL context every time it closes — see that
// module's own header comment for why disposal isn't optional here.
import { el, clear } from '../utils/dom.js';
import { isScene3DActive, setScene3DActive, onScene3DChange } from '../core/scene3dMode.js';
import { mountScene3D } from '../render3d/scene3dRenderer.js';
import { getActiveAnimation, startAnimationPlayback, stopAnimationPlayback } from './canvas.js';
import { isAnimationPlaying, nextStep, prevStep, onAnimationChange } from '../core/animationPlayback.js';
import { exportAnimationTo3DVideo } from '../io/export3dVideo.js';
import { exportScene3DToPptx } from '../io/export3dPptx.js';
import { showToast } from '../utils/toast.js';

let controllerPromise = null;
let canvasEl = null;

export function initScene3DOverlay() {
  const overlay = el('div', { class: 'scene3d-overlay' });
  canvasEl = el('canvas', { class: 'scene3d-canvas' });
  overlay.appendChild(canvasEl);

  let tourPanelOpen = false;
  let tourLoopEnabled = false;
  let unsubscribeTour = null;
  const tourPanel = el('div', { class: 'scene3d-tour-panel' });

  async function renderTourPanel() {
    const controller = await controllerPromise;
    if (!controller) return;
    clear(tourPanel);
    const shots = controller.getTourShots();
    const playing = controller.isTourPlaying();

    tourPanel.appendChild(el('div', { class: 'scene3d-tour-header' }, [
      el('strong', { text: '🎬 Camera Tour' }),
      el('span', {
        class: 'scene3d-tour-count',
        text: shots.length ? `${shots.length} shot${shots.length === 1 ? '' : 's'}` : 'No shots yet',
      }),
    ]));

    const list = el('div', { class: 'scene3d-tour-list' });
    if (!shots.length) {
      list.appendChild(el('div', {
        class: 'scene3d-tour-empty',
        text: 'Add a shot from the current view, or auto-generate a full tour below.',
      }));
    } else {
      shots.forEach((shot, i) => {
        list.appendChild(el('div', { class: 'scene3d-tour-row' }, [
          el('button', {
            type: 'button', class: 'scene3d-tour-row-label', text: `${i + 1}. ${shot.label}`,
            title: 'Preview this shot', onClick: () => controller.setCameraToShot(i),
          }),
          el('button', {
            type: 'button', class: 'scene3d-tour-row-btn', text: '↑', title: 'Move up', disabled: i === 0,
            onClick: () => controller.moveTourShot(i, i - 1),
          }),
          el('button', {
            type: 'button', class: 'scene3d-tour-row-btn', text: '↓', title: 'Move down', disabled: i === shots.length - 1,
            onClick: () => controller.moveTourShot(i, i + 1),
          }),
          el('button', {
            type: 'button', class: 'scene3d-tour-row-btn scene3d-tour-row-remove', text: '✕', title: 'Remove this shot',
            onClick: () => controller.removeTourShot(i),
          }),
        ]));
      });
    }
    tourPanel.appendChild(list);

    const actions = el('div', { class: 'scene3d-tour-actions' });
    actions.appendChild(el('button', {
      type: 'button', class: 'btn btn-secondary scene3d-btn', text: '📍 Add Current View',
      title: "Capture the camera's current position/angle/zoom as the next shot",
      onClick: () => controller.addTourShotFromCurrentView(),
    }));
    actions.appendChild(el('button', {
      type: 'button', class: 'btn btn-secondary scene3d-btn', text: '✨ Auto-Generate',
      title: 'Build a full tour automatically: one shot per component, plus an overview',
      onClick: () => controller.autoGenerateTour(),
    }));
    if (shots.length) {
      actions.appendChild(el('button', {
        type: 'button', class: 'btn btn-secondary scene3d-btn', text: '🗑️ Clear', title: 'Remove every shot',
        onClick: () => controller.clearTour(),
      }));
    }
    tourPanel.appendChild(actions);

    const playbackRow = el('div', { class: 'scene3d-tour-playback' });
    playbackRow.appendChild(el('button', {
      type: 'button', class: 'btn btn-primary scene3d-btn', text: playing ? '⏹️ Stop Tour' : '▶️ Play Tour',
      disabled: !shots.length,
      onClick: () => {
        if (controller.isTourPlaying()) controller.stopTour();
        else controller.startTour({ loop: tourLoopEnabled });
      },
    }));
    playbackRow.appendChild(el('label', { class: 'scene3d-tour-loop' }, [
      el('input', {
        type: 'checkbox', checked: tourLoopEnabled,
        onChange: (e) => { tourLoopEnabled = e.target.checked; },
      }),
      ' Loop',
    ]));
    tourPanel.appendChild(playbackRow);
  }

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
    title: 'Record this view (and any 🎬 Camera Tour or Diagram Animation) to a video file',
    onClick: async () => {
      exportBtn.disabled = true;
      const originalText = exportBtn.textContent;
      exportBtn.textContent = 'Recording…';
      try {
        const controller = await controllerPromise;
        await exportAnimationTo3DVideo(canvasEl, getActiveAnimation(), controller);
        showToast('3D video downloaded.', 'success', 2400);
      } catch (err) {
        showToast(err?.message || 'Could not export 3D video.', 'error', 4000);
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = originalText;
      }
    },
  });
  const exportPptxBtn = el('button', {
    type: 'button', class: 'btn btn-secondary scene3d-btn', text: '📊 Export 3D Presentation',
    title: 'Export this view to a .pptx: one slide per 🎬 Camera Tour shot (or Diagram Animation step)',
    onClick: async () => {
      exportPptxBtn.disabled = true;
      const originalText = exportPptxBtn.textContent;
      exportPptxBtn.textContent = 'Exporting…';
      try {
        const controller = await controllerPromise;
        await exportScene3DToPptx(controller, getActiveAnimation());
        showToast('3D presentation downloaded.', 'success', 2400);
      } catch (err) {
        showToast(err?.message || 'Could not export 3D presentation.', 'error', 4000);
      } finally {
        exportPptxBtn.disabled = false;
        exportPptxBtn.textContent = originalText;
      }
    },
  });
  const tourBtn = el('button', {
    type: 'button', class: 'btn btn-secondary scene3d-btn', text: '🎬 Camera Tour',
    title: 'Build a sequence of camera shots — manually, or auto-generated per component — and play/export it',
    onClick: () => {
      tourPanelOpen = !tourPanelOpen;
      tourBtn.classList.toggle('active', tourPanelOpen);
      tourPanel.classList.toggle('open', tourPanelOpen);
      if (tourPanelOpen) renderTourPanel();
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
  controls.appendChild(tourBtn);
  controls.appendChild(exportBtn);
  controls.appendChild(exportPptxBtn);
  controls.appendChild(closeBtn);
  // A shared flex container (not two independently `position: fixed`
  // elements with a guessed pixel gap between them) so the tour panel
  // always sits directly above the controls row regardless of how tall
  // that row actually renders — `.scene3d-controls` wraps onto 2-3 lines
  // well before mobile width once every button here is present, and a
  // fixed offset sized for one row overlapped the wrapped rows underneath
  // (confirmed via an actual mobile-width screenshot, not just code review).
  const bottomBar = el('div', { class: 'scene3d-bottom-bar' });
  bottomBar.appendChild(tourPanel);
  bottomBar.appendChild(controls);
  overlay.appendChild(bottomBar);

  document.body.appendChild(overlay);

  onScene3DChange((active) => {
    overlay.classList.toggle('open', active);
    updatePlayBtn();
    if (active) {
      controllerPromise = mountScene3D(canvasEl);
      // A fresh mount always starts in stylized (non-realistic) mode with no
      // camera tour configured yet — keep every toggle's visual state in
      // sync rather than carrying over whatever a previous open left behind.
      realisticBtn.classList.remove('active');
      tourPanelOpen = false;
      tourLoopEnabled = false;
      tourBtn.classList.remove('active');
      tourPanel.classList.remove('open');
      controllerPromise.then((controller) => {
        unsubscribeTour = controller.onTourChange(() => { if (tourPanelOpen) renderTourPanel(); });
      });
    } else if (controllerPromise) {
      controllerPromise.then((controller) => controller.dispose());
      controllerPromise = null;
      if (unsubscribeTour) { unsubscribeTour(); unsubscribeTour = null; }
      if (isAnimationPlaying()) stopAnimationPlayback();
    }
  });
}

export function isScene3DOpen() {
  return isScene3DActive();
}
