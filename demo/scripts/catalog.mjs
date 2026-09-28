// Shared catalog rules for the demo store. Both outputs use these, so they can't disagree:
//   build-csv.mjs  → demo/out/products.csv (manual import)
//   seed-store.mjs → Admin API import (automatic)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DATA_DIR = join('demo', 'data');
export const OUT_DIR = join('demo', 'out');

// Available variants get this stock; sold-out variants get 0 (DECISIONS.md D-063).
export const ONE_OF_ONE_HANDLE = '1-of-none';
const STOCK_ONE_OF_ONE = 1;
const STOCK_DEFAULT = 6;

// Weights above this are data-entry errors on the source store (one variant is 500 kg).
// They would break weight-based shipping rates in test checkouts, so they are dropped (D-065).
const MAX_PLAUSIBLE_GRAMS = 30000;

// Menu trees for the dev store (demo only; the theme reads whatever menu the owner assigns).
// `handle` = link to that collection; `url` + `type` = any other link.
export const MAIN_MENU = [
  { handle: 'new' },
  { handle: '1-of-none' },
  { title: 'Tops', type: 'CATALOG', url: '/collections/all', children: ['hoodie', 'long-sleeve', 'tee', 'polo', 'tank-top'] },
  { title: 'Bottoms', type: 'CATALOG', url: '/collections/all', children: ['oe-jeans', 'sweat-pants', 'shorts'] },
  { handle: 'shiesty' },
  { handle: 'crops' },
  {
    title: 'More',
    type: 'CATALOG',
    url: '/collections/all',
    children: ['underwear', 'accessories'],
    extra: [{ title: 'Shop all', type: 'CATALOG', url: '/collections/all' }],
  },
];
export const FOOTER_MENU = [
  { title: 'Shop all', type: 'CATALOG', url: '/collections/all' },
  { handle: 'new' },
  { handle: '1-of-none' },
  { title: 'Search', type: 'SEARCH', url: '/search' },
];

export function loadCatalog() {
  const readJson = (name) => JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'));
  const collections = readJson('collections.json');
  const products = readJson('products.json');
  const membership = readJson('collection-products.json');
  const snapshot = readJson('snapshot.json');

  // product handle -> collection handles, in collections.json order
  const productCollections = new Map(products.map((product) => [product.handle, []]));
  for (const collection of collections) {
    for (const productHandle of membership[collection.handle] || []) {
      productCollections.get(productHandle)?.push(collection.handle);
    }
  }

  // Oldest first: imports create products in order, so "Newest" sorting lands close to the
  // source store's own order (D-067).
  const productsOldestFirst = [...products].sort((a, b) =>
    String(a.published_at).localeCompare(String(b.published_at))
  );

  return { collections, products, productsOldestFirst, membership, snapshot, productCollections };
}

export const isSoldOut = (product) => product.variants.every((variant) => !variant.available);

export function tagsFor(product, productCollections) {
  return [...new Set([...(productCollections.get(product.handle) || []), ...product.tags])];
}

export function stockFor(product, variant, productCollections) {
  if (!variant.available) return 0;
  const isOneOfOne = (productCollections.get(product.handle) || []).includes(ONE_OF_ONE_HANDLE);
  return isOneOfOne ? STOCK_ONE_OF_ONE : STOCK_DEFAULT;
}

/** Grams, or null when the source value is implausible (see MAX_PLAUSIBLE_GRAMS). */
export function cleanWeight(variant) {
  return variant.grams > MAX_PLAUSIBLE_GRAMS ? null : variant.grams;
}

export function compareAtFor(variant) {
  return Number(variant.compare_at_price) > Number(variant.price) ? variant.compare_at_price : null;
}

/** The public JSON has no alt text, so derive it from the title (D-066). */
export function imageAlt(product, image, index) {
  return image.alt || (index === 0 ? product.title : `${product.title}, view ${index + 1}`);
}
