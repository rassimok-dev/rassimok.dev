/* Player movement: gravity, landing, ladders, FALLTHRU and doors.
 *
 * Every assertion is on an exact tile coordinate. Movement is float, but the
 * whole point of the grid-aligned model is that an entity that has stopped is
 * on a grid line -- if a landing ever came to rest at 5.03 the model is wrong,
 * not the tolerance. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseLevel } from '../src/level.js';
import { createWorld, step } from '../src/world.js';
import { FIELD_W, FIELD_H, TICK_HZ } from '../src/tuning.js';
import { EMPTY, DOOR, FALLTHRU, indexOf } from '../src/tiles.js';

function field(rows) {
  const out = [];
  for (let y = 0; y < FIELD_H; y++) out.push((rows[y] ?? '').padEnd(FIELD_W, ' '));
  return out.join('\n');
}

const TICK = 1000 / TICK_HZ;

/* Drives the world at the real tick rate rather than one big dt, so the tests
 * exercise the same path the game does. */
function run(world, ms, intent = {}) {
  const events = [];
  for (let t = 0; t < ms - 1e-9; t += TICK) events.push(...step(world, TICK, intent));
  return events;
}

const near = (actual, expected, why) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${why}: ${actual} != ${expected}`);

const at = (world, x, y) => world.tiles[indexOf(world.level.w, x, y)];

test('gravity pulls the player down and lands them on the tile above the floor', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '  @                             ',
    '                                ',
    '                                ',
    '            X                   ',
    '  ####      ####                ',
  ]), 'gravity'));

  assert.equal(world.player.y, 1);
  run(world, 500);

  near(world.player.y, 4, 'resting on the floor at row 5');
  near(world.player.x, 2, 'a fall does not drift sideways');
  assert.equal(world.status, 'play');
});

test('a standing player does not sink', () => {
  const world = createWorld(parseLevel(field([
    '  @   X                         ',
    '  #########                     ',
  ]), 'standing'));

  run(world, 1000);
  near(world.player.y, 0, 'still standing');
});

test('SOLID stops horizontal movement at the tile boundary', () => {
  const world = createWorld(parseLevel(field([
    '  @  #X                         ',
    '  #########                     ',
  ]), 'wall'));

  run(world, 2000, { right: true });
  near(world.player.x, 4, 'stopped flush against the wall at column 5');
});

test('a ladder is climbed down and back up', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '                                ',
    '   @                            ',
    '   H                            ',
    '   H                            ',
    '   H     X                      ',
    '   H                            ',
    '  #####                         ',
  ]), 'ladder'));

  /* A ladder head is standable, so the spawn rests on it rather than
   * dropping through -- that is the asymmetry between blocks and standable. */
  run(world, 200);
  near(world.player.y, 2, 'resting on the ladder head');

  run(world, 400, { down: true });
  near(world.player.y, 4, 'climbed two tiles at CLIMB_SPEED');
  near(world.player.x, 3, 'stayed in the ladder column');

  run(world, 400, { up: true });
  near(world.player.y, 2, 'climbed back up');
});

test('climbing past the top of a ladder leaves the player standing on it', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '                                ',
    '                                ',
    '   H                            ',
    '  @H     X                      ',
    ' #####                          ',
  ]), 'ladder-top'));

  run(world, 200, { right: true });
  run(world, 1500, { up: true });

  near(world.player.x, 3, 'on the ladder column');
  near(world.player.y, 2, 'standing on the ladder head, not floating above it');
});

test('a player off the grid line still reaches a ladder', () => {
  /* The glide-to-alignment rule. Without it a player who stopped mid-tile
   * under a ladder could never climb it, and there is no jump to escape. */
  const world = createWorld(parseLevel(field([
    '   H     X                      ',
    '  @H                            ',
    '  #####                         ',
  ]), 'align'));
  /* Further off the line than ALIGN_EPS, so the input cannot simply snap. */
  world.player.x = 3.4;

  run(world, 400, { up: true });
  near(world.player.x, 3, 'glided onto the ladder column');
  assert.ok(world.player.y < 1, 'and then climbed');
});

test('FALLTHRU cannot be stood on and is passed through downward', () => {
  const world = createWorld(parseLevel(field([
    '  @      X                      ',
    '                                ',
    '  ...                           ',
    '                                ',
    '                                ',
    '  #####                         ',
  ]), 'fallthru'));

  run(world, 800);

  near(world.player.y, 4, 'fell past the FALLTHRU and landed on the real floor');
  assert.equal(at(world, 2, 2), FALLTHRU, 'the FALLTHRU tile survives being passed');
});

test('a door consumes exactly one key and then stays open', () => {
  /* The exit is parked off the walkway: reaching it would end the level
   * mid-test and freeze the world before the second door was tested. */
  const world = createWorld(parseLevel(field([
    ' @ k  D   D                     ',
    ' ##########                     ',
    '                                ',
    '   X                            ',
  ]), 'door'));

  assert.equal(world.keys, 0);
  const events = run(world, 3000, { right: true });

  assert.equal(events.filter((e) => e === 'key').length, 1, 'one key chest taken');
  assert.equal(events.filter((e) => e === 'door').length, 1, 'one door opened');
  assert.equal(world.keys, 0, 'the key was spent, and only once');
  assert.equal(at(world, 6, 0), EMPTY, 'the opened door tile is cleared for good');
  assert.equal(at(world, 10, 0), DOOR, 'the second door is still shut');
  near(world.player.x, 9, 'stopped flush against the locked door');
});

test('a door without a key blocks', () => {
  const world = createWorld(parseLevel(field([
    ' @    D                         ',
    ' ##########                     ',
    '                                ',
    '   X                            ',
  ]), 'locked'));

  const events = run(world, 2000, { right: true });
  assert.ok(!events.includes('door'));
  assert.equal(at(world, 6, 0), DOOR);
  near(world.player.x, 5, 'held at the door');
});
