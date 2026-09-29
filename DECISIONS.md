# Decisions

One line of reasoning each. Superseded decisions get struck through and point to their replacement; nothing is deleted.

## Foundation
- **D-001** Base: fork Shopify Horizon 4.2.0 at upstream commit `5acd1b6b66c02f61d3216e3adace5dd9e0404fc9` (2026-09-21, github.com/Shopify/horizon; no release tags upstream). *Why:* cart drawer, facets, predictive search, quick add, variant picker, fly-to-cart, structured data and a11y are already production-grade; Skeleton would mean rebuilding all of it.
- **D-002** License: Horizon's license allows delivering a derived theme to a merchant for their own store as a services engagement, and forbids reselling or listing it. This theme is for Origin Manila only. *Why:* plan approved with Horizon; switch to Skeleton only if the theme is ever meant to be resold.
- **D-003** Repo layout: `theme/` ships; `demo/`, `tools/`, `design/`, `docs/` never do. *Why:* nothing outside `theme/` can leak into the zip.
- **D-004** Shopify CLI is a pinned devDependency run through npm scripts, not a global install. *Why:* same CLI version for everyone who clones the repo.
- **D-005** Project `.npmrc` sets `legacy-peer-deps=false`. *Why:* the machine-wide setting is `true`, which silently drops peer dependencies.
- **D-006** LF line endings enforced by `.gitattributes`. *Why:* Windows `core.autocrlf=true`; Liquid, JSON and CSV must be byte-identical everywhere.
- **D-007** New files use the `om-` prefix; edits inside Horizon files are minimal and marked `OM:`. *Why:* keeps manual upstream merges possible.
- **D-008** Theme Check baseline accepted: 0 errors, 6 upstream warnings. 5× `UnusedDocParam` in `snippets/divider.liquid` are false positives (Theme Check can't read dotted `@param settings.x` names; the snippet uses them). 1× `ExcessiveSettingsCount` on `sections/header.liquid` (42 > 40) is also accepted: step 3 restyled the header through settings only, and deleting Horizon's header settings would fork its schema for no merchant benefit. Everything `om-` must be warning-free. *Why:* editing Horizon files to silence false positives only makes upstream merges harder.
- **D-009** Third-party notices (Horizon's license; from step 3 also Archivo's OFL) ship inside the theme as `snippets/om-licenses.liquid` (comment only, rendered from `layout/theme.liquid` so it isn't orphaned; outputs nothing). *Why:* `shopify theme package` drops root files like `LICENSE.md`, and the license requires the notice in every copy.
- **D-018** `theme_info` renamed to "Origin" 0.1.0. *Why:* the merchant's theme library shouldn't show "Horizon"; version tracks this build.
- **D-019** `npm run package` moves the zip from `theme/` to `dist/`. *Why:* the CLI writes it inside the synced theme folder.

## Architecture
- **D-010** Horizon theme blocks for commerce and content pages; classic section-defined blocks for cinema sections. *Why:* scroll timelines need a fixed structure and max counts that nestable theme blocks can't guarantee.
- **D-011** Native scroll + GSAP ScrollTrigger; no Lenis. *Why:* Lenis fights drawer scroll-lock, iOS Safari's toolbar, find-in-page and the theme editor's scroll-to-section.
- **D-012** "Pins" are CSS `position: sticky` stages; ScrollTrigger only reads progress, never `pin: true`. *Why:* no pin-spacers means no jumps, it survives section re-renders, and nested pins are impossible.
- **D-013** No bundler for theme code (Horizon's native ES modules + import map). One `npm run vendor` step (esbuild) packs gsap and a tree-shaken three into `theme/assets`; output is committed. *Why:* the theme runs and edits with zero build.
- **D-014** Libraries are vendored into `theme/assets`, never loaded from a public CDN. *Why:* same origin as the theme, pinned versions, no third-party outage; partitioned browser caches removed the shared-cache benefit.
- **D-015** Each cinema section is a custom element (build in `connectedCallback`, full teardown in `disconnectedCallback`) with `enabled_on` limited to the homepage (drop section: homepage + password). *Why:* editor load/unload is handled by the DOM lifecycle, and homepage code can't leak to other templates.
- **D-016** No GSAP or three.js on product, collection, cart or search pages; motion there is CSS + Web Animations API. *Why:* shopping pages carry zero animation-library weight.
- **D-017** Cinema sections load their CSS/JS as their own asset files, not `{% stylesheet %}` (which Shopify concatenates into every page). *Why:* each section loads only its own CSS/JS.

## 3D logo
- **D-020** The logo is Origin's shooting-star mark (star + open swoosh); it has no "O". The camera flies through the swoosh's orbit loop: the bake closes the gap between swoosh tip and star with a virtual chord, finds the largest inscribed circle (polylabel) and paths the camera along its axis. *Why:* it's their real mark, and the no-clip math is the same as for an O counter.
- **D-021** Source art is `design/logo/origin-star-2000.png` (from originmanila.com), traced to `theme/assets/logo.svg` in step 6. *Why:* no official SVG exists on a spec build; 2000px is enough for a clean trace.
- ~~**D-022** SVG → GLB is baked offline (Node + three SVGLoader/ExtrudeGeometry + gltf-transform meshopt); the fly-through path is stored in glTF extras. *Why:* runtime extrusion of a bevelled logo is a 100–300ms main-thread task on mid-range phones (INP).~~ → superseded by D-027.
- **D-023** MeshPhysicalMaterial (metalness 1, roughness ≈0.08, iridescence ≈0.25, clearcoat) lit by a procedural studio environment through PMREM. *Why:* real reflections with no HDR download.
- **D-024** No post-processing; sparkles are additive sprites with a twinkle shader; grain is CSS. *Why:* a bloom pass doubles fill-rate cost on mobile.
- **D-025** WebGL only without reduced-motion, Save-Data or low memory; DPR cap 1.5 mobile / 2 desktop; renders only while visible; a frame-time watchdog falls back to the poster; idle float instead of gyro tilt. *Why:* performance budget, and iOS gyro needs a permission prompt.
- ~~**D-026** The static poster is rendered from the same GLB (`tools/poster.html`).~~ → superseded by D-028.
- **D-027** The logo is extruded at runtime from `assets/logo.svg` (traced by `npm run trace:logo`), after load + idle. *Why:* the real mark is two simple shapes (a few ms to extrude), so a GLB pipeline, meshopt decoder and the `.glb`-in-assets risk bought nothing.
- **D-028** Static fallback = the same SVG inlined (`inline_asset_content`) with an SVG chrome gradient; optional image override setting. *Why:* zero download, crisp at any size, identical silhouette; it is also the first paint the 3D crossfades from.
- ~~**D-029** Fly-through target: rasterize the mark, keep empty cells walled in on ≥6 of 8 directions, pick the one with the most clearance (radius 188 SVG units on their logo). Camera near plane 0.01 ≪ clearance, asserted as `safe` at runtime. Accelerating dolly crosses the logo plane at ~93% scroll, on the flash cut. *Why:* the brief's "compute the path from the counter so it never clips", adapted to an open loop.~~ → superseded by D-099.

## Design system
- **D-030** Archivo variable (OFL, self-hosted latin subset; wide + black for display) and a `font_picker` body font; UnifrakturMaguntia (OFL) blackletter loads only in sections that use it. *Why:* one file covers display and UI; blackletter never loads on shopping pages.
  - *Step 5:* blackletter is **Grenze Gotisch** (OFL, no Reserved Font Name, 17 KB), not UnifrakturMaguntia (has an RFN, which makes a redistributed subset a licensing gray area).
  - *Refined in step 3:* body `archivo_n4`, subheading `archivo_n6`, heading + accent `archivo_n7` from Shopify's font library (editable; heading = accent so no extra download). Display = `assets/om-archivo-expanded.woff2` (Archivo, wdth 125, wght 800–900, latin, 34.7 KB, preloaded), applied to h1/h2 through `--font-heading--family` when the "Wide display headings" setting is on. Fallback faces are metric-matched from browser measurements (Arial Black 116.4%, Arial/Helvetica Bold 132.1%) to avoid CLS on swap. OFL text ships in `snippets/om-licenses.liquid`.
- **D-031** Motion: UI 240ms `cubic-bezier(.2,.8,.2,1)` in / 160ms out; micro 120ms; scrubbed timelines `ease: none` with `scrub: 0.8`; one-shots `expo.out` 0.7s; flash cut 120ms; card sheen 700ms; fly-to-cart 550ms arc. *Why:* snappy UI, cinematic scroll, nothing a buyer waits on.
- **D-032** Sticky header, transparent over the hero then solid black; hides on scroll-down only on the homepage. Desktop inline menu with a light mega panel; mobile full-screen menu dialog with search. *Why:* cart and search stay reachable on every shopping page.
- **D-033** Page transitions: `@view-transition { navigation: auto }` plus a card → product image morph; Horizon's render-blocking `<link rel="expect" blocking="render">` is removed (done in step 1, `snippets/view-transition-opt-in.liquid`; `view-transitions.js` already treats it as optional). Both transition settings stay off until step 4 tunes them. *Why:* the brief says transitions never delay navigation.
- **D-034** Word-by-word reveals are split in Liquid (spans + a visually hidden full sentence); no SplitText. *Why:* no JS layout work, no CLS, screen readers read the sentence once.
- **D-035** The colorway background tweens the sticky stage, not `<body>`. *Why:* looks identical and avoids a full-page repaint every frame.
- **D-036** Film grain only in the homepage cinema. *Why:* invisible where it could slow a buyer down.
- **D-037** Palette (Horizon 4.2 `color_palette`, every other color follows it): background `#0a0a0b`, foreground `#f4f4f2`, color1 `#a1a1a6` (muted text, 7.7:1), color2 `#17171a` (surfaces), color3 `#6e6e74` (input/variant/popover borders, ≥3:1 for UI components). *Why:* black base per brand, AA everywhere, and the owner re-themes from one control.
- **D-038** Zero corner radius on buttons, inputs, cards, badges, popovers and variant buttons; buttons and badges uppercase in the accent font. *Why:* hard-edged streetwear look; chrome and sparkle carry the Y2K part.
- **D-039** Header: uppercase 12px accent-font menu, 1px divider, sticky always, transparent over the homepage hero; announcement "Shipping worldwide from Manila" (their store ships to most countries per `meta.json`). *Why:* settings-only restyle keeps Horizon's header behavior; the copy is editable demo content in `header-group.json`, not theme code.

## Storyboard
- **D-040** Order: Intro → Hero → Concrete Jungle manifesto → Color Run (Concrete Jungle camo hoodies) → 1 OF NONE exhibit → Shop the Drop → Finale / Drop Mode. *Why:* the camo colorways pay off the Concrete Jungle story, and the one-of-ones become the climax.
- **D-041** Gemstones is cut as a standalone scene and replaced by "Shop the Drop" (Horizon product list of NEW); Gemstones ships as a Color Run preset. *Why:* all 4 Gemstone Beanies are sold out, it repeats the Color Run mechanic, and the page lacked a plain buy-now moment.
- **D-042** Intro is ≤1.2s, painted over the already-rendered hero and CSS-timed so it can't trap anyone; skipped for reduced motion, in the theme editor and on repeat views in a session. *Why:* it must never cost LCP.
- **D-043** With no drop date, the finale is a typographic category index with live counts. *Why:* the page always ends on a way to shop.
- **D-044** Drop signup is a normal POST customer form (tags: newsletter + drop), no AJAX. *Why:* Shopify's bot protection can interject a challenge page that AJAX can't show.
- **D-045** Drop date is a text setting (ISO, Manila time); the server renders by `now` and JS re-checks the clock and flips on its own. *Why:* no metaobject setup on their store, and it survives full-page caching.
- **D-046** 1 OF NONE exhibit: sticky horizontal track on desktop; native swipe + scroll-snap on mobile (no pin). *Why:* vertical-to-horizontal scroll hijack is hostile on touch.
- **D-047** The exhibit stat counts published products live (the public count is 47, not the 71 in collections.json). *Why:* never hard-coded.

## Commerce
- **D-050** CLAIMED stamp only when every variant is sold out; sold-out sizes are struck through; available one-of-ones get a "1 exists" tag. *Why:* accurate scarcity, not a dead-looking store.
- **D-051** Optional "Notify me" on sold-out sizes is a customer form with tag `restock-<handle>`. *Why:* back-in-stock without an app; the owner segments by tag in Shopify Email.
- **D-052** Option names are matched case-insensitively (Size / SIZE / WAISTLINE); size-like names are a theme setting. *Why:* their data is inconsistent and must work as-is.
- **D-053** No metafields or metaobjects are required. *Why:* zero setup on their store.
- **D-054** Filters come from Shopify Search & Discovery (free, first-party). *Why:* storefront filters are configured there; the theme renders whatever is set.
- **D-055** CLAIMED stamp (`snippets/om-product-status.liquid`): red `#ff3b47` Archivo Expanded on a 90% black plate, double border, −9°; ≥4.5:1 even over a white photo. Accessible name is the translated "Sold out"; label, color and image dimming are settings. Horizon's sold-out badge is suppressed on cards (sale badge kept). *Why:* scarcity as a flex without losing legibility or meaning for screen readers.
- **D-056** "Only 1 exists" tag comes from a collection setting (default `1-of-none`), not product tags. It sits in the top corner opposite Horizon's sale badge; bottom corners belong to quick add. *Why:* their real products aren't tagged; collection membership resolves on their store; the first placement collided with mobile quick add.
- **D-057** Product-card titles are clamped to 2 lines in CSS; the full title stays in the DOM. *Why:* a 120-character title grew a card to 6 lines and broke the grid rows.
- **D-058** The hotspot dialog keeps Horizon's plain "Sold out" text instead of the stamp. *Why:* it replaces the buy button, and the purchase point should be literal.
- **D-05A** Product page: the CLAIMED stamp overlays the lead image (carousel and grid presentations); the buy button keeps Horizon's literal "Sold out". Add to cart keeps Horizon's fly-to-cart + bubble bump, adds a CSS chrome glint (off for reduced motion), and auto-opens the cart drawer. Page transitions (cross-document, card → product image) are on, non-blocking since D-033. *Why:* the signature details reuse Horizon's tested AJAX cart + Section Rendering instead of a second implementation.
- **D-059** Mobile quick add is on. *Why:* one-tap add on phones, where most of their traffic will be.

## Cinema build (steps 5–7)
- **D-090** Vendor packs via esbuild: vendor-gsap.js 44 KB gz, vendor-three.js 155 KB gz (tree-shaken). Homepage only; three loads after `load` + idle.
- **D-091** Section JS imports shared code by relative URL (`./om-cinema.js`) instead of adding a second import map. *Why:* assets are one flat CDN folder; avoids import-map merging issues.
- **D-092** Color run has no scroll snapping. *Why:* snapping felt like a hijack in testing; each colorway gets a fixed scroll share instead.
- ~~**D-093** The homepage header hides while scrolling forward through the hero and returns on any upward scroll or keyboard focus. *Why:* the transparent header sat on top of the chrome during the fly-through.~~ → superseded by D-099.
- **D-094** Default demo copy (manifesto, kicker, drop date 2026-10-10 20:00 +0800) lives in `templates/index.json` / section defaults, all editable. *Why:* the pitch needs a finished look; Origin replaces the copy in the editor.
- **D-095** Password page shows the drop countdown without its own signup (Horizon's password section already has one).

- ~~**D-096** Hero choreography (user request, 2026-09-29): the logo first recedes and floats above the title so "ORIGIN MANILA" and the quote read clearly (0–0.28), holds (to 0.5), returns face-on (0.5–0.7), then the camera flies through the loop (crosses at ~97%, flash at 0.955). Default scroll length 280vh desktop / 220vh mobile to fit the hold. The vector fallback follows the same path.~~ → superseded by D-099.
- **D-097** Loading intro = the chrome logo spinning 360° (CSS 3D on the inlined vector) + small counter + flash, ≤1.5 s; the WebGL logo then enters with its own 360° turn. *Why:* the real WebGL logo can't be ready inside the intro's 1.5 s budget on a cold mobile load (≈155 KB gz + GPU setup), so the loader uses the instant vector and the 3D spin lands right after.
- **D-098** *(quote placement superseded by D-100)* Their line "In the trap we shine" sits under the headline as a quiet, wide-tracked chrome line with "shine" in blackletter — no quote marks or decoration. Demo copy trimmed to concrete, short lines (manifesto: "Built in the concrete jungle. Every 1 of none is cut once, never again. Made in Manila, worn after dark."; hero kicker "Manila · One of none"). All editable.

- **D-099** Hero docking (user request, 2026-09-29): scrolling flies the whole logo wrapper (vector or 3D canvas, one DOM transform) into the header's chrome star and hands off with a 5% crossfade; the 3D turns face-on so it lands flat. The target is measured live (priority: header mark → uploaded logo image → logo link) and recomputed on every refresh; measured alignment 1px at 1280px. The fly-through-the-loop and the homepage header auto-hide are removed (the header must stay put to receive the logo). The header shows a chrome star + store name lockup on every page (`snippets/om-header-mark.liquid`, cached `assets/logo-chrome.svg`, setting "Chrome star beside the store name"). WebGL stops rendering once docked. Hero default length 170vh desktop / 150vh mobile.
- **D-100** "In the trap we shine" moved out of the hero into the Concrete Jungle section as its climax: after the manifesto lights up, the line lands big in chrome (word by word, rising slightly), "shine" in blackletter, a hairline rule above, and one overlay glint once fully lit (re-arms when scrolling back). Blackletter stays at two words on the page ("Manila", "shine").
- **D-101** `npm run check:js` parses every `om-*.js` as an ES module. *Why:* a syntax error (`-x ** 3`) silently dropped the hero to its vector fallback — correct resilience, but it hid the bug.
- **D-102** The hero headline never breaks inside a word (`word-break: keep-all`, `overflow-wrap: normal`) and sizes at 13vw. *Why:* Horizon's heading styles split "MANILA" as "MANIL/A" at 375px.

## Horizon findings
- **D-080** At ≥990px Horizon scrolls inside `.page-wrapper` (`html`/`body` are `overflow: hidden`, height 100dvh) so the theme drawer can push the page; below 990px the window scrolls. *Why it matters:* cinema ScrollTriggers must use `.page-wrapper` as the scroller on desktop and the window on mobile (set per `gsap.matchMedia` branch); sticky stages work in both.
- **D-081** Horizon sets `scroll-behavior: smooth` on `html` and `.page-wrapper` for everyone; `om-brand.css` turns it off under `prefers-reduced-motion: reduce`. *Why:* accessibility non-negotiable.
- **D-082** Console on the `127.0.0.1` proxy shows three platform errors (the `shopify-account` widget's Storefront API call returns 400 and "menu not found"; Shop Pay's iframe is blocked by `frame-ancestors`). None come from theme code. *Why logged:* re-check on the real `?preview_theme_id=` URL in QA before claiming zero console errors.

## Demo data
- **D-060** The CSV uses the exact header row of Shopify's current product template (help.shopify.com/csv/product_template.csv), UTF-8, LF. *Why:* "current import format".
- **D-061** Handles, titles, descriptions, option names and values are mirrored exactly. *Why:* prove the theme on their real, messy data.
- **D-062** Tags = collection handles (+ their existing tags). Collections are smart collections "Product tag is equal to <handle>" with the handle set by hand. *Why:* the CSV "Collection" column only makes one manual collection per product, named by title (wrong handles).
- **D-063** Inventory: sold-out variants 0; available variants 1 in 1-of-none, 6 elsewhere; policy DENY. *Why:* the public JSON exposes availability, not quantity, and one-of-ones should behave like one-of-ones.
- **D-064** The catalog snapshot in `demo/data` and the generated files in `demo/out` are committed. *Why:* the demo stays reproducible as their stock changes, and the CSV is importable straight from the repo.
- **D-065** Variant weights above 30 kg are left blank in the CSV and listed in `catalog-report.md` (one variant on their store says 500,000 g). *Why:* it would break weight-based shipping rates in test checkouts; everything else is mirrored as-is.
- **D-066** Image alt text: the public JSON has none, so the CSV uses the product title (image 1) and "title, view N" (others). *Why:* no empty alts in the demo gallery.
- **D-067** CSV rows are written oldest-first by `published_at`. *Why:* import creates products in row order, so the admin's "Newest" sort lands close to their live order.
- **D-068** Menu parents (Tops, Bottoms, More) link to `/collections/all`. *Why:* Shopify menu items need a link; the theme opens children on hover/tap anyway.
- **D-070** The dev store is seeded through the Admin API (`npm run demo:seed`: bulk `productSet` upserts by handle, smart collections, menus) instead of manual CSV import and clicking; the CSV stays as a verified manual fallback. Shared rules live in `demo/scripts/catalog.mjs`. The script only targets `shopify.theme.toml`'s dev store and checks `plan.partnerDevelopment`. *Why:* repeatable, no admin clicking, and the user approved seeding the dev store (2026-09-28).
- **D-071** Dev store `origin-demo-hoqa85o7.myshopify.com` (created with `shopify store create dev --country PH`) is pinned in `shopify.theme.toml`; `npm run dev` uses `-e dev`. *Why:* the generated domain has a random suffix, and typing it wrong gives a confusing 404.
- **D-069** `demo:verify -- --live` is best-effort: help.shopify.com sometimes answers 403 to scripted requests, so a failed download is a warning. `HEADERS` was checked against the template downloaded 2026-09-27 (saved in `demo/reference/`). *Why:* bot protection shouldn't fail an otherwise valid CSV.
