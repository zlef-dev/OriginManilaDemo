# Progress

| # | Step | Status |
|---|---|---|
| 0 | Repo setup | ✅ Done |
| 1 | Base: Horizon fork | ✅ Done (preview check pending on you) |
| 2 | Demo data | ⏳ |
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

## Waiting on you
- Run `npm run dev -- --store <your-store>.myshopify.com` once and confirm stock Horizon boots (a plain Horizon homepage is expected at this point).
