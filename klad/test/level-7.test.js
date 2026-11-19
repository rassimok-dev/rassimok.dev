'use strict';
/* Level 7 played in both shapes with the guard active, on the real page
   scripts (test/play.js). The treasure room has one way in, a ladder up
   from the hall under it, and inside only dead ends, so a guard that comes
   in cannot be passed. The guard drops from its corner into the far end
   of the hall and follows the runner's column; whenever the runner is in
   the room it comes up that ladder after them, or waits under it for them
   to come out. A notch at the far end of the hall holds the guard for
   good: walking along the walkway below the hall to its far end, where
   nothing else lies, leads the guard into it. The only way up to the hall
   is the long ladder at the left edge, and the hall's floor reaches it, so
   a guard following a runner at the start stops above them on solid
   ground instead of coming down to the water. The notch's west wall is
   stone, so a runner who gets into the notch ahead of the guard cannot
   shoot a way out beside it and wall the guard up there. In portrait its
   floor is stone too, so no shot along the row under the hall walls the
   lured guard in below it and leaves the notch to the runner, shut in.
   Counts are tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { playLevel } = require('./play.js');
const LEVELS = require('../levels.js');

/* The level is found by name, so its tests follow it if its place changes. */
const LEVEL = LEVELS.findIndex((level) => level.name === 'уведи хранителя') + 1;
const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
/* The guard, following above, stands in the notch about 0.9 s
   (landscape) or 0.7 s (portrait) after the runner reaches the far end. */
const LURE_SECONDS = 1.5;
/* One tile short of the far end the guard stands above the runner. */
const SHORT_OF_THE_END_SECONDS = 2;
/* The death screen stays 1.4 s before the life is taken. */
const DEATH_SECONDS = 1.6;
/* The guard stands still above the start about 8.7 s (landscape) or 5.8 s
   (portrait) into the level. */
const START_WAIT_SECONDS = 15;
/* Waiting on the long ladder while the guard walks this many tiles brings
   it close: in landscape it follows the runner up, in portrait it waits on
   the room's ladder level with them (at every guardSpeed from 3.0 to 4.2). */
const GUARD_TILES_TO_THE_LADDER = 24;
const GUARD_SPEED = LEVELS[LEVEL - 1].guardSpeed;
/* Off the end of the upper plank on the left down into the hall. */
const DROP_INTO_THE_HALL_SECONDS = 1.2;
/* A drop of one or two tiles. */
const SHORT_DROP_SECONDS = 0.3;
/* The guard, following, comes into the notch up to 4.5 s after the runner
   (guardSpeed 3.0). */
const GUARD_TO_THE_NOTCH_SECONDS = 5;
/* The room's chests and those on the way: the walkway's three and one by
   the exit in landscape, the walkway's two and one on the floor below it in
   portrait. */
const CHESTS_TAKEN = { landscape: 18 + 4, portrait: 16 + 3 };
/* A tap that turns the runner on the ladder and starts the step off it. */
const TAP_SECONDS = 0.05;
/* The fall off the long ladder to the bottom and the brick growing back. */
const BACK_DOWN_SECONDS = 8;

/* From the start onto the walkway below the hall. */
const TO_THE_WALKWAY = {
  landscape(play) {
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
    play.walk(RIGHT, 1);
  },
  portrait(play) {
    play.walk(RIGHT, 1);
    play.climb(UP, 2);
    play.walk(RIGHT, 1);
    play.climb(UP, 3);
    play.walk(RIGHT, 7);
    play.climb(UP, 5);
  },
};
const WALKWAY_TO_THE_FAR_END = { landscape: 24, portrait: 7 };

/* From the walkway, the given tiles from its start, up into the hall and
   up the ladder onto the room's floor. The way to the hall is back down to
   the start and up the long ladder. */
const WALKWAY_TO_THE_ROOM = {
  landscape(play, tiles) {
    play.walk(LEFT, tiles + 1);
    play.climb(DOWN, 2);
    play.walk(LEFT, 3);
    play.climb(UP, 5);
    play.walk(RIGHT, 8);
    play.climb(UP, 4);
  },
  portrait(play, tiles) {
    play.walk(LEFT, tiles);
    play.climb(DOWN, 5);
    play.walk(LEFT, 7);
    play.climb(DOWN, 3);
    play.walk(LEFT, 1);
    play.climb(DOWN, 2);
    play.walk(LEFT, 2);
    play.climb(UP, 14);
    play.walk(RIGHT, 4);
    play.climb(UP, 5);
  },
};

/* From the start up the long ladder to the hall. */
const START_TO_THE_HALL = {
  landscape(play) {
    play.walk(LEFT, 1);
    play.climb(UP, 5);
  },
  portrait(play) {
    play.walk(LEFT, 1);
    play.climb(UP, 14);
  },
};

/* Straight from the start into the room, the way that looks shortest. */
const START_TO_THE_ROOM = {
  landscape(play) {
    START_TO_THE_HALL.landscape(play);
    play.walk(RIGHT, 8);
    play.climb(UP, 4);
  },
  portrait(play) {
    START_TO_THE_HALL.portrait(play);
    play.walk(RIGHT, 4);
    play.climb(UP, 5);
  },
};

/* From the room's floor at the ladder up the shelves to the key at the far
   end, and from the key back down the ladder into the hall. */
const ROOM_TO_THE_KEY = {
  landscape(play) {
    play.walk(RIGHT, 4);
    play.climb(UP, 2);
    play.walk(RIGHT, 2);
    play.climb(UP, 2);
    play.walk(RIGHT, 3);
  },
  portrait(play) {
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
    play.walk(RIGHT, 3);
    play.climb(UP, 2);
    play.walk(RIGHT, 1);
  },
};
const KEY_TO_THE_WAY_OUT = {
  landscape(play) {
    play.walk(LEFT, 3);
    play.climb(DOWN, 2);
    play.walk(LEFT, 2);
    play.climb(DOWN, 2);
    play.walk(LEFT, 4);
    play.climb(DOWN, 4);
  },
  portrait(play) {
    play.walk(LEFT, 1);
    play.climb(DOWN, 2);
    play.walk(LEFT, 3);
    play.climb(DOWN, 2);
    play.walk(LEFT, 3);
    play.climb(DOWN, 5);
  },
};

/* Every chest in the room, from its floor at the ladder, then down the
   ladder into the hall. */
const EMPTY_THE_ROOM = {
  landscape(play) {
    play.walk(RIGHT, 9);
    play.walk(LEFT, 5);
    play.climb(UP, 2);
    play.walk(LEFT, 4);
    play.walk(RIGHT, 9);
    play.walk(LEFT, 3);
    play.climb(UP, 2);
    play.walk(RIGHT, 3);
    play.walk(LEFT, 3);
    play.climb(DOWN, 2);
    play.walk(LEFT, 2);
    play.climb(DOWN, 2);
    play.walk(LEFT, 4);
    play.climb(DOWN, 4);
  },
  portrait(play) {
    play.walk(RIGHT, 7);
    play.walk(LEFT, 4);
    play.climb(UP, 2);
    play.walk(LEFT, 3);
    play.walk(RIGHT, 7);
    play.walk(LEFT, 1);
    play.climb(UP, 2);
    play.walk(LEFT, 2);
    play.walk(RIGHT, 3);
    play.walk(LEFT, 1);
    play.climb(DOWN, 2);
    play.walk(LEFT, 3);
    play.climb(DOWN, 2);
    play.walk(LEFT, 3);
    play.climb(DOWN, 5);
  },
};

/* From the hall under the room to the long ladder, up it and through the
   door to the exit. */
const HALL_TO_THE_EXIT = {
  landscape(play) {
    play.walk(LEFT, 8);
    play.climb(UP, 10);
    play.walk(RIGHT, 4);
    play.climb(UP, 1);
  },
  portrait(play) {
    play.walk(LEFT, 4);
    play.climb(UP, 13);
    play.walk(RIGHT, 3);
    play.climb(UP, 1);
  },
};

for (const shape of ['landscape', 'portrait']) {
  test(`level ${LEVEL} ${shape}: leading the guard along the walkway to its far end, where the guard drops into the notch of its hall, then emptying the treasure room clears the level at revision 1 with no life lost`, () => {
    // given
    const play = playLevel(LEVEL, shape);

    // when
    TO_THE_WALKWAY[shape](play);
    play.walk(RIGHT, WALKWAY_TO_THE_FAR_END[shape]);
    play.run(LURE_SECONDS);
    WALKWAY_TO_THE_ROOM[shape](play, WALKWAY_TO_THE_FAR_END[shape]);
    EMPTY_THE_ROOM[shape](play);
    HALL_TO_THE_EXIT[shape](play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape, chests } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape, chests }, { level: LEVEL, revision: 1, shape, chests: CHESTS_TAKEN[shape] });
    assert.equal(play.lives(), 3);
  });

  test(`level ${LEVEL} ${shape}: going straight into the treasure room with the guard in its hall, the guard comes up the one ladder and catches the runner on the way out with the key, which costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shape);

    // when
    START_TO_THE_ROOM[shape](play);
    ROOM_TO_THE_KEY[shape](play);
    const isKeyShownAtTheKey = !play.elements['h-key'].hidden;
    KEY_TO_THE_WAY_OUT[shape](play);
    play.run(DEATH_SECONDS);

    // then
    assert.equal(isKeyShownAtTheKey, true);
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level ${LEVEL} ${shape}: waiting one tile short of the walkway's far end leaves the guard in its hall above the runner, and it catches the runner on the way up to the room`, () => {
    // given
    const play = playLevel(LEVEL, shape);
    const shortOfTheEnd = WALKWAY_TO_THE_FAR_END[shape] - 1;

    // when
    TO_THE_WALKWAY[shape](play);
    play.walk(RIGHT, shortOfTheEnd);
    play.run(SHORT_OF_THE_END_SECONDS);
    WALKWAY_TO_THE_ROOM[shape](play, shortOfTheEnd);
    play.run(DEATH_SECONDS);

    // then
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level ${LEVEL} ${shape}: waiting on the start tile leaves the guard alive, standing in its hall above the start, and it catches the runner on the long ladder up to the hall, the only way to the room`, () => {
    // given
    const play = playLevel(LEVEL, shape);

    // when
    play.run(START_WAIT_SECONDS);
    const livesAfterTheWait = play.lives();
    START_TO_THE_HALL[shape](play);
    play.run(DEATH_SECONDS);

    // then
    assert.equal(livesAfterTheWait, 3);
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}

test(`level ${LEVEL} landscape: dropping into the hall ahead of the guard off the upper plank and running into the notch, the runner can shoot no way out beside it to wall the guard up there, and the guard follows them in and catches them, which costs a life`, () => {
  // given
  const play = playLevel(LEVEL, 'landscape');

  // when
  START_TO_THE_HALL.landscape(play);
  play.run(GUARD_TILES_TO_THE_LADDER / GUARD_SPEED);
  play.climb(UP, 6);
  play.walk(RIGHT, 6);
  play.run(DROP_INTO_THE_HALL_SECONDS);
  play.walk(RIGHT, 22);
  play.run(SHORT_DROP_SECONDS);
  const livesInTheNotch = play.lives();
  const isDeathShownInTheNotch = !play.elements.msg.hidden;
  play.walk(LEFT, 1);
  play.shoot();
  play.walk(LEFT, 1);
  play.run(GUARD_TO_THE_NOTCH_SECONDS + DEATH_SECONDS);

  // then
  assert.equal(livesInTheNotch, 3);
  assert.equal(isDeathShownInTheNotch, false);
  assert.equal(play.lives(), 2);
  assert.deepEqual(play.events, []);
});

test(`level ${LEVEL} portrait: stepping off the long ladder into the hall while the guard waits on the room's ladder level with the runner, the guard comes down that ladder in front of them and catches them on the way to the notch, which costs a life`, () => {
  // given
  const play = playLevel(LEVEL, 'portrait');

  // when
  START_TO_THE_HALL.portrait(play);
  play.climb(UP, 2);
  play.run(GUARD_TILES_TO_THE_LADDER / GUARD_SPEED);
  play.walk(RIGHT, 1);
  play.run(SHORT_DROP_SECONDS);
  const livesInTheHall = play.lives();
  const isDeathShownInTheHall = !play.elements.msg.hidden;
  play.walk(RIGHT, 3);
  play.run(DEATH_SECONDS);

  // then
  assert.equal(livesInTheHall, 3);
  assert.equal(isDeathShownInTheHall, false);
  assert.equal(play.lives(), 2);
  assert.deepEqual(play.events, []);
});

test(`level ${LEVEL} portrait: with the guard lured into the notch, a shot from the long ladder along the row under the hall opens nothing under the notch, so a runner who then walks into the notch meets the guard there instead of being shut in alone, which costs a life`, () => {
  // given
  const play = playLevel(LEVEL, 'portrait');

  // when
  TO_THE_WALKWAY.portrait(play);
  play.walk(RIGHT, WALKWAY_TO_THE_FAR_END.portrait);
  play.run(LURE_SECONDS);
  play.walk(LEFT, WALKWAY_TO_THE_FAR_END.portrait);
  play.climb(DOWN, 5);
  play.walk(LEFT, 7);
  play.climb(DOWN, 3);
  play.walk(LEFT, 1);
  play.climb(DOWN, 2);
  play.walk(LEFT, 2);
  play.climb(UP, 12);
  play.hold(RIGHT, TAP_SECONDS);
  play.shoot();
  play.run(BACK_DOWN_SECONDS);
  play.walk(LEFT, 1);
  play.climb(UP, 14);
  play.walk(RIGHT, 17);
  play.run(SHORT_DROP_SECONDS + DEATH_SECONDS);

  // then
  assert.equal(play.lives(), 2);
  assert.deepEqual(play.events, []);
});
