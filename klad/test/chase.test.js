'use strict';
/* The guards' chase rule on small maps. Tiles as in levels.js; G is the
   guard and P the player on air, g and p the same on a ladder. Outside the
   map is wall, as in the engine. */
const test = require('node:test');
const assert = require('node:assert/strict');
const KLAD_CHASE = require('../chase.js');

function stepOn(rows) {
  const at = (x, y) => (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length) ? '=' : rows[y][x];
  let guard = null;
  let player = null;
  rows.forEach((row, y) => [...row].forEach((tile, x) => {
    if (tile === 'G' || tile === 'g') guard = { x, y };
    if (tile === 'P' || tile === 'p') player = { x, y };
  }));
  const world = {
    isPassable: (x, y) => at(x, y) !== '=' && at(x, y) !== '#',
    isLadder: (x, y) => 'Hgp'.includes(at(x, y)),
  };
  return KLAD_CHASE.step(guard, player, world);
}

test('chase: on the player\'s row with nothing between them, the guard steps toward the player', () => {
  // given
  const toTheRight = ['G..P', '===='];
  const toTheLeft = ['P..G', '===='];
  // when
  const stepRight = stepOn(toTheRight);
  const stepLeft = stepOn(toTheLeft);
  // then
  assert.deepEqual(stepRight, { x: 1, y: 0 });
  assert.deepEqual(stepLeft, { x: 2, y: 0 });
});

test('chase: on the player\'s row with a wall in the way, the guard waits and does not go around', () => {
  // given
  const rows = [
    'H....H',
    'H====H',
    'H.G#PH',
    '======',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.equal(step, null);
});

test('chase: a gap in the floor ahead does not stop the guard, so it walks on and falls', () => {
  // given
  const rows = [
    'G..P',
    '=.==',
    '....',
    '====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.deepEqual(step, { x: 1, y: 0 });
});

test('chase: on a ladder that leads toward the player\'s row, the guard climbs first, even with open floor toward the player', () => {
  // given
  const rows = [
    'H...P',
    'H====',
    'g....',
    '=====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.deepEqual(step, { x: 0, y: 1 });
});

test('chase: on a ladder under a brick, the guard cannot climb up, so it runs toward the player\'s column', () => {
  // given
  const rows = [
    '....P',
    '..#==',
    '..g..',
    '=====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.deepEqual(step, { x: 3, y: 2 });
});

test('chase: on top of a ladder set into the floor, the guard climbs down toward the player below', () => {
  // given
  const rows = [
    'G...',
    'H===',
    'H...',
    'H..P',
    '====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.deepEqual(step, { x: 0, y: 1 });
});

test('chase: on the bottom tile of a ladder that hangs over air, the guard steps down off it toward the player below', () => {
  // given
  const rows = [
    'g....',
    '.....',
    'P....',
    '=====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.deepEqual(step, { x: 0, y: 1 });
});

test('chase: on the bottom tile of a ladder that stands on stone, the guard does not climb into the floor, so it runs toward the player\'s column', () => {
  // given
  const rows = [
    'g....',
    '==.==',
    '....P',
    '=====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.deepEqual(step, { x: 1, y: 0 });
});

test('chase: with no ladder at its tile, the guard runs toward the player\'s column, not to a ladder behind it', () => {
  // given
  const rows = [
    'H.G..',
    'H====',
    'H...P',
    '=====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.deepEqual(step, { x: 3, y: 0 });
});

test('chase: with no ladder at its tile and a wall toward the player\'s column, the guard waits', () => {
  // given
  const rows = [
    'H.G#.',
    'H====',
    'H...P',
    '=====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.equal(step, null);
});

test('chase: directly above the player with no ladder at its tile, the guard stands still', () => {
  // given
  const rows = [
    '..G..',
    'H====',
    'H.P..',
    '=====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.equal(step, null);
});

test('chase: directly below the player with no ladder at its tile, the guard stands still', () => {
  // given
  const rows = [
    '..P..',
    'H====',
    'H.G..',
    '=====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.equal(step, null);
});

test('chase: directly below the player with open air above and no ladder at its tile, the guard does not climb into the air', () => {
  // given
  const rows = [
    '..P..',
    '..=..',
    '.....',
    '..G..',
    '=====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.equal(step, null);
});

test('chase: water on the player\'s row does not stop the guard, so it steps in', () => {
  // given
  const rows = [
    'G~P',
    '===',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.deepEqual(step, { x: 1, y: 0 });
});

test('chase: a ledge above a plank over water does not stop the guard, so it walks off it', () => {
  // given
  const rows = [
    'G..P',
    '=..=',
    '=-.=',
    '=~~=',
    '====',
  ];
  // when
  const step = stepOn(rows);
  // then
  assert.deepEqual(step, { x: 1, y: 0 });
});

test('chase: on the player\'s tile, the guard takes no step', () => {
  // given
  const guard = { x: 1, y: 0 };
  const world = { isPassable: () => true, isLadder: () => true };
  // when
  const step = KLAD_CHASE.step(guard, { x: 1, y: 0 }, world);
  // then
  assert.equal(step, null);
});
