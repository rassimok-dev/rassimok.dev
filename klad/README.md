# /klad/ — the game

A clean-room homage to «Клад» (Korvet ПК-8020), itself a clone of Rise Out
(ASCII, MSX, 1983). Own code, own art, own levels. Rules: `MECHANICS.md`.

This folder holds all of the site's browser JavaScript. Apart from the API
proxy (below), it is self-contained on purpose so it can be removed in one go.

## Files
| | |
|---|---|
| `index.html` | page: HUD, canvas, touch pad, footer, the nick prompt, boards, lobby (with the room chat), race and race chat dialogs, the HUD button Чат and the pop-up region |
| `klad.css` | styles; defines the palette the game reads |
| `klad.js` | engine: movement, guards (each step from `chase.js`), shots, holes, phases, render, input; holds while a dialog is open; the race hook `KLAD_GAME` |
| `levels.js` | levels, each in two shapes (landscape 24×16, portrait 16×24), with a `revision` |
| `ticks.js` | tick constants and the time formatter (`m:ss.cc`), also loaded by the node tests |
| `chase.js` | the guards' chase rule as one function: the next tile of a standing guard, one step closer to the player and never away (`MECHANICS.md`, Guards); also loaded by the node tests. Script order in `index.html`: `levels.js`, `ticks.js`, `chase.js`, `klad.js`, `online.js`, `lobby.js`, `chat.js`, `race.js` |
| `online.js` | online part: nick prompt, sending clears and runs, the boards, accounts (login by emailed code, logout); its logic half is also loaded by the node tests |
| `lobby.js` | the lobby: who is in it, rooms by invite link, ready marks, the host's level and Start, the room chat's messages (also the `chat` frames of the race socket), `after` number, send, member hides and the nicks two members share, and the one socket module (`KLAD_LOBBY.connect`) the race reuses; its logic half is also loaded by the node tests |
| `chat.js` | the room chat's part of the lobby dialog and the race's chat dialog (the HUD button Чат and the key C): the lines with a "скрыть" button on another member's line, "Скрыть чат", the announcements and the send field, and the race pop-ups (at most 3, 6 s); it reads the lobby's state from the `klad:lobby` event and sends and hides through `KLAD_LOBBY.page`; its logic half is also loaded by the node tests |
| `race.js` | the ghost race on the lobby's socket: countdown, positions, ghosts, finish, the finish screen; its logic half is also loaded by the node tests |
| `test/levels.test.js` | `node --test`: shape, legend, key-then-exit reachability, revision, fastest clear above the API floor |
| `test/online.test.js` | `node --test`: `online.js` against a fake `fetch`: request shapes, when results wait or go, a skip during a save, blocked cookies, login codes, verify answers and merges, the read-back after a login, a login ending a skip, logout, 400, 401, 404, 409, 429, offline |
| `test/lobby.test.js` | `node --test`: `lobby.js` against a fake `fetch`, a fake clock and a fake `WebSocket`: the room id form and the `#room=` link, the room view and the Start condition, the open rooms list (marks, join from it, empty, failed, the poll rate and the poll after leaving), link only, a non-member's room answer, presence and room polls only while open and visible, the poll after an own action, 404, 409 `room_full`, the socket at `starting` and at `racing` after a reload, once (backoff, 1008, the cap in all, its stop), the not-available text when the API drops a player whose socket never opened, the re-join after the sweep (heartbeat 204 not counted, a tap on Ready, 57 s, network failures, a poll answered after a hide), another link and the leave button during a join (also a join that answers 0 or 503 with a new link opened meanwhile), the answers after the close, the request budget for an hour (also with one chat message sent), the chat transport (messages kept by `n`, the `after` number on the poll, a repeated, late or lost answer, hostile messages (also a kind other than `human` or `agent`), the cap of 30, the nicks two members share, the own message at once without moving `after`, the send as one request with no poll for 201, 400, 429, 404, 500, offline and 401, a poll in flight during a send kept, one at a time, an answer after leaving, the member hides and their reset in a new room, a re-join keeping them), and the page half in a `vm` context with a stub page (list items, a nick shown as text, the link-only box and switch, the "скрыть в чате" buttons, their hidden names and their focus, the member number for twin nicks and for a sender who left, the `klad:lobby` event, and `lobby.js` with `chat.js` in one context: a room link, the chat lines as text, one POST per message, a sender who left hidden from the line, `chat.js` loaded after the room answered), and the race socket closed by `race_over` or offline (leave) and by `replaced` (room kept), `close(true)`, one list after a failed re-join, the list after a leave only once it has answered, the list forgotten on create and on a lost session, no join while a create is out, and the page half: spaces in a room item, focus after a changed list, the host's `#room=` URL, Ready disabled while an action is out, `closeKeepingRoom`; and the race socket's `chat` frames (kept at once, `after` unmoved, the poll after the race shows each once, hostile frames and a frame after the race ignored, never the own) |
| `test/chat.test.js` | `node --test`: `chat.js`'s logic half (the line marks, the name with the member number, the order, a hidden member and a twin with the same nick, "Скрыть чат", each message announced once and never the own, a new room, the texts for each send answer) and its page half in a `vm` context with a stub page and a stub `KLAD_LOBBY.page` (`<img src=x>` and a web address as text, Enter sends once and keeps the focus, the text kept on 400, 429, 404 and a failure and while typing during a send, a blank field, announcements once, the list rebuilt only on change, "Скрыть чат" and its emptied announcements, the part hidden until the room answered, a new room with an empty field, the "скрыть" on a line with its hidden name, a nick that becomes shared, the focus after a hide) and, in the race, a fake clock: the pop-up queue (the 6 s, at most 3, the newest of a batch, clear), the watchers, pop-ups as plain text without focus, none outside a race or over a dialog or for a hidden member or with the chat hidden, twin nicks, the button and the key C (guards, preventDefault), the dialog's send and focus, the race end closing it, the pop-up region and its CSS |
| `test/race.test.js` | `node --test`: `race.js` on the lobby's real socket module with a fake `WebSocket`, a fake clock and a fake engine: the countdown and go, a reconnect during the countdown (one start), a missed go, the position rate only while racing, visible and in play, one ping timer across reconnects, finish once and its resend after a reconnect, ghosts by slot (slot 9 makes one, slot 10 none), their interpolation (midpoint, no step back, new attempt and long step at once, a pause, the cap, seen through `ghostSampleCount`, which exists for that test only), fade and resync, the results view (also with 10 places), close 1000, offline, a second race, a reload in the race and after the own finish; `race.js`'s page half in a `vm` context with stub dialogs: Escape on the finish screen leaves the room, "Назад в комнату" and go do not, results while the lobby is open close it keeping the room, the race cap following the tick rate; and `klad.js` (after `chase.js`) in a `vm` context with a stub page: a guard on the player's row catching a player who stands still, the real `startRace` result (true, false for level 99), the host's shape whatever the orientation, the exit and deaths in a race with no `klad:clear`, `klad:run` or game over, `stopRace`, ghosts drawn as canvas text, 10 slots in 10 colours, keys typed in a text field (the chat) starting no game and moving no runner, a dialog (the chat) holding the engine and the paused (not running) game after it closes, the pause screen naming the chat key only in a race, and the phases `race.js` reports to the chat |
| `test/proxy.test.js` | `node --test`: the API proxy against a fake `fetch` |
| `test/ticks.test.js` | `node --test`: the time formatter |
| `test/chase.test.js` | `node --test`: the chase rule on small maps, one case each: a step toward the player on its row, waiting at a wall (no way around), walking into a gap, climbing first on a ladder, running toward the player's column from a ladder under a brick, climbing down a ladder set into the floor, stepping down off the bottom of a ladder over air, not climbing into the stone under a ladder, running toward the player's column (not to a ladder behind), waiting at a wall on the way there, standing still directly above and directly below (also with open air above), stepping into water and off a ledge over a plank, no step on the player's tile |
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
  humans or agents. A line in the dialog says a board lists the first 20
  places, one row per player with their best result. The same dialog
  changes the nick and deletes the nick and all results
  (`DELETE /players/me`).
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
  The site's privacy page (`/privacy/`, outside this folder), linked from
  both footers and, in a new tab, from the login part's privacy note, says
  all of it in one place.
- Guests the game can no longer reach are deleted by the API about 90 days
  after their last visit, with their sessions and results (RAS-59);
  accounts stay until deleted. Both footers, the nick prompt, the login
  part's note and the privacy page say so; deletion by hand on request by
  mail stays on the privacy page for anyone who wants it sooner.
- Room chat (RAS-54): only a room's members read its messages, each only
  what was sent after they joined. The API keeps the last 30 messages of
  each room in memory only, never in the database or a log; they go with
  the room or a restart of the server. The chat note, both footers, the
  nick prompt and the race chat dialog name hello.rassimok@gmail.com as the
  contact for reports, as plain text inside the `email_off` markers (no `mailto:`), with one rule:
  nothing illegal, no harassment.
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
- While it is open and the player is in no room: `GET /rooms` (the open
  rooms, at most 20) together with the online list, at most once per 30 s,
  and once more after the player leaves a room, fails a join or is dropped
  from one: about 360 requests an hour in all. Nothing asks for it inside a
  room, while the tab is hidden or with the dialog closed.
- The list shows one line per room (host nick, `players` of `size`, level,
  shape, with a space between the parts for a screen reader) with a "Войти"
  button that calls the lobby's join; a full, starting or racing room is
  marked and has no button. The headings count both lists
  ("Сейчас в лобби: N", "Открытые комнаты: N"). An empty list points to
  "Создать комнату"; a failed list request says the server is not answering
  while the rest of the lobby works. Link only: a checkbox before
  "Создать комнату" sends `POST /rooms?listed=false` (no query means listed);
  the host's switch in the room view sends `POST /rooms/<id>/listed` with
  `{"listed":true|false}`, and everyone reads the setting from `listed`.
  A non-member's `GET /rooms/<id>` has `host` null and `players` empty, which
  reads as "no member" like any room this player was dropped from. Nicks
  from the list go in with `textContent` only.
- In a room: `GET /rooms/<id>` every 10 s, plus once right after each own
  action (join, ready, level, start, and the host's listed switch), about
  360 an hour more. "Готов" is disabled while such an action is out, so a
  tap is never dropped. Leaving is `POST /rooms/<id>/leave`; the open rooms are
  asked again once it has answered, not in the same tick. Closing the dialog
  leaves too, except when it keeps the room (a race socket is live, or a
  replaced tab, or the race calls `closeKeepingRoom`; see the socket
  paragraph below). After "Создать комнату" the page
  writes `#room=<id>` into the host's URL (`history.replaceState`, no
  `hashchange`), so a reload returns to the room.
- A room id is checked against `^[A-Za-z0-9_-]{10}$` before any request;
  a malformed one, a 404 and a 409 `room_full` each show their message.
- When a polled room is `starting`, or `racing` (a reload in the race; the
  API lets a member reconnect within 30 s), and the lobby has no socket for
  this race yet, it opens one to
  `wss://<host>/klad/api/race/<id>` with `KLAD_LOBBY.connect` and hands it
  on: it dispatches `klad:race` on `document` with `detail.room` (the polled
  room: id, level, shape, players) and `detail.socket` (`send(object)`,
  `on('message', listener)` for parsed JSON frames, `on('status',
  listener)`, `status()`, `hasOpened()`, `close(isLeaving)`, `hasLeft()`,
  `wasReplaced()`: the close was 1000 `replaced`). The race listens for
  that event; the lobby only shows a waiting line. A dropped socket tries
  again after 0.5, 1, 2 and 4 s, then reports `offline` and stops; an open
  starts the waits again, but one `connect()` reconnects at most 8 times
  in all. Close 1000 ends it as `closed` and 1008 as `offline`, both with
  no retry. One that never opened shows "online play is not available in
  this browser", and so does a poll that no longer lists this player while
  such a socket is still trying (the API drops a member not connected 15 s
  after Start). The lobby closes the socket on leaving and once the room
  is back in the lobby state. Closing the dialog leaves the room unless a
  race socket is live (not `closed` or `offline`) or another tab replaced it
  (1000 `replaced`: leaving would end the race in that tab); the waiting line
  shows only while the room is `starting`. `KLAD_LOBBY.page` (`open()`,
  `closeKeepingRoom()`, `leave()`) lets the race close the lobby without
  leaving the room (`close(isKeepingRoom)`, so the order of the socket's and
  the dialog's close events does not matter), and its finish screen open the
  lobby again or leave the room;
  `sendMessage(text)` and `toggleMemberHidden(member)` are the chat's.
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
- Invite by mail (RAS-48): next to "Копировать" the room view has a link
  "Отправить по почте", an `<a>` whose `href` is `KLAD_LOBBY.inviteMailto`
  of the link field: `mailto:` with no receiver, a subject and a short text
  holding the room link, both through `encodeURIComponent`. The device's
  mail app does the sending from the player's own address; nothing goes to
  the API and nothing is stored, so the privacy notes are unchanged. It is a
  link because a form would be blocked by `form-action 'none'`; a `mailto:`
  link is not covered by the CSP. The anchor has no `href` in the HTML
  (Cloudflare's email obfuscation would rewrite it); `renderRoom` sets it
  with `target="_blank"` and `rel="noopener"`, which makes a web mail
  handler open in a new tab, so the game tab and the room stay. A device with no mail handler may do nothing;
  "Копировать" is the fallback.
- Chat (RAS-54, contract section 7). Every room answer of a member carries
  `messages` (`n`, `member`, `nick`, `kind`, `guest`, `you`, `text`). The
  lobby keeps the room's messages by `n`, oldest first, at most 30, each
  once; a message whose `n` is not an integer from 1 to 999999999, whose
  `member` is not an integer, whose nick is not a string, whose kind is
  not `human` or `agent` or whose text is not 1 to 120 characters is left
  out. The highest `n` of a shown
  room answer is the `after` number: the poll is then
  `GET /rooms/<id>?after=<n>` (plain `GET /rooms/<id>` while it is 0, so a
  room nobody writes in costs exactly what it did). A late answer is
  dropped with its messages and a lost one moves nothing, so the next poll
  asks again from the last `n` shown.
- `sendMessage(text)` is `POST /rooms/<id>/messages` with `{"text"}`: one
  request with its own one-at-a-time guard. It is not an action: no room
  poll follows, the poll's 10 s timer is untouched and an in-flight poll
  is kept. The 201 shows the own message at once but does not move
  `after`, because messages of others with a lower `n` may not have
  arrived yet; they come with the next poll and the own one is not shown
  twice. 401 means no player; every other answer is handed back for the
  chat's text, and the next poll decides about the room. An answer for a
  room already left is dropped. `toggleMemberHidden(member)` hides one
  member's lines by member number (guests may share a nick); the members
  list and the chat lines share it. Messages, `after` and hides go with
  the room (member numbers start at 1 in every room) and stay through a
  re-join of the same room. `state().sharedNicks` lists the nicks that two
  members of the room have, among the members and the senders of the kept
  messages (the player's own entries count as one, since a re-join gives a
  new number); such a nick is shown with the member number, "Bill #3", in
  the members list and on the chat lines.
- `chat.js` (`KLAD_CHAT`) loads after `lobby.js` and shows the "Чат" part
  at the end of the room view, under the room's own controls. It keeps no
  messages: the lobby dispatches `klad:lobby` on `document` at the end of
  every render with `state()` as `detail` (`phase`, `roomId`, `room`,
  `messages`, `hiddenMembers`, `sharedNicks`), so a `chat.js` that loads
  after the lobby has rendered catches up at the next render. It sends
  and hides through `KLAD_LOBBY.page.sendMessage` and
  `KLAD_LOBBY.page.toggleMemberHidden`. A line is the nick (with the
  member number when the nick is shared), `гость` or `аккаунт`, `человек`
  or `агент`, `вы` on the own lines, the text, and on another member's
  line a "скрыть" button, all set with `textContent`, so a typed tag or
  web address stays text; the list scrolls in its own box and is rebuilt
  only when its lines change, and a focused "скрыть" keeps the focus on
  its line, or goes to the list (the field once the list is empty) when
  the line went. "Скрыть чат" hides the chat and its announcements while
  the page is open and empties the announcement region; "скрыть в чате"
  next to each other member in the members list (`aria-pressed`, rebuilt
  only on change, the focus kept) and "скрыть" on a chat line hide that
  member's lines, the line's button also for a member who has left. A
  line's button has no pressed state, since the line goes with the hide;
  a member who left can be shown again only by leaving the room. Each hide
  button's name carries the nick in a visually hidden span ("скрыть в
  чате: Bill"), no `aria-label`. Another member's new message is announced once, in a
  visually hidden `aria-live="polite"` region holding one node per new
  message; one that came while hidden is not announced later. The field
  has a label, is 16 px, has `maxlength="120"` and its own form, so Enter
  sends the message and never reaches Старт (and `klad.js` ignores keys
  typed in a field). The focus goes back to the field after a send; the
  text is emptied only after a 201, and only if it was not changed
  meanwhile, and with a new room. 400, 429, 404 and any other failure each show their message
  and keep the text. The note under the field says who reads the chat, how
  long the server keeps it, and the contact for reports with the rule.
- Joining another room leaves the current one. Leaving (the button or
  closing the dialog) while a join is out takes the room off the screen at
  once and sends `POST /rooms/<id>/leave` only after the join answers. Any
  answer that comes back after the dialog closed does not act: a room
  created meanwhile is left at once.
- Status: written before RAS-31 was deployed; it has not yet run against the
  live API.

## Race
`race.js` loads after `lobby.js` and takes over at `klad:race`. It speaks
contract section 8 (JSON in text frames) on the lobby's socket and has no
socket or reconnect loop of its own. Other players cannot change this
player's game: no shared world, no collision.

- The server's `state` (sent on every connect) gives the level, the host's
  shape and each player's `slot`. `countdown` closes the lobby dialog (`closeKeepingRoom()`) and
  shows 3, 2, 1 a second apart in the race dialog; `go` closes it and starts
  the level fresh in the host's shape, whatever this device's orientation.
  A `state` that says `racing` before any `go` starts it too, unless it
  shows this player finished (a reload after the finish): then the race
  closes the lobby dialog and only waits for `results`, and the waiting line
  has no time.
- Sent: `ping` every 20 s from `klad:race` to the end of the race (dropped
  while the socket is not open); `pos` with `x` and `y` in cells (two
  decimals) and the attempt's `tick`, every 200 ms, only while racing, the
  tab is visible and the game is in play (not paused, dead or held by a
  dialog); `finish` once at the exit with the attempt's ticks. A finish
  made while the socket reconnects goes out with the next `state` that
  shows this player unfinished.
- Ghosts: one per other slot, in a fixed colour per slot
  (`--crt-ghost-0` to `--crt-ghost-9`, picked by slot, so slots 0 to 9 are
  all drawn; guests may share a nick), the runner
  sprite at 0.55 opacity with the nick drawn on the canvas. A ghost is
  smoothed on the receiving side: it keeps its last 10 positions with the
  sender's `tick` and is drawn 250 ms in the past, on the straight line
  between the two positions around that moment, spaced by the ticks (the
  tick rate is `KLAD_TICKS.PER_SECOND`, passed in the environment as
  `ticksPerSecond`). When a position arrives after the drawn moment has
  passed the last one (a pause, a lost frame, rising latency), the move
  starts from where the ghost stands and is anchored at the arrival. A
  position never gets a slide shorter than its tick gap or 100 ms,
  whichever is less, so messages that arrive bunched after a stall do not
  hop: after N positions together the ghost runs at twice its speed, up to
  250 + 100 x (N - 1) ms behind, and is back at 250 ms about N x 200 ms
  later. From about 9 together (a stall of about 1.8 s) the cap of 10
  drops samples still needed and the ghost hops until it has caught up (a
  known limit). It never runs ahead of the last position. A position
  with a lower `tick` (a new attempt) or a step over 3 cells shows at once;
  a fall step of 1.8 cells slides. With no update for 2 s a ghost fades out
  over 1 s. A `state` after a reconnect replaces the ghosts with its
  `positions`, shown at once. The sender and the API are unchanged.
- In a race a death costs no life and there is no game over. The race
  dispatches no `klad:clear` or `klad:run`, so it never reaches the boards,
  and it leaves the URL hash alone.
- After the exit the top of the field says "waiting for the others" until
  `results`. The finish screen lists place, nick (marked winner, you, left)
  and time (`KLAD_TICKS.format`), with "Назад в комнату" (opens the lobby
  again) and "Выйти из комнаты". Closing it any other way, Escape too,
  leaves the room, as the screen says.
- Chat in a race (RAS-56; contract section 8, RAS-55). Another member's
  message arrives on the socket as `{"type":"chat",...}`. `lobby.js` takes
  it from the socket it opened (a stale socket is ignored), checks it with
  the validation of a poll message (an integer `n` up to 9 digits and a
  `member`, a string `nick`, `kind` human or agent, a `text` of 1 to 120
  characters; anything else shows nothing), never reads a `you` from it,
  and keeps it at once in the room's messages by `n`. It does not move the
  `after` number, which moves only with room answers, so the first room
  poll after the race (when "Назад в комнату" opens the lobby) lists the
  race's messages again with any the socket missed, and each shows once in
  the lobby chat, the ones seen as pop-ups included. `race.js` knows
  nothing of chat frames (it ignores the type); it only tells
  `KLAD_CHAT.page.setRace` whether the race is on (racing, or finished and
  waiting for the others) on every change of phase, before the countdown or
  results dialog opens.
- Pop-ups (`chat.js`): while the race is on and no dialog is open, a new
  message from another member (not a hidden member, not with "Скрыть чат"
  on) is a line "nick: text" in `#chat-popups`, inside `#stage` above the
  online notice at the lower edge of the field, so it never reaches the
  touch pad. At most 3 show, a fourth pushes out the oldest, each goes after
  6 s by a timer of its own. A pop-up has no focus, key or touch
  (`pointer-events: none`), pauses nothing, makes no sound, and the region
  is its own polite live region apart from `#race-notice`, one node per
  pop-up added once, so nothing is read twice. A message that arrives while
  a dialog is open is not shown later. With `prefers-reduced-motion` a
  pop-up appears and goes with no animation; otherwise it fades in for 0.2 s
  (the base style is the end state). A nick two members share shows the
  member number, as in the lobby. Text goes in with `textContent` only.
- The chat dialog (`#race-chat`, `chat.js`): the HUD button "Чат" (shown
  only while the race is on) and the key C open it; outside a race the
  button is hidden and C is left alone (nothing sent). It lists the room's
  messages (the same list, hides and twin-nick numbers as the lobby chat),
  has "Скрыть чат" (one switch with the lobby's), a labelled 16 px field
  with its own form (Enter only sends the message; typing never moves the
  digger, never fires and never starts a game, since `klad.js` ignores keys
  while any dialog is open), "Отправить" and "Закрыть". Sending and its
  errors are the lobby chat's (`KLAD_CHAT.problemOf`, the text kept on a
  failure). Opening it is the pause of the player's own game (a dialog
  holds `klad.js`); Escape or "Закрыть" closes it with the focus back on the
  field, and the game stays on its pause screen until P or ОГОНЬ; in a race
  that screen also names the chat key. C is ignored while typing, with
  Ctrl, Meta or Alt, or over another dialog; a held C opens it once and its
  repeats (and a held Enter, NumpadEnter or C in the field) are stopped. It works after the
  own finish too. When the race ends it closes and the pop-ups go.
- A hostile member's input is bounded: a `pos` outside cells 0 to 24 makes no
  ghost, and a result time over the race cap (4 minutes and 10 s) shows as
  `-`. `startRace` returns whether it started; if not, the race ends with a
  notice. After the player's own leave the notice says "you left the room".
  Only one of the field notice and the race dialog's status line holds the
  text (and is announced) at a time. The dialog says room members see the
  runner, nick and time during the race, and nothing goes to the boards.
- A dropped socket shows "reconnecting" and play goes on. Close 1000 before
  the results (`replaced`, `idle`, or leaving the room in the lobby) or
  `offline` after the socket opened ends the race with a note on the field
  and goes back to the title; a socket that never opened says online play
  is not available.
- The engine hook: `KLAD_GAME.startRace(level, shape, { onFinish, ghosts })` (true when it started),
  `KLAD_GAME.stopRace()` and `KLAD_GAME.racePosition()` (`{x, y, tick}` in
  play during a race, otherwise null).
- Status: written before RAS-32 was deployed; it has not yet run against the
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
4. Remove the `/klad/` links in `index.html`; in `privacy/index.html` the
   game's sections and links in both languages (keep the site, the contact
   and the pages on Cloudflare Pages, without the proxy); and the game parts
   of `README.md`: the opening line, the exceptions under "Principles" (the
   cookie, the stored data and how to delete it, "Room chat in memory only",
   and the game in "One privacy page"), the `/klad/*` header row
   and the note below the table, the section "The game's API", check 5
   under "CI", and the `functions/` sentence under "Deployment".
5. Delete the `API_ORIGIN` variable in the Pages project settings.
