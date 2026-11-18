'use strict';
/* The game's own page scripts (levels.js, ticks.js, chase.js, klad.js, in
   the order of index.html) in a vm context with a stub page, for tests that
   play it: keys go in, time runs in 16 ms frames, and the events klad.js
   dispatches come out. Nothing here is random, so a fixed script of keys
   and waits plays the same game every time. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PAGE_SCRIPTS = ['levels.js', 'ticks.js', 'chase.js', 'klad.js'];
const FRAME_MS = 16;
const MAX_INTRO_FRAMES = 1000;
/* Seconds per tile at the runner's speeds in klad.js (SPEED.walk, SPEED.climb). */
const WALK_SECONDS = 1 / 5;
const CLIMB_SECONDS = 1 / 4.5;

function loadGame(options = {}) {
  const windowListeners = {};
  const events = [];
  const details = [];
  const texts = [];
  const hashes = [];
  const elements = {};
  let frame = null;
  let time = 0;
  let isDialogOpen = false;
  const canvasContext = {
    fillRect() {},
    drawImage() {},
    fillText(text) { texts.push({ text, colour: this.fillStyle }); },
  };
  const element = () => ({
    textContent: '', hidden: false, style: {}, dataset: {},
    setAttribute() {}, addEventListener() {}, focus() {},
    getContext: () => canvasContext,
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
  });
  const document = {
    documentElement: {},
    getElementById: (id) => elements[id] || (elements[id] = element()),
    createElement: () => ({ getContext: () => ({ fillRect() {} }) }),
    querySelector: () => (isDialogOpen ? {} : null),
    querySelectorAll: () => options.pad || [],
    addEventListener() {},
    dispatchEvent: (event) => {
      events.push(event.type);
      details.push(event.detail);
    },
  };
  const sandbox = {
    document,
    location: { hash: options.hash || '' },
    history: { replaceState: (state, title, hash) => hashes.push(hash) },
    matchMedia: (query) => ({
      matches: (query === '(orientation: portrait)' && options.isPortrait === true) ||
        (query === '(hover: none) and (pointer: coarse)' && options.isTouch === true),
    }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    addEventListener: (type, listener) => { windowListeners[type] = listener; },
    performance: { now: () => 0 },
    requestAnimationFrame: (callback) => { frame = callback; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  };
  sandbox.window = sandbox;
  /* Test levels replace levels.js; its const would clash with the global. */
  const scripts = options.levels ? PAGE_SCRIPTS.slice(1) : PAGE_SCRIPTS;
  if (options.levels) sandbox.KLAD_LEVELS = options.levels;
  vm.createContext(sandbox);
  for (const script of scripts) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', script), 'utf8'), sandbox);
  }
  const game = vm.runInContext('KLAD_GAME', sandbox);
  function nextFrame() {
    time += FRAME_MS;
    frame(time);
  }
  function run(seconds) {
    for (let elapsed = 0; elapsed < seconds * 1000; elapsed += FRAME_MS) nextFrame();
  }
  function hold(code, seconds) {
    const event = { code, repeat: false, target: { tagName: 'CANVAS', dataset: {} }, preventDefault() {} };
    windowListeners.keydown(event);
    run(seconds);
    windowListeners.keyup(event);
  }
  const key = (code) => hold(code, 0);
  const typeIn = (code) => windowListeners.keydown({ code, repeat: false, target: { tagName: 'INPUT', dataset: {} }, preventDefault() {} });
  const title = () => elements['msg-title'].textContent;
  const setDialogOpen = (isOpen) => { isDialogOpen = isOpen; };
  const body = () => elements['msg-body'].textContent;
  const lives = () => Number(elements['h-lives'].textContent);
  function waitForPlay() {
    for (let frames = 0; frames < MAX_INTRO_FRAMES && !elements.msg.hidden; frames++) nextFrame();
  }
  /* A step of whole tiles from standing still. The key comes up halfway
     through the last tile, so a timing drift of almost half a tile ends on
     the same tile; the wait after it (half a tile and a frame, for frame
     rounding) lets that tile finish. A fall after the step is not waited for. */
  function step(code, tiles, secondsPerTile) {
    hold(code, (tiles - 0.5) * secondsPerTile);
    run(secondsPerTile / 2 + FRAME_MS / 1000);
  }
  const walk = (code, tiles) => step(code, tiles, WALK_SECONDS);
  const climb = (code, tiles) => step(code, tiles, CLIMB_SECONDS);
  /* The shot goes the way the runner last walked. */
  const shoot = () => key('Space');
  return { game, events, details, texts, hashes, elements, run, key, hold, typeIn, title, body, lives, setDialogOpen, waitForPlay, walk, climb, shoot };
}

/* Level n (from 1) of levels.js in one shape, from the first frame of play:
   the title is skipped and the intro has run out. */
function playLevel(level, shape) {
  const play = loadGame({ hash: '#' + level, isPortrait: shape === 'portrait' });
  play.key('Enter');
  play.waitForPlay();
  return play;
}

module.exports = { loadGame, playLevel };
