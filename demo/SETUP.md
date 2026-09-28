# Dev store setup (demo only)

Dev store: `origin-demo-hoqa85o7.myshopify.com` (set in `shopify.theme.toml`).
Nothing in this folder ships with the theme.

## Automatic (recommended)

Products, collections and menus are seeded through the Admin API:

```bash
npm run demo:seed
```

- Upserts all 177 products by handle (photos, sizes, prices, stock: sold-out variants = 0),
  publishes them to the Online Store, creates the 14 smart collections with the exact handles,
  and replaces the Main and Footer menus. Safe to re-run.
- Only runs against the store in `shopify.theme.toml`, and refuses anything that isn't a
  development store or looks like Origin's real store.
- First time on a machine, authorize it once (opens the browser):
  `npx shopify store auth --store origin-demo-hoqa85o7.myshopify.com --scopes read_products,write_products,read_inventory,write_inventory,read_locations,read_publications,write_publications,read_online_store_navigation,write_online_store_navigation`

## Still manual (the Admin API can't do these)

1. **Time zone → Manila.** Open
   `https://admin.shopify.com/store/origin-demo-hoqa85o7/settings/general`, find **Time zone**
   (under **Store defaults**), pick **(GMT+08:00) Manila**, click **Save**. The drop countdown uses it.
2. **Filters.** Open `https://apps.shopify.com/search-and-discovery` → **Install** → choose the
   `origin-demo` store → approve. In the app: **Filters → Add filter** → **Availability**,
   **Price**, **Size**, **WAISTLINE**. If it lists both `Size` and `SIZE`, add both with the label
   "Size". Rename WAISTLINE's label to "Waist".
3. **Keep the store private.** Password protection stays on (their photos are on this store).
   `npm run dev` asks for the storefront password, found at
   `https://admin.shopify.com/store/origin-demo-hoqa85o7/online_store/preferences`.
4. **Test checkout (optional, later).** Settings → Payments → activate the **Bogus Gateway**;
   Settings → Shipping → make sure there's a rate for the Philippines.

Currency is already PHP (store created with `--country PH`).

## Manual fallback (no CLI)

If the API route isn't available, the same data can be clicked in by hand:
`demo/out/products.csv` (Products → Import), `demo/out/collections.md`, `demo/out/menus.md`.

## Refreshing the demo later

```bash
npm run demo
npm run demo:seed
```

Re-fetches their public catalog, rebuilds and verifies the CSV, then re-seeds the store.
