// Seeds the DEV store straight through the Admin API (the automatic alternative to importing
// products.csv and clicking through collections.md / menus.md by hand).
//
//   npm run demo:seed                              everything: products → collections → menus
//   npm run demo:seed -- --only=collections        one part (products | collections | menus)
//   npm run demo:seed -- --handles=a,b             only these products (quick test run)
//   npm run demo:seed -- --dry-run                 build the payloads, send nothing
//
// Needs one-time auth:  npx shopify store auth --store <dev store> --scopes \
//   read_products,write_products,read_inventory,write_inventory,read_locations,
//   read_publications,write_publications,read_online_store_navigation,write_online_store_navigation
//
// Safe to re-run: products are upserted by handle (productSet), collections are updated in
// place, menus are replaced. It only ever targets the store in shopify.theme.toml [environments.dev]
// and refuses to run against anything that isn't a development store.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FOOTER_MENU,
  MAIN_MENU,
  cleanWeight,
  compareAtFor,
  imageAlt,
  loadCatalog,
  stockFor,
  tagsFor,
} from './catalog.mjs';

const CLI = join('node_modules', '@shopify', 'cli', 'bin', 'run.js');
const argv = process.argv.slice(2);
const flag = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
const DRY_RUN = argv.includes('--dry-run');
const ONLY = flag('only');
const HANDLES = flag('handles')?.split(',').filter(Boolean);
const SMALL_BATCH = 5; // at or below this, products go one by one (clear errors) instead of bulk

const run = (part) => !ONLY || ONLY === part;
const tmp = mkdtempSync(join(tmpdir(), 'om-seed-'));
let fileCounter = 0;

// ---------- store + CLI plumbing ----------

function devStore() {
  if (process.env.SEED_STORE) return process.env.SEED_STORE;
  const toml = readFileSync('shopify.theme.toml', 'utf8');
  const section = toml.split(/^\[/m).find((block) => block.startsWith('environments.dev]'));
  const store = section?.match(/^store\s*=\s*"([^"]+)"/m)?.[1];
  if (!store) throw new Error('No store in shopify.theme.toml [environments.dev]');
  return store;
}

const STORE = devStore();
if (/originmanila|origin-7063/i.test(STORE)) throw new Error(`Refusing to seed ${STORE}: that is the real store.`);

function cli(args) {
  if (!existsSync(CLI)) throw new Error('Shopify CLI not installed. Run `npm install` first.');
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, SHOPIFY_CLI_NO_ANALYTICS: '1' },
  });
  if (result.status !== 0) {
    const output = `${result.stderr}\n${result.stdout}`.trim().slice(0, 4000);
    throw new Error(`shopify ${args.slice(0, 3).join(' ')} failed:\n${output}`);
  }
  return result.stdout;
}

function tmpFile(extension, contents) {
  const path = join(tmp, `${++fileCounter}.${extension}`);
  writeFileSync(path, contents);
  return path;
}

/** One Admin API GraphQL call through `shopify store execute`. Returns `data`. */
function gql(query, variables, { mutation = false } = {}) {
  const args = ['store', 'execute', '--store', STORE, '--json', '--query-file', tmpFile('graphql', query)];
  if (variables) args.push('--variable-file', tmpFile('json', JSON.stringify(variables)));
  if (mutation) args.push('--allow-mutations');
  const output = cli(args);
  const json = JSON.parse(output.slice(output.indexOf('{')));
  if (json.errors?.length) throw new Error(`GraphQL: ${JSON.stringify(json.errors).slice(0, 2000)}`);
  return json.data ?? json;
}

/** Collects userErrors from every aliased field in a mutation result. */
function userErrors(data) {
  return Object.entries(data).flatMap(([alias, result]) =>
    (result?.userErrors || []).map((error) => `${alias}: ${error.field?.join('.') ?? ''} ${error.message}`)
  );
}

const chunk = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

function publishAll(ids, publicationId, label) {
  for (const batch of chunk(ids, 50)) {
    const fields = batch
      .map(
        (id, i) =>
          `p${i}: publishablePublish(id: ${JSON.stringify(id)}, input: [{ publicationId: ${JSON.stringify(
            publicationId
          )} }]) { userErrors { field message } }`
      )
      .join('\n');
    const errors = userErrors(gql(`mutation {\n${fields}\n}`, null, { mutation: true }));
    if (errors.length) throw new Error(`Publishing ${label}:\n${errors.join('\n')}`);
  }
  console.log(`  published ${ids.length} ${label} to Online Store`);
}

// ---------- context ----------

console.log(`Dev store: ${STORE}${DRY_RUN ? ' (dry run)' : ''}`);
const context = gql(`query {
  shop { name plan { partnerDevelopment } }
  locations(first: 10) { nodes { id name isActive } }
  publications(first: 20) { nodes { id name } }
}`);
if (!context.shop.plan.partnerDevelopment) {
  throw new Error(`${STORE} is not a development store. Refusing to seed it.`);
}
const location = context.locations.nodes.find((node) => node.isActive);
const onlineStore = context.publications.nodes.find((node) => node.name === 'Online Store');
if (!location) throw new Error('No active location on the store.');
if (!onlineStore) throw new Error('The Online Store sales channel is not installed.');

const catalog = loadCatalog();

// ---------- products ----------

const PRODUCT_SET = `mutation productSet($input: ProductSetInput!, $identifier: ProductSetIdentifiers) {
  productSet(input: $input, identifier: $identifier) {
    product { id handle }
    userErrors { field message code }
  }
}`;

function productPayload(product) {
  const options = product.options.length ? product.options : [{ name: 'Title', position: 1, values: ['Default Title'] }];
  const imageSources = new Set(product.images.map((image) => image.src));

  return {
    identifier: { handle: product.handle },
    input: {
      handle: product.handle,
      title: product.title,
      descriptionHtml: product.body_html,
      vendor: product.vendor,
      productType: product.product_type,
      tags: tagsFor(product, catalog.productCollections),
      status: 'ACTIVE',
      productOptions: options.map((option) => ({
        name: option.name,
        position: option.position,
        values: option.values.map((value) => ({ name: value })),
      })),
      files: product.images.map((image, index) => ({
        originalSource: image.src,
        alt: imageAlt(product, image, index),
        contentType: 'IMAGE',
      })),
      variants: product.variants.map((variant, variantIndex) => {
        const weight = cleanWeight(variant);
        return {
          // Source positions can have gaps (deleted variants); the API needs 1..n.
          position: variantIndex + 1,
          optionValues: options.map((option, index) => ({
            optionName: option.name,
            name: variant[`option${index + 1}`] ?? 'Default Title',
          })),
          price: variant.price,
          compareAtPrice: compareAtFor(variant),
          taxable: variant.taxable,
          inventoryPolicy: 'DENY',
          inventoryItem: {
            tracked: true,
            requiresShipping: variant.requires_shipping,
            ...(weight ? { measurement: { weight: { value: weight, unit: 'GRAMS' } } } : {}),
          },
          inventoryQuantities: [
            {
              locationId: location.id,
              name: 'available',
              quantity: stockFor(product, variant, catalog.productCollections),
            },
          ],
          // Only link images that are also product images, so nothing gets uploaded twice.
          ...(variant.featured_image_src && imageSources.has(variant.featured_image_src)
            ? { file: { originalSource: variant.featured_image_src, contentType: 'IMAGE' } }
            : {}),
        };
      }),
    },
  };
}

function seedProducts() {
  let products = catalog.productsOldestFirst;
  if (HANDLES) {
    products = products.filter((product) => HANDLES.includes(product.handle));
    const missing = HANDLES.filter((handle) => !products.some((product) => product.handle === handle));
    if (missing.length) throw new Error(`Unknown handles: ${missing.join(', ')}`);
  }
  const payloads = products.map(productPayload);
  console.log(`Products: ${payloads.length}`);
  if (DRY_RUN) {
    const path = join(tmp, 'products.jsonl');
    writeFileSync(path, payloads.map((payload) => JSON.stringify(payload)).join('\n'));
    console.log(`  dry run: payloads in ${path}`);
    return;
  }

  const ids = [];
  const failures = [];

  if (payloads.length <= SMALL_BATCH) {
    for (const payload of payloads) {
      const data = gql(PRODUCT_SET, payload, { mutation: true });
      const errors = data.productSet.userErrors;
      if (errors.length) failures.push(`${payload.input.handle}: ${JSON.stringify(errors)}`);
      else ids.push(data.productSet.product.id);
    }
  } else {
    const resultsPath = join(tmp, 'products-results.jsonl');
    console.log('  running bulk productSet (a few minutes; Shopify downloads every photo)…');
    cli([
      'store',
      'bulk',
      'execute',
      '--store',
      STORE,
      '--query-file',
      tmpFile('graphql', PRODUCT_SET),
      '--variable-file',
      tmpFile('jsonl', payloads.map((payload) => JSON.stringify(payload)).join('\n')),
      '--allow-mutations',
      '--watch',
      '--output-file',
      resultsPath,
    ]);
    const lines = readFileSync(resultsPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    for (const line of lines) {
      const result = line.data?.productSet;
      const handle = payloads[line.__lineNumber]?.input.handle ?? `line ${line.__lineNumber}`;
      if (!result) failures.push(`${handle}: ${JSON.stringify(line.errors ?? line).slice(0, 300)}`);
      else if (result.userErrors.length) failures.push(`${handle}: ${JSON.stringify(result.userErrors)}`);
      else ids.push(result.product.id);
    }
  }

  console.log(`  upserted ${ids.length}/${payloads.length}`);
  if (failures.length) {
    console.error(`  ${failures.length} failed:\n  - ${failures.slice(0, 20).join('\n  - ')}`);
    process.exitCode = 1;
  }
  if (ids.length) publishAll(ids, onlineStore.id, 'products');
}

// ---------- collections ----------

function seedCollections() {
  const existing = gql(`query { collections(first: 250) { nodes { id handle } } }`).collections.nodes;
  const idByHandle = new Map(existing.map((node) => [node.handle, node.id]));
  const toCreate = catalog.collections.filter((collection) => !idByHandle.has(collection.handle));
  console.log(`Collections: ${toCreate.length} to create, ${catalog.collections.length - toCreate.length} to update`);
  if (DRY_RUN) return;

  const definitions = [];
  const fields = [];
  const variables = {};
  catalog.collections.forEach((collection, i) => {
    const id = idByHandle.get(collection.handle);
    variables[`c${i}`] = {
      ...(id ? { id } : {}),
      title: collection.title,
      handle: collection.handle,
      descriptionHtml: collection.description,
      sortOrder: 'CREATED_DESC',
      // Smart collection: membership comes from the tag = handle rule (D-062).
      ...(id
        ? {}
        : {
            ruleSet: {
              appliedDisjunctively: false,
              rules: [{ column: 'TAG', relation: 'EQUALS', condition: collection.handle }],
            },
          }),
    };
    definitions.push(`$c${i}: CollectionInput!`);
    const mutation = id ? 'collectionUpdate' : 'collectionCreate';
    fields.push(`c${i}: ${mutation}(input: $c${i}) { collection { id handle } userErrors { field message } }`);
  });

  const data = gql(`mutation Collections(${definitions.join(', ')}) {\n${fields.join('\n')}\n}`, variables, {
    mutation: true,
  });
  const errors = userErrors(data);
  if (errors.length) throw new Error(`Collections:\n${errors.join('\n')}`);
  const results = Object.values(data).map((result) => result.collection);
  const wrongHandles = results.filter((result, i) => result.handle !== catalog.collections[i].handle);
  if (wrongHandles.length) throw new Error(`Handles not applied: ${wrongHandles.map((r) => r.handle).join(', ')}`);
  console.log(`  ${toCreate.length} created, ${results.length - toCreate.length} updated`);
  publishAll(
    results.map((result) => result.id),
    onlineStore.id,
    'collections'
  );
}

// ---------- menus ----------

function seedMenus() {
  const data = gql(`query {
    menus(first: 50) { nodes { id handle title } }
    collections(first: 250) { nodes { id handle title } }
  }`);
  const collectionByHandle = new Map(data.collections.nodes.map((node) => [node.handle, node]));

  const toItem = (entry) => {
    if (entry.handle) {
      const collection = collectionByHandle.get(entry.handle);
      if (!collection) throw new Error(`Menu needs collection "${entry.handle}". Run --only=collections first.`);
      return { title: collection.title, type: 'COLLECTION', resourceId: collection.id, items: [] };
    }
    return {
      title: entry.title,
      type: entry.type,
      ...(entry.type === 'HTTP' ? { url: entry.url } : {}),
      items: [
        ...(entry.children || []).map((handle) => toItem({ handle })),
        ...(entry.extra || []).map((extra) => toItem(extra)),
      ],
    };
  };

  const plan = [
    { handle: 'main-menu', title: 'Main menu', items: MAIN_MENU.map(toItem) },
    { handle: 'footer', title: 'Footer menu', items: FOOTER_MENU.map(toItem) },
  ];
  console.log(`Menus: ${plan.map((menu) => menu.handle).join(', ')}`);
  if (DRY_RUN) return;

  for (const menu of plan) {
    const existing = data.menus.nodes.find((node) => node.handle === menu.handle);
    const result = existing
      ? gql(
          `mutation($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
            menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { menu { handle } userErrors { field message } }
          }`,
          { id: existing.id, title: existing.title, handle: menu.handle, items: menu.items },
          { mutation: true }
        )
      : gql(
          `mutation($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
            menuCreate(title: $title, handle: $handle, items: $items) { menu { handle } userErrors { field message } }
          }`,
          { title: menu.title, handle: menu.handle, items: menu.items },
          { mutation: true }
        );
    const errors = userErrors(result);
    if (errors.length) throw new Error(`Menu ${menu.handle}:\n${errors.join('\n')}`);
    console.log(`  ${existing ? 'updated' : 'created'} ${menu.handle}`);
  }
}

// ---------- main ----------

try {
  if (run('products')) seedProducts();
  if (run('collections')) seedCollections();
  if (run('menus')) seedMenus();
  if (!DRY_RUN) {
    const check = gql(
      `query { productsCount { count } collections(first: 50) { nodes { handle productsCount { count } } } }`
    );
    const counts = check.collections.nodes
      .filter((node) => node.handle !== 'frontpage')
      .map((node) => `${node.handle} ${node.productsCount.count}`)
      .join(', ');
    console.log(`Store now: ${check.productsCount.count} products${counts ? `. ${counts}` : ''}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (!DRY_RUN) rmSync(tmp, { recursive: true, force: true });
}
