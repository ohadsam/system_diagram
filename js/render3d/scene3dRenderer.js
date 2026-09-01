// The actual Three.js scene for "🧊 3D Presentation" (Tools menu) — turns
// the current diagram into a rotatable 3D view for presentation flair.
// Geometry mapping lives in core/scene3dLayout.js (pure, unit-tested);
// everything WebGL/DOM-touching lives here, so it only gets e2e coverage
// (same split, and same reasoning, as canvas/animationOverlay.js vs.
// core/animationPlayback.js).
//
// Lazily imports the vendored Three.js ES module (vendor/VENDOR.md) only
// when a 3D view is actually opened — never on page load.
import * as store from '../core/store.js';
import { computeNode3D, computeEdge3D } from '../core/scene3dLayout.js';
import { isAnimationPlaying, getAnimationPlaybackState, onAnimationChange } from '../core/animationPlayback.js';
import { TOUR_HOLD_MS, TOUR_MOVE_MS, interpolateShot, computeAutoTourShots } from '../core/cameraTour.js';

const VENDOR_PATH = new URL('../../vendor/three.module.min.js', import.meta.url).href;
const THINKING_COLOR = 0x22d3ee;
const PARTICLES_PER_NODE = 10;
const CABLE_PARTICLES = 6;

let modulePromise = null;
function loadThree() {
  if (!modulePromise) modulePromise = import(VENDOR_PATH);
  return modulePromise;
}

/** Which node/edge ids currently count as "active" (should render
 * lit/animated rather than dim/hidden) — mirrors canvas.js's own
 * applyAnimationVisibility logic exactly (same steps/revealedCount
 * source), so the 3D view agrees with the 2D canvas about what's
 * "revealed so far" during a Diagram Animation presentation. With no
 * active animation, every node/edge is active (ambient idle mode). */
function computeActiveKeys(nodes, edges) {
  if (!isAnimationPlaying()) {
    return { hiddenKeys: new Set(), activeKeys: new Set([...nodes.map((n) => `node:${n.id}`), ...edges.map((e) => `edge:${e.id}`)]) };
  }
  const { steps, revealedCount } = getAnimationPlaybackState();
  const hiddenKeys = new Set(steps.slice(revealedCount).flatMap((s) => s.targets).map((t) => `${t.targetType}:${t.targetId}`));
  const activeKeys = new Set(steps.slice(0, revealedCount).flatMap((s) => s.targets).map((t) => `${t.targetType}:${t.targetId}`));
  return { hiddenKeys, activeKeys };
}

// --- Procedural "drawn" textures ---------------------------------------
// This app has no photographic/illustrated asset pipeline (components are
// styled with flat color + an emoji icon in the 2D canvas), so "make it
// look like real server-farm/network hardware" is built the same way the
// existing label sprites already are: draw it onto a <canvas> and use that
// as a Three.js texture. Every texture here is drawn once per distinct
// (kind, color) pair and cached for the life of the mounted scene (see
// `textureCache` in `mountScene3D`) — regenerating and re-uploading a canvas
// texture to the GPU on every store-change rebuild (this scene rebuilds on
// every project edit) would be wasteful for a diagram with many
// same-colored components, which is the common case (every node in one
// category shares a color).

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#6B7280');
  if (!m) return { r: 107, g: 114, b: 128 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

/** A server-chassis front panel: base color, a faint brushed-metal
 * gradient, horizontal 1U rack-unit seams, and a couple of small status
 * LEDs — used for the default ('rack') visual kind, i.e. most components.
 * In "🏢 Realistic Room" mode (`realistic`), drawn at higher resolution
 * with an actual drive-bay look per rack unit (a handle + vent slits)
 * instead of a plain seam line, and a small vendor label plate. */
function drawRackTexture(colorHex, realistic) {
  const size = realistic ? 256 : 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, size, size);
  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.10)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (!realistic) {
    ctx.strokeStyle = shade(colorHex, -70);
    ctx.lineWidth = 2;
    for (let y = 14; y < size; y += 18) {
      ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(size - 4, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(34, 211, 238, 0.95)';
    for (let y = 14; y < size; y += 36) {
      ctx.beginPath(); ctx.arc(14, y - 7, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(248, 113, 113, 0.7)';
    for (let y = 32; y < size; y += 36) {
      ctx.beginPath(); ctx.arc(22, y - 7, 2, 0, Math.PI * 2); ctx.fill();
    }
    return canvas;
  }

  // Realistic mode: each "rack unit" band gets its own recessed drive bay
  // — a darker inset rectangle with vent slits and a handle — instead of
  // a single seam line, plus a small backlit vendor label plate.
  const unitHeight = 32;
  for (let y = 8; y + unitHeight < size; y += unitHeight) {
    ctx.fillStyle = shade(colorHex, -35);
    ctx.fillRect(10, y, size - 20, unitHeight - 6);
    ctx.strokeStyle = shade(colorHex, -80);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(10, y, size - 20, unitHeight - 6);
    ctx.strokeStyle = shade(colorHex, -60);
    for (let x = 20; x < size - 20; x += 6) {
      ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + unitHeight - 12); ctx.stroke();
    }
    ctx.fillStyle = shade(colorHex, -90);
    ctx.fillRect(size - 34, y + 4, 6, unitHeight - 14);
  }
  ctx.fillStyle = 'rgba(34, 211, 238, 0.95)';
  ctx.beginPath(); ctx.arc(20, 20, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(248, 113, 113, 0.75)';
  ctx.beginPath(); ctx.arc(32, 20, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(15, 20, 32, 0.55)';
  ctx.fillRect(size - 70, 10, 56, 14);
  ctx.fillStyle = 'rgba(226, 240, 255, 0.7)';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('SYS-01', size - 66, 20);
  return canvas;
}

/** Stacked-disk-platter rings for the 'storage' visual kind (databases,
 * caches — anything drawn as a cylinder in 2D). Drawn as horizontal bands;
 * CylinderGeometry's default UVs wrap the side surface's V axis along the
 * cylinder's height, so these bands render as actual encircling rings. In
 * "🏢 Realistic Room" mode, adds a brushed-metal radial highlight and a
 * small circular "activity window" instead of a plain LED stripe. */
function drawStorageTexture(colorHex, realistic) {
  const w = realistic ? 128 : 64;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, w, h);
  if (realistic) {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.18)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.05)');
    grad.addColorStop(1, 'rgba(255,255,255,0.1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.strokeStyle = shade(colorHex, -55);
  ctx.lineWidth = 1.5;
  for (let y = 6; y < h; y += 8) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  if (realistic) {
    ctx.fillStyle = 'rgba(15, 20, 32, 0.4)';
    ctx.beginPath(); ctx.arc(w / 2, 24, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w / 2, 24, 6, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.fillRect(0, 10, w, 3);
  }
  return canvas;
}

/** A raised data-center floor tile: a bordered panel with corner screws.
 * Color-independent (one shared texture for the whole scene, tiled via
 * `repeat`), replacing a flat color + wireframe grid with something that
 * actually reads as a real floor rather than a debug overlay. */
function drawFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#161c2c';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 124, 124);
  ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  for (const [cx, cy] of [[16, 16], [112, 16], [16, 112], [112, 112]]) {
    ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  return canvas;
}

/** A data-center wall panel: perforated vent panels alternating with a
 * cable-conduit trim strip. Color-independent (one shared texture, tiled
 * via `repeat` around the room's cylindrical wall) — used only in
 * "🏢 Realistic Room" mode. */
function drawWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b2236';
  ctx.fillRect(0, 0, 256, 256);
  // vertical panel seams
  ctx.strokeStyle = 'rgba(10, 14, 24, 0.8)';
  ctx.lineWidth = 3;
  for (let x = 0; x < 256; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  // perforated vent dots, panel by panel
  ctx.fillStyle = 'rgba(10, 14, 24, 0.55)';
  for (let px = 10; px < 256; px += 64) {
    for (let y = 20; y < 140; y += 14) {
      for (let x = px; x < px + 44; x += 11) {
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  // a cable-conduit trim strip near the top
  ctx.fillStyle = '#11172a';
  ctx.fillRect(0, 160, 256, 14);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 164); ctx.lineTo(256, 164); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 170); ctx.lineTo(256, 170); ctx.stroke();
  return canvas;
}

/** A recessed-light ceiling panel: a grid of soft glowing tiles. */
function drawCeilingTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0e1322';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(10, 14, 24, 0.6)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }
  for (let x = 32; x < 256; x += 64) {
    for (let y = 32; y < 256; y += 64) {
      const grad = ctx.createRadialGradient(x, y, 2, x, y, 24);
      grad.addColorStop(0, 'rgba(226, 240, 255, 0.65)');
      grad.addColorStop(1, 'rgba(226, 240, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - 24, y - 24, 48, 48);
    }
  }
  return canvas;
}

/** A short, repeatable network/power-cable pattern (a color band with a
 * darker connector-segment stripe) for cable tubes — tiled several times
 * along the tube's length via `repeat.y` so a cable reads as a real,
 * segmented cable run rather than a single flat-shaded pipe. */
function drawCableTexture(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = shade(colorHex, -45);
  ctx.fillRect(0, 0, 32, 5);
  return canvas;
}

function getOrCreateTexture(THREE, cache, key, drawFn) {
  let tex = cache.get(key);
  if (!tex) {
    tex = new THREE.CanvasTexture(drawFn());
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    cache.set(key, tex);
  }
  return tex;
}

/** Builds the geometry + material(s) for one node's `visualKind` (see
 * core/scene3dLayout.js#getVisualKind) — the whole point being that a
 * diagram doesn't render as a field of identical boxes: a database looks
 * like a stacked-disk drum, a decision diamond like a gem, a hexagon like
 * a hex prism, a circle like a sphere, and everything else (the majority
 * of components) like a textured server-chassis box. Returns `material`
 * (what to assign to the mesh — a single material, or a per-geometry-group
 * array for `storage`'s distinct side/cap treatment) and `materials` (the
 * same, always flattened to an array, for the caller to register for
 * disposal — cached *textures* are deliberately not included here, see the
 * texture cache note above). `outline` says whether a crisp EdgesGeometry
 * outline suits this shape (flat-faced shapes) or would look noisy on it
 * (smooth/round shapes get none).
 *
 * Non-uniform sizing is baked into the *geometry* via `.scale()`, never
 * `mesh.scale` — a mesh-level scale would also distort every child added
 * later (the label sprite, status-light decals), squashing them along with
 * the body. */
function buildNodeVisual(THREE, n3d, isActive, textureCache, realistic) {
  const { width: w, height: h, depth: d, visualKind: kind, color } = n3d;
  const opacity = isActive ? 1 : 0.35;
  const transparent = !isActive;

  if (kind === 'storage') {
    const radius = Math.max(10, Math.min(w, d) / 2);
    const geometry = new THREE.CylinderGeometry(radius, radius, h, 28, 1, false);
    const sideTex = getOrCreateTexture(THREE, textureCache, `storage:${color}:${realistic}`, () => drawStorageTexture(color, realistic));
    sideTex.repeat.set(1, Math.max(1, h / 40));
    const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.35, metalness: 0.4, opacity, transparent });
    const capMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3, opacity, transparent });
    return { geometry, material: [sideMat, capMat, capMat], materials: [sideMat, capMat], outline: false };
  }
  if (kind === 'decision') {
    const geometry = new THREE.OctahedronGeometry(1);
    geometry.scale(w / 2, h / 2, d / 2);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.25, opacity, transparent });
    return { geometry, material, materials: [material], outline: true };
  }
  if (kind === 'orb') {
    const geometry = new THREE.SphereGeometry(1, 24, 16);
    geometry.scale(w / 2, h / 2, d / 2);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.15, opacity, transparent });
    return { geometry, material, materials: [material], outline: false };
  }
  if (kind === 'hex') {
    const radius = Math.max(10, Math.min(w, d) / 2);
    const geometry = new THREE.CylinderGeometry(radius, radius, h, 6);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.15, opacity, transparent });
    return { geometry, material, materials: [material], outline: true };
  }
  if (kind === 'pillar') {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, opacity, transparent });
    return { geometry, material, materials: [material], outline: true };
  }
  // 'rack' — the default: a textured server-chassis box.
  const geometry = new THREE.BoxGeometry(w, h, d);
  const tex = getOrCreateTexture(THREE, textureCache, `rack:${color}:${realistic}`, () => drawRackTexture(color, realistic));
  const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.18, opacity, transparent });
  return { geometry, material, materials: [material], outline: true };
}

// Canvas width is sized to the *actual measured text*, not a fixed 256px —
// a fixed width silently truncated any label past ~15-20 characters (e.g.
// "Elastic Load Balancer" rendered as "lastic Load Balance"), which read as
// a rendering bug rather than an intentional label. Sprite scale is then
// derived from the canvas's own aspect ratio so longer labels get a wider
// (not squashed) plate instead of stretching fixed geometry over new pixels.
function makeLabelSprite(THREE, text, width) {
  const label = (text || '').slice(0, 40);
  const font = 'bold 28px sans-serif';
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const textWidth = measure.measureText(label).width;
  const paddingX = 28;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(720, Math.max(256, Math.ceil(textWidth + paddingX * 2)));
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(15, 20, 32, 0.88)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, 14);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  ctx.fillStyle = '#F9FAFB';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(material);
  const spriteHeight = Math.max(width, 60) / 4;
  sprite.scale.set(spriteHeight * (canvas.width / canvas.height), spriteHeight, 1);
  return sprite;
}

/**
 * Mounts a live, self-updating 3D scene onto `canvasEl` (already sized to
 * fill its container by the caller — see canvas/scene3dOverlay.js).
 * Rebuilds geometry whenever the project or animation-playback state
 * changes; runs its own render loop for the ambient "thinking" particle
 * and cable-flow animation. Returns `{ dispose, getRenderTargetCanvas }` —
 * `dispose()` MUST be called when the 3D view closes: a WebGLRenderer
 * holds a real GPU context that is never released just because the
 * `<canvas>` element is removed from the DOM, and this app's overlay can
 * be opened/closed repeatedly in one session, so leaking one every time
 * would exhaust the browser's (small, fixed) WebGL context limit within a
 * handful of opens.
 */
export async function mountScene3D(canvasEl) {
  const THREE = await loadThree();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1420);
  scene.fog = new THREE.Fog(0x0f1420, 1200, 4200);
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // A single directional light left every face not directly facing it
  // reading as near-black, and boxes floated with no shadow to ground them
  // against the floor — a hemisphere light (soft sky/floor color split) plus
  // a dim un-shadowed fill light from the opposite side fixes the former;
  // the directional key light casting real shadows fixes the latter. Fog is
  // purely presentational: it fades the otherwise-infinite black void at the
  // horizon so distant empty space reads as atmosphere, not a hard void edge.
  scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x0b0f1a, 0.55));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1536, 1536);
  dirLight.shadow.bias = -0.0015;
  scene.add(dirLight);
  scene.add(dirLight.target);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-1, 0.4, -1);
  scene.add(fillLight);

  const contentGroup = new THREE.Group();
  scene.add(contentGroup);

  // Canvas-drawn textures (server chassis, disk platters, floor tile,
  // cable pattern) are cached here for the life of the mounted scene —
  // keyed by "kind:color" (or a single fixed key for the color-independent
  // floor) — since `buildScene()` below runs on every store change and
  // regenerating + re-uploading identical canvas textures on every edit
  // would be wasteful. Disposed once in `dispose()`, not per-rebuild.
  const textureCache = new Map();

  // Custom orbit camera — a plain spherical-coordinates drag/zoom
  // controller, not Three.js's OrbitControls addon: that ships as a
  // separate ES module under examples/jsm, which would mean vendoring a
  // second file just for this; a basic drag-to-orbit + wheel-to-zoom is
  // ~30 lines and covers everything this feature actually needs.
  const DEFAULT_THETA = Math.PI / 4;
  const DEFAULT_PHI = Math.PI / 3.2;
  let target = { x: 0, y: 0, z: 0 };
  let radius = 800;
  let theta = DEFAULT_THETA; // horizontal angle
  let phi = DEFAULT_PHI; // vertical angle (from the +Y axis)
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  // "🏢 Realistic Room" mode (see buildScene's room-building block below):
  // wraps the scene in an enclosing cylindrical room. `zoomMaxRadius` caps
  // how far the wheel can zoom out — in room mode it's set (every rebuild)
  // to just inside the room's wall radius, since the camera orbits at a
  // fixed spherical distance regardless of angle and a wall closer than
  // that distance would otherwise get clipped through from some angle.
  let realisticMode = false;
  let zoomMaxRadius = 4000;

  // Auto-fit's own last-computed framing, snapshotted fresh on every
  // buildScene() rebuild — kept separate from the live/interactive
  // target/radius above (which the user's own drag/zoom mutates) so
  // "🎬 Camera Tour"'s auto-generated Overview shot always uses the
  // diagram's true default framing, regardless of whatever the user has
  // since done to the live camera.
  let defaultTarget = { x: 0, y: 0, z: 0 };
  let defaultRadius = 800;

  // "🎬 Camera Tour" — an ordered list of camera-pose "shots" (see
  // core/cameraTour.js), buildable manually (capture the current view) or
  // automatically (one shot per component + an overview), then played back
  // by holding on each shot and tweening to the next. Lives entirely in
  // this mounted-scene closure (not a shared core/ module) since a tour is
  // scoped to one open 3D view, unlike the Diagram Animation playback state
  // in core/animationPlayback.js, which both the 2D canvas and this 3D view
  // read from together.
  let tourShots = [];
  let tourPlaying = false;
  let tourLoop = false;
  let tourIndex = 0; // shot currently held at (or animating away from)
  let tourToIndex = 0; // shot currently animating toward, while phase is 'move'
  let tourPhase = 'hold'; // 'hold' | 'move'
  let tourPhaseElapsed = 0;
  let tourFinishResolve = null; // resolves playTourForExport()'s promise
  let tourListeners = [];

  function notifyTourChange() {
    for (const cb of tourListeners) cb();
  }
  function onTourChange(cb) {
    tourListeners.push(cb);
    return () => { tourListeners = tourListeners.filter((fn) => fn !== cb); };
  }

  function setCameraFromShot(shot) {
    theta = shot.theta;
    phi = shot.phi;
    radius = shot.radius;
    target = { ...shot.target };
    updateCamera();
  }

  function finishTourPlayback() {
    tourPlaying = false;
    notifyTourChange();
    if (tourFinishResolve) {
      const resolve = tourFinishResolve;
      tourFinishResolve = null;
      resolve();
    }
  }

  function getTourShots() {
    return tourShots.map((s) => ({ ...s, target: { ...s.target } }));
  }
  function isTourPlaying() {
    return tourPlaying;
  }
  function addTourShotFromCurrentView(label) {
    const shot = {
      theta, phi, radius,
      target: { x: target.x, y: target.y, z: target.z },
      label: (label || `Shot ${tourShots.length + 1}`).slice(0, 60),
    };
    tourShots = [...tourShots, shot];
    notifyTourChange();
    return getTourShots();
  }
  function removeTourShot(index) {
    // Editing the list mid-playback would leave tourIndex/tourToIndex
    // pointing at a stale or out-of-range shot (the render loop's tick()
    // would then read `undefined` and throw) — stop touring first, same
    // "manual input always wins" rule the drag/wheel handlers already
    // follow, rather than trying to remap the indices.
    if (tourPlaying) finishTourPlayback();
    tourShots = tourShots.filter((_, i) => i !== index);
    notifyTourChange();
  }
  function moveTourShot(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= tourShots.length) return;
    if (tourPlaying) finishTourPlayback();
    const copy = tourShots.slice();
    const [item] = copy.splice(fromIndex, 1);
    copy.splice(Math.max(0, Math.min(copy.length, toIndex)), 0, item);
    tourShots = copy;
    notifyTourChange();
  }
  function clearTour() {
    if (tourPlaying) finishTourPlayback();
    tourShots = [];
    notifyTourChange();
  }
  function setCameraToShot(index) {
    const shot = tourShots[index];
    if (!shot) return;
    setCameraFromShot(shot);
  }
  function autoGenerateTour() {
    if (tourPlaying) finishTourPlayback();
    const nodes = store.getState().nodes;
    const nodes3D = nodes.map((n) => computeNode3D(n));
    tourShots = computeAutoTourShots(nodes3D, { theta: DEFAULT_THETA, phi: DEFAULT_PHI, radius: defaultRadius, target: defaultTarget });
    notifyTourChange();
    return getTourShots();
  }
  // Starts (or restarts) playback from the first shot. `loop: true` keeps
  // touring indefinitely (transitioning from the last shot back to the
  // first); otherwise it plays through once and stops, holding on the last
  // shot — the shape both the "▶️ Play Tour" button and video/pptx export
  // need, just with `loop` fixed to `false` for the latter two.
  function startTour({ loop = false } = {}) {
    if (!tourShots.length) return;
    tourLoop = loop;
    tourIndex = 0;
    tourToIndex = 0;
    tourPhase = 'hold';
    tourPhaseElapsed = 0;
    tourPlaying = true;
    notifyTourChange();
  }
  function stopTour() {
    if (!tourPlaying) return;
    finishTourPlayback();
  }
  // Plays the tour once (never looping, regardless of any live loop
  // setting) and resolves once it reaches the end — the driving timeline
  // for "🎥 Export 3D Video" when a tour exists. Resolves immediately with
  // no tour configured, so callers can await it unconditionally.
  function playTourForExport() {
    if (!tourShots.length) return Promise.resolve();
    return new Promise((resolve) => {
      tourFinishResolve = resolve;
      startTour({ loop: false });
    });
  }
  // Renders the current frame and reads it back synchronously, in the same
  // task — the WebGLRenderer here is created without `preserveDrawingBuffer`
  // (the default, and deliberately so: that flag has a real perf cost and
  // every other consumer of this canvas just wants the live animated
  // stream), so an async `canvasEl.toDataURL()` call risks reading back a
  // blank/garbage frame if the browser has already swapped/cleared the
  // drawing buffer by the time it runs. Calling `render()` and
  // `toDataURL()` back-to-back with no `await` in between sidesteps that
  // entirely: nothing clears the buffer between the two synchronous calls.
  function captureStillFrame() {
    renderer.render(scene, camera);
    return canvasEl.toDataURL('image/png');
  }

  function updateCamera() {
    const clampedPhi = Math.min(Math.PI - 0.05, Math.max(0.05, phi));
    camera.position.set(
      target.x + radius * Math.sin(clampedPhi) * Math.sin(theta),
      target.y + radius * Math.cos(clampedPhi),
      target.z + radius * Math.sin(clampedPhi) * Math.cos(theta),
    );
    camera.lookAt(target.x, target.y, target.z);
  }

  const onPointerDown = (e) => {
    // Manual input always wins: grabbing the view mid-tour hands control
    // straight back to the user rather than fighting the tour's own camera
    // updates every frame.
    if (tourPlaying) stopTour();
    dragging = true; lastX = e.clientX; lastY = e.clientY;
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    theta -= (e.clientX - lastX) * 0.006;
    phi -= (e.clientY - lastY) * 0.006;
    lastX = e.clientX; lastY = e.clientY;
    updateCamera();
  };
  const onPointerUp = () => { dragging = false; };
  const onWheel = (e) => {
    if (tourPlaying) stopTour();
    e.preventDefault();
    radius = Math.min(zoomMaxRadius, Math.max(150, radius + e.deltaY * 0.8));
    updateCamera();
  };
  canvasEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('wheel', onWheel, { passive: false });

  // Per-node ambient "thinking" particle swarms and status-light decals, and
  // per-edge cable flow particles — tracked so the render loop can animate
  // them without re-walking the whole scene graph every frame.
  let thinkingSwarms = []; // { points, basePositions, phase }
  let cableFlows = []; // { points, curve, offsets }
  let disposables = []; // geometries/materials to dispose on rebuild/unmount (NOT cached textures — see textureCache)

  function clearContent() {
    while (contentGroup.children.length) {
      const child = contentGroup.children.pop();
      contentGroup.remove(child);
    }
    for (const d of disposables) d.dispose?.();
    disposables = [];
    thinkingSwarms = [];
    cableFlows = [];
  }

  function buildScene() {
    clearContent();
    const state = store.getState();
    const nodes = state.nodes;
    const edges = state.edges;
    const { hiddenKeys, activeKeys } = computeActiveKeys(nodes, edges);

    const node3DById = new Map();
    // Full box extents (not just center points) so the camera auto-fit below
    // actually accounts for how big the boxes themselves are — tracking only
    // center x/z (as this used to) let a handful of widely-spaced-but-large
    // boxes compute a radius so tight the boxes overflowed the viewport.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      if (hiddenKeys.has(`node:${node.id}`)) continue;
      const n3d = computeNode3D(node);
      node3DById.set(node.id, n3d);
      minX = Math.min(minX, n3d.x - n3d.width / 2); maxX = Math.max(maxX, n3d.x + n3d.width / 2);
      minZ = Math.min(minZ, n3d.z - n3d.depth / 2); maxZ = Math.max(maxZ, n3d.z + n3d.depth / 2);
      maxY = Math.max(maxY, n3d.height);

      const isActive = activeKeys.has(`node:${node.id}`);
      const { geometry, material, materials, outline } = buildNodeVisual(THREE, n3d, isActive, textureCache, realisticMode);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(n3d.x, n3d.y, n3d.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      contentGroup.add(mesh);
      disposables.push(geometry, ...materials);

      if (outline) {
        const edgesGeo = new THREE.EdgesGeometry(geometry);
        const edgesMat = new THREE.LineBasicMaterial({ color: 0x111827 });
        mesh.add(new THREE.LineSegments(edgesGeo, edgesMat));
        disposables.push(edgesGeo, edgesMat);
      }

      const label = makeLabelSprite(THREE, n3d.label, Math.max(n3d.width, 60));
      label.position.set(0, n3d.height / 2 + 30, 0);
      mesh.add(label);
      disposables.push(label.material, label.material.map);

      if (isActive) {
        // Ambient "thinking" particle swarm inside the volume — a handful of
        // points bouncing within its bounds, purely a presentation effect
        // (as if packets of data/computation were visibly happening).
        const count = PARTICLES_PER_NODE;
        const positions = new Float32Array(count * 3);
        const basePositions = [];
        for (let i = 0; i < count; i++) {
          const px = (Math.random() - 0.5) * n3d.width * 0.7;
          const py = (Math.random() - 0.5) * n3d.height * 0.7;
          const pz = (Math.random() - 0.5) * n3d.depth * 0.7;
          positions[i * 3] = px; positions[i * 3 + 1] = py; positions[i * 3 + 2] = pz;
          basePositions.push({ x: px, y: py, z: pz, phase: Math.random() * Math.PI * 2 });
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: THINKING_COLOR, size: 6, sizeAttenuation: true });
        const points = new THREE.Points(geo, mat);
        mesh.add(points);
        disposables.push(geo, mat);
        thinkingSwarms.push({ points, basePositions });

        // Two small pulsing "activity light" decals near the top-front edge —
        // small emissive spheres read as status LEDs at a glance; a wide flat
        // box in the same spot (an earlier approach) foreshortens under an
        // oblique camera into a slanted parallelogram that looks like a
        // rendering glitch rather than an intentional detail.
        const chipRadius = Math.max(3, Math.min(n3d.width, n3d.depth) * 0.045);
        for (const dx of [-n3d.width * 0.25, n3d.width * 0.25]) {
          const chipGeo = new THREE.SphereGeometry(chipRadius, 12, 10);
          const chipMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: THINKING_COLOR, emissiveIntensity: 0.6, roughness: 0.4 });
          const chip = new THREE.Mesh(chipGeo, chipMat);
          chip.position.set(dx, n3d.height / 2 + chipRadius * 0.6, n3d.depth / 2 - chipRadius * 1.5);
          chip.userData.pulsePhase = Math.random() * Math.PI * 2;
          mesh.add(chip);
          disposables.push(chipGeo, chipMat);
          thinkingSwarms.push({ chip });
        }
      }
    }

    for (const edge of edges) {
      if (hiddenKeys.has(`edge:${edge.id}`)) continue;
      const from = node3DById.get(edge.from);
      const to = node3DById.get(edge.to);
      if (!from || !to) continue;
      const e3d = computeEdge3D(from, to);
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(e3d.start.x, e3d.start.y, e3d.start.z),
        new THREE.Vector3(e3d.mid.x, e3d.mid.y, e3d.mid.z),
        new THREE.Vector3(e3d.end.x, e3d.end.y, e3d.end.z),
      );
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 4, 10, false);
      // A repeating cable-segment texture (rather than a flat-shaded pipe)
      // reads as a real network/power cable run; tiled along the tube's
      // length (TubeGeometry's V axis) proportionally to how long it is.
      const cableTex = getOrCreateTexture(THREE, textureCache, `cable:${e3d.color}`, () => drawCableTexture(e3d.color));
      cableTex.repeat.set(1, Math.max(2, Math.round(curve.getLength() / 40)));
      const tubeMat = new THREE.MeshStandardMaterial({ map: cableTex, roughness: 0.4, metalness: 0.35 });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.receiveShadow = true;
      contentGroup.add(tube);
      disposables.push(tubeGeo, tubeMat);

      // Small dark "connector plug" caps at each end — a plain pipe end
      // reads as an unfinished stub; a capped end reads as a real cable
      // plugged into something.
      for (const t of [0, 1]) {
        const p = curve.getPoint(t);
        const plugGeo = new THREE.SphereGeometry(7, 10, 8);
        const plugMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.5 });
        const plug = new THREE.Mesh(plugGeo, plugMat);
        plug.position.copy(p);
        contentGroup.add(plug);
        disposables.push(plugGeo, plugMat);
      }

      const isActive = activeKeys.has(`edge:${edge.id}`);
      if (isActive) {
        const count = CABLE_PARTICLES;
        const positions = new Float32Array(count * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: e3d.color, size: 10, sizeAttenuation: true });
        const points = new THREE.Points(geo, mat);
        contentGroup.add(points);
        disposables.push(geo, mat);
        cableFlows.push({ points, curve, offsets: Array.from({ length: count }, (_, i) => i / count) });
      }
    }

    if (Number.isFinite(minX)) {
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      target = { x: cx, y: maxY / 2, z: cz };

      // Content's bounding-sphere radius — drives the key light's shadow
      // frustum below, the camera auto-fit further down, and (in
      // "🏢 Realistic Room" mode) the room's own size.
      const sphereR = Math.max(300, Math.sqrt(((maxX - minX) / 2) ** 2 + (maxY / 2) ** 2 + ((maxZ - minZ) / 2) ** 2));
      // The room is a cylinder (see the room-building block further down)
      // sized comfortably larger than the content so it reads as "a big
      // room the diagram sits inside," not a tight-fitting box.
      const wallRadius = Math.max(1200, sphereR * 2.4);
      const wallHeight = Math.max(maxY * 3, 700);

      // A large textured floor grounds the whole scene — without one,
      // volumes read as floating cut-outs in a black void with no sense of
      // scale, orientation, or which one is "in front." Sized/recreated per
      // rebuild (rather than a fixed size) so a small 2-node diagram doesn't
      // get an absurdly oversized floor and a huge diagram isn't cropped by
      // an undersized one. The tile texture itself is cached/shared (it's
      // color-independent), only the plane geometry + its repeat count vary.
      // In realistic-room mode the floor is sized to exactly fill the room
      // instead, so there's no visible seam between "floor" and "room."
      const footprint = Math.max(maxX - minX, maxZ - minZ, 300);
      const groundSize = realisticMode ? wallRadius * 2 : footprint * 4;
      const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
      const floorTex = getOrCreateTexture(THREE, textureCache, 'floor', () => drawFloorTexture());
      floorTex.repeat.set(groundSize / 140, groundSize / 140);
      const groundMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1, metalness: 0 });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(cx, -0.5, cz);
      ground.receiveShadow = true;
      contentGroup.add(ground);
      disposables.push(groundGeo, groundMat);

      // Point the key light and its shadow frustum at the content's actual
      // center — a fixed-offset light with a fixed shadow frustum (the
      // previous approach) would aim at whatever happened to be near world
      // origin, so a diagram built far from (0,0) would render with no
      // visible shadows at all (everything outside the frustum is simply
      // unshadowed) rather than an obviously-wrong shadow.
      dirLight.position.set(cx + sphereR * 0.8, maxY + sphereR * 1.4, cz + sphereR);
      dirLight.target.position.set(cx, maxY / 2, cz);
      dirLight.target.updateMatrixWorld();
      const cam = dirLight.shadow.camera;
      cam.left = -sphereR * 1.4; cam.right = sphereR * 1.4;
      cam.top = sphereR * 1.4; cam.bottom = -sphereR * 1.4;
      cam.near = 10; cam.far = sphereR * 6;
      cam.updateProjectionMatrix();

      // Fit the camera distance to the content's bounding sphere against
      // whichever of the vertical/horizontal FOV is more restrictive, with
      // generous padding — the previous formula (span * 0.9, clamped to a
      // flat 400 minimum) ignored box width/depth/height entirely, so a
      // cluster of ordinarily-sized boxes routinely computed a radius small
      // enough that the boxes themselves overflowed the viewport.
      const vFov = (camera.fov * Math.PI) / 180;
      const aspect = camera.aspect || 1.6;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      const fitDistance = sphereR / Math.sin(Math.min(vFov, hFov) / 2);
      radius = Math.max(350, fitDistance * 1.25);

      // Fog range must scale with content size, not stay fixed — a fixed
      // near/far (an earlier approach) fades in well before the camera's
      // fitted distance for any diagram bigger than a handful of nodes,
      // washing out the diagram itself instead of just the empty void
      // beyond it. Tying both to the just-computed radius keeps the fade
      // starting past the camera and finishing well beyond the content,
      // at any scale. In realistic-room mode the fog's far distance is
      // also pushed out past the room's own wall radius, or the walls
      // themselves would fade into the fog before the camera ever reaches
      // its zoom limit.
      scene.fog.near = radius * 1.1;
      scene.fog.far = realisticMode ? Math.max(radius * 4, wallRadius * 1.3) : radius * 4;

      if (realisticMode) {
        // The camera orbits at a fixed spherical distance (`radius`) from
        // `target` regardless of angle, so the only way to guarantee it
        // never clips through an enclosing wall from *some* rotation is a
        // wall shaped as a cylinder (constant horizontal radius at every
        // angle) with a zoom-out cap safely inside that radius — capping
        // just the auto-fit distance isn't enough, since the user can still
        // scroll-zoom out further.
        zoomMaxRadius = wallRadius * 0.92;

        // Wall: a large cylinder around the content, textured as data-center
        // wall panels, rendered from the *inside* (`THREE.BackSide` — a
        // cylinder's default winding faces outward, invisible from a camera
        // inside it) so it reads as an enclosing room rather than a solid
        // pillar. `openEnded` since a ceiling is added separately below.
        const wallTex = getOrCreateTexture(THREE, textureCache, 'wall', () => drawWallTexture());
        wallTex.repeat.set(Math.max(4, Math.round((wallRadius * Math.PI * 2) / 260)), Math.max(1, wallHeight / 260));
        const wallGeo = new THREE.CylinderGeometry(wallRadius, wallRadius, wallHeight, 48, 1, true);
        const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 0.85, metalness: 0.1 });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(cx, wallHeight / 2 - 0.5, cz);
        wall.receiveShadow = true;
        contentGroup.add(wall);
        disposables.push(wallGeo, wallMat);

        // Ceiling: a flat disc capping the cylinder, also rendered from
        // the inside, with a recessed-light-panel texture.
        const ceilingTex = getOrCreateTexture(THREE, textureCache, 'ceiling', () => drawCeilingTexture());
        ceilingTex.repeat.set(Math.max(2, Math.round(wallRadius / 220)), Math.max(2, Math.round(wallRadius / 220)));
        const ceilingGeo = new THREE.CircleGeometry(wallRadius, 48);
        const ceilingMat = new THREE.MeshStandardMaterial({ map: ceilingTex, side: THREE.BackSide, roughness: 0.9, metalness: 0 });
        const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(cx, wallHeight - 0.5, cz);
        contentGroup.add(ceiling);
        disposables.push(ceilingGeo, ceilingMat);

        // A couple of soft, non-shadow-casting point lights standing in for
        // ceiling fixtures — the directional key light alone reads as
        // outdoor sunlight, which breaks the "indoors" illusion the room
        // geometry is going for.
        // (Lights have no GPU geometry/material to dispose — removed from
        // the scene graph via `clearContent()`'s contentGroup sweep like
        // any other child, same as everything else added above.)
        for (const [ox, oz] of [[-wallRadius * 0.35, -wallRadius * 0.2], [wallRadius * 0.35, wallRadius * 0.3]]) {
          const fixture = new THREE.PointLight(0xdbe9ff, 0.6, wallRadius * 2.2, 2);
          fixture.position.set(cx + ox, wallHeight - 40, cz + oz);
          contentGroup.add(fixture);
        }
      } else {
        zoomMaxRadius = 4000;
      }
      radius = Math.min(radius, zoomMaxRadius);
      defaultTarget = { ...target };
      defaultRadius = radius;
    }
    updateCamera();
  }

  function resize() {
    const rect = canvasEl.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  let rafHandle = null;
  const clock = { last: performance.now() };
  function tick() {
    rafHandle = requestAnimationFrame(tick);
    const now = performance.now();
    const dt = (now - clock.last) / 1000;
    clock.last = now;

    // A slow ambient auto-rotate whenever the viewer isn't actively
    // dragging — keeps the view visibly "alive" even with nothing else
    // happening, and (not incidentally) is what makes a recorded 3D video
    // export look like a real orbiting shot rather than a static frame
    // with moving particles in front of it.
    if (!dragging && !tourPlaying) {
      theta += dt * 0.12;
      updateCamera();
    }

    if (tourPlaying && tourShots.length) {
      tourPhaseElapsed += dt * 1000;
      if (tourShots.length === 1) {
        setCameraFromShot(tourShots[0]);
        if (!tourLoop && tourPhaseElapsed >= TOUR_HOLD_MS) finishTourPlayback();
      } else if (tourPhase === 'hold') {
        setCameraFromShot(tourShots[tourIndex]);
        if (tourPhaseElapsed >= TOUR_HOLD_MS) {
          const isLast = tourIndex === tourShots.length - 1;
          if (isLast && !tourLoop) {
            finishTourPlayback();
          } else {
            tourToIndex = isLast ? 0 : tourIndex + 1;
            tourPhase = 'move';
            tourPhaseElapsed = 0;
          }
        }
      } else {
        const t = tourPhaseElapsed / TOUR_MOVE_MS;
        const pose = interpolateShot(tourShots[tourIndex], tourShots[tourToIndex], t);
        theta = pose.theta; phi = pose.phi; radius = pose.radius; target = pose.target;
        updateCamera();
        if (t >= 1) {
          tourIndex = tourToIndex;
          tourPhase = 'hold';
          tourPhaseElapsed = 0;
        }
      }
    }

    for (const swarm of thinkingSwarms) {
      if (swarm.chip) {
        swarm.chip.userData.pulsePhase += dt * 3;
        swarm.chip.material.emissiveIntensity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(swarm.chip.userData.pulsePhase));
        continue;
      }
      const attr = swarm.points.geometry.getAttribute('position');
      for (let i = 0; i < swarm.basePositions.length; i++) {
        const b = swarm.basePositions[i];
        b.phase += dt * 1.5;
        attr.array[i * 3] = b.x + Math.sin(b.phase) * 6;
        attr.array[i * 3 + 1] = b.y + Math.cos(b.phase * 1.3) * 6;
        attr.array[i * 3 + 2] = b.z + Math.sin(b.phase * 0.7) * 6;
      }
      attr.needsUpdate = true;
    }

    for (const flow of cableFlows) {
      const attr = flow.points.geometry.getAttribute('position');
      for (let i = 0; i < flow.offsets.length; i++) {
        flow.offsets[i] = (flow.offsets[i] + dt * 0.25) % 1;
        const p = flow.curve.getPointAt(flow.offsets[i]);
        attr.array[i * 3] = p.x; attr.array[i * 3 + 1] = p.y; attr.array[i * 3 + 2] = p.z;
      }
      attr.needsUpdate = true;
    }

    renderer.render(scene, camera);
  }

  resize();
  buildScene();
  updateCamera();
  tick();

  const unsubscribeStore = store.subscribe('change', buildScene);
  const unsubscribeAnim = onAnimationChange(buildScene);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvasEl);

  function dispose() {
    cancelAnimationFrame(rafHandle);
    unsubscribeStore();
    unsubscribeAnim();
    resizeObserver.disconnect();
    canvasEl.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    canvasEl.removeEventListener('wheel', onWheel);
    tourPlaying = false;
    tourListeners = [];
    clearContent();
    for (const tex of textureCache.values()) tex.dispose();
    textureCache.clear();
    renderer.dispose();
  }

  // Lets the overlay's "Reset View" button recover from a user having
  // spun/zoomed the (pan-less) custom orbit camera somewhere disorienting —
  // re-fits distance/target to the current content and snaps the angle back
  // to the default framing, same as a fresh open.
  function resetView() {
    if (tourPlaying) stopTour();
    theta = DEFAULT_THETA;
    phi = DEFAULT_PHI;
    buildScene();
  }

  // Toggles "🏢 Realistic Room" mode (see the room-building block in
  // `buildScene`) — rebuilds immediately so the room appears/disappears
  // right away, and re-fits the camera the same way a fresh open would
  // (including re-clamping the zoom to the new mode's wall, if any).
  function setRealisticMode(value) {
    realisticMode = !!value;
    buildScene();
  }
  function isRealisticMode() {
    return realisticMode;
  }

  return {
    dispose, resetView, setRealisticMode, isRealisticMode, getRenderTargetCanvas: () => canvasEl,
    // "🎬 Camera Tour" API — see the tour state block above for the full
    // design rationale. Available in both stylized and realistic-room mode
    // (nothing about it is mode-specific).
    getTourShots, isTourPlaying, addTourShotFromCurrentView, removeTourShot, moveTourShot,
    clearTour, setCameraToShot, autoGenerateTour, startTour, stopTour, playTourForExport,
    onTourChange, captureStillFrame,
  };
}
