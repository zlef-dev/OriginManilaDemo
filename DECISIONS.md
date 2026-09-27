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
- **D-008** Theme Check baseline accepted: 0 errors, 6 upstream warnings. 5× `UnusedDocParam` in `snippets/divider.liquid` are false positives (Theme Check can't read dotted `@param settings.x` names; the snippet uses them). 1× `ExcessiveSettingsCount` on `sections/header.liquid` (42 > 40) gets fixed in step 3 when the header is reworked. Everything `om-` must be warning-free. *Why:* editing Horizon files to silence false positives only makes upstream merges harder.
- **D-009** Horizon's license notice ships inside the theme as `snippets/om-license-horizon.liquid` (comment only, rendered from `layout/theme.liquid` so it isn't orphaned; outputs nothing). *Why:* `shopify theme package` drops root files like `LICENSE.md`, and the license requires the notice in every copy.
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
- **D-022** SVG → GLB is baked offline (Node + three SVGLoader/ExtrudeGeometry + gltf-transform meshopt); the fly-through path is stored in glTF extras. *Why:* runtime extrusion of a bevelled logo is a 100–300ms main-thread task on mid-range phones (INP).
- **D-023** MeshPhysicalMaterial (metalness 1, roughness ≈0.08, iridescence ≈0.25, clearcoat) lit by a procedural studio environment through PMREM. *Why:* real reflections with no HDR download.
- **D-024** No post-processing; sparkles are additive sprites with a twinkle shader; grain is CSS. *Why:* a bloom pass doubles fill-rate cost on mobile.
- **D-025** WebGL only without reduced-motion, Save-Data or low memory; DPR cap 1.5 mobile / 2 desktop; renders only while visible; a frame-time watchdog falls back to the poster; idle float instead of gyro tilt. *Why:* performance budget, and iOS gyro needs a permission prompt.
- **D-026** The static poster is rendered from the same GLB (`tools/poster.html`). *Why:* the fallback matches the live render.

## Design system
- **D-030** Archivo variable (OFL, self-hosted latin subset; wide + black for display) and a `font_picker` body font; UnifrakturMaguntia (OFL) blackletter loads only in sections that use it. *Why:* one file covers display and UI; blackletter never loads on shopping pages.
- **D-031** Motion: UI 240ms `cubic-bezier(.2,.8,.2,1)` in / 160ms out; micro 120ms; scrubbed timelines `ease: none` with `scrub: 0.8`; one-shots `expo.out` 0.7s; flash cut 120ms; card sheen 700ms; fly-to-cart 550ms arc. *Why:* snappy UI, cinematic scroll, nothing a buyer waits on.
- **D-032** Sticky header, transparent over the hero then solid black; hides on scroll-down only on the homepage. Desktop inline menu with a light mega panel; mobile full-screen menu dialog with search. *Why:* cart and search stay reachable on every shopping page.
- **D-033** Page transitions: `@view-transition { navigation: auto }` plus a card → product image morph; Horizon's render-blocking `<link rel="expect" blocking="render">` is removed (done in step 1, `snippets/view-transition-opt-in.liquid`; `view-transitions.js` already treats it as optional). Both transition settings stay off until step 4 tunes them. *Why:* the brief says transitions never delay navigation.
- **D-034** Word-by-word reveals are split in Liquid (spans + a visually hidden full sentence); no SplitText. *Why:* no JS layout work, no CLS, screen readers read the sentence once.
- **D-035** The colorway background tweens the sticky stage, not `<body>`. *Why:* looks identical and avoids a full-page repaint every frame.
- **D-036** Film grain only in the homepage cinema. *Why:* invisible where it could slow a buyer down.

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

## Demo data
- **D-060** The CSV uses the exact header row of Shopify's current product template (help.shopify.com/csv/product_template.csv), UTF-8, LF. *Why:* "current import format".
- **D-061** Handles, titles, descriptions, option names and values are mirrored exactly. *Why:* prove the theme on their real, messy data.
- **D-062** Tags = collection handles (+ their existing tags). Collections are smart collections "Product tag is equal to <handle>" with the handle set by hand. *Why:* the CSV "Collection" column only makes one manual collection per product, named by title (wrong handles).
- **D-063** Inventory: sold-out variants 0; available variants 1 in 1-of-none, 6 elsewhere; policy DENY. *Why:* the public JSON exposes availability, not quantity, and one-of-ones should behave like one-of-ones.
- **D-064** The catalog snapshot in `demo/data` is committed. *Why:* the demo stays reproducible as their stock changes.
