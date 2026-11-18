'use strict';
/* Level 3 played through in both shapes on the real page scripts
   (test/play.js). There is no guard: ladders and plank bridges hang over a
   lake, and the key lies on a plank beside the lowest rung of a ladder. One
   rung too far down, or one step too far past the key, ends in the water.
   The same keys also finish a race, so a level with no guard runs there
   too. Counts are tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, playLevel } = require('./play.js');

const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
const FALL_SECONDS = 0.3;
/* The death screen stays 1.4 s before the life is taken. */
const DEATH_SECONDS = 1.6;

const TO_THE_KEY = {
  landscape(play) {
    play.walk(RIGHT, 3);
    play.climb(DOWN, 9);
    play.walk(RIGHT, 1);
  },
  portrait(play) {
    play.walk(RIGHT, 2);
    play.climb(DOWN, 11);
    play.walk(RIGHT, 5);
    play.climb(DOWN, 6);
    play.walk(RIGHT, 1);
  },
};

/* The way to the key with one slip at its end. */
const SLIPS = {
  landscape: {
    'one rung below the ladder foot'(play) {
      play.walk(RIGHT, 3);
      play.climb(DOWN, 10);
    },
    'one step past the key'(play) {
      play.walk(RIGHT, 3);
      play.climb(DOWN, 9);
      play.walk(RIGHT, 2);
    },
  },
  portrait: {
    'one rung below the ladder foot'(play) {
      play.walk(RIGHT, 2);
      play.climb(DOWN, 11);
      play.walk(RIGHT, 5);
      play.climb(DOWN, 7);
    },
    'one step past the key'(play) {
      play.walk(RIGHT, 2);
      play.climb(DOWN, 11);
      play.walk(RIGHT, 5);
      play.climb(DOWN, 6);
      play.walk(RIGHT, 2);
    },
  },
};

const TO_THE_EXIT = {
  landscape(play) {
    play.walk(LEFT, 1);
    play.climb(UP, 4);
    play.walk(RIGHT, 5);
    play.climb(UP, 3);
    play.walk(RIGHT, 5);
    play.climb(UP, 2);
    play.walk(RIGHT, 8);
    play.climb(UP, 2);
  },
  portrait(play) {
    play.walk(LEFT, 1);
    play.climb(UP, 14);
    play.walk(RIGHT, 3);
    play.climb(UP, 3);
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
  },
};

function raceHooks() {
  const hooks = { finishes: [] };
  hooks.onFinish = (ticks) => hooks.finishes.push(ticks);
  hooks.ghosts = () => [];
  return hooks;
}

for (const shape of ['landscape', 'portrait']) {
  test(`level 3 ${shape}: down to the key at the foot of the ladder and back up over the bridges clears the level at revision 2 with no life lost`, () => {
    // given
    const play = playLevel(3, shape);

    // when
    TO_THE_KEY[shape](play);
    TO_THE_EXIT[shape](play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: 3, revision: 2, shape });
    assert.equal(play.lives(), 3);
  });

  for (const [slip, toTheSlip] of Object.entries(SLIPS[shape])) {
    test(`level 3 ${shape}: ${slip} drops the runner into the water and costs a life`, () => {
      // given
      const play = playLevel(3, shape);

      // when
      toTheSlip(play);
      play.run(FALL_SECONDS);
      const titleAfterSlip = play.title();
      play.run(DEATH_SECONDS);

      // then
      assert.equal(titleAfterSlip, 'ПОГИБ');
      assert.equal(play.lives(), 2);
      assert.deepEqual(play.events, []);
    });
  }

  test(`level 3 ${shape}: the same keys finish a race on this level with no guard`, () => {
    // given
    const play = loadGame({ isPortrait: shape === 'portrait' });
    const hooks = raceHooks();
    play.game.startRace(3, shape, hooks);

    // when
    TO_THE_KEY[shape](play);
    TO_THE_EXIT[shape](play);

    // then
    assert.equal(hooks.finishes.length, 1);
    assert.deepEqual(play.events, []);
  });
}
