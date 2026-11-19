'use strict';
/* Level 1 played through in both shapes with the guard active, on the real
   page scripts (test/play.js). The guard is shut in the key's room and waits
   at its far end, under the only way in, a drop. A shot from the top of the
   ladder below that end walls it up. The way round to the drop takes longer
   than the brick takes to grow back (4.2 s), so the script does not wait.
   The key's room is left by shooting its other wall and dropping down the
   shaft behind it. Counts are tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { playLevel } = require('./play.js');

const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
const DROP_SECONDS = 0.3;
/* The death screen stays 1.4 s before the life is taken. */
const DEATH_SECONDS = 1.6;

const TO_THE_DROP = {
  landscape(play, shouldWallUp) {
    play.walk(RIGHT, 1);
    play.climb(UP, 3);
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
    play.walk(RIGHT, 3);
    play.climb(UP, 1);
    play.walk(RIGHT, 12);
    play.climb(UP, 2);
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
    play.walk(LEFT, 6);
    play.climb(UP, 1);
    if (shouldWallUp) play.shoot();
    play.climb(DOWN, 1);
    play.walk(RIGHT, 12);
    play.climb(UP, 2);
    play.walk(LEFT, 7);
    play.climb(UP, 2);
    play.walk(LEFT, 6);
    play.run(DROP_SECONDS);
  },
  portrait(play, shouldWallUp) {
    play.walk(RIGHT, 1);
    play.climb(UP, 2);
    play.walk(LEFT, 2);
    play.climb(UP, 2);
    play.walk(RIGHT, 6);
    play.climb(UP, 2);
    play.walk(RIGHT, 8);
    play.climb(UP, 2);
    play.walk(LEFT, 5);
    play.climb(UP, 2);
    play.walk(RIGHT, 4);
    play.climb(UP, 2);
    play.walk(LEFT, 9);
    play.climb(UP, 2);
    play.walk(RIGHT, 7);
    play.climb(UP, 2);
    play.walk(RIGHT, 6);
    play.climb(UP, 2);
    play.walk(LEFT, 4);
    play.climb(UP, 1);
    if (shouldWallUp) play.shoot();
    play.climb(DOWN, 1);
    play.walk(RIGHT, 4);
    play.climb(DOWN, 2);
    play.walk(LEFT, 9);
    play.climb(UP, 2);
    play.walk(LEFT, 8);
    play.climb(UP, 2);
    play.walk(RIGHT, 2);
    play.climb(UP, 4);
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
    play.walk(RIGHT, 7);
    play.climb(DOWN, 2);
    play.walk(RIGHT, 2);
    play.climb(DOWN, 2);
    play.walk(LEFT, 2);
    play.run(DROP_SECONDS);
  },
};

const TO_THE_EXIT = {
  landscape(play) {
    play.walk(LEFT, 6);
    play.shoot();
    play.walk(LEFT, 2);
    play.run(DROP_SECONDS);
    play.walk(RIGHT, 4);
    play.climb(DOWN, 2);
    play.walk(RIGHT, 11);
    play.climb(UP, 2);
    play.walk(RIGHT, 6);
    play.climb(UP, 2);
    play.walk(LEFT, 7);
    play.climb(UP, 2);
    play.walk(RIGHT, 6);
    play.climb(UP, 2);
  },
  portrait(play) {
    play.walk(LEFT, 6);
    play.shoot();
    play.walk(LEFT, 2);
    play.run(DROP_SECONDS);
    play.walk(LEFT, 4);
    play.climb(UP, 2);
    play.walk(RIGHT, 2);
    play.climb(UP, 4);
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
    play.walk(RIGHT, 11);
    play.climb(UP, 2);
  },
};

for (const shape of ['landscape', 'portrait']) {
  test(`level 1 ${shape}: walling up the guard from the ladder below its room, then dropping in, clears the level at revision 2 with no life lost`, () => {
    // given
    const play = playLevel(1, shape);

    // when
    TO_THE_DROP[shape](play, true);
    TO_THE_EXIT[shape](play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: 1, revision: 2, shape });
    assert.equal(play.lives(), 3);
  });

  test(`level 1 ${shape}: the same way without the shot drops the runner onto the guard and costs a life`, () => {
    // given
    const play = playLevel(1, shape);

    // when
    TO_THE_DROP[shape](play, false);
    const titleAfterDrop = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterDrop, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}
