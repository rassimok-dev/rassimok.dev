# Changelog

Dated entries, newest first. Written for a reader picking this up cold —
or a future session needing to know what already exists and why.

## 2026-11-13 (eighth) - Klad ghost race: countdown, ghosts, finish screen

When the host starts, every player in the room plays the same level on
their own copy and sees the others as coloured, see-through runners with
their nicks. `klad/race.js` takes the lobby's socket at `klad:race` and
speaks contract section 8 on it: the server's `countdown` shows 3, 2, 1 in
a race dialog (which closes the lobby), `go` starts the level fresh in the
host's shape, positions go out about 5 times a second, `finish` goes once at
the exit with the attempt's ticks, the top of the field says "waiting for
the others" until `results`, and the finish screen shows the places, nicks
(winner, you, left marked) and times, with "Назад в комнату" and "Выйти из
комнаты". `klad.js` gains a small race hook (`KLAD_GAME`). Written before
the server side (RAS-32) was deployed: the tests use the lobby's real socket
module on a fake `WebSocket`, a fake clock and a fake engine, and run
`klad.js` itself in a `vm` context. It merges together with the lobby
(RAS-33), after RAS-32 is live.

### Decisions worth not relitigating

- **Forcing the host's shape is a flag, not an engine change.** `loadLevel`
  took its shape from the orientation in one line, and `resize()` already
  fits any width and height into the stage, so a portrait level on a
  landscape screen just gets smaller tiles. The race keeps its shape for the
  whole race (a death reloads the level through `intro()`), and the pad
  layout still follows the device.
- **A race is the engine in race mode, nothing more.** `KLAD_GAME.startRace`
  sets one `race` object; while it is set a death costs no life and there is
  no game over (retries are unlimited), the exit hands the ticks to the race
  and parks the game in a `finish` phase instead of `klad:clear` and the
  next level, so neither `klad:clear` nor `klad:run` is ever dispatched and
  a race never reaches the boards. The level is not written into the URL
  hash, which may hold the room link. `stopRace()` clears the flag and goes
  back to the title; a test proves a lost game after a race reports its run
  again, because a leaked flag would silently switch off game over and the
  boards.
- **The countdown has its own dialog and closes the lobby.** The countdown
  arrives while the lobby dialog is open, and the field behind a modal is
  hidden by its backdrop; the lobby rewrites its own race line on every
  render. So `countdown` closes the lobby (which keeps the room while it is
  `starting`) and opens the race dialog, and `go` closes that. Any open
  dialog holds the game, so the title cannot be played meanwhile. Only a
  change of phase opens or closes the dialog, so one closed with Escape
  stays closed. Racing and finished close the lobby too: a reload in the
  race lands there straight from the lobby dialog.
- **Positions only while racing, visible and in play.** `pos` goes every
  200 ms (the server drops more than 10 a second), rounded to two decimals
  to keep frames far under the 512-byte cap, and only while the tab is
  visible and the game is in its play phase. A paused, dead or
  dialog-held player sends nothing, so their ghost fades on the others'
  screens, as the ticket accepts for a hidden tab. `ping` runs on one timer
  per race from `klad:race`, however often the socket reconnects.
- **A finish is never lost to a reconnect.** `send` returns false while the
  socket is not open; a finish made then waits, and the `state` the server
  sends on every connect decides: this player unfinished there means send it
  now, finished means the server has it.
- **Ghosts by slot, drawn on the canvas.** Four fixed colours
  (`--crt-ghost-0` to `--crt-ghost-3`, none green like the player or red
  like the guards) by the server's `slot`, because guests may share a nick.
  The nick is drawn with `fillText`, never put in HTML. A ghost is drawn
  from the latest position at 0.55 opacity, fades out over 1 s after 2 s
  with no update, and has no collision. Ghosts are drawn under this
  player's own runner, so the player stays readable in a crowd. A `state`
  after a reconnect replaces the ghosts with its `positions`, and a `state`
  that says `racing` before any `go` starts the race (a missed `go`).
- **Waiting for the others is a line on the field, not a dialog.** The
  player can watch the remaining ghosts run to the exit. The finish screen
  is a dialog, since it has buttons; "Назад в комнату" opens the lobby
  again and "Выйти из комнаты" leaves the room through the lobby
  (`KLAD_LOBBY.page`, like `KLAD_ONLINE.page`), so the lobby's own room
  bookkeeping stays the only one.
- **Closing the finish screen leaves the room, unless it is "Назад в
  комнату".** After the results the room is back in the lobby with the
  ready marks cleared. A player who closed the screen with Escape stayed a
  not-ready member until the API's 60 s sweep, and Start answered
  `not_ready` for the others meanwhile. The screen now says that closing
  leaves, like the lobby's hint. The room button's flag is cleared in the
  `close` listener, not in the click handler, because a browser fires
  `close` after the handler has returned; the test's stub dialog does the
  same.
- **A reload during a race resumes it.** The `#room=` link joins again,
  the API answers 200 with the room in `racing`, and the lobby opens the
  socket, so the race starts from the server's `state` (contract section
  8). When that `state` shows this player already finished, the race does
  not start the level again: it waits for `results`, sends no second
  finish (the server has it), and says so without a time, which the reload
  has lost. The host's URL still has no `#room=`, so a host who reloads
  loses the room (an open item from the lobby's second review).
- **Ends without results get a note, not a dialog.** Close 1000 before the
  results (`replaced`, `idle`, or the lobby's own leave button) and
  `offline` after the socket opened end the race and go back to the title
  with a note at the top of the field for 8 s; a dialog would land on top
  of the lobby after a deliberate leave. A drop only shows "reconnecting":
  the lobby's module reconnects and the local game goes on. A socket that
  never opened says online play is not available.
- **Hostile input and small texts (second fix round).** A member's `pos`
  outside cells 0 to 24 (the larger side plus one) makes no ghost, and a
  result time over 4 minutes and 10 s shows as `-`, so nobody can put a
  ghost far outside the field (one bound for both axes, so a position just
  below or beside the field passes and is clipped by the canvas) or stretch
  the results table. Closing the lobby now
  leaves the room unless a race socket is live, so the "closing leaves"
  hint holds after a race too; a deferred leave also goes out when the held
  join answers 0 or 5xx (a leave from a non-member is a harmless 204), and
  that branch renders and resumes. `startRace` returns whether it started
  and the race ends with a notice when not. The lobby's waiting line shows
  only while the room is `starting`. The socket remembers an own leave
  (`close(true)`, `hasLeft()`), so the race says "you left the room"
  instead of the closed-by-server text. The field notice and the dialog's
  status line are both live regions, so only the one in view gets the text
  (the other is emptied) and it is announced once. The race dialog states
  who sees what: room members see the runner, nick and time during the
  race, and nothing goes to the boards.
- **The engine itself is under test now.** A fake engine cannot show that
  `klad.js` suppresses `klad:clear`, `klad:run` and game over, so
  `test/race.test.js` also runs `klad.js` in a `vm` context with a stub
  page and a test level whose two shapes put the exit next to the start,
  drives it with key events and frames,
  and checks the forced shape, the exit, deaths, `stopRace` and the ghost
  text.

## 2026-11-13 (seventh) - Klad lobby: online list, invite link, room and ready

A "Лобби" button in the HUD opens a lobby dialog: who is in the lobby now,
"create room" with an invite link `/klad/#room=<id>` and a Copy button, and
the room view with each player's ready mark, the host marked, the host's
level choice (1 to 5) and Start once everyone is ready and there are at
least 2 players. Opening the page with `#room=<id>` opens the lobby and
joins that room; without a nick it opens the nick prompt first and joins
once there is one. A malformed id, an unknown room (404) and a full room
(409 `room_full`) each show their message. All of it is REST against
contract section 7 (`/presence`, `/rooms`), written in `klad/lobby.js`
before the API side (RAS-31) was deployed. It has not yet run against the
live API: the tests use a fake `fetch`, a fake clock and a fake
`WebSocket`. The one WebSocket client (`KLAD_LOBBY.connect`) is in the
same file. It opens `wss://<host>/klad/api/race/<id>` only when a polled
room is `starting` (or `racing`, after a reload in the race), and the lobby
then only shows a waiting line; the race
itself (RAS-34) takes the socket from there. This merges together with the
race (RAS-34), after the race socket (RAS-32) is live, never alone: without
the race, Start would open a socket and leave the players waiting for
nothing.

### Decisions worth not relitigating

- **REST polling, and nothing outside the open lobby.** The user decided
  on 2026-11-13 that the lobby is REST, not a socket. Every request goes
  through the Pages Function and counts against the shared 100,000 a day
  Workers quota. So the heartbeat (`POST /presence`) and the list
  (`GET /presence`) run only while the lobby dialog is open and the tab is
  visible (`document.visibilityState`), at most once per 30 s each (about
  240 requests an hour). The room poll (`GET /rooms/<id>`) runs every 10 s
  only while the room view is open and visible (about 360 an hour more,
  600 in all). Each poll remembers its last run, so hiding and showing the
  tab, or closing and opening the lobby, never sends sooner; a test plays a
  whole hour with the tab hidden and shown every 7 s. After each own action
  (join, ready, level, start) one poll goes out at once and the 10 s count
  starts again from it, so the view shows the action's effect without
  waiting for the next poll.
- **The socket opens only at race start, once.** It opens when a polled
  room (or the host's own start answer) says `starting`, or `racing` after
  a reload in the race (the API lets a member reconnect within 30 s), and
  only if the lobby has none for that race. A socket that ended stays
  until the room is back in the lobby, so a `racing` poll cannot open
  another one in a loop. After a drop it tries again after 0.5, 1, 2 and
  4 s, then reports `offline` and stops: every attempt is a Workers request,
  and the waits (7.5 s in all) stay short next to the API's 15 s wait for
  every player at race start, which a guest's poll may see up to 10 s
  late. A successful open starts the waits from 0.5 s again, but one
  `connect()` makes at most 8 reconnects in all: a socket the server
  accepts and then drops at once (a repeated policy close, or a proxy
  that loses the connection after the 101) would otherwise reconnect
  every half second for the whole race. A normal close (1000) from
  either side ends it as `closed` without a retry, because the server
  closes the sockets after the results. A policy close (1008) ends it as
  `offline` without a retry: contract section 8 makes it a client bug,
  such as a message over 512 bytes, which a retry would only repeat. The
  lobby closes it itself on leaving and when a poll shows the room back in
  the lobby state. A browser without WebSocket, or a socket that never
  opened before the tries ran out, shows "online play is not available in
  this browser"; the game is not touched. So does a poll that no longer
  lists this player while such a socket is still trying: the API drops a
  member not connected 15 s after Start, and a joiner whose poll saw
  `starting` late gets that poll before the tries run out, where "you are
  no longer in this room" would blame another tab. Contract section 8 is the
  protocol; the module sends and reads none of its messages, and the race
  (RAS-34) adds `ping` (every 20 s), `pos` and `finish`.
- **The hand-off is a `klad:race` event.** Like `klad:clear` and `klad:run`
  between `klad.js` and `online.js`, the lobby dispatches `klad:race` on
  `document` right after it creates the socket, before the first attempt,
  with `detail.room` (the polled room: id, level, shape, players) and
  `detail.socket` (`send`, `on('message')` with parsed JSON, `on('status')`,
  `status()`, `hasOpened()`, `close(isLeaving)`, `hasLeft()`). A listener attached then sees every
  frame, and several listeners can share the socket.
- **Closing the dialog leaves the room unless a race socket is live.**
  Otherwise this player's ready mark would stay for the API's minute and
  the host could start a race with someone who is gone. While a race
  socket is live (not closed, not offline) closing keeps the room and the
  socket, because the race closes this dialog to play (any open dialog
  holds the game). The
  explicit "Выйти из комнаты" button leaves in any state. An answer that
  comes back after the dialog closed does not act: a room created
  meanwhile is left at once, without the portrait host's level choice,
  and a join still out at the close is left once it answers, not in
  parallel, because the API could handle the leave first and then add a
  not-ready member who blocks Start until the sweep.
- **This player is found by the `you` mark.** The room object marks the
  caller's own entry with `you` (contract section 7), and guests may share a
  nick, so matching by nick and kind could pick the wrong entry. The lobby
  now uses `you` for the own ready mark, for being host and for being in the
  room at all. Joining one's own room answers 200 even when it is full or
  not in the lobby, so a reload on `#room=<id>` shows the room with no
  special case.
- **A member the API swept is joined again, once.** The API drops a lobby
  member it has not seen (a room request that lists the player, or a
  heartbeat) for 60 s, on that member's own next request. A host who hides
  the tab to send the invite from a messenger would otherwise lose the
  room and the link with it. The rules as they now are:
  - **What counts as seen.** Only a room answer that lists this player
    (`you`) sets the client's `lastSeen`. A heartbeat does not: the API
    answers 204 even when it has just swept the player, so a visible tab
    back from an outage of over a minute would take the 204 for proof,
    and the next poll would end the room view instead of joining again.
  - **When to join again.** A poll that shows the room in the lobby state
    without a `you` entry, when `lastSeen` is more than 55 s old at
    sending (the API's 60 s minus 5 s, because the client's age is about
    one round trip shorter than the server's), sends one
    `POST /rooms/<id>/join`, keeps the room and polls once more. The view
    then shows whoever is host now; in an empty room the player is host
    again, and the link already sent still works.
  - **An action that gets 404** (a swept member's `/ready`) with the same
    age joins again once instead of saying "room not found". A gone room
    answers 404 on the join too, so that message still comes. A level
    choice or Start from a swept host gets 403 `not_host`, and the poll
    that follows joins again by the rule above.
  - **A join that fails on the network** (status 0 or 5xx) keeps the room
    and shows "offline", like a failed poll. No poll goes out at once: the
    next one, 10 s later, tries the join again, so there is at most one
    join per poll. Other join answers (404, 409, 401) end the view with
    their own message.
  - **A poll answered after the tab hid again** does nothing; the room is
    kept and the next visible poll joins.
  - **Inside the 55 s** the player left in another tab (joining another
    room leaves this one), and a re-join there would pull the player back
    and forth between tabs, so the room view ends with a message. So does
    a room in `starting` or `racing` without the player, where a join gets
    409. A poll without the player right after a re-join ends the view, so
    a server that keeps dropping the member cannot turn the 10 s poll into
    a join loop.
- **Leaving never runs in parallel with a join.** Opening a link for
  another room while in a room now leaves the first room, instead of only
  forgetting it: the API checks the new room before it leaves the old one,
  so a failed join (full, gone) would otherwise leave a ghost member that
  the heartbeat keeps seen. The "Выйти из комнаты" button during a join
  does what closing the dialog does: the room goes from the screen at once
  and the leave is sent after the join answers, because the API could
  handle the leave first and then add a not-ready member who blocks Start.
- **A hint and a small fix in the room view.** A line under the room says
  that closing the lobby leaves the room, since a host who closes it to
  play while waiting would otherwise leave silently. After an own action
  answers, the level select is set from the room even when it has the
  focus (while an action is out the focused select is left alone, so a
  choice being made is not overwritten). The long comments in `lobby.js`
  are cut to the why; the interface is in `klad/README.md`.
- Tests added for each rule above, each failing on the previous version:
  the heartbeat 204 after an outage, a tap on Ready during the return poll
  (and the control that a 404 soon after the last sight still says "room
  not found"), another link while in a room, the leave button during a
  join, a join failing with 0 and with 503, a member unseen for 57 s, a
  poll answered after the tab hid again, and the busy flag for the select.
- **The shape goes with the level choice.** A new room is level 1,
  `landscape`. A host in portrait sends `/level` with level 1 and
  `portrait` right after creating the room, and every level choice sends
  the host's shape at that moment. If the host turns the phone afterwards,
  the room keeps the last sent shape until the next level choice.
- **A malformed `#room=` id sends nothing.** It is checked against
  `^[A-Za-z0-9_-]{10}$` before any request, and the lobby then shows only
  "room not found", without even the presence requests. A link opened in a
  background tab waits until the tab is visible before it joins, or the
  API would drop the new member before the first poll.
- **One request helper and one nick prompt.** `online.js` now exports its
  `request()` and, in its page half, `KLAD_ONLINE.page` (`player`,
  `refresh`, `isAvailable`, `ask`). The lobby uses `ask()` rather than
  opening the nick dialog itself, because `ask()` also ends an earlier skip;
  without that, a nick saved after a skip would be deleted again. Nothing
  else in `online.js` changed. The lobby says in its dialog that, while it
  is open and for about a minute after (the API lists a player for 60 s
  after the last heartbeat), other players see the nick, the human or
  agent choice and whether it is a guest or an account; presence and rooms
  live only in the API's memory and store nothing new, so the privacy
  notes stay as they are.
- **Text from the API is set with `textContent` only**, as on the boards;
  the invite link is built from `location.origin`, never written as a URL
  in code, so the CI grep stays as it is.

## 2026-11-13 (sixth) - The API proxy passes WebSocket upgrades through

The ghost race will run over a WebSocket at
`wss://rassimok.dev/klad/api/race/<room>`. The proxy now forwards a request
with `Upgrade: websocket` (either case) to the same upstream URL as any
other, through the same path checks and the same 404, 503 and 502 answers.
It adds the `Upgrade`, `Origin` and, if present, `Sec-WebSocket-Protocol`
headers to the usual `Content-Type`, `Accept` and `Cookie`. An upgrade whose
`Origin` differs from the origin of the request itself gets 403
`{"error":"forbidden_origin"}` with `Cache-Control: no-store`, and the API
is not called. Requests without the upgrade behave exactly as before.

Status: a spike. The unit tests pass against a fake `fetch`. Whether Pages
Functions really carry the socket is **not yet verified**: the production
check (Chrome and Safari echo through `/klad/api/race/echo`) waits for the
API's echo endpoint (RAS-29) to deploy. The result goes here when it is
known.

### Decisions worth not relitigating

- **Same origin for the socket too.** `wss://rassimok.dev/...` should match
  the game's `connect-src 'self'` in current browsers (Safari from 16, per
  the W3C issue thread; the production check confirms it), so the CSP stays
  as it is, and the session cookie stays first-party. A direct
  `wss://api.rassimok.dev` would need a CSP change, and a ticket in the URL
  because the cookie would be cross-site.
- **The proxy checks `Origin`.** WebSockets have no CORS: any page can open
  one to any host, with that host's cookies as far as `SameSite` allows (a
  page on a same-site subdomain gets even `Strict` ones). The
  exact string compare means a missing Origin, `null`, `http:`, a trailing
  slash, a port or a subdomain is refused too. The browser's own `Origin`
  then goes on unchanged, so the API checks it as well (RAS-29); the proxy
  never sets one itself.
- **The 101 is returned untouched.** `fetch` with `Upgrade: websocket`
  gives a 101 Response whose `webSocket` is the upstream socket, and
  returning that same object is what proxies the connection (Workers
  `Response` docs: "a WebSocket connection proxied through a Worker").
  Rewriting such a response into a new Response throws in workerd ("status
  codes in the range 200 to 599", workerd issue 3047, still open), so
  nothing may wrap or rebuild it. The known risk is workerd issue 7312:
  intermittent "Network connection lost" after a 101 on Pages, reported for
  a Worker that serves the socket itself, not one that proxies it.
- **Few headers.** Cloudflare's WebSocket example sets only `Upgrade`; the
  runtime adds `Sec-WebSocket-Key` and the rest of the handshake. So the
  proxy does not copy `Connection`, `Sec-WebSocket-Key`,
  `Sec-WebSocket-Version` or `Sec-WebSocket-Extensions`; each side of the
  proxy negotiates its own. `Sec-WebSocket-Protocol` goes on so a later
  subprotocol would reach the API.
- **The upgrade's Origin must equal the request's own origin**
  (`new URL(request.url).origin`). The page that opens the socket is served
  by the same host as the Function, so no site origin is written in code:
  no URL literal and no split string to get past the CI grep (an earlier
  version of this ticket split `'https:' + '//rassimok.dev'`, which worked
  around the guard and was removed). A preview host passes the proxy but the
  API, which still checks the exact production origin, refuses it. The
  tests send upgrades to a `ws:` URL (a `test:` URL has no origin, and the
  CI grep only looks for `http:` and `https:`) and cover a foreign Origin
  and a missing one, both 403 with no fetch.

## 2026-11-13 (fifth) - Klad accounts: sign-up and login by emailed code

The boards dialog gains an "Аккаунт" part. A guest, or a browser with no
player, enters an email, gets a 6-digit code (`POST /login/code`) and logs
in with it (`POST /login/verify`). A new account is the guest itself;
logging in to an existing account moves the guest's results into it when
both have the same kind. An account shows its email (only to itself) and
its kind, can rename, log out (`POST /logout`) and delete itself, email
included. The boards mark every nick `гость` or `аккаунт`. Both footer
notes, the login part and the README now say that an account also stores
its email, that a code request keeps only a hash of the address (with the
hashed code until the code is used, replaced or expires, and with the
request time for the limits for a day, outdated records deleted with the
next code request, because nothing runs between requests), that the address itself is
stored only once a login creates or opens an account, that the server mails
nothing but login codes, and that an account can be deleted from any device
after a login. The nick prompt says the same in short; the meta description
says only that an account stores an email and a code request a hash. Built
against the shared contract (sections 1, 3, 5, 6). This change merges, and
so deploys, only after RAS-23 and RAS-24 are live on production: before
RAS-23 every login fails, and with RAS-23 alone account nicks are not
reserved yet and a guest of the same kind is left behind instead of merged,
so the login note would promise what the API does not do.

### Decisions worth not relitigating

- **In the boards dialog, not a dialog of its own.** One dialog open at a
  time keeps the hold rule in `klad.js` as it is, and the login sits next
  to the nick it turns into an account. The login part shows only for a
  guest or no player: an account logs out first, because switching from
  one account to another is not in the contract.
- **The code is checked against the address it went to.** The logic half
  keeps that email in memory, so editing the field after "Получить код"
  cannot send a valid code with the wrong address.
- **What the result says.** `merged: true` says the guest's results moved.
  `merged: false` with a guest of another kind says why (the kinds differ)
  and that the guest stays under its own nick. With a guest of the same
  kind it says "the results of nick X stayed with it", which is true for a
  sign-up (the guest became the account) and for a login against an API
  that does not merge yet; the contract does not say which `merged` a
  sign-up returns. Without a guest it says only that the login worked.
- **A guest of another kind is left behind, and the login part warns before
  it happens.** After such a login the browser's cookie belongs to the
  account, so the old guest's nick and results stay on the boards and can
  no longer be deleted from any browser. The note says so before the code
  is entered, with the way out: delete the guest first, then log in (an
  existing account needs no guest).
- **A code request stores a hash, not the address, and only codes are
  mailed.** The review found that code requests would leave addresses on
  the server for people who never signed up, someone else's address too,
  since anyone can type one. So before an account exists the API keeps no
  address (decided 2026-11-13 after the review, contract section 5): a
  code request keeps the address's SHA-256 with the hashed code until the
  code is used, replaced or expires, and, for the limits (three codes an
  hour per address, 80 mails a day), the hash and the time for a day
  (outdated rows go with the next code request). The address itself is stored only when a login creates or opens an
  account. Every privacy note says exactly that, at its own length. They
  say hash, never anonymous, because the hash of a known address can be
  matched, and they speak only for the game's server: the mail service
  still gets the address to send the code. The notes still say nothing is
  stored before a nick or an email, because a code request is the first
  thing that stores a hash. The notes (all but the meta description) and
  the README also promise that the server mails nothing but login codes; a
  later mail (a login alert, a deletion notice) means changing them first.
- **A login is read back, as a new nick is.** After a 200 from verify the
  game asks `GET /players/me`. No player there means the browser dropped
  the account's cookie, so the dialog says cookies look blocked instead of
  "Вы в аккаунте", and, as after a nick, no further `POST /players` goes
  out: that player could not be deleted from this browser. A network
  failure on the read-back keeps the account, as it does for a nick.
- **A login ends a skip.** Logout and delete count as a skip, so the page
  does not ask for a nick again; a person who then logs in has not
  declined one, so later results send and, if the session is lost, prompt
  again.
- **`no_session` keeps the code.** It means no account exists for the
  email and the browser has no guest; the dialog asks for a nick through
  the existing prompt and then for the same code again. The prompt closes
  the boards, so the text says to open "Таблицы" again before "Войти";
  the code field keeps the code meanwhile. If the API used the
  code up, the retry answers `invalid_code`, which asks for a new one, and
  one of the three codes an hour is not spent for nothing. `nick_taken`
  (rename, then a new code) and `too_many_attempts` (the code is gone) do
  need a new code, as the contract says.
- **One request at a time.** Code, verify and logout share the guard that
  rename and delete already had: a double click on "Получить код" would
  spend two of the three codes an hour.
- **Logout works like delete on the page.** No player, nothing waits, and
  the page does not ask for a nick again until a new login; the dialog
  offers a nick or a new login. 401 on logout says only that this browser
  has no nick on the server.
- **Inputs.** The email is `type="email"` with `autocomplete="email"`. The
  code is `type="text"` with `inputmode="numeric"`,
  `autocomplete="one-time-code"` and a pattern of 6 digits with optional
  spaces around them, and it is sent trimmed, as a string of exactly 6
  digits: `type="number"` would drop a leading zero. It has no
  `maxlength`: the pattern already caps the length, and a code pasted with
  a space in front would lose its last digit and then fail the pattern
  before the trim could run. Text fields and
  selects in the dialogs are at least 16px, because iOS Safari zooms into
  smaller ones.
- **Where results are announced.** Login answers go to a status line in
  the login part (`role="status"`, `aria-live="polite"`). A successful
  login hides that part, and text in a hidden live region is not read, so
  that message goes to the note above it, and the focus moves to the nick
  field. After logout or delete the email line is emptied and the login
  forms are reset, so the address does not linger in a hidden node.
- **The account marker is a word**, `аккаунт`, like `гость`, shown only
  when `guest` is `false`, so a screen reader reads it as text. An
  `aria-label` on a span is not reliably announced.
- **Delete keeps one button.** The confirmation names the email for an
  account, and the privacy notes point to the same button for both.

## 2026-11-13 (fourth) - Klad goes online: nick prompt, results and boards

New `klad/online.js`, loaded after `klad.js`, connects the game to its API
through `/klad/api`. It listens for `klad:clear` and `klad:run`, asks for a
nick at the first result, sends clears and runs (a run only when it started
at level 1), and shows the boards: records, fastest clear and most chests
per level and shape, and chests over all levels, each for humans or agents.
The boards dialog also changes the nick and deletes the nick and every
result (`DELETE /players/me`); the footer's privacy notes and the README say
so. The page gains two `<dialog>` elements, a "Таблицы" button in the HUD
and a short notice line on the stage. `klad.js` holds while a dialog is
open, and Space or Enter on a focused HUD button now presses the button.

### Decisions worth not relitigating

- **The nick prompt opens at the first result, not on load.** Nobody wants
  a form before the first move, and the privacy note can honestly say that
  nothing is stored until a nick is picked. The result that triggered the
  prompt, and any that follow while it is open, wait in memory and are sent
  once the nick is saved. Skipping drops them and the game does not ask
  again on that page; the boards dialog has "Выбрать ник" for a change of
  mind. A reload loses waiting results, which is the price of no storage.
- **A skip always means no nick.** A slow save is likely (the database
  wakes up in 2 to 3 s), so while the nick is being saved the prompt says
  "сохранение...", both buttons are off and Escape is held back. A repeated
  Escape cannot always be held back, so closing the prompt counts as a skip
  until `choose()` returns: it checks for one when the answer arrives and
  again after the waiting results are sent (or the new player is read
  back), and then deletes the player it created (`DELETE /players/me`,
  which also removes results already sent). After `already_signed_in` the
  player belongs to another tab, so this page only forgets it; results it
  already sent stay with that player. If the
  delete fails, a notice says for 20 s, not 6, that the nick may have been
  kept and that results may be recorded under it until it is deleted in the
  boards. A boards visit reads the player again and shows it with the
  delete button, and from then on results go out under it; after a reload
  the skip is forgotten too, because nothing is stored. Retrying the delete
  when the boards find the player was left out: if it failed again, the
  boards would show no nick and no delete button.
- **One rename or delete at a time.** A second click on "Да, удалить"
  during a slow request sent a second `DELETE`, whose 401 could arrive last
  and replace "Ник и результаты удалены." with a vaguer line. While one
  request runs, the dialog ignores further clicks and says "удаление..." or
  "сохранение...".
- **No storage in the browser.** The API's HttpOnly cookie is the only
  identity, so `online.js` cannot see it; it calls `GET /players/me` on load
  instead. Only 401 means "no player yet". Any other answer (404, as
  production gives until the API is deployed, 502, 503, a page that is not
  JSON) or a network failure means the API is unavailable: no prompt,
  results dropped, the game plays as before, and the boards say so. Opening
  the boards asks again, so the game recovers without a reload.
- **Answers.** 401 on a send: the player is gone (expired or deleted
  elsewhere), so the result goes back to waiting and the prompt opens again.
  A 401 right after creating the player means the browser blocks cookies.
  The waiting results show it or, with nothing waiting, one read of the
  player does. The prompt says so, counts as a skip and keeps "Сохранить
  ник" off for the visit, and no further `POST /players` is sent, because
  each would make a player this browser can never delete. 401 on a rename
  or a delete says only that this browser has no nick on the server any
  more: 401 means no valid session, not that the nick is gone. 409
  `already_signed_in`: this browser already has a player, so it reads that
  player and sends the waiting results. 429 and 400 drop the result with a
  short notice, no retry. Sends never block or stop the game.
- **Any open dialog holds the game.** `klad.js` checks for `dialog[open]`
  instead of listening for a new event, so there is no extra contract
  between the two scripts and nothing to get out of step. While held, play
  switches to the pause screen, the intro, clear and death timers stop, and
  game keys are ignored, so Escape, Space and Enter belong to the dialog.
  After closing, the game stays paused until P or fire.
- **`T` opens the boards** ("таблицы"); it was the free key nearest the
  meaning, and the title screen lists it. Like the other keys it is read by
  `e.code`, so it is the same physical key on a Russian layout. Touch
  players use the HUD button.
- **Space and Enter on a HUD button press the button.** The game took them
  as fire even on a focused HUD button, which made the new button unusable
  from the keyboard; the sound button gains the same fix. The touch-pad
  buttons are left out: they react to pointer events only, so on them the
  keys still play.
- **Deletion is promised for this browser only.** The privacy notes say the
  nick and results can be deleted from this browser while it keeps the
  game's cookie, not "at any time": deleting needs the session, and after a
  closed private window, cleared cookies or 90 days away nothing is left to
  show who is asking.
- **The boards' status line ends on "готово"**, not empty, so a screen
  reader hears that the tables arrived, also after each switch.
- **Focus goes back to the field after a dialog closes**, as after the sound
  button, so the next Space fires instead of reopening the boards.
- **Native `<dialog>` with `showModal()`** gives the focus trap, Escape and
  an inert page for free. Forms are handled in script with
  `preventDefault`, because the CSP has `form-action 'none'`.
- **Delete asks first, in the dialog**, with "Нет" focused, rather than
  `confirm()`, which a browser may suppress.
- **Nicks are other people's text.** Every board cell is built with
  `textContent`; nothing from the API goes through `innerHTML`.
- **One file, two halves.** The logic half has no DOM and assigns
  `module.exports`, like `levels.js` and `ticks.js`, so `node --test` covers
  request shapes and every answer above with a fake `fetch`. The page half
  runs only in a browser. A single script tag keeps the CI rule simple.

## 2026-11-13 (later still) - Klad counts engine ticks and reports clears and runs

`klad.js` counts fixed 1/120 s update steps per level attempt and dispatches
two events on `document`: `klad:clear` `{level, shape, revision, ticks,
chests, chestsTotal}` when a level is cleared and `klad:run` `{fromLevelOne,
levelsCleared, score, ticks}` at game over or after the last level. Nothing
is sent or shown yet; the leaderboard tickets listen for the events (shared
contract, section 6). New `klad/ticks.js` holds the formatter
(`KLAD_TICKS.format`, `m:ss.cc`) and `MIN_CLEAR_TICKS`; every level in
`levels.js` has `revision: 1`. `klad.js` also ignores keydown events whose
target is an input, textarea or select.

### Decisions worth not relitigating

- **Ticks, not wall time.** The counter increments only inside the play
  phase of `tick()`, so pause, menus, the title and death screens, tab
  switches and frame rate do not matter: the same play gives the same number
  on any machine, which a leaderboard needs. The counter restarts in
  `intro()`, so a death starts the level's attempt from zero; the clear
  result is the attempt that reached the exit.
- **`revision` per level.** A layout edit changes what a fast time means.
  Bump the level's `revision` whenever either shape changes, so the board
  can keep old and new times apart. `levels.test.js` requires it.
- **A run "from level 1"** is one that began at level 1 (`startGame(0)`:
  the title with level 1 selected, or restart after game over or a win). A
  start from the URL hash or a digit key is not. Run ticks add up every
  play-phase step of the run, failed attempts included, since the run is the
  whole session of lives.
- **Time formatter in its own file.** `klad.js` is a DOM-touching IIFE node
  cannot require, and `levels.js` exports the level array. `ticks.js` follows
  the `levels.js` dual-export pattern and loads with an exact script tag.
- **API floor.** `MIN_CLEAR_TICKS = 600` (5 s) mirrors the API. A test
  computes the cheapest key-then-exit route per layout from the movement
  speeds (walk 24, climb 26.7, fall 13.3 ticks per cell, no shooting) and
  requires it above the floor. Today the fastest are 1238 ticks (level 4
  landscape) to 1848 (level 3 landscape). Shooting through a brick could
  shorten a route, so the figure bounds unshot play only.
- **Typing guard on keydown only.** Keyup still releases movement keys, so
  a key held while focus moves into a field cannot stay stuck.
## 2026-11-13 (later) - The game's API through the site's own origin

`/klad/api/*` now reaches the game's API. A Cloudflare Pages Function,
`functions/klad/api/[[path]].js`, forwards each request to the origin in the
Pages variable `API_ORIGIN`, with the `/klad/api` prefix removed and the
query string kept, and returns the API's answer unchanged; the API's own
Quarkus endpoints under `/q` are not forwarded. `_routes.json` limits
Functions to `/klad/api/*`, and the `/klad/*` CSP gains
`connect-src 'self'`. Nothing calls the proxy yet; the game's online code
comes in a later change.

The privacy promise changes with it, in the README, the klad footer (plus a
short Russian privacy note) and the klad meta description: no analytics and
no tracking; once a player picks a nick, the API stores the nick, whether
they play as a human or an agent, and the results (accounts will add an
email); one HttpOnly cookie, for the game's API only. Still no localStorage,
and the home page still ships no JavaScript and sets no cookies.

### Decisions worth not relitigating

- **Same origin, not a cross-origin call.** The CSP gains only
  `connect-src 'self'`. The API's address lives in a Pages variable, so the
  `.js` URL check in CI needs no exception. The session cookie is
  first-party with `Path=/klad/api`, which avoids Safari's reported 7-day cap
  on cookies from a server whose IP differs from the site's, and there is no
  CORS to get wrong. The price: one more hop through Cloudflare, Function
  requests count against the Workers free quota, and the site is no longer
  purely static, since this Function is server-side code outside `klad/`.
- **No secret between proxy and API.** The API is reachable on its own
  anyway, so a shared secret would only prove that a request came through the
  proxy. That protects nothing the API's per-player limits do not already
  cover, and it would be one more secret to store and rotate.
- **An explicit `_routes.json`.** Pages generates a routes file from
  `functions/` when there is none, but its docs also say that once a project
  has Functions, every request invokes them by default. The explicit file
  removes the doubt and keeps the scope under review: static requests never
  run the Function and never count against the free daily quota.
- **Three headers only.** The proxy forwards `Content-Type`, `Accept` and
  `Cookie`. Requests reaching it also carry the visitor's IP address in
  Cloudflare's headers (`CF-Connecting-IP`, `X-Forwarded-For`), the user
  agent and the referrer, and the API needs none of them; passing everything
  on would hand them over. What Cloudflare itself adds to the outgoing
  request is outside the proxy's control, so the public text promises only
  what the proxy forwards.
- **A prefix check, then concatenation, not resolution.** The Function first
  answers 404 unless the parsed path is `/klad/api` or starts with
  `/klad/api/`. Without it, cutting off nine characters turns
  `/klad/api@other.host/x` into `@other.host/x`, and glued onto `API_ORIGIN`
  that changes the host. Parsing also resolves dot segments, `%2e%2e`
  included, so `/klad/api/%2e%2e/%2e%2e/aaaaaaaa@other.host/x` does the same.
  `_routes.json` and the Pages router should never send such a path, but the
  Function does not rely on them. After the check it concatenates:
  `new URL(path, API_ORIGIN)` would read a path such as `//other.host/x` as a
  new host. Together the check and the concatenation keep every request on
  `API_ORIGIN`, so the Function cannot become an open proxy; the tests assert
  the forwarded host for each path case, and that off-prefix paths make no
  fetch.
- **Quarkus's `/q` endpoints stay off the site origin.** The API serves its
  health checks (and, in dev mode, the dev UI) under `/q`, and the readiness
  answer can carry a database error message. The game needs none of them,
  and the deploy check calls them on the API's own address, so the Function
  answers 404 for `/klad/api/q` and everything under it, before any fetch.
  The check runs on the parsed path, where dot segments are already
  resolved, and on the percent-decoded rest of it, with any number of
  leading slashes and either case: the API's server (Vert.x) decodes `%71`
  to `q` and reads `//` as `/`, so a plain `startsWith('/q/')` would let
  `/klad/api/%71/health/ready` and `/klad/api//q/health` through. `q;x`
  counts as `q` as well, since a server may read `;` as the start of path
  parameters. A path that
  does not decode (`%zz`, or `%ff`, which is not UTF-8) is refused the same
  way; the API has no path parameters, so no real request looks like that.
  The raw path, not the decoded one, is what gets forwarded.
- **`redirect: 'manual'`.** A redirect from the API comes back as it is,
  instead of being followed inside the Function.
- **Proxy errors use the API's error shape.** A path that is not `/klad/api`
  or under `/klad/api/`, or that is under `/klad/api/q`, gives 404
  `{"error":"not_found"}`, `API_ORIGIN` unset 503
  `{"error":"not_configured"}`, an unreachable API 502
  `{"error":"upstream"}`. All three carry `Cache-Control: no-store`, and the
  tests check it. There is no fallback address: a deploy without the
  variable, such as a branch preview before it is set there, answers 503
  rather than guessing.
- **`_headers` does not cover `/klad/api/*`.** Pages never applies `_headers`
  to responses from Functions, so those responses carry only the API's own
  headers, and the API owns them. The game page's CSP is unaffected.
- **"No logs I own" is gone from the README.** The API runs on Cloud Run,
  which keeps standard request logs; once the game calls it, the claim would
  be false.
- **The proxy test uses `test:` URLs.** Only the path and query matter to the
  proxy, and the CI grep rejects any `http://` or `https://` in a `.js` file,
  tests included. A non-http scheme says so openly instead of assembling a
  URL string to slip past the grep.
- **The home page copy is unchanged.** It still says "no cookies", which
  stays true: the game's cookie is scoped to `/klad/api`, and the home page
  sets none.
- **Phones still hide the footer, privacy note included.** Short portrait
  screens and touch screens in landscape have kept the room for the field
  since 2026-10-30. Where the footer shows, it is now a few lines taller,
  and the tile size pays for that. Nothing is stored before a player picks
  a nick, so the screen that asks for the nick must show the note, on every
  device. The Russian note is not folded into a `<details>`: the game's key
  handler takes Space and Enter on the whole page and cancels their default
  action, and opening the note would change the stage height without
  refitting the canvas. Both would need changes in `klad.js`.

## 2026-11-13 - Agent instructions moved out of the repository

`CLAUDE.md` is removed, and its CODEOWNERS entry with it. Agent instructions
for this site now live outside the repository, in a private workspace that
holds every rassimok-dev project, so one set of rules covers all of them and
a stale copy on an old branch cannot compete with it.

### Decisions worth not relitigating

- **Do not re-add a `CLAUDE.md` or `.claude/` here.** CI remains the
  enforcement for the hard rules (no JavaScript on the apex, no third-party
  requests); the instruction file was only ever a reminder of them. A cloud
  agent session that sees this repository alone gets no instructions, and
  that trade was accepted.

## 2026-11-12 - CI check tools pinned

`html-validate` is pinned to 11.17.0 and `linkinator` to 8.1.0 in
`.github/workflows/ci.yml`. Both checks passed with these versions locally
on Node 24.22.3, along with the level tests.

### Decisions worth not relitigating

- **Pinned, not `latest`.** `npx --yes <tool>` downloads and runs whatever
  version was published last, on every CI run and every local check. That is
  code nobody here has reviewed, executed with the repository checked out.
  A pin makes upgrading the tools themselves a deliberate change. Their own
  dependencies still resolve fresh on each run: locking those would need a
  `package.json` and lockfile, which the site deliberately does not have.
- **Pin to a release that has been out for a while.** When these pins were
  chosen, html-validate had published 11.21.1 that same day; 11.17.0 was the
  newest release at least two weeks old. A fresh release is where a
  compromised publish would surface, so let it age before adopting it.

## 2026-10-30 (later still) — Game feel: no selection, no wall deaths, beeper sound

Three changes from the first rounds on a real phone.

- **The play area is not selectable.** A drag that starts on the field, or
  a long press on the pad, used to highlight the HUD and buttons. `user-select:
  none` on the HUD, stage and pad, `-webkit-touch-callout: none`, and
  `touch-action: none` on the canvas. Footer text stays selectable.
- **A regrowing wall never kills the player.** If you are standing in the
  gap when the timer runs out, the hole stays open, flickering, and seals
  the moment you step out. Lode Runner kills you here; the original's
  behaviour is undocumented and dying to a timer you cannot see felt
  arbitrary. Guards are still walled in, which is the whole point of the
  mechanic.
- **Sound, Korvet style.** The ПК-8020 had a 1-bit beeper, so every effect
  is a square wave synthesised at the moment it plays: shot, hole, chest,
  key, extra life, walled guard, death, level clear, level start. No audio
  files, nothing to download, nothing to license. The AudioContext is
  created on the first key or tap, as browsers require. `M` or the HUD
  button mutes; the choice is not remembered, because the site stores
  nothing. Verified on the live preview that the strict
  `Permissions-Policy: autoplay=()` does not block Web Audio after a
  gesture, so `_headers` is untouched.

## 2026-10-30 (later) — КЛАД is playable: five levels at /klad/

The game the title screen has been promising. Five levels, each in two
shapes (landscape 24×16, portrait 16×24) picked from the device orientation
when a level starts, keyboard on desktop, a touch pad on phones. Rules follow
the original as far as sources describe it; see `klad/MECHANICS.md`.

### What was learned about the original (and corrects earlier notes)

- The "five stages then it cycles" claim belongs to the Фотон arcade
  version, not the Korvet. The Korvet game repeated the MSX original's
  gameplay and level design; Onliner remembers 25 labyrinths, the MSX had 20.
  Five levels is **our** scope.
- Guards are not killed by being walled in. On the MSX they die only by
  falling into water, then respawn at their start. A walled-in guard just
  stays stuck, which is exactly why «замуровать чертика» was the trick.
- The shot travels any distance and removes the first breakable wall it hits;
  the wall regrows after a while. Shots never harm guards. Planks hold you
  when you walk on, drop you when you land on them. No jumping, no digging.

### Decisions worth not relitigating

- **One folder, deletable in one go.** Everything lives in `klad/`, with
  `klad/README.md` listing the four places outside it that reference it.
  The apex keeps its zero-JS claim; the footer now says so precisely.
- **Path-scoped CSP with a detach.** `_headers` gets a `/klad/*` block that
  first removes the site-wide `Content-Security-Policy` (`!`) and then sets
  one with `script-src 'self'`. Without the detach both headers are sent
  and both enforced, and the apex policy has no `script-src`, so the game
  would stay blocked. Verify on the live response, not the file.
- **Vanilla JS, canvas 2D, procedural 8×8 sprites, no storage.** Resume is
  the URL hash (`/klad/#3`); `localStorage` would break the "collects
  nothing" promise for a convenience. Palette comes from CSS variables so
  the game and the site stay one system.
- **Guards path with BFS and believe planks always hold.** Physics says
  otherwise. That asymmetry is the whole of level 4 ("обмани хранителя")
  and costs nothing. Guards avoid water in their planning but fall into it
  when a plank gives way.
- **Hole timing.** A hole stays open 4.2 s and flickers for the last
  second. A guard that falls in climbs out after 3.6 s if the hole is still
  open, so only a guard that drops in within half a second of the shot
  escapes; the rest get walled. A player caught in a regrowing wall dies, as
  in Lode Runner. Shooting a brick with a stuck guard inside frees it.
- **Guard speed ramps per level** (3.0 to 3.9 tiles/s against the player's
  5) so level 1 teaches the trap without a guard on your heels, and the
  "outrun" level is the fast one.
- **Two shapes per level, chosen at level start.** Rotating mid-level keeps
  the current shape until the next level; swapping a map under a running
  player is a bad experience and a source of bugs. Desktop always gets
  landscape.
- **Level validator in CI.** Hand-drawn maps broke four times out of ten on
  the first pass, every time in a boring way (a ladder ending under a brick
  ledge, a ledge walling off the only corridor, a one-tile gap in a ladder).
  `klad/test/levels.test.js` checks a key-then-exit route without shooting,
  which is conservative: shooting only ever opens more routes.
- **Footer hidden on short portrait phones.** A phone in portrait has about
  660 CSS px to work with; the footer cost a third of the playfield. The
  same credit is one tap away on the home page.
- **Fire left out.** Sources list it as a hazard but nobody describes its
  behaviour. Levels 1–5 use water, planks, bricks and guards only.
- **Unreachable chests are allowed, one per map.** The Korvet version had
  them as a joke; the validator permits at most one so a typo cannot hide
  behind the tradition.

## 2026-10-30 — Attract mode: the title screen moves

The landing page now plays like a cycled title "video": the tube powers on,
the status line and КЛАД wordmark draw themselves in, and a reel of five
title cards (who / builds / now / next / rules) loops for as long as the
page is open, with a block-character progress bar and a one-glyph runner.
The CV copy still sits below the rule, and a `Next` section was added so the
static text says everything the reel says.

### Decisions worth not relitigating

- **It is CSS, not JavaScript.** The brief said "JS or something you know
  better". A looping title sequence is timed frames, and `@keyframes` with
  `steps()` does that natively, so the apex keeps its zero-JS claim, the
  CI guard, and the CSP with no `script-src`. The earlier decision that JS
  lives only under `/klad/` stands. A `<video>` file was also rejected: it
  would need `media-src`, `Permissions-Policy` already sets `autoplay=()`,
  and it would weigh more than the rest of the site combined.
- **Base styles are the final frame; keyframes supply only the start.**
  If animations are unsupported, disabled, or reduced, nothing is missing
  because nothing's resting state is hidden. The one exception is the reel,
  whose cards are stacked and hidden by default; `prefers-reduced-motion`
  lays them out as a static list instead. Don't "fix" this by hiding
  content with `display: none` in a keyframe.
- **The reel is `aria-hidden`.** Five absolutely-positioned paragraphs
  flickering in and out would be read as overlapping gibberish. Every fact
  on a card also appears in the copy below, so screen readers lose
  nothing. If a card gains a fact, the copy must gain it too.
- **Card timing is a 20 s deck, 4 s per card, delays as slots.** Each card
  runs the same 20 s animation offset by its position, so adding a sixth
  card means a 24 s deck and five delays to adjust, not a new keyframe.
  The progress bar fills once per deck, which makes it the reel's position
  indicator rather than decoration.
- **The runner is one glyph flipped with `scaleX(-1)`.** Animating
  `content` is still discrete-only and uneven across engines; a mirrored
  `▚` reads as a stride and costs nothing.
- **Size:** `index.html` 2.9 KB, `style.css` 8.7 KB uncompressed, zero new
  requests. That is past the original "few kilobytes" aspiration; the
  reasoning is that HTML and CSS together are about 4.5 KB gzipped, and that the motion is the point of this revision.

## 2026-09-16 (later still) — КЛАД-3 title screen

The landing page is now a Korvet CRT screen: block-letter КЛАД wordmark,
phosphor palette, scanlines, blinking caret. The real CV content lives inside
the screen rather than being displaced by it. `RAS-11`.

### What the game actually is, and the rights position

«Клад» is a platformer in the Lode Runner mould, not a top-down maze: you
climb out of a dungeon collecting treasure chests, avoiding the little men
guarding them, and avoiding water and fire. You cannot dig. You *can* shoot
left and right, which temporarily clears certain wall types. Some floor types
drop you through. Some chests hold a key for a locked door, some an extra
life. Level counts differ between sources (20, 25 and 80 all appear) — settle
this against the real thing before building levels.

The lineage matters for the rights question:

- The Korvet version is credited to **Д. Иванов and А. Шаталов**, with two
  sequels — consistent with a `КЛАД-3` in a school lab. Other machines had
  entirely separate authors: the БК-0010 `Клад-2`/`Клад-3` (1988) were
  Баранов Д.Г.'s, so "Клад-3" names several unrelated programs.
- All of them are unlicensed clones of **ライズアウト / Rise Out** (ASCII
  Corporation, 1983, written by Hibiki Godai) for the MSX.

So the thing being recreated is itself a copy, and nothing in the chain is
public domain: ASCII's 1983 work runs to roughly 2053 under Japanese
corporate-authorship terms, and the Soviet versions are life+70 under Russian
and Ukrainian law with named, recent authors.

**Hence: clean-room homage, never a port.** Game mechanics, rules and systems
are not copyrightable — only concrete expression is. Our own code, our own
art, our own level layouts, with the lineage credited on the page, is on solid
ground. What would not be: shipping an original binary or ROM, ripping sprite
sheets or level data, or presenting the page as *being* `КЛАД-3`. «Клад» is
also just the dictionary word for "treasure", so there is no meaningful
trademark exposure in the name.

The name stays Cyrillic because it genuinely was: the Korvet game was
«Клад». The English name belongs to the Japanese ancestor, not to it.

### Decisions worth not relitigating

- **The playable game will live at `/klad/`, not on the apex.** A real КЛАД
  needs JavaScript — keyboard movement, a turn loop, a timer. CSS-only games
  are `:checked`/`:target` state machines, and a grid crawler with an
  inventory explodes combinatorially, so this is JS or it is not the game.
  Putting it behind a path means `_headers` can grant `script-src 'self'` to
  `/klad/*` alone and the apex keeps its zero-JavaScript claim, footer line
  included. Two alternatives were rejected: `klad.rassimok.dev` as a separate
  Pages project (stronger isolation, but a new repo, project and CNAME buy
  nothing here), and making `index.html` itself the game (most literal
  reading, but it spends the site's strongest claim).
- **The screen is dark in both colour schemes.** A CRT has no light mode.
  Fixing the palette also makes the contrast ratios provable rather than
  theme-dependent: 13.9:1 for body text, 8.1:1 for dimmed, 12.6:1 for links.
  The page chrome around the screen still follows `prefers-color-scheme`.
- **Block characters, not a Korvet ROM font.** An authentic `@font-face`
  would have to be self-hosted, and the CSP has no `font-src`, so it falls
  back to `default-src 'none'` and the font is blocked. Loosening the header
  for decoration is exactly the trade the rules say not to make.
- **The wordmark is generated, not hand-aligned.** Hand-editing it once
  produced rows of unequal width that `awk` hid by counting bytes rather than
  characters — `█` is three bytes in UTF-8, so every row looked wrong by a
  different amount. Regenerate it from per-glyph rows if it ever changes.

## 2026-09-16 (later) — Live

`rassimok.dev` and `www.rassimok.dev` serve from Cloudflare Pages. All eight
security headers verified on the live response, not just in CI.

### Two failures worth remembering

- **Attaching a custom domain via the Pages API left it `pending` and did not
  write the DNS records.** The dashboard normally does this implicitly. Fix was
  to create the CNAMEs directly (apex and `www` → `rassimok-dev.pages.dev`,
  proxied); the domain flipped to `active` within a minute.
- **The apex appeared dead locally while `www` worked.** That was a stale
  negative DNS cache: `rassimok.dev` had been queried repeatedly before any
  records existed, so `systemd-resolved` had cached NXDOMAIN. `www` had never
  been queried, so nothing was cached. Every public resolver was correct the
  whole time. `resolvectl flush-caches` fixes it. If a hostname fails locally
  but a sibling on identical records works, suspect the cache before the config.

## 2026-09-16 — Site created

**Repo:** `rassimok-dev/rassimok.dev` (private for now) · **Host:** Cloudflare Pages (pending)

- Static personal site. No build step: the repo root is the document root.
- **Zero JavaScript, zero third-party requests.** System font stack rather
  than a font CDN, which would leak every visitor's IP to Google.
- `Content-Security-Policy: default-src 'none'` — with no JavaScript, no
  `script-src` exception is needed at all.
- **CI enforces the privacy claims** rather than trusting discipline: the
  build fails on any external reference or added `<script>`. Intentions
  decay; build failures do not.
- Mesh-node identity mark as `avatar.svg`/`avatar.png` and `favicon.svg`.
  Two separate drawings, not one scaled asset — the detailed mesh is
  illegible at 16 px, so the favicon is a heavier five-peer reduction.
  Avatar is composed inside the inscribed circle because GitHub crops to one.

- Commits are **SSH-signed** with `id_ed25519`, registered on GitHub as a
  signing key. Signing was deliberately left off until the key was
  registered: a signature GitHub cannot verify displays as "Unverified",
  which looks worse than no signature at all.

### Decisions worth not relitigating

- **The w3.org exclusion in the third-party guard is deliberate.**
  `xmlns="http://www.w3.org/2000/svg"` is an XML namespace identifier, never
  fetched. Excluding it keeps the check honest instead of teaching us to
  ignore a failing check.
- **Domain registered 2026-09-16** via Cloudflare Registrar, expires
  2027-09-16. Nameservers already Cloudflare's.
- **GitHub account renamed** `hellorassimok` → `rassimok-dev` while it had
  zero public repos, so no URLs broke. Renaming later would have.
