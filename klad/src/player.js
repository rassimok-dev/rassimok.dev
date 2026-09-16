/* Player movement resolution. No collection, no death, no scoring -- world.js
 * owns those; this file only decides where the player ends up.
 *
 * The model is grid-aligned float movement: one axis at a time, and a turn
 * onto the other axis is only legal once the box is on that axis's grid line.
 * That gives a standing invariant the rest of the code leans on -- x is off
 * the grid only while moving horizontally, y only while moving vertically, so
 * exactly one of them is ever fractional. Collision therefore only ever has
 * to scan a single row or a single column. */

import {
  PLAYER_SPEED, CLIMB_SPEED, FALL_SPEED, ALIGN_EPS, AIR_CONTROL,
} from './tuning.js';
import {
  EMPTY, LEFT, RIGHT, blocks, standable, isLadder, isDoor, tileAt, indexOf,
  centerCol, centerRow, aligned, glide, slideH, slideV, fallTo,
  aheadCol, aheadRow,
} from './tiles.js';

/* A key is spent at the moment the door would otherwise stop you, and it
 * clears the tile outright -- the door does not close behind you. */
function tryDoor(world, cx, cy, events) {
  const { w, h } = world.level;
  if (!isDoor(tileAt(world.tiles, w, h, cx, cy))) return false;
  if (world.keys <= 0) return false;
  world.keys--;
  world.tiles[indexOf(w, cx, cy)] = EMPTY;
  if (events) events.push('door');
  return true;
}

export function stepPlayer(world, dt, intent, events) {
  const p = world.player;
  const { tiles } = world;
  const { w, h } = world.level;

  /* Facing is latched from input even when the move itself is refused: you
   * must be able to turn around against a wall and shoot back the other way. */
  if (intent.left && !intent.right) p.facing = LEFT;
  else if (intent.right && !intent.left) p.facing = RIGHT;

  const col = centerCol(p);
  const row = centerRow(p);
  const here = tileAt(tiles, w, h, col, row);
  const below = tileAt(tiles, w, h, col, row + 1);

  p.onLadder = isLadder(here);
  /* Support is read from the centre column only. Checking both straddled
   * columns would let the player stand on a one-pixel sliver of floor, which
   * reads as a bug to anyone playing it. */
  const onFloor = aligned(p.y) && standable(below);
  const supported = onFloor || p.onLadder;

  const up = intent.up && !intent.down;
  const down = intent.down && !intent.up;
  const dir = (intent.left ? LEFT : 0) + (intent.right ? RIGHT : 0);

  p.vx = 0;
  p.vy = 0;

  /* Climbing down works from the tile above a ladder as well as from on it,
   * so stepping off a floor onto a ladder head is not a pixel hunt. */
  const canClimbUp = p.onLadder;
  const canClimbDown = p.onLadder || isLadder(below);

  if (up && canClimbUp) {
    climb(world, p, dt, -1, events);
  } else if (down && canClimbDown) {
    climb(world, p, dt, 1, events);
  } else if (dir !== 0 && (supported || AIR_CONTROL)) {
    walk(world, p, dt, dir, events);
  } else if (!supported) {
    fall(world, p, dt);
  }
}

function climb(world, p, dt, sign, events) {
  const { tiles } = world;
  const { w, h } = world.level;

  /* Not lined up with the ladder yet: spend this step getting there. The
   * input is honoured late rather than dropped, which is what stops a player
   * who halted mid-tile below a ladder from being stranded there -- there is
   * no jump to escape with. */
  if (!aligned(p.x, ALIGN_EPS)) {
    p.x = glide(p.x, PLAYER_SPEED * dt);
    return;
  }
  p.x = Math.round(p.x);

  /* A key is spent only once this step would actually be stopped by the
   * door, not merely aimed at it: otherwise walking toward a door from a
   * tile away would silently open it and spend the key you were saving. */
  p.vy = sign * CLIMB_SPEED;
  const dy = p.vy * dt;
  const next = aheadRow(p.y, sign);
  if (sign > 0 ? p.y + dy > next - 1 : p.y + dy < next + 1) {
    tryDoor(world, p.x, next, events);
  }

  /* Deliberate climbing tests `blocks`, not `standable`: a ladder must not
   * stop the entity climbing it. Falling uses the other predicate. */
  p.y = slideV(tiles, w, h, p.x, p.y, dy, blocks);
}

function walk(world, p, dt, dir, events) {
  const { tiles } = world;
  const { w, h } = world.level;

  if (!aligned(p.y, ALIGN_EPS)) {
    p.y = glide(p.y, CLIMB_SPEED * dt);
    return;
  }
  p.y = Math.round(p.y);

  p.vx = dir * PLAYER_SPEED;
  const dx = p.vx * dt;
  const next = aheadCol(p.x, dir);
  if (dir > 0 ? p.x + dx > next - 1 : p.x + dx < next + 1) {
    tryDoor(world, next, p.y, events);
  }

  p.x = slideH(tiles, w, h, p.x, p.y, dx, blocks);
}

function fall(world, p, dt) {
  const { tiles } = world;
  const { w, h } = world.level;
  /* FALLTHRU is standable by neither predicate, which is the whole of that
   * mechanic: it looks solid and you drop through it. */
  p.vy = FALL_SPEED;
  p.y = fallTo(tiles, w, h, Math.round(p.x), p.y, p.vy * dt);
}
