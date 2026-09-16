/* Paints a World onto a 2D context. Read-only with respect to the World: this
 * module never writes a field on it, so a frame can be dropped or drawn twice
 * without the simulation noticing. That is what lets loop.js run a fixed
 * timestep and render at whatever rate the display offers.
 *
 * Everything here is drawImage from the atlas baked in sprites.js. No text
 * measurement, no gradients, no per-frame path building -- the whole frame is
 * blits plus at most three fillRects.
 */

import {
  TILE, FIELD_W, FIELD_H, CANVAS_W, CANVAS_H, STATUS_H, BRICK_RESPAWN_MS,
} from './tuning.js';
import {
  SOLID, BRICK, LADDER, FALLTHRU, WATER, FIRE,
  CHEST, CHEST_LIFE, CHEST_KEY, DOOR, EXIT,
} from './tiles.js';
import {
  bakeSprites, drawSprite, drawText, textWidth, PALETTE, INK, FONT_H,
} from './sprites.js';

/* Presentation-only constants. These deliberately do NOT live in tuning.js:
 * tuning.js holds the numbers that change how the game plays and that will be
 * dialled in against an emulator. Nothing below can change an outcome, and
 * moving it there would make that file's "unconfirmed, needs verification"
 * warning apply to a batch of numbers that need no verification at all. */
const RENDER = {
  WATER_FRAME_MS: 220,
  FIRE_FRAME_MS: 90,
  SHOT_FRAME_MS: 50,
  EXIT_PULSE_MS: 900,
  /* A regenerating brick is faintest right after it is shot and solidifies as
   * it comes back, so the outline itself is the timer. */
  GHOST_MIN_ALPHA: 0.18,
  GHOST_MAX_ALPHA: 0.75,
  /* Below this the velocity is numerical noise from the collision resolve,
   * not walking, and the figure should stand still. */
  MOVE_EPS: 0.001,
  STATUS_PAD: 5,
  STATUS_GAP: 14,
  TINT_ALPHA: 0.22,
  /* The overlay dims the maze rather than hiding it: the title screen is a
   * real, un-stepped level, and letting the player read the route before
   * pressing start is free and better than a blank field. */
  OVERLAY_ALPHA: 0.78,
  OVERLAY_LINE: 13,
};

const TILE_SPRITE = new Map([
  [SOLID, 'solid'],
  [BRICK, 'brick'],
  [LADDER, 'ladder'],
  [FALLTHRU, 'fallthru'],
  [CHEST, 'chest'],
  [CHEST_LIFE, 'chestLife'],
  [CHEST_KEY, 'chestKey'],
  [DOOR, 'door'],
]);

/* `facing` and `dir` are the simulation's, and the contract does not pin their
 * encoding down. Accept both the numeric (-1/+1) and the word form so a change
 * on that side cannot silently flip every sprite on screen. */
function facesLeft(value) {
  if (typeof value === 'number') return value < 0;
  if (typeof value === 'string') return value[0] === 'l' || value[0] === 'L';
  return false;
}

/** Animation frame index, held at zero when the viewer asked for less motion. */
function phase(now, periodMs, count, reduced, offset = 0) {
  if (reduced) return offset % count;
  return (Math.floor(now / periodMs) + offset) % count;
}

function pad(value, width) {
  const s = String(Math.max(0, Math.trunc(Number(value) || 0)));
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

function drawStatus(ctx, world, levelNumber) {
  ctx.fillStyle = PALETTE[INK.BLACK];
  ctx.fillRect(0, 0, CANVAS_W, STATUS_H);

  /* The same one-pixel rule that separates .statusline from the body on the
   * surrounding page, so the band reads as part of that design language. */
  ctx.fillStyle = PALETTE[INK.SHADOW];
  ctx.fillRect(0, STATUS_H - 1, CANVAS_W, 1);

  const y = Math.floor((STATUS_H - 1 - FONT_H) / 2);
  let x = RENDER.STATUS_PAD;

  const field = (label, value, ink) => {
    drawText(ctx, label, x, y, INK.MOSS);
    x += textWidth(label) + 3;
    drawText(ctx, value, x, y, ink);
    x += textWidth(value) + RENDER.STATUS_GAP;
  };

  field('SCORE', pad(world.score, 6), INK.AMBER);
  field('LIVES', pad(world.lives, 2), world.lives > 0 ? INK.GREEN : INK.RED);
  field('LEVEL', pad(levelNumber, 2), INK.GREEN);

  /* Chests remaining is the actual win condition, so it earns a slot; it turns
   * amber at zero, matching the exit that just lit up. */
  field('LEFT', pad(world.chestsLeft, 2), world.chestsLeft === 0 ? INK.AMBER : INK.GREEN);

  if (world.keys > 0) field('KEYS', pad(world.keys, 1), INK.CYAN);
}

function drawTiles(ctx, world, now, reduced) {
  const tiles = world.tiles;
  const w = world.level?.w ?? FIELD_W;
  const h = world.level?.h ?? FIELD_H;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const id = tiles[y * w + x];
      const px = x * TILE;
      const py = y * TILE;

      const name = TILE_SPRITE.get(id);
      if (name !== undefined) {
        drawSprite(ctx, name, px, py);
        continue;
      }

      if (id === WATER) {
        /* Offsetting by column makes the crest travel sideways across a pool
         * instead of the whole pool blinking in unison. */
        drawSprite(ctx, `water${phase(now, RENDER.WATER_FRAME_MS, 3, reduced, x)}`, px, py);
      } else if (id === FIRE) {
        /* An uncorrelated offset per tile so a row of flames looks like fire
         * rather than like one flame stamped repeatedly. */
        drawSprite(ctx, `fire${phase(now, RENDER.FIRE_FRAME_MS, 3, reduced, x * 2 + y)}`, px, py);
      } else if (id === EXIT) {
        drawExit(ctx, world, px, py, now, reduced);
      }
    }
  }
}

function drawExit(ctx, world, px, py, now, reduced) {
  if (!world.exitOpen) {
    drawSprite(ctx, 'exitDim', px, py);
    return;
  }
  if (reduced) {
    drawSprite(ctx, 'exitLit', px, py);
    return;
  }
  /* A slow breathe rather than a blink: the alpha never drops far enough for
   * the arch to disappear, so nothing here strobes. */
  const t = (now % RENDER.EXIT_PULSE_MS) / RENDER.EXIT_PULSE_MS;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = 0.72 + 0.28 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2));
  drawSprite(ctx, 'exitLit', px, py);
  ctx.globalAlpha = prev;
}

function drawRegenBricks(ctx, world) {
  const bricks = world.bricks;
  if (!bricks || typeof bricks.forEach !== 'function') return;
  const w = world.level?.w ?? FIELD_W;
  const prev = ctx.globalAlpha;

  bricks.forEach((msRemaining, index) => {
    const progress = 1 - Math.min(1, Math.max(0, msRemaining / BRICK_RESPAWN_MS));
    ctx.globalAlpha = RENDER.GHOST_MIN_ALPHA
      + (RENDER.GHOST_MAX_ALPHA - RENDER.GHOST_MIN_ALPHA) * progress;
    drawSprite(ctx, 'brickGhost', (index % w) * TILE, Math.floor(index / w) * TILE);
  });

  ctx.globalAlpha = prev;
}

function drawShots(ctx, world, now, reduced) {
  const shots = world.shots;
  if (!shots) return;
  const frame = phase(now, RENDER.SHOT_FRAME_MS, 2, reduced);
  for (let i = 0; i < shots.length; i += 1) {
    const s = shots[i];
    if (!s || s.alive === false) continue;
    const suffix = facesLeft(s.dir) ? 'L' : '';
    /* A shot is a point, not a tile-aligned box, so the full-width beam frame
     * is centred on it rather than hung off its left edge -- otherwise the
     * streak trails half a tile behind where the collision actually is. */
    drawSprite(
      ctx,
      `shot${frame}${suffix}`,
      Math.round(s.x * TILE - TILE / 2),
      Math.round(s.y * TILE),
    );
  }
}

/* The walk cycle is keyed to distance travelled, not to the clock. Two tiles
 * per stride means the feet always change over at the same points on the
 * ground however fast PLAYER_SPEED is eventually tuned to, so a speed change
 * cannot turn walking into skating. */
function strideFrame(pos) {
  return Math.floor(pos * 2) & 1;
}

function drawActors(ctx, world) {
  const guards = world.guards ?? [];
  for (let i = 0; i < guards.length; i += 1) {
    const g = guards[i];
    if (!g) continue;
    const moving = Math.abs(g.vx) > RENDER.MOVE_EPS || Math.abs(g.vy) > RENDER.MOVE_EPS;
    const frame = moving ? strideFrame(g.onLadder ? g.y : g.x) : 0;
    const suffix = facesLeft(g.facing) ? 'L' : '';
    drawSprite(ctx, `guardWalk${frame}${suffix}`, Math.round(g.x * TILE), Math.round(g.y * TILE));
  }

  const p = world.player;
  if (!p) return;
  const px = Math.round(p.x * TILE);
  const py = Math.round(p.y * TILE);

  if (p.alive === false) {
    drawSprite(ctx, 'playerDead', px, py);
    return;
  }
  if (p.onLadder) {
    const climbing = Math.abs(p.vy) > RENDER.MOVE_EPS;
    drawSprite(ctx, `playerClimb${climbing ? strideFrame(p.y) : 0}`, px, py);
    return;
  }
  const walking = Math.abs(p.vx) > RENDER.MOVE_EPS;
  const suffix = facesLeft(p.facing) ? 'L' : '';
  drawSprite(ctx, `playerWalk${walking ? strideFrame(p.x) : 0}${suffix}`, px, py);
}

/* Death and level-clear wash the field in the colour that caused them. Under
 * prefers-reduced-motion the wash is a flat hold instead of a pulse -- the
 * feedback survives, the flashing does not, which is the point of the setting.
 * Nothing here ever fully covers the field, so the player can still see where
 * they died. */
function drawStatusTint(ctx, world, now, reduced) {
  let ink;
  if (world.status === 'dead') ink = INK.RED;
  else if (world.status === 'clear') ink = INK.AMBER;
  else return;

  const prev = ctx.globalAlpha;
  ctx.globalAlpha = reduced
    ? RENDER.TINT_ALPHA
    : RENDER.TINT_ALPHA * (0.6 + 0.4 * (0.5 - 0.5 * Math.cos((now / 260) % (Math.PI * 2))));
  ctx.fillStyle = PALETTE[ink];
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H - STATUS_H);
  ctx.globalAlpha = prev;
}

/* The words for the non-playing states. game.js owns when they are shown and
 * this owns what they look like, which is why the strings live here and not in
 * the state machine -- the machine has no business knowing the font is Latin
 * uppercase with no Cyrillic in it.
 *
 * The title reads KLAD-3 rather than КЛАД-3 for exactly that reason: the DOM
 * heading beneath the canvas carries the real name, and the aria-live line is
 * the accessible surface, so the band and the overlay stay a readout. */
function overlayLines(opts) {
  if (opts.paused) return ['PAUSED', 'PRESS P TO RESUME'];
  if (opts.phase === 'title') return ['KLAD-3', 'PRESS SPACE TO START'];
  if (opts.phase === 'gameover') {
    const headline = opts.outcome === 'complete' ? 'ALL LEVELS CLEARED' : 'GAME OVER';
    return [headline, `SCORE ${pad(opts.score, 6)}`, 'PRESS SPACE TO PLAY AGAIN'];
  }
  return null;
}

/* Called inside the field clip, so these coordinates are field-local. */
function drawOverlay(ctx, opts) {
  const lines = overlayLines(opts);
  if (!lines) return;

  const fieldH = CANVAS_H - STATUS_H;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = RENDER.OVERLAY_ALPHA;
  ctx.fillStyle = PALETTE[INK.BLACK];
  ctx.fillRect(0, 0, CANVAS_W, fieldH);
  ctx.globalAlpha = prev;

  const block = lines.length * RENDER.OVERLAY_LINE;
  let y = Math.floor((fieldH - block) / 2);
  for (let i = 0; i < lines.length; i += 1) {
    /* Centred by measurement rather than by a hand-counted offset, so editing
     * a string cannot quietly push it off-centre. */
    const x = Math.floor((CANVAS_W - textWidth(lines[i])) / 2);
    drawText(ctx, lines[i], x, y, i === 0 ? INK.AMBER : INK.MOSS);
    y += RENDER.OVERLAY_LINE;
  }
}

/**
 * Bake the atlas ahead of the first frame. Optional -- render() bakes lazily --
 * but calling it during boot keeps the ~7k fillRects out of frame one.
 */
export function preload() {
  return bakeSprites();
}

/**
 * Paint one frame.
 *
 * @param {CanvasRenderingContext2D} ctx destination, expected to be CANVAS_W x CANVAS_H
 * @param {object} world a World as described in ARCHITECTURE.md
 * @param {object} [opts]
 * @param {number} [opts.now] milliseconds driving the animations; defaults to
 *   the page clock. Passing it explicitly makes a frame reproducible.
 * @param {number} [opts.level] 1-based level number for the status band.
 * @param {boolean} [opts.reducedMotion] suppress flashing and shake.
 * @param {number} [opts.shake] shake amplitude in pixels; ignored when
 *   reducedMotion is set.
 * @param {string} [opts.phase] game.js's state, for the overlay: 'title',
 *   'play', 'dying', 'clear' or 'gameover'. Omitted means 'play'.
 * @param {boolean} [opts.paused] draws the pause card over any live phase.
 * @param {string} [opts.outcome] 'complete' or 'dead', read on 'gameover'.
 * @param {number} [opts.score] final score for the game-over card. The status
 *   band reads the World; only this card outlives the World it was scored in.
 */
export function render(ctx, world, opts = {}) {
  bakeSprites();

  const now = opts.now ?? (typeof performance !== 'undefined' ? performance.now() : 0);
  const reduced = opts.reducedMotion === true;
  const levelNumber = Number(opts.level ?? opts.levelNumber ?? 1);

  /* The canvas is scaled up by an integer factor with image-rendering:
   * pixelated, and drawImage would still smooth within this context if the
   * flag were left on. Set per frame because a context reset clears it. */
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;

  ctx.fillStyle = PALETTE[INK.BLACK];
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawStatus(ctx, world, levelNumber);

  ctx.save();
  /* Clip before translating so a shake can never push a sprite up into the
   * status band, which must stay readable precisely when things go wrong. */
  ctx.beginPath();
  ctx.rect(0, STATUS_H, CANVAS_W, CANVAS_H - STATUS_H);
  ctx.clip();

  let sx = 0;
  let sy = 0;
  const shake = Number(opts.shake) || 0;
  if (shake > 0 && !reduced) {
    /* Driven by the clock rather than by Math.random so two runs of the same
     * recorded input produce the same frames. */
    sx = Math.round(Math.sin(now / 17) * shake);
    sy = Math.round(Math.cos(now / 13) * shake);
  }
  ctx.translate(sx, STATUS_H + sy);

  drawTiles(ctx, world, now, reduced);
  drawRegenBricks(ctx, world);
  drawShots(ctx, world, now, reduced);
  drawActors(ctx, world);
  drawStatusTint(ctx, world, now, reduced);
  drawOverlay(ctx, opts);

  ctx.restore();
}

export default render;
