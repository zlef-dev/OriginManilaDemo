// Mirrors Origin Manila's public catalog into demo/data/ (dev-store demo only; never ships).
//
//   npm run demo:fetch
//   SOURCE_STORE=https://example.com npm run demo:fetch   (any Shopify storefront)
//
// Reads the public storefront JSON endpoints, one request at a time with a pause between them,
// and writes a normalized snapshot. Volatile fields (updated_at, image ids of other stores'
// CDNs, etc.) are dropped so re-fetches produce readable diffs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = (process.env.SOURCE_STORE || 'https://originmanila.com').replace(/\/$/, '');
const OUT_DIR = join('demo', 'data');
const PAGE_LIMIT = 250;
const PAUSE_MS = 600;
const MAX_TRIES = 4;

// The handles the brief says the theme's collection settings rely on. The script mirrors every
// public collection, and warns if any of these is missing upstream.
const EXPECTED_HANDLES = [
  '1-of-none',
  'new',
  'oe-jeans',
  'hoodie',
  'sweat-pants',
  'long-sleeve',
  'polo',
  'tee',
  'tank-top',
  'shorts',
  'shiesty',
  'crops',
  'underwear',
  'accessories',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(path) {
  const url = `${SOURCE}${path}`;
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    await sleep(PAUSE_MS);
    let response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'origin-theme-demo-mirror/0.1' },
      });
    } catch (error) {
      if (attempt === MAX_TRIES) throw new Error(`${url}: ${error.message}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (response.ok) return response.json();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === MAX_TRIES) {
      throw new Error(`${url}: HTTP ${response.status}`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
  }
  throw new Error(`${url}: gave up`);
}

/** Follows ?page=N until a page comes back short. */
async function getAllPages(basePath, key) {
  const items = [];
  for (let page = 1; ; page++) {
    const separator = basePath.includes('?') ? '&' : '?';
    const data = await getJson(`${basePath}${separator}limit=${PAGE_LIMIT}&page=${page}`);
    const batch = data[key] || [];
    items.push(...batch);
    process.stdout.write(`  ${basePath} page ${page}: ${batch.length}\n`);
    if (batch.length < PAGE_LIMIT) break;
  }
  return items;
}

function normalizeProduct(product) {
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    body_html: product.body_html || '',
    published_at: product.published_at,
    created_at: product.created_at,
    vendor: product.vendor,
    product_type: product.product_type || '',
    tags: [...(product.tags || [])],
    options: (product.options || []).map(({ name, position, values }) => ({ name, position, values })),
    variants: (product.variants || [])
      .map((variant) => ({
        id: variant.id,
        title: variant.title,
        option1: variant.option1,
        option2: variant.option2,
        option3: variant.option3,
        sku: variant.sku || '',
        available: Boolean(variant.available),
        price: variant.price,
        compare_at_price: variant.compare_at_price,
        grams: variant.grams,
        requires_shipping: Boolean(variant.requires_shipping),
        taxable: Boolean(variant.taxable),
        position: variant.position,
        featured_image_src: variant.featured_image?.src || null,
      }))
      .sort((a, b) => a.position - b.position),
    images: (product.images || [])
      .map((image) => ({
        position: image.position,
        src: image.src,
        width: image.width,
        height: image.height,
        alt: image.alt || null,
      }))
      .sort((a, b) => a.position - b.position),
  };
}

function normalizeCollection(collection) {
  return {
    id: collection.id,
    title: collection.title,
    handle: collection.handle,
    description: collection.description || '',
    published_at: collection.published_at,
    products_count_reported: collection.products_count,
    image: collection.image
      ? {
          src: collection.image.src,
          alt: collection.image.alt || null,
          width: collection.image.width,
          height: collection.image.height,
        }
      : null,
  };
}

async function main() {
  console.log(`Mirroring ${SOURCE}`);

  console.log('Collections');
  const collections = (await getAllPages('/collections.json', 'collections')).map(normalizeCollection);

  console.log('Products');
  const products = (await getAllPages('/products.json', 'products')).map(normalizeProduct);

  console.log('Collection membership');
  const membership = {};
  for (const collection of collections) {
    const members = await getAllPages(`/collections/${collection.handle}/products.json`, 'products');
    membership[collection.handle] = members.map((product) => product.handle);
  }

  const handles = collections.map((collection) => collection.handle);
  const missing = EXPECTED_HANDLES.filter((handle) => !handles.includes(handle));
  const extra = handles.filter((handle) => !EXPECTED_HANDLES.includes(handle));

  const snapshot = {
    source: SOURCE,
    fetched_at: new Date().toISOString(),
    counts: {
      collections: collections.length,
      products: products.length,
      variants: products.reduce((sum, product) => sum + product.variants.length, 0),
      images: products.reduce((sum, product) => sum + product.images.length, 0),
    },
    expected_handles_missing: missing,
    unexpected_handles: extra,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  const write = (name, data) => writeFileSync(join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`);
  write('collections.json', collections);
  write('products.json', products);
  write('collection-products.json', membership);
  write('snapshot.json', snapshot);

  console.log(JSON.stringify(snapshot.counts));
  if (missing.length) console.warn(`WARNING: expected collection handles missing upstream: ${missing.join(', ')}`);
  if (extra.length) console.log(`Note: extra public collections mirrored: ${extra.join(', ')}`);
  console.log(`Wrote ${OUT_DIR}/`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
