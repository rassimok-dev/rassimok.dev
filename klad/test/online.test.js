'use strict';
/* klad/online.js without a browser. The fake server answers by method and
   path, in order, repeating its last answer; a path it does not know gets
   404, as production does until the API is deployed. The fake page counts nick
   prompts and records notices. */
const test = require('node:test');
const assert = require('node:assert/strict');
const KLAD_ONLINE = require('../online.js');

const { TEXT } = KLAD_ONLINE;
const OFFLINE = 'offline';
const PLAYER = { nick: 'test', kind: 'agent', account: false, email: null };
const NO_SESSION = [401, { error: 'no_session' }];
const CREATED = [201, {}];
const CLEAR = { level: 2, shape: 'portrait', revision: 1, ticks: 1500, chests: 3, chestsTotal: 4 };
const RUN = { fromLevelOne: true, levelsCleared: 2, score: 1700, ticks: 4000 };
const RUN_BODY = { levelsCleared: 2, score: 1700, ticks: 4000 };

function fakeServer(answers) {
  const calls = [];
  async function fetch(url, options) {
    const request = options.method + ' ' + url;
    calls.push({
      request,
      contentType: options.headers && options.headers['Content-Type'],
      body: options.body === undefined ? undefined : JSON.parse(options.body),
    });
    const queue = answers[request] || [[404, { error: 'not_found' }]];
    const [status, body] = queue.length > 1 ? queue.shift() : queue[0];
    if (status === OFFLINE) throw new TypeError('fetch failed');
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  }
  return { fetch, calls };
}

function fakePage() {
  return {
    asked: 0,
    notices: [],
    askNick() { this.asked++; },
    notice(text) { this.notices.push(text); },
  };
}

const call = (request, body) => ({ request, contentType: body === undefined ? undefined : 'application/json', body });
const READ_ME = call('GET /klad/api/players/me');

test('start reads the player with GET and no body', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);

  // when
  await online.start();

  // then
  assert.deepEqual(server.calls, [READ_ME]);
  assert.deepEqual(online.player(), PLAYER);
  assert.equal(online.isAvailable(), true);
  assert.equal(page.asked, 0);
});

test('a clear posts exactly the clear fields as JSON', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'POST /klad/api/clears': [CREATED] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();

  // when
  await online.onClear({ ...CLEAR });

  // then
  assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/clears', CLEAR)]);
  assert.deepEqual(page.notices, []);
});

test('a run is sent only when it started at level one, without fromLevelOne', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'POST /klad/api/runs': [CREATED] });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();

  // when
  await online.onRun({ ...RUN, fromLevelOne: false });
  await online.onRun(RUN);

  // then
  assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/runs', RUN_BODY)]);
});

test('a run that did not start at level one opens no prompt', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [NO_SESSION] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();

  // when
  await online.onRun({ ...RUN, fromLevelOne: false });

  // then
  assert.equal(page.asked, 0);
  assert.deepEqual(server.calls, [READ_ME]);
});

test('results before a player wait for the nick and are sent after it is chosen', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
    'POST /klad/api/clears': [CREATED],
    'POST /klad/api/runs': [CREATED],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);
  await online.onRun(RUN);

  // when
  const problem = await online.choose('test', 'agent');

  // then
  assert.equal(page.asked, 1);
  assert.equal(problem, null);
  assert.deepEqual(online.player(), PLAYER);
  assert.equal(online.isAsking(), false);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    call('POST /klad/api/clears', CLEAR),
    call('POST /klad/api/runs', RUN_BODY),
  ]);
});

test('a clear that arrives while the player is being read is sent once the player is known', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'POST /klad/api/clears': [CREATED] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);

  // when
  const starting = online.start();
  online.onClear(CLEAR);
  await starting;

  // then
  assert.equal(page.asked, 0);
  assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/clears', CLEAR)]);
});

test('skipping the prompt drops the waiting results and asks no more', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [NO_SESSION] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);

  // when
  online.skip();
  await online.onClear(CLEAR);
  await online.onRun(RUN);

  // then
  assert.equal(page.asked, 1);
  assert.equal(online.isAsking(), false);
  assert.deepEqual(server.calls, [READ_ME]);
});

test('404 on GET /players/me means online is unavailable: no prompt, nothing sent', async () => {
  // given
  const server = fakeServer({});
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);

  // when
  await online.start();
  await online.onClear(CLEAR);
  await online.onRun(RUN);

  // then
  assert.equal(online.isAvailable(), false);
  assert.equal(page.asked, 0);
  assert.deepEqual(page.notices, []);
  assert.deepEqual(server.calls, [READ_ME]);
});

test('a network failure at start leaves the game playing offline', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[OFFLINE]] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);

  // when
  await online.start();
  await online.onClear(CLEAR);

  // then
  assert.equal(online.isAvailable(), false);
  assert.equal(online.player(), null);
  assert.equal(page.asked, 0);
  assert.deepEqual(server.calls, [READ_ME]);
});

test('a network failure on a send shows a notice and keeps the player', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'POST /klad/api/clears': [[OFFLINE]] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();

  // when
  await online.onClear(CLEAR);

  // then
  assert.deepEqual(page.notices, [TEXT.notSaved]);
  assert.deepEqual(online.player(), PLAYER);
});

test('401 on a send forgets the player, keeps the result and asks again', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER]],
    'POST /klad/api/clears': [NO_SESSION, CREATED],
    'POST /klad/api/players': [[201, PLAYER]],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);

  // when
  const problem = await online.choose('test', 'agent');

  // then
  assert.equal(page.asked, 1);
  assert.equal(problem, null);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/clears', CLEAR),
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    call('POST /klad/api/clears', CLEAR),
  ]);
});

test('401 right after the player was created reports blocked cookies and keeps asking', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
    'POST /klad/api/clears': [NO_SESSION],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.onClear(CLEAR);

  // when
  const problem = await online.choose('test', 'agent');

  // then
  assert.equal(problem, TEXT.noCookie);
  assert.equal(online.player(), null);
  assert.equal(online.isAsking(), true);
});

test('409 already_signed_in reads the signed-in player and sends the waiting results', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION, [200, PLAYER]],
    'POST /klad/api/players': [[409, { error: 'already_signed_in' }]],
    'POST /klad/api/clears': [CREATED],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);

  // when
  const problem = await online.choose('other', 'human');

  // then
  assert.equal(problem, null);
  assert.deepEqual(online.player(), PLAYER);
  assert.deepEqual(page.notices, [TEXT.signedIn + 'test.']);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/players', { nick: 'other', kind: 'human' }),
    READ_ME,
    call('POST /klad/api/clears', CLEAR),
  ]);
});

test('invalid_nick keeps the prompt open and sends nothing else', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[400, { error: 'invalid_nick' }]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.onClear(CLEAR);

  // when
  const problem = await online.choose('ab', 'human');

  // then
  assert.equal(problem, TEXT.invalidNick);
  assert.equal(online.isAsking(), true);
  assert.equal(online.player(), null);
  assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/players', { nick: 'ab', kind: 'human' })]);
});

test('429 drops the result with a notice and the next result is still sent', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER]],
    'POST /klad/api/clears': [[429, { error: 'rate_limited' }], CREATED],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();

  // when
  await online.onClear(CLEAR);
  await online.onClear(CLEAR);

  // then
  assert.deepEqual(page.notices, [TEXT.rateLimited]);
  assert.deepEqual(online.player(), PLAYER);
  assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/clears', CLEAR), call('POST /klad/api/clears', CLEAR)]);
});

test('rename sends PATCH /players/me with the nick only', async () => {
  // given
  const renamed = { ...PLAYER, nick: 'test2' };
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'PATCH /klad/api/players/me': [[200, renamed]] });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();

  // when
  const problem = await online.rename('test2');

  // then
  assert.equal(problem, null);
  assert.deepEqual(online.player(), renamed);
  assert.deepEqual(server.calls, [READ_ME, call('PATCH /klad/api/players/me', { nick: 'test2' })]);
});

test('nick_taken on rename keeps the old nick', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER]],
    'PATCH /klad/api/players/me': [[409, { error: 'nick_taken' }]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();

  // when
  const problem = await online.rename('owner');

  // then
  assert.equal(problem, TEXT.nickTaken);
  assert.deepEqual(online.player(), PLAYER);
});

test('remove sends DELETE /players/me without a body and the game stops sending', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'DELETE /klad/api/players/me': [[204]] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();

  // when
  const problem = await online.remove();
  await online.onClear(CLEAR);

  // then
  assert.equal(problem, null);
  assert.equal(online.player(), null);
  assert.equal(page.asked, 0);
  assert.deepEqual(server.calls, [READ_ME, call('DELETE /klad/api/players/me')]);
});

test('remove that fails keeps the player and says so', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'DELETE /klad/api/players/me': [[502, { error: 'upstream' }]] });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();

  // when
  const problem = await online.remove();

  // then
  assert.equal(problem, TEXT.unavailable);
  assert.deepEqual(online.player(), PLAYER);
});

test('board paths carry the kind, and the level and shape for a level board', () => {
  assert.equal(KLAD_ONLINE.boardPath('human', 'records', 'landscape'), '/boards/records?kind=human');
  assert.equal(KLAD_ONLINE.boardPath('agent', 'chests', 'portrait'), '/boards/chests?kind=agent');
  assert.equal(KLAD_ONLINE.boardPath('human', '3', 'portrait'), '/boards/level?kind=human&level=3&shape=portrait');
});

test('a board loads with GET, and an unavailable API gives no data', async () => {
  // given
  const entries = { entries: [{ rank: 1, nick: 'test', guest: true, chests: 7 }] };
  const server = fakeServer({ 'GET /klad/api/boards/chests?kind=agent': [[200, entries]] });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());

  // when
  const chests = await online.loadBoard('agent', 'chests', 'landscape');
  const records = await online.loadBoard('human', 'records', 'landscape');

  // then
  assert.deepEqual(chests, entries);
  assert.equal(records, null);
  assert.deepEqual(server.calls, [call('GET /klad/api/boards/chests?kind=agent'), call('GET /klad/api/boards/records?kind=human')]);
});
