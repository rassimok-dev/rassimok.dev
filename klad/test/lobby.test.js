'use strict';
/* klad/lobby.js without a browser. The fake server answers by method and
   path, in order, repeating its last answer; a path it does not know gets
   404. A held request waits for its release. The fake clock runs timers
   only when a test advances it, and a fake WebSocket opens, receives and
   drops only when a test says so. */
const test = require('node:test');
const assert = require('node:assert/strict');
const KLAD_LOBBY = require('../lobby.js');
const KLAD_ONLINE = require('../online.js');

const { TEXT } = KLAD_LOBBY;
const OFFLINE = 'offline';
const HOUR = 60 * 60 * 1000;
const ID = 'Room_id-42';
const ME = { nick: 'test', kind: 'agent', account: false, email: null };
const ANNA = { nick: 'Anna', kind: 'human', ready: false, host: true, you: false };
const MINE = { nick: 'test', kind: 'agent', ready: false, host: false, you: true };
const ONLINE = [{ nick: 'Anna', guest: false, kind: 'human' }, { nick: 'test', guest: true, kind: 'agent' }];
const PRESENCE = {
  'POST /klad/api/presence': [[204]],
  'GET /klad/api/presence': [[200, { players: ONLINE }]],
};
const HEARTBEAT = 'POST /klad/api/presence';
const ONLINE_LIST = 'GET /klad/api/presence';
const CREATE = 'POST /klad/api/rooms';
const POLL = 'GET /klad/api/rooms/' + ID;
const JOIN = 'POST /klad/api/rooms/' + ID + '/join';
const LEAVE = 'POST /klad/api/rooms/' + ID + '/leave';

function room(changes) {
  return { id: ID, state: 'lobby', host: { nick: 'Anna' }, players: [ANNA, MINE], level: 1, shape: 'landscape', size: 4,
    ...changes };
}
const HOSTED = room({ host: { nick: 'test' }, players: [{ ...MINE, host: true }] });

function fakeServer(answers) {
  const calls = [];
  const holds = {};
  async function fetch(url, options) {
    const request = options.method + ' ' + url;
    calls.push(options.body === undefined ? request : request + ' ' + options.body);
    if (holds[request]) await holds[request];
    const queue = answers[request] || [[404, { error: 'not_found' }]];
    const [status, body] = queue.length > 1 ? queue.shift() : queue[0];
    if (status === OFFLINE) throw new TypeError('fetch failed');
    return { status, json: async () => { if (body === undefined) throw new SyntaxError('no body'); return body; } };
  }
  function hold(request) {
    let release;
    holds[request] = new Promise((resolve) => { release = resolve; });
    return () => { delete holds[request]; release(); };
  }
  return { fetch, calls, answers, hold };
}

const settle = async () => { for (let i = 0; i < 3; i++) await new Promise((resolve) => setImmediate(resolve)); };

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
    pending: () => timers.size,
    async advance(milliseconds) {
      const end = time + milliseconds;
      for (;;) {
        let next = null;
        for (const [id, timer] of timers) if (timer.at <= end && (next === null || timer.at < next.at)) next = { id, ...timer };
        if (next === null) break;
        timers.delete(next.id);
        time = next.at;
        next.task();
        await settle();
      }
      time = end;
      await settle();
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

function setup(answers, options = {}) {
  const server = fakeServer(answers);
  const clock = fakeClock();
  const sockets = fakeSockets();
  const world = { isVisible: true, player: 'player' in options ? options.player : ME, shape: options.shape || 'landscape' };
  const page = {
    asked: 0,
    races: [],
    render() {},
    askNick() { this.asked++; },
    race(polledRoom, socket) { this.races.push({ room: polledRoom, socket }); },
  };
  const WebSocket = 'WebSocket' in options ? options.WebSocket : sockets.FakeWebSocket;
  const lobby = KLAD_LOBBY.create({
    call: (method, path, body) => KLAD_ONLINE.request(server.fetch, method, path, body),
    clock,
    isVisible: () => world.isVisible,
    player: () => world.player,
    refreshPlayer: async () => {},
    isAvailable: () => true,
    shape: () => world.shape,
    openSocket: (id) => KLAD_LOBBY.connect(KLAD_LOBBY.raceUrl('https:', 'rassimok.dev', id), WebSocket, clock),
  }, page);
  return { lobby, server, clock, sockets, world, page };
}

const count = (calls, request) => calls.filter((call) => call === request).length;
const roomCalls = (calls) => calls.filter((call) => call.includes('/rooms'));

async function joined(answers, options) {
  const run = setup({ ...PRESENCE, [JOIN]: [[200, room()]], [POLL]: [[200, room()]], ...answers }, options);
  await run.lobby.open(ID);
  await settle();
  return run;
}

async function hosting(answers, options) {
  const run = setup({ ...PRESENCE, [CREATE]: [[201, { id: ID }]], [POLL]: [[200, HOSTED]], ...answers }, options);
  await run.lobby.open();
  await settle();
  await run.lobby.createRoom();
  await settle();
  return run;
}

/* ---- the room link ---- */

test('roomIdOf reads the id after #room= and leaves every other hash alone', () => {
  // given
  const { roomIdOf } = KLAD_LOBBY;

  // when / then
  assert.equal(roomIdOf('#room=' + ID), ID);
  assert.equal(roomIdOf('#room=../x'), '../x');
  assert.equal(roomIdOf('#room='), '');
  assert.equal(roomIdOf('#3'), null);
  assert.equal(roomIdOf(''), null);
  assert.equal(roomIdOf('#ROOM=' + ID), null);
});

test('isRoomId accepts exactly 10 Latin letters, digits, _ and -', () => {
  // given
  const valid = ['abcdefghij', 'AZaz09_-_-', ID];
  const invalid = ['../x', '', 'abcdefghi', 'abcdefghijk', 'abcdefghi!', 'abcdefghi/', 'abcdefghi\n', 'abcdefghij\n',
    'abcdefghi%', 'абвгдежзик', undefined, null, 1234567890];

  // when / then
  for (const id of valid) assert.equal(KLAD_LOBBY.isRoomId(id), true, id);
  for (const id of invalid) assert.equal(KLAD_LOBBY.isRoomId(id), false, String(id));
});

test('a room link with a malformed id says room not found and sends no request', async () => {
  // given
  const { lobby, server, clock, page } = setup(PRESENCE);

  // when
  await lobby.open('../x');
  await clock.advance(5 * 60 * 1000);

  // then
  assert.deepEqual(server.calls, []);
  assert.equal(clock.pending(), 0);
  assert.equal(page.asked, 0);
  assert.equal(lobby.state().phase, 'message');
  assert.equal(lobby.state().message, TEXT.roomNotFound);
});

test('the race socket URL is the same host under /klad/api/race/, wss on https', () => {
  // when / then
  assert.equal(KLAD_LOBBY.raceUrl('https:', 'rassimok.dev', ID), 'wss://rassimok.dev/klad/api/race/' + ID);
  assert.equal(KLAD_LOBBY.raceUrl('http:', 'localhost:8000', ID), 'ws://localhost:8000/klad/api/race/' + ID);
});

/* ---- room state to view, and the Start condition ---- */

test('roomView turns the polled room into what the room view shows', () => {
  // given
  const polled = room({ level: 3, shape: 'portrait', players: [{ ...ANNA, ready: true }, MINE] });

  // when
  const view = KLAD_LOBBY.roomView(polled);

  // then
  assert.deepEqual(view, {
    id: ID, state: 'lobby', level: 3, shape: 'portrait', size: 4,
    players: [
      { nick: 'Anna', kind: 'human', isReady: true, isHost: true },
      { nick: 'test', kind: 'agent', isReady: false, isHost: false },
    ],
    isMember: true, isHost: false, isReady: false, canStart: false,
  });
});

test('roomView finds this player by you, not by nick and kind, and a missing one is no member', () => {
  // given
  const twin = { ...MINE, you: false, host: true, ready: true };
  const polled = room({ players: [twin, { ...MINE, ready: false }] });
  const strangers = room({ players: [ANNA, { ...MINE, you: false }] });

  // when
  const view = KLAD_LOBBY.roomView(polled);
  const missing = KLAD_LOBBY.roomView(strangers);

  // then
  assert.equal(view.isMember, true);
  assert.equal(view.isHost, false);
  assert.equal(view.isReady, false);
  assert.equal(missing.isMember, false);
  assert.equal(missing.isHost, false);
});

test('roomView handles an empty room with no host and no players', () => {
  // given
  const empty = room({ host: null, players: [] });

  // when
  const view = KLAD_LOBBY.roomView(empty);

  // then
  assert.deepEqual(view.players, []);
  assert.equal(view.isMember, false);
  assert.equal(view.canStart, false);
});

test('Start is offered only to the host, when everyone is ready and there are at least 2 players', () => {
  // given
  const me = { ...MINE, host: true, ready: true };
  const other = { ...ANNA, host: false, ready: true };
  const canStart = (changes) => KLAD_LOBBY.roomView(room(changes)).canStart;

  // when / then
  assert.equal(canStart({ players: [me, other] }), true);
  assert.equal(canStart({ players: [me] }), false);
  assert.equal(canStart({ players: [me, { ...other, ready: false }] }), false);
  assert.equal(canStart({ players: [{ ...me, ready: false }, other] }), false);
  assert.equal(canStart({ players: [{ ...me, host: false }, { ...other, host: true }] }), false);
  assert.equal(canStart({ players: [me, other], state: 'starting' }), false);
});

/* ---- presence: the heartbeat and the online list ---- */

test('opening the lobby sends the heartbeat, then the online list, and repeats both every 30 s', async () => {
  // given
  const { lobby, server, clock } = setup(PRESENCE);

  // when
  await lobby.open();
  await settle();

  // then
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST]);
  assert.deepEqual(lobby.state().online, ONLINE);
  assert.equal(lobby.state().phase, 'ready');

  // when
  await clock.advance(KLAD_LOBBY.PRESENCE_EVERY - 1);

  // then
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST]);

  // when
  await clock.advance(1);

  // then
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST, HEARTBEAT, ONLINE_LIST]);
});

test('a hidden tab sends no heartbeat, and showing it again sends one at once after 30 s', async () => {
  // given
  const { lobby, server, clock, world } = setup(PRESENCE);
  await lobby.open();
  await clock.advance(10 * 1000);

  // when
  world.isVisible = false;
  lobby.onVisibility();
  await clock.advance(2 * 60 * 1000);

  // then
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST]);
  assert.equal(clock.pending(), 0);

  // when
  world.isVisible = true;
  lobby.onVisibility();
  await settle();

  // then
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST, HEARTBEAT, ONLINE_LIST]);
});

test('hiding and showing the tab quickly keeps to one heartbeat per 30 s', async () => {
  // given
  const { lobby, server, clock, world } = setup(PRESENCE);
  await lobby.open();
  await settle();

  // when
  for (let i = 0; i < 5; i++) {
    world.isVisible = false;
    lobby.onVisibility();
    await clock.advance(1000);
    world.isVisible = true;
    lobby.onVisibility();
    await clock.advance(4000);
  }

  // then
  assert.equal(clock.now(), 25 * 1000);
  assert.equal(count(server.calls, HEARTBEAT), 1);

  // when
  await clock.advance(5000);

  // then
  assert.equal(count(server.calls, HEARTBEAT), 2);
});

test('nothing is sent while the lobby is closed, and nothing before it is first opened', async () => {
  // given
  const { lobby, server, clock } = setup(PRESENCE);

  // when
  await clock.advance(5 * 60 * 1000);

  // then
  assert.deepEqual(server.calls, []);

  // when
  await lobby.open();
  await settle();
  lobby.close();
  await clock.advance(10 * 60 * 1000);

  // then
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST]);
  assert.equal(clock.pending(), 0);
});

test('a network failure on presence shows offline, keeps the game going and tries again in 30 s', async () => {
  // given
  const { lobby, server, clock } = setup({
    'POST /klad/api/presence': [[OFFLINE], [204]],
    'GET /klad/api/presence': [[OFFLINE], [200, { players: ONLINE }]],
  });

  // when
  await lobby.open();
  await settle();

  // then
  assert.equal(lobby.state().isOnlineDown, true);
  assert.equal(lobby.state().phase, 'ready');

  // when
  await clock.advance(KLAD_LOBBY.PRESENCE_EVERY);

  // then
  assert.equal(lobby.state().isOnlineDown, false);
  assert.deepEqual(lobby.state().online, ONLINE);
  assert.equal(count(server.calls, HEARTBEAT), 2);
});

test('401 on the heartbeat means no player: the lobby stops sending and offers the nick', async () => {
  // given
  const { lobby, server, clock } = setup({ 'POST /klad/api/presence': [[401, { error: 'no_session' }]] });

  // when
  await lobby.open();
  await settle();
  await clock.advance(5 * 60 * 1000);

  // then
  assert.deepEqual(server.calls, [HEARTBEAT]);
  assert.equal(lobby.state().phase, 'no-nick');
  assert.equal(lobby.state().message, TEXT.noPlayer);
  assert.equal(clock.pending(), 0);
});

/* ---- rooms: create, join, the poll ---- */

test('create room posts /rooms and polls the new room once at once', async () => {
  // given / when
  const { lobby, server } = await hosting();

  // then
  assert.deepEqual(roomCalls(server.calls), [CREATE, POLL]);
  assert.equal(lobby.state().roomId, ID);
  assert.equal(lobby.state().room.isHost, true);
});

test('a host in portrait sends the shape with the first level choice', async () => {
  // given / when
  const { server } = await hosting({ ['POST /klad/api/rooms/' + ID + '/level']: [[200, { ...HOSTED, shape: 'portrait' }]] },
    { shape: 'portrait' });

  // then
  assert.deepEqual(roomCalls(server.calls), [
    CREATE, 'POST /klad/api/rooms/' + ID + '/level {"level":1,"shape":"portrait"}', POLL,
  ]);
});

test('a level choice sends the level with the host\'s current shape', async () => {
  // given
  const { lobby, server, world } = await hosting({ ['POST /klad/api/rooms/' + ID + '/level']: [[200, HOSTED]] });
  world.shape = 'portrait';

  // when
  await lobby.chooseLevel(4);
  await settle();

  // then
  assert.deepEqual(roomCalls(server.calls).slice(2), [
    'POST /klad/api/rooms/' + ID + '/level {"level":4,"shape":"portrait"}', POLL,
  ]);
});

test('too many rooms (429) says so and stays outside a room', async () => {
  // given
  const { lobby, server } = setup({ ...PRESENCE, [CREATE]: [[429, { error: 'rate_limited' }]] });
  await lobby.open();

  // when
  await lobby.createRoom();
  await settle();

  // then
  assert.deepEqual(roomCalls(server.calls), [CREATE]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.tooManyRooms);
});

test('a room link with a nick joins the room and polls it once at once', async () => {
  // given / when
  const { lobby, server } = await joined();

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, POLL]);
  assert.equal(lobby.state().roomId, ID);
  assert.equal(lobby.state().room.isMember, true);
});

test('a room link opened in a hidden tab joins only once the tab is visible', async () => {
  // given
  const { lobby, server, world } = setup({ ...PRESENCE, [JOIN]: [[200, room()]], [POLL]: [[200, room()]] });
  world.isVisible = false;

  // when
  await lobby.open(ID);
  await settle();

  // then
  assert.deepEqual(server.calls, []);

  // when
  world.isVisible = true;
  lobby.onVisibility();
  await settle();

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, POLL]);
});

test('a poll does not overtake a join that is still out, even when the tab is shown again', async () => {
  // given
  const { lobby, server, world } = setup({ ...PRESENCE, [JOIN]: [[200, room()]], [POLL]: [[200, room()]] });
  const release = server.hold(JOIN);
  await lobby.open(ID);
  await settle();

  // when
  world.isVisible = false;
  lobby.onVisibility();
  world.isVisible = true;
  lobby.onVisibility();
  await settle();

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN]);

  // when
  release();
  await settle();

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, POLL]);
  assert.equal(lobby.state().roomId, ID);
  assert.equal(lobby.state().message, '');
});

test('a room link without a nick asks for the nick first and joins once there is one', async () => {
  // given
  const { lobby, server, world, page } = setup({ ...PRESENCE, [JOIN]: [[200, room()]], [POLL]: [[200, room()]] },
    { player: null });

  // when
  await lobby.open(ID);
  lobby.close();

  // then
  assert.equal(page.asked, 1);
  assert.equal(lobby.state().phase, 'closed');
  assert.deepEqual(server.calls, []);

  // when
  world.player = ME;
  const shouldReopen = lobby.afterNick();
  await lobby.open();
  await settle();

  // then
  assert.equal(shouldReopen, true);
  assert.deepEqual(roomCalls(server.calls), [JOIN, POLL]);
  assert.equal(lobby.state().roomId, ID);
});

test('skipping the nick prompt drops the room link', async () => {
  // given
  const { lobby, server, world, page } = setup({ ...PRESENCE, [JOIN]: [[200, room()]] }, { player: null });
  await lobby.open(ID);
  lobby.close();

  // when
  const shouldReopen = lobby.afterNick();
  world.player = ME;
  await lobby.open();
  await settle();

  // then
  assert.equal(page.asked, 1);
  assert.equal(shouldReopen, false);
  assert.deepEqual(roomCalls(server.calls), []);
});

test('an unknown room (404 on join) says room not found and polls no more', async () => {
  // given / when
  const { lobby, server, clock } = await joined({ [JOIN]: [[404, { error: 'not_found' }]] });
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.roomNotFound);
});

test('a full room (409 room_full on join) says room is full', async () => {
  // given / when
  const { lobby, server, clock } = await joined({ [JOIN]: [[409, { error: 'room_full' }]] });
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.roomFull);
});

test('joining one\'s own full room in a race (200 on join) shows the room, not an error', async () => {
  // given
  const racing = room({ state: 'racing', players: [{ ...ANNA }, { ...MINE }, { ...ANNA, you: false }, { ...ANNA, you: false }] });

  // when
  const { lobby } = await joined({ [JOIN]: [[200, racing]], [POLL]: [[200, racing]] });

  // then
  assert.equal(lobby.state().roomId, ID);
  assert.equal(lobby.state().room.isMember, true);
  assert.equal(lobby.state().message, '');
});

test('the room poll runs every 10 s while the room view is visible', async () => {
  // given
  const { server, clock } = await joined();

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY - 1);

  // then
  assert.equal(count(server.calls, POLL), 1);

  // when
  await clock.advance(1);
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(count(server.calls, POLL), 3);
});

test('the room poll stops while the tab is hidden and starts again when it is shown', async () => {
  // given
  const { lobby, server, clock, world } = await joined();

  // when
  world.isVisible = false;
  lobby.onVisibility();
  await clock.advance(60 * 1000);

  // then
  assert.equal(count(server.calls, POLL), 1);
  assert.equal(clock.pending(), 0);

  // when
  world.isVisible = true;
  lobby.onVisibility();
  await settle();

  // then
  assert.equal(count(server.calls, POLL), 2);
});

test('closing the lobby in a lobby-state room leaves it and stops the poll', async () => {
  // given
  const { lobby, server, clock } = await joined({ [LEAVE]: [[204]] });

  // when
  lobby.close();
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, POLL, LEAVE]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(clock.pending(), 0);
});

test('closing the lobby while POST /rooms is out sends no level choice and leaves the new room', async () => {
  // given
  const { lobby, server, clock } = setup({ ...PRESENCE, [CREATE]: [[201, { id: ID }]], [LEAVE]: [[204]] }, { shape: 'portrait' });
  await lobby.open();
  await settle();
  const release = server.hold(CREATE);
  const creating = lobby.createRoom();
  await settle();

  // when
  lobby.close();
  release();
  await creating;
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [CREATE, LEAVE]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(clock.pending(), 0);
});

test('closing the lobby while a join is out sends the leave only after the join answers', async () => {
  // given
  const { lobby, server, clock } = setup({ ...PRESENCE, [JOIN]: [[200, room()]], [LEAVE]: [[204]] });
  const release = server.hold(JOIN);
  await lobby.open(ID);
  await settle();

  // when
  lobby.close();
  await settle();

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN]);

  // when
  release();
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, LEAVE]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(clock.pending(), 0);
});

test('leave posts /leave, forgets the room and stops the poll while the lobby stays open', async () => {
  // given
  const { lobby, server, clock } = await joined({ [LEAVE]: [[204]] });

  // when
  await lobby.leave();
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, POLL, LEAVE]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().phase, 'ready');
});

test('a room that expired (404 on a poll) says room not found and the poll stops', async () => {
  // given
  const { lobby, server, clock } = await joined({ [POLL]: [[200, room()], [404, { error: 'not_found' }]] });

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);
  await clock.advance(60 * 1000);

  // then
  assert.equal(count(server.calls, POLL), 2);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.roomNotFound);
});

test('a poll that no longer lists this player within a minute of the last one ends the room view, with no re-join', async () => {
  // given
  const { lobby, server, clock } = await joined({ [POLL]: [[200, room()], [200, room({ players: [ANNA] })]] });

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, POLL, POLL]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.removed);
});

test('a host back after 90 s hidden joins the room once more, keeps it and sees the new host', async () => {
  // given
  const { lobby, server, clock, world } = await hosting({ [JOIN]: [[200, room()]] });
  server.answers[POLL] = [[200, room({ players: [ANNA] })], [200, room()]];
  world.isVisible = false;
  lobby.onVisibility();
  await clock.advance(90 * 1000);
  const release = server.hold(POLL);

  // when
  world.isVisible = true;
  lobby.onVisibility();
  await settle();
  release();
  await settle();

  // then
  assert.equal(count(server.calls, HEARTBEAT), 2, 'a heartbeat went out on return, next to the held poll');
  assert.deepEqual(roomCalls(server.calls), [CREATE, POLL, POLL, JOIN, POLL]);
  assert.equal(lobby.state().roomId, ID);
  assert.equal(lobby.state().message, '');
  assert.equal(lobby.state().room.isHost, false);
  assert.deepEqual(lobby.state().room.players.map((player) => player.isHost), [true, false]);
});

test('a re-join answered with room_full says room is full and polls no more', async () => {
  // given
  const full = room({ players: [ANNA, { ...ANNA, host: false }, { ...ANNA, host: false }, { ...ANNA, host: false }] });
  const { lobby, server, clock, world } = await hosting({ [JOIN]: [[409, { error: 'room_full' }]] });
  server.answers[POLL] = [[200, full]];
  world.isVisible = false;
  lobby.onVisibility();
  await clock.advance(90 * 1000);

  // when
  world.isVisible = true;
  lobby.onVisibility();
  await settle();
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [CREATE, POLL, POLL, JOIN]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.roomFull);
});

test('a re-join is tried once: a poll right after it that still misses this player ends the room view', async () => {
  // given
  const { lobby, server, clock, world } = await hosting({ [JOIN]: [[200, room()]] });
  server.answers[POLL] = [[200, room({ players: [ANNA] })]];
  world.isVisible = false;
  lobby.onVisibility();
  await clock.advance(90 * 1000);

  // when
  world.isVisible = true;
  lobby.onVisibility();
  await settle();
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [CREATE, POLL, POLL, JOIN, POLL]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.removed);
});

test('a room already starting without this player is not joined again', async () => {
  // given
  const { lobby, server, clock, world, sockets } = await hosting({ [JOIN]: [[200, room()]] });
  server.answers[POLL] = [[200, room({ state: 'starting', players: [ANNA] })]];
  world.isVisible = false;
  lobby.onVisibility();
  await clock.advance(90 * 1000);

  // when
  world.isVisible = true;
  lobby.onVisibility();
  await settle();

  // then
  assert.deepEqual(roomCalls(server.calls), [CREATE, POLL, POLL]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.removed);
  assert.deepEqual(sockets.made, []);
});

test('a network failure on the poll shows offline, keeps the room and polls again', async () => {
  // given
  const { lobby, clock } = await joined({ [POLL]: [[200, room()], [OFFLINE], [200, room()]] });

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(lobby.state().isRoomDown, true);
  assert.equal(lobby.state().roomId, ID);

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(lobby.state().isRoomDown, false);
});

/* ---- re-join edges ---- */

const READY = 'POST /klad/api/rooms/' + ID + '/ready';
const OTHER = 'Other_id-7';
const OTHER_JOIN = 'POST /klad/api/rooms/' + OTHER + '/join';
const DROPPED = room({ players: [ANNA] });

async function hostHiddenFor(milliseconds, answers) {
  const run = await hosting(answers);
  run.world.isVisible = false;
  run.lobby.onVisibility();
  await run.clock.advance(milliseconds);
  return run;
}

async function showAgain({ world, lobby }) {
  world.isVisible = true;
  lobby.onVisibility();
  await settle();
}

test('a heartbeat that answers 204 does not count as seen: a visible tab back from a long outage joins again', async () => {
  // given
  const { lobby, server, clock } = await joined({});
  server.answers[POLL] = [[OFFLINE]];
  await clock.advance(85 * 1000);

  // when
  server.answers[POLL] = [[200, DROPPED], [200, room()]];
  await clock.advance(15 * 1000);

  // then
  assert.equal(count(server.calls, JOIN), 2);
  assert.equal(lobby.state().roomId, ID);
  assert.equal(lobby.state().message, '');
});

test('a tap on Ready while the return poll is out joins again and keeps the room', async () => {
  // given
  const run = await hostHiddenFor(90 * 1000, { [JOIN]: [[200, room()]] });
  run.server.answers[POLL] = [[200, DROPPED], [200, room()]];
  const release = run.server.hold(POLL);
  await showAgain(run);

  // when
  const tapped = run.lobby.toggleReady();
  await settle();
  release();
  await tapped;
  await settle();

  // then
  assert.equal(count(run.server.calls, READY + ' {"ready":true}'), 1);
  assert.equal(count(run.server.calls, JOIN), 1);
  assert.equal(run.lobby.state().roomId, ID);
  assert.equal(run.lobby.state().message, '');
});

test('a 404 on an action shortly after the last sight of the room still says room not found', async () => {
  // given
  const { lobby } = await joined({ [READY]: [[404, { error: 'not_found' }]] });

  // when
  await lobby.toggleReady();

  // then
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.roomNotFound);
});

test('opening another room link leaves the room, so a failed join leaves no ghost member', async () => {
  // given
  const { lobby, server } = await joined({ [OTHER_JOIN]: [[409, { error: 'room_full' }]], [LEAVE]: [[204]] });

  // when
  await lobby.open(OTHER);
  await settle();

  // then
  assert.equal(count(server.calls, LEAVE), 1);
  assert.equal(count(server.calls, OTHER_JOIN), 1);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.roomFull);
});

test('the leave button while a join is out sends the leave only after the join answers', async () => {
  // given
  const { lobby, server, clock } = setup({ ...PRESENCE, [JOIN]: [[200, room()]], [LEAVE]: [[204]] });
  const release = server.hold(JOIN);
  await lobby.open(ID);
  await settle();

  // when
  lobby.leave();
  await settle();

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN]);
  assert.equal(lobby.state().roomId, null);

  // when
  release();
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, LEAVE]);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().isBusy, false);
});

test('a re-join that meets a network failure keeps the room, and the next poll tries once more', async () => {
  // given
  const run = await hostHiddenFor(90 * 1000, { [JOIN]: [[OFFLINE]] });
  run.server.answers[POLL] = [[200, DROPPED]];

  // when
  await showAgain(run);

  // then
  assert.equal(count(run.server.calls, JOIN), 1);
  assert.equal(count(run.server.calls, POLL), 2, 'no extra poll right after the failed join');
  assert.equal(run.lobby.state().roomId, ID);
  assert.equal(run.lobby.state().isRoomDown, true);

  // when
  await run.clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(count(run.server.calls, JOIN), 2);
  assert.equal(count(run.server.calls, POLL), 3);
  assert.equal(run.lobby.state().roomId, ID);
});

test('a re-join answered with 500 also keeps the room', async () => {
  // given
  const run = await hostHiddenFor(90 * 1000, { [JOIN]: [[503, { error: 'upstream' }]] });
  run.server.answers[POLL] = [[200, DROPPED]];

  // when
  await showAgain(run);

  // then
  assert.equal(run.lobby.state().roomId, ID);
  assert.equal(run.lobby.state().isRoomDown, true);
});

test('a member unseen for 57 s is joined again: the age is compared a few seconds below the sweep', async () => {
  // given
  const run = await hostHiddenFor(57 * 1000, { [JOIN]: [[200, room()]] });
  run.server.answers[POLL] = [[200, DROPPED], [200, room()]];

  // when
  await showAgain(run);

  // then
  assert.ok(KLAD_LOBBY.REJOIN_AFTER < KLAD_LOBBY.SWEEP_AFTER);
  assert.equal(count(run.server.calls, JOIN), 1);
  assert.equal(run.lobby.state().roomId, ID);
});

test('a return poll answered after the tab hid again keeps the room and does nothing, then the next visible poll joins', async () => {
  // given
  const run = await hostHiddenFor(90 * 1000, { [JOIN]: [[200, room()]] });
  run.server.answers[POLL] = [[200, DROPPED]];
  const release = run.server.hold(POLL);
  await showAgain(run);
  run.world.isVisible = false;
  run.lobby.onVisibility();

  // when
  release();
  await settle();

  // then
  assert.equal(count(run.server.calls, JOIN), 0);
  assert.equal(run.lobby.state().roomId, ID);
  assert.equal(run.lobby.state().message, '');

  // when
  run.server.answers[POLL] = [[200, DROPPED], [200, room()]];
  await showAgain(run);
  await run.clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(count(run.server.calls, JOIN), 1);
  assert.equal(run.lobby.state().roomId, ID);
});

test('state reports a held action as busy, for the level select', async () => {
  // given
  const { lobby, server } = await joined({ [READY]: [[200, room()]] });
  const release = server.hold(READY);

  // when
  const tapped = lobby.toggleReady();
  await settle();

  // then
  assert.equal(lobby.state().isBusy, true);

  // when
  release();
  await tapped;

  // then
  assert.equal(lobby.state().isBusy, false);
});

/* ---- own actions ---- */

test('an own action is followed by one poll right away, and the next poll 10 s after it', async () => {
  // given
  const { lobby, server, clock } = await joined({
    ['POST /klad/api/rooms/' + ID + '/ready']: [[200, room({ players: [ANNA, { ...MINE, ready: true }] })]],
  });
  await clock.advance(3000);

  // when
  await lobby.toggleReady();
  await settle();

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, POLL, 'POST /klad/api/rooms/' + ID + '/ready {"ready":true}', POLL]);

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY - 1);

  // then
  assert.equal(count(server.calls, POLL), 2);

  // when
  await clock.advance(1);

  // then
  assert.equal(count(server.calls, POLL), 3);
});

test('the ready toggle sends false once this player is ready', async () => {
  // given
  const ready = room({ players: [ANNA, { ...MINE, ready: true }] });
  const { lobby, server } = await joined({
    [JOIN]: [[200, ready]], [POLL]: [[200, ready]], ['POST /klad/api/rooms/' + ID + '/ready']: [[200, room()]],
  });

  // when
  await lobby.toggleReady();

  // then
  assert.equal(server.calls.includes('POST /klad/api/rooms/' + ID + '/ready {"ready":false}'), true);
});

test('not_host on start keeps the room and says only the host can start', async () => {
  // given
  const { lobby } = await joined({ ['POST /klad/api/rooms/' + ID + '/start']: [[403, { error: 'not_host' }]] });

  // when
  await lobby.start();

  // then
  assert.equal(lobby.state().message, TEXT.notHost);
  assert.equal(lobby.state().roomId, ID);
});

test('an answer that arrives after leaving does not bring the room back', async () => {
  // given
  const { lobby, server, clock, sockets, page } = await joined({ [LEAVE]: [[204]] });
  server.answers[POLL] = [[200, room({ state: 'starting' })]];
  const release = server.hold(POLL);
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // when
  await lobby.leave();
  release();
  await clock.advance(1000);

  // then
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().room, null);
  assert.deepEqual(page.races, []);
  assert.deepEqual(sockets.made, []);
});

test('a poll sent before the start but answered after it does not close the new socket', async () => {
  // given
  const ready = room({ host: { nick: 'test' }, players: [{ ...MINE, host: true, ready: true }, { ...ANNA, host: false, ready: true }] });
  const starting = { ...ready, state: 'starting' };
  const { lobby, server, clock, sockets } = await hosting({
    [POLL]: [[200, ready]], ['POST /klad/api/rooms/' + ID + '/start']: [[200, starting]],
  });
  server.answers[POLL] = [[200, ready], [200, starting]];
  const release = server.hold(POLL);
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // when
  await lobby.start();
  release();
  await clock.advance(0);

  // then
  assert.equal(count(server.calls, POLL), 3);
  assert.equal(sockets.made.length, 1);
  assert.equal(sockets.made[0].closedWith, null);
  assert.equal(lobby.state().room.state, 'starting');
});

/* ---- race start: the socket ---- */

test('the socket opens once when the polled state is starting, and is handed on', async () => {
  // given
  const starting = room({ state: 'starting', players: [{ ...ANNA, ready: true }, { ...MINE, ready: true }] });
  const { lobby, server, clock, sockets, page } = await joined();
  server.answers[POLL] = [[200, starting]];

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(page.races.length, 1);
  assert.deepEqual(page.races[0].room, starting);
  assert.equal(sockets.made.length, 1);
  assert.equal(sockets.made[0].url, 'wss://rassimok.dev/klad/api/race/' + ID);
  assert.equal(lobby.state().race, TEXT.raceWaiting);

  // when
  sockets.made[0].onopen();
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(page.races.length, 1);
  assert.equal(sockets.made.length, 1);
  assert.equal(page.races[0].socket.status(), 'open');
  assert.equal(page.races[0].socket.send({ type: 'ping' }), true);
  assert.deepEqual(sockets.made[0].sent, ['{"type":"ping"}']);
});

test('the socket is closed for good once the room is back in the lobby', async () => {
  // given
  const { lobby, server, clock, sockets } = await joined();
  server.answers[POLL] = [[200, room({ state: 'starting' })], [200, room()]];
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);
  sockets.made[0].onopen();

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);
  await clock.advance(60 * 1000);

  // then
  assert.equal(sockets.made.length, 1);
  assert.equal(sockets.made[0].closedWith, 1000);
  assert.equal(lobby.state().race, '');
});

test('the host\'s start opens the socket from the start answer at once', async () => {
  // given
  const ready = room({ host: { nick: 'test' }, players: [{ ...MINE, host: true, ready: true }, { ...ANNA, host: false, ready: true }] });
  const { lobby, server, clock, sockets, page } = await hosting({
    [POLL]: [[200, ready]], ['POST /klad/api/rooms/' + ID + '/start']: [[200, { ...ready, state: 'starting' }]],
  });

  // when
  await lobby.start();
  await clock.advance(0);

  // then
  assert.deepEqual(roomCalls(server.calls).slice(2), ['POST /klad/api/rooms/' + ID + '/start', POLL]);
  assert.equal(page.races.length, 1);
  assert.equal(sockets.made.length, 1);
});

test('closing the lobby while the race is starting keeps the room and the socket', async () => {
  // given
  const { lobby, server, clock, sockets } = await joined({ [LEAVE]: [[204]] });
  server.answers[POLL] = [[200, room({ state: 'starting' })]];
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // when
  lobby.close();
  await clock.advance(0);

  // then
  assert.equal(server.calls.includes(LEAVE), false);
  assert.equal(sockets.made.length, 1);
  assert.equal(sockets.made[0].closedWith, null);
  assert.equal(lobby.state().roomId, ID);
});

test('with WebSocket blocked the lobby says online play is not available and keeps polling', async () => {
  // given
  const { lobby, server, clock, page } = await joined({}, { WebSocket: undefined });
  server.answers[POLL] = [[200, room({ state: 'starting' })]];

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(page.races.length, 1);
  assert.equal(lobby.state().race, TEXT.raceUnavailable);

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(count(server.calls, POLL), 3);
  assert.equal(page.races.length, 1);
});

test('a socket that never opens says online play is not available after the last try', async () => {
  // given
  const { lobby, server, clock, sockets } = await joined();
  server.answers[POLL] = [[200, room({ state: 'starting' })]];
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // when
  for (let i = 0; i <= KLAD_LOBBY.SOCKET_TRIES; i++) {
    sockets.made[i].onclose({ code: 1006 });
    await clock.advance(KLAD_LOBBY.SOCKET_FIRST_WAIT * 2 ** i);
  }

  // then
  assert.equal(sockets.made.length, KLAD_LOBBY.SOCKET_TRIES + 1);
  assert.equal(lobby.state().race, TEXT.raceUnavailable);
});

/* ---- the request budget ---- */

test('an hour with the lobby open sends about 240 requests outside a room and about 600 inside', async () => {
  // given
  const outside = setup(PRESENCE);
  await outside.lobby.open();
  const inside = await hosting();

  // when
  await outside.clock.advance(HOUR - 1);
  await inside.clock.advance(HOUR - 1);

  // then
  assert.equal(outside.server.calls.length, 240);
  assert.equal(count(inside.server.calls, HEARTBEAT) + count(inside.server.calls, ONLINE_LIST), 240);
  assert.equal(count(inside.server.calls, POLL), 360);
  assert.equal(inside.server.calls.length, 601);
});

test('a tab hidden and shown every few seconds for an hour stays within the same budget', async () => {
  // given
  const { lobby, server, clock, world } = await hosting();

  // when
  while (clock.now() + 7000 <= HOUR) {
    world.isVisible = false;
    lobby.onVisibility();
    await clock.advance(1000);
    world.isVisible = true;
    lobby.onVisibility();
    await clock.advance(6000);
  }

  // then
  assert.ok(count(server.calls, HEARTBEAT) <= 120);
  assert.ok(count(server.calls, ONLINE_LIST) <= 120);
  assert.ok(count(server.calls, POLL) <= 360);
});

/* ---- the socket module ---- */

function socketSetup(WebSocket) {
  const clock = fakeClock();
  const sockets = fakeSockets();
  const socket = KLAD_LOBBY.connect('ws://test/klad/api/race/' + ID, WebSocket === undefined ? sockets.FakeWebSocket : WebSocket,
    clock);
  const statuses = [];
  const messages = [];
  socket.on('status', (status) => statuses.push(status));
  socket.on('message', (message) => messages.push(message));
  return { clock, sockets, socket, statuses, messages };
}

test('connect opens one WebSocket on the next turn and sends JSON only while it is open', async () => {
  // given
  const { clock, sockets, socket, statuses } = socketSetup();

  // when
  const isSentEarly = socket.send({ type: 'ping' });
  await clock.advance(0);
  sockets.made[0].onopen();
  const isSent = socket.send({ type: 'pos', x: 3, y: 4 });

  // then
  assert.equal(isSentEarly, false);
  assert.equal(isSent, true);
  assert.equal(sockets.made.length, 1);
  assert.equal(sockets.made[0].url, 'ws://test/klad/api/race/' + ID);
  assert.deepEqual(sockets.made[0].sent, ['{"type":"pos","x":3,"y":4}']);
  assert.deepEqual(statuses, ['open']);
  assert.equal(socket.hasOpened(), true);
});

test('text frames arrive parsed, and frames that are not JSON text are dropped', async () => {
  // given
  const { clock, sockets, messages } = socketSetup();
  await clock.advance(0);
  sockets.made[0].onopen();

  // when
  sockets.made[0].onmessage({ data: '{"type":"countdown","seconds":3}' });
  sockets.made[0].onmessage({ data: 'not json' });
  sockets.made[0].onmessage({ data: new ArrayBuffer(4) });

  // then
  assert.deepEqual(messages, [{ type: 'countdown', seconds: 3 }]);
});

test('a dropped socket reconnects with doubling waits and stops after the maximum tries', async () => {
  // given
  const { clock, sockets, socket, statuses } = socketSetup();
  await clock.advance(0);
  sockets.made[0].onopen();

  // when
  for (let i = 0; i < KLAD_LOBBY.SOCKET_TRIES; i++) {
    sockets.made[i].onclose({ code: 1006 });
    await clock.advance(KLAD_LOBBY.SOCKET_FIRST_WAIT * 2 ** i - 1);
    assert.equal(sockets.made.length, i + 1, 'no try before the wait is over');
    await clock.advance(1);
    assert.equal(sockets.made.length, i + 2);
  }
  sockets.made[KLAD_LOBBY.SOCKET_TRIES].onclose({ code: 1006 });
  await clock.advance(10 * 60 * 1000);

  // then
  assert.equal(sockets.made.length, KLAD_LOBBY.SOCKET_TRIES + 1);
  assert.deepEqual(statuses, ['open', 'reconnecting', 'reconnecting', 'reconnecting', 'reconnecting', 'offline']);
  assert.equal(socket.status(), 'offline');
  assert.equal(socket.hasOpened(), true);
  assert.equal(clock.pending(), 0);
});

test('a socket that never opens reports offline after the tries and has never opened', async () => {
  // given
  const { clock, sockets, socket } = socketSetup();

  // when
  await clock.advance(0);
  for (let i = 0; i <= KLAD_LOBBY.SOCKET_TRIES; i++) {
    sockets.made[i].onclose({ code: 1006 });
    await clock.advance(KLAD_LOBBY.SOCKET_FIRST_WAIT * 2 ** i);
  }

  // then
  assert.equal(sockets.made.length, KLAD_LOBBY.SOCKET_TRIES + 1);
  assert.equal(socket.status(), 'offline');
  assert.equal(socket.hasOpened(), false);
});

test('an open resets the tries, so a later drop waits the first wait again', async () => {
  // given
  const { clock, sockets } = socketSetup();
  await clock.advance(0);
  sockets.made[0].onclose({ code: 1006 });
  await clock.advance(KLAD_LOBBY.SOCKET_FIRST_WAIT);
  sockets.made[1].onclose({ code: 1006 });
  await clock.advance(KLAD_LOBBY.SOCKET_FIRST_WAIT * 2);
  sockets.made[2].onopen();

  // when
  sockets.made[2].onclose({ code: 1006 });
  await clock.advance(KLAD_LOBBY.SOCKET_FIRST_WAIT);

  // then
  assert.equal(sockets.made.length, 4);
});

test('a normal close from the server ends the socket without a reconnect', async () => {
  // given
  const { clock, sockets, socket, statuses } = socketSetup();
  await clock.advance(0);
  sockets.made[0].onopen();

  // when
  sockets.made[0].onclose({ code: 1000 });
  await clock.advance(10 * 60 * 1000);

  // then
  assert.equal(sockets.made.length, 1);
  assert.deepEqual(statuses, ['open', 'closed']);
  assert.equal(socket.send({ type: 'ping' }), false);
});

test('a policy close (1008) ends the socket as offline without a reconnect', async () => {
  // given
  const { clock, sockets, socket, statuses } = socketSetup();
  await clock.advance(0);
  sockets.made[0].onopen();

  // when
  sockets.made[0].onclose({ code: 1008 });
  await clock.advance(10 * 60 * 1000);

  // then
  assert.equal(sockets.made.length, 1);
  assert.deepEqual(statuses, ['open', 'offline']);
  assert.equal(socket.hasOpened(), true);
  assert.equal(clock.pending(), 0);
});

test('a socket that opens and drops again and again stops after the maximum reconnects in all', async () => {
  // given
  const { clock, sockets, socket } = socketSetup();
  await clock.advance(0);

  // when
  for (let i = 0; i <= KLAD_LOBBY.SOCKET_RECONNECTS; i++) {
    sockets.made[i].onopen();
    sockets.made[i].onclose({ code: 1006 });
    await clock.advance(KLAD_LOBBY.SOCKET_FIRST_WAIT);
  }
  await clock.advance(10 * 60 * 1000);

  // then
  assert.equal(sockets.made.length, KLAD_LOBBY.SOCKET_RECONNECTS + 1);
  assert.equal(socket.status(), 'offline');
  assert.equal(clock.pending(), 0);
});

test('close() during a wait stops the reconnects and closes nothing twice', async () => {
  // given
  const { clock, sockets, socket, statuses } = socketSetup();
  await clock.advance(0);
  sockets.made[0].onopen();
  sockets.made[0].onclose({ code: 1006 });

  // when
  socket.close();
  socket.close();
  await clock.advance(10 * 60 * 1000);

  // then
  assert.equal(sockets.made.length, 1);
  assert.deepEqual(statuses, ['open', 'reconnecting', 'closed']);
  assert.equal(clock.pending(), 0);
});

test('close() on an open socket closes it with 1000 and its late close event is ignored', async () => {
  // given
  const { clock, sockets, socket, statuses } = socketSetup();
  await clock.advance(0);
  sockets.made[0].onopen();

  // when
  socket.close();
  sockets.made[0].onclose({ code: 1000 });
  await clock.advance(10 * 60 * 1000);

  // then
  assert.equal(sockets.made[0].closedWith, 1000);
  assert.deepEqual(statuses, ['open', 'closed']);
  assert.equal(sockets.made.length, 1);
});

test('a browser without WebSocket, or one that refuses it, reports offline at once and tries nothing more', async () => {
  // given
  const refusing = function RefusingWebSocket() { throw new Error('SecurityError'); };
  for (const WebSocket of [null, refusing]) {
    const { clock, socket, statuses } = socketSetup(WebSocket);

    // when
    await clock.advance(10 * 60 * 1000);

    // then
    assert.deepEqual(statuses, ['offline']);
    assert.equal(socket.status(), 'offline');
    assert.equal(clock.pending(), 0);
  }
});
