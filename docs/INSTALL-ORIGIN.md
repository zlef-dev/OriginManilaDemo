# Origin theme — install guide for Origin Manila

About 10 minutes. Nothing is published until you click Publish, and your current theme stays in
the library as a one-click rollback.

## 1. Upload (2 min)
1. Online Store → Themes → **Add theme → Upload zip file** → `Origin-0.1.0.zip`.
2. Click **Customize** on the new theme (don't publish yet).

## 2. What works immediately
Collection handles in the theme match your store (`1-of-none`, `new`, `hoodie`, `oe-jeans`,
`shiesty`, `crops`, …), and so do product handles. So the homepage exhibit, color run,
"Shop the drop" grid, menus and CLAIMED stamps all pick up your live products and stock with
no setup. Sold-out products get the CLAIMED stamp automatically.

## 3. Five things to set in the editor (5 min)
1. **Theme settings → Logo**: pick your `Star_logo.png` (already in your Files).
2. **Homepage → Origin manifesto → Video**: upload a city-at-night clip (muted, 10–20 s).
   Without one, a built-in city-lights background shows.
3. **Homepage → Origin drop → Drop date**: your next drop, e.g. `2026-10-10 20:00 +0800`.
   Leave it empty to show a "Shop by category" index instead.
4. **Homepage → Origin color run**: confirm the four Concrete Jungle zips (or switch to the
   *Gemstones* preset when gem stock is live).
5. Replace the demo copy (hero kicker, manifesto) with your own words.

## 4. Before publishing (3 min)
- **Apps**: page-builder sections from the old theme don't carry over (that's intended — the
  new homepage replaces them). Turn off any old app embeds you no longer want under
  Theme settings → App embeds.
- **Filters**: in Shopify Search & Discovery, add a **Size** filter (your `Size`/`SIZE` options
  merge into one).
- Preview on your phone, then **Publish**.

## 5. After publishing
Run https://pagespeed.web.dev on the homepage and a product page (mobile). Budget:
LCP < 2.5 s, CLS < 0.1, INP < 200 ms. Product and collection pages load no WebGL or
animation libraries.

## What changed vs. the current site
- Homepage: from one long grid (with leftover Lorem Ipsum) to a scroll film that sells:
  3D chrome logo → Concrete Jungle story → camo colorways → 1 OF NONE archive with a live
  "claimed" counter → new drop grid → drop countdown with email capture.
- Scarcity as a flex: CLAIMED stamps, "Only 1 exists" tags on one-of-ones.
- Faster shopping pages: no page-builder scripts; cart drawer opens on add, no reload.
- Data cleanups worth doing (found while mirroring your catalog): size option spelled several
  ways (`Size`, `SIZE`, `Clor`), product type empty on all products, 23 products without
  descriptions, one variant weighing 500 kg.

## License note
Built on Shopify's Horizon theme, delivered for Origin Manila's own store only (not resold).
Fonts: Archivo and Grenze Gotisch (SIL Open Font License). Notices ship in the theme.
