// Parses every Origin theme module (assets/om-*.js) as an ES module, so a syntax error can't
// silently kill a scene in the browser (the hero falls back quietly by design, which hides bugs).
//
//   npm run check:js

import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const dir = join('theme', 'assets');
const files = readdirSync(dir).filter((name) => /^om-.*\.js$/.test(name));
let failed = 0;

for (const name of files) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: readFileSync(join(dir, name)),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    failed++;
    console.error(`✗ ${name}\n${result.stderr.trim()}\n`);
  }
}

console.log(`${files.length - failed}/${files.length} modules parse`);
process.exit(failed ? 1 : 0);
