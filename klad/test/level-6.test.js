'use strict';
/* Level 6 played in both shapes with the guards active, on the real page
   scripts (test/play.js). Two tall brick columns stand between three shafts.
   The runner starts at the foot of the left shaft, the key lies beyond both
   columns, and the exit is at the top of the left shaft, behind the door.
   Each guard starts at the top of the next shaft and climbs its ladder to the
   runner's row, so a column broken at a row that ladder reaches lets the
   guard through. Lower down, the far side has a ladder only on the rows just
   below the guard's ledge; a column broken any lower drops the runner into
   the small pool at the column's foot. Counts are tiles, rows count from the
   top. */
const test = require('node:test');
const assert = require('node:assert/strict');
const KLAD_LEVELS = require('../levels.js');
const { playLevel } = require('./play.js');

/* Found by name, so the test holds wherever the level sits in the list. */
const LEVEL = KLAD_LEVELS.findIndex((level) => level.name === 'выбери высоту') + 1;

const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
/* The death screen stays 1.4 s before the life is taken. */
const DEATH_SECONDS = 1.6;
const FALL_SECONDS = 0.8;
/* Long enough for a guard to come down to the runner's row, if it could. */
const WAIT_SECONDS = 4;

/* Rows of each shape: where each column is broken on the way to the key,
   the row of the pool below that, and the row of the guard behind it. */
const ROWS = {
  landscape: { first: 9, belowFirst: 10, firstGuard: 6, second: 11, secondGuard: 9 },
  portrait: { first: 15, belowFirst: 16, firstGuard: 12, second: 18, secondGuard: 16 },
};

/* Two bricks: a shot opens the nearer one, a step goes in, a second shot
   opens the other. A walk into a brick only turns the runner to face it. */
function breakThrough(play, direction, shouldShoot = true) {
  if (shouldShoot) play.shoot();
  play.walk(direction, 1);
  if (shouldShoot) play.shoot();
  play.walk(direction, 2);
}

/* From the start up the first ladder to the row, and through the first column. */
const INTO_THE_MIDDLE_SHAFT = {
  landscape(play, row, shouldShoot = true) {
    play.walk(RIGHT, 4);
    play.climb(UP, 14 - row);
    breakThrough(play, RIGHT, shouldShoot);
  },
  portrait(play, row, shouldShoot = true) {
    play.walk(RIGHT, 2);
    play.climb(UP, 22 - row);
    breakThrough(play, RIGHT, shouldShoot);
  },
};

/* Across the middle shaft, down its far ladder to the row, through the
   second column and along to the key. */
const ON_TO_THE_KEY = {
  landscape(play, row, shouldShoot = true) {
    play.walk(RIGHT, 5);
    if (row > 9) play.climb(DOWN, row - 9);
    breakThrough(play, RIGHT, shouldShoot);
    play.walk(RIGHT, 4);
  },
  portrait(play, row, shouldShoot = true) {
    play.walk(RIGHT, 3);
    play.climb(DOWN, row - 15);
    breakThrough(play, RIGHT, shouldShoot);
    play.walk(RIGHT, 3);
  },
};

/* Back through the second column while its holes are still open, through
   the first one again (its holes have grown back), and up to the exit. */
const BACK_TO_THE_EXIT = {
  landscape(play) {
    play.walk(LEFT, 4);
    play.walk(LEFT, 3);
    play.climb(UP, 2);
    play.walk(LEFT, 5);
    breakThrough(play, LEFT);
    play.climb(UP, 7);
    play.walk(LEFT, 4);
    play.climb(UP, 2);
  },
  portrait(play) {
    play.walk(LEFT, 3);
    play.walk(LEFT, 3);
    play.climb(UP, 3);
    play.walk(LEFT, 3);
    breakThrough(play, LEFT);
    play.climb(UP, 13);
    play.walk(LEFT, 2);
    play.climb(UP, 2);
  },
};

for (const shape of ['landscape', 'portrait']) {
  const rows = ROWS[shape];

  test(`level 6 ${shape}: breaking through both columns on the rows just below the guards, taking the key and climbing out clears the level at revision 1 with no life lost`, () => {
    // given
    const play = playLevel(LEVEL, shape);

    // when
    INTO_THE_MIDDLE_SHAFT[shape](play, rows.first);
    ON_TO_THE_KEY[shape](play, rows.second);
    BACK_TO_THE_EXIT[shape](play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: LEVEL, revision: 1, shape });
    assert.equal(play.lives(), 3);
  });

  test(`level 6 ${shape}: the same way without the shots keeps the runner in the start shaft, away from the key`, () => {
    // given
    const play = playLevel(LEVEL, shape);

    // when
    INTO_THE_MIDDLE_SHAFT[shape](play, rows.first, false);
    ON_TO_THE_KEY[shape](play, rows.second, false);
    play.run(WAIT_SECONDS);

    // then
    assert.equal(play.elements['h-key'].hidden, true);
    assert.equal(play.lives(), 3);
    assert.deepEqual(play.events, []);
  });

  test(`level 6 ${shape}: breaking through the first column one row lower drops the runner into the pool at its foot and costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shape);

    // when
    INTO_THE_MIDDLE_SHAFT[shape](play, rows.belowFirst);
    play.run(FALL_SECONDS);
    const titleAfterFall = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterFall, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 6 ${shape}: breaking through the first column on a row its guard's ladder reaches lets the guard through and costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shape);

    // when
    INTO_THE_MIDDLE_SHAFT[shape](play, rows.firstGuard);
    const titleAtTheColumn = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAtTheColumn, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 6 ${shape}: breaking through the second column on a row its guard's ladder reaches lets the guard through and costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shape);

    // when
    INTO_THE_MIDDLE_SHAFT[shape](play, rows.first);
    ON_TO_THE_KEY[shape](play, rows.secondGuard);
    const titleAtTheColumn = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAtTheColumn, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}
