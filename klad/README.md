# /klad/ — the game

A clean-room homage to «Клад» (Korvet ПК-8020), itself a clone of Rise Out
(ASCII, MSX, 1983). Own code, own art, own levels. Rules: `MECHANICS.md`.

This folder holds all of the site's browser JavaScript. Apart from the API
proxy (below), it is self-contained on purpose so it can be removed in one go.

## Files
| | |
|---|---|
| `index.html` | page: HUD, canvas, touch pad, footer, the nick prompt, boards and lobby dialogs |
| `klad.css` | styles; defines the palette the game reads |
| `klad.js` | engine: movement, guards (BFS chase), shots, holes, phases, render, input; holds while a dialog is open |
| `levels.js` | five levels, each in two shapes (landscape 24×16, portrait 16×24), with a `revision` |
| `ticks.js` | tick constants and the time formatter (`m:ss.cc`), also loaded by the node tests |
| `online.js` | online part: nick prompt, sending clears and runs, the boards, accounts (login by emailed code, logout); its logic half is also loaded by the node tests |
| `lobby.js` | the lobby: who is in it, rooms by invite link, ready marks, the host's level and Start, and the one socket module (`KLAD_LOBBY.connect`) the race reuses; its logic half is also loaded by the node tests |
| `test/levels.test.js` | `node --test`: shape, legend, key-then-exit reachability, revision, fastest clear above the API floor |
| `test/online.test.js` | `node --test`: `online.js` against a fake `fetch`: request shapes, when results wait or go, a skip during a save, blocked cookies, login codes, verify answers and merges, the read-back after a login, a login ending a skip, logout, 400, 401, 404, 409, 429, offline |
| `test/lobby.test.js` | `node --test`: `lobby.js` against a fake `fetch`, a fake clock and a fake `WebSocket`: the room id form and the `#room=` link, the room view and the Start condition, presence and room polls only while open and visible, the poll after an own action, 404, 409 `room_full`, the socket at `starting` (backoff, 1008, the cap in all, its stop), the re-join after the sweep (heartbeat 204 not counted, a tap on Ready, 57 s, network failures, a poll answered after a hide), another link and the leave button during a join, the answers after the close, the request budget for an hour |
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
does not ask for a nick until the API answers again (opening the boards
checks again) and plays as before.

- The first result without a player opens the nick prompt (nick, human or
  agent, the privacy note). Results wait in memory until the player saves a
  nick (then they are sent) or skips (then they are dropped, and the game
  does not ask again until the page is reloaded, a nick is chosen in the
  boards, or a login). A skip while the nick is
  still being saved deletes the new player again.
- A run is sent only when it started at level 1 (`fromLevelOne`).
- The boards open with `T` or the "Таблицы" button: records, fastest clear
  and most chests per level and shape, and chests over all levels, for
  humans or agents. The same dialog changes the nick and deletes the nick
  and all results (`DELETE /players/me`).
- Accounts live in the same dialog. A guest, or a browser with no player,
  asks for a code (`POST /login/code`, an email) and logs in with it
  (`POST /login/verify`, the email and the code as a string of 6 digits;
  spaces around a pasted code are trimmed). A new account is
  the guest itself; logging in to an existing account moves the guest's
  results into it only when both have the same kind (human or agent), and
  the dialog says which happened. After a login the player is read back;
  none means blocked cookies, as after a new nick. An account shows its
  email (only to itself) and its kind, which it keeps from the guest; it
  can log out (`POST /logout`) and delete itself with the same button,
  email included. The boards mark every nick as `гость` or `аккаунт`.
- For a code request the API stores not the address but its SHA-256 hash:
  with the code's hash until the code is used, replaced or expires, and
  with the request time, for the limits, for a day; outdated records go with
  the next code request. It stores the
  address itself only once a login creates or opens an account, and it
  mails nothing but login codes. Both footers and the login part say so in
  full, the nick prompt in short; the meta description names only the hash.
- Any open `<dialog>` holds the game: play pauses, timers stop and game keys
  are ignored. Closing it puts the focus back on the field.
- Nicks come from other players, so every text is set with `textContent`.

## Lobby
`lobby.js` loads after `online.js` and opens with the "Лобби" button or a
link `/klad/#room=<id>`. It needs a player: it reads it through
`KLAD_ONLINE.page`, and without one it opens the nick prompt there first
(from a link, it then joins the room). Everything is REST through
`/klad/api` (contract section 7), and nothing is sent while the lobby is
closed or the tab is hidden:

- While it is open: `POST /presence` and then `GET /presence` (who is in
  the lobby), at most once per 30 s each, about 240 requests an hour.
- In a room: `GET /rooms/<id>` every 10 s, plus once right after each own
  action (join, ready, level, start), about 360 an hour more. Leaving is
  `POST /rooms/<id>/leave`; closing the dialog leaves too while the room is
  in the lobby state.
- A room id is checked against `^[A-Za-z0-9_-]{10}$` before any request;
  a malformed one, a 404 and a 409 `room_full` each show their message.
- When a polled room is `starting`, the lobby opens one socket to
  `wss://<host>/klad/api/race/<id>` with `KLAD_LOBBY.connect` and hands it
  on: it dispatches `klad:race` on `document` with `detail.room` (the polled
  room: id, level, shape, players) and `detail.socket` (`send(object)`,
  `on('message', listener)` for parsed JSON frames, `on('status',
  listener)`, `status()`, `hasOpened()`, `close()`). The race listens for
  that event; the lobby only shows a waiting line. A dropped socket tries
  again after 0.5, 1, 2 and 4 s, then reports `offline` and stops; an open
  starts the waits again, but one `connect()` reconnects at most 8 times
  in all. Close 1000 ends it as `closed` and 1008 as `offline`, both with
  no retry. One that never opened shows "online play is not available in
  this browser". The lobby closes the socket on leaving and once the room
  is back in the lobby state.
- The room marks the caller's own entry with `you`, so the lobby finds this
  player by it (nicks may repeat among guests). An empty room (host null,
  no players) shows no member, like a room this player was dropped from.
- Re-join after the API's 60 s sweep: only a room answer that lists the
  player (`you`) counts as seen; a heartbeat's 204 does not, because the API
  answers it even after sweeping the player. A lobby-state room polled
  without `you`, when the last sight is over 55 s old at sending (a margin
  below the 60 s), gets one `POST /rooms/<id>/join` and one more poll; the
  view then shows the current host. An action that gets 404 at that age
  joins once instead of saying "room not found". A join that fails with 0
  or 5xx keeps the room and shows offline; the next poll tries again, at
  most one join per poll. A poll answered after the tab hid again does
  nothing. Inside the 55 s, or in a starting or running race, the room view
  ends with a message.
- Joining another room leaves the current one. Leaving (the button or
  closing the dialog) while a join is out takes the room off the screen at
  once and sends `POST /rooms/<id>/leave` only after the join answers. Any
  answer that comes back after the dialog closed does not act: a room
  created meanwhile is left at once.
- Status: written before RAS-31 was deployed; it has not yet run against the
  live API.

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

A WebSocket upgrade (`Upgrade: websocket`, either case) goes through the same
path rules and errors, and is forwarded with `fetch` to the same address,
adding only the `Upgrade`, `Origin` and, if present, `Sec-WebSocket-Protocol`
headers; the Workers runtime does the handshake itself. Its `Origin` must be
exactly the origin of the request itself (the page that opens the socket is
served by the same host as the Function), otherwise the proxy answers 403
`{"error":"forbidden_origin"}` (also `no-store`) without calling the API:
WebSockets have no CORS, so the check is what keeps other sites' pages from
opening a socket with a player's cookie. The browser's `Origin` goes on
unchanged so the API checks it too, and the API's 101 answer is returned as
the same object, never rebuilt.

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
