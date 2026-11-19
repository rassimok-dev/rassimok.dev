'use strict';
/* Level 5 played in both shapes with the guards active, on the real page
   scripts (test/play.js). A shaft runs down from the start past sealed
   caches on both sides, and a guard on the ledge above comes down it after
   the runner. The key is sealed in brick at the foot of the shaft. The key
   also opens two pens over the way to the exit, and each pen's guard comes
   down behind the runner once the runner has passed under its ladder. The
   exit ladder climbs from behind the last door to the top. Counts are tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { playLevel } = require('./play.js');

const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
/* Measured on the scripted way: the guard from the ledge reaches a runner
   waiting in the cache after about 2.7 to 3 s, and one waiting at the sealed
   key after about 1.2 to 1.5 s; a pen's guard reaches a runner stopped under
   its ladder after about 1.1 s in landscape and 0.7 s in portrait. The death
   screen then stays 1.4 s. */
const WAIT_IN_THE_CACHE_SECONDS = 3.5;
const WAIT_AT_THE_KEY_SECONDS = 2;
const WAIT_UNDER_THE_PEN_SECONDS = 1.5;
const DEATH_SECONDS = 1.6;

const TO_THE_BOTTOM = { landscape: 9, portrait: 17 };
const EXIT_CLIMB = { landscape: 14, portrait: 22 };

/* The walk into the brick only turns the runner to face it for the shot. */
function openTheCacheRightOfTheShaft(play) {
  play.walk(RIGHT, 1);
  play.shoot();
  play.walk(RIGHT, 2);
}

function toTheCache(play) {
  play.walk(LEFT, 1);
  play.climb(DOWN, 3);
  openTheCacheRightOfTheShaft(play);
}

function toTheKey(play, shape, shouldShootTheKeyOpen) {
  toTheCache(play);
  play.walk(LEFT, 2);
  play.climb(DOWN, TO_THE_BOTTOM[shape]);
  if (shape === 'portrait') play.walk(LEFT, 1);
  if (shouldShootTheKeyOpen) play.shoot();
  play.walk(LEFT, 2);
}

/* From the key out through the far side of its cache, the run's caches and
   the first pen's door to the tile under that pen's ladder. */
const UNDER_THE_FIRST_PEN = {
  landscape(play) {
    play.shoot();
    play.walk(LEFT, 2);
    play.shoot();
    play.walk(LEFT, 2);
    play.shoot();
    play.walk(LEFT, 3);
  },
  portrait(play) {
    play.shoot();
    play.walk(LEFT, 3);
  },
};

const ON_TO_THE_EXIT = {
  landscape(play) {
    play.shoot();
    play.walk(LEFT, 2);
    play.shoot();
    play.walk(LEFT, 6);
  },
  portrait(play) {
    play.walk(LEFT, 1);
    play.shoot();
    play.walk(LEFT, 2);
    play.shoot();
    play.walk(LEFT, 4);
  },
};

for (const shape of ['landscape', 'portrait']) {
  test(`level 5 ${shape}: a cache beside the shaft, the key shot out of its cache and the run under the opened pens clear the level at revision 2 with no life lost`, () => {
    // given
    const play = playLevel(5, shape);

    // when
    toTheKey(play, shape, true);
    UNDER_THE_FIRST_PEN[shape](play);
    ON_TO_THE_EXIT[shape](play);
    play.climb(UP, EXIT_CLIMB[shape]);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: 5, revision: 2, shape });
    assert.equal(play.lives(), 3);
  });

  test(`level 5 ${shape}: the same way without the shot at the key leaves it sealed, and the guard that came down the shaft after the runner costs a life`, () => {
    // given
    const play = playLevel(5, shape);

    // when
    toTheKey(play, shape, false);
    const isKeyHiddenAtTheWall = play.elements['h-key'].hidden;
    play.run(WAIT_AT_THE_KEY_SECONDS);
    const titleAtTheWall = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(isKeyHiddenAtTheWall, true);
    assert.equal(titleAtTheWall, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 5 ${shape}: waiting in a cache beside the shaft lets the guard from the ledge come down and in, and costs a life`, () => {
    // given
    const play = playLevel(5, shape);

    // when
    toTheCache(play);
    play.run(WAIT_IN_THE_CACHE_SECONDS);
    const titleInTheCache = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleInTheCache, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 5 ${shape}: stopping under the ladder of a pen the key opened lets its guard down onto the runner and costs a life`, () => {
    // given
    const play = playLevel(5, shape);

    // when
    toTheKey(play, shape, true);
    UNDER_THE_FIRST_PEN[shape](play);
    const livesUnderThePen = play.lives();
    play.run(WAIT_UNDER_THE_PEN_SECONDS);
    const titleUnderThePen = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(livesUnderThePen, 3);
    assert.equal(titleUnderThePen, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}
