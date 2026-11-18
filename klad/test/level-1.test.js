'use strict';
/* Level 1 played through in both shapes with the guard active, on the real
   page scripts (test/play.js). The guard waits at the stone end of its room,
   right above a brick. The key is in that room, and the only way in is a
   drop onto the guard's tile, so the guard must be walled up first: by a
   shot from the top of the ladder that ends beside that brick. There is no
   wait after the shot: the way round to the drop takes longer than the
   brick takes to grow back (4.2 s), so even the quickest player lands on a
   walled-up guard. Counts are tiles. */
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

const TO_THE_ROOM = {
  landscape(play, shouldWallUp) {
    play.walk(RIGHT, 5);
    play.climb(UP, 2);
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
    play.walk(RIGHT, 4);
    play.climb(UP, 1);
    if (shouldWallUp) play.shoot();
    play.climb(DOWN, 1);
    play.walk(LEFT, 2);
    play.climb(UP, 2);
    play.walk(LEFT, 8);
    play.climb(UP, 2);
    play.walk(RIGHT, 11);
    play.run(DROP_SECONDS);
  },
  portrait(play, shouldWallUp) {
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
    play.walk(LEFT, 4);
    play.climb(UP, 2);
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
    play.walk(RIGHT, 2);
    play.climb(UP, 1);
    if (shouldWallUp) play.shoot();
    play.climb(DOWN, 1);
    play.walk(LEFT, 9);
    play.climb(UP, 2);
    play.walk(RIGHT, 5);
    play.climb(UP, 2);
    play.walk(RIGHT, 5);
    play.run(DROP_SECONDS);
  },
};

const TO_THE_EXIT = {
  landscape(play) {
    play.walk(RIGHT, 6);
    play.walk(LEFT, 2);
    play.climb(UP, 2);
    play.walk(LEFT, 2);
    play.climb(UP, 2);
    play.walk(RIGHT, 6);
    play.climb(UP, 2);
  },
  portrait(play) {
    play.walk(RIGHT, 3);
    play.walk(LEFT, 1);
    play.climb(UP, 6);
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
  },
};

for (const shape of ['landscape', 'portrait']) {
  test(`level 1 ${shape}: walling up the guard from the ladder below its room, then dropping in, clears the level at revision 2 with no life lost`, () => {
    // given
    const play = playLevel(1, shape);

    // when
    TO_THE_ROOM[shape](play, true);
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
    TO_THE_ROOM[shape](play, false);
    const titleAfterDrop = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterDrop, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}
