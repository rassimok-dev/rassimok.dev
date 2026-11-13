# /klad/ — the game

A clean-room homage to «Клад» (Korvet ПК-8020), itself a clone of Rise Out
(ASCII, MSX, 1983). Own code, own art, own levels. Rules: `MECHANICS.md`.

This folder holds all of the site's browser JavaScript. Apart from the API
proxy (below), it is self-contained on purpose so it can be removed in one go.

## Files
| | |
|---|---|
| `index.html` | page: HUD, canvas, touch pad, footer, the nick prompt and boards dialogs |
| `klad.css` | styles; defines the palette the game reads |
| `klad.js` | engine: movement, guards (BFS chase), shots, holes, phases, render, input; holds while a dialog is open |
| `levels.js` | five levels, each in two shapes (landscape 24×16, portrait 16×24), with a `revision` |
| `ticks.js` | tick constants and the time formatter (`m:ss.cc`), also loaded by the node tests |
| `online.js` | online part: nick prompt, sending clears and runs, the boards; its logic half is also loaded by the node tests |
| `test/levels.test.js` | `node --test`: shape, legend, key-then-exit reachability, revision, fastest clear above the API floor |
| `test/online.test.js` | `node --test`: `online.js` against a fake `fetch`: request shapes, when results wait or go, 401, 404, 409, 429, offline |
| `test/proxy.test.js` | `node --test`: the API proxy against a fake `fetch` |
| `test/ticks.test.js` | `node --test`: the time formatter |
| `MECHANICS.md` | the original rules as reconstructed from sources |

No build step, no dependencies, no localStorage. Level resume is the URL
hash (`/klad/#3`).

## Online
`online.js` loads after `klad.js` and listens for its two events on
`document`: `klad:clear` (a level cleared) and `klad:run` (game over or the
last level done). On load it asks `GET /klad/api/players/me` whether this
browser already has a player; the API's HttpOnly cookie is the only
identity, and nothing is kept in the browser. Only a 401 means "no player
yet"; any other failure means the API is unavailable, and then the game
never asks for a nick and plays as before.

- The first result without a player opens the nick prompt (nick, human or
  agent, the privacy note). Results wait in memory until the player saves a
  nick (then they are sent) or skips (then they are dropped, and the game
  does not ask again until the page is reloaded).
- A run is sent only when it started at level 1 (`fromLevelOne`).
- The boards open with `T` or the "Таблицы" button: records, fastest clear
  and most chests per level and shape, and chests over all levels, for
  humans or agents. The same dialog changes the nick and deletes the nick
  and all results (`DELETE /players/me`).
- Any open `<dialog>` holds the game: play pauses, timers stop and game keys
  are ignored. Closing it puts the focus back on the field.
- Nicks come from other players, so every text is set with `textContent`.

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
   `README.md`: the opening line, the exceptions under "Principles" (the
   cookie, the stored data and how to delete it), the `/klad/*` header row
   and the note below the table, the section "The game's API", check 5
   under "CI", and the `functions/` sentence under "Deployment".
5. Delete the `API_ORIGIN` variable in the Pages project settings.
