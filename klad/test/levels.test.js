/* The level set, checked as data.
 *
 * level.js already refuses a malformed level at runtime, so these tests are
 * not about the parser -- they are about the eight screens shipping in a state
 * where the parser would accept them and a player still could not finish.
 * Every assertion here corresponds to a way a hand-authored screen has been
 * broken before: a row miscounted by one, a second '@' left behind after
 * moving the spawn, a chest walled in while shuffling the floor around it.
 *
 * Solvability itself is not asserted. Deciding whether a maze can be walked
 * is a search, and a search written against the same assumptions as the level
 * would only agree with itself; the routes were walked by hand instead. What
 * is asserted is every precondition that search would have needed. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS } from '../src/levels.js';
import { parseLevel } from '../src/level.js';
import { FIELD_W, FIELD_H } from '../src/tuning.js';
import {
  CHAR_TO_ID, PLAYER_SPAWN_CHAR, GUARD_SPAWN_CHAR, SOLID, EXIT, DOOR, CHEST_KEY,
  standable, isChest, tileAt,
} from '../src/tiles.js';

const LEGAL_CHARS = new Set([
  ...Object.keys(CHAR_TO_ID), PLAYER_SPAWN_CHAR, GUARD_SPAWN_CHAR,
]);

/* The same trim level.js applies, for the same reason: the blank line after
 * the opening backtick and before the closing one are an artifact of writing
 * the grid at column zero, not content. Duplicated rather than imported
 * because these tests must see the text as authored, including a row that is
 * accidentally 31 or 33 characters long -- which the parser would pad or
 * reject, and which is exactly what this file is here to catch. */
function rowsOf(source) {
  const rows = source.split('\n');
  if (rows[0] === '') rows.shift();
  if (rows[rows.length - 1] === '') rows.pop();
  return rows;
}

function occurrences(source, ch) {
  return rowsOf(source).join('').split(ch).length - 1;
}

for (const { name, source } of LEVELS) {
  const rows = rowsOf(source);

  test(`${name}: is exactly ${FIELD_W} by ${FIELD_H}`, () => {
    assert.equal(rows.length, FIELD_H, `expected ${FIELD_H} rows`);
    rows.forEach((row, y) => {
      assert.equal(row.length, FIELD_W, `row ${y} is ${row.length} chars`);
    });
  });

  test(`${name}: uses only the contract charset`, () => {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        assert.ok(LEGAL_CHARS.has(ch), `unknown tile '${ch}' at row ${y}, col ${x}`);
      });
    });
  });

  test(`${name}: has exactly one player spawn and exactly one exit`, () => {
    assert.equal(occurrences(source, PLAYER_SPAWN_CHAR), 1);
    /* More than one exit is not a parse error -- level.js only requires at
     * least one -- but it is a design error: the level would have two endings
     * and only one of them thought about. */
    assert.equal(occurrences(source, 'X'), 1);
  });

  test(`${name}: has something to collect`, () => {
    const level = parseLevel(source, name);
    assert.ok(level.chestCount >= 1, 'a level with no chest opens its exit at once');
  });

  test(`${name}: starts the player on solid footing with somewhere to go`, () => {
    const level = parseLevel(source, name);
    const { x, y } = level.playerSpawn;
    const { w, h, tiles } = level;

    /* "The spawn is not inside a wall" cannot fail as written -- parseLevel
     * replaces '@' with EMPTY whatever was underneath it -- so this asserts
     * what that rule is actually protecting: the player does not begin the
     * level entombed, or dropping out of the sky before touching a control. */
    assert.ok(standable(tileAt(tiles, w, h, x, y + 1)), 'spawns over a hole');
    const sideways = [tileAt(tiles, w, h, x - 1, y), tileAt(tiles, w, h, x + 1, y)];
    assert.ok(sideways.some((t) => t !== SOLID), 'spawns walled in by SOLID');
  });

  test(`${name}: leaves every chest an opening`, () => {
    const level = parseLevel(source, name);
    const { w, h, tiles } = level;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!isChest(tiles[y * w + x])) continue;
        /* BRICK and DOOR deliberately do not count as sealing: one is opened
         * with a shot and the other with a key, so a chest behind either is a
         * puzzle. Only SOLID -- and the field edge, which tileAt reports as
         * SOLID -- makes a chest unreachable by any means the game has. */
        const around = [
          tileAt(tiles, w, h, x, y - 1), tileAt(tiles, w, h, x, y + 1),
          tileAt(tiles, w, h, x - 1, y), tileAt(tiles, w, h, x + 1, y),
        ];
        assert.ok(
          around.some((t) => t !== SOLID),
          `chest at ${x},${y} is sealed inside SOLID`,
        );
      }
    }
  });

  test(`${name}: has a key for every door`, () => {
    const level = parseLevel(source, name);
    let doors = 0;
    let keys = 0;
    for (const t of level.tiles) {
      if (t === DOOR) doors++;
      if (t === CHEST_KEY) keys++;
    }
    /* Keys are never refunded and a door consumes one permanently, so a level
     * with fewer keys than doors can be walked into a state it cannot be
     * walked out of. Equality rather than "at least" is deliberate: a spare
     * key implies a door that did not have to be opened, and a player who
     * spends the spare on it has been allowed to dead-end themselves. */
    assert.equal(keys, doors, `${keys} keys for ${doors} doors`);
  });
}

test('the set is eight distinct screens in a fixed order', () => {
  assert.equal(LEVELS.length, 8);
  assert.ok(Object.isFrozen(LEVELS));

  const names = LEVELS.map((l) => l.name);
  assert.equal(new Set(names).size, names.length, 'two levels share a name');

  /* Guards against the copy-paste-and-edit authoring loop silently shipping
   * the same screen twice. */
  const sources = LEVELS.map((l) => l.source);
  assert.equal(new Set(sources).size, sources.length, 'two levels are identical');
});

test('every level survives the parser it will be loaded through', () => {
  for (const { name, source } of LEVELS) {
    const level = parseLevel(source, name);
    assert.equal(level.w, FIELD_W);
    assert.equal(level.h, FIELD_H);
    assert.ok(level.tiles.some((t) => t === EXIT), 'exit did not survive parsing');
  }
});
