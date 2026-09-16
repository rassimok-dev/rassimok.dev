/* Tile vocabulary, semantic predicates, and the grid geometry that movement
 * is resolved against.
 *
 * The geometry half sits here rather than in world.js for one reason: both
 * player.js and enemy.js need it, and world.js already imports both of them.
 * Putting shared primitives in world.js would make that cycle load-bearing,
 * and ES module cycles fail in ways that are painful to debug. Nothing below
 * knows about entities -- it is all "given this tile array, what is at (x,y)"
 * and "how far along this axis can a 1x1 box travel". */

import { EPS } from './tuning.js';

/* Ids are small ints so a level fits in a Uint8Array. The order is arbitrary
 * except that EMPTY must be 0: a zero-filled array is then a blank field. */
export const EMPTY = 0;
export const SOLID = 1;
export const BRICK = 2;
export const LADDER = 3;
export const FALLTHRU = 4;
export const WATER = 5;
export const FIRE = 6;
export const CHEST = 7;
export const CHEST_LIFE = 8;
export const CHEST_KEY = 9;
export const DOOR = 10;
export const EXIT = 11;

export const TILE_NAMES = [
  'EMPTY', 'SOLID', 'BRICK', 'LADDER', 'FALLTHRU', 'WATER', 'FIRE',
  'CHEST', 'CHEST_LIFE', 'CHEST_KEY', 'DOOR', 'EXIT',
];

/* Levels are authored as ASCII so they stay diffable and editable in any
 * editor without a tool. This map is the whole format. */
export const CHAR_TO_ID = {
  ' ': EMPTY,
  '#': SOLID,
  '=': BRICK,
  'H': LADDER,
  '.': FALLTHRU,
  '~': WATER,
  '^': FIRE,
  '$': CHEST,
  '+': CHEST_LIFE,
  'k': CHEST_KEY,
  'D': DOOR,
  'X': EXIT,
};

export const ID_TO_CHAR = [' ', '#', '=', 'H', '.', '~', '^', '$', '+', 'k', 'D', 'X'];

/* Spawns are not tiles. They mark a position and leave EMPTY behind, so they
 * deliberately have no id -- level.js consumes them during parsing. */
export const PLAYER_SPAWN_CHAR = '@';
export const GUARD_SPAWN_CHAR = 'g';

/* Facing and shot direction share one representation so a shot can be handed
 * the player's facing unchanged. */
export const LEFT = -1;
export const RIGHT = 1;

/* --- Semantic predicates --- */

/* Stops movement into the tile. DOOR blocks unconditionally here; spending a
 * key is a separate act that clears the tile first, so the door a key opened
 * is no longer a door by the time movement is resolved. */
export function blocks(id) {
  return id === SOLID || id === BRICK || id === DOOR;
}

/* Holds an entity up. LADDER is standable but not blocking -- that asymmetry
 * is what lets you land on a ladder top and still climb down through it.
 * FALLTHRU is neither, which is the entire mechanic: it looks solid and you
 * drop through it. */
export function standable(id) {
  return id === SOLID || id === BRICK || id === DOOR || id === LADDER;
}

export function lethal(id) {
  return id === WATER || id === FIRE;
}

/* All three variants count toward chestsLeft; they differ only in the bonus. */
export function isChest(id) {
  return id === CHEST || id === CHEST_LIFE || id === CHEST_KEY;
}

export function isLadder(id) { return id === LADDER; }
export function isDoor(id) { return id === DOOR; }
export function isBrick(id) { return id === BRICK; }
export function isExit(id) { return id === EXIT; }

/* --- Grid geometry --- */

export function indexOf(w, cx, cy) {
  return cy * w + cx;
}

/* Out of bounds reads as SOLID so the field edge needs no special case in
 * any caller: entities are walled in, and nothing outside is ever lethal or
 * collectable. Shots handle the edge themselves, because they must die there
 * rather than be absorbed. */
export function tileAt(tiles, w, h, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= w || cy >= h) return SOLID;
  return tiles[cy * w + cx];
}

/* The tile an entity counts as being "in". A 1x1 box straddles two tiles for
 * most of its travel, so collection, death and ladder tests all resolve
 * against the box centre -- one tile, never two, and never ambiguous. */
export function centerCol(e) { return Math.floor(e.x + 0.5); }
export function centerRow(e) { return Math.floor(e.y + 0.5); }

export function aligned(v, tol = EPS) {
  return Math.abs(v - Math.round(v)) <= tol;
}

/* Move toward the nearest grid line without overshooting it. The destination
 * is a tile the box already overlaps, so this needs no collision test. */
export function glide(v, step) {
  const target = Math.round(v);
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

/* Horizontal travel for a 1x1 box on an aligned row, clamped at the near
 * edge of the first tile `isBlocked` rejects. The scan is a loop rather than
 * a single lookahead so a long dt (a dropped frame, a test stepping in
 * chunks) cannot tunnel an entity through a wall. */
export function slideH(tiles, w, h, x, row, delta, isBlocked) {
  if (delta === 0) return x;
  const target = x + delta;
  if (delta > 0) {
    const first = Math.ceil(x + 1 - EPS);
    const last = Math.ceil(target + 1) - 1;
    for (let c = first; c <= last; c++) {
      if (isBlocked(tileAt(tiles, w, h, c, row))) return Math.min(target, c - 1);
    }
    return target;
  }
  const first = Math.floor(x + EPS) - 1;
  const last = Math.floor(target);
  for (let c = first; c >= last; c--) {
    if (isBlocked(tileAt(tiles, w, h, c, row))) return Math.max(target, c + 1);
  }
  return target;
}

/* Vertical twin of slideH. Kept as a separate function rather than an
 * axis-parameterised one because the two-argument tileAt call is the whole
 * body, and a generic version would only obscure it. */
export function slideV(tiles, w, h, col, y, delta, isBlocked) {
  if (delta === 0) return y;
  const target = y + delta;
  if (delta > 0) {
    const first = Math.ceil(y + 1 - EPS);
    const last = Math.ceil(target + 1) - 1;
    for (let r = first; r <= last; r++) {
      if (isBlocked(tileAt(tiles, w, h, col, r))) return Math.min(target, r - 1);
    }
    return target;
  }
  const first = Math.floor(y + EPS) - 1;
  const last = Math.floor(target);
  for (let r = first; r >= last; r--) {
    if (isBlocked(tileAt(tiles, w, h, col, r))) return Math.max(target, r + 1);
  }
  return target;
}

/* The first tile ahead of a 1x1 box on each axis -- the one that will stop
 * it. These mirror the scan bounds inside slideH/slideV exactly. Anything
 * that wants to know what it is about to hit (opening a door, refusing to
 * step into fire) must use them, or it would test one tile early or late. */
export function aheadCol(x, dir) {
  return dir > 0 ? Math.ceil(x + 1 - EPS) : Math.floor(x + EPS) - 1;
}
export function aheadRow(y, dir) {
  return dir > 0 ? Math.ceil(y + 1 - EPS) : Math.floor(y + EPS) - 1;
}

/* Gravity, as distinct from a deliberate climb.
 *
 * Falling stops on anything standable -- ladders included, so you land on a
 * ladder head rather than dropping past it -- while climbing tests `blocks`,
 * so a ladder never stops the entity climbing it. The settle in front is the
 * consequence of that asymmetry: climbing is the one way a box can come to
 * rest already overlapping a standable tile (half a step above a ladder
 * head), and from there an ordinary downward scan would start below the
 * surface it is touching and slip straight past it. Pushing it out onto that
 * surface is what makes climbing off the top of a ladder settle instead of
 * oscillating forever.
 *
 * Levels should therefore run a ladder one tile above the floor it serves --
 * the standing convention in this shape of game, and what makes the head a
 * place you can step off. */
export function fallTo(tiles, w, h, col, y, delta) {
  const bottomRow = Math.floor(y + 1 - EPS);
  if (bottomRow > Math.floor(y + EPS) && standable(tileAt(tiles, w, h, col, bottomRow))) {
    return bottomRow - 1;
  }
  return slideV(tiles, w, h, col, y, delta, standable);
}

/* Does a 1x1 box at (x,y) overlap tile (cx,cy) at all? Used to hold a brick's
 * regeneration back while something is standing in the hole. */
export function overlapsTile(x, y, cx, cy) {
  return x < cx + 1 && x + 1 > cx && y < cy + 1 && y + 1 > cy;
}
