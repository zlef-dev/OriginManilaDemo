# Progress

| # | Step | Status |
|---|---|---|
| 0 | Repo setup | ✅ Done |
| 1 | Base: Horizon fork | ✅ Done |
| 2 | Demo data | ✅ Done (store seeded) |
| 3 | Brand system | ✅ Done |
| 4 | Commerce foundation | ✅ Done |
| 5 | Cinema core | ✅ Done |
| 6 | Hero + 3D logo | ✅ Done |
| 7 | Scenes | ✅ Done |
| 8 | QA | ✅ Done |
| 9 | Pitch package | ✅ Done |

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

### Step 3 — Brand system (2026-09-28)
- Black palette + AA-checked colors (D-037), sharp corners and uppercase accent buttons (D-038), header restyled through settings (D-039).
- Fonts: Archivo from Shopify's library for body/UI; self-hosted Archivo Expanded (34.7 KB, preloaded) for h1/h2 with metric-matched fallbacks measured in the browser (D-030).
- New **Origin** group in Theme settings: wide headings toggle, stamp text/color/dimming, one-of-one collection + tag text, card sheen toggle.
- CLAIMED stamp on sold-out cards, "✦ Only 1 exists" tag on available one-of-ones, CSS chrome sheen on hover (no JS; off for touch and reduced motion) — `snippets/om-product-status.liquid`, `assets/om-brand.css` (D-055, D-056).
- Checked in the preview: hoodie collection 12 stamps / 14 cards (matches data); 1-of-none 11 stamps + 13 tags / 24 cards; sheen transition fires; 375px no horizontal scroll; tag no longer collides with mobile quick add; 120-char title clamps to 2 lines (D-057); PDP renders cleanly in the dark palette (struck-through sold-out sizes come from Horizon).
- Review fixes: stamp contrast raised to ≥4.5:1 over white photos; reduced-motion users no longer get forced smooth scroll (D-081); heading font set to Archivo 700 to avoid an unused 900-weight download.
- Found: Horizon scrolls inside `.page-wrapper` on desktop (D-080) — matters for step 5.
- Theme Check: 0 errors (6 accepted upstream warnings, D-008).
- Console: no theme errors; platform errors on the 127.0.0.1 proxy logged for QA (D-082).

### Step 4 — Commerce foundation (2026-09-28)
- PDP: CLAIMED stamp on the lead image of sold-out products; sold-out sizes struck through (Horizon); ProductGroup + Organization structured data present.
- Add to cart (tested on the dev store): item added via AJAX, fly-to-cart with chrome glint, bubble bump, drawer auto-opens with the line item and ₱ total — no reload, no theme console errors.
- Verified: collection filters (Availability, Price, Size), search ("camou" → 21 results, 11 stamped), 404, cart page, password page in brand styling.
- Page transitions enabled (non-blocking).
- Theme Check: 0 errors.
- Note: password page <title> renders as "– Origin" (Horizon, low impact; revisit in QA).

### Steps 5–9 (2026-09-28)
- Cinema core (`om-cinema.js`): OmSection lifecycle, per-breakpoint scroller (D-080), reduced motion/editor → static, batched ScrollTrigger.refresh.
- Hero: traced logo → runtime chrome extrusion, iridescent clearcoat, sparkles, cursor tilt, fly-through the swoosh loop (D-027–D-029), vector chrome fallback, CSS-timed intro, headroom header.
- Scenes: manifesto (word reveal, blackletter), color run (4 Concrete Jungle camo zips), 1 OF NONE exhibit (22 of 47 claimed, live), Shop the Drop (Horizon product list, NEW), drop countdown (index/live states) — also on the password page.
- Browser QA: all sections render desktop 1280 and mobile 375; no horizontal scroll; no theme console errors; countdown flips to live on its own; CLS 0.000 home and PDP; product pages load zero GSAP/three.
- Not measured: real mobile LCP/INP — the dev store is password-protected, so PageSpeed can't reach it, and the 127.0.0.1 proxy serves uncompressed files. Measure on Origin's store after install (docs/INSTALL-ORIGIN.md).
- Theme Check: 0 errors.
- Package: `npm run package` → dist/.

### Hero revision (2026-09-29)
- Loading intro: chrome logo spins 360° + counter + flash; the 3D logo enters with a 360° turn (D-097).
- Scroll: logo recedes/floats up → "ORIGIN MANILA" + "IN THE TRAP WE shine" → returns → fly-through (D-096). Checked at 38/64/90% on desktop and the hold on mobile (no overlap).
- Copy de-cornified (D-098). Theme Check: 0 errors.

## Waiting on you
- Review the homepage at http://127.0.0.1:9292 and the pitch notes in docs/INSTALL-ORIGIN.md.
