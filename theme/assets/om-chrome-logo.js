// Origin 3D chrome logo (homepage hero only; loaded after page load + idle, never on shopping pages).
//
// - Extrudes assets/logo.svg with a soft bevel (two simple shapes: a few ms, D-027).
// - Polished chrome with a touch of iridescence, lit by a procedural studio environment (no HDR).
// - ✦ sparkles: additive point sprites with a per-point twinkle, drawn in the shader.
// - Enters with one 360° turn. While the hero scrolls, the DOM moves the whole canvas into the
//   header (om-hero.js); here the logo just turns face-on so it lands flat, matching the header
//   mark (D-099). `setFit()` sizes the mark to exactly the vector fallback's box, so the vector,
//   the 3D logo and the header mark share one geometry.
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
const SPIN_MS = 1600;

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
 * @param {{ mobile: boolean, sparkles: number, tilt: number, fit: number, entranceSpin?: boolean,
 *   onFirstFrame?: () => void, onSlow?: () => void }} options
 *   fit = the logo's width as a fraction of the canvas width (matches the vector fallback).
 */
export function createChromeLogo(canvas, svgText, options) {
  const { mobile, sparkles = 40, tilt = 1, entranceSpin = true, onFirstFrame, onSlow } = options;
  let fit = options.fit || 0.6;

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

  const camera = new PerspectiveCamera(30, 1, 0.1, 200);

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
  logo.add(new Mesh(geometry, material));
  scene.add(logo);

  // ---------- sparkles ----------
  const sparkleCount = mobile ? Math.round(sparkles / 2) : sparkles;
  const positions = [];
  const phases = [];
  const sizes = [];
  const halfW = (size.x * scale) / 2;
  const halfH = (size.y * scale) / 2;
  while (positions.length / 3 < sparkleCount) {
    positions.push(MathUtils.randFloatSpread(halfW * 2.1), MathUtils.randFloatSpread(halfH * 2.1), 0.2 + Math.random() * 0.3);
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
  let progress = 0; // 0 = centered hero pose, 1 = docked in the header
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  let running = false;
  let frame = 0;
  let firstFrameDone = false;
  let slowFrames = 0;
  let sampled = 0;
  let last = performance.now();
  const startTime = last;
  let spinStart = null;

  /** Camera distance that makes the logo span `fit` of the canvas width. */
  function placeCamera() {
    const halfFov = MathUtils.degToRad(camera.fov / 2);
    camera.position.set(0, 0, LOGO_WIDTH / (fit * 2 * Math.tan(halfFov) * camera.aspect));
    camera.lookAt(0, 0, 0);
  }

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    placeCamera();
  }

  function render(now) {
    const delta = Math.min(now - last, 100);
    last = now;

    // Face-on by the time it reaches the header, so it lands flat like the header mark.
    const settle = MathUtils.smoothstep(progress, 0, 0.8);
    const tiltWeight = (1 - settle) * tilt;

    eased.x += (pointer.x - eased.x) * Math.min(1, delta / 120);
    eased.y += (pointer.y - eased.y) * Math.min(1, delta / 120);
    const idle = (now - startTime) / 1000;

    let spin = 0;
    if (spinStart !== null) {
      const t = Math.min(1, (now - spinStart) / SPIN_MS);
      spin = -((1 - t) ** 3) * Math.PI * 2; // −2π → 0, ease-out cubic
      if (t === 1) spinStart = null;
    }

    logo.rotation.y =
      MathUtils.lerp(-0.42 + Math.sin(idle * 0.5) * 0.06, 0, settle) + eased.x * 0.25 * tiltWeight + spin;
    logo.rotation.x = MathUtils.lerp(0.14, 0, settle) - eased.y * 0.18 * tiltWeight;
    logo.position.y = Math.sin(idle * 0.9) * 0.05 * (1 - settle);

    sparkleMaterial.uniforms.uTime.value = idle;
    renderer.render(scene, camera);

    if (!firstFrameDone) {
      firstFrameDone = true;
      if (entranceSpin && progress < 0.05) spinStart = now;
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
    setProgress(value) {
      progress = MathUtils.clamp(value, 0, 1);
      if (!running) render(performance.now());
    },
    setFit(value) {
      if (value > 0) {
        fit = value;
        placeCamera();
      }
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
