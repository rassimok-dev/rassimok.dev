'use strict';
/* Level 2 played through in both shapes with the guards active, on the real
   page scripts (test/play.js). The key lies sealed in a brick room on the
   lowest shelf, and the two guards work below it, each under the runner's
   column. Their one ladder up comes out between the runner's ladder down and
   the key room, so crossing that column on the shelf brings them up behind
   the runner. Shooting the key room open, taking the key and shooting out the
   far side at once stays ahead of them; the far side leads to the only
   ladder to the exit. Counts are tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { playLevel } = require('./play.js');

const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
/* The guards reach a runner stopped at the sealed key room after about
   1.3 s in landscape and 0.9 s in portrait, and one waiting in the open key
   room after about 1.9 s and 1.5 s; the death screen then stays 1.4 s. */
const WAIT_AT_THE_WALL_SECONDS = 2;
const WAIT_IN_THE_ROOM_SECONDS = 2.6;
const DEATH_SECONDS = 1.6;

/* From the start through the brick rooms on the way down to the key. A
   walk into a brick only turns the runner to face it for the shot. */
const TO_THE_KEY = {
  landscape(play, shouldOpenKeyRoom) {
    play.walk(RIGHT, 2);
    play.shoot();
    play.walk(RIGHT, 2);
    play.shoot();
    play.walk(RIGHT, 4);
    play.climb(DOWN, 3);
    play.walk(LEFT, 5);
    play.climb(DOWN, 3);
    play.walk(RIGHT, 11);
    if (shouldOpenKeyRoom) play.shoot();
    play.walk(RIGHT, 2);
  },
  portrait(play, shouldOpenKeyRoom) {
    play.walk(RIGHT, 1);
    play.shoot();
    play.walk(RIGHT, 2);
    play.shoot();
    play.walk(RIGHT, 3);
    play.climb(DOWN, 3);
    play.walk(LEFT, 3);
    play.climb(DOWN, 3);
    play.walk(RIGHT, 1);
    play.shoot();
    play.walk(RIGHT, 2);
    play.shoot();
    play.walk(RIGHT, 2);
    play.climb(DOWN, 3);
    play.walk(LEFT, 5);
    play.climb(DOWN, 3);
    play.walk(RIGHT, 7);
    if (shouldOpenKeyRoom) play.shoot();
    play.walk(RIGHT, 2);
  },
};

const TO_THE_EXIT = {
  landscape(play) {
    play.shoot();
    play.walk(RIGHT, 3);
    play.climb(UP, 6);
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
  },
  portrait(play) {
    play.shoot();
    play.walk(RIGHT, 2);
    play.climb(UP, 12);
    play.walk(RIGHT, 1);
    play.climb(UP, 2);
  },
};

for (const shape of ['landscape', 'portrait']) {
  test(`level 2 ${shape}: shooting the key out of its brick room and going on at once clears the level at revision 2 with no life lost`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    TO_THE_KEY[shape](play, true);
    TO_THE_EXIT[shape](play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: 2, revision: 2, shape });
    assert.equal(play.lives(), 3);
  });

  test(`level 2 ${shape}: the same way without the shot at the key room leaves the key sealed, and the guards come up behind the runner and cost a life`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    TO_THE_KEY[shape](play, false);
    const isKeyHiddenAtTheWall = play.elements['h-key'].hidden;
    play.run(WAIT_AT_THE_WALL_SECONDS);
    const titleAtTheWall = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(isKeyHiddenAtTheWall, true);
    assert.equal(titleAtTheWall, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 2 ${shape}: waiting in the open key room lets a guard in through the hole and costs a life`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    TO_THE_KEY[shape](play, true);
    play.run(WAIT_IN_THE_ROOM_SECONDS);
    const titleInTheRoom = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleInTheRoom, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}
