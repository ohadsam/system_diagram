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
import { getUiPrefs, saveUiPrefs } from '../io/uiPrefs.js';
import { showToast } from '../utils/toast.js';

let controllerPromise = null;
let canvasEl = null;

const POSITION_META = [
  { id: 'top', icon: '⬆️', label: 'Top' },
  { id: 'bottom', icon: '⬇️', label: 'Bottom' },
  { id: 'left', icon: '⬅️', label: 'Left' },
  { id: 'right', icon: '➡️', label: 'Right' },
];

/** Builds one main control-bar button with its icon and label in separate
 * spans — so "⚙️ Layout"'s compact/expanded choice can hide just the label
 * text via CSS (`.scene3d-bar.compact .scene3d-btn-label`) without needing
 * to rebuild every button's content, and a real `title` + `aria-label`
 * stay present either way so a screen reader (or anyone hovering) still
 * gets a full description even in icon-only mode. Returns the button with
 * a `setContent(icon, label)` method for buttons whose text changes at
 * runtime (Play/Stop, Recording…/Exporting…). */
function makeSceneBtn({ icon, label, title, className = 'btn btn-secondary scene3d-btn', onClick }) {
  const iconEl = el('span', { class: 'scene3d-btn-icon', text: icon });
  const labelEl = el('span', { class: 'scene3d-btn-label', text: label ? ` ${label}` : '' });
  const btn = el('button', {
    type: 'button', class: className, title, 'aria-label': label || title, onClick,
  }, [iconEl, labelEl]);
  btn.setContent = (nextIcon, nextLabel) => {
    iconEl.textContent = nextIcon;
    labelEl.textContent = nextLabel ? ` ${nextLabel}` : '';
    btn.setAttribute('aria-label', nextLabel || title);
  };
  return btn;
}

export function initScene3DOverlay() {
  const overlay = el('div', { class: 'scene3d-overlay' });
  canvasEl = el('canvas', { class: 'scene3d-canvas' });
  overlay.appendChild(canvasEl);

  let tourPanelOpen = false;
  let tourLoopEnabled = false;
  let unsubscribeTour = null;
  const tourPanel = el('div', { class: 'scene3d-panel scene3d-tour-panel' });

  let layoutPanelOpen = false;
  const layoutPanel = el('div', { class: 'scene3d-panel scene3d-layout-panel' });

  async function renderTourPanel() {
    const controller = await controllerPromise;
    if (!controller) return;
    clear(tourPanel);
    const shots = controller.getTourShots();
    const playing = controller.isTourPlaying();

    tourPanel.appendChild(el('div', { class: 'scene3d-panel-header' }, [
      el('strong', { text: '🎬 Camera Tour' }),
      el('span', {
        class: 'scene3d-panel-count',
        text: shots.length ? `${shots.length} shot${shots.length === 1 ? '' : 's'}` : 'No shots yet',
      }),
    ]));

    const list = el('div', { class: 'scene3d-tour-list' });
    if (!shots.length) {
      list.appendChild(el('div', {
        class: 'scene3d-panel-empty',
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
      title: playing ? 'Stop the camera tour where it currently is' : 'Play through every shot in order, holding briefly on each',
      disabled: !shots.length,
      onClick: () => {
        if (controller.isTourPlaying()) controller.stopTour();
        else controller.startTour({ loop: tourLoopEnabled });
      },
    }));
    playbackRow.appendChild(el('label', {
      class: 'scene3d-tour-loop', title: 'Keep touring indefinitely instead of stopping after one pass through the shots',
    }, [
      el('input', {
        type: 'checkbox', checked: tourLoopEnabled,
        onChange: (e) => { tourLoopEnabled = e.target.checked; },
      }),
      ' Loop',
    ]));
    tourPanel.appendChild(playbackRow);
  }

  /** "⚙️ Layout" panel — lets the whole bar (this panel included) dock to
   * any edge of the screen, and its main-row buttons switch between
   * icon+text and icon-only. Rebuilt on every open/change (cheap: 6 small
   * buttons) so the active choice's highlight always matches the current
   * `io/uiPrefs.js` state, same pattern as renderTourPanel above. */
  function renderLayoutPanel() {
    clear(layoutPanel);
    const prefs = getUiPrefs();

    layoutPanel.appendChild(el('div', { class: 'scene3d-panel-header' }, [
      el('strong', { text: '⚙️ Layout' }),
    ]));

    layoutPanel.appendChild(el('div', { class: 'scene3d-layout-section-label', text: 'Dock to' }));
    const posRow = el('div', { class: 'scene3d-layout-row' });
    for (const { id, icon, label } of POSITION_META) {
      posRow.appendChild(el('button', {
        type: 'button',
        class: `scene3d-layout-choice-btn${prefs.scene3dBarPosition === id ? ' active' : ''}`,
        title: `Dock this control bar to the ${label.toLowerCase()} of the screen`,
        text: `${icon} ${label}`,
        onClick: () => { saveUiPrefs({ scene3dBarPosition: id }); applyBarPrefs(); renderLayoutPanel(); },
      }));
    }
    layoutPanel.appendChild(posRow);

    layoutPanel.appendChild(el('div', { class: 'scene3d-layout-section-label', text: 'Buttons' }));
    const displayRow = el('div', { class: 'scene3d-layout-row' });
    displayRow.appendChild(el('button', {
      type: 'button',
      class: `scene3d-layout-choice-btn${!prefs.scene3dBarCompact ? ' active' : ''}`,
      title: "Show every button's full text label alongside its icon",
      text: '🔤 Icons + Text',
      onClick: () => { saveUiPrefs({ scene3dBarCompact: false }); applyBarPrefs(); renderLayoutPanel(); },
    }));
    displayRow.appendChild(el('button', {
      type: 'button',
      class: `scene3d-layout-choice-btn${prefs.scene3dBarCompact ? ' active' : ''}`,
      title: 'Show just icons, hiding text labels, to take up less screen space',
      text: '🔘 Icons Only',
      onClick: () => { saveUiPrefs({ scene3dBarCompact: true }); applyBarPrefs(); renderLayoutPanel(); },
    }));
    layoutPanel.appendChild(displayRow);
  }

  const controls = el('div', { class: 'scene3d-controls' });
  const playBtn = makeSceneBtn({
    icon: '▶️', label: 'Play Animation',
    title: 'Play or stop the Diagram Animation reveal inside this 3D view',
    onClick: () => { if (isAnimationPlaying()) stopAnimationPlayback(); else startAnimationPlayback(); },
  });
  const prevBtn = makeSceneBtn({ icon: '⬅️', label: 'Previous', title: 'Go back one step in the Diagram Animation', onClick: prevStep });
  const nextBtn = makeSceneBtn({ icon: '➡️', label: 'Next', title: 'Advance one step in the Diagram Animation', onClick: nextStep });
  const resetViewBtn = makeSceneBtn({
    icon: '🎯', label: 'Reset View',
    title: 'Recenter and re-fit the camera on the diagram — the only way back if a drag/scroll leaves you looking at empty space, since there is no pan, only orbit and zoom',
    onClick: () => { controllerPromise?.then((controller) => controller.resetView()); },
  });
  const realisticBtn = makeSceneBtn({
    icon: '🏢', label: 'Realistic Room',
    title: 'Toggle a more realistic look: an enclosing room with textured walls, a ceiling, and more detailed component surfaces',
    onClick: async () => {
      const controller = await controllerPromise;
      if (!controller) return;
      const next = !controller.isRealisticMode();
      controller.setRealisticMode(next);
      realisticBtn.classList.toggle('active', next);
    },
  });
  const exportBtn = makeSceneBtn({
    icon: '🎥', label: 'Export 3D Video',
    title: 'Record this view (and any 🎬 Camera Tour or Diagram Animation) to a downloadable video file',
    onClick: async () => {
      exportBtn.disabled = true;
      exportBtn.setContent('⏳', 'Recording…');
      try {
        const controller = await controllerPromise;
        await exportAnimationTo3DVideo(canvasEl, getActiveAnimation(), controller);
        showToast('3D video downloaded.', 'success', 2400);
      } catch (err) {
        showToast(err?.message || 'Could not export 3D video.', 'error', 4000);
      } finally {
        exportBtn.disabled = false;
        exportBtn.setContent('🎥', 'Export 3D Video');
      }
    },
  });
  const exportPptxBtn = makeSceneBtn({
    icon: '📊', label: 'Export 3D Presentation',
    title: 'Export this view to a downloadable .pptx: one slide per 🎬 Camera Tour shot (or Diagram Animation step)',
    onClick: async () => {
      exportPptxBtn.disabled = true;
      exportPptxBtn.setContent('⏳', 'Exporting…');
      try {
        const controller = await controllerPromise;
        await exportScene3DToPptx(controller, getActiveAnimation());
        showToast('3D presentation downloaded.', 'success', 2400);
      } catch (err) {
        showToast(err?.message || 'Could not export 3D presentation.', 'error', 4000);
      } finally {
        exportPptxBtn.disabled = false;
        exportPptxBtn.setContent('📊', 'Export 3D Presentation');
      }
    },
  });
  const tourBtn = makeSceneBtn({
    icon: '🎬', label: 'Camera Tour',
    title: 'Build a sequence of camera shots — manually, or auto-generated per component — and play/export it',
    onClick: () => {
      tourPanelOpen = !tourPanelOpen;
      // The two floating panels are mutually exclusive — both anchor to
      // the same edge of the bar, and showing both at once on a narrow
      // screen would be cramped for little benefit.
      if (tourPanelOpen && layoutPanelOpen) { layoutPanelOpen = false; layoutBtn.classList.remove('active'); layoutPanel.classList.remove('open'); }
      tourBtn.classList.toggle('active', tourPanelOpen);
      tourPanel.classList.toggle('open', tourPanelOpen);
      if (tourPanelOpen) renderTourPanel();
    },
  });
  const layoutBtn = makeSceneBtn({
    icon: '⚙️', label: 'Layout',
    title: 'Choose which side of the screen this control bar docks to, and whether its buttons show text labels or just icons',
    onClick: () => {
      layoutPanelOpen = !layoutPanelOpen;
      if (layoutPanelOpen && tourPanelOpen) { tourPanelOpen = false; tourBtn.classList.remove('active'); tourPanel.classList.remove('open'); }
      layoutBtn.classList.toggle('active', layoutPanelOpen);
      layoutPanel.classList.toggle('open', layoutPanelOpen);
      if (layoutPanelOpen) renderLayoutPanel();
    },
  });
  const closeBtn = makeSceneBtn({
    icon: '✕', label: 'Close 3D View', className: 'btn btn-primary scene3d-btn scene3d-close',
    title: 'Close 3D Presentation and return to normal 2D editing — nothing about your diagram is changed by this view',
    onClick: () => setScene3DActive(false),
  });

  function updatePlayBtn() {
    const playing = isAnimationPlaying();
    playBtn.setContent(playing ? '⏹️' : '▶️', playing ? 'Stop Animation' : 'Play Animation');
    const hasSteps = !!(getActiveAnimation()?.steps?.length);
    playBtn.disabled = !hasSteps && !playing;
  }
  onAnimationChange(updatePlayBtn);
  updatePlayBtn();

  controls.appendChild(playBtn);
  controls.appendChild(prevBtn);
  controls.appendChild(nextBtn);
  controls.appendChild(resetViewBtn);
  controls.appendChild(realisticBtn);
  controls.appendChild(tourBtn);
  controls.appendChild(layoutBtn);
  controls.appendChild(exportBtn);
  controls.appendChild(exportPptxBtn);
  controls.appendChild(closeBtn);

  // A shared flex container (not several independently `position: fixed`
  // elements each guessing a sibling's size/offset) so the floating panels
  // always sit directly next to the controls row, on whichever screen edge
  // the user picked, regardless of how tall/wide that row actually renders
  // — see css/toolbar.css's `.scene3d-bar[data-position=...]` rules for the
  // `order`-based layout that keeps this correct at all four positions.
  const bar = el('div', { class: 'scene3d-bar' });
  bar.appendChild(tourPanel);
  bar.appendChild(layoutPanel);
  bar.appendChild(controls);
  overlay.appendChild(bar);

  /** Applies the user's saved dock position + compact/expanded choice to
   * the live bar — called on every open (prefs persist across opens/
   * closes, unlike the per-open resets below) and immediately after any
   * change made from the Layout panel itself. */
  function applyBarPrefs() {
    const prefs = getUiPrefs();
    bar.dataset.position = prefs.scene3dBarPosition;
    bar.classList.toggle('compact', prefs.scene3dBarCompact);
  }
  applyBarPrefs();

  document.body.appendChild(overlay);

  onScene3DChange((active) => {
    overlay.classList.toggle('open', active);
    updatePlayBtn();
    if (active) {
      controllerPromise = mountScene3D(canvasEl);
      applyBarPrefs();
      // A fresh mount always starts in stylized (non-realistic) mode with no
      // camera tour configured yet, and both floating panels closed — keep
      // every toggle's visual state in sync rather than carrying over
      // whatever a previous open left behind. (Dock position/compact mode
      // are the one exception — those are meant to persist across opens.)
      realisticBtn.classList.remove('active');
      tourPanelOpen = false;
      tourLoopEnabled = false;
      tourBtn.classList.remove('active');
      tourPanel.classList.remove('open');
      layoutPanelOpen = false;
      layoutBtn.classList.remove('active');
      layoutPanel.classList.remove('open');
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
