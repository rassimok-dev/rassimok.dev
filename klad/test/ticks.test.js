'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const KLAD_TICKS = require('../ticks.js');

test('format shows minutes, seconds and hundredths of a second', () => {
  assert.equal(KLAD_TICKS.format(0), '0:00.00');
  assert.equal(KLAD_TICKS.format(120), '0:01.00');
  assert.equal(KLAD_TICKS.format(600), '0:05.00');
  assert.equal(KLAD_TICKS.format(7 * 120 + 60), '0:07.50');
  assert.equal(KLAD_TICKS.format(83 * 120 + 12), '1:23.10');
});
