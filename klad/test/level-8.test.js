'use strict';
/* Level 8 played in both shapes with the guards active, on the real page
   scripts (test/play.js). Two vaults lie across a lake: the left one is
   reached over the guards' heads and holds the key in a lower room; the
   right one lies below the two guard ledges, reached only through the left
   vault's door, a drop at the ledges' left end and the ladder down through
   both. Each guard follows the runner's column and walks off its ledge into
   the lake whenever the runner is left of the ledges. So the runner waits at
   the edge of the left vault until both guards have walked into the water,
   then drops. Counts are tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { playLevel } = require('./play.js');
const LEVELS = require('../levels.js');

/* The level is found by name, so its tests follow it if its place changes. */
const LEVEL = LEVELS.findIndex((level) => level.name === 'утопи хранителей') + 1;
const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
const FALL_SECONDS = { landscape: 0.3, portrait: 0.5 };
/* Both guards walk into the lake about 1.5 s (landscape) or 2.2 s (portrait)
   after the runner reaches the edge; the drop is safe for about 3.4 s or
   2.4 s after that. Later windows narrow: the guards fall different heights,
   so their rhythm drifts apart. */
const WAIT_AT_THE_EDGE_SECONDS = 3.2;
/* Dropping at once: the runner lands in front of the upper guard (landscape)
   or meets the lower one on the ladder (portrait). */
const MEETING_SECONDS = { landscape: 0.3, portrait: 1.2 };
const FALL_INTO_THE_LAKE_SECONDS = { landscape: 1, portrait: 1.2 };
/* Two rows from the bridge into the lake, read before a guard that follows
   down the ladder could reach the runner. */
const FALL_OFF_THE_BRIDGE_SECONDS = 0.4;
/* The death screen stays 1.4 s before the life is taken. */
const DEATH_SECONDS = 1.6;

/* Over the guards' heads and down the hole into the left vault, then down
   to the key in its lower room. */
const TO_THE_KEY = {
  landscape(play) {
    play.walk(LEFT, 17);
    play.run(FALL_SECONDS.landscape);
    play.walk(LEFT, 2);
    play.climb(DOWN, 2);
    play.walk(RIGHT, 4);
  },
  portrait(play) {
    play.walk(LEFT, 12);
    play.run(FALL_SECONDS.portrait);
    play.walk(LEFT, 1);
    play.climb(DOWN, 3);
    play.walk(RIGHT, 2);
  },
};

/* Back up to the edge of the left vault, left of the guards' ledges. */
const TO_THE_EDGE = {
  landscape(play) {
    play.walk(LEFT, 4);
    play.climb(UP, 2);
    play.walk(RIGHT, 5);
  },
  portrait(play) {
    play.walk(LEFT, 2);
    play.climb(UP, 3);
    play.walk(RIGHT, 3);
  },
};

const LADDER_TILES = { landscape: 5, portrait: 6 };

function drop(play, shape) {
  play.walk(RIGHT, 2);
  play.run(FALL_SECONDS[shape]);
}

/* Down the ladder past both ledges, over the bridge to the right vault,
   through the door and up to the exit. */
const DOWN_AND_OUT = {
  landscape(play) {
    play.climb(DOWN, LADDER_TILES.landscape);
    play.walk(RIGHT, 16);
    play.climb(UP, 11);
  },
  portrait(play) {
    play.climb(DOWN, LADDER_TILES.portrait);
    play.walk(RIGHT, 10);
    play.climb(UP, 16);
  },
};

for (const shape of ['landscape', 'portrait']) {
  test(`level 8 ${shape}: waiting at the edge of the left vault until both guards have walked into the lake, then dropping past their ledges, clears the level at revision 1`, () => {
    // given
    const play = playLevel(LEVEL, shape);

    // when
    TO_THE_KEY[shape](play);
    TO_THE_EDGE[shape](play);
    play.run(WAIT_AT_THE_EDGE_SECONDS);
    drop(play, shape);
    DOWN_AND_OUT[shape](play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: LEVEL, revision: 1, shape });
    /* Three lives and the life chest on the way. */
    assert.equal(play.lives(), 4);
  });

  test(`level 8 ${shape}: dropping at once, while the guards walk back along their ledges, costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shape);
    TO_THE_KEY[shape](play);
    TO_THE_EDGE[shape](play);
    const livesAtTheEdge = play.lives();

    // when
    drop(play, shape);
    play.hold(DOWN, MEETING_SECONDS[shape]);
    const titleAfterDrop = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterDrop, 'ПОГИБ');
    assert.equal(play.lives(), livesAtTheEdge - 1);
    assert.deepEqual(play.events, []);
  });

  test(`level 8 ${shape}: one step past the key drops the runner into the lake and costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shape);
    TO_THE_KEY[shape](play);
    const livesAtTheKey = play.lives();

    // when
    play.walk(RIGHT, 1);
    play.run(FALL_INTO_THE_LAKE_SECONDS[shape]);
    const titleAfterStep = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterStep, 'ПОГИБ');
    assert.equal(play.lives(), livesAtTheKey - 1);
    assert.deepEqual(play.events, []);
  });

  test(`level 8 ${shape}: after a safe drop, one step left off the foot of the ladder drops the runner into the lake and costs a life`, () => {
    // given
    const play = playLevel(LEVEL, shape);
    TO_THE_KEY[shape](play);
    TO_THE_EDGE[shape](play);
    play.run(WAIT_AT_THE_EDGE_SECONDS);
    drop(play, shape);
    play.climb(DOWN, LADDER_TILES[shape]);
    const livesOnTheBridge = play.lives();

    // when
    play.walk(LEFT, 1);
    play.run(FALL_OFF_THE_BRIDGE_SECONDS);
    const titleAfterStep = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterStep, 'ПОГИБ');
    assert.equal(play.lives(), livesOnTheBridge - 1);
    assert.deepEqual(play.events, []);
  });
}
