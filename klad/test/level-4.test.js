'use strict';
/* Level 4 played in both shapes with the guard active, on the real page
   scripts (test/play.js). Planks hold a runner who walks onto them and drop
   one who lands on them from a fall. The only way down is the hole at the
   left: its fall goes through a plank onto stone. The key lies on a bridge
   of planks, reached on foot; the fall straight down to it goes through the
   planks into the water. The key also opens the door of the guard's ledge:
   the guard steps out toward the runner, falls through the planks and
   drowns, and the far ladder must be climbed before it is back. Counts are
   tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { playLevel } = require('./play.js');

const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const TRAPDOOR_FALL_SECONDS = 1.3;
const SHORTCUT_FALL_SECONDS = { landscape: 1.5, portrait: 2.4 };
/* The death screen stays 1.4 s before the life is taken. */
const DEATH_SECONDS = 1.6;
/* Long enough for the guard to come back, walk to the far ladder and climb
   down it, and for the level to start again after the death. */
const GUARD_RETURN_SECONDS = 12;

function downTheTrapdoor(play) {
  play.walk(LEFT, 2);
  play.run(TRAPDOOR_FALL_SECONDS);
}

const TO_THE_FAR_LADDER = {
  landscape(play) {
    play.walk(RIGHT, 16);
    play.climb(UP, 1);
    play.walk(RIGHT, 3);
  },
  portrait(play) {
    play.walk(RIGHT, 9);
    play.climb(UP, 1);
    play.walk(RIGHT, 3);
  },
};

const UP_AND_OUT = {
  landscape(play) {
    play.climb(UP, 9);
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
  },
  portrait(play) {
    play.climb(UP, 10);
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
  },
};

const TOWARD_THE_KEY = { landscape: 6, portrait: 1 };

for (const shape of ['landscape', 'portrait']) {
  test(`level 4 ${shape}: falling through the plank over stone, walking the bridge to the key and climbing out while the released guard drowns clears the level at revision 2 with no life lost`, () => {
    // given
    const play = playLevel(4, shape);

    // when
    downTheTrapdoor(play);
    TO_THE_FAR_LADDER[shape](play);
    UP_AND_OUT[shape](play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: 4, revision: 2, shape });
    assert.equal(play.lives(), 3);
  });

  test(`level 4 ${shape}: walking off the ledge toward the key falls through the planks into the water and costs a life`, () => {
    // given
    const play = playLevel(4, shape);

    // when
    play.walk(RIGHT, TOWARD_THE_KEY[shape]);
    play.run(SHORTCUT_FALL_SECONDS[shape]);
    const titleAfterFall = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterFall, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 4 ${shape}: waiting at the foot of the far ladder lets the guard come back down it and costs a life`, () => {
    // given
    const play = playLevel(4, shape);

    // when
    downTheTrapdoor(play);
    TO_THE_FAR_LADDER[shape](play);
    play.run(GUARD_RETURN_SECONDS);

    // then
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}
