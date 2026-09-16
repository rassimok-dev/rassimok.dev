/* The rules that are not movement: collection, the exit gate, death, lives.
 *
 * The level-end rule is CONFIRMED -- every chest, then the exit -- so the
 * inert-exit case is tested explicitly rather than assumed. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseLevel } from '../src/level.js';
import { createWorld, step, respawn } from '../src/world.js';
import {
  FIELD_W, FIELD_H, TICK_HZ, START_LIVES, SCORE_CHEST, DEATH_RESTARTS_LEVEL,
} from '../src/tuning.js';
import { CHEST, indexOf } from '../src/tiles.js';

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

const near = (actual, expected, why) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${why}: ${actual} != ${expected}`);

const at = (world, x, y) => world.tiles[indexOf(world.level.w, x, y)];

/* One walkway with the exit stranded early on it, so the player crosses the
 * exit tile while chests are still outstanding. */
const GATE = field([
  ' @ X $ $                        ',
  ' ###############################',
]);

test('the exit is inert while chests remain', () => {
  const world = createWorld(parseLevel(GATE, 'gate'));
  assert.equal(world.chestsLeft, 2);
  assert.equal(world.exitOpen, false);

  run(world, 400, { right: true });
  near(world.player.x, 3.4, 'standing on the exit tile');
  assert.equal(world.status, 'play', 'crossing a shut exit does nothing');
  assert.equal(world.exitOpen, false);
});

test('collecting every chest opens the exit, and reaching it clears the level', () => {
  const world = createWorld(parseLevel(GATE, 'gate'));

  const events = run(world, 1600, { right: true });
  assert.deepEqual(events.filter((e) => e === 'chest'), ['chest', 'chest']);
  assert.equal(world.chestsLeft, 0);
  assert.equal(world.score, 2 * SCORE_CHEST);
  assert.equal(world.exitOpen, true);
  assert.equal(world.status, 'play', 'the exit still has to be walked back to');

  const back = run(world, 1400, { left: true });
  assert.ok(back.includes('clear'));
  assert.equal(world.status, 'clear');
});

test('a cleared world is inert', () => {
  const world = createWorld(parseLevel(GATE, 'gate'));
  run(world, 1600, { right: true });
  run(world, 1400, { left: true });
  assert.equal(world.status, 'clear');

  const x = world.player.x;
  assert.deepEqual(run(world, 500, { right: true }), []);
  assert.equal(world.player.x, x, 'nothing moves after the level ends');
});

test('key and life chests both count as chests and grant their bonus', () => {
  const world = createWorld(parseLevel(field([
    ' @ + k                          ',
    ' ###############################',
    '                                ',
    '   X                            ',
  ]), 'bonus'));
  assert.equal(world.chestsLeft, 2);

  const events = run(world, 1000, { right: true });

  assert.ok(events.includes('life'));
  assert.ok(events.includes('key'));
  assert.ok(!events.includes('chest'), 'the bonus is what differs, not the event');
  assert.equal(world.chestsLeft, 0);
  assert.equal(world.keys, 1);
  assert.equal(world.lives, START_LIVES + 1);
  assert.equal(world.score, 2 * SCORE_CHEST, 'every chest variant scores');
});

test('water kills on contact', () => {
  const world = createWorld(parseLevel(field([
    ' @ ~                            ',
    ' ###############################',
    '                                ',
    '   X                            ',
  ]), 'water'));

  const events = run(world, 600, { right: true });

  assert.ok(events.includes('death'));
  assert.equal(world.status, 'dead');
  assert.equal(world.player.alive, false);
  assert.equal(world.lives, START_LIVES - 1);
});

test('fire kills on contact', () => {
  const world = createWorld(parseLevel(field([
    ' @ ^                            ',
    ' ###############################',
    '                                ',
    '   X                            ',
  ]), 'fire'));

  assert.ok(run(world, 600, { right: true }).includes('death'));
  assert.equal(world.status, 'dead');
});

test('a guardian kills by walking into a motionless player', () => {
  const world = createWorld(parseLevel(field([
    ' @    g                         ',
    ' ###############################',
    '                                ',
    '   X                            ',
  ]), 'guard'));

  const events = run(world, 3000);

  assert.ok(events.includes('death'));
  assert.equal(world.status, 'dead');
  assert.equal(world.guards.length, 1, 'and is still standing there');
});

test('a guardian will not walk into water', () => {
  const world = createWorld(parseLevel(field([
    ' @  ~ g                         ',
    ' ###############################',
    '                                ',
    '   X                            ',
  ]), 'guard-water'));

  run(world, 3000);

  near(world.guards[0].x, 5, 'stopped on the dry tile next to the water');
  assert.equal(world.status, 'play', 'and never reached the player');
});

test('a guardian climbs a ladder to close the vertical gap', () => {
  const world = createWorld(parseLevel(field([
    '                                ',
    '                                ',
    '                                ',
    '  @       H                     ',
    '##########H###########          ',
    '          H                     ',
    '          H                     ',
    '          H g   X               ',
    '################################',
  ]), 'pursue'));

  assert.equal(world.guards[0].y, 7, 'starts on the lower floor');
  run(world, 2500);

  assert.ok(world.guards[0].y < 4, `guardian reached the upper floor, y=${world.guards[0].y}`);
  assert.ok(world.guards[0].x < 10, 'and set off after the player');
});

test('death restarts the level and spends a life, keeping the score', () => {
  const world = createWorld(parseLevel(field([
    ' @ $ ~                          ',
    ' ###############################',
    '                                ',
    '   X                            ',
  ]), 'restart'));

  run(world, 900, { right: true });
  assert.equal(world.status, 'dead');
  assert.equal(world.score, SCORE_CHEST, 'the chest was banked before dying');
  assert.equal(world.lives, START_LIVES - 1);

  assert.equal(respawn(world), true);
  assert.equal(world.status, 'play');
  assert.equal(world.player.alive, true);
  assert.deepEqual(
    { x: world.player.x, y: world.player.y },
    world.level.playerSpawn,
    'back at the spawn',
  );
  assert.equal(world.score, SCORE_CHEST, 'score survives a death');

  /* Written against the flag rather than against one of its two readings, so
   * flipping DEATH_RESTARTS_LEVEL does not quietly falsify the test. */
  if (DEATH_RESTARTS_LEVEL) {
    assert.equal(world.chestsLeft, 1, 'the level was put back as it started');
    assert.equal(at(world, 3, 0), CHEST);
  } else {
    assert.equal(world.chestsLeft, 0, 'only the player was replaced');
  }
});

test('respawn refuses once the last life is gone', () => {
  const world = createWorld(parseLevel(field([
    ' @ ~                            ',
    ' ###############################',
    '                                ',
    '   X                            ',
  ]), 'gameover'));
  world.lives = 1;

  run(world, 600, { right: true });
  assert.equal(world.lives, 0);
  assert.equal(respawn(world), false);
});
