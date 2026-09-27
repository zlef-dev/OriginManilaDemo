// Builds the dev-store import files from the snapshot in demo/data/ (run demo:fetch first).
//
//   npm run demo:csv
//
// Writes demo/out/:
//   products.csv       Shopify product CSV, current format (headers in shopify-csv.mjs)
//   collections.md     the 14 smart collections to create, with exact handles
//   menus.md           main + footer menu trees
//   catalog-report.md  counts, sold-out ratios and data issues found in their catalog

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { toCsv } from './shopify-csv.mjs';

const DATA_DIR = join('demo', 'data');
const OUT_DIR = join('demo', 'out');

// Available variants get this stock; sold-out variants get 0 (DECISIONS.md D-063).
const ONE_OF_ONE_HANDLE = '1-of-none';
const STOCK_ONE_OF_ONE = 1;
const STOCK_DEFAULT = 6;

// Weights above this are data-entry errors on the source store (one variant is 500 kg).
// They would break weight-based shipping rates in test checkouts, so they are left blank
// and listed in the report (D-065).
const MAX_PLAUSIBLE_GRAMS = 30000;

// Menu trees for the dev store (demo only; the theme reads whatever menu the owner assigns).
const MAIN_MENU = [
  { handle: 'new' },
  { handle: '1-of-none' },
  { title: 'Tops', url: '/collections/all', children: ['hoodie', 'long-sleeve', 'tee', 'polo', 'tank-top'] },
  { title: 'Bottoms', url: '/collections/all', children: ['oe-jeans', 'sweat-pants', 'shorts'] },
  { handle: 'shiesty' },
  { handle: 'crops' },
  {
    title: 'More',
    url: '/collections/all',
    children: ['underwear', 'accessories'],
    extra: [{ title: 'Shop all', url: '/collections/all' }],
  },
];
const FOOTER_MENU = [
  { title: 'Shop all', url: '/collections/all' },
  { handle: 'new' },
  { handle: '1-of-none' },
  { title: 'Search', url: '/search' },
];

const readJson = (name) => JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'));

const collections = readJson('collections.json');
const products = readJson('products.json');
const membership = readJson('collection-products.json');
const snapshot = readJson('snapshot.json');

const collectionByHandle = new Map(collections.map((collection) => [collection.handle, collection]));

// product handle -> collection handles, in collections.json order
const productCollections = new Map(products.map((product) => [product.handle, []]));
for (const collection of collections) {
  for (const productHandle of membership[collection.handle] || []) {
    productCollections.get(productHandle)?.push(collection.handle);
  }
}

const bool = (value) => (value ? 'TRUE' : 'FALSE');
const isSoldOut = (product) => product.variants.every((variant) => !variant.available);

/** Shopify's automatic handle for a title (what the admin fills in before you edit it). */
function autoHandle(title) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const issues = { heavyWeights: [] };

function productRows(product) {
  const collectionHandles = productCollections.get(product.handle) || [];
  const tags = [...new Set([...collectionHandles, ...product.tags])];
  const isOneOfOne = collectionHandles.includes(ONE_OF_ONE_HANDLE);
  const rowCount = Math.max(product.variants.length, product.images.length, 1);
  const rows = [];

  for (let i = 0; i < rowCount; i++) {
    const row = { 'URL handle': product.handle };

    if (i === 0) {
      Object.assign(row, {
        Title: product.title,
        Description: product.body_html,
        Vendor: product.vendor,
        Type: product.product_type,
        Tags: tags.join(', '),
        'Published on online store': 'TRUE',
        Status: 'active',
        'Gift card': 'FALSE',
      });
      product.options.forEach((option, index) => {
        row[`Option${index + 1} name`] = option.name;
      });
    }

    const variant = product.variants[i];
    if (variant) {
      let weight = variant.grams;
      if (weight > MAX_PLAUSIBLE_GRAMS) {
        issues.heavyWeights.push(`${product.title} / ${variant.title}: ${weight} g`);
        weight = '';
      }
      const compareAt = Number(variant.compare_at_price) > Number(variant.price) ? variant.compare_at_price : '';
      const stock = variant.available ? (isOneOfOne ? STOCK_ONE_OF_ONE : STOCK_DEFAULT) : 0;

      Object.assign(row, {
        SKU: variant.sku,
        'Option1 value': variant.option1 ?? '',
        'Option2 value': variant.option2 ?? '',
        'Option3 value': variant.option3 ?? '',
        Price: variant.price,
        'Compare-at price': compareAt,
        'Charge tax': bool(variant.taxable),
        'Inventory tracker': 'shopify',
        'Inventory quantity': stock,
        'Continue selling when out of stock': 'DENY',
        'Weight value (grams)': weight,
        'Weight unit for display': weight === '' ? '' : 'g',
        'Requires shipping': bool(variant.requires_shipping),
        'Fulfillment service': 'manual',
        'Variant image URL': variant.featured_image_src || '',
      });
    }

    const image = product.images[i];
    if (image) {
      Object.assign(row, {
        'Product image URL': image.src,
        'Image position': image.position,
        'Image alt text': image.alt || (i === 0 ? product.title : `${product.title}, view ${i + 1}`),
      });
    }

    rows.push(row);
  }
  return rows;
}

// Oldest first: import creates products in row order, so the admin's "Newest" sort ends up
// close to the source store's own newest-first order.
const ordered = [...products].sort((a, b) => String(a.published_at).localeCompare(String(b.published_at)));
const csvRows = ordered.flatMap(productRows);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'products.csv'), toCsv(csvRows));

// ---------- collections.md ----------
const collectionLines = [
  '# Collections to create (dev store)',
  '',
  'Products → Collections → **Create collection**, once per row:',
  '',
  '1. **Title**: exactly as in the table.',
  '2. **Collection type**: Smart. **Products must match**: all conditions.',
  '3. Condition: **Product tag** · **is equal to** · the value in the *Tag* column.',
  '4. Save, then scroll to **Search engine listing** → Edit → set **URL handle** to the *Handle* column.',
  '   Shopify pre-fills the handle from the title; only rows marked ⚠ need changing.',
  '5. Sort: **Newest** (closest to their live order).',
  '',
  '| # | Title | Handle | Tag | Fix handle? | Public products | Sold out |',
  '|---|---|---|---|---|---|---|',
];
collections.forEach((collection, index) => {
  const members = (membership[collection.handle] || []).map((handle) => products.find((p) => p.handle === handle));
  const soldOut = members.filter((product) => product && isSoldOut(product)).length;
  const needsFix = autoHandle(collection.title) !== collection.handle;
  collectionLines.push(
    `| ${index + 1} | ${collection.title} | \`${collection.handle}\` | \`${collection.handle}\` | ${
      needsFix ? `⚠ auto-fills \`${autoHandle(collection.title)}\`` : 'no'
    } | ${members.length} | ${soldOut} |`
  );
});
const withImages = collections.filter((collection) => collection.image);
collectionLines.push('');
if (withImages.length) {
  collectionLines.push('Optional collection images (download and upload in the collection page):', '');
  for (const collection of withImages) collectionLines.push(`- ${collection.title}: ${collection.image.src}`);
} else {
  collectionLines.push('None of their collections has a collection image, so there is nothing to upload.');
}
writeFileSync(join(OUT_DIR, 'collections.md'), `${collectionLines.join('\n')}\n`);

// ---------- menus.md ----------
const menuLine = (item, depth) => {
  const indent = '  '.repeat(depth);
  if (item.handle) {
    const collection = collectionByHandle.get(item.handle);
    if (!collection) throw new Error(`Menu references unknown collection "${item.handle}"`);
    return `${indent}- **${collection.title}** → Collections › ${collection.title} (\`/collections/${item.handle}\`)`;
  }
  return `${indent}- **${item.title}** → \`${item.url}\``;
};
const renderMenu = (items) =>
  items.flatMap((item) => [
    menuLine(item, 0),
    ...(item.children || []).map((handle) => menuLine({ handle }, 1)),
    ...(item.extra || []).map((extra) => menuLine(extra, 1)),
  ]);
const menuLines = [
  '# Menus (dev store)',
  '',
  'Content → Menus. Edit the existing menus; drag items to nest them under a parent.',
  '',
  '## Main menu (handle `main-menu`)',
  '',
  ...renderMenu(MAIN_MENU),
  '',
  '## Footer menu (handle `footer`)',
  '',
  ...renderMenu(FOOTER_MENU),
  '',
];
writeFileSync(join(OUT_DIR, 'menus.md'), menuLines.join('\n'));

// ---------- catalog-report.md ----------
const allVariants = products.flatMap((product) => product.variants);
const soldOutProducts = products.filter(isSoldOut);
const soldOutVariants = allVariants.filter((variant) => !variant.available);
const optionNames = new Map();
for (const product of products) {
  for (const option of product.options) optionNames.set(option.name, (optionNames.get(option.name) || 0) + 1);
}
const emptyDescriptions = products.filter((product) => !product.body_html.replace(/<[^>]*>/g, '').trim());
const orphans = products.filter((product) => (productCollections.get(product.handle) || []).length === 0);
const longest = [...products].sort((a, b) => b.title.length - a.title.length).slice(0, 5);
const prices = allVariants.map((variant) => Number(variant.price));
const pct = (part, whole) => `${Math.round((part / whole) * 100)}%`;

const report = [
  '# Catalog report',
  '',
  `Source: ${snapshot.source} · fetched ${snapshot.fetched_at}`,
  '',
  '## Counts',
  '',
  `- Products: **${products.length}** · variants: **${allVariants.length}** · images: **${snapshot.counts.images}**`,
  `- Fully sold-out products: **${soldOutProducts.length}** (${pct(soldOutProducts.length, products.length)})`,
  `- Sold-out variants: **${soldOutVariants.length}** (${pct(soldOutVariants.length, allVariants.length)})`,
  `- Price range: ₱${Math.min(...prices).toLocaleString('en-PH')} – ₱${Math.max(...prices).toLocaleString('en-PH')}`,
  `- CSV rows written: **${csvRows.length}**`,
  '',
  '## Collections',
  '',
  '| Handle | Title | Public | Sold out | collections.json says |',
  '|---|---|---|---|---|',
  ...collections.map((collection) => {
    const members = (membership[collection.handle] || [])
      .map((handle) => products.find((p) => p.handle === handle))
      .filter(Boolean);
    return `| \`${collection.handle}\` | ${collection.title} | ${members.length} | ${
      members.filter(isSoldOut).length
    } | ${collection.products_count_reported} |`;
  }),
  '',
  '"collections.json says" counts unpublished products too; the theme only ever sees public ones.',
  '',
  '## Data quirks the theme must survive',
  '',
  `- Option names used: ${[...optionNames].map(([name, count]) => `\`${name}\` ×${count}`).join(', ')}`,
  `- Product type is blank on ${products.filter((p) => !p.product_type).length} of ${products.length} products.`,
  `- Empty descriptions: ${emptyDescriptions.length}`,
  `- Products in no collection: ${orphans.length}${orphans.length ? ` (${orphans.map((p) => p.title).join('; ')})` : ''}`,
  `- Longest titles: ${longest.map((p) => `"${p.title}" (${p.title.length})`).join('; ')}`,
  `- Implausible weights left blank in the CSV: ${
    issues.heavyWeights.length ? issues.heavyWeights.join('; ') : 'none'
  }`,
  '',
];
writeFileSync(join(OUT_DIR, 'catalog-report.md'), report.join('\n'));

console.log(
  `products.csv: ${products.length} products, ${allVariants.length} variants, ${csvRows.length} rows → ${OUT_DIR}/`
);
if (issues.heavyWeights.length) console.log(`Blanked implausible weights: ${issues.heavyWeights.length}`);
