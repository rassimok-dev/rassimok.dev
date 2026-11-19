'use strict';
/* Level 4 played in both shapes with the guard active, on the real page
   scripts (test/play.js). A plank holds a runner who walks onto it and drops
   one who lands on it from a fall. The key lies on a short plank beside a
   brick: the safe way down to it is the fall from the end of the high plank
   onto that brick, while the fall onto the key from the middle plank goes
   through its plank into the water. From the key the way out is a second
   fall onto a brick, away from the exit; the step off the key shelf toward
   the exit staircase goes through the planks below. Counts are tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { playLevel } = require('./play.js');

const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
/* Long enough for a fall of up to eight rows onto a brick. */
const BRICK_FALL_SECONDS = 0.9;
/* Past a fall into the water, short of the end of the 1.4 s death screen. */
const WATER_FALL_SECONDS = { landscape: 1.5, portrait: 2.8 };
/* The death screen stays 1.4 s before the life is taken. */
const DEATH_SECONDS = 1.6;

const TO_THE_MIDDLE_PLANK = {
  landscape(play) {
    play.walk(RIGHT, 2);
    play.climb(UP, 3);
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
    play.walk(RIGHT, 1);
    play.climb(UP, 2);
    play.walk(RIGHT, 1);
    play.climb(UP, 3);
  },
  portrait(play) {
    play.walk(RIGHT, 2);
    play.climb(UP, 3);
    play.walk(RIGHT, 4);
    play.climb(UP, 3);
    play.walk(LEFT, 1);
    play.climb(UP, 3);
    play.walk(LEFT, 1);
    play.climb(UP, 3);
    play.walk(LEFT, 4);
    play.climb(UP, 3);
    play.walk(RIGHT, 4);
    play.climb(UP, 3);
    play.walk(RIGHT, 1);
    play.climb(UP, 3);
  },
};

const TO_THE_KEY = {
  landscape(play) {
    TO_THE_MIDDLE_PLANK.landscape(play);
    play.walk(RIGHT, 1);
    play.climb(UP, 3);
    play.walk(RIGHT, 6);
    play.run(BRICK_FALL_SECONDS);
    play.walk(LEFT, 2);
  },
  portrait(play) {
    TO_THE_MIDDLE_PLANK.portrait(play);
    play.walk(LEFT, 1);
    play.climb(UP, 3);
    play.walk(RIGHT, 5);
    play.run(BRICK_FALL_SECONDS);
    play.walk(LEFT, 2);
  },
};

const TO_THE_EXIT = {
  landscape(play) {
    play.walk(LEFT, 1);
    play.run(BRICK_FALL_SECONDS);
    play.walk(RIGHT, 13);
    play.climb(UP, 2);
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
    play.walk(LEFT, 1);
    play.climb(UP, 2);
    play.walk(LEFT, 1);
    play.climb(UP, 2);
    play.walk(LEFT, 1);
    play.climb(UP, 2);
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
  },
  portrait(play) {
    play.walk(LEFT, 1);
    play.run(BRICK_FALL_SECONDS);
    play.walk(RIGHT, 10);
    play.climb(UP, 2);
    play.walk(LEFT, 1);
    play.climb(UP, 2);
    play.walk(RIGHT, 1);
    play.climb(UP, 2);
    play.walk(LEFT, 1);
    play.climb(UP, 2);
    play.walk(RIGHT, 1);
    play.climb(UP, 2);
    play.walk(LEFT, 1);
    play.climb(UP, 2);
    play.walk(LEFT, 1);
    play.climb(UP, 2);
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
  },
};

/* From the end of the middle plank to the column of the key. */
const ONTO_THE_KEY = { landscape: 5, portrait: 2 };
/* From the key past the far end of the key shelf, toward the exit. */
const TOWARD_THE_EXIT = { landscape: 11, portrait: 7 };

for (const shape of ['landscape', 'portrait']) {
  test(`level 4 ${shape}: dropping from the high plank onto the brick, taking the key, dropping onto the lower brick and climbing the staircase clears the level at revision 2 with no life lost`, () => {
    // given
    const play = playLevel(4, shape);

    // when
    TO_THE_KEY[shape](play);
    TO_THE_EXIT[shape](play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: 4, revision: 2, shape });
    assert.equal(play.lives(), 3);
  });

  test(`level 4 ${shape}: stepping off the middle plank onto the key takes it and falls on through its plank into the water, costing a life`, () => {
    // given
    const play = playLevel(4, shape);
    TO_THE_MIDDLE_PLANK[shape](play);

    // when
    play.walk(RIGHT, ONTO_THE_KEY[shape]);
    play.run(WATER_FALL_SECONDS[shape]);
    const titleAfterFall = play.title();
    const isKeyShownAfterFall = !play.elements['h-key'].hidden;
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterFall, 'ПОГИБ');
    assert.equal(isKeyShownAfterFall, true);
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 4 ${shape}: with the key, stepping off the key shelf toward the exit falls through the planks below into the water and costs a life`, () => {
    // given
    const play = playLevel(4, shape);
    TO_THE_KEY[shape](play);

    // when
    play.walk(RIGHT, TOWARD_THE_EXIT[shape]);
    play.run(WATER_FALL_SECONDS[shape]);
    const titleAfterFall = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterFall, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}
