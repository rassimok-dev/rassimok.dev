'use strict';
/* Level 6 played in both shapes with the guards active, on the real page
   scripts (test/play.js). Two brick columns, one tile wide, stand between
   the runner and the key. Behind each one a guard comes down a ladder that
   hugs the column, as far as the brick shelf at the ladder's foot, closed by
   a stone block. Under the shelf a plank walkway leads on, and under the
   walkway a small pool lies on a ledge. So each column has one row that is
   safe to break: the walkway's. Higher up the guard walks through the hole,
   or the runner ends in the guard's pocket; lower down the runner falls into
   the pool. The key lies past both columns and the exit behind a door beyond
   it. Counts are tiles, rows count from the top. */
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
const DEATH_TITLE = 'ПОГИБ';
/* The death screen stays 1.4 s before the life is taken. */
const DEATH_SECONDS = 1.6;
const FALL_SECONDS = 0.8;
/* Long enough for a guard to come down its ladder to the runner's row. */
const GUARD_SECONDS = 3;
const STEP_SECONDS = 0.1;

function climbFromTo(play, fromRow, toRow) {
  if (toRow < fromRow) play.climb(UP, fromRow - toRow);
  if (toRow > fromRow) play.climb(DOWN, toRow - fromRow);
}

/* One shot opens the brick ahead, and a step goes into the hole. A walk into
   a brick only turns the runner to face it. */
function breakThrough(play, shouldShoot) {
  if (shouldShoot) play.shoot();
  play.walk(RIGHT, 1);
}

/* Runs until the death screen shows, at most the given seconds. */
function titleWithin(play, seconds) {
  for (let elapsed = 0; elapsed < seconds && play.title() !== DEATH_TITLE; elapsed += STEP_SECONDS) {
    play.run(STEP_SECONDS);
  }
  return play.title();
}

function fetchChest(play, direction, tiles) {
  play.walk(direction, tiles);
  play.walk(direction === RIGHT ? LEFT : RIGHT, tiles);
}

/* Per shape: the rows of each column (the walkway's, one the guard's ladder
   reaches, one above the pool; in portrait also the floor of the first
   guard's pocket), and the ways: from the start to the first column, from
   inside its hole to the second, in portrait from the pocket's end to the
   second as if the stone there were brick, past the second to the key, from
   the key out, and from the start to the exit by every chest. */
const SHAPES = {
  landscape: {
    first: { walkway: 10, guard: 8, pool: 12 },
    second: { walkway: 7, guard: 5, pool: 9 },
    toTheFirstColumn(play, row) {
      play.walk(RIGHT, 4);
      play.climb(UP, 16 - row);
    },
    toTheSecondColumn(play, firstRow, row) {
      play.walk(RIGHT, 6);
      climbFromTo(play, firstRow, row);
    },
    onToTheKey(play) {
      play.walk(RIGHT, 9);
      play.climb(DOWN, 9);
      play.walk(LEFT, 1);
    },
    /* Through the door and up the staircase of short ladders. */
    outToTheExit(play) {
      play.walk(RIGHT, 6);
      for (const direction of [RIGHT, LEFT, RIGHT, LEFT, RIGHT]) {
        play.climb(UP, 3);
        play.walk(direction, 1);
      }
      play.climb(UP, 1);
    },
    /* The stack beside the start ladder, under the first column's pool, the
       shelf past the second column, beside the water trap, the key, and
       halfway up the exit staircase. */
    everyChest(play) {
      play.walk(RIGHT, 4);
      for (const rows of [3, 3, 4]) {
        play.climb(UP, rows);
        fetchChest(play, LEFT, 2);
      }
      play.climb(DOWN, 4);
      breakThrough(play, true);
      play.walk(RIGHT, 6);
      play.climb(DOWN, 6);
      fetchChest(play, LEFT, 3);
      play.climb(UP, 9);
      breakThrough(play, true);
      play.walk(RIGHT, 6);
      play.climb(DOWN, 4);
      fetchChest(play, LEFT, 2);
      play.climb(UP, 4);
      play.walk(RIGHT, 3);
      play.climb(DOWN, 5);
      fetchChest(play, RIGHT, 1);
      play.climb(DOWN, 4);
      play.walk(LEFT, 1);
      play.walk(RIGHT, 6);
      play.climb(UP, 3);
      play.walk(RIGHT, 1);
      play.climb(UP, 3);
      fetchChest(play, RIGHT, 1);
      play.walk(LEFT, 1);
      for (const direction of [RIGHT, LEFT, RIGHT]) {
        play.climb(UP, 3);
        play.walk(direction, 1);
      }
      play.climb(UP, 1);
    },
  },
  portrait: {
    first: { walkway: 23, guard: 18, pool: 25, pocket: 21 },
    second: { walkway: 19, guard: 17, pool: 21 },
    toTheFirstColumn(play, row) {
      play.walk(RIGHT, 1);
      play.climb(UP, 28 - row);
    },
    toTheSecondColumn(play, firstRow, row) {
      play.walk(RIGHT, 4);
      climbFromTo(play, firstRow, row);
    },
    fromThePocketToTheSecondColumn(play) {
      play.walk(RIGHT, 2);
      play.climb(UP, 2);
    },
    onToTheKey(play) {
      play.walk(RIGHT, 5);
      play.climb(UP, 8);
      play.walk(LEFT, 1);
    },
    /* Through the door beside the key and up the exit ladder. */
    outToTheExit(play) {
      play.walk(RIGHT, 4);
      play.climb(UP, 11);
    },
    /* First the chest at the top of the staircase beside the start, with a
       wait on its ledge: it lies no higher than the first column's top, so no
       guard leaves its ladder for the runner there. Then under both pools and
       up the stack beside the key ladder. */
    everyChest(play) {
      const staircase = [[3, RIGHT], [3, LEFT], [3, RIGHT], [2, LEFT]];
      play.walk(LEFT, 2);
      for (const [rows, direction] of staircase) {
        play.climb(UP, rows);
        play.walk(direction, 1);
      }
      play.run(GUARD_SECONDS);
      for (const [rows, direction] of staircase.reverse()) {
        play.walk(direction === RIGHT ? LEFT : RIGHT, 1);
        play.climb(DOWN, rows);
      }
      play.walk(RIGHT, 2);
      this.toTheFirstColumn(play, this.first.walkway);
      breakThrough(play, true);
      play.walk(RIGHT, 4);
      play.climb(DOWN, 5);
      fetchChest(play, LEFT, 2);
      play.climb(UP, 9);
      breakThrough(play, true);
      play.walk(RIGHT, 5);
      play.climb(DOWN, 9);
      fetchChest(play, LEFT, 3);
      for (const rows of [3, 4, 4]) {
        play.climb(UP, rows);
        fetchChest(play, RIGHT, 2);
      }
      play.climb(UP, 6);
      play.walk(LEFT, 1);
      this.outToTheExit(play);
    },
  },
};

/* Through the first column on its walkway row and on to the second column
   at the given row. */
function pastTheFirstColumn(play, shape, row, shouldShoot = true) {
  shape.toTheFirstColumn(play, shape.first.walkway);
  breakThrough(play, shouldShoot);
  shape.toTheSecondColumn(play, shape.first.walkway, row);
}

for (const [shapeName, shape] of Object.entries(SHAPES)) {
  test(`level 6 ${shapeName}: breaking through both columns on their walkway rows, taking the key and climbing out clears the level at revision 1 with no life lost`, () => {
    // given
    const play = playLevel(LEVEL, shapeName);

    // when
    pastTheFirstColumn(play, shape, shape.second.walkway);
    breakThrough(play, true);
    shape.onToTheKey(play);
    shape.outToTheExit(play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: LEVEL, revision: 1, shape: shapeName });
    assert.equal(play.lives(), 3);
  });

  test(`level 6 ${shapeName}: taking every chest on the way out clears the level with all eight and no life lost`, () => {
    // given
    const play = playLevel(LEVEL, shapeName);

    // when
    shape.everyChest(play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { chests, chestsTotal } = play.details[0];
    assert.deepEqual({ chests, chestsTotal }, { chests: 8, chestsTotal: 8 });
    assert.equal(play.lives(), 3);
  });

  test(`level 6 ${shapeName}: the same way without the shots never reaches the key`, () => {
    // given
    const play = playLevel(LEVEL, shapeName);

    // when
    pastTheFirstColumn(play, shape, shape.second.walkway, false);
    breakThrough(play, false);
    shape.onToTheKey(play);
    play.run(GUARD_SECONDS);

    // then
    assert.equal(play.elements['h-key'].hidden, true);
    assert.equal(play.lives(), 3);
    assert.deepEqual(play.events, []);
  });

  test(`level 6 ${shapeName}: breaking the first column on a row its guard's ladder reaches lets the guard through and costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shapeName);

    // when
    shape.toTheFirstColumn(play, shape.first.guard);
    play.shoot();
    const titleOnTheLadder = titleWithin(play, GUARD_SECONDS);
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleOnTheLadder, DEATH_TITLE);
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 6 ${shapeName}: breaking the first column below its walkway drops the runner into the small pool and costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shapeName);

    // when
    shape.toTheFirstColumn(play, shape.first.pool);
    breakThrough(play, true);
    play.walk(RIGHT, 1);
    const titleAfterTheFall = titleWithin(play, FALL_SECONDS);
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterTheFall, DEATH_TITLE);
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 6 ${shapeName}: breaking the second column on a row its guard's ladder reaches lets the guard through and costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shapeName);

    // when
    pastTheFirstColumn(play, shape, shape.second.guard);
    play.shoot();
    const titleOnTheLadder = titleWithin(play, GUARD_SECONDS);
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleOnTheLadder, DEATH_TITLE);
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 6 ${shapeName}: breaking the second column below its walkway drops the runner into the small pool and costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shapeName);

    // when
    pastTheFirstColumn(play, shape, shape.second.pool);
    breakThrough(play, true);
    play.walk(RIGHT, 1);
    const titleAfterTheFall = titleWithin(play, FALL_SECONDS);
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterTheFall, DEATH_TITLE);
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}

/* Portrait only: in landscape the first guard waits at the foot of its short
   ladder before the runner reaches the pocket, so there the pocket's floor is
   the guard-row case above. */
test(`level 6 portrait: breaking the first column at once on the floor of its guard's pocket leads nowhere, the stone at the pocket's end holds, and the way on ends in a lost life without the key`, () => {
  // given
  const shape = SHAPES.portrait;
  const play = playLevel(LEVEL, 'portrait');

  // when
  shape.toTheFirstColumn(play, shape.first.pocket);
  breakThrough(play, true);
  play.walk(RIGHT, 2);
  play.shoot();
  shape.fromThePocketToTheSecondColumn(play);
  breakThrough(play, true);
  shape.onToTheKey(play);
  shape.outToTheExit(play);

  // then
  assert.equal(play.elements['h-key'].hidden, true);
  assert.equal(play.lives(), 2);
  assert.deepEqual(play.events, []);
});
