// Origin 3D chrome logo (homepage hero only; loaded after page load + idle, never on shopping pages).
//
// - Extrudes assets/logo.svg with a soft bevel (the mark is two simple shapes, so runtime
//   extrusion is a few ms — see DECISIONS D-022).
// - Polished chrome with a touch of iridescence, lit by a procedural studio environment (no HDR).
// - ✦ sparkles: additive point sprites with a per-point twinkle, drawn in the shader.
// - Fly-through: the swoosh + star leave an almost-closed loop. We rasterize the mark, find the
//   point in that loop with the most clearance (the "counter"), and fly the camera along the axis
//   through it. The near plane is far smaller than that clearance, so the camera never clips.
// - Capped pixel ratio, renders only while visible, frame-time watchdog, full dispose().

import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  ExtrudeGeometry,
  Box3,
  Vector3,
  PMREMGenerator,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  MathUtils,
  SVGLoader,
  RoomEnvironment,
} from './vendor-three.js';

const LOGO_WIDTH = 4; // world units
const CAMERA_START_Z = 9;
const CAMERA_END_Z = -2;

/**
 * Finds the most open point inside the logo's (almost) enclosed loop, in SVG coordinates.
 * Raster approach: occupancy grid → keep empty cells that are walled in on ≥6 of 8 directions →
 * pick the one farthest from any ink. Returns { x, y, radius }.
 */
function findLoopCenter(pathData, viewBox) {
  const [vx, vy, vw, vh] = viewBox;
  const cols = 120;
  const rows = Math.round((cols * vh) / vw);
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.scale(cols / vw, rows / vh);
  ctx.translate(-vx, -vy);
  ctx.fill(new Path2D(pathData), 'evenodd');
  const pixels = ctx.getImageData(0, 0, cols, rows).data;
  const ink = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && pixels[(y * cols + x) * 4 + 3] > 127;

  const inkCells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (ink(x, y)) inkCells.push([x, y]);

  const directions = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  const walled = (x, y) => {
    let hits = 0;
    for (const [dx, dy] of directions) {
      for (let step = 1; step < cols; step++) {
        const px = x + dx * step;
        const py = y + dy * step;
        if (px < 0 || py < 0 || px >= cols || py >= rows) break;
        if (ink(px, py)) {
          hits++;
          break;
        }
      }
    }
    return hits >= 6;
  };

  let best = null;
  for (let y = 1; y < rows - 1; y += 1) {
    for (let x = 1; x < cols - 1; x += 1) {
      if (ink(x, y) || !walled(x, y)) continue;
      let nearest = Infinity;
      for (const [ix, iy] of inkCells) {
        const d = (ix - x) ** 2 + (iy - y) ** 2;
        if (d < nearest) nearest = d;
      }
      if (!best || nearest > best.d) best = { x, y, d: nearest };
    }
  }
  if (!best) return { x: vx + vw / 2, y: vy + vh / 2, radius: 0 };
  const cell = vw / cols;
  return { x: vx + (best.x + 0.5) * cell, y: vy + (best.y + 0.5) * cell, radius: Math.sqrt(best.d) * cell };
}

const sparkleVertex = /* glsl */ `
  attribute float aPhase;
  attribute float aSize;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float twinkle = pow(max(0.0, sin(uTime * 1.6 + aPhase * 6.2831)), 12.0);
    vAlpha = twinkle;
    gl_PointSize = aSize * uPixelRatio * (0.35 + twinkle) * (8.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const sparkleFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    // four-point star: thin cross + soft core
    float cross = max(1.0 - abs(p.x) * 14.0, 0.0) * (1.0 - abs(p.y)) + max(1.0 - abs(p.y) * 14.0, 0.0) * (1.0 - abs(p.x));
    float core = exp(-dot(p, p) * 18.0);
    float a = (cross * 0.9 + core) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(1.0, 0.98, 0.94) * a, a);
  }
`;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string} svgText - contents of assets/logo.svg
 * @param {{ mobile: boolean, sparkles: number, tilt: number, onFirstFrame?: () => void, onSlow?: () => void }} options
 */
export function createChromeLogo(canvas, svgText, options) {
  const { mobile, sparkles = 40, tilt = 1, onFirstFrame, onSlow } = options;

  const renderer = new WebGLRenderer({
    canvas,
    antialias: !mobile && window.devicePixelRatio < 2,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environment = environment;

  const camera = new PerspectiveCamera(30, 1, 0.01, 100);
  camera.position.set(0, 0, CAMERA_START_Z);

  // ---------- geometry ----------
  const svg = new SVGLoader().parse(svgText);
  const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path));
  const geometry = new ExtrudeGeometry(shapes, {
    depth: 70,
    bevelEnabled: true,
    bevelThickness: 18,
    bevelSize: 9,
    bevelSegments: mobile ? 3 : 5,
    curveSegments: mobile ? 8 : 14,
  });

  const box = new Box3().setFromBufferAttribute(geometry.getAttribute('position'));
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const scale = LOGO_WIDTH / size.x;
  geometry.translate(-center.x, -center.y, -center.z);
  // SVG y points down. Flipping y *and* z is a 180° turn about x (not a mirror), so faces keep
  // their winding and the extrusion's front ends up facing the camera.
  geometry.scale(scale, -scale, -scale);

  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.07,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    iridescence: 0.3,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [180, 520],
    envMapIntensity: 2.1,
  });

  const logo = new Group();
  const mesh = new Mesh(geometry, material);
  logo.add(mesh);
  scene.add(logo);

  // ---------- fly-through target (from the loop "counter") ----------
  const viewBox = (svgText.match(/viewBox="([^"]+)"/)?.[1] || '0 0 100 100').split(/[\s,]+/).map(Number);
  const pathData = svgText.match(/ d="([^"]+)"/)?.[1] || '';
  const loop = findLoopCenter(pathData, viewBox);
  const target = new Vector3((loop.x - center.x) * scale, -(loop.y - center.y) * scale, 0);
  const clearance = loop.radius * scale; // world units
  // Near-plane half-diagonal must stay inside the clearance (minus the bevel) — assert it.
  const halfDiagonal = camera.near * Math.tan(MathUtils.degToRad(camera.fov / 2)) * Math.hypot(1, 3);
  const safe = clearance - 9 * scale > halfDiagonal;

  // ---------- sparkles ----------
  const sparkleCount = mobile ? Math.round(sparkles / 2) : sparkles;
  const positions = [];
  const phases = [];
  const sizes = [];
  const half = new Vector3(size.x * scale, size.y * scale, 0).multiplyScalar(0.5);
  while (positions.length / 3 < sparkleCount) {
    positions.push(MathUtils.randFloatSpread(half.x * 2.1), MathUtils.randFloatSpread(half.y * 2.1), 0.2 + Math.random() * 0.3);
    phases.push(Math.random());
    sizes.push(10 + Math.random() * 16);
  }
  const sparkleGeometry = new BufferGeometry();
  sparkleGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  sparkleGeometry.setAttribute('aPhase', new Float32BufferAttribute(phases, 1));
  sparkleGeometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  const sparkleMaterial = new ShaderMaterial({
    vertexShader: sparkleVertex,
    fragmentShader: sparkleFragment,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  logo.add(new Points(sparkleGeometry, sparkleMaterial));

  // ---------- state ----------
  let progress = 0;
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  let running = false;
  let frame = 0;
  let firstFrameDone = false;
  let slowFrames = 0;
  let sampled = 0;
  let last = performance.now();
  const startTime = last;

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // keep the whole mark in frame on narrow screens
    camera.position.z = CAMERA_START_Z * Math.max(1, 1.25 / camera.aspect);
    camera.updateProjectionMatrix();
  }

  function render(now) {
    const delta = Math.min(now - last, 100);
    last = now;

    // Phase 1 (0 → 0.3): turn face-on and line up with the loop. Phase 2 (0.3 → 1): dolly through.
    const turn = MathUtils.smoothstep(progress, 0, 0.3);
    // Accelerating dolly: with END_Z = -2 the camera crosses the logo plane at ~93% scroll,
    // right on the flash cut.
    const dollyT = MathUtils.clamp((progress - 0.3) / 0.7, 0, 1);
    const dolly = dollyT * dollyT;
    const tiltWeight = (1 - turn) * tilt;

    eased.x += (pointer.x - eased.x) * Math.min(1, delta / 120);
    eased.y += (pointer.y - eased.y) * Math.min(1, delta / 120);
    const idle = (now - startTime) / 1000;

    logo.rotation.y = MathUtils.lerp(-0.42 + Math.sin(idle * 0.5) * 0.06, 0, turn) + eased.x * 0.25 * tiltWeight;
    logo.rotation.x = MathUtils.lerp(0.14, 0, turn) - eased.y * 0.18 * tiltWeight;
    logo.position.y = Math.sin(idle * 0.9) * 0.05 * (1 - turn);

    const startZ = CAMERA_START_Z * Math.max(1, 1.25 / camera.aspect);
    camera.position.x = MathUtils.lerp(0, target.x, turn);
    camera.position.y = MathUtils.lerp(0, target.y, turn);
    camera.position.z = MathUtils.lerp(startZ, safe ? CAMERA_END_Z : 1.2, dolly);
    camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 1);

    sparkleMaterial.uniforms.uTime.value = idle;
    renderer.render(scene, camera);

    if (!firstFrameDone) {
      firstFrameDone = true;
      onFirstFrame?.();
    } else if (sampled < 90) {
      // Watchdog: if most early frames blow the budget, hand back to the static logo.
      sampled++;
      if (delta > 34) slowFrames++;
      if (sampled === 90 && slowFrames > 45) onSlow?.();
    }
    if (running) frame = requestAnimationFrame(render);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  return {
    loop: { ...loop, safe },
    setProgress(value) {
      progress = MathUtils.clamp(value, 0, 1);
      if (!running) render(performance.now());
    },
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(render);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
    },
    dispose() {
      this.stop();
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      sparkleGeometry.dispose();
      sparkleMaterial.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
