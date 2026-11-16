'use strict';
/* klad/race.js without a browser, on the lobby's real socket module: a fake
   WebSocket opens, receives and drops only when a test says so, a fake clock
   runs timers only when a test advances it, and a fake engine records what
   the race asks of it. The last parts run klad.js itself and race.js's page
   half in a vm context with a stub page, for what only they can prove. */
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
    start(level, shape) {
      this.starts.push([level, shape]);
      return this.isStartable !== false;
    },
    stop() { this.stops++; },
  };
}

function setup(room = ROOM) {
  const clock = fakeClock();
  const sockets = fakeSockets();
  const engine = fakeEngine();
  const world = { isVisible: true };
  const page = { renders: 0, render() { this.renders++; } };
  const race = KLAD_RACE.create({
    clock,
    isVisible: () => world.isVisible,
    format: KLAD_TICKS.format,
    ticksPerSecond: KLAD_TICKS.PER_SECOND,
    engine: { start: (level, shape) => engine.start(level, shape), stop: () => engine.stop(), position: () => engine.position },
  }, page);
  const socket = KLAD_LOBBY.connect('ws://test/klad/api/race/' + ID, sockets.FakeWebSocket, clock);
  race.begin(room, socket);
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

test('a race begun in a room already racing (a reload) starts the level on the first state', () => {
  // given
  const { race, engine, server, say } = setup({ ...ROOM, state: 'racing' });
  server().onopen();
  // when
  say({ ...STATE, state: 'racing', positions: [{ slot: 1, x: 9, y: 3, tick: 900 }] });
  // then
  assert.deepEqual(engine.starts, [[3, 'portrait']]);
  assert.equal(race.state().phase, 'racing');
  assert.equal(race.ghosts().length, 1);
});

test('a state after a reload that shows this player finished waits for the results without starting the level', () => {
  // given
  const { race, engine, server, say } = setup({ ...ROOM, state: 'racing' });
  server().onopen();
  // when
  say({ ...STATE, state: 'racing', players: [{ ...ME, finished: true }, ANNA] });
  race.finish(1234);
  // then
  assert.deepEqual(engine.starts, []);
  assert.deepEqual(sentOf(server(), 'finish'), []);
  assert.equal(race.state().phase, 'finished');
  assert.equal(race.state().notice, TEXT.finishedWaiting);
  // when
  say({ type: 'results', places: [{ slot: 0, nick: 'test', kind: 'agent', place: 1, ticks: 1500, left: false }] });
  // then
  assert.equal(race.state().phase, 'results');
  assert.equal(race.state().places[0].isMine, true);
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

/* Sender ticks of one 200 ms position step. */
const STEP_TICKS = KLAD_TICKS.PER_SECOND / 5;
const pos = (x, y, tick) => ({ type: 'pos', slot: 1, nick: 'Anna', x, y, tick });
const ghostOf = (race) => race.ghosts()[0];

test('a ghost halfway between two positions of one attempt is at the midpoint', () => {
  // given
  const { race, clock, say } = racing();
  say(pos(4, 5, 24));
  clock.advance(200);
  say(pos(5, 5, 48));
  // when
  clock.advance(KLAD_RACE.GHOST_DELAY - 100);
  // then
  assert.deepEqual(race.ghosts(), [{ slot: 1, nick: 'Anna', x: 4.5, y: 5, direction: 1, alpha: KLAD_RACE.GHOST_ALPHA }]);
});

test('a ghost takes the position it reaches and faces the way it moved', () => {
  // given
  const { race, clock, say } = racing();
  say(pos(4, 5, 10));
  clock.advance(200);
  // when
  say(pos(3.5, 5, 10 + STEP_TICKS));
  clock.advance(1000);
  // then
  assert.deepEqual(race.ghosts(), [{ slot: 1, nick: 'Anna', x: 3.5, y: 5, direction: -1, alpha: KLAD_RACE.GHOST_ALPHA }]);
});

const MAX_FRAME_MOVE = 0.25;

/* Sends the positions at the given times (ms, tick) one cell apart and
   returns the ghost's x for every 10 ms frame until 1 s after the last one. */
function walkFrames(race, clock, say, arrivals) {
  const seen = [];
  let time = 0;
  const advanceTo = (target) => {
    for (; time < target; time += 10) {
      clock.advance(10);
      if (ghostOf(race)) seen.push(ghostOf(race).x);
    }
  };
  arrivals.forEach(([at, tick], index) => {
    advanceTo(at);
    say(pos(4 + index, 5, tick));
  });
  advanceTo(time + 1000);
  return seen;
}

const biggestFrameMove = (seen) => Math.max(...seen.slice(1).map((x, index) => Math.abs(x - seen[index])));

test('a ghost walking one way never moves back or hops, also when one message is 150 ms late and the next comes 50 ms after it', () => {
  // given
  const { race, clock, say } = racing();
  // when
  const seen = walkFrames(race, clock, say, [[0, 0], [200, STEP_TICKS], [550, 2 * STEP_TICKS], [600, 3 * STEP_TICKS], [800, 4 * STEP_TICKS]]);
  // then
  assert.deepEqual(seen, [...seen].sort((first, second) => first - second));
  assert.equal(seen[seen.length - 1], 8);
  assert.ok(biggestFrameMove(seen) <= MAX_FRAME_MOVE);
});

test('a ghost does not hop on every message when the latency rises by 150 ms for good', () => {
  // given
  const { race, clock, say } = racing();
  const arrivals = [[0, 0], [200, STEP_TICKS], [400, 2 * STEP_TICKS]];
  for (let index = 3; index < 12; index++) arrivals.push([150 + index * 200, index * STEP_TICKS]);
  // when
  const seen = walkFrames(race, clock, say, arrivals);
  // then
  assert.equal(seen[seen.length - 1], 15);
  assert.ok(biggestFrameMove(seen) <= MAX_FRAME_MOVE);
});

test('a ghost does not hop on every message after the sender loses ticks in one 300 ms frame', () => {
  // given
  const { race, clock, say } = racing();
  const arrivals = [[0, 0], [200, STEP_TICKS], [400, 2 * STEP_TICKS], [700, 2.5 * STEP_TICKS]];
  for (let index = 1; index < 9; index++) arrivals.push([700 + index * 200, (2.5 + index) * STEP_TICKS]);
  // when
  const seen = walkFrames(race, clock, say, arrivals);
  // then
  assert.equal(seen[seen.length - 1], 15);
  assert.ok(biggestFrameMove(seen) <= MAX_FRAME_MOVE);
});

test('a ghost does not hop when a late message is followed at once by the next one', () => {
  // given
  const { race, clock, say } = racing();
  const arrivals = [[0, 0], [200, STEP_TICKS], [590, 2 * STEP_TICKS], [590, 3 * STEP_TICKS], [800, 4 * STEP_TICKS]];
  // when
  const seen = walkFrames(race, clock, say, arrivals);
  // then
  assert.equal(seen[seen.length - 1], 8);
  assert.ok(biggestFrameMove(seen) <= MAX_FRAME_MOVE);
});

test('a ghost does not hop when three messages arrive together after a 450 ms stall', () => {
  // given
  const { race, clock, say } = racing();
  const arrivals = [[0, 0], [200, STEP_TICKS], [650, 2 * STEP_TICKS], [650, 3 * STEP_TICKS], [650, 4 * STEP_TICKS]];
  // when
  const seen = walkFrames(race, clock, say, arrivals);
  // then
  assert.equal(seen[seen.length - 1], 8);
  assert.ok(biggestFrameMove(seen) <= MAX_FRAME_MOVE);
});

test('a position with a lower tick than the one before is shown at once at its place', () => {
  // given
  const { race, clock, say } = racing();
  say(pos(4, 5, 5000));
  clock.advance(200);
  say(pos(5, 5, 5000 + STEP_TICKS));
  clock.advance(1000);
  // when
  say(pos(6, 5, 30));
  // then
  assert.equal(ghostOf(race).x, 6);
  assert.equal(ghostOf(race).y, 5);
});

test('a step of more than 3 cells is shown at once, a fall step of 1.8 cells still slides', () => {
  // given
  const { race, clock, say } = racing();
  say(pos(4, 2, 0));
  clock.advance(200);
  // when
  say(pos(4, 3.8, STEP_TICKS));
  const slidingY = ghostOf(race).y;
  clock.advance(1000);
  say(pos(4, 8, 2 * STEP_TICKS));
  // then
  assert.equal(slidingY, 2);
  assert.equal(ghostOf(race).y, 8);
});

test('with no newer position a ghost stays at the last one and never runs ahead, and fades as before', () => {
  // given
  const { race, clock, say } = racing();
  say(pos(4, 5, 0));
  clock.advance(200);
  say(pos(5, 5, STEP_TICKS));
  // when
  clock.advance(KLAD_RACE.FADE_AFTER);
  const atTwoSeconds = ghostOf(race);
  clock.advance(KLAD_RACE.FADE_FOR / 2);
  const halfWay = ghostOf(race);
  // then
  assert.equal(atTwoSeconds.x, 5);
  assert.equal(atTwoSeconds.alpha, KLAD_RACE.GHOST_ALPHA);
  assert.equal(halfWay.x, 5);
  assert.equal(halfWay.alpha, KLAD_RACE.GHOST_ALPHA / 2);
});

test('after the sender pauses for a second the ghost goes on from where it stood, with no jump and no hops on the next positions', () => {
  // given
  const { race, clock, say } = racing();
  say(pos(4, 5, 0));
  clock.advance(200);
  say(pos(5, 5, STEP_TICKS));
  clock.advance(1000);
  say(pos(6, 5, 2 * STEP_TICKS));
  const seen = [];
  // when
  for (let index = 0; index < 3; index++) {
    for (let step = 0; step < 20; step++) {
      clock.advance(10);
      seen.push(ghostOf(race).x);
    }
    say(pos(7 + index, 5, (3 + index) * STEP_TICKS));
  }
  clock.advance(1000);
  seen.push(ghostOf(race).x);
  // then
  assert.deepEqual(seen, [...seen].sort((first, second) => first - second));
  assert.ok(seen[0] >= 5);
  assert.equal(seen[seen.length - 1], 9);
  assert.ok(biggestFrameMove(seen.slice(0, -1)) <= MAX_FRAME_MOVE);
});

test('the positions kept per ghost are capped, also at 10 a second for 4 minutes', () => {
  // given
  const { race, clock, say } = racing();
  // when
  for (let index = 0; index < 4 * 60 * 10; index++) {
    say(pos(1 + (index % 20), 5, index * KLAD_TICKS.PER_SECOND / 10));
    clock.advance(100);
  }
  // then
  assert.equal(race.ghostSampleCount(1), KLAD_RACE.MAX_SAMPLES);
  assert.equal(race.ghosts().length, 1);
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
  const comeback = race.ghosts()[0];
  clock.advance(KLAD_RACE.GHOST_DELAY);
  assert.equal(comeback.alpha, KLAD_RACE.GHOST_ALPHA);
  assert.equal(comeback.x, 4);
  assert.equal(race.ghosts()[0].x, 6);
});

test('pos messages with a bad slot or position make no ghost', () => {
  // given
  const { race, say } = racing();
  // when
  say({ type: 'pos', slot: 10, nick: 'Anna', x: 4, y: 5, tick: 10 });
  say({ type: 'pos', slot: '1', nick: 'Anna', x: 4, y: 5, tick: 10 });
  say({ type: 'pos', slot: 1, nick: 'Anna', x: '4', y: 5, tick: 10 });
  say({ type: 'pos', slot: 1, nick: 'Anna', y: 5, tick: 10 });
  say({ type: 'pos', slot: 1, nick: 'Anna', x: 4, y: 5 });
  say({ type: 'pos', slot: 1, nick: 'Anna', x: 4, y: 5, tick: '10' });
  // then
  assert.deepEqual(race.ghosts(), []);
});

test('a pos from slot 9 makes a ghost and from slot 10 none', () => {
  // given
  const { race, say } = racing();
  // when
  say({ type: 'pos', slot: 9, nick: 'Anna', x: 4, y: 5, tick: 10 });
  say({ type: 'pos', slot: 10, nick: 'Boris', x: 4, y: 5, tick: 10 });
  // then
  assert.deepEqual(race.ghosts().map((ghost) => ghost.slot), [9]);
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

test('results of 10 places show finishers by place, then those with no finish', () => {
  // given
  const { race, say } = racing();
  const finishers = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((slot) => (
    { slot, nick: 'P' + slot, kind: 'human', place: 10 - slot, ticks: 1000 + slot, left: false }));
  // when
  say({ type: 'results', places: [
    { slot: 0, nick: 'P0', kind: 'human', place: null, ticks: null, left: true },
    ...finishers,
  ] });
  // then
  assert.deepEqual(race.state().places.map((entry) => entry.nick),
    ['P9', 'P8', 'P7', 'P6', 'P5', 'P4', 'P3', 'P2', 'P1', 'P0']);
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

test('a state after a reconnect replaces the ghosts at once, even in the middle of a slide', () => {
  // given
  const { race, clock, server, say } = racing();
  say(pos(4, 5, 0));
  clock.advance(200);
  say(pos(5, 5, STEP_TICKS));
  clock.advance(KLAD_RACE.GHOST_DELAY - 100);
  // when
  server().onclose({ code: NETWORK_DROP });
  clock.advance(500);
  server().onopen();
  say({ ...STATE, state: 'racing', positions: [{ slot: 1, x: 9, y: 3, tick: 900 }] });
  // then
  assert.deepEqual(race.ghosts(), [{ slot: 1, nick: 'Anna', x: 9, y: 3, direction: 1, alpha: KLAD_RACE.GHOST_ALPHA }]);
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
  const typeIn = (code) => windowListeners.keydown({ code, repeat: false, target: { tagName: 'INPUT', dataset: {} }, preventDefault() {} });
  const title = () => elements['msg-title'].textContent;
  return { game, events, texts, hashes, elements, run, key, hold, typeIn, title };
}

function raceHooks() {
  const hooks = { finishes: [], ghostList: [] };
  hooks.onFinish = (ticks) => hooks.finishes.push(ticks);
  hooks.ghosts = () => hooks.ghostList;
  return hooks;
}

test('klad.js: keys typed in a text field, such as the lobby chat, start no game and move no runner', () => {
  // given
  const { game, run, key, typeIn, title } = loadGame();
  const titleBefore = title();
  game.startRace(1, 'landscape', raceHooks());
  const start = game.racePosition();

  // when
  for (const code of ['Enter', 'Space', 'ArrowRight', 'ArrowDown', 'KeyD']) typeIn(code);
  run(1);
  const afterTyping = game.racePosition();
  game.stopRace();
  for (const code of ['Enter', 'Space', 'KeyZ']) typeIn(code);
  run(1);
  const titleAfterTyping = title();
  key('Enter');

  // then
  assert.equal(titleBefore, 'КЛАД');
  assert.deepEqual([afterTyping.x, afterTyping.y], [start.x, start.y]);
  assert.equal(titleAfterTyping, 'КЛАД');
  assert.notEqual(title(), 'КЛАД');
});

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

test('klad.js: ghosts of slots 0 to 9 are drawn in 10 different colours', () => {
  // given
  const { game, texts, run } = loadGame();
  const hooks = raceHooks();
  hooks.ghostList = Array.from({ length: 10 }, (unused, slot) => (
    { slot, nick: 'P' + slot, x: slot + 1, y: 0, direction: 1, alpha: 0.5 }));
  game.startRace(1, 'landscape', hooks);
  // when
  run(0.02);
  // then
  const colours = texts.slice(-10).map((entry) => entry.colour);
  assert.equal(new Set(colours).size, 10);
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

/* ---- race.js's page half, in a vm context with stub dialogs ---- */

function loadRacePage() {
  const documentListeners = {};
  const elements = {};
  const lobbyCalls = [];
  const closeEvents = [];
  const node = () => ({
    textContent: '', className: '', hidden: false, open: false, listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    focus() {}, append() {}, replaceChildren() {},
    createCaption: () => node(), createTHead: () => node(), createTBody: () => node(),
    insertRow: () => node(), insertCell: () => node(),
    showModal() { this.open = true; },
    /* A browser fires close later, after the handler that closed the dialog. */
    close() {
      if (!this.open) return;
      this.open = false;
      closeEvents.push(() => { if (this.listeners.close) this.listeners.close(); });
    },
  });
  const document = {
    visibilityState: 'visible',
    getElementById: (id) => elements[id] || (elements[id] = node()),
    createElement: () => node(),
    querySelector: () => (Object.values(elements).some((element) => element.open) ? {} : null),
    addEventListener: (type, listener) => { documentListeners[type] = listener; },
  };
  const sandbox = {
    document,
    KLAD_LEVELS: [{ name: 'test' }, { name: 'test' }],
    KLAD_TICKS,
    KLAD_GAME: { startRace: () => true, stopRace() {}, racePosition: () => null },
    KLAD_LOBBY: { page: { open: () => lobbyCalls.push('open'), leave: () => lobbyCalls.push('leave') } },
    Date,
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'race.js'), 'utf8'), sandbox);
  const messageListeners = [];
  const socket = {
    send: () => true,
    on: (type, listener) => { if (type === 'message') messageListeners.push(listener); },
    status: () => 'open',
    hasOpened: () => true,
  };
  documentListeners['klad:race']({ detail: { room: ROOM, socket } });
  const say = (message) => { for (const listener of messageListeners) listener(message); };
  const fireCloseEvents = () => { while (closeEvents.length > 0) closeEvents.shift()(); };
  return { elements, lobbyCalls, say, fireCloseEvents, dialog: elements.race };
}

test('race.js: closing the finish screen with Escape leaves the room', () => {
  // given
  const { lobbyCalls, say, fireCloseEvents, dialog } = loadRacePage();
  say({ type: 'results', places: [] });
  const isShown = dialog.open;
  // when
  dialog.close();
  fireCloseEvents();
  // then
  assert.equal(isShown, true);
  assert.deepEqual(lobbyCalls, ['leave']);
});

test('race.js: the back to room button on the finish screen opens the lobby and stays in the room', () => {
  // given
  const { elements, lobbyCalls, say, fireCloseEvents, dialog } = loadRacePage();
  say({ type: 'results', places: [] });
  // when
  elements['race-room'].listeners.click();
  fireCloseEvents();
  // then
  assert.equal(dialog.open, false);
  assert.deepEqual(lobbyCalls, ['open']);
});

test('race.js: go closes the countdown dialog without leaving the room', () => {
  // given
  const { lobbyCalls, say, fireCloseEvents, dialog } = loadRacePage();
  say({ type: 'countdown', seconds: 3 });
  const isShown = dialog.open;
  // when
  say({ type: 'go', at: 1763000000000 });
  fireCloseEvents();
  // then
  assert.equal(isShown, true);
  assert.equal(dialog.open, false);
  assert.deepEqual(lobbyCalls, []);
});

test('race.js: a reload after the own finish closes the lobby and shows the waiting line on the field', () => {
  // given
  const { elements, lobbyCalls, say, fireCloseEvents } = loadRacePage();
  elements.lobby.open = true;
  // when
  say({ ...STATE, state: 'racing', players: [{ ...ME, finished: true }, ANNA] });
  fireCloseEvents();
  // then
  assert.equal(elements.lobby.open, false);
  assert.equal(elements['race-notice'].textContent, TEXT.finishedWaiting);
  assert.equal(elements['race-status'].textContent, '');
  assert.deepEqual(lobbyCalls, []);
});

/* ---- hostile and failing input ---- */

test('a position outside the grid plus one cell makes no ghost', () => {
  // given
  const { race, say } = racing();

  // when
  say({ type: 'pos', slot: 1, nick: 'Anna', x: 25, y: 3, tick: 1 });
  say({ type: 'pos', slot: 1, nick: 'Anna', x: 3, y: -1, tick: 1 });
  say({ type: 'pos', slot: 2, nick: 'Anna', x: 24, y: 0, tick: 1 });

  // then
  assert.deepEqual(race.ghosts().map((ghost) => ghost.slot), [2]);
});

test('a time over the race cap shows as a dash in the results', () => {
  // given
  const { race, say } = racing();

  // when
  say({ type: 'results', places: [
    { slot: 1, nick: 'Anna', place: 1, ticks: 4 * 60 * 120 + 1200 + 1, left: false },
    { slot: 0, nick: 'test', place: 2, ticks: 1500, left: false },
  ] });

  // then
  assert.deepEqual(race.state().places.map((entry) => entry.time), ['-', '0:12.50']);
});

test('a go the engine cannot start ends the race with a notice', () => {
  // given
  const { race, engine, server, say } = setup();
  engine.isStartable = false;
  server().onopen();
  say(STATE);

  // when
  say({ type: 'go', at: 1763000000000 });

  // then
  assert.equal(race.state().phase, 'idle');
  assert.equal(race.state().notice, TEXT.notStarted);
  assert.equal(engine.stops, 1);
});

test('a socket closed by the own leave ends the race with the left notice, not the server one', () => {
  // given
  const { race, socket, clock } = racing();

  // when
  socket.close(true);
  clock.advance(0);

  // then
  assert.equal(race.state().phase, 'idle');
  assert.equal(race.state().notice, TEXT.left);
});
