/* Guardian pursuit. CONFIRMED: guardians cannot be killed and shots pass
 * through them, so this file has no health, no damage and no death -- they
 * are a moving hazard and the game is routing and timing against them.
 *
 * The AI is deliberately greedy rather than a pathfinder. A guardian closes
 * the vertical gap whenever a ladder under it can be used, and otherwise
 * closes the horizontal one. That is legible from the player's seat: you can
 * see what it is about to do and plan a route around it, which a shortest-path
 * chaser would take away. */

import { GUARD_SPEED, FALL_SPEED, ALIGN_EPS, GUARD_CHASE_EPS } from './tuning.js';
import {
  blocks, standable, lethal, isLadder, tileAt, aheadCol,
  centerCol, centerRow, aligned, glide, slideH, slideV, fallTo,
} from './tiles.js';

/* Hoisted so the pursuit loop allocates nothing per guardian per frame. */
const unwalkable = (id) => blocks(id) || lethal(id);

export function stepGuards(world, dt) {
  for (const g of world.guards) stepGuard(world, g, dt);
}

function stepGuard(world, g, dt) {
  const { tiles } = world;
  const { w, h } = world.level;
  const p = world.player;

  const col = centerCol(g);
  const row = centerRow(g);
  const here = tileAt(tiles, w, h, col, row);
  const below = tileAt(tiles, w, h, col, row + 1);

  g.onLadder = isLadder(here);
  const onFloor = aligned(g.y) && standable(below);

  const dy = p.y - g.y;

  /* Decided BEFORE gravity, the way stepPlayer decides `canClimbDown` before
   * it falls. A guardian standing on a ladder head is not on the ladder tile
   * -- `here` is the empty tile above it -- so with gravity first, every
   * partial step down left it unaligned and off the ladder, fallTo's
   * settle-in-front rule pushed it straight back onto the head, and it
   * vibrated there forever instead of following the player down. */
  const wantsDown = dy > GUARD_CHASE_EPS
    && (g.onLadder || isLadder(below)) && !blocks(below);

  if (!onFloor && !g.onLadder && !wantsDown) {
    /* Gravity for anything that is not deliberately climbing: a guardian in
     * mid-air is not making decisions. It may well land in water or fire --
     * guardians are never killed, they simply refuse to *walk* into it. */
    g.vx = 0;
    g.vy = FALL_SPEED;
    g.y = fallTo(tiles, w, h, Math.round(g.x), g.y, g.vy * dt);
    return;
  }

  g.vx = 0;
  g.vy = 0;

  if (Math.abs(dy) > GUARD_CHASE_EPS) {
    const sign = dy < 0 ? -1 : 1;
    const usable = sign < 0
      ? g.onLadder && !blocks(tileAt(tiles, w, h, col, row - 1))
      : wantsDown;
    if (usable) {
      if (!aligned(g.x, ALIGN_EPS)) {
        g.x = glide(g.x, GUARD_SPEED * dt);
        return;
      }
      g.x = Math.round(g.x);
      g.vy = sign * GUARD_SPEED;
      g.y = slideV(tiles, w, h, g.x, g.y, g.vy * dt, blocks);
      return;
    }
  }

  const dx = p.x - g.x;
  if (Math.abs(dx) > GUARD_CHASE_EPS) {
    const dir = dx < 0 ? -1 : 1;
    if (!aligned(g.y, ALIGN_EPS)) {
      g.y = glide(g.y, GUARD_SPEED * dt);
      return;
    }
    g.y = Math.round(g.y);

    g.facing = dir;
    g.vx = dir * GUARD_SPEED;

    /* Water and fire stop a guardian exactly as a wall does, so it walks up
     * to the edge and stands there rather than refusing the step from a tile
     * away -- the difference is visible, and a hazard a guardian keeps its
     * distance from is a hazard the player can no longer use as cover. */
    let nx = slideH(tiles, w, h, g.x, g.y, g.vx * dt, unwalkable);

    /* The floor ahead matters too: walking off a ledge into water is still
     * walking into it, and a guardian that drowned itself would silently make
     * the level easier. */
    const ahead = aheadCol(g.x, dir);
    if (lethal(tileAt(tiles, w, h, ahead, g.y + 1))) {
      nx = dir > 0 ? Math.min(nx, ahead - 1) : Math.max(nx, ahead + 1);
    }
    g.x = nx;
  }
}
