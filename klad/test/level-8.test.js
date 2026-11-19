'use strict';
/* Level 8 played in both shapes with the guards active, on the real page
   scripts (test/play.js). The two vaults lie on either side of a lake under
   a plank bridge, and the only way to either runs down the central ladder
   under the exit and over the bridge. Each guard stands on the top of its
   own ladder down to the bridge. While the runner is level with the guards
   or above them, they step toward the runner's column, drop through the
   planks and drown, and stand on their ladders again 3 s later. While the
   runner is lower, a guard that is alive climbs down and walks at the
   runner on the bridge, or follows the runner up into a vault. So each
   crossing starts at a lookout level with the guards, waits until they have
   walked into the lake and goes before they are back. The scripts that cost
   a life take the same path and differ only in the wait, so a guard takes
   the life, not the water. Counts are tiles. */
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
/* A drop of two rows inside the left vault. */
const FALL_SECONDS = 0.3;
/* The death screen stays 1.4 s before the life is taken. */
const DEATH_SECONDS = 1.6;
const TREASURE = { landscape: 28, portrait: 26 };

/* From the start over a vault along the top to the central ladder and down
   to the guards' row. */
const TO_THE_FIRST_LOOKOUT = {
  landscape: [['walk', RIGHT, 11], ['climb', DOWN, 6]],
  portrait: [['walk', LEFT, 6], ['climb', DOWN, 15]],
};

/* Each crossing ends at the next lookout. Seconds at the lookout before it,
   measured on these scripts in steps of 0.05 s with the safe waits before
   it: the safe wait sits in a band where the crossing survives, the deadly
   one in a band where a guard takes a life. The bands come back every
   guard cycle of about 4.4 s, still after 30 s more at a lookout: both
   guards have the same steps and the same fall to every side. A late start,
   or a stop on the top walk right above a guard, can put the two out of
   step; these scripts start at once and do not stop.
   landscape safe 0.65-2.55, 2.0-4.35, 0.05-2.7, 0.25-3.7;
             deadly 2.6-3.9, 0.05-1.95, 2.75-4.35, 3.75-4.55
   portrait  safe 0-2.2, 3.45-6.25, 0.05-2.75, 0.1-3.1;
             deadly 2.25-2.95, 1.9-3.4, 2.8-4.4, 3.15-4.45 */
const CROSSINGS = [
  {
    name: 'down to the left vault, through it and back to its ladder',
    safeSeconds: { landscape: 1.6, portrait: 1.1 },
    deadlySeconds: { landscape: 3.25, portrait: 2.6 },
    landscape: [['climb', DOWN, 5], ['walk', LEFT, 13], ['climb', UP, 9],
      ['walk', RIGHT, 5], ['fall'], ['walk', LEFT, 4], ['fall'], ['walk', RIGHT, 4], ['walk', LEFT, 5]],
    portrait: [['climb', DOWN, 8], ['walk', LEFT, 9], ['climb', UP, 18],
      ['walk', RIGHT, 5], ['fall'], ['walk', LEFT, 4], ['fall'], ['walk', RIGHT, 4], ['walk', LEFT, 5]],
  },
  {
    name: 'back from the left vault to the central ladder',
    safeSeconds: { landscape: 3.2, portrait: 5.0 },
    deadlySeconds: { landscape: 1.0, portrait: 2.8 },
    landscape: [['climb', DOWN, 5], ['walk', RIGHT, 13], ['climb', UP, 5]],
    portrait: [['climb', DOWN, 14], ['walk', RIGHT, 9], ['climb', UP, 8]],
  },
  {
    name: 'over to the right vault, up to the key and back to its door',
    safeSeconds: { landscape: 1.4, portrait: 1.5 },
    deadlySeconds: { landscape: 3.55, portrait: 3.7 },
    landscape: [['climb', DOWN, 5], ['walk', RIGHT, 8], ['climb', UP, 3],
      ['walk', RIGHT, 7], ['climb', UP, 2], ['walk', LEFT, 5], ['climb', UP, 2], ['walk', RIGHT, 4],
      ['walk', LEFT, 4], ['climb', DOWN, 2], ['walk', RIGHT, 5], ['climb', DOWN, 2],
      ['walk', LEFT, 7], ['climb', UP, 2]],
    portrait: [['climb', DOWN, 8], ['walk', RIGHT, 8], ['climb', UP, 15],
      ['walk', LEFT, 4], ['climb', UP, 2], ['walk', RIGHT, 3], ['climb', UP, 2], ['walk', LEFT, 3], ['climb', UP, 2],
      ['walk', RIGHT, 3], ['walk', LEFT, 3], ['climb', DOWN, 2], ['walk', RIGHT, 3], ['climb', DOWN, 2],
      ['walk', LEFT, 3], ['climb', DOWN, 2], ['walk', RIGHT, 4]],
  },
  {
    name: 'back with the key to the central ladder, the door and the exit',
    safeSeconds: { landscape: 2.0, portrait: 1.6 },
    deadlySeconds: { landscape: 4.15, portrait: 3.8 },
    landscape: [['climb', DOWN, 5], ['walk', LEFT, 8], ['climb', UP, 9], ['walk', RIGHT, 2], ['climb', UP, 3]],
    portrait: [['climb', DOWN, 15], ['walk', LEFT, 8], ['climb', UP, 21], ['walk', LEFT, 2], ['climb', UP, 3]],
  },
];

/* Stops at a death, so the keys left in the script do not play the next life. */
function follow(play, steps) {
  const livesBefore = play.lives();
  for (const [move, key, tiles] of steps) {
    if (move === 'walk') play.walk(key, tiles);
    else if (move === 'climb') play.climb(key, tiles);
    else play.run(FALL_SECONDS);
    if (play.title() === 'ПОГИБ' || play.lives() < livesBefore) return;
  }
}

function crossSafely(play, shape, crossings) {
  for (const crossing of crossings) {
    play.run(crossing.safeSeconds[shape]);
    follow(play, crossing[shape]);
  }
}

for (const shape of ['landscape', 'portrait']) {
  test(`level 8 ${shape}: waiting at each lookout until the guards have drowned, then crossing, empties both vaults and clears the level at revision 1`, () => {
    // given
    const play = playLevel(LEVEL, shape);
    follow(play, TO_THE_FIRST_LOOKOUT[shape]);

    // when
    crossSafely(play, shape, CROSSINGS);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape, chests, chestsTotal } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape, chests, chestsTotal },
      { level: LEVEL, revision: 1, shape, chests: TREASURE[shape], chestsTotal: TREASURE[shape] });
    assert.equal(play.lives(), 3);
  });

  CROSSINGS.forEach((crossing, index) => {
    test(`level 8 ${shape}: crossing ${crossing.name} while the guards are alive costs a life`, () => {
      // given
      const play = playLevel(LEVEL, shape);
      follow(play, TO_THE_FIRST_LOOKOUT[shape]);
      crossSafely(play, shape, CROSSINGS.slice(0, index));
      const livesAtTheLookout = play.lives();

      // when
      play.run(crossing.deadlySeconds[shape]);
      follow(play, crossing[shape]);
      play.run(DEATH_SECONDS);

      // then
      assert.equal(play.lives(), livesAtTheLookout - 1);
      assert.deepEqual(play.events, []);
    });
  });
}
