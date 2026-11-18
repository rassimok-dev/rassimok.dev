'use strict';
/* Sanity checks for hand-drawn maps: shape, legend, one player, one key,
   an exit on the top row, and a key-then-exit route. Each check counts the
   shot on its safe side (see reach and cheapest). */
const test = require('node:test');
const assert = require('node:assert/strict');
const LEVELS = require('../levels.js');
const KLAD_TICKS = require('../ticks.js');

const DIMS = { landscape: [24, 16], portrait: [16, 24] };
const LEGEND = new Set('.=#H-~$KLDEPG');

/* A shot flies along the shooter's row, never while falling, and opens the
   first brick it meets. Counted only where it always works: standing next to
   a brick on its row, the player shoots it and steps in. */
function reach(rows, hasKey, sx, sy, canUseShot = true) {
  const H = rows.length, W = rows[0].length;
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? '=' : rows[y][x];
  const solid = (x, y) => { const c = at(x, y); return c === '=' || c === '#' || (c === 'D' && !hasKey); };
  const ladder = (x, y) => at(x, y) === 'H' || at(x, y) === 'E';
  const seen = new Set([`${sx},${sy},0`]), cells = new Set(), q = [[sx, sy, 0]];
  while (q.length) {
    const [x, y, fell] = q.shift();
    if (at(x, y) === '~') continue;
    cells.add(`${x},${y}`);
    const push = (nx, ny, nf, canShoot) => {
      if (solid(nx, ny) && !(canShoot && canUseShot && at(nx, ny) === '#')) return;
      const k = `${nx},${ny},${nf}`;
      if (!seen.has(k)) { seen.add(k); q.push([nx, ny, nf]); }
    };
    const sup = ladder(x, y) || y + 1 >= H || solid(x, y + 1) || ladder(x, y + 1) || (at(x, y + 1) === '-' && !fell);
    if (!sup) { push(x, y + 1, 1); continue; }
    push(x - 1, y, 0, true); push(x + 1, y, 0, true);
    if (ladder(x, y)) push(x, y - 1, 0);
    if (ladder(x, y) || ladder(x, y + 1)) push(x, y + 1, 0);
  }
  return cells;
}

/* Cheapest key-then-exit route in ticks, from the speeds in klad.js: walking
   5 cells/s, climbing 4.5, falling 9. Every brick may be open or closed,
   whichever is quicker: a lower bound for any real clear, shots included. */
const TICKS_PER_CELL = { walk: 120 / 5, climb: 120 / 4.5, fall: 120 / 9 };

function cheapest(rows, hasKey, sx, sy) {
  const H = rows.length, W = rows[0].length;
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? '=' : rows[y][x];
  const solid = (x, y) => { const c = at(x, y); return c === '=' || (c === 'D' && !hasKey); };
  const brick = (x, y) => at(x, y) === '#';
  const ladder = (x, y) => at(x, y) === 'H' || at(x, y) === 'E';
  const best = new Map([[`${sx},${sy},0`, 0]]), open = [[0, sx, sy, 0]], cost = new Map();
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [ticks, x, y, fell] = open.shift();
    if (ticks > best.get(`${x},${y},${fell}`) || at(x, y) === '~') continue;
    if (!cost.has(`${x},${y}`)) cost.set(`${x},${y}`, ticks);
    const go = (nx, ny, nf, step) => {
      if (solid(nx, ny)) return;
      const k = `${nx},${ny},${nf}`, total = ticks + step;
      if (!best.has(k) || total < best.get(k)) { best.set(k, total); open.push([total, nx, ny, nf]); }
    };
    const supported = ladder(x, y) || y + 1 >= H || solid(x, y + 1) || brick(x, y + 1) || ladder(x, y + 1) || (at(x, y + 1) === '-' && !fell);
    if (brick(x, y + 1)) go(x, y + 1, 1, TICKS_PER_CELL.fall);
    if (!supported) { go(x, y + 1, 1, TICKS_PER_CELL.fall); continue; }
    go(x - 1, y, 0, TICKS_PER_CELL.walk); go(x + 1, y, 0, TICKS_PER_CELL.walk);
    if (ladder(x, y)) go(x, y - 1, 0, TICKS_PER_CELL.climb);
    if (ladder(x, y) || ladder(x, y + 1)) go(x, y + 1, 0, TICKS_PER_CELL.climb);
  }
  return cost;
}

function fastestClear(rows) {
  const [px, py] = find(rows, 'P')[0];
  const [kx, ky] = find(rows, 'K')[0];
  const toKey = cheapest(rows, false, px, py).get(`${kx},${ky}`);
  const fromKey = cheapest(rows, true, kx, ky);
  const exits = find(rows, 'E').filter(([, y]) => y === 0).map(([x, y]) => fromKey.get(`${x},${y}`));
  return Math.ceil(toKey + Math.min(...exits));
}

const find = (rows, ch) => {
  const out = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push([x, y]); }));
  return out;
};

LEVELS.forEach((level, i) => {
  test(`level ${i + 1} has a revision`, () => {
    assert.ok(Number.isInteger(level.revision) && level.revision >= 1, 'revision is an integer from 1');
  });
  for (const shape of Object.keys(DIMS)) {
    test(`level ${i + 1} (${level.name}) ${shape}`, () => {
      const rows = level[shape];
      const [W, H] = DIMS[shape];
      assert.equal(rows.length, H, 'row count');
      rows.forEach((r, y) => {
        assert.equal([...r].length, W, `row ${y} width`);
        for (const c of r) assert.ok(LEGEND.has(c), `row ${y}: unknown tile '${c}'`);
      });
      assert.ok([...rows[H - 1]].every((c) => c === '='), 'bottom row is stone');
      assert.equal(find(rows, 'P').length, 1, 'exactly one player');
      assert.equal(find(rows, 'K').length, 1, 'exactly one key chest');
      assert.ok(find(rows, 'G').length >= 1, 'at least one guard');
      const exits = find(rows, 'E').filter(([, y]) => y === 0);
      assert.ok(exits.length >= 1, 'an exit ladder reaches the top row');
      assert.ok(find(rows, 'D').length >= 1, 'a locked door');

      const [px, py] = find(rows, 'P')[0];
      const [kx, ky] = find(rows, 'K')[0];
      const before = reach(rows, false, px, py);
      assert.ok(before.has(`${kx},${ky}`), 'key reachable');
      const after = reach(rows, true, kx, ky);
      assert.ok(exits.some(([x, y]) => after.has(`${x},${y}`)), 'exit reachable with the key');

      const fastest = fastestClear(rows);
      assert.ok(fastest > KLAD_TICKS.MIN_CLEAR_TICKS, `fastest clear ${fastest} is not above the API floor`);

      const all = new Set([...before, ...after]);
      const chests = [...find(rows, '$'), ...find(rows, 'L')];
      const unreachable = chests.filter(([x, y]) => !all.has(`${x},${y}`));
      assert.ok(unreachable.length <= 1, `too many unreachable chests: ${JSON.stringify(unreachable)}`);
      for (const [x, y] of [...chests, [kx, ky], ...find(rows, 'G'), [px, py]]) {
        const below = rows[y + 1][x];
        assert.ok(below !== '.' && below !== '~', `(${x},${y}) is floating or over water`);
      }
    });
  }
});

test('level 2 needs the shot: without one the key is out of reach, in both shapes', () => {
  // given
  const level = LEVELS[1];

  for (const shape of Object.keys(DIMS)) {
    // when
    const rows = level[shape];
    const [px, py] = find(rows, 'P')[0];
    const [kx, ky] = find(rows, 'K')[0];
    const cells = reach(rows, false, px, py, false);

    // then
    assert.ok(!cells.has(`${kx},${ky}`), `${shape}: the key is reachable without a shot`);
  }
});

/* The shot in the checks, on small maps. Coordinates are column,row. */
test('route check: a chest sealed in brick next to where the player stands is reachable with a shot', () => {
  // given
  const rows = [
    'P.#$#.',
    '======',
  ];

  // when
  const cells = reach(rows, false, 0, 0);

  // then
  assert.ok(cells.has('3,0'));
});

test('route check: a chest sealed in brick behind stone is unreachable, the shot stops at stone', () => {
  // given
  const rows = [
    'P.=#$#',
    '======',
  ];

  // when
  const cells = reach(rows, false, 0, 0);

  // then
  assert.ok(!cells.has('4,0'));
});

test('route check: a chest under a brick floor is unreachable, the shot flies along the row only', () => {
  // given
  const rows = [
    'P.....',
    '=#====',
    '=$====',
    '======',
  ];

  // when
  const cells = reach(rows, false, 0, 0);

  // then
  assert.ok(!cells.has('1,2'));
});

test('route check: a brick passed in a fall stays shut, a falling player cannot shoot', () => {
  // given
  const rows = [
    'P.....',
    '=.====',
    '=.#$#=',
    '=.====',
    '=.....',
    '======',
  ];

  // when
  const cells = reach(rows, false, 0, 0);

  // then
  assert.ok(cells.has('1,4'));
  assert.ok(!cells.has('3,2'));
});

test('fastest clear: a drop through a brick floor counts, every brick may be open', () => {
  // given
  const rows = [
    'P....',
    '#===H',
    '....H',
    '=====',
  ];

  // when
  const ticks = cheapest(rows, false, 0, 0).get('0,2');

  // then
  assert.equal(ticks, 2 * TICKS_PER_CELL.fall);
});
