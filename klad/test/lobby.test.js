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
  'GET /klad/api/rooms': [[200, { rooms: [] }]],
};
const HEARTBEAT = 'POST /klad/api/presence';
const ONLINE_LIST = 'GET /klad/api/presence';
const ROOM_LIST = 'GET /klad/api/rooms';
const CREATE = 'POST /klad/api/rooms';
const POLL = 'GET /klad/api/rooms/' + ID;
const JOIN = 'POST /klad/api/rooms/' + ID + '/join';
const LEAVE = 'POST /klad/api/rooms/' + ID + '/leave';

function room(changes) {
  return { id: ID, state: 'lobby', host: { nick: 'Anna' }, players: [ANNA, MINE], level: 1, shape: 'landscape', size: 4, listed: true,
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
const roomCalls = (calls) => calls.filter((call) => call.includes('/rooms') && call !== ROOM_LIST);

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

test('inviteMailto has no receiver and decodes to the subject and the exact room link', () => {
  // given
  const roomLink = 'test://rassimok.test/klad/#room=' + ID;

  // when
  const href = KLAD_LOBBY.inviteMailto(roomLink);

  // then
  assert.ok(href.startsWith('mailto:?subject='));
  const query = new URLSearchParams(href.slice('mailto:?'.length));
  assert.equal(query.get('subject'), TEXT.inviteSubject);
  assert.equal(query.get('body'), TEXT.inviteBody + roomLink);
  assert.equal(href.includes('#'), false);
  assert.equal(href.includes(' '), false);
  assert.equal(href.includes('+'), false);
  assert.equal(decodeURIComponent(href.split('subject=')[1].split('&body=')[0]), TEXT.inviteSubject);
  assert.equal(decodeURIComponent(href.split('&body=')[1]), TEXT.inviteBody + roomLink);
});

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
    isMember: true, isHost: false, isReady: false, isListed: true, canStart: false,
  });
});

test('roomView keeps size 10 and 10 players', () => {
  // given
  const players = Array.from({ length: 10 }, (unused, index) => (
    { nick: 'P' + index, kind: 'human', ready: false, host: index === 0, slot: index }));
  // when
  const view = KLAD_LOBBY.roomView(room({ size: 10, host: { nick: 'P0' }, players }));
  // then
  assert.equal(view.size, 10);
  assert.equal(view.players.length, 10);
});

test('the room-full text names no number', () => {
  assert.doesNotMatch(TEXT.roomFull, /\d/);
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
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST, ROOM_LIST]);
  assert.deepEqual(lobby.state().online, ONLINE);
  assert.equal(lobby.state().phase, 'ready');

  // when
  await clock.advance(KLAD_LOBBY.PRESENCE_EVERY - 1);

  // then
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST, ROOM_LIST]);

  // when
  await clock.advance(1);

  // then
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST, ROOM_LIST, HEARTBEAT, ONLINE_LIST, ROOM_LIST]);
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
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST, ROOM_LIST]);
  assert.equal(clock.pending(), 0);

  // when
  world.isVisible = true;
  lobby.onVisibility();
  await settle();

  // then
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST, ROOM_LIST, HEARTBEAT, ONLINE_LIST, ROOM_LIST]);
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
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST, ROOM_LIST]);
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

test('a deferred leave is sent also when the held join fails with 5xx', async () => {
  // given
  const { lobby, server, clock } = setup({ ...PRESENCE, [JOIN]: [[503]], [LEAVE]: [[204]] });
  const release = server.hold(JOIN);
  await lobby.open(ID);
  await settle();
  lobby.close();

  // when
  release();
  await clock.advance(60 * 1000);

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, LEAVE]);
  assert.equal(lobby.state().roomId, null);
});

test('closing the lobby after the race socket went offline leaves the room', async () => {
  // given
  const { lobby, server, clock, sockets } = await joined({ [LEAVE]: [[204]] });
  server.answers[POLL] = [[200, room({ state: 'racing' })]];
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);
  sockets.made[0].onclose({ code: 1000 });

  // when
  lobby.close();
  await clock.advance(0);

  // then
  assert.equal(server.calls.includes(LEAVE), true);
  assert.equal(lobby.state().roomId, null);
});

test('the waiting line shows only while the room is starting', async () => {
  // given
  const { lobby, server, clock } = await joined();
  server.answers[POLL] = [[200, room({ state: 'racing' })]];

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(lobby.state().race, '');
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

test('a poll without this player while a socket that never opened still tries says online play is not available', async () => {
  // given
  const handshakeFailsAfter = 800;
  const { lobby, server, clock, sockets, page } = await joined();
  server.answers[POLL] = [[200, room({ state: 'starting' })], [200, room({ state: 'racing', players: [ANNA] })]];
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);
  for (let i = 0; i < KLAD_LOBBY.SOCKET_TRIES - 1; i++) {
    await clock.advance(handshakeFailsAfter);
    sockets.made[i].onclose({ code: 1006 });
    await clock.advance(KLAD_LOBBY.SOCKET_FIRST_WAIT * 2 ** i);
  }
  const statusBeforePoll = page.races[0].socket.status();

  // when
  await clock.advance(2 * KLAD_LOBBY.ROOM_EVERY - clock.now());

  // then
  assert.equal(statusBeforePoll, 'reconnecting');
  assert.equal(count(server.calls, POLL), 3);
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.raceUnavailable);
});

test('a poll without this player after the socket opened still says the player is no longer in the room', async () => {
  // given
  const { lobby, server, clock, sockets } = await joined();
  server.answers[POLL] = [[200, room({ state: 'starting' })], [200, room({ state: 'racing', players: [ANNA] })]];
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);
  sockets.made[0].onopen();

  // when
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.removed);
});

test('a join that answers racing (a reload in the race) opens one socket, and no later poll opens a second one', async () => {
  // given
  const racing = room({ state: 'racing' });
  const { server, clock, sockets, page } = await joined({ [JOIN]: [[200, racing]], [POLL]: [[200, racing]] });

  // when
  await clock.advance(0);

  // then
  assert.equal(page.races.length, 1);
  assert.deepEqual(page.races[0].room, racing);
  assert.equal(sockets.made.length, 1);

  // when
  sockets.made[0].onopen();
  sockets.made[0].onclose({ code: 1000 });
  await clock.advance(3 * KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(count(server.calls, POLL), 4);
  assert.equal(page.races.length, 1);
  assert.equal(sockets.made.length, 1);
});

/* ---- the request budget ---- */

test('an hour with the lobby open sends about 360 requests outside a room and about 600 inside', async () => {
  // given
  const outside = setup(PRESENCE);
  await outside.lobby.open();
  const inside = await hosting();

  // when
  await outside.clock.advance(HOUR - 1);
  await inside.clock.advance(HOUR - 1);

  // then
  assert.equal(outside.server.calls.length, 360);
  assert.equal(count(outside.server.calls, ROOM_LIST), 120);
  assert.equal(count(inside.server.calls, HEARTBEAT) + count(inside.server.calls, ONLINE_LIST), 240);
  assert.equal(count(inside.server.calls, POLL), 360);
  assert.equal(count(inside.server.calls, ROOM_LIST), 1);
  assert.equal(inside.server.calls.length, 602);
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

test('a tab hidden and shown every few seconds outside a room sends at most 120 room lists in an hour', async () => {
  // given
  const { lobby, server, clock, world } = setup(PRESENCE);
  await lobby.open();

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
  assert.ok(count(server.calls, ROOM_LIST) <= 120);
  assert.ok(server.calls.length <= 360);
});

/* ---- the open rooms ---- */

const LISTED = [
  { id: 'Room_id-42', state: 'lobby', host: { nick: 'Anna' }, players: 2, size: 4, level: 3, shape: 'portrait' },
  { id: 'Room_id-43', state: 'lobby', host: { nick: 'Boris' }, players: 4, size: 4, level: 1, shape: 'landscape' },
  { id: 'Room_id-44', state: 'racing', host: { nick: 'Vera' }, players: 2, size: 4, level: 2, shape: 'landscape' },
  { id: 'Room_id-45', state: 'starting', host: { nick: 'Gleb' }, players: 3, size: 4, level: 2, shape: 'landscape' },
];
const LIST_OF = (rooms) => ({ ...PRESENCE, [ROOM_LIST]: [[200, { rooms }]] });

test('the lobby lists the open rooms with host, counts, level and whether they can be joined', async () => {
  // given
  const { lobby, server } = setup(LIST_OF(LISTED));

  // when
  await lobby.open();
  await settle();

  // then
  assert.deepEqual(server.calls, [HEARTBEAT, ONLINE_LIST, ROOM_LIST]);
  assert.deepEqual(lobby.state().rooms.map((line) => [line.hostNick, line.players, line.size, line.level, line.shape]), [
    ['Anna', 2, 4, 3, 'portrait'], ['Boris', 4, 4, 1, 'landscape'], ['Vera', 2, 4, 2, 'landscape'], ['Gleb', 3, 4, 2, 'landscape'],
  ]);
  assert.deepEqual(lobby.state().rooms.map((line) => line.canJoin), [true, false, false, false]);
  assert.equal(lobby.state().isRoomsDown, false);
});

test('joining from the list posts the join and shows the room view, with the list gone', async () => {
  // given
  const { lobby, server } = setup({ ...LIST_OF(LISTED), [JOIN]: [[200, room()]], [POLL]: [[200, room()]] });
  await lobby.open();
  await settle();

  // when
  await lobby.joinFromList(ID);
  await settle();

  // then
  assert.deepEqual(roomCalls(server.calls), [JOIN, POLL]);
  assert.equal(lobby.state().roomId, ID);
  assert.equal(lobby.state().room.isMember, true);
});

test('a full room from the list says room is full and the list is fetched again', async () => {
  // given
  const { lobby, server } = setup({ ...LIST_OF(LISTED), [JOIN]: [[409, { error: 'room_full' }]] });
  await lobby.open();
  await settle();

  // when
  await lobby.joinFromList(ID);
  await settle();

  // then
  assert.equal(lobby.state().message, TEXT.roomFull);
  assert.equal(lobby.state().roomId, null);
  assert.equal(count(server.calls, ROOM_LIST), 2);
});

test('joinFromList sends nothing for a malformed id or while in a room', async () => {
  // given
  const { lobby, server } = await hosting(LIST_OF([]));
  const before = server.calls.length;

  // when
  await lobby.joinFromList('x');
  await lobby.joinFromList('Room_id-43');

  // then
  assert.equal(server.calls.length, before);
  assert.equal(lobby.state().roomId, ID);
});

test('an empty list is an empty array, not a failure', async () => {
  // given / when
  const { lobby } = setup(LIST_OF([]));
  await lobby.open();
  await settle();

  // then
  assert.deepEqual(lobby.state().rooms, []);
  assert.equal(lobby.state().isRoomsDown, false);
});

test('a failed list request marks the list down while presence and the rest work', async () => {
  // given
  const { lobby, clock } = setup({ ...PRESENCE, [ROOM_LIST]: [[OFFLINE], [200, { rooms: LISTED }]] });

  // when
  await lobby.open();
  await settle();

  // then
  assert.equal(lobby.state().isRoomsDown, true);
  assert.equal(lobby.state().rooms, null);
  assert.deepEqual(lobby.state().online, ONLINE);
  assert.equal(lobby.state().phase, 'ready');

  // when
  await clock.advance(KLAD_LOBBY.PRESENCE_EVERY);

  // then
  assert.equal(lobby.state().isRoomsDown, false);
  assert.equal(lobby.state().rooms.length, 4);
});

test('a 500 on the list also marks it down', async () => {
  // given / when
  const { lobby } = setup({ ...PRESENCE, [ROOM_LIST]: [[500, { error: 'x' }]] });
  await lobby.open();
  await settle();

  // then
  assert.equal(lobby.state().isRoomsDown, true);
});

test('401 on the list means no player', async () => {
  // given / when
  const { lobby } = setup({ ...PRESENCE, [ROOM_LIST]: [[401, { error: 'no_session' }]] });
  await lobby.open();
  await settle();

  // then
  assert.equal(lobby.state().phase, 'no-nick');
});

test('entries with a bad id are left out of the list', async () => {
  // given / when
  const { lobby } = setup(LIST_OF([...LISTED, { id: '../x', state: 'lobby', host: { nick: 'Z' }, players: 1, size: 4, level: 1, shape: 'landscape' }]));
  await lobby.open();
  await settle();

  // then
  assert.equal(lobby.state().rooms.length, 4);
});

test('the list is not asked while in a room, and once more after leaving it', async () => {
  // given
  const { lobby, server, clock } = await hosting(LIST_OF(LISTED));
  const before = count(server.calls, ROOM_LIST);

  // when
  await clock.advance(KLAD_LOBBY.PRESENCE_EVERY);

  // then
  assert.equal(count(server.calls, ROOM_LIST), before);

  // when
  await lobby.leave();
  await settle();

  // then
  assert.equal(count(server.calls, ROOM_LIST), before + 1);
  assert.equal(lobby.state().rooms.length, 4);
});

test('a list answer that arrives after joining a room is dropped', async () => {
  // given
  const { lobby, server } = setup({ ...LIST_OF(LISTED), [JOIN]: [[200, room()]], [POLL]: [[200, room()]] });
  const release = server.hold(ROOM_LIST);
  await lobby.open();
  await settle();

  // when
  await lobby.joinFromList(ID);
  release();
  await settle();

  // then
  assert.equal(lobby.state().roomId, ID);
  assert.equal(lobby.state().rooms, null);
});

test('joinFromList does nothing while a request is out', async () => {
  // given
  const { lobby, server } = setup({ ...LIST_OF(LISTED), [JOIN]: [[200, room()]], [POLL]: [[200, room()]] });
  await lobby.open();
  await settle();
  const release = server.hold(JOIN);
  const joining = lobby.joinFromList(ID);
  await settle();

  // when
  await lobby.joinFromList(ID);

  // then
  assert.equal(count(server.calls, JOIN), 1);
  release();
  await joining;
});

test('a room list is never fetched while the tab is hidden or the lobby closed', async () => {
  // given
  const { lobby, server, world } = setup(LIST_OF(LISTED));
  world.isVisible = false;

  // when
  await lobby.open();
  await settle();
  lobby.close();

  // then
  assert.equal(count(server.calls, ROOM_LIST), 0);
});

test('leaving a room with the lobby closed fetches no list', async () => {
  // given
  const racing = room({ state: 'racing' });
  const { lobby, server } = await joined({ ...LIST_OF(LISTED), [JOIN]: [[200, racing]], [POLL]: [[200, racing]] });
  const before = count(server.calls, ROOM_LIST);
  lobby.close();
  assert.equal(lobby.state().roomId, ID);

  // when
  await lobby.leave();
  await settle();

  // then
  assert.equal(count(server.calls, ROOM_LIST), before);
});

/* ---- link only ---- */

test('createRoom(false) posts /rooms?listed=false, and no argument or true posts plain /rooms', async () => {
  // given
  const link = 'POST /klad/api/rooms?listed=false';
  const hidden = setup({ ...PRESENCE, [link]: [[201, { id: ID }]], [POLL]: [[200, HOSTED]] });
  await hidden.lobby.open();
  await settle();

  // when
  await hidden.lobby.createRoom(false);
  await settle();

  // then
  assert.deepEqual(roomCalls(hidden.server.calls), [link, POLL]);

  // given
  const plain = await hosting();
  const other = setup({ ...PRESENCE, [CREATE]: [[201, { id: ID }]], [POLL]: [[200, HOSTED]] });
  await other.lobby.open();
  await settle();

  // when
  await other.lobby.createRoom(true);
  await settle();

  // then
  assert.deepEqual(roomCalls(plain.server.calls), [CREATE, POLL]);
  assert.deepEqual(roomCalls(other.server.calls), [CREATE, POLL]);
});

test('the host switches the room to link only with POST /listed, and the room answer shows it', async () => {
  // given
  const hiddenRoom = { ...HOSTED, listed: false };
  const { lobby, server } = await hosting({ ['POST /klad/api/rooms/' + ID + '/listed']: [[200, hiddenRoom]], [POLL]: [[200, HOSTED], [200, hiddenRoom]] });
  assert.equal(lobby.state().room.isListed, true);

  // when
  await lobby.setListed(false);
  await settle();

  // then
  assert.ok(server.calls.includes('POST /klad/api/rooms/' + ID + '/listed {"listed":false}'));
  assert.equal(lobby.state().room.isListed, false);
});

test('a member that is not the host gets not_host from the listed switch and keeps the room', async () => {
  // given
  const { lobby } = await joined({ ['POST /klad/api/rooms/' + ID + '/listed']: [[403, { error: 'not_host' }]] });

  // when
  await lobby.setListed(false);
  await settle();

  // then
  assert.equal(lobby.state().message, TEXT.notHost);
  assert.equal(lobby.state().roomId, ID);
});

/* ---- a non-member's room answer: host null, players [] ---- */

const STRANGER_VIEW = room({ host: null, players: [] });

test('a #room= entry joins by POST, so the member answer shows the room', async () => {
  // given / when
  const { lobby } = await joined();

  // then
  assert.equal(lobby.state().room.isMember, true);
  assert.equal(lobby.state().room.players.length, 2);
});

test('a poll that answers as a non-member (host null, no players) ends the room view with the removed text', async () => {
  // given
  const { lobby, clock, server } = await joined({ ...LIST_OF(LISTED), [POLL]: [[200, room()], [200, STRANGER_VIEW]] });
  const before = count(server.calls, ROOM_LIST);
  await clock.advance(KLAD_LOBBY.ROOM_EVERY);

  // then
  assert.equal(lobby.state().roomId, null);
  assert.equal(lobby.state().message, TEXT.removed);
  assert.equal(count(server.calls, ROOM_LIST), before + 1);
});

test('a long unseen member polled as a non-member (host null, no players) is joined again', async () => {
  // given
  const { lobby, server, clock, world } = await joined({ [POLL]: [[200, room()], [200, STRANGER_VIEW], [200, room()]] });
  world.isVisible = false;
  lobby.onVisibility();
  await clock.advance(90 * 1000);

  // when
  world.isVisible = true;
  lobby.onVisibility();
  await settle();

  // then
  assert.equal(count(server.calls, JOIN), 2);
  assert.equal(lobby.state().room.isMember, true);
});

test('a room view without a member entry has no host and no ready state', () => {
  // given / when
  const view = KLAD_LOBBY.roomView(STRANGER_VIEW);

  // then
  assert.equal(view.isMember, false);
  assert.equal(view.isHost, false);
  assert.deepEqual(view.players, []);
});

test('roomView reads listed, and a missing one counts as listed', () => {
  assert.equal(KLAD_LOBBY.roomView(room({ listed: false })).isListed, false);
  assert.equal(KLAD_LOBBY.roomView(room({ listed: true })).isListed, true);
  assert.equal(KLAD_LOBBY.roomView(room({ listed: undefined })).isListed, true);
});

/* ---- the page half, in a vm context with a stub page ---- */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function stubNode(tag, registry) {
  const node = {
    tag, textContent: '', className: '', hidden: false, disabled: false, checked: false, value: '', open: false,
    children: [], listeners: {}, attributes: {}, dataset: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { registry.focused = this; }, select() {},
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; },
    querySelectorAll(selector) {
      return this.children.flatMap((child) => (typeof child === 'string' ? [] : [...(child.tag === selector ? [child] : []), ...child.querySelectorAll(selector)]));
    },
    contains(other) { return other === this || this.children.some((child) => typeof child !== 'string' && child.contains(other)); },
    add() {},
    showModal() { this.open = true; },
    close() { this.open = false; },
  };
  return node;
}

function loadLobbyPage(answers) {
  const registry = { focused: null, created: [] };
  const elements = {};
  const server = fakeServer(answers);
  const document = {
    visibilityState: 'visible',
    get activeElement() { return registry.focused; },
    getElementById: (id) => elements[id] || (elements[id] = stubNode('#' + id, registry)),
    createElement: (tag) => { registry.created.push(tag); return stubNode(tag, registry); },
    querySelector: () => null,
    addEventListener() {},
  };
  const sandbox = {
    document,
    KLAD_LEVELS: [{ name: 'один' }, { name: 'два' }, { name: 'три' }],
    KLAD_ONLINE: {
      request: KLAD_ONLINE.request,
      page: { player: () => ME, refresh: async () => {}, isAvailable: () => true, ask() {} },
    },
    fetch: server.fetch,
    matchMedia: () => ({ matches: false }),
    Option: function Option(text, value) { this.text = text; this.value = value; },
    CustomEvent: function CustomEvent() {},
    location: { protocol: 'https:', host: 'rassimok.dev', origin: 'test://rassimok.dev', hash: '' },
    addEventListener() {},
    Date, setTimeout: () => 0, clearTimeout: () => {},
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'lobby.js'), 'utf8'), sandbox);
  return { elements, registry, server };
}

const textsOf = (node) => [node.textContent, ...node.children.flatMap((child) => (typeof child === 'string' ? [child] : textsOf(child)))];
const buttonsOf = (node) => node.children.filter((child) => typeof child !== 'string').flatMap((child) =>
  (child.tag === 'button' ? [child] : buttonsOf(child)));

test('lobby page: each open room is one list item with host, counts, level and a Войти button; full and racing ones have none', async () => {
  // given
  const page = loadLobbyPage(LIST_OF(LISTED));

  // when
  page.elements['h-lobby'].listeners.click();
  await settle();

  // then
  const items = page.elements['lobby-rooms'].children;
  assert.equal(items.length, 4);
  assert.deepEqual(items.map((item) => buttonsOf(item).length), [1, 0, 0, 0]);
  assert.equal(buttonsOf(items[0])[0].textContent, 'Войти');
  assert.equal(buttonsOf(items[0])[0].type, 'button');
  assert.ok(textsOf(items[0]).includes('Anna'));
  assert.ok(textsOf(items[0]).some((text) => text.startsWith('игроков 2 из 4, Этап 3: три')));
  assert.ok(textsOf(items[1]).includes('заполнена'));
  assert.ok(textsOf(items[2]).includes('идёт гонка'));
  assert.ok(textsOf(items[3]).includes('гонка начинается'));
  assert.equal(page.elements['lobby-rooms-title'].textContent, 'Открытые комнаты: 4');
  assert.equal(page.elements['lobby-online-title'].textContent, 'Сейчас в лобби: 2');
  assert.equal(page.elements['lobby-out'].hidden, false);
});

test('lobby page: rendering the same list again keeps the focused Войти button in the list', async () => {
  // given
  const page = loadLobbyPage(LIST_OF(LISTED));
  page.elements['h-lobby'].listeners.click();
  await settle();
  const button = buttonsOf(page.elements['lobby-rooms'])[0];
  button.focus();

  // when
  page.elements['h-lobby'].listeners.click();
  await settle();

  // then
  assert.equal(buttonsOf(page.elements['lobby-rooms'])[0], button);
  assert.equal(page.registry.focused, button);
});

test('lobby page: a join that does not open the room keeps the focus on the page, on Создать комнату', async () => {
  // given
  const page = loadLobbyPage({ ...LIST_OF(LISTED), [JOIN]: [[409, { error: 'room_full' }]] });
  page.elements['h-lobby'].listeners.click();
  await settle();
  const button = buttonsOf(page.elements['lobby-rooms'])[0];

  // when
  await button.listeners.click();
  await settle();

  // then
  assert.equal(page.registry.focused, page.elements['lobby-create']);
});

test('lobby page: a host nick like <img src=x> is shown as text, not as an element', async () => {
  // given
  const nick = '<img src=x onerror=alert(1)>';
  const page = loadLobbyPage(LIST_OF([{ ...LISTED[0], host: { nick } }]));

  // when
  page.elements['h-lobby'].listeners.click();
  await settle();

  // then
  assert.ok(textsOf(page.elements['lobby-rooms'].children[0]).includes(nick));
  assert.ok(!page.registry.created.includes('img'));
});

test('lobby page: an empty list says so and points to Создать комнату; a failed one says the server is not answering', async () => {
  // given
  const empty = loadLobbyPage(LIST_OF([]));
  const down = loadLobbyPage({ ...PRESENCE, [ROOM_LIST]: [[OFFLINE]] });

  // when
  empty.elements['h-lobby'].listeners.click();
  down.elements['h-lobby'].listeners.click();
  await settle();

  // then
  assert.match(empty.elements['lobby-rooms-status'].textContent, /Создать комнату/);
  assert.equal(empty.elements['lobby-rooms-title'].textContent, 'Открытые комнаты: 0');
  assert.equal(down.elements['lobby-rooms-status'].textContent, TEXT.roomsDown);
  assert.equal(down.elements['lobby-online'].children.length, 2);
});

test('lobby page: the room view links the mail app to the room link and the link adds no call and no listener', async () => {
  // given
  const page = loadLobbyPage({ ...LIST_OF(LISTED), [JOIN]: [[200, room()]], [POLL]: [[200, room()]] });
  page.elements['h-lobby'].listeners.click();
  await settle();

  // when
  await buttonsOf(page.elements['lobby-rooms'].children[0])[0].listeners.click();
  await settle();

  // then
  const roomLink = 'test://rassimok.dev/klad/#room=' + ID;
  assert.equal(page.elements['lobby-link'].value, roomLink);
  assert.equal(page.elements['lobby-mail'].href, KLAD_LOBBY.inviteMailto(roomLink));
  assert.equal(page.elements['lobby-mail'].target, '_blank');
  assert.equal(page.elements['lobby-mail'].rel, 'noopener');
  assert.deepEqual(page.elements['lobby-mail'].listeners, {});
  assert.deepEqual(page.server.calls, [HEARTBEAT, ONLINE_LIST, ROOM_LIST, JOIN, POLL]);
});

test('lobby page: the Войти button joins the room and the list part is hidden', async () => {
  // given
  const page = loadLobbyPage({ ...LIST_OF(LISTED), [JOIN]: [[200, room()]], [POLL]: [[200, room()]] });
  page.elements['h-lobby'].listeners.click();
  await settle();

  // when
  await buttonsOf(page.elements['lobby-rooms'].children[0])[0].listeners.click();
  await settle();

  // then
  assert.ok(page.server.calls.includes(JOIN));
  assert.equal(page.elements['lobby-out'].hidden, true);
  assert.equal(page.elements['lobby-room'].hidden, false);
});

test('lobby page: the link-only box before Создать комнату sends listed=false, and the host switch sends the listed body', async () => {
  // given
  const link = 'POST /klad/api/rooms?listed=false';
  const page = loadLobbyPage({
    ...LIST_OF([]), [link]: [[201, { id: ID }]], [POLL]: [[200, { ...HOSTED, listed: false }]],
    ['POST /klad/api/rooms/' + ID + '/listed']: [[200, HOSTED]],
  });
  page.elements['h-lobby'].listeners.click();
  await settle();
  page.elements['lobby-private'].checked = true;

  // when
  await page.elements['lobby-create'].listeners.click();
  await settle();

  // then
  assert.ok(page.server.calls.includes(link));
  assert.equal(page.elements['lobby-link-only'].checked, true);
  assert.match(page.elements['lobby-listed-line'].textContent, /только по ссылке/);
  assert.equal(page.elements['lobby-listed-row'].hidden, false);

  // when
  page.elements['lobby-link-only'].checked = false;
  await page.elements['lobby-link-only'].listeners.change();
  await settle();

  // then
  assert.ok(page.server.calls.includes('POST /klad/api/rooms/' + ID + '/listed {"listed":true}'));
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
