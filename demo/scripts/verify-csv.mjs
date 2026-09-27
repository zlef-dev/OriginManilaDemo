// Checks demo/out/products.csv against the snapshot in demo/data/ and Shopify's column format.
//
//   npm run demo:verify             offline checks
//   npm run demo:verify -- --live   also re-downloads Shopify's template and diffs the header row
//
// Exits 1 on any failure.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEADERS, TEMPLATE_URL, parseCsv } from './shopify-csv.mjs';

const failures = [];
const fail = (message) => failures.push(message);
const readJson = (name) => JSON.parse(readFileSync(join('demo', 'data', name), 'utf8'));

const products = readJson('products.json');
const membership = readJson('collection-products.json');
const raw = readFileSync(join('demo', 'out', 'products.csv'), 'utf8');

if (raw.charCodeAt(0) === 0xfeff) fail('CSV starts with a BOM');
if (raw.includes('\r')) fail('CSV contains CR characters (expected LF only)');

const [header, ...rows] = parseCsv(raw);

// ---------- header ----------
if (header.length !== HEADERS.length || header.some((name, i) => name !== HEADERS[i])) {
  fail(`Header row differs from HEADERS in shopify-csv.mjs:\n  got: ${header.join(' | ')}`);
}
if (process.argv.includes('--live')) {
  const template = await downloadTemplate();
  if (template === null) {
    console.warn(`WARNING: could not download ${TEMPLATE_URL}; skipped the live header diff.`);
  } else {
    const [liveHeader] = parseCsv(template);
    const added = liveHeader.filter((name) => !HEADERS.includes(name));
    const removed = HEADERS.filter((name) => !liveHeader.includes(name));
    if (added.length || removed.length) {
      fail(`Shopify's template changed. Added: [${added.join(', ')}] Removed: [${removed.join(', ')}]`);
    } else {
      console.log('Live template header matches.');
    }
  }
}

/** help.shopify.com rejects Node's fetch (403) but serves curl, which ships with Windows 10+. */
async function downloadTemplate() {
  try {
    const response = await fetch(TEMPLATE_URL);
    if (response.ok) return await response.text();
  } catch {
    // fall through to curl
  }
  try {
    return execFileSync('curl', ['-sfL', TEMPLATE_URL], { encoding: 'utf8' });
  } catch {
    return null;
  }
}

const col = Object.fromEntries(HEADERS.map((name, index) => [name, index]));
const get = (row, name) => row[col[name]] ?? '';

// ---------- row shape ----------
rows.forEach((row, index) => {
  if (row.length !== HEADERS.length) fail(`Row ${index + 2}: ${row.length} fields, expected ${HEADERS.length}`);
});

// ---------- grouping ----------
const groups = new Map();
let previousHandle = null;
rows.forEach((row, index) => {
  const handle = get(row, 'URL handle');
  if (!handle) fail(`Row ${index + 2}: missing URL handle`);
  if (handle !== previousHandle && groups.has(handle)) fail(`Rows for "${handle}" are not contiguous`);
  if (!groups.has(handle)) groups.set(handle, []);
  groups.get(handle).push(row);
  previousHandle = handle;
});

// ---------- per product ----------
const BOOLEAN_COLUMNS = ['Published on online store', 'Charge tax', 'Requires shipping', 'Gift card'];
let variantRows = 0;
let imageRows = 0;
let soldOutRows = 0;

for (const product of products) {
  const group = groups.get(product.handle);
  if (!group) {
    fail(`Product "${product.handle}" missing from CSV`);
    continue;
  }
  const [first] = group;
  if (get(first, 'Title') !== product.title) fail(`${product.handle}: title mismatch`);
  if (group.slice(1).some((row) => get(row, 'Title'))) fail(`${product.handle}: Title repeated on a non-first row`);
  if (get(first, 'Status') !== 'active') fail(`${product.handle}: Status is not active`);

  product.options.forEach((option, index) => {
    if (get(first, `Option${index + 1} name`) !== option.name) fail(`${product.handle}: Option${index + 1} name mismatch`);
  });

  const tags = get(first, 'Tags')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  for (const [collectionHandle, members] of Object.entries(membership)) {
    if (members.includes(product.handle) && !tags.includes(collectionHandle)) {
      fail(`${product.handle}: missing tag "${collectionHandle}"`);
    }
  }

  const priced = group.filter((row) => get(row, 'Price') !== '');
  if (priced.length !== product.variants.length) {
    fail(`${product.handle}: ${priced.length} variant rows, expected ${product.variants.length}`);
  }
  priced.forEach((row, index) => {
    const variant = product.variants[index];
    if (!variant) return;
    const values = [get(row, 'Option1 value'), get(row, 'Option2 value'), get(row, 'Option3 value')];
    const expected = [variant.option1 ?? '', variant.option2 ?? '', variant.option3 ?? ''];
    if (values.join('|') !== expected.join('|')) fail(`${product.handle}: variant ${index + 1} options mismatch`);
    if (get(row, 'Price') !== variant.price) fail(`${product.handle}: variant ${index + 1} price mismatch`);

    const stock = get(row, 'Inventory quantity');
    if (!/^\d+$/.test(stock)) fail(`${product.handle}: variant ${index + 1} inventory "${stock}" is not an integer`);
    if (variant.available && stock === '0') fail(`${product.handle}: available variant ${index + 1} has 0 stock`);
    if (!variant.available && stock !== '0') fail(`${product.handle}: sold-out variant ${index + 1} has stock ${stock}`);
    if (stock === '0') soldOutRows++;
    if (get(row, 'Continue selling when out of stock') !== 'DENY') fail(`${product.handle}: oversell policy not DENY`);
    if (get(row, 'Inventory tracker') !== 'shopify') fail(`${product.handle}: inventory not tracked`);
  });
  variantRows += priced.length;

  const imaged = group.filter((row) => get(row, 'Product image URL') !== '');
  if (imaged.length !== product.images.length) {
    fail(`${product.handle}: ${imaged.length} image rows, expected ${product.images.length}`);
  }
  imaged.forEach((row) => {
    if (!/^https:\/\//.test(get(row, 'Product image URL'))) fail(`${product.handle}: image URL is not https`);
    if (!/^\d+$/.test(get(row, 'Image position'))) fail(`${product.handle}: bad image position`);
    if (!get(row, 'Image alt text')) fail(`${product.handle}: image without alt text`);
  });
  imageRows += imaged.length;

  for (const row of group) {
    for (const name of BOOLEAN_COLUMNS) {
      const value = get(row, name);
      if (value && value !== 'TRUE' && value !== 'FALSE') fail(`${product.handle}: ${name} = "${value}"`);
    }
  }
}

for (const handle of groups.keys()) {
  if (!products.some((product) => product.handle === handle)) fail(`CSV has unknown handle "${handle}"`);
}

// ---------- totals ----------
const expectedVariants = products.reduce((sum, product) => sum + product.variants.length, 0);
const expectedImages = products.reduce((sum, product) => sum + product.images.length, 0);
const expectedSoldOut = products.flatMap((product) => product.variants).filter((variant) => !variant.available).length;

if (groups.size !== products.length) fail(`${groups.size} products in CSV, expected ${products.length}`);
if (variantRows !== expectedVariants) fail(`${variantRows} variant rows, expected ${expectedVariants}`);
if (imageRows !== expectedImages) fail(`${imageRows} image rows, expected ${expectedImages}`);
if (soldOutRows !== expectedSoldOut) fail(`${soldOutRows} sold-out variants, expected ${expectedSoldOut}`);

console.log(
  `Checked ${rows.length} rows: ${groups.size} products, ${variantRows} variants (${soldOutRows} sold out), ${imageRows} images.`
);

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  for (const message of failures.slice(0, 50)) console.error(`- ${message}`);
  if (failures.length > 50) console.error(`- …and ${failures.length - 50} more`);
  process.exit(1);
}
console.log('products.csv OK');
