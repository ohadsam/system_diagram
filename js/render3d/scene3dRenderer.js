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

function makeLabelSprite(THREE, text, width) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#F9FAFB';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((text || '').slice(0, 24), canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(Math.max(width, 80), Math.max(width, 80) / 4, 1);
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
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 10000);
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(300, 600, 400);
  scene.add(dirLight);

  const contentGroup = new THREE.Group();
  scene.add(contentGroup);

  // Custom orbit camera — a plain spherical-coordinates drag/zoom
  // controller, not Three.js's OrbitControls addon: that ships as a
  // separate ES module under examples/jsm, which would mean vendoring a
  // second file just for this; a basic drag-to-orbit + wheel-to-zoom is
  // ~30 lines and covers everything this feature actually needs.
  let target = { x: 0, y: 0, z: 0 };
  let radius = 800;
  let theta = Math.PI / 4; // horizontal angle
  let phi = Math.PI / 3.2; // vertical angle (from the +Y axis)
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function updateCamera() {
    const clampedPhi = Math.min(Math.PI - 0.05, Math.max(0.05, phi));
    camera.position.set(
      target.x + radius * Math.sin(clampedPhi) * Math.sin(theta),
      target.y + radius * Math.cos(clampedPhi),
      target.z + radius * Math.sin(clampedPhi) * Math.cos(theta),
    );
    camera.lookAt(target.x, target.y, target.z);
  }

  const onPointerDown = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
  const onPointerMove = (e) => {
    if (!dragging) return;
    theta -= (e.clientX - lastX) * 0.006;
    phi -= (e.clientY - lastY) * 0.006;
    lastX = e.clientX; lastY = e.clientY;
    updateCamera();
  };
  const onPointerUp = () => { dragging = false; };
  const onWheel = (e) => {
    e.preventDefault();
    radius = Math.min(4000, Math.max(150, radius + e.deltaY * 0.8));
    updateCamera();
  };
  canvasEl.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('wheel', onWheel, { passive: false });

  // Per-node ambient "thinking" particle swarms and chip decals, and
  // per-edge cable flow particles — tracked so the render loop can animate
  // them without re-walking the whole scene graph every frame.
  let thinkingSwarms = []; // { points, basePositions, phase }
  let cableFlows = []; // { points, curve, offsets }
  let disposables = []; // geometries/materials/textures to dispose on rebuild/unmount

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
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const node of nodes) {
      if (hiddenKeys.has(`node:${node.id}`)) continue;
      const n3d = computeNode3D(node);
      node3DById.set(node.id, n3d);
      minX = Math.min(minX, n3d.x); maxX = Math.max(maxX, n3d.x);
      minZ = Math.min(minZ, n3d.z); maxZ = Math.max(maxZ, n3d.z);

      const isActive = activeKeys.has(`node:${node.id}`);
      const geometry = new THREE.BoxGeometry(n3d.width, n3d.height, n3d.depth);
      const material = new THREE.MeshStandardMaterial({ color: n3d.color, opacity: isActive ? 1 : 0.35, transparent: !isActive });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(n3d.x, n3d.y, n3d.z);
      contentGroup.add(mesh);
      disposables.push(geometry, material);

      const edgesGeo = new THREE.EdgesGeometry(geometry);
      const edgesMat = new THREE.LineBasicMaterial({ color: 0x111827 });
      const outline = new THREE.LineSegments(edgesGeo, edgesMat);
      mesh.add(outline);
      disposables.push(edgesGeo, edgesMat);

      const label = makeLabelSprite(THREE, n3d.label, Math.max(n3d.width, 60));
      label.position.set(0, n3d.height / 2 + 30, 0);
      mesh.add(label);
      disposables.push(label.material, label.material.map);

      if (isActive) {
        // Ambient "thinking" particle swarm inside the box — a handful of
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

        // Two small pulsing "chip" decals on the top face — CPU/RAM flair.
        for (const dx of [-n3d.width * 0.2, n3d.width * 0.2]) {
          const chipGeo = new THREE.BoxGeometry(n3d.width * 0.18, 4, n3d.depth * 0.18);
          const chipMat = new THREE.MeshStandardMaterial({ color: 0x111827, emissive: THINKING_COLOR, emissiveIntensity: 0.5 });
          const chip = new THREE.Mesh(chipGeo, chipMat);
          chip.position.set(dx, n3d.height / 2 + 2, 0);
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
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 4, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({ color: e3d.color });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      contentGroup.add(tube);
      disposables.push(tubeGeo, tubeMat);

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
      target = { x: (minX + maxX) / 2, y: 60, z: (minZ + maxZ) / 2 };
      const spanX = maxX - minX;
      const spanZ = maxZ - minZ;
      radius = Math.max(400, Math.max(spanX, spanZ) * 0.9);
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
    if (!dragging) {
      theta += dt * 0.12;
      updateCamera();
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

  buildScene();
  resize();
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
    clearContent();
    renderer.dispose();
  }

  return { dispose, getRenderTargetCanvas: () => canvasEl };
}
