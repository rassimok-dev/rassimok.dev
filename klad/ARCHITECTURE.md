# КЛАД — implementation contract

Every module in `klad/` is written against this file. It is the single source
of truth for data shapes, tile semantics and tunable constants. If code and
this file disagree, this file is wrong — fix it here too.

## Hard constraints

- **`klad/` is self-contained.** No import, stylesheet link, image or font
  from outside this directory. The only edge to the rest of the site is a
  plain link. The game must survive being moved to its own repo unchanged.
- **The CSP is NOT in this directory.** It lives in the deploying site's root
  `_headers`, because Cloudflare Pages reads only the root file. This is the
  one hard constraint enforced by configuration rather than by code, so moving
  `klad/` to its own repo means carrying this block with it, or the game ships
  with no CSP and no security headers at all — failing silently, since it still
  plays:

  ```
  /klad/*
    ! Content-Security-Policy
    Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
  ```

- **No third-party anything.** No CDN, no npm runtime dependency, no network
  request at all. The CSP is `default-src 'none'; script-src 'self'` — `fetch`,
  XHR and websockets are blocked and must never be attempted.
- **No build step.** Native ES modules, loaded directly by the browser.
- **No storage.** No `localStorage`, `sessionStorage`, cookies or IndexedDB.
  The site's privacy claim is absolute. Score is session-only, in memory.
- **No inline styles or inline event handlers.** The CSP has no
  `unsafe-inline`. Wire events with `addEventListener`, style with classes.
- Every source file is ASCII-clean of external URLs. CI greps `*.js` for
  `https?:` and for protocol-relative imports.

## Screen geometry

Single screen per level. **No camera, no scrolling** — the whole maze is
always visible. Confirmed against the original.

```
TILE      = 16          px per tile
FIELD_W   = 32          tiles
FIELD_H   = 15          tiles
CANVAS_W  = 512         FIELD_W * TILE
CANVAS_H  = 256         16px status band + FIELD_H * TILE
STATUS_H  = 16          px, drawn in-canvas at the top
```

The canvas is scaled to fit by an integer factor with
`image-rendering: pixelated`. Never scale by a fractional factor.

## Tile charset

Levels are authored as plain ASCII so they stay diffable and editable without
touching code.

| Char | Name | Blocks | Stand on | Notes |
|---|---|---|---|---|
| (space) | `EMPTY` | no | no | |
| `#` | `SOLID` | yes | yes | indestructible |
| `=` | `BRICK` | yes | yes | destroyed by a shot, regenerates |
| `H` | `LADDER` | no | yes | climbable up and down |
| `.` | `FALLTHRU` | no | no | looks solid, you pass down through it |
| `~` | `WATER` | no | no | lethal on contact |
| `^` | `FIRE` | no | no | lethal on contact |
| `$` | `CHEST` | no | no | collectable, scores |
| `+` | `CHEST_LIFE` | no | no | collectable, grants a life |
| `k` | `CHEST_KEY` | no | no | collectable, grants a key |
| `D` | `DOOR` | yes | yes | passable only by spending a key |
| `X` | `EXIT` | no | no | inert until every chest is collected |
| `@` | player spawn | — | — | becomes `EMPTY` after parsing |
| `g` | guardian spawn | — | — | becomes `EMPTY` after parsing |

All three chest variants count toward `chestsLeft`.

## Confirmed mechanics

These came from someone who played the original. Do not "improve" them.

- **Shooting beams down the row.** The shot leaves the player in the facing
  direction and travels along that row until it hits the first `BRICK`, which
  it destroys; `SOLID` and `DOOR` absorb it; it passes through everything
  else and dies at the field edge. A destroyed brick regenerates after
  `BRICK_RESPAWN_MS`.
- **Guardians cannot be killed.** Shots pass straight through them. They are
  a pure hazard — the game is routing and timing, not combat.
- **A level ends by collecting every chest, then reaching the exit.** The
  `EXIT` tile is inert and drawn dim until `chestsLeft === 0`.
- **No jumping.** Movement is left, right, up and down on ladders, plus
  gravity. This is a Lode Runner-shaped game, not a platformer with a jump.
- **No digging.** The only way through a `BRICK` is to shoot it.

## Unconfirmed — tunable, flagged for verification

Every value below is a considered guess pending a session with an emulator.
They all live in `tuning.js` so they can be dialled in without touching logic.
Do not scatter magic numbers through the modules.

```
TICK_HZ           = 60
PLAYER_SPEED      = 6.0   tiles/sec, horizontal
CLIMB_SPEED       = 5.0   tiles/sec, on ladders
FALL_SPEED        = 10.0  tiles/sec
GUARD_SPEED       = 4.0   tiles/sec
SHOT_SPEED        = 24.0  tiles/sec
SHOT_COOLDOWN_MS  = 300
BRICK_RESPAWN_MS  = 6000
START_LIVES       = 3
SCORE_CHEST       = 100
DEATH_RESTARTS_LEVEL = true   (vs. respawning in place)
```

## Data shapes

```js
// Immutable, produced by level.js
Level = {
  w, h,                      // numbers, always FIELD_W / FIELD_H
  tiles,                     // Uint8Array(w*h), tile ids, spawns already
                             //   replaced by EMPTY
  playerSpawn,               // {x, y} in tile coords
  guardSpawns,               // [{x, y}, ...]
  chestCount,                // number
}

// Mutable, produced by world.js
World = {
  level,                     // Level
  tiles,                     // Uint8Array, working copy
  player,  // {x, y, vx, vy, facing, alive, onLadder}  x/y are FLOAT tiles
  guards,  // [{x, y, vx, vy, facing, onLadder}, ...]
  shots,   // [{x, y, dir, alive}, ...]
  bricks,  // Map<tileIndex, msRemaining>
  chestsLeft, score, lives, keys,
  exitOpen,                  // boolean
  status,                    // 'play' | 'dead' | 'clear'
}

Intent = { left, right, up, down, shoot }   // all boolean

step(world, dtMs, intent) -> events[]        // mutates world
// events are plain strings: 'chest', 'key', 'life', 'brick', 'shoot',
// 'death', 'clear', 'door'
```

Positions are **floats in tile units**, not pixels. Entities move along one
axis at a time and must be axis-aligned (within `EPS`) before turning onto
the other. Rendering multiplies by `TILE`.

## Module ownership

```
src/tuning.js    constants only, no logic
src/tiles.js     tile ids, char<->id maps, semantic predicates
src/level.js     ASCII -> Level, validation with useful error messages
src/world.js     createWorld(level), step(), collision, collection, death
src/player.js    player movement resolution
src/enemy.js     guardian pursuit AI
src/shot.js      beam travel and brick destruction
src/sprites.js   sprites as ASCII + palette, baked to an offscreen canvas
src/render.js    paints a World onto a 2D context
src/input.js     keyboard -> Intent, no game logic
src/loop.js      fixed-timestep accumulator
src/game.js      state machine: title | play | dying | clear | gameover
src/main.js      boot and wiring, the only file touching the DOM at startup
src/levels.js    the level set, as ASCII template strings
test/*.test.js   node --test, zero dependencies, pure modules only
```

`tiles.js`, `level.js`, `world.js`, `player.js`, `enemy.js` and `shot.js`
must stay **free of DOM and canvas references** so they can be tested under
`node --test` with no browser and no dependencies.

## Accessibility

- The canvas is focusable and carries a label; controls are documented in
  visible text, not only in a tooltip.
- A DOM status line mirrors score, lives and level for screen readers, updated
  via `aria-live="polite"`. It is the accessible surface; the canvas is not.
- `prefers-reduced-motion` must suppress flashing and screen-shake effects.
- Keyboard focus stays visible at all times. Contrast meets WCAG AA.
