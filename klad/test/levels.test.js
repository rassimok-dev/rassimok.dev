'use strict';
/* Sanity checks for hand-drawn maps: shape, legend, one player, one key,
   an exit on the top row, and a key-then-exit route that needs no shooting
   (shooting only ever opens more routes, so this is the conservative check). */
const test = require('node:test');
const assert = require('node:assert/strict');
const LEVELS = require('../levels.js');

const DIMS = { landscape: [24, 16], portrait: [16, 24] };
const LEGEND = new Set('.=#H-~$KLDEPG');

function reach(rows, hasKey, sx, sy) {
  const H = rows.length, W = rows[0].length;
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? '=' : rows[y][x];
  const solid = (x, y) => { const c = at(x, y); return c === '=' || c === '#' || (c === 'D' && !hasKey); };
  const ladder = (x, y) => at(x, y) === 'H' || at(x, y) === 'E';
  const seen = new Set([`${sx},${sy},0`]), cells = new Set(), q = [[sx, sy, 0]];
  while (q.length) {
    const [x, y, fell] = q.shift();
    if (at(x, y) === '~') continue;
    cells.add(`${x},${y}`);
    const push = (nx, ny, nf) => {
      if (solid(nx, ny)) return;
      const k = `${nx},${ny},${nf}`;
      if (!seen.has(k)) { seen.add(k); q.push([nx, ny, nf]); }
    };
    const sup = ladder(x, y) || y + 1 >= H || solid(x, y + 1) || ladder(x, y + 1) || (at(x, y + 1) === '-' && !fell);
    if (!sup) { push(x, y + 1, 1); continue; }
    push(x - 1, y, 0); push(x + 1, y, 0);
    if (ladder(x, y)) push(x, y - 1, 0);
    if (ladder(x, y) || ladder(x, y + 1)) push(x, y + 1, 0);
  }
  return cells;
}

const find = (rows, ch) => {
  const out = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push([x, y]); }));
  return out;
};

LEVELS.forEach((level, i) => {
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
      assert.ok(before.has(`${kx},${ky}`), 'key reachable without shooting');
      const after = reach(rows, true, kx, ky);
      assert.ok(exits.some(([x, y]) => after.has(`${x},${y}`)), 'exit reachable with the key');

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
