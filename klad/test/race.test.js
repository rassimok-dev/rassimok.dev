'use strict';
/* klad/race.js without a browser, on the lobby's real socket module: a fake
   WebSocket opens, receives and drops only when a test says so, a fake clock
   runs timers only when a test advances it, and a fake engine records what
   the race asks of it. The last part runs klad.js itself in a vm context
   with a stub page, for what only the engine can prove. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const KLAD_RACE = require('../race.js');
const KLAD_LOBBY = require('../lobby.js');
const KLAD_TICKS = require('../ticks.js');

const { TEXT } = KLAD_RACE;
const ID = 'Room_id-42';
const ROOM = { id: ID, state: 'starting', level: 2, shape: 'landscape', players: [], size: 4 };
const ME = { slot: 0, nick: 'test', kind: 'agent', you: true, connected: true, finished: false };
const ANNA = { slot: 1, nick: 'Anna', kind: 'human', you: false, connected: true, finished: false };
const OTHER_ANNA = { slot: 2, nick: 'Anna', kind: 'human', you: false, connected: true, finished: false };
const STATE = { type: 'state', state: 'starting', level: 3, shape: 'portrait', players: [ME, ANNA, OTHER_ANNA], positions: [] };
const NETWORK_DROP = 1006;

function fakeClock() {
  const timers = new Map();
  let time = 0;
  let nextId = 1;
  return {
    now: () => time,
    setTimeout(task, wait) {
      const id = nextId++;
      timers.set(id, { at: time + wait, task });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    advance(milliseconds) {
      const end = time + milliseconds;
      for (;;) {
        let next = null;
        for (const [id, timer] of timers) if (timer.at <= end && (next === null || timer.at < next.at)) next = { id, ...timer };
        if (next === null) break;
        timers.delete(next.id);
        time = next.at;
        next.task();
      }
      time = end;
    },
  };
}

function fakeSockets() {
  const made = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.sent = [];
      this.closedWith = null;
      made.push(this);
    }
    send(data) { this.sent.push(data); }
    close(code) { this.closedWith = code; }
  }
  return { FakeWebSocket, made };
}

function fakeEngine() {
  return {
    starts: [],
    stops: 0,
    position: null,
    start(level, shape) { this.starts.push([level, shape]); },
    stop() { this.stops++; },
  };
}

function setup() {
  const clock = fakeClock();
  const sockets = fakeSockets();
  const engine = fakeEngine();
  const world = { isVisible: true };
  const page = { renders: 0, render() { this.renders++; } };
  const race = KLAD_RACE.create({
    clock,
    isVisible: () => world.isVisible,
    format: KLAD_TICKS.format,
    engine: { start: (level, shape) => engine.start(level, shape), stop: () => engine.stop(), position: () => engine.position },
  }, page);
  const socket = KLAD_LOBBY.connect('ws://test/klad/api/race/' + ID, sockets.FakeWebSocket, clock);
  race.begin(ROOM, socket);
  clock.advance(0);
  const server = () => sockets.made[sockets.made.length - 1];
  const say = (message) => server().onmessage({ data: JSON.stringify(message) });
  return { race, clock, sockets, engine, world, page, socket, server, say };
}

/* Connected, with the state and the countdown, and go. */
function racing() {
  const run = setup();
  run.server().onopen();
  run.say(STATE);
  run.say({ type: 'countdown', seconds: 3 });
  run.clock.advance(3000);
  run.say({ type: 'go', at: 1763000000000 });
  return run;
}

const sentOf = (socket, type) => socket.sent.map((data) => JSON.parse(data)).filter((message) => message.type === type);

/* ---- countdown and start ---- */

test('the countdown shows 3, 2, 1 a second apart and go starts the level in the room\'s shape', () => {
  // given
  const { race, clock, engine, server, say } = setup();
  server().onopen();
  say(STATE);
  // when
  say({ type: 'countdown', seconds: 3 });
  const counts = [race.state().count];
  clock.advance(1000);
  counts.push(race.state().count);
  clock.advance(1000);
  counts.push(race.state().count);
  clock.advance(5000);
  counts.push(race.state().count);
  const phaseBeforeGo = race.state().phase;
  const startsBeforeGo = engine.starts.length;
  say({ type: 'go', at: 1763000000000 });
  // then
  assert.deepEqual(counts, [3, 2, 1, 1]);
  assert.equal(phaseBeforeGo, 'countdown');
  assert.equal(startsBeforeGo, 0);
  assert.deepEqual(engine.starts, [[3, 'portrait']]);
  assert.equal(race.state().phase, 'racing');
});

test('without a state message the race starts the polled room\'s level and shape', () => {
  // given
  const { engine, server, say } = setup();
  server().onopen();
  // when
  say({ type: 'countdown', seconds: 3 });
  say({ type: 'go', at: 1763000000000 });
  // then
  assert.deepEqual(engine.starts, [[2, 'landscape']]);
});

test('a second countdown or go changes nothing once the race runs', () => {
  // given
  const { race, engine, say } = racing();
  // when
  say({ type: 'countdown', seconds: 3 });
  say({ type: 'go', at: 1763000000000 });
  // then
  assert.equal(race.state().phase, 'racing');
  assert.equal(engine.starts.length, 1);
});

test('a state that says racing starts a race that missed go', () => {
  // given
  const { race, engine, server, say } = setup();
  server().onopen();
  // when
  say({ ...STATE, state: 'racing' });
  // then
  assert.deepEqual(engine.starts, [[3, 'portrait']]);
  assert.equal(race.state().phase, 'racing');
});

/* ---- what goes out ---- */

test('positions go about 5 a second only while racing, visible and in play', () => {
  // given
  const { clock, engine, world, server, say } = setup();
  server().onopen();
  engine.position = { x: 3.256, y: 4, tick: 120 };
  say(STATE);
  say({ type: 'countdown', seconds: 3 });
  clock.advance(3000);
  const beforeGo = sentOf(server(), 'pos').length;
  say({ type: 'go', at: 1763000000000 });
  // when
  clock.advance(10 * 1000);
  const whileRacing = sentOf(server(), 'pos').length;
  world.isVisible = false;
  clock.advance(10 * 1000);
  const whileHidden = sentOf(server(), 'pos').length - whileRacing;
  world.isVisible = true;
  engine.position = null;
  clock.advance(10 * 1000);
  const whileNotInPlay = sentOf(server(), 'pos').length - whileRacing;
  // then
  assert.equal(beforeGo, 0);
  assert.equal(whileRacing, 50);
  assert.equal(whileHidden, 0);
  assert.equal(whileNotInPlay, 0);
  assert.deepEqual(sentOf(server(), 'pos')[0], { type: 'pos', x: 3.26, y: 4, tick: 120 });
});

test('a ping goes every 20 s, on one timer however often the socket reconnects', () => {
  // given
  const { clock, sockets, server } = setup();
  server().onopen();
  // when
  clock.advance(60 * 1000);
  server().onclose({ code: NETWORK_DROP });
  clock.advance(500);
  server().onopen();
  server().onclose({ code: NETWORK_DROP });
  clock.advance(500);
  server().onopen();
  clock.advance(59 * 1000);
  // then
  const pings = sockets.made.reduce((sum, socket) => sum + sentOf(socket, 'ping').length, 0);
  assert.equal(sockets.made.length, 3);
  assert.equal(pings, 6);
});

test('finish goes once with the tick count, stops the positions and shows waiting for the others', () => {
  // given
  const { race, clock, engine, server } = racing();
  engine.position = { x: 1, y: 1, tick: 5 };
  // when
  race.finish(1234);
  race.finish(1300);
  clock.advance(5 * 1000);
  // then
  assert.deepEqual(sentOf(server(), 'finish'), [{ type: 'finish', ticks: 1234 }]);
  assert.equal(sentOf(server(), 'pos').length, 0);
  assert.equal(race.state().phase, 'finished');
  assert.equal(race.state().notice, TEXT.waiting('0:10.28'));
});

test('a finish before go is ignored', () => {
  // given
  const { race, server } = setup();
  server().onopen();
  // when
  race.finish(1234);
  // then
  assert.deepEqual(sentOf(server(), 'finish'), []);
  assert.equal(race.state().phase, 'starting');
});

/* ---- ghosts ---- */

test('ghosts come from pos messages by slot, so two guests named Anna stay apart, and the own slot is ignored', () => {
  // given
  const { race, say } = racing();
  // when
  say({ type: 'pos', slot: 1, nick: 'Anna', x: 4, y: 5, tick: 10 });
  say({ type: 'pos', slot: 2, nick: 'Anna', x: 7.5, y: 2, tick: 12 });
  say({ type: 'pos', slot: 0, nick: 'test', x: 1, y: 1, tick: 12 });
  // then
  assert.deepEqual(race.ghosts(), [
    { slot: 1, nick: 'Anna', x: 4, y: 5, direction: 1, alpha: KLAD_RACE.GHOST_ALPHA },
    { slot: 2, nick: 'Anna', x: 7.5, y: 2, direction: 1, alpha: KLAD_RACE.GHOST_ALPHA },
  ]);
});

test('a ghost takes the latest position and faces the way it moved', () => {
  // given
  const { race, say } = racing();
  say({ type: 'pos', slot: 1, nick: 'Anna', x: 4, y: 5, tick: 10 });
  // when
  say({ type: 'pos', slot: 1, nick: 'Anna', x: 3.5, y: 5, tick: 34 });
  // then
  assert.deepEqual(race.ghosts(), [{ slot: 1, nick: 'Anna', x: 3.5, y: 5, direction: -1, alpha: KLAD_RACE.GHOST_ALPHA }]);
});

test('a ghost with no update for 2 s fades out, and comes back with the next position', () => {
  // given
  const { race, clock, say } = racing();
  say({ type: 'pos', slot: 1, nick: 'Anna', x: 4, y: 5, tick: 10 });
  // when
  clock.advance(KLAD_RACE.FADE_AFTER);
  const atTwoSeconds = race.ghosts()[0].alpha;
  clock.advance(KLAD_RACE.FADE_FOR / 2);
  const halfWay = race.ghosts()[0].alpha;
  clock.advance(KLAD_RACE.FADE_FOR / 2);
  const faded = race.ghosts();
  say({ type: 'pos', slot: 1, nick: 'Anna', x: 6, y: 5, tick: 400 });
  // then
  assert.equal(atTwoSeconds, KLAD_RACE.GHOST_ALPHA);
  assert.equal(halfWay, KLAD_RACE.GHOST_ALPHA / 2);
  assert.deepEqual(faded, []);
  assert.equal(race.ghosts()[0].x, 6);
});

test('pos messages with a bad slot or position make no ghost', () => {
  // given
  const { race, say } = racing();
  // when
  say({ type: 'pos', slot: 4, nick: 'Anna', x: 4, y: 5, tick: 10 });
  say({ type: 'pos', slot: '1', nick: 'Anna', x: 4, y: 5, tick: 10 });
  say({ type: 'pos', slot: 1, nick: 'Anna', x: '4', y: 5, tick: 10 });
  say({ type: 'pos', slot: 1, nick: 'Anna', y: 5, tick: 10 });
  // then
  assert.deepEqual(race.ghosts(), []);
});

/* ---- results ---- */

test('results show the places in order with times, the winner, this player and who left, and stop the engine', () => {
  // given
  const { race, engine, say } = racing();
  race.finish(2400);
  // when
  say({ type: 'results', places: [
    { slot: 2, nick: 'Anna', kind: 'human', place: null, ticks: null, left: true },
    { slot: 0, nick: 'test', kind: 'agent', place: 2, ticks: 2400, left: false },
    { slot: 1, nick: 'Anna', kind: 'human', place: 1, ticks: 2520, left: false },
  ] });
  // then
  assert.equal(race.state().phase, 'results');
  assert.deepEqual(race.state().places, [
    { place: 1, nick: 'Anna', time: '0:21.00', isWinner: true, isMine: false, hasLeft: false },
    { place: 2, nick: 'test', time: '0:20.00', isWinner: false, isMine: true, hasLeft: false },
    { place: null, nick: 'Anna', time: null, isWinner: false, isMine: false, hasLeft: true },
  ]);
  assert.equal(engine.stops, 1);
});

test('results that come while this player still plays end the race too, and nothing more goes out', () => {
  // given
  const { race, clock, engine, server, say } = racing();
  engine.position = { x: 1, y: 1, tick: 5 };
  // when
  say({ type: 'results', places: [{ slot: 1, nick: 'Anna', kind: 'human', place: 1, ticks: 900, left: false }] });
  const sentAtResults = server().sent.length;
  clock.advance(60 * 1000);
  race.finish(1500);
  // then
  assert.equal(race.state().phase, 'results');
  assert.equal(engine.stops, 1);
  assert.equal(server().sent.length, sentAtResults);
});

test('the server\'s close after the results keeps the finish screen', () => {
  // given
  const { race, server, say } = racing();
  say({ type: 'results', places: [] });
  // when
  server().onclose({ code: 1000 });
  // then
  assert.equal(race.state().phase, 'results');
  assert.equal(race.state().notice, '');
});

/* ---- the connection ---- */

test('a dropped socket shows reconnecting, keeps the game, and the state after the reconnect resyncs the ghosts', () => {
  // given
  const { race, clock, engine, sockets, server, say } = racing();
  say({ type: 'pos', slot: 1, nick: 'Anna', x: 4, y: 5, tick: 10 });
  // when
  server().onclose({ code: NETWORK_DROP });
  const noticeWhileDown = race.state().notice;
  clock.advance(500);
  server().onopen();
  say({ ...STATE, state: 'racing', positions: [{ slot: 1, x: 9, y: 3, tick: 900 }, { slot: 2, x: 2, y: 2, tick: 880 }] });
  // then
  assert.equal(noticeWhileDown, TEXT.reconnecting);
  assert.equal(sockets.made.length, 2);
  assert.equal(engine.stops, 0);
  assert.equal(engine.starts.length, 1);
  assert.equal(race.state().phase, 'racing');
  assert.equal(race.state().notice, '');
  assert.deepEqual(race.ghosts(), [
    { slot: 1, nick: 'Anna', x: 9, y: 3, direction: 1, alpha: KLAD_RACE.GHOST_ALPHA },
    { slot: 2, nick: 'Anna', x: 2, y: 2, direction: 1, alpha: KLAD_RACE.GHOST_ALPHA },
  ]);
});

test('a finish made while reconnecting goes out after the reconnect, and not again once the server has it', () => {
  // given
  const { race, clock, sockets, server, say } = racing();
  server().onclose({ code: NETWORK_DROP });
  race.finish(1234);
  // when
  clock.advance(500);
  server().onopen();
  say({ ...STATE, state: 'racing' });
  server().onclose({ code: NETWORK_DROP });
  clock.advance(1000);
  server().onopen();
  say({ ...STATE, state: 'racing', players: [{ ...ME, finished: true }, ANNA] });
  // then
  assert.deepEqual(sentOf(sockets.made[0], 'finish'), []);
  assert.deepEqual(sentOf(sockets.made[1], 'finish'), [{ type: 'finish', ticks: 1234 }]);
  assert.deepEqual(sentOf(sockets.made[2], 'finish'), []);
});

test('close 1000 before the results stops the race and the engine, says so, and does not reconnect', () => {
  // given
  const { race, clock, engine, sockets, server } = racing();
  // when
  server().onclose({ code: 1000 });
  clock.advance(60 * 1000);
  // then
  assert.equal(race.state().phase, 'idle');
  assert.equal(engine.stops, 1);
  assert.equal(sockets.made.length, 1);
  assert.equal(sentOf(server(), 'ping').length, 0);
});

test('the notice after the race closed goes away after a while', () => {
  // given
  const { race, clock, server } = racing();
  // when
  server().onclose({ code: 1000 });
  const atClose = race.state().notice;
  clock.advance(KLAD_RACE.NOTICE_FOR);
  // then
  assert.equal(atClose, TEXT.closed);
  assert.equal(race.state().notice, '');
});

test('a socket that drops for good after it opened ends the race with the lost notice', () => {
  // given
  const { race, clock, engine, server } = racing();
  // when
  for (let i = 0; i < KLAD_LOBBY.SOCKET_TRIES; i++) {
    server().onclose({ code: NETWORK_DROP });
    clock.advance(10 * 1000);
  }
  server().onclose({ code: NETWORK_DROP });
  // then
  assert.equal(race.state().phase, 'idle');
  assert.equal(race.state().notice, TEXT.lost);
  assert.equal(engine.stops, 1);
});

test('a socket that never opens says online play is not available and never starts the engine', () => {
  // given
  const { race, clock, engine, server } = setup();
  // when
  for (let i = 0; i < KLAD_LOBBY.SOCKET_TRIES; i++) {
    server().onclose({ code: NETWORK_DROP });
    clock.advance(10 * 1000);
  }
  server().onclose({ code: NETWORK_DROP });
  // then
  assert.equal(race.state().phase, 'idle');
  assert.equal(race.state().notice, TEXT.unavailable);
  assert.deepEqual(engine.starts, []);
});

test('a second race on the same page ignores the first race\'s socket', () => {
  // given
  const { race, clock, engine, sockets, say } = racing();
  const first = sockets.made[0];
  const secondSocket = KLAD_LOBBY.connect('ws://test/klad/api/race/' + ID, sockets.FakeWebSocket, clock);
  // when
  race.begin(ROOM, secondSocket);
  clock.advance(0);
  sockets.made[1].onopen();
  say({ type: 'countdown', seconds: 3 });
  first.onmessage({ data: JSON.stringify({ type: 'go', at: 1763000000000 }) });
  first.onclose({ code: 1000 });
  // then
  assert.equal(race.state().phase, 'countdown');
  assert.equal(engine.starts.length, 1);
});

/* ---- klad.js itself, in a vm context with a stub page ---- */

const ROW = (width) => '='.repeat(width);
const TEST_LEVELS = [{
  name: 'test',
  revision: 1,
  landscape: ['PE' + '.'.repeat(22), ...Array(15).fill(ROW(24))],
  portrait: ['.'.repeat(14) + 'EP', ...Array(23).fill(ROW(16))],
}];

function loadGame(options = {}) {
  const windowListeners = {};
  const events = [];
  const texts = [];
  const hashes = [];
  const elements = {};
  let frame = null;
  let time = 0;
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
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    dispatchEvent: (event) => events.push(event.type),
  };
  const sandbox = {
    KLAD_LEVELS: TEST_LEVELS,
    document,
    location: { hash: '' },
    history: { replaceState: (state, title, hash) => hashes.push(hash) },
    matchMedia: (query) => ({ matches: query === '(orientation: portrait)' && options.isPortrait === true }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    addEventListener: (type, listener) => { windowListeners[type] = listener; },
    performance: { now: () => 0 },
    requestAnimationFrame: (callback) => { frame = callback; },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'klad.js'), 'utf8'), sandbox);
  const game = vm.runInContext('KLAD_GAME', sandbox);
  function run(seconds) {
    for (let elapsed = 0; elapsed < seconds * 1000; elapsed += 16) {
      time += 16;
      frame(time);
    }
  }
  function hold(code, seconds) {
    const event = { code, repeat: false, target: { tagName: 'CANVAS', dataset: {} }, preventDefault() {} };
    windowListeners.keydown(event);
    run(seconds);
    windowListeners.keyup(event);
  }
  const key = (code) => hold(code, 0);
  const title = () => elements['msg-title'].textContent;
  return { game, events, texts, hashes, elements, run, key, hold, title };
}

function raceHooks() {
  const hooks = { finishes: [], ghostList: [] };
  hooks.onFinish = (ticks) => hooks.finishes.push(ticks);
  hooks.ghosts = () => hooks.ghostList;
  return hooks;
}

test('klad.js: a race plays the host\'s shape whatever this device\'s orientation, and keeps it after a death', () => {
  // given
  const { game, elements, run, key, hashes } = loadGame({ isPortrait: false });
  const hashesBefore = hashes.length;
  // when
  game.startRace(1, 'portrait', raceHooks());
  const start = game.racePosition();
  key('KeyR');
  run(3);
  // then
  assert.equal(start.x, 15);
  assert.equal(start.y, 0);
  assert.equal(game.racePosition().x, 15);
  assert.ok(elements.game.height > elements.game.width);
  assert.equal(hashes.length, hashesBefore);
});

test('klad.js: the exit in a race reports the ticks to the race and dispatches no klad:clear', () => {
  // given
  const { game, events, hold } = loadGame();
  const hooks = raceHooks();
  game.startRace(1, 'landscape', hooks);
  // when
  hold('ArrowRight', 1);
  // then
  assert.equal(hooks.finishes.length, 1);
  assert.ok(hooks.finishes[0] > 0);
  assert.deepEqual(events, []);
  assert.equal(game.racePosition(), null);
});

test('klad.js: the same exit outside a race dispatches klad:clear', () => {
  // given
  const { events, run, key, hold } = loadGame();
  key('Enter');
  run(2);
  // when
  hold('ArrowRight', 1);
  // then
  assert.deepEqual(events, ['klad:clear']);
});

test('klad.js: a race has no game over: deaths never end it and never dispatch klad:run', () => {
  // given
  const { game, events, run, key, title } = loadGame();
  game.startRace(1, 'landscape', raceHooks());
  // when
  for (let i = 0; i < 6; i++) {
    key('KeyR');
    run(3);
  }
  // then
  assert.deepEqual(events, []);
  assert.notEqual(title(), 'ИГРА ОКОНЧЕНА');
  assert.notEqual(game.racePosition(), null);
});

test('klad.js: after stopRace the title is back and a lost game reports its run again', () => {
  // given
  const { game, events, run, key, title } = loadGame();
  game.startRace(1, 'landscape', raceHooks());
  game.stopRace();
  const titleAfterRace = title();
  key('Enter');
  run(2);
  // when
  for (let i = 0; i < 4; i++) {
    key('KeyR');
    run(3);
  }
  // then
  assert.equal(titleAfterRace, 'КЛАД');
  assert.deepEqual(events, ['klad:run']);
  assert.equal(title(), 'ИГРА ОКОНЧЕНА');
});

test('klad.js: ghosts are drawn with the nick as canvas text, coloured by slot, not by nick', () => {
  // given
  const { game, texts, run } = loadGame();
  const hooks = raceHooks();
  hooks.ghostList = [
    { slot: 1, nick: '<img src=x>', x: 3, y: 0, direction: -1, alpha: 0.5 },
    { slot: 2, nick: '<img src=x>', x: 5, y: 0, direction: 1, alpha: 0.5 },
  ];
  game.startRace(1, 'landscape', hooks);
  // when
  run(0.02);
  // then
  const drawn = texts.slice(-2);
  assert.deepEqual(drawn.map((entry) => entry.text), ['<img src=x>', '<img src=x>']);
  assert.notEqual(drawn[0].colour, drawn[1].colour);
});

test('klad.js: no ghosts are drawn outside a race', () => {
  // given
  const { texts, run, key } = loadGame();
  // when
  key('Enter');
  run(2);
  // then
  assert.deepEqual(texts, []);
});
