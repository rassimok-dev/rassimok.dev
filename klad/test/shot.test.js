/* The beam. These are the CONFIRMED mechanics, so these tests exist to stop a
 * later "improvement" as much as to catch a regression: only the first brick
 * dies, guardians are not a target, and the hole closes again on a timer. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseLevel } from '../src/level.js';
import { createWorld, step } from '../src/world.js';
import {
  FIELD_W, FIELD_H, TICK_HZ, BRICK_RESPAWN_MS, SHOT_COOLDOWN_MS,
} from '../src/tuning.js';
import { EMPTY, BRICK, indexOf } from '../src/tiles.js';

function field(rows) {
  const out = [];
  for (let y = 0; y < FIELD_H; y++) out.push((rows[y] ?? '').padEnd(FIELD_W, ' '));
  return out.join('\n');
}

const TICK = 1000 / TICK_HZ;

function run(world, ms, intent = {}) {
  const events = [];
  for (let t = 0; t < ms - 1e-9; t += TICK) events.push(...step(world, TICK, intent));
  return events;
}

const at = (world, x, y) => world.tiles[indexOf(world.level.w, x, y)];

/* One tick of trigger, then let the beam fly untouched. Holding shoot for the
 * whole run would fire again every SHOT_COOLDOWN_MS and make any assertion
 * about shots in flight a statement about the cooldown instead. */
function fireOnce(world, flightMs) {
  const events = run(world, TICK, { shoot: true });
  events.push(...run(world, flightMs));
  return events;
}

test('a shot destroys the first brick in the row and no other', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '  @  =  =                    X  ',
    '  ############################  ',
  ]), 'first-brick'));

  const events = fireOnce(world, 300);

  assert.ok(events.includes('shoot'));
  assert.equal(events.filter((e) => e === 'brick').length, 1);
  assert.equal(at(world, 5, 1), EMPTY, 'the near brick is gone');
  assert.equal(at(world, 8, 1), BRICK, 'the far brick is untouched');
  assert.equal(world.shots.length, 0, 'the beam stopped at the brick');
});

test('a shot follows the facing, not the last direction pressed', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '  =  @                       X  ',
    '  ############################  ',
  ]), 'facing'));

  run(world, 20, { left: true });
  fireOnce(world, 300);

  assert.equal(at(world, 2, 1), EMPTY, 'shot left because the player faces left');
});

test('SOLID absorbs the beam and the brick behind it survives', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '  @  #  =                    X  ',
    '  ############################  ',
  ]), 'absorb'));

  const events = fireOnce(world, 400);

  assert.ok(!events.includes('brick'));
  assert.equal(at(world, 8, 1), BRICK);
  assert.equal(world.shots.length, 0);
});

test('a shot passes straight through a guardian, which cannot be killed', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '  @  g     =                 X  ',
    '  ############################  ',
  ]), 'through-guard'));

  assert.equal(world.guards.length, 1);
  fireOnce(world, 500);

  assert.equal(world.guards.length, 1, 'guardians are a hazard, not a target');
  assert.equal(at(world, 11, 1), EMPTY, 'the brick behind the guardian still died');
  assert.equal(world.status, 'play');
});

test('a shot dies at the field edge rather than wrapping', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '  @                          X  ',
    '  ############################  ',
  ]), 'edge'));

  fireOnce(world, 2000);
  assert.equal(world.shots.length, 0);
});

test('a destroyed brick regenerates after BRICK_RESPAWN_MS and not before', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '  @  =                       X  ',
    '  ############################  ',
  ]), 'respawn'));

  fireOnce(world, 300);
  assert.equal(at(world, 5, 1), EMPTY);
  assert.equal(world.bricks.size, 1);

  run(world, BRICK_RESPAWN_MS - 500);
  assert.equal(at(world, 5, 1), EMPTY, 'still open just short of the timer');

  run(world, 600);
  assert.equal(at(world, 5, 1), BRICK, 'closed again once the timer ran out');
  assert.equal(world.bricks.size, 0, 'and the schedule was cleared');
});

test('the cooldown limits the player to one beam at a time', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '  @                          X  ',
    '  ############################  ',
  ]), 'cooldown'));

  const events = run(world, SHOT_COOLDOWN_MS - TICK, { shoot: true });
  assert.equal(events.filter((e) => e === 'shoot').length, 1);

  const more = run(world, 2 * TICK, { shoot: true });
  assert.equal(more.filter((e) => e === 'shoot').length, 1, 'and fires again after it');
});
