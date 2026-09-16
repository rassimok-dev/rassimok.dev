/* ASCII -> Level. Nothing else parses the level format.
 *
 * Validation is loud and specific on purpose. A level is hand-authored text,
 * so the realistic failure is a typo, and a parser that silently coerced one
 * would produce an unwinnable screen that looks fine -- the most expensive
 * kind of bug to track down. Every message names the row and column. */

import { FIELD_W, FIELD_H } from './tuning.js';
import {
  CHAR_TO_ID, PLAYER_SPAWN_CHAR, GUARD_SPAWN_CHAR, EMPTY, EXIT, isChest,
} from './tiles.js';

/* Distinguishable from a programming error by callers that want to report a
 * bad level differently from a crash. */
export class LevelError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LevelError';
  }
}

/* Template literals inevitably start after a newline and end before the
 * closing backtick's indentation, so exactly one blank line at each end is an
 * artifact of the authoring style, not content. Only one is stripped, and
 * only when it is truly empty: a legitimately blank *row* is FIELD_W spaces,
 * which this leaves alone. */
function splitRows(source) {
  const rows = source.split('\n');
  if (rows.length && rows[0] === '') rows.shift();
  if (rows.length === FIELD_H + 1 && rows[rows.length - 1].trim() === '') rows.pop();
  return rows;
}

export function parseLevel(source, name = 'level') {
  if (typeof source !== 'string') {
    throw new LevelError(`${name}: expected a string, got ${typeof source}`);
  }

  const rows = splitRows(source);
  if (rows.length !== FIELD_H) {
    throw new LevelError(
      `${name}: expected ${FIELD_H} rows, got ${rows.length}`,
    );
  }

  const tiles = new Uint8Array(FIELD_W * FIELD_H);
  const guardSpawns = [];
  let playerSpawn = null;
  let playerSpawnCount = 0;
  let chestCount = 0;
  let exitCount = 0;

  for (let y = 0; y < FIELD_H; y++) {
    const row = rows[y];
    if (row.length > FIELD_W) {
      throw new LevelError(
        `${name}: row ${y} is ${row.length} chars, field is ${FIELD_W} wide`,
      );
    }

    for (let x = 0; x < FIELD_W; x++) {
      /* Short rows are padded rather than rejected. Editors and pre-commit
       * hooks strip trailing whitespace, so demanding exactly FIELD_W would
       * break every level with an empty right-hand column the moment someone
       * saved the file. Rows that are too long stay an error -- that is a
       * real miscount, not a whitespace policy. */
      const ch = x < row.length ? row[x] : ' ';

      if (ch === PLAYER_SPAWN_CHAR) {
        playerSpawnCount++;
        if (!playerSpawn) playerSpawn = { x, y };
        tiles[y * FIELD_W + x] = EMPTY;
        continue;
      }
      if (ch === GUARD_SPAWN_CHAR) {
        guardSpawns.push({ x, y });
        tiles[y * FIELD_W + x] = EMPTY;
        continue;
      }

      const id = CHAR_TO_ID[ch];
      if (id === undefined) {
        throw new LevelError(
          `${name}: unknown tile '${ch}' at row ${y}, col ${x}`,
        );
      }
      tiles[y * FIELD_W + x] = id;
      if (isChest(id)) chestCount++;
      if (id === EXIT) exitCount++;
    }
  }

  if (playerSpawnCount !== 1) {
    throw new LevelError(
      `${name}: expected exactly one player spawn '${PLAYER_SPAWN_CHAR}', found ${playerSpawnCount}`,
    );
  }
  if (exitCount === 0) {
    throw new LevelError(`${name}: no exit tile 'X' -- the level cannot be finished`);
  }

  return Object.freeze({
    name,
    w: FIELD_W,
    h: FIELD_H,
    tiles,
    playerSpawn: Object.freeze(playerSpawn),
    guardSpawns: Object.freeze(guardSpawns.map((s) => Object.freeze(s))),
    chestCount,
  });
}
