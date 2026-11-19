'use strict';
/* Level 7 played in both shapes with the guard active, on the real page
   scripts (test/play.js). The key lies at the far end of a treasure room
   whose one way in is a ladder down from the guard's hall, and the runner
   gets into the hall only by a drop from the walkway above it. Under the
   walkway the guard follows the runner's column and walks into any gap on
   the way; the hall has one, a pit at its far end. A runner who drops in
   while the guard is in the hall is followed down into the room and caught
   there. Standing over the pit's end of the walkway until the guard has
   fallen in leaves the room free. Counts are tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const LEVELS = require('../levels.js');
const { playLevel } = require('./play.js');

const LEVEL_NUMBER = LEVELS.findIndex((level) => level.name === 'уведи хранителя') + 1;
const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
/* Long enough for the guard to come along under the walkway and fall in. */
const LURE_SECONDS = 2;
/* Long enough for the guard to come along under the runner's column. */
const GUARD_ARRIVAL_SECONDS = 1.5;
const DROP_SECONDS = 0.3;
/* The guard meets a runner turning back from the key within about 0.7 s;
   the death screen then stays 1.4 s. */
const TURN_BACK_SECONDS = 1;
const DEATH_SECONDS = 1.6;

const TO_THE_WALKWAY = {
  landscape(play) {
    play.walk(LEFT, 2);
    play.climb(DOWN, 2);
  },
  portrait(play) {
    play.walk(RIGHT, 8);
    play.climb(DOWN, 2);
    play.walk(LEFT, 8);
    play.climb(DOWN, 2);
    play.walk(RIGHT, 8);
    play.climb(DOWN, 2);
    play.walk(LEFT, 8);
    play.climb(DOWN, 2);
  },
};
/* From where the ladder meets the walkway. */
const TO_THE_PIT_END = { landscape: 3, portrait: 2 };
const TO_THE_DROP = { landscape: 14, portrait: 9 };
const ROOM_DEPTH = 8;
const ROOM_LENGTH = { landscape: 11, portrait: 9 };
const EXIT_LADDER = { landscape: 6, portrait: 12 };

function dropIntoTheRoomToTheKey(play, shape, tilesToTheDrop) {
  play.walk(RIGHT, tilesToTheDrop);
  play.run(DROP_SECONDS);
  play.climb(DOWN, ROOM_DEPTH);
  play.walk(LEFT, ROOM_LENGTH[shape]);
}

function outOfTheRoomToTheExit(play, shape) {
  play.walk(RIGHT, ROOM_LENGTH[shape]);
  play.climb(UP, ROOM_DEPTH);
  play.walk(RIGHT, 2);
  play.climb(UP, EXIT_LADDER[shape]);
}

for (const shape of ['landscape', 'portrait']) {
  test(`level ${LEVEL_NUMBER} ${shape}: leading the guard into the pit at the far end of its hall, then emptying the treasure room clears the level at revision 1 with no life lost`, () => {
    // given
    const play = playLevel(LEVEL_NUMBER, shape);

    // when
    TO_THE_WALKWAY[shape](play);
    play.walk(LEFT, TO_THE_PIT_END[shape]);
    play.run(LURE_SECONDS);
    dropIntoTheRoomToTheKey(play, shape, TO_THE_PIT_END[shape] + TO_THE_DROP[shape]);
    outOfTheRoomToTheExit(play, shape);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: LEVEL_NUMBER, revision: 1, shape });
    assert.equal(play.lives(), 3);
  });

  test(`level ${LEVEL_NUMBER} ${shape}: dropping into the hall with the guard in it lets the guard follow the runner into the treasure room, where it catches the runner turning back with the key and costs a life`, () => {
    // given
    const play = playLevel(LEVEL_NUMBER, shape);

    // when
    TO_THE_WALKWAY[shape](play);
    dropIntoTheRoomToTheKey(play, shape, TO_THE_DROP[shape]);
    const isKeyHiddenAtTheKey = play.elements['h-key'].hidden;
    play.hold(RIGHT, TURN_BACK_SECONDS);
    const titleOnTheWayBack = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(isKeyHiddenAtTheKey, false);
    assert.equal(titleOnTheWayBack, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level ${LEVEL_NUMBER} ${shape}: leading the guard only to the edge of the pit is not enough, it still follows the runner into the treasure room and costs a life`, () => {
    // given
    const play = playLevel(LEVEL_NUMBER, shape);

    // when
    TO_THE_WALKWAY[shape](play);
    play.walk(LEFT, TO_THE_PIT_END[shape] - 1);
    play.run(GUARD_ARRIVAL_SECONDS);
    dropIntoTheRoomToTheKey(play, shape, TO_THE_PIT_END[shape] - 1 + TO_THE_DROP[shape]);
    const isKeyHiddenAtTheKey = play.elements['h-key'].hidden;
    play.hold(RIGHT, TURN_BACK_SECONDS);
    const titleOnTheWayBack = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(isKeyHiddenAtTheKey, false);
    assert.equal(titleOnTheWayBack, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}
