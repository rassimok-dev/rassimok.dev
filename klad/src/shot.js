/* The beam. CONFIRMED mechanic -- see ARCHITECTURE.md; do not "improve" it.
 *
 * A shot is a point, not a box: it leaves the player in the facing direction,
 * runs along that one row, destroys the FIRST brick it meets and stops there.
 * SOLID and DOOR absorb it. Everything else -- guardians included -- it passes
 * straight through, which is why guardians cannot be killed and the game is
 * routing rather than combat. */

import { SHOT_SPEED, BRICK_RESPAWN_MS } from './tuning.js';
import { BRICK, SOLID, DOOR, EMPTY, centerRow, indexOf } from './tiles.js';

/* Spawned from the player's centre so the beam is not already half a tile
 * into the wall the player is standing against. */
export function spawnShot(world) {
  const p = world.player;
  const shot = { x: p.x + 0.5, y: centerRow(p), dir: p.facing, alive: true };
  world.shots.push(shot);
  return shot;
}

export function stepShots(world, dt, events) {
  const { tiles, level } = world;
  const { w, h } = level;
  let anyDead = false;

  for (const s of world.shots) {
    if (!s.alive) { anyDead = true; continue; }

    const from = s.x;
    s.x += s.dir * SHOT_SPEED * dt;

    /* Walk the columns swept this step instead of testing only the landing
     * one. At 24 tiles/sec a 60 Hz step covers 0.4 of a tile, but a stalled
     * tab or a coarse test step covers several -- and a beam that skipped the
     * brick it passed through would be the confirmed mechanic, broken. */
    const last = Math.floor(s.x);
    for (let c = Math.floor(from); s.dir > 0 ? c <= last : c >= last; c += s.dir) {
      if (c < 0 || c >= w) { s.alive = false; break; }

      const i = indexOf(w, c, s.y);
      const t = tiles[i];

      if (t === BRICK) {
        tiles[i] = EMPTY;
        /* Regeneration is owned by world.js, which counts the timer down; the
         * shot only schedules it. */
        world.bricks.set(i, BRICK_RESPAWN_MS);
        if (events) events.push('brick');
        s.alive = false;
        s.x = c + 0.5;
        break;
      }
      if (t === SOLID || t === DOOR) {
        s.alive = false;
        s.x = c + 0.5;
        break;
      }
      /* WATER, FIRE, chests, ladders, the exit and every guardian: pass. */
    }

    if (!s.alive) anyDead = true;
  }

  if (anyDead) world.shots = world.shots.filter((s) => s.alive);
}

/* Exported for the renderer, which wants the column a beam is lighting up.
 * A shot is a point, so this is a plain floor -- not the box-centre rule the
 * entities use. */
export function shotCol(shot) {
  return Math.floor(shot.x);
}
