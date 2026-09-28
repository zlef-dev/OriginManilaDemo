// Packs the homepage-only libraries into theme/assets (D-013, D-014). Dev-only; the output is
// committed so the theme itself never needs a build.
//
//   npm run vendor
//
// vendor-gsap.js   gsap + ScrollTrigger (public "gsap" package)
// vendor-three.js  only the three.js pieces the chrome logo uses (tree-shaken)

import { build } from 'esbuild';
import { statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const entries = {
  'vendor-gsap': `
    export { gsap } from 'gsap';
    export { ScrollTrigger } from 'gsap/ScrollTrigger';
  `,
  'vendor-three': `
    export {
      WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, MeshPhysicalMaterial, ExtrudeGeometry,
      Box3, Vector3, Color, PMREMGenerator, SRGBColorSpace, ACESFilmicToneMapping, Points,
      BufferGeometry, Float32BufferAttribute, ShaderMaterial, AdditiveBlending, MathUtils
    } from 'three';
    export { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
    export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
  `,
};

for (const [name, contents] of Object.entries(entries)) {
  const outfile = `theme/assets/${name}.js`;
  await build({
    stdin: { contents, resolveDir: process.cwd(), loader: 'js' },
    bundle: true,
    format: 'esm',
    minify: true,
    target: 'es2020',
    legalComments: 'none',
    banner: { js: `/* ${name}: bundled by tools/vendor.mjs. Licenses: gsap (standard "no charge" license), three.js (MIT). */` },
    outfile,
  });
  const bytes = statSync(outfile).size;
  const gz = gzipSync(readFileSync(outfile)).length;
  console.log(`${outfile}: ${(bytes / 1024).toFixed(1)} KB (${(gz / 1024).toFixed(1)} KB gzip)`);
}
