// Builds the dev-store import files from the snapshot in demo/data/ (run demo:fetch first).
//
//   npm run demo:csv
//
// Writes demo/out/:
//   products.csv       Shopify product CSV, current format (headers in shopify-csv.mjs)
//   collections.md     the 14 smart collections to create, with exact handles
//   menus.md           main + footer menu trees
//   catalog-report.md  counts, sold-out ratios and data issues found in their catalog
//
// The same rules drive seed-store.mjs (automatic import); they live in catalog.mjs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { toCsv } from './shopify-csv.mjs';
import {
  FOOTER_MENU,
  MAIN_MENU,
  OUT_DIR,
  cleanWeight,
  compareAtFor,
  imageAlt,
  isSoldOut,
  loadCatalog,
  stockFor,
  tagsFor,
} from './catalog.mjs';

const { collections, products, productsOldestFirst, membership, snapshot, productCollections } = loadCatalog();
const collectionByHandle = new Map(collections.map((collection) => [collection.handle, collection]));

const bool = (value) => (value ? 'TRUE' : 'FALSE');

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

const heavyWeights = [];

function productRows(product) {
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
        Tags: tagsFor(product, productCollections).join(', '),
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
      const weight = cleanWeight(variant);
      if (weight === null) heavyWeights.push(`${product.title} / ${variant.title}: ${variant.grams} g`);

      Object.assign(row, {
        SKU: variant.sku,
        'Option1 value': variant.option1 ?? '',
        'Option2 value': variant.option2 ?? '',
        'Option3 value': variant.option3 ?? '',
        Price: variant.price,
        'Compare-at price': compareAtFor(variant) ?? '',
        'Charge tax': bool(variant.taxable),
        'Inventory tracker': 'shopify',
        'Inventory quantity': stockFor(product, variant, productCollections),
        'Continue selling when out of stock': 'DENY',
        'Weight value (grams)': weight ?? '',
        'Weight unit for display': weight === null ? '' : 'g',
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
        'Image alt text': imageAlt(product, image, i),
      });
    }

    rows.push(row);
  }
  return rows;
}

const csvRows = productsOldestFirst.flatMap(productRows);

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
  `- Implausible weights left blank in the CSV: ${heavyWeights.length ? heavyWeights.join('; ') : 'none'}`,
  '',
];
writeFileSync(join(OUT_DIR, 'catalog-report.md'), report.join('\n'));

console.log(
  `products.csv: ${products.length} products, ${allVariants.length} variants, ${csvRows.length} rows → ${OUT_DIR}/`
);
if (heavyWeights.length) console.log(`Blanked implausible weights: ${heavyWeights.length}`);
