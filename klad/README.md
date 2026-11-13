# /klad/ — the game

A clean-room homage to «Клад» (Korvet ПК-8020), itself a clone of Rise Out
(ASCII, MSX, 1983). Own code, own art, own levels. Rules: `MECHANICS.md`.

This folder holds all of the site's browser JavaScript. Apart from the API
proxy (below), it is self-contained on purpose so it can be removed in one go.

## Files
| | |
|---|---|
| `index.html` | page: HUD, canvas, touch pad, footer |
| `klad.css` | styles; defines the palette the game reads |
| `klad.js` | engine: movement, guards (BFS chase), shots, holes, phases, render, input |
| `levels.js` | five levels, each in two shapes (landscape 24×16, portrait 16×24) |
| `test/levels.test.js` | `node --test`: shape, legend, key-then-exit reachability |
| `test/proxy.test.js` | `node --test`: the API proxy against a fake `fetch` |
| `MECHANICS.md` | the original rules as reconstructed from sources |

No build step, no dependencies, no localStorage. Level resume is the URL
hash (`/klad/#3`).

## The API proxy
`functions/klad/api/[[path]].js` is a Cloudflare Pages Function. It forwards
`/klad/api/<path>` to `<API_ORIGIN>/<path>` with the query string, the method,
the body and only the `Content-Type`, `Accept` and `Cookie` headers, and
returns the API's answer unchanged. `API_ORIGIN` is a Pages environment
variable, set per environment (Production, Preview); a deploy without it
answers 503 `{"error":"not_configured"}`. If the API cannot be reached, the
proxy answers 502 `{"error":"upstream"}`. `_routes.json` keeps every other
path off the Function; should one reach it anyway, a path that is not
`/klad/api` or under `/klad/api/` gets 404 `{"error":"not_found"}` and never
reaches the API. The same 404 answers `/klad/api/q` and everything under it,
so the API's Quarkus health and dev endpoints stay off the site; the check
runs on the decoded path, so `/klad/api/%71/health` and
`/klad/api//q/health` are refused too. All three error answers carry
`Cache-Control: no-store`.

## To remove the game entirely
1. `git rm -r klad/ functions/klad/api/ _routes.json`
2. Delete the `/klad/*` block in `_headers`, with its `script-src 'self'`
   and `connect-src 'self'`.
3. In `.github/workflows/ci.yml`: drop `klad/index.html` from html-validate,
   the `--exclude-dir=klad` and the klad script check in "No JavaScript", the
   `*.js` third-party grep, and the "Level sanity" step.
4. Remove the `/klad/` links in `index.html` and the game parts of
   `README.md`: the opening line, the exceptions under "Principles", the
   `/klad/*` header row and the note below the table, the section "The
   game's API", and the `functions/` sentence under "Deployment".
5. Delete the `API_ORIGIN` variable in the Pages project settings.
