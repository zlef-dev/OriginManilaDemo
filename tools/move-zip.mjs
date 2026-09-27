// Moves the zip written by `shopify theme package --path theme` out of theme/ and into dist/,
// so a packaged build never sits inside the folder that `shopify theme dev` syncs.
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const themeDir = 'theme';
const distDir = 'dist';

const zips = readdirSync(themeDir).filter((name) => name.endsWith('.zip'));

if (zips.length === 0) {
  console.error('No zip found in theme/. Did `shopify theme package` succeed?');
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });

for (const name of zips) {
  renameSync(join(themeDir, name), join(distDir, name));
  console.log(`Packaged: ${join(distDir, name)}`);
}
