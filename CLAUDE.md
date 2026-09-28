# Origin Manila — Shopify theme (spec build)

@docs/BRIEF.md

## Where things live
- `theme/` — the only folder that ships (fork of Shopify Horizon). Every Shopify command takes `--path theme`.
- `demo/` — catalog mirror scripts, CSV and admin checklist for the dev store. Never ships.
- `tools/` — dev-only helpers (vendor pack, logo bake, poster render).
- `design/` — source art (logo reference PNG). Never ships.
- `DECISIONS.md` — every call, one line of reasoning each. Log new ones there instead of asking.
- `PROGRESS.md` — step status, what to review, what the user still has to do. Update at the end of every step.

## Commands
| Task | Command | Who runs it |
|---|---|---|
| Theme Check | `npm run check` | Claude, after every step (must be 0 errors) |
| Local preview | `npm run dev` (dev store set in `shopify.theme.toml`) | User only (prompts for the storefront password) |
| Mirror catalog | `npm run demo:fetch` | Claude |
| Build product CSV | `npm run demo:csv` | Claude |
| Verify CSV | `npm run demo:verify` | Claude |
| Theme zip | `npm run package` | Claude |
| Vendor libraries (from step 5) | `npm run vendor` | Claude |
| Bake 3D logo (from step 6) | `npm run bake:logo` | Claude |

## House rules
- Never push, share, publish or delete a theme, or change any store, without asking first. Dev store only.
- New theme files use the `om-` prefix. Edits inside Horizon files stay minimal and carry an `OM:` comment so upstream merges stay possible.
- Horizon upstream commit is pinned in DECISIONS.md (D-001).
- Shopping pages (product, collection, cart, search) never load GSAP or three.js.
- This machine has `legacy-peer-deps=true` globally; the project `.npmrc` turns it off for this repo.
- Never run `sed -i` (or anything that writes temp files) inside `theme/` while `npm run dev` is running: the CLI uploads the temp file, Shopify rejects it, and the error page sticks until the dev server restarts. Edit with the Edit/Write tools or a Node script instead.
