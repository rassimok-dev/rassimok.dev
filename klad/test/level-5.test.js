'use strict';
/* Level 5 played in both shapes with the guards active, on the real page
   scripts (test/play.js). Sealed caches stand on both sides of a shaft of
   two ladders with a gap between them and a pocket of water at its foot.
   Both guards start on a ledge over the left caches: while the runner is
   inside those caches they wait overhead, and whenever the runner is on the
   shaft or across it they come down its left ladder. A guard that reaches
   the runner's row with the gap in between steps into it and drowns, except
   on the rows a bridge crosses. So the runner opens the lower left caches, the
   key among them, with short stops on the ladder, crosses, lets the guards
   follow down into the pocket, and opens the cache strips on the right on
   the way to a door. Counts are tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { playLevel } = require('./play.js');

const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
/* Portrait: the guards come down after the runner one behind the other. The
   runner waits on a row they cannot cross to until both have stepped into
   the gap: after the first box on the right, and again after the key. The
   second wait leaves about half a second to spare on every step after it. */
const BOTH_GUARDS_DROP_SECONDS = { first: 0.7, second: 4.5 };
/* Measured on the scripted way: the guards reach a runner stopped on the
   shaft after about 4 s in landscape and 2.5 s in portrait. The death
   screen then stays 1.4 s. */
const STOP_ON_THE_SHAFT_SECONDS = { landscape: 4.6, portrait: 3 };
const DEATH_SECONDS = 1.6;
/* More than half of the chests on the scripted way. */
const CHESTS = {
  landscape: { chests: 24, chestsTotal: 32 },
  portrait: { chests: 21, chestsTotal: 29 },
};

/* From the start onto the guards' ladder. Landscape: along the floor to the
   shaft and through the bottom row of the left caches. Portrait: through
   the caches on the start floor and up to the lowest bridge. */
const ONTO_THE_SHAFT = {
  landscape(play) {
    play.walk(RIGHT, 12);
    play.climb(UP, 2);
    play.walk(LEFT, 3);
    play.shoot();
    play.walk(LEFT, 4);
    play.shoot();
    play.walk(LEFT, 3);
    play.walk(RIGHT, 10);
  },
  portrait(play) {
    play.shoot();
    play.walk(RIGHT, 3);
    play.shoot();
    play.walk(RIGHT, 2);
    play.shoot();
    play.walk(RIGHT, 2);
    play.climb(UP, 9);
  },
};

/* The walk into a brick wall only turns the runner to face it for the shot. */
const ON_TO_THE_EXIT = {
  landscape(play) {
    // the key row, over the bridge and down beside the pocket
    play.climb(UP, 2);
    play.walk(LEFT, 3);
    play.shoot();
    play.walk(LEFT, 4);
    play.shoot();
    play.walk(LEFT, 3);
    play.walk(RIGHT, 10);
    play.climb(UP, 1);
    play.walk(RIGHT, 3);
    play.climb(DOWN, 5);
    // the floor strip while the guards drown, then the lower bridge strip
    play.walk(RIGHT, 2);
    play.shoot();
    play.walk(RIGHT, 3);
    play.shoot();
    play.walk(RIGHT, 3);
    play.walk(LEFT, 8);
    play.climb(UP, 5);
    play.walk(RIGHT, 3);
    play.shoot();
    play.walk(RIGHT, 3);
    play.shoot();
    play.walk(RIGHT, 3);
    play.walk(LEFT, 9);
    // the upper bridge strip, through its door and up the exit ladder
    play.climb(UP, 6);
    play.walk(RIGHT, 1);
    for (let box = 0; box < 4; box++) {
      play.shoot();
      play.walk(RIGHT, 3);
    }
    play.climb(UP, 5);
  },
  portrait(play) {
    // across, down to the box on the lowest row and wait there
    play.walk(RIGHT, 2);
    play.climb(DOWN, 5);
    play.walk(RIGHT, 1);
    play.shoot();
    play.walk(RIGHT, 3);
    play.shoot();
    play.walk(RIGHT, 2);
    play.walk(LEFT, 5);
    play.run(BOTH_GUARDS_DROP_SECONDS.first);
    // back across, the key box and the box below it, then across and down
    play.climb(UP, 5);
    play.walk(LEFT, 2);
    play.climb(UP, 5);
    play.walk(LEFT, 1);
    play.shoot();
    play.walk(LEFT, 2);
    play.shoot();
    play.walk(LEFT, 3);
    play.walk(RIGHT, 5);
    play.climb(DOWN, 2);
    play.walk(LEFT, 1);
    play.shoot();
    play.walk(LEFT, 4);
    play.walk(RIGHT, 5);
    play.climb(DOWN, 3);
    play.walk(RIGHT, 2);
    play.climb(DOWN, 5);
    play.run(BOTH_GUARDS_DROP_SECONDS.second);
    // up the right ladder: the lower bridge strip and the box on top of it
    play.climb(UP, 5);
    play.walk(RIGHT, 1);
    play.shoot();
    play.walk(RIGHT, 4);
    play.walk(LEFT, 5);
    play.climb(UP, 2);
    play.walk(RIGHT, 1);
    play.shoot();
    play.walk(RIGHT, 4);
    play.walk(LEFT, 4);
    // the upper bridge strip, through its door and up the exit ladder
    play.climb(UP, 7);
    play.walk(RIGHT, 1);
    play.shoot();
    play.walk(RIGHT, 4);
    play.shoot();
    play.walk(RIGHT, 3);
    play.climb(UP, 10);
  },
};

for (const shape of ['landscape', 'portrait']) {
  test(`level 5 ${shape}: opening the caches with short stops on the shaft, the key among them, and the strips on the way to a door clears the level at revision 2 with most chests and no life lost`, () => {
    // given
    const play = playLevel(5, shape);

    // when
    ONTO_THE_SHAFT[shape](play);
    ON_TO_THE_EXIT[shape](play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape, chests, chestsTotal } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape, chests, chestsTotal },
      { level: 5, revision: 2, shape, ...CHESTS[shape] });
    assert.equal(play.lives(), 3);
  });

  test(`level 5 ${shape}: stopping on the shaft lets the guards come down it onto the runner and costs a life`, () => {
    // given
    const play = playLevel(5, shape);
    ONTO_THE_SHAFT[shape](play);
    const livesOnTheShaft = play.lives();

    // when
    play.run(STOP_ON_THE_SHAFT_SECONDS[shape]);
    const titleOnTheShaft = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(livesOnTheShaft, 3);
    assert.equal(titleOnTheShaft, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}
