# Dev store setup (demo only)

Everything here happens in **your dev store's admin**. Nothing in this folder ships with the theme.
Files referenced below are in `demo/out/` (regenerate with `npm run demo`).

## Checklist

1. **Currency + time zone.** Settings → General → *Store defaults*:
   - Currency → **Philippine peso (PHP ₱)**. Do this before any test order; it can't change after.
   - Time zone → **(GMT+08:00) Manila**. The drop countdown uses it.
2. **One location.** Settings → Locations should list a single location (the default). The CSV's
   *Inventory quantity* column only works on single-location stores.
3. **Import products.** Products → **Import** → Add file → `demo/out/products.csv`
   - Leave *Publish new products to all sales channels* checked.
   - Click **Upload and preview**, check that it reads **177 products**, then **Import products**.
   - Wait for Shopify's "import complete" email. The ~1,000 photos keep downloading in the
     background for a few minutes after that.
4. **Collections (14).** Follow `demo/out/collections.md`: each one is a *Smart* collection,
   condition **Product tag is equal to `<handle>`**. Only 3 need their URL handle changed by hand
   (HEAD WEAR → `shiesty`, Sweats → `sweat-pants`, Womens → `crops`).
5. **Menus.** Content → Menus → edit **Main menu** and **Footer menu** to match `demo/out/menus.md`.
6. **Filters.** Install **Shopify Search & Discovery** (free, made by Shopify) from the App Store →
   Filters → add **Availability**, **Price**, **Size**, **WAISTLINE**.
   Their size option is spelled `Size` on some products and `SIZE` on others. If the app lists
   both, add both and give them the same label "Size". Rename WAISTLINE's label to "Waist".
7. **Keep the store private.** Online Store → Preferences → **Password protection** stays on
   (their product photos are on your store). `npm run dev` will ask for this storefront password.
8. **Test checkout (optional, for later).** Settings → Payments → activate the **Bogus Gateway**,
   and Settings → Shipping → make sure there's a rate for the Philippines.

Never publish a theme on this store for the demo: `npm run dev` previews the local theme without
touching the live one.

## Refreshing the demo later

```bash
npm run demo
```

Re-fetches their public catalog, rebuilds `products.csv` and verifies it. To update stock on an
already-imported store, re-import with **Overwrite products with matching handles** checked.
