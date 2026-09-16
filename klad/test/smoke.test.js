/* Headless smoke run: the whole stack below the DOM, driven the way the loop
 * drives it.
 *
 * The other test files each hold one module still and poke it. This one exists
 * because the bug that actually shipped was of the opposite kind -- every unit
 * passed while the modules disagreed at their seams, and the game refused to
 * boot at all. So nothing here inspects a mechanic: it builds the real level
 * set through the real state machine, feeds it synthetic intent for longer than
 * a player would survive, and asserts only that the thing runs and that
 * progress is possible.
 *
 * game.js is included even though it is not a simulation module, because it is
 * DOM-free by contract and it is the seam that broke.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS } from '../src/levels.js';
import { parseLevel } from '../src/level.js';
import { createWorld, step } from '../src/world.js';
import { createGame } from '../src/game.js';
import { TICK_HZ, FIELD_W, FIELD_H } from '../src/tuning.js';

const STEP_MS = 1000 / TICK_HZ;

/* Fixed seed, own generator: a flake in a randomised soak test is worthless if
 * it cannot be replayed, and Math.random gives a different run every time. */
function rng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function intent(left, right, up, down, shoot) {
  return { left, right, up, down, shoot };
}

const IDLE = intent(false, false, false, false, false);

/* An entity that left the field or picked up a NaN is the failure this soak is
 * hunting for: it is silent in a unit test and fatal in the renderer, which
 * would ask drawImage for a destination at NaN. */
function assertSane(world, where) {
  const actors = [world.player, ...world.guards];
  for (const a of actors) {
    assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y), `${where}: non-finite position`);
    assert.ok(a.x >= -1 && a.x <= FIELD_W, `${where}: x out of field (${a.x})`);
    assert.ok(a.y >= -1 && a.y <= FIELD_H, `${where}: y out of field (${a.y})`);
  }
  for (const s of world.shots) {
    assert.ok(Number.isFinite(s.x), `${where}: non-finite shot`);
  }
  assert.ok(world.chestsLeft >= 0, `${where}: negative chestsLeft`);
}

test('a world built from level 1 survives several hundred ticks of walking', () => {
  const level = parseLevel(LEVELS[0].source, LEVELS[0].name);
  const world = createWorld(level);
  const before = world.chestsLeft;

  /* Level 1 opens with a clear run of floor to the right and two chests on it.
   * Holding right is therefore the shortest input that proves collection works
   * end to end -- and when the floor runs out the fall exercises gravity too. */
  let collected = 0;
  for (let i = 0; i < 600; i += 1) {
    const events = step(world, STEP_MS, intent(false, true, false, false, false));
    for (const e of events) if (e === 'chest' || e === 'key' || e === 'life') collected += 1;
    assertSane(world, `level 1 tick ${i}`);
    if (world.status !== 'play') break;
  }

  assert.ok(collected >= 1, `expected at least one chest, collected ${collected}`);
  assert.equal(world.chestsLeft, before - collected);
  assert.equal(world.status, 'play', 'nothing on level 1 should kill a player who only walks right');
});

test('every level survives a soak of random intent without throwing', () => {
  const next = rng(0x4b4c4144);

  for (const entry of LEVELS) {
    const level = parseLevel(entry.source, entry.name);
    const world = createWorld(level);

    for (let i = 0; i < 900; i += 1) {
      /* Held for a few ticks at a time rather than resampled every tick: an
       * input that changes at 60 Hz averages out to standing still, which
       * would soak nothing. */
      const roll = Math.floor(next() * 6);
      const held = intent(roll === 0, roll === 1, roll === 2, roll === 3, next() < 0.1);
      step(world, STEP_MS, held);
      assertSane(world, `${entry.name} tick ${i}`);

      /* Death and clear are legitimate outcomes of random input; the point is
       * that the machine keeps running afterwards, so restart and carry on. */
      if (world.status !== 'play') {
        assert.deepEqual(step(world, STEP_MS, held), [], 'a finished world must be inert');
        break;
      }
    }
  }
});

test('the shipped level set boots through the state machine and plays', () => {
  const game = createGame();
  assert.equal(game.error, null, `createGame rejected the shipped levels: ${game.error}`);
  assert.equal(game.levelCount, LEVELS.length);
  assert.ok(game.world, 'the title screen needs a world to draw');

  /* The contract's confirm key is 'shoot', which is also how a player leaves
   * the title screen. */
  game.update(STEP_MS, IDLE, ['shoot']);
  assert.equal(game.phase, 'play');

  const before = game.world.chestsLeft;
  for (let i = 0; i < 600; i += 1) {
    game.update(STEP_MS, intent(false, true, false, false, false), []);
    if (game.phase !== 'play') break;
  }

  assert.ok(game.score > 0, 'walking right on level 1 should have scored');
  assert.ok(game.world.chestsLeft < before);
});

test('pause freezes the simulation and resumes it unchanged', () => {
  const game = createGame();
  game.update(STEP_MS, IDLE, ['shoot']);
  game.update(STEP_MS, intent(false, true, false, false, false), []);

  const moving = intent(false, true, false, false, false);
  game.update(STEP_MS, moving, ['pause']);
  const x = game.world.player.x;
  for (let i = 0; i < 60; i += 1) game.update(STEP_MS, moving, []);
  assert.equal(game.world.player.x, x, 'a paused world must not move');

  game.update(STEP_MS, moving, ['pause']);
  game.update(STEP_MS, moving, []);
  assert.ok(game.world.player.x > x, 'unpausing must hand the input back');
});
