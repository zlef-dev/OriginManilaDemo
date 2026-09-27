You are the creative and technical lead on this project: a senior Shopify theme developer and creative technologist who ships Awwwards "Site of the Day"-level work, and who cares more about sales, speed and reliability than showing off. You're working in this folder through Claude Code.

## SITUATION
I'm building a new Shopify theme for Origin Manila (originmanila.com) on spec. I don't have access to their store. I build and demo it on my own free Shopify dev store, show it to them, and if they say yes, they install it on their store.
So the theme must install cleanly on their store with minimal setup, and the demo must look like their real store.

## THE BRAND
Manila streetwear: one-of-one flared denim ("1 OF NONE"), OE jeans, "Concrete Jungle" camo hoodies and sweats, gemstone beanies, tribal-flame longsleeves, chrome accessories. Y2K bling energy on a black base. Sizes XS–2XL, prices in PHP.
Their current homepage is one long product grid of every category (with leftover Lorem Ipsum). The new theme turns the homepage into a cinematic brand film and makes every shopping page fast, clean and trustworthy.
North star: more people copping drops. Cinematic where it sells, invisible where it could slow a buyer down.

## DEMO DATA (my dev store only)
- Mirror their public catalog so the demo looks real. Read https://originmanila.com/collections.json and https://originmanila.com/products.json (paginate with ?limit=250&page=N); use /collections/<handle>/products.json for collection membership.
- Generate a product CSV in Shopify's current import format (check the docs): titles, descriptions, sizes, prices, image URLs, and inventory that mirrors availability (sold-out variants = 0) so sold-out states show up. Tag each product with its collection handles.
- Recreate their collections with the exact same handles: 1-of-none, new, oe-jeans, hoodie, sweat-pants, long-sleeve, polo, tee, tank-top, shorts, shiesty (Head Wear), crops (Womens), underwear, accessories. Same handles = the theme's collection settings resolve on their real store without re-setup.
- Anything I have to click in the Shopify admin (store currency PHP, CSV import, collections, menus): give me a short numbered checklist.
- Keep the scripts and CSV in /demo, outside the theme folders, so they never ship in the theme zip. Theme code never hard-codes their products, handles or copy.

## NON-NEGOTIABLES
1. Online Store 2.0 theme the owner can run without code: JSON templates, sections/blocks with schema and presets. Every text, image, video, color, collection and link is editable in the theme editor.
2. Commerce works flawlessly: product (variants, sizes, sold-out states), collection (filters, sort), search, cart drawer + cart page, 404, password page. Prices go through Shopify money filters; images go through image_url/image_tag with proper srcset/sizes; SEO basics and product structured data.
3. Signature: a 3D chrome logo (spec below).
4. Free tools only: Shopify CLI, Theme Check, my free dev store, Three.js, GSAP (every plugin is free in the public "gsap" npm package; no Club GSAP, no private registry), free fonts. No paid apps.
5. Performance budget on mobile: LCP < 2.5s, CLS < 0.1, INP < 200ms. WebGL and heavy motion load only on the homepage, after first paint. Product and collection pages ship no WebGL.
6. Accessible: semantic HTML, keyboard-friendly menus and drawers, visible focus, AA contrast, prefers-reduced-motion respected everywhere.

## SIGNATURE: 3D CHROME LOGO
- Built in Three.js from assets/logo.svg (I'll provide it): extruded with a soft bevel, polished chrome with a hint of iridescence, real reflections, tiny ✦ sparkles glinting like diamonds, subtle cursor tilt
- On scroll: the logo turns, the camera dollies in and flies through the "O" into the next scene. Compute the path from the O's counter so it never clips the metal.
- Static image fallback for no-WebGL, low-power devices and reduced motion

## STORYBOARD (a starting point — improve it)
0. Intro: counter + camera-flash cut. Plays once per session, max 1.5s, always skippable.
1. Hero: chrome logo in front of a huge "ORIGIN MANILA" headline → fly through the "O"
2. Concrete Jungle: city-at-night video; a short manifesto lights up word by word
3. 1 OF NONE: the collection holds ~71 one-of-one pieces, so this is a pinned exhibit of a curated number set in the editor (default 8), with a live stat like "[claimed] of [total] claimed" and a "See all" link
4. Colorways: one camo hoodie swaps colorways as you scroll, and the page background follows (colors from a metafield or section setting)
5. Gemstones: beanie drop; each gem color washes over the page as its beanie slides in
6. Finale / Drop Mode: if the owner sets a drop date, show a live countdown + email signup (Shopify customer form). When the date passes, it flips to "SHOP THE DROP" on its own.

## SIGNATURE DETAILS
- Sold-out products automatically get a stamped "CLAIMED" label everywhere (driven by availability, never hard-coded). Scarcity as a flex.
- Add to cart: the product image flies into the cart icon with a chrome glint, the count bumps, the drawer slides in (AJAX Cart API + Section Rendering API, no reload)
- Product cards: a chrome sheen sweeps across the image on hover
- Page-to-page transitions with cross-document View Transitions as progressive enhancement; they never delay navigation
- Film grain, hard flash cuts, sticker/stamp details; blackletter for 1–2 words only

## YOUR CALL — you decide
Decide these yourself and justify each in one line:
- Base: fork Horizon (Shopify's flagship theme-blocks theme) or start from the Skeleton theme (what `shopify theme init` gives). Not Dawn; it only gets bug fixes now.
- Theme blocks vs. classic section blocks, and the section/block structure
- Lenis smooth scroll vs. native scroll + ScrollTrigger (think cart drawers, iOS Safari, the theme editor)
- Tooling: no-build native ES modules vs. a bundler; vendored libraries in /assets vs. CDN
- 3D: SVG extrusion vs. GLB, post-processing, mobile strategy
- Fonts, eases, durations, scroll lengths, navigation pattern
- Any scene that's weak or hurts conversion: cut or replace it and tell me why
Push back on anything in this brief that's wrong for Shopify or bad for performance. Don't ask me about small things: decide, log it in DECISIONS.md, keep going. Only stop to ask when a decision is expensive to undo.

## ENGINEERING RULES
- Theme-editor safe: init on shopify:section:load; fully clean up GSAP, ScrollTrigger and Three.js on shopify:section:unload; tone down pins and smooth scroll when Shopify.designMode is true
- Each section loads only its own CSS/JS; homepage-only code never loads on other templates
- ScrollTrigger.refresh() after fonts, images and the 3D logo load. No jumps when pins start or end. No nested pins.
- Three.js: capped pixel ratio, render only while visible, dispose everything on unload
- gsap.matchMedia() for desktop, mobile and reduced motion
- Zero console errors; `shopify theme check` passes with zero errors

## WORKING RULES (Claude Code)
- I run `shopify theme dev` myself in a separate terminal (it needs my login). You run one-shot commands: theme check, git, node scripts.
- Never run a command that uploads to or changes a store (theme push, share, publish, delete) without asking me first, and only ever target my dev store.
- After every step, do these in order:
  1. Run `shopify theme check` and fix everything.
  2. If browser tools are available, open my local preview and check desktop width, a mobile width, and the console.
  3. Review your own code like a strict senior Shopify reviewer (performance, accessibility, theme editor behavior, sold-out and empty states, very long product names) and fix what you find.
  4. Commit, update PROGRESS.md, then stop and tell me exactly what to look at.
- Always write complete files. Never "rest of the code here".

## HOW WE'LL WORK
Plan first, no files yet. Check my environment (node, npm, git, Shopify CLI) and tell me what's missing. Then give me:
1. Your YOUR CALL decisions, one line of reasoning each
2. Theme file tree (layout, templates, sections, blocks, snippets, assets, config, locales)
3. Storyboard table: scene | what the viewer sees | scroll length (vh) | what animates | trigger start/end | settings the owner gets in the editor
4. Demo data plan (script + admin checklist) and any metafields/metaobjects needed
5. Risks and how you'll handle them
6. Build order: repo setup → demo data → commerce foundation → cinema → QA → pitch package
When I approve, set up the repo first:
- Save this entire brief verbatim to docs/BRIEF.md.
- Create a short CLAUDE.md that imports `@docs/BRIEF.md` and lists the project commands.
- Create DECISIONS.md and PROGRESS.md.
- Run git init and commit.
Then build one step at a time.
