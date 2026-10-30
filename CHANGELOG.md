# Changelog

Dated entries, newest first. Written for a reader picking this up cold —
or a future session needing to know what already exists and why.

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
