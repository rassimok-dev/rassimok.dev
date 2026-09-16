/* Level parsing and its refusals. The parser is the only thing standing
 * between a typo in hand-authored ASCII and a screen that looks fine and
 * cannot be finished, so the error paths are tested as hard as the happy one. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseLevel, LevelError } from '../src/level.js';
import { FIELD_W, FIELD_H } from '../src/tuning.js';
import {
  EMPTY, SOLID, BRICK, LADDER, FALLTHRU, WATER, CHEST, CHEST_KEY, DOOR, EXIT,
  indexOf,
} from '../src/tiles.js';

/* Kept local to each test file on purpose: test/ holds only *.test.js, so
 * there is nowhere shared to put it without inventing a module the contract
 * does not list. */
function field(rows) {
  const out = [];
  for (let y = 0; y < FIELD_H; y++) out.push((rows[y] ?? '').padEnd(FIELD_W, ' '));
  return out.join('\n');
}

const at = (level, x, y) => level.tiles[indexOf(level.w, x, y)];

test('parses a level into the documented shape', () => {
  const level = parseLevel(field([
    '#==H.~$kDX                      ',
    '  @    g   g                    ',
    '################################',
  ]), 'shapes');

  assert.equal(level.w, FIELD_W);
  assert.equal(level.h, FIELD_H);
  assert.equal(level.tiles.length, FIELD_W * FIELD_H);
  assert.ok(level.tiles instanceof Uint8Array);

  assert.equal(at(level, 0, 0), SOLID);
  assert.equal(at(level, 1, 0), BRICK);
  assert.equal(at(level, 3, 0), LADDER);
  assert.equal(at(level, 4, 0), FALLTHRU);
  assert.equal(at(level, 5, 0), WATER);
  assert.equal(at(level, 6, 0), CHEST);
  assert.equal(at(level, 7, 0), CHEST_KEY);
  assert.equal(at(level, 8, 0), DOOR);
  assert.equal(at(level, 9, 0), EXIT);
});

test('spawns become EMPTY and are reported as coordinates', () => {
  const level = parseLevel(field([
    '  @    g   g   X                ',
    '################################',
  ]), 'spawns');

  assert.deepEqual(level.playerSpawn, { x: 2, y: 0 });
  assert.deepEqual(level.guardSpawns, [{ x: 7, y: 0 }, { x: 11, y: 0 }]);
  assert.equal(at(level, 2, 0), EMPTY);
  assert.equal(at(level, 7, 0), EMPTY);
  assert.equal(at(level, 11, 0), EMPTY);
});

test('all three chest variants count toward chestCount', () => {
  const level = parseLevel(field([
    ' @ $ + k X                      ',
  ]), 'chests');
  assert.equal(level.chestCount, 3);
});

test('short rows are padded with EMPTY rather than rejected', () => {
  /* Editors strip trailing whitespace; demanding exact width would break
   * every level with a blank right-hand column the first time one was saved. */
  const level = parseLevel(['@X', ...Array(FIELD_H - 1).fill('')].join('\n'), 'ragged');
  assert.equal(at(level, FIELD_W - 1, 0), EMPTY);
  assert.equal(at(level, 5, 7), EMPTY);
});

test('a leading blank line from a template literal is not a row', () => {
  const source = `
${field(['@X'])}`;
  const level = parseLevel(source, 'template');
  assert.deepEqual(level.playerSpawn, { x: 0, y: 0 });
});

test('rejects the wrong number of rows', () => {
  assert.throws(
    () => parseLevel('@X\n#', 'short'),
    (err) => err instanceof LevelError && /expected 15 rows, got 2/.test(err.message),
  );
});

test('rejects a row wider than the field', () => {
  const rows = Array(FIELD_H).fill(''.padEnd(FIELD_W, ' '));
  rows[0] = '@X'.padEnd(FIELD_W + 1, ' ');
  assert.throws(
    () => parseLevel(rows.join('\n'), 'wide'),
    (err) => err instanceof LevelError && /row 0 is 33 chars/.test(err.message),
  );
});

test('rejects an unknown tile and says where it is', () => {
  assert.throws(
    () => parseLevel(field(['@  X', '   %']), 'typo'),
    (err) => err instanceof LevelError && /unknown tile '%' at row 1, col 3/.test(err.message),
  );
});

test('rejects a missing or duplicated player spawn', () => {
  assert.throws(
    () => parseLevel(field(['   X']), 'nobody'),
    (err) => err instanceof LevelError && /exactly one player spawn '@', found 0/.test(err.message),
  );
  assert.throws(
    () => parseLevel(field(['@ @X']), 'twins'),
    (err) => err instanceof LevelError && /found 2/.test(err.message),
  );
});

test('rejects a level with no exit', () => {
  assert.throws(
    () => parseLevel(field(['@ $ $']), 'sealed'),
    (err) => err instanceof LevelError && /no exit/.test(err.message),
  );
});

test('the parsed level is frozen', () => {
  const level = parseLevel(field(['@X']), 'frozen');
  assert.ok(Object.isFrozen(level));
  assert.ok(Object.isFrozen(level.playerSpawn));
});
