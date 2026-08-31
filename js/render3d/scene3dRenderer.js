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
      const geometry = new THREE.BoxGeometry(n3d.width, n3d.height, n3d.depth);
      const material = new THREE.MeshStandardMaterial({
        color: n3d.color, opacity: isActive ? 1 : 0.35, transparent: !isActive, roughness: 0.55, metalness: 0.12,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(n3d.x, n3d.y, n3d.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
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

        // Two small pulsing "activity light" decals near the top-front edge —
        // small emissive spheres read as status LEDs at a glance; a wide flat
        // box in the same spot (the original approach) foreshortens under an
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
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 4, 8, false);
      const tubeMat = new THREE.MeshStandardMaterial({ color: e3d.color, roughness: 0.4, metalness: 0.3 });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.receiveShadow = true;
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
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      target = { x: cx, y: maxY / 2, z: cz };

      // A large ground plane + grid grounds the whole scene — without one,
      // boxes read as floating cut-outs in a black void with no sense of
      // scale, orientation, or which one is "in front." Sized/recreated per
      // rebuild (rather than a fixed size) so a small 2-node diagram doesn't
      // get an absurdly oversized floor and a huge diagram isn't cropped by
      // an undersized one.
      const footprint = Math.max(maxX - minX, maxZ - minZ, 300);
      const groundSize = footprint * 4;
      const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
      const groundMat = new THREE.MeshStandardMaterial({ color: 0x161c2c, roughness: 1, metalness: 0 });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(cx, -0.5, cz);
      ground.receiveShadow = true;
      contentGroup.add(ground);
      disposables.push(groundGeo, groundMat);

      const divisions = Math.min(60, Math.max(10, Math.round(groundSize / 80)));
      const grid = new THREE.GridHelper(groundSize, divisions, 0x3a4a72, 0x1f2740);
      grid.position.set(cx, 0.2, cz);
      grid.material.transparent = true;
      grid.material.opacity = 0.55;
      contentGroup.add(grid);
      disposables.push(grid.geometry, grid.material);

      // Point the key light and its shadow frustum at the content's actual
      // center — a fixed-offset light with a fixed shadow frustum (the
      // previous approach) would aim at whatever happened to be near world
      // origin, so a diagram built far from (0,0) would render with no
      // visible shadows at all (everything outside the frustum is simply
      // unshadowed) rather than an obviously-wrong shadow.
      const sphereR = Math.max(300, Math.sqrt(((maxX - minX) / 2) ** 2 + (maxY / 2) ** 2 + ((maxZ - minZ) / 2) ** 2));
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
      // near/far (the original approach) fades in well before the camera's
      // fitted distance for any diagram bigger than a handful of nodes,
      // washing out the diagram itself instead of just the empty void
      // beyond it. Tying both to the just-computed radius keeps the fade
      // starting past the camera and finishing well beyond the content,
      // at any scale.
      scene.fog.near = radius * 1.1;
      scene.fog.far = radius * 4;
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
    clearContent();
    renderer.dispose();
  }

  // Lets the overlay's "Reset View" button recover from a user having
  // spun/zoomed the (pan-less) custom orbit camera somewhere disorienting —
  // re-fits distance/target to the current content and snaps the angle back
  // to the default framing, same as a fresh open.
  function resetView() {
    theta = DEFAULT_THETA;
    phi = DEFAULT_PHI;
    buildScene();
  }

  return { dispose, resetView, getRenderTargetCanvas: () => canvasEl };
}
