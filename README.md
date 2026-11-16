# rassimok.dev

Personal site. Static apart from one small proxy for the game's API,
dependency-free, and deliberately boring.

This README documents *why* each decision was made, not just what it is.
The reasoning is the point — the page itself is 800 bytes of HTML.

## Principles

**Collect almost nothing.** No analytics, no tracking, no local storage. The
home page sets no cookies. The one exception is the game at `/klad/`: once a
player picks a nick, its API stores that nick, whether they play as a human
or an agent, and their results for the leaderboards (and, for a player who
signs up for an account, an email address), and sets one HttpOnly cookie
that only the game's API receives (`Path=/klad/api`). For a login code
request the API does not store the address itself, only its SHA-256 hash:
with the code's hash until the code is used, replaced by a new one or
expires, and with the time of the request, for its rate limits, for a day;
outdated records go with the next code request, because nothing runs on the
server between requests. The address itself is stored only once a login with the code creates
or opens an account, and the API sends no mail but login codes. The cookie
keeps a player's own results together and follows nobody, so there is still
no cookie banner. A player can delete the nick and every result from the
game's boards screen, in the same browser, as long as it keeps the game's
cookie; an account, its email included, also from any device after logging
in with a code sent to that address. Guests are deleted automatically about
90 days after their last visit, with their sessions and results; accounts
stay until deleted. The footers say this, and CI enforces
what a grep can check (see below), so the claims cannot quietly become false.

**Room chat in memory only.** In a lobby room the members can write to each
other. Only that room's members read a message, each only what was sent
after they joined. The API keeps the last 30 messages of each room in
memory, never in the database or a log line; they go with the room (10
minutes after it empties, or when its host opens a new room) or a restart,
and deleting a player removes their messages from every room. The chat
note, both footers of the game, its nick prompt and the privacy page say
so, and name hello.rassimok@gmail.com as the contact for reports, with one
rule: nothing illegal, no harassment.

**One privacy page.** `/privacy/` (`privacy/index.html`) says all of it in
one place, Russian first and English after: what the site and the game keep,
what other players see, how to delete it, where each part runs (Cloudflare
Pages, Google Cloud Run in europe-west4, Neon on AWS in eu-central-1, Resend
in eu-west-1), the logs, and a contact address that also takes deletion
requests. The home page, both footers of the game and the privacy note of
its login part (in a new tab) link to it. Plain HTML on `style.css`, no
JavaScript, under the site-wide headers. Google's OAuth consent screen wants
such a page on the app's own domain, linked from the home page. It says only
what the code does, with two exceptions that are the operator's promises,
not the code's: deletion by hand on request, for anyone who does not want to
wait for the automatic deletion of guests, and the contact for chat reports. So a change that stores, shows or
mails more changes the page in the same go.

**Zero third-party requests.** Fonts are the usual leak here: loading Google
Fonts sends every visitor's IP address to Google. This site uses the system
font stack instead, so it downloads no fonts at all — faster *and* private,
which is the rare case where those agree.

**No JavaScript on the home page.** Not minimal JavaScript, none. It removes
an entire class of vulnerability, makes the Content-Security-Policy trivially
strict, and means the page works identically everywhere. The one exception is
the game at `/klad/`, which runs its own same-origin script under a
path-scoped policy that also lets it call its own origin (`connect-src
'self'`). It lives in one folder, plus the API proxy below, so it can be
removed in one go.

## Security headers

Set in `_headers`, applied by Cloudflare Pages.

| Header | Why |
|---|---|
| `Content-Security-Policy: default-src 'none'` | Deny by default, then allow only same-origin CSS and images. With no JavaScript, no `script-src` exception is needed at all. |
| `Strict-Transport-Security` | Belt-and-braces: the entire `.dev` TLD is already HSTS-preloaded, so plaintext HTTP is impossible, but the header is still correct to send. |
| `X-Content-Type-Options: nosniff` | Stops browsers guessing content types and executing something unintended. |
| `Referrer-Policy: no-referrer` | Outbound links carry no information about where the visitor came from. |
| `Permissions-Policy` | Explicitly denies camera, microphone, geolocation and the rest. The page needs none of them, so none should be available. |
| `X-Frame-Options` / `frame-ancestors` | Cannot be embedded in a frame, which rules out clickjacking. |
| `/klad/*` policy | The game's page detaches the site-wide CSP and sends its own: the same, plus `script-src 'self'` for the game's scripts and `connect-src 'self'` for its API calls. |

Responses from the API proxy carry the API's own headers: Pages does not
apply `_headers` to responses from Functions.

## The game's API

The game reaches its API, a separate service, through this site's own
origin: the Cloudflare Pages Function `functions/klad/api/[[path]].js`
forwards `/klad/api/<path>` to `<API_ORIGIN>/<path>`. Same-origin keeps the
CSP at `connect-src 'self'`, makes the session cookie first-party, and needs
no CORS.

- The API's address lives only in the Pages environment variable
  `API_ORIGIN`, so it appears in no script and check 3 below still holds.
- The proxy passes on only the request headers `Content-Type`, `Accept`
  and `Cookie`, and drops every other one. A WebSocket upgrade also passes on
  `Upgrade`, `Origin` and `Sec-WebSocket-Protocol`, and only when its
  `Origin` is the site's own, because WebSockets have no CORS.
- `_routes.json` limits the Function to `/klad/api/*`. Every other request is
  a static file and runs no code.

## CI

Every push runs five checks:

1. **HTML validation** — catches malformed markup and missing accessibility attributes.
2. **Link checking** — a dead link on a personal site is a cheap bad impression.
3. **No third-party references** — fails the build if any external URL appears in HTML, CSS or a script, the proxy included. This is what keeps the privacy claim honest over time.
4. **No JavaScript** in pages outside `/klad/` — asserts the design decision rather than trusting discipline. Inside `/klad/`, only the game's own scripts may load.
5. **Level sanity** — every game level, in both orientations, must have a route from start to key to exit. The same step runs the tests of the API proxy and of the game's online code.

Checks 3 and 4 exist because *intentions decay*. A future me, or an AI
assistant helping a future me, will eventually paste in a font link or an
analytics snippet. The build should refuse it.

## Accessibility

Semantic HTML, a visible keyboard focus indicator, colour contrast meeting
WCAG AA in both light and dark themes, and a theme that follows the system
preference rather than overriding it.

## Identity

The mark is a mesh node — a hub with linked peers — rendered as two separate
SVGs rather than one scaled file:

- `avatar.svg` / `avatar.png` — full mesh, six peers with cross-links. Sized
  512px and composed inside the inscribed circle, because GitHub crops avatars
  to a circle.
- `favicon.svg` — five peers, no cross-links, proportionally heavier strokes.
  A faithful reduction of the avatar turns to mush at 16px, so the small size
  gets its own drawing.

Both use the accent colour from `style.css`, so the site, favicon and avatar
read as one system.

## Deployment

Cloudflare Pages, built from `main`. There is no build step — the files in
the repository root are the files that get served. Pages also builds the
one Function in `functions/` on its own; `API_ORIGIN` is set in the Pages
project, not in the repository.

## Licence

Content © rassimok. Code samples MIT.
