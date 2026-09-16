# Changelog

Dated entries, newest first. Written for a reader picking this up cold —
or a future session needing to know what already exists and why.

## 2026-09-17 — КЛАД playable at /klad/

The PC build: simulation core, renderer, browser shell and eight original
levels. 103 tests under `node --test`, zero dependencies. `RAS-13`.

Four mechanics were confirmed by someone who actually played it, and are not
to be "improved": single screen with no scrolling; a shot beams down the row
and destroys only the first brick; guardians cannot be killed; a level ends by
collecting every chest and then reaching the exit.

### Decisions worth not relitigating

- **The scoped CSP works — `/klad/` runs scripts, the apex still cannot.**
  Cloudflare Pages merges matching `_headers` rules and comma-joins duplicate
  header values, and comma-joined CSP values are enforced as an intersection,
  so a naive `/klad/*` block would have left `default-src 'none'` in force and
  the game would have silently failed to load. Removing the inherited header
  with a `! ` prefix before setting the replacement does work, in the same
  block. Verified on a preview: exactly one CSP on `/klad/`, all eight
  security headers still inherited, apex byte-identical. `RAS-12`.
- **`klad/` is self-contained, and that is a requirement rather than tidiness.**
  No import, stylesheet, image or font from outside it; the only reference out
  is the `<a href="/">` back-link. The CRT look is duplicated from the title
  screen on purpose rather than shared. Moving the game to its own repo is a
  `git mv`. The one thing that would *not* travel is the CSP, which lives in
  the site-root `_headers` because Pages reads only the root file — that block
  is recorded in `klad/ARCHITECTURE.md` so the move cannot silently drop it.
- **Sprites are ASCII in source, baked to an offscreen canvas at boot.** No
  binary assets, every sprite diffable in a PR, and provably our own work —
  which matters, because nothing in this game's ancestry is public domain.
  Levels are original designs for the same reason: layouts are the most
  protectable expression in an old game.
- **No storage, so no persistent high score.** The site's privacy claim is
  absolute and the game does not get an exemption. Score dies with the tab,
  which is also what an arcade cabinet did.
- **CI now runs the game's tests.** Every other guard greps text or validates
  markup, so a collision or key-counting regression that soft-locked a level
  would have merged green. The repo claims CI enforces its claims; this makes
  that true of the largest new surface.
- **`tuning.js` holds every unconfirmed value in one file.** Speeds, brick
  respawn, lives, air control, whether a long fall kills. They are guesses
  pending a session with an emulator (MAME has a `pk8020` driver), and keeping
  them isolated means dialling in fidelity never touches game logic.

### Found by review, worth knowing

- A guardian that climbed to a ladder head could never climb back down — the
  gravity branch ran before the descent branch and `fallTo`'s settle-in-front
  rule undid every partial step, so it vibrated in place forever. The player
  could permanently neutralise every guardian by luring it up a ladder once,
  which removed the only hazard from three levels. Fixed by mirroring the
  player's ordering, and confirmed by simulation rather than by reading.
- Held keys were tracked per *action*, not per physical key, so releasing `A`
  while still holding `ArrowLeft` stopped the player dead. Now reference-counted
  by `event.code`.
- Keyboard input was bound to `window` and swallowed arrows and Space across
  the whole page even when the game was not focused, while pause listened only
  to the window's blur — so tabbing to the back-link left the game running and
  still eating keystrokes. Both now scoped to the canvas.
- One latent defect was filed rather than fixed: falls resolve against a single
  column, so an entity can come to rest inside a wall and then walk through it.
  Unreachable in the eight shipped levels (fuzzed, 400 runs each) but a trap for
  the next one. `RAS-14`.

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
