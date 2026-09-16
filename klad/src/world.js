/* Mutable game state and the one entry point the rest of the game drives:
 * step(world, dtMs, intent) -> events[].
 *
 * Everything that is not "where does this entity end up" lives here --
 * collection, keys, the exit, death, brick regeneration -- so that player.js,
 * enemy.js and shot.js stay pure movement and can be reasoned about alone.
 *
 * Events are plain strings rather than objects. The only consumers are the
 * renderer and (later) sound, and neither needs a payload; keeping them
 * primitive means a test can assert on an array of strings. */

import {
  SCORE_CHEST, START_LIVES, SHOT_COOLDOWN_MS, DEATH_RESTARTS_LEVEL,
  CONTACT_DIST, EPS_MS,
} from './tuning.js';
import {
  EMPTY, BRICK, EXIT, CHEST_KEY, CHEST_LIFE, RIGHT,
  isChest, lethal, tileAt, indexOf, centerCol, centerRow, overlapsTile,
} from './tiles.js';
import { stepPlayer } from './player.js';
import { stepGuards } from './enemy.js';
import { spawnShot, stepShots } from './shot.js';

/* Entities are reset in place rather than replaced, so anything holding a
 * reference across a death -- the renderer, a debug overlay -- keeps looking
 * at the live object instead of a detached copy of the old one.
 *
 * Tile coordinates are already the box's top-left corner, so a spawn needs no
 * offset: an entity on integer coordinates occupies exactly its tile. */
function placeEntity(e, spawn, facing) {
  e.x = spawn.x;
  e.y = spawn.y;
  e.vx = 0;
  e.vy = 0;
  e.facing = facing;
  e.onLadder = false;
  return e;
}

/* Guardians deliberately carry no `alive` field. They cannot be killed, and a
 * flag nothing ever clears is an invitation to write the code that clears it. */
function newGuard(spawn) {
  return placeEntity({}, spawn, RIGHT);
}

function newPlayer(spawn) {
  const p = placeEntity({}, spawn, RIGHT);
  p.alive = true;
  return p;
}

export function createWorld(level, opts = {}) {
  return {
    level,
    /* The Level's own tiles stay pristine so a death can restore them
     * without re-parsing the ASCII. */
    tiles: Uint8Array.from(level.tiles),
    player: newPlayer(level.playerSpawn),
    guards: level.guardSpawns.map(newGuard),
    shots: [],
    bricks: new Map(),
    chestsLeft: level.chestCount,
    score: opts.score ?? 0,
    lives: opts.lives ?? START_LIVES,
    keys: 0,
    exitOpen: level.chestCount === 0,
    status: 'play',
    /* Not in the documented shape but unavoidable: SHOT_COOLDOWN_MS has to be
     * counted down somewhere, and a module-level timer would break the moment
     * two worlds existed (level preview, tests running in parallel). */
    shotCooldown: 0,
  };
}

/* Back to the state createWorld produced, keeping score and lives. Used by
 * respawn under DEATH_RESTARTS_LEVEL, and by game.js to retry a level. */
export function resetLevel(world) {
  const { level } = world;
  world.tiles.set(level.tiles);
  placeEntity(world.player, level.playerSpawn, RIGHT).alive = true;
  world.guards.forEach((g, i) => placeEntity(g, level.guardSpawns[i], RIGHT));
  world.shots = [];
  world.bricks.clear();
  world.chestsLeft = level.chestCount;
  world.keys = 0;
  world.exitOpen = level.chestCount === 0;
  world.status = 'play';
  world.shotCooldown = 0;
  return world;
}

/* Returns false when there is nothing left to respawn with -- the caller's
 * cue for a game over. Lives were already spent at the moment of death. */
export function respawn(world) {
  if (world.lives <= 0) return false;
  if (DEATH_RESTARTS_LEVEL) {
    resetLevel(world);
    return true;
  }
  /* The alternative reading, kept honest rather than dead-coded: the player
   * reappears at the spawn and everything already collected stays collected. */
  placeEntity(world.player, world.level.playerSpawn, RIGHT).alive = true;
  world.shots = [];
  world.status = 'play';
  world.shotCooldown = 0;
  return true;
}

function die(world, events) {
  world.player.alive = false;
  world.lives -= 1;
  world.status = 'dead';
  events.push('death');
}

/* A destroyed brick comes back whole. If something is standing in the hole
 * the regeneration is held rather than crushing it: entombing the player is a
 * mechanic the original may or may not have had, and inventing a death is a
 * bigger liberty than delaying a wall by a few frames. Flagged for the
 * emulator session. */
function stepBricks(world, dtMs) {
  if (world.bricks.size === 0) return;
  const { w } = world.level;
  for (const [i, left] of world.bricks) {
    const remaining = left - dtMs;
    const cx = i % w;
    const cy = (i - cx) / w;
    if (remaining > 0) {
      world.bricks.set(i, remaining);
      continue;
    }
    const blockedBy = overlapsTile(world.player.x, world.player.y, cx, cy)
      || world.guards.some((g) => overlapsTile(g.x, g.y, cx, cy));
    if (blockedBy) {
      world.bricks.set(i, 0);
      continue;
    }
    world.tiles[i] = BRICK;
    world.bricks.delete(i);
  }
}

function collect(world, events) {
  const { w, h } = world.level;
  const cx = centerCol(world.player);
  const cy = centerRow(world.player);
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return;

  const i = indexOf(w, cx, cy);
  const t = world.tiles[i];
  if (!isChest(t)) return;

  world.tiles[i] = EMPTY;
  world.chestsLeft -= 1;
  /* All three variants score. They are chests first and a bonus second --
   * the bonus is what differs, not whether opening one is worth anything. */
  world.score += SCORE_CHEST;

  if (t === CHEST_KEY) {
    world.keys += 1;
    events.push('key');
  } else if (t === CHEST_LIFE) {
    world.lives += 1;
    events.push('life');
  } else {
    events.push('chest');
  }
}

function touchesGuard(world) {
  const p = world.player;
  return world.guards.some(
    (g) => Math.abs(g.x - p.x) < CONTACT_DIST && Math.abs(g.y - p.y) < CONTACT_DIST,
  );
}

export function step(world, dtMs, intent) {
  const events = [];
  /* A finished world is inert. game.js decides when to respawn or advance;
   * simulating past the end would let a guardian walk onto a corpse and
   * charge a second life for one mistake. */
  if (world.status !== 'play') return events;

  const dt = dtMs / 1000;
  const { w, h } = world.level;

  stepBricks(world, dtMs);

  /* Snapped to exactly zero rather than left on a float residue -- see
   * EPS_MS. */
  world.shotCooldown = Math.max(0, world.shotCooldown - dtMs);
  if (world.shotCooldown < EPS_MS) world.shotCooldown = 0;
  stepShots(world, dt, events);

  stepPlayer(world, dt, intent, events);

  if (intent.shoot && world.shotCooldown <= 0) {
    spawnShot(world);
    world.shotCooldown = SHOT_COOLDOWN_MS;
    events.push('shoot');
  }

  collect(world, events);
  /* CONFIRMED: the exit is inert until the last chest is taken. */
  world.exitOpen = world.chestsLeft === 0;

  stepGuards(world, dt);

  /* Death is resolved after every mover has moved, so walking into a
   * guardian and a guardian walking into you cost the same. */
  const cx = centerCol(world.player);
  const cy = centerRow(world.player);
  if (lethal(tileAt(world.tiles, w, h, cx, cy)) || touchesGuard(world)) {
    die(world, events);
    return events;
  }

  if (world.exitOpen && tileAt(world.tiles, w, h, cx, cy) === EXIT) {
    world.status = 'clear';
    events.push('clear');
  }

  return events;
}
