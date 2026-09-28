# Progress

| # | Step | Status |
|---|---|---|
| 0 | Repo setup | ✅ Done |
| 1 | Base: Horizon fork | ✅ Done |
| 2 | Demo data | ✅ Done (store seeded) |
| 3 | Brand system | — |
| 4 | Commerce foundation | — |
| 5 | Cinema core | — |
| 6 | Hero + 3D logo | — |
| 7 | Scenes | — |
| 8 | QA | — |
| 9 | Pitch package | — |

## Log

### Step 0 — Repo setup (2026-09-27)
- Brief saved verbatim to `docs/BRIEF.md`; `CLAUDE.md` imports it and lists the commands.
- `DECISIONS.md` holds every call from the approved plan (D-001 … D-064).
- Repo config: `.gitignore`, `.gitattributes` (LF everywhere), project `.npmrc` (`legacy-peer-deps=false`), `package.json` scripts.
- Logo reference saved to `design/logo/` (their shooting-star mark, 2000×2000 PNG from originmanila.com + the copy you sent).
- `git init -b main` inside this folder. Note: `C:\Users\Azirehl` is itself a git repo; this project is a separate nested repo and the outer one is untouched.

### Step 1 — Base: Horizon fork (2026-09-27)
- Horizon 4.2.0 copied into `theme/` from upstream commit `5acd1b6` (D-001).
- Shopify CLI 4.8.2 is a pinned devDependency; `npm run check`, `npm run dev`, `npm run package` work without a global install (D-004).
- Removed Horizon's render-blocking view-transition link (D-033).
- `theme_info` → "Origin" 0.1.0 (D-018). Horizon license notice ships in `snippets/om-license-horizon.liquid` (D-009).
- `npm run package` → `dist/Origin-0.1.0.zip` (D-019). Zip checked: 482 theme files, license snippet included.
- Theme Check: **0 errors**, 6 upstream warnings accepted as baseline (D-008).
- Browser check: **not possible yet**. `shopify theme dev` needs your store login. Carried over to your to-do list.
- Deferred to step 6: testing whether Shopify accepts `.glb` in theme assets (nothing to test until the GLB exists; the `.js` fallback is planned).

### Step 2 — Demo data (2026-09-27)
- `demo/scripts/fetch-catalog.mjs` mirrors originmanila.com's public JSON (paginated, polite, retries) into `demo/data/`: 14 collections, 177 products, 685 variants, 1,008 images.
- `demo/scripts/build-csv.mjs` writes `demo/out/products.csv` (1,115 rows) in Shopify's current 57-column format, plus `collections.md`, `menus.md`, `catalog-report.md`.
- `demo/scripts/verify-csv.mjs` re-checks the CSV against the snapshot: header, row shape, tags, stock vs availability (405 sold-out variants = 0), images, booleans. Result: **OK**.
- `demo/SETUP.md`: the admin checklist.
- Findings worth pitching: 45% of products sold out; option names spelled 6+ ways (`Size`, `SIZE`, `Clor`…); product type blank on all 177; 23 empty descriptions; 5 products in no collection; one variant weighs 500 kg.
- Theme Check: unchanged (no theme files touched in this step).

### Dev store connected (2026-09-28)
- Dev store: `origin-demo-hoqa85o7.myshopify.com` (created with `shopify store create dev`, country PH). Saved in `shopify.theme.toml`; `npm run dev` targets it.
- Preview checked at 1280px and 375px: stock Horizon renders, prices in ₱, no horizontal scroll. Currency is already PHP.
- Console: 0 theme errors. 3 platform errors (customer-account menu lookup, Shop Pay iframe CSP on the 127.0.0.1 proxy, one 400 from a Shopify script); re-check on the real preview URL in QA.
- Store facts via Admin API: 1 location, Online Store channel present, 0 products, time zone America/New_York (needs Manila).
- `demo/scripts/catalog.mjs` now holds the shared catalog rules; CSV output verified byte-identical after the refactor.

### Dev store seeded (2026-09-28)
- `npm run demo:seed` (Admin API, D-070): 177/177 products upserted and published, 14 smart collections with exact handles, Main + Footer menus.
- Verified against the source snapshot: 177 products, 685 variants, 405 sold-out variants at 0 stock, 1,008 images, 0 per-product mismatches. Collection counts match the live site (1-of-none 47, hoodie 14, tee 25, …).
- Fixed on the way: source variant positions have gaps (deleted variants), so the seed numbers them 1..n.
- Storefront check: /collections/1-of-none shows 47 items with sold-out badges; menu renders; Availability + Price filters already work without the app.

## Waiting on you
1. Time zone → Manila: https://admin.shopify.com/store/origin-demo-hoqa85o7/settings/general → Time zone → (GMT+08:00) Manila → Save.
2. (Before step 4) Install Shopify Search & Discovery for the Size / Waist filters — steps in `demo/SETUP.md`.
