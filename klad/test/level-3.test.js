'use strict';
/* Level 3 played through in both shapes on the real page scripts
   (test/play.js). There is no guard: a frame of ladders and plank walkways
   stands in a lake, and the key lies on a plank beside the second-lowest
   rung of a ladder. Planks hold only a walker, so a wrong rung, a step past
   a walkway or a rung below a ladder foot drops the runner through every
   plank below into the water. The same keys also finish a race, so a level
   with no guard runs there too. Counts are tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, playLevel } = require('./play.js');

const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
/* SPEED.fall in klad.js; a slip waits for its drop plus a little. */
const FALL_ROWS_PER_SECOND = 9;
const FALL_MARGIN_SECONDS = 0.1;
/* The death screen stays 1.4 s before the life is taken. */
const DEATH_SECONDS = 1.6;

const TO_THE_KEY = {
  landscape(play) {
    play.walk(RIGHT, 2);
    play.climb(UP, 5);
    play.walk(RIGHT, 7);
    play.climb(DOWN, 2);
    play.walk(RIGHT, 2);
    play.climb(DOWN, 1);
    play.walk(RIGHT, 7);
    play.climb(UP, 4);
    play.walk(RIGHT, 5);
    play.climb(DOWN, 5);
    play.walk(RIGHT, 1);
  },
  portrait(play) {
    play.walk(RIGHT, 2);
    play.climb(UP, 5);
    play.walk(RIGHT, 5);
    play.climb(DOWN, 2);
    play.walk(RIGHT, 5);
    play.climb(DOWN, 2);
    play.walk(RIGHT, 1);
  },
};

const TO_THE_EXIT = {
  landscape(play) {
    play.walk(LEFT, 1);
    play.climb(UP, 2);
    play.walk(RIGHT, 3);
    play.climb(UP, 11);
    play.walk(RIGHT, 2);
    play.climb(UP, 1);
  },
  portrait(play) {
    play.walk(LEFT, 1);
    play.climb(UP, 14);
    play.walk(RIGHT, 2);
    play.climb(UP, 11);
    play.walk(RIGHT, 2);
    play.climb(UP, 1);
  },
};

/* One wrong key each: on the clear route before and after the key, and in
   portrait off it on the central ladder. dropRows is the fall from the tile
   the wrong key leads to down into the water. */
const SLIPS = {
  landscape: {
    'a step off the first ladder one rung too low': {
      dropRows: 5,
      keys(play) {
        play.walk(RIGHT, 2);
        play.climb(UP, 4);
        play.walk(RIGHT, 1);
      },
    },
    'one step past the key': {
      dropRows: 2,
      keys(play) {
        TO_THE_KEY.landscape(play);
        play.walk(RIGHT, 1);
      },
    },
    'one rung below the foot of the ladder by the key': {
      dropRows: 0,
      keys(play) {
        TO_THE_KEY.landscape(play);
        play.walk(LEFT, 1);
        play.climb(DOWN, 2);
      },
    },
    'a step off the ladder by the key one rung too high on the way back': {
      dropRows: 5,
      keys(play) {
        TO_THE_KEY.landscape(play);
        play.walk(LEFT, 1);
        play.climb(UP, 3);
        play.walk(RIGHT, 1);
      },
    },
  },
  portrait: {
    'a step off the first ladder one rung too low': {
      dropRows: 5,
      keys(play) {
        play.walk(RIGHT, 2);
        play.climb(UP, 4);
        play.walk(RIGHT, 1);
      },
    },
    'one step past the key': {
      dropRows: 2,
      keys(play) {
        TO_THE_KEY.portrait(play);
        play.walk(RIGHT, 1);
      },
    },
    'one rung below the foot of the ladder by the key': {
      dropRows: 0,
      keys(play) {
        TO_THE_KEY.portrait(play);
        play.walk(LEFT, 1);
        play.climb(DOWN, 2);
      },
    },
    'a step off the ladder by the key one rung too high on the way back': {
      dropRows: 17,
      keys(play) {
        TO_THE_KEY.portrait(play);
        play.walk(LEFT, 1);
        play.climb(UP, 15);
        play.walk(RIGHT, 1);
      },
    },
    'a step off the central ladder down through a chest': {
      dropRows: 13,
      keys(play) {
        play.walk(RIGHT, 2);
        play.climb(UP, 5);
        play.walk(RIGHT, 5);
        play.climb(UP, 2);
        play.walk(RIGHT, 3);
        play.climb(UP, 5);
        play.walk(LEFT, 1);
      },
    },
  },
};

function raceHooks() {
  const hooks = { finishes: [] };
  hooks.onFinish = (ticks) => hooks.finishes.push(ticks);
  hooks.ghosts = () => [];
  return hooks;
}

for (const shape of ['landscape', 'portrait']) {
  test(`level 3 ${shape}: down the frame to the key beside the ladder foot and back up to the door clears the level at revision 2 with no life lost`, () => {
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

  for (const [slip, { dropRows, keys }] of Object.entries(SLIPS[shape])) {
    test(`level 3 ${shape}: ${slip} drops the runner into the water and costs a life`, () => {
      // given
      const play = playLevel(3, shape);

      // when
      keys(play);
      play.run(dropRows / FALL_ROWS_PER_SECOND + FALL_MARGIN_SECONDS);
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
