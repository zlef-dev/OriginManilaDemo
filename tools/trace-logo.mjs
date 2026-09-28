// Traces design/logo/origin-star-2000.png into theme/assets/logo.svg (dev-only; D-021).
//
//   npm run trace:logo
//
// Output: one <path> with fill="currentColor", viewBox cropped to the mark plus a small margin,
// so the same file works as the 3D source and as the inline static fallback.

import { readFileSync, writeFileSync } from 'node:fs';
import potrace from 'potrace';

const SOURCE = 'design/logo/origin-star-2000.png';
const TARGET = 'theme/assets/logo.svg';

const svg = await new Promise((resolve, reject) => {
  potrace.trace(
    readFileSync(SOURCE),
    { threshold: 128, turdSize: 20, optCurve: true, optTolerance: 0.4, color: 'currentColor', background: 'transparent' },
    (error, result) => (error ? reject(error) : resolve(result))
  );
});

const d = svg.match(/ d="([^"]+)"/)?.[1];
if (!d) throw new Error('potrace returned no path');

// Bounding box from every coordinate pair (control points included: a slight, safe overestimate).
const numbers = d.match(/-?\d*\.?\d+/g).map(Number);
const xs = numbers.filter((_, i) => i % 2 === 0);
const ys = numbers.filter((_, i) => i % 2 === 1);
const pad = 8;
const minX = Math.floor(Math.min(...xs)) - pad;
const minY = Math.floor(Math.min(...ys)) - pad;
const width = Math.ceil(Math.max(...xs)) + pad - minX;
const height = Math.ceil(Math.max(...ys)) + pad - minY;

const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="Origin"><path fill="currentColor" fill-rule="evenodd" d="${d}"/></svg>\n`;
writeFileSync(TARGET, out);
console.log(`${TARGET}: viewBox ${minX} ${minY} ${width} ${height}, ${out.length} bytes`);
