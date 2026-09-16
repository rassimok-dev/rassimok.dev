/* Guardian pursuit: gravity, the two ladder directions, and the hazards a
 * guardian refuses to walk into.
 *
 * stepGuards is driven directly rather than through world.step, so nothing
 * here depends on the player's own movement or on contact killing him -- the
 * player is placed by hand and held still, which is exactly the situation a
 * guardian's chase logic has to answer on its own.
 *
 * The descent test is a regression: gravity used to run before the decision to
 * climb down, and since a guardian standing on a ladder HEAD is on the empty
 * tile above the ladder, every partial step down was immediately undone by
 * fallTo's settle-in-front rule. The guardian vibrated between two y values
 * forever and never came down, which let a player neutralise every guardian in
 * the game by luring it up a ladder once. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseLevel } from '../src/level.js';
import { createWorld } from '../src/world.js';
import { stepGuards } from '../src/enemy.js';
import { FIELD_W, FIELD_H, TICK_HZ } from '../src/tuning.js';

function field(rows) {
  const out = [];
  for (let y = 0; y < FIELD_H; y++) out.push((rows[y] ?? '').padEnd(FIELD_W, ' '));
  return out.join('\n');
}

const TICK = 1000 / TICK_HZ;
const DT = TICK / 1000;

/* Returns the set of distinct positions the guardian visited, because the bug
 * this file was written for is invisible to a start/end comparison: the
 * guardian does move every frame, it just moves back. */
function chase(world, ms, at) {
  const g = world.guards[0];
  const seen = new Set();
  for (let t = 0; t < ms - 1e-9; t += TICK) {
    if (at) { world.player.x = at.x; world.player.y = at.y; }
    stepGuards(world, DT);
    seen.add(`${g.x.toFixed(3)},${g.y.toFixed(3)}`);
  }
  return seen;
}

const near = (actual, expected, why) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${why}: ${actual} != ${expected}`);

test('a guardian on a ladder head climbs down after a player below it', () => {
  /* The ladder's topmost tile is row 4 and row 3 above it is empty, which is
   * the convention levels are authored to: the head is a place you step off. */
  const world = createWorld(parseLevel(field([
    '                                ',
    '                                ',
    '                                ',
    '     g                          ',
    '     H                          ',
    '     H                          ',
    '     H                          ',
    '  @  H    X                     ',
    '  ######################        ',
  ]), 'descend'));

  const g = world.guards[0];
  near(g.y, 3, 'the guardian starts on the ladder head');

  const seen = chase(world, 4000, { x: 3, y: 7 });

  assert.ok(seen.size > 4, `the guardian must not be stuck on two positions: ${[...seen]}`);
  assert.ok(g.y > 5, `the guardian came down the ladder, reached ${g.y}`);
});

test('a guardian left in mid-air still falls', () => {
  const world = createWorld(parseLevel(field([
    '     g                          ',
    '                                ',
    '                                ',
    '  @       X                     ',
    '  ######################        ',
  ]), 'fall'));

  const g = world.guards[0];
  chase(world, 2000, { x: 5, y: 3 });

  near(g.y, 3, 'a guardian falls to the tile above the floor');
  near(g.x, 5, 'a fall does not drift sideways');
});

test('a guardian on a ladder head stays put while the player is not below', () => {
  /* The mirror of the test above: the descent is decided before gravity now,
   * so a guardian standing on a ladder head must still stand there rather than
   * sink down the ladder on its own. */
  const world = createWorld(parseLevel(field([
    '                                ',
    '                                ',
    '                                ',
    '     g                          ',
    '  ###H###############           ',
    '     H                          ',
    '  @  H    X                     ',
    '  ######################        ',
  ]), 'hold'));

  const g = world.guards[0];
  chase(world, 2000, { x: 5, y: 3 });

  near(g.y, 3, 'the guardian holds the ladder head');
});
