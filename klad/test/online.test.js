'use strict';
/* klad/online.js without a browser. The fake server answers by method and
   path, in order, repeating its last answer; a path it does not know gets
   404, as production does until the API is deployed. The held request, if
   one is named, waits for release(). The fake page counts nick prompts and
   records notices. */
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

function fakeServer(answers, heldRequest) {
  const calls = [];
  let release;
  const released = new Promise((resolve) => { release = resolve; });
  async function fetch(url, options) {
    const request = options.method + ' ' + url;
    calls.push({
      request,
      contentType: options.headers && options.headers['Content-Type'],
      body: options.body === undefined ? undefined : JSON.parse(options.body),
    });
    if (request === heldRequest) await released;
    const queue = answers[request] || [[404, { error: 'not_found' }]];
    const [status, body] = queue.length > 1 ? queue.shift() : queue[0];
    if (status === OFFLINE) throw new TypeError('fetch failed');
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  }
  return { fetch, calls, release };
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

test('ask after a skip opens the prompt again and only later results wait for the nick', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
    'POST /klad/api/runs': [CREATED],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);
  online.skip();

  // when
  online.ask();
  await online.onRun(RUN);
  const problem = await online.choose('test', 'agent');

  // then
  assert.equal(problem, null);
  assert.equal(page.asked, 2);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    call('POST /klad/api/runs', RUN_BODY),
  ]);
});

test('skipping while the nick is being saved deletes the new player and sends nothing', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
    'DELETE /klad/api/players/me': [[204]],
    'POST /klad/api/clears': [CREATED],
  }, 'POST /klad/api/players');
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);

  // when
  const saving = online.choose('test', 'agent');
  online.skip();
  server.release();
  const problem = await saving;
  await online.onClear(CLEAR);

  // then
  assert.equal(problem, null);
  assert.equal(online.player(), null);
  assert.equal(page.asked, 1);
  assert.deepEqual(page.notices, []);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    call('DELETE /klad/api/players/me'),
  ]);
});

test('an undo that fails after a skip during the save says the nick was kept', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
    'DELETE /klad/api/players/me': [[OFFLINE]],
  }, 'POST /klad/api/players');
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);

  // when
  const saving = online.choose('test', 'agent');
  online.skip();
  server.release();
  await saving;
  await online.onClear(CLEAR);

  // then
  assert.equal(online.player(), null);
  assert.deepEqual(page.notices, [TEXT.nickKept]);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    call('DELETE /klad/api/players/me'),
  ]);
});

test('an undo answered 401 after a skip during the save shows no notice', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
    'DELETE /klad/api/players/me': [NO_SESSION],
  }, 'POST /klad/api/players');
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);

  // when
  const saving = online.choose('test', 'agent');
  online.skip();
  server.release();
  await saving;

  // then
  assert.equal(online.player(), null);
  assert.deepEqual(page.notices, []);
});

test('a skip while the signed-in player is being read back keeps no player', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER]],
    'POST /klad/api/players': [[409, { error: 'already_signed_in' }]],
    'POST /klad/api/clears': [CREATED],
  }, 'GET /klad/api/players/me');
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);

  // when
  const saving = online.choose('test', 'agent');
  for (let turn = 0; turn < 100 && server.calls.length < 2; turn++) await new Promise(setImmediate);
  online.skip();
  server.release();
  const problem = await saving;
  await online.onClear(CLEAR);

  // then
  assert.equal(problem, null);
  assert.equal(online.player(), null);
  assert.deepEqual(page.notices, []);
  assert.deepEqual(server.calls, [call('POST /klad/api/players', { nick: 'test', kind: 'agent' }), READ_ME]);
});

test('skipping while already_signed_in is being answered keeps no player and sends nothing', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION, [200, PLAYER]],
    'POST /klad/api/players': [[409, { error: 'already_signed_in' }]],
    'POST /klad/api/clears': [CREATED],
  }, 'POST /klad/api/players');
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);

  // when
  const saving = online.choose('test', 'agent');
  online.skip();
  server.release();
  const problem = await saving;
  await online.onClear(CLEAR);

  // then
  assert.equal(problem, null);
  assert.equal(online.player(), null);
  assert.deepEqual(page.notices, []);
  assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/players', { nick: 'test', kind: 'agent' })]);
});

test('closing the prompt while the waiting results are sent deletes the new player and sends no more', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
    'POST /klad/api/clears': [CREATED],
    'POST /klad/api/runs': [CREATED],
    'DELETE /klad/api/players/me': [[204]],
  }, 'POST /klad/api/clears');
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);
  await online.onRun(RUN);

  // when
  const saving = online.choose('test', 'agent');
  for (let turn = 0; turn < 100 && server.calls.length < 3; turn++) await new Promise(setImmediate);
  const isAskingAtClose = online.isAsking();
  if (online.isAsking()) online.skip();
  server.release();
  const problem = await saving;
  await online.onClear(CLEAR);

  // then
  assert.equal(isAskingAtClose, true);
  assert.equal(problem, null);
  assert.equal(online.player(), null);
  assert.equal(online.isAsking(), false);
  assert.deepEqual(page.notices, []);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    call('POST /klad/api/clears', CLEAR),
    call('DELETE /klad/api/players/me'),
  ]);
});

test('a result that arrives after a skip during the save is not sent', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
    'POST /klad/api/clears': [CREATED],
    'DELETE /klad/api/players/me': [[204]],
  }, 'POST /klad/api/clears');
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);

  // when
  const saving = online.choose('test', 'agent');
  for (let turn = 0; turn < 100 && server.calls.length < 3; turn++) await new Promise(setImmediate);
  online.skip();
  const late = online.onClear(CLEAR);
  server.release();
  await saving;
  await late;

  // then
  assert.equal(online.player(), null);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    call('POST /klad/api/clears', CLEAR),
    call('DELETE /klad/api/players/me'),
  ]);
});

test('closing the prompt while a new player is read back deletes it and sends nothing', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER]],
    'POST /klad/api/players': [[201, PLAYER]],
    'POST /klad/api/clears': [CREATED],
    'DELETE /klad/api/players/me': [[204]],
  }, 'GET /klad/api/players/me');
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  online.ask();

  // when
  const saving = online.choose('test', 'agent');
  for (let turn = 0; turn < 100 && server.calls.length < 2; turn++) await new Promise(setImmediate);
  const isAskingAtClose = online.isAsking();
  if (online.isAsking()) online.skip();
  server.release();
  const problem = await saving;
  await online.onClear(CLEAR);

  // then
  assert.equal(isAskingAtClose, true);
  assert.equal(problem, null);
  assert.equal(online.player(), null);
  assert.deepEqual(page.notices, []);
  assert.deepEqual(server.calls, [
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    READ_ME,
    call('DELETE /klad/api/players/me'),
  ]);
});

test('closing the prompt while results go to the already signed-in player forgets it without a delete', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION, [200, PLAYER]],
    'POST /klad/api/players': [[409, { error: 'already_signed_in' }]],
    'POST /klad/api/clears': [CREATED],
    'POST /klad/api/runs': [CREATED],
  }, 'POST /klad/api/clears');
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);
  await online.onRun(RUN);

  // when
  const saving = online.choose('other', 'human');
  for (let turn = 0; turn < 100 && server.calls.length < 4; turn++) await new Promise(setImmediate);
  if (online.isAsking()) online.skip();
  server.release();
  const problem = await saving;
  await online.onClear(CLEAR);

  // then
  assert.equal(problem, null);
  assert.equal(online.player(), null);
  assert.deepEqual(page.notices, [TEXT.signedIn + 'test.']);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/players', { nick: 'other', kind: 'human' }),
    READ_ME,
    call('POST /klad/api/clears', CLEAR),
  ]);
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

test('a refresh that finds the API back up lets the next result open the prompt', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[502, { error: 'upstream' }], NO_SESSION] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);

  // when
  await online.refresh();
  await online.onClear(CLEAR);

  // then
  assert.equal(online.isAvailable(), true);
  assert.equal(page.asked, 1);
  assert.deepEqual(server.calls, [READ_ME, READ_ME]);
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

test('400 invalid_result on a send drops the result with a notice and keeps the player', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER]],
    'POST /klad/api/clears': [[400, { error: 'invalid_result' }]],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();

  // when
  await online.onClear(CLEAR);

  // then
  assert.deepEqual(page.notices, [TEXT.notSaved]);
  assert.deepEqual(online.player(), PLAYER);
  assert.equal(page.asked, 0);
  assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/clears', CLEAR)]);
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

test('401 right after the player was created reports blocked cookies and counts as a skip', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
    'POST /klad/api/clears': [NO_SESSION],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);

  // when
  const problem = await online.choose('test', 'agent');
  const askedAfterChoose = page.asked;
  await online.onClear(CLEAR);

  // then
  assert.equal(problem, TEXT.noCookie);
  assert.equal(online.player(), null);
  assert.equal(online.isAsking(), false);
  assert.equal(online.isCookieBlocked(), true);
  assert.equal(page.asked, askedAfterChoose);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    call('POST /klad/api/clears', CLEAR),
  ]);
});

test('after blocked cookies a save from the boards posts no second player', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
    'POST /klad/api/clears': [NO_SESSION],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.onClear(CLEAR);
  await online.choose('test', 'agent');

  // when
  online.ask();
  const problem = await online.choose('test2', 'agent');

  // then
  assert.equal(problem, TEXT.noCookie);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    call('POST /klad/api/clears', CLEAR),
  ]);
});

test('a nick chosen with nothing waiting is read back once and kept', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION, [200, PLAYER]],
    'POST /klad/api/players': [[201, PLAYER]],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  online.ask();

  // when
  const problem = await online.choose('test', 'agent');

  // then
  assert.equal(problem, null);
  assert.deepEqual(online.player(), PLAYER);
  assert.equal(online.isAsking(), false);
  assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/players', { nick: 'test', kind: 'agent' }), READ_ME]);
});

test('a nick chosen with nothing waiting that reads back 401 reports blocked cookies at once', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/players': [[201, PLAYER]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  online.ask();

  // when
  const problem = await online.choose('test', 'agent');

  // then
  assert.equal(problem, TEXT.noCookie);
  assert.equal(online.player(), null);
  assert.equal(online.isAsking(), false);
  assert.equal(online.isCookieBlocked(), true);
  assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/players', { nick: 'test', kind: 'agent' }), READ_ME]);
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

for (const [status, error, text] of [
  [409, 'nick_taken', TEXT.nickTaken],
  [400, 'invalid_kind', TEXT.invalidKind],
  [503, 'not_configured', TEXT.unavailable],
]) {
  test('choose answers ' + status + ' ' + error + ' with its message and keeps the prompt open', async () => {
    // given
    const server = fakeServer({
      'GET /klad/api/players/me': [NO_SESSION],
      'POST /klad/api/players': [[status, { error }]],
    });
    const online = KLAD_ONLINE.create(server.fetch, fakePage());
    await online.start();
    await online.onClear(CLEAR);

    // when
    const problem = await online.choose('test', 'human');

    // then
    assert.equal(problem, text);
    assert.equal(online.isAsking(), true);
    assert.equal(online.player(), null);
    assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/players', { nick: 'test', kind: 'human' })]);
  });
}

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

test('401 on rename forgets the player and says only that this browser has no nick', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'PATCH /klad/api/players/me': [NO_SESSION] });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();

  // when
  const problem = await online.rename('test2');

  // then
  assert.equal(problem, TEXT.noPlayer);
  assert.equal(online.player(), null);
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

test('401 on remove forgets the player and stops sending, without claiming a delete', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'DELETE /klad/api/players/me': [NO_SESSION] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();

  // when
  const problem = await online.remove();
  await online.onClear(CLEAR);

  // then
  assert.equal(problem, TEXT.noPlayer);
  assert.equal(online.player(), null);
  assert.equal(page.asked, 0);
  assert.deepEqual(server.calls, [READ_ME, call('DELETE /klad/api/players/me')]);
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

const EMAIL = 'test@example.com';
const CODE = '012345';
const ACCOUNT = { nick: 'test', kind: 'agent', account: true, email: EMAIL };
const CODE_SENT = [202, {}];
const SEND_CODE = call('POST /klad/api/login/code', { email: EMAIL });
const verifyCall = (code) => call('POST /klad/api/login/verify', { email: EMAIL, code });

test('requestCode posts the email as JSON and 202 opens the code step', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'POST /klad/api/login/code': [CODE_SENT] });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();

  // when
  const problem = await online.requestCode(EMAIL);

  // then
  assert.equal(problem, null);
  assert.equal(online.isCodeSent(), true);
  assert.deepEqual(server.calls, [READ_ME, SEND_CODE]);
});

for (const [answer, name, text] of [
  [[400, { error: 'invalid_email' }], '400 invalid_email', TEXT.invalidEmail],
  [[429, { error: 'rate_limited' }], '429 rate_limited', TEXT.codeLimited],
  [[404, { error: 'not_found' }], '404 before the API has accounts', TEXT.unavailable],
  [[OFFLINE], 'a network failure', TEXT.unavailable],
]) {
  test('requestCode answered with ' + name + ' gives its message and opens no code step', async () => {
    // given
    const server = fakeServer({ 'GET /klad/api/players/me': [[200, PLAYER]], 'POST /klad/api/login/code': [answer] });
    const online = KLAD_ONLINE.create(server.fetch, fakePage());
    await online.start();

    // when
    const problem = await online.requestCode(EMAIL);

    // then
    assert.equal(problem, text);
    assert.equal(online.isCodeSent(), false);
    assert.deepEqual(online.player(), PLAYER);
  });
}

test('verify posts the email the code went to and the code as a string, and merged true says so', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER], [200, ACCOUNT]],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [[200, { ...ACCOUNT, merged: true }]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.requestCode(EMAIL);

  // when
  const text = await online.verify(CODE);

  // then
  assert.equal(text, TEXT.merged);
  assert.deepEqual(online.player(), ACCOUNT);
  assert.equal(online.isCodeSent(), false);
  assert.deepEqual(server.calls, [READ_ME, SEND_CODE, verifyCall(CODE), READ_ME]);
});

test('verify with merged false and a guest of another kind says why the results stayed', async () => {
  // given
  const human = { nick: 'owner', kind: 'human', account: true, email: EMAIL };
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER], [200, human]],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [[200, { ...human, merged: false }]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.requestCode(EMAIL);

  // when
  const text = await online.verify(CODE);

  // then
  assert.equal(text, TEXT.otherKind);
  assert.deepEqual(online.player(), human);
});

test('verify with merged false and a guest of the same kind says the results stayed with its nick', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER], [200, ACCOUNT]],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [[200, { ...ACCOUNT, merged: false }]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.requestCode(EMAIL);

  // when
  const text = await online.verify(CODE);

  // then
  assert.equal(text, TEXT.kept('test'));
  assert.deepEqual(online.player(), ACCOUNT);
});

test('verify without a guest logs in to the account and later results go to it', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION, [200, ACCOUNT]],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [[200, { ...ACCOUNT, merged: false }]],
    'POST /klad/api/clears': [CREATED],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.requestCode(EMAIL);

  // when
  const text = await online.verify(CODE);
  await online.onClear(CLEAR);

  // then
  assert.equal(text, TEXT.loggedIn);
  assert.deepEqual(online.player(), ACCOUNT);
  assert.equal(page.asked, 0);
  assert.deepEqual(server.calls, [READ_ME, SEND_CODE, verifyCall(CODE), READ_ME, call('POST /klad/api/clears', CLEAR)]);
});

test('invalid_code on verify keeps the guest and the code step for another try', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER]],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [[400, { error: 'invalid_code' }]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.requestCode(EMAIL);

  // when
  const text = await online.verify('999999');

  // then
  assert.equal(text, TEXT.invalidCode);
  assert.equal(online.isCodeSent(), true);
  assert.deepEqual(online.player(), PLAYER);
});

test('too_many_attempts on verify keeps the guest and asks for a new code', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER]],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [[429, { error: 'too_many_attempts' }]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.requestCode(EMAIL);

  // when
  const text = await online.verify('999999');

  // then
  assert.equal(text, TEXT.tooManyAttempts);
  assert.equal(online.isCodeSent(), false);
  assert.deepEqual(online.player(), PLAYER);
});

for (const [answer, name] of [[[502, { error: 'upstream' }], '502'], [[OFFLINE], 'a network failure']]) {
  test('verify answered with ' + name + ' keeps the guest and the code step', async () => {
    // given
    const server = fakeServer({
      'GET /klad/api/players/me': [[200, PLAYER]],
      'POST /klad/api/login/code': [CODE_SENT],
      'POST /klad/api/login/verify': [answer],
    });
    const online = KLAD_ONLINE.create(server.fetch, fakePage());
    await online.start();
    await online.requestCode(EMAIL);

    // when
    const text = await online.verify(CODE);

    // then
    assert.equal(text, TEXT.unavailable);
    assert.equal(online.isCodeSent(), true);
    assert.deepEqual(online.player(), PLAYER);
  });
}

test('no_session on verify asks for a nick first, and the same code then makes the account', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION, [200, PLAYER], [200, ACCOUNT]],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [NO_SESSION, [200, { ...ACCOUNT, merged: false }]],
    'POST /klad/api/players': [[201, PLAYER]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.requestCode(EMAIL);

  // when
  const first = await online.verify(CODE);
  const isCodeKept = online.isCodeSent();
  online.ask();
  await online.choose('test', 'agent');
  const second = await online.verify(CODE);

  // then
  assert.equal(first, TEXT.loginNoSession);
  assert.equal(isCodeKept, true);
  assert.equal(second, TEXT.kept('test'));
  assert.deepEqual(online.player(), ACCOUNT);
  assert.deepEqual(server.calls, [
    READ_ME,
    SEND_CODE,
    verifyCall(CODE),
    call('POST /klad/api/players', { nick: 'test', kind: 'agent' }),
    READ_ME,
    verifyCall(CODE),
    READ_ME,
  ]);
});

test('nick_taken on verify asks for a new nick, then a new code makes the account', async () => {
  // given
  const renamed = { ...PLAYER, nick: 'test2' };
  const account = { ...ACCOUNT, nick: 'test2' };
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER], [200, account]],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [[409, { error: 'nick_taken' }], [200, { ...account, merged: false }]],
    'PATCH /klad/api/players/me': [[200, renamed]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.requestCode(EMAIL);

  // when
  const first = await online.verify(CODE);
  const isCodeKept = online.isCodeSent();
  await online.rename('test2');
  await online.requestCode(EMAIL);
  const second = await online.verify('654321');

  // then
  assert.equal(first, TEXT.loginNickTaken);
  assert.equal(isCodeKept, false);
  assert.equal(second, TEXT.kept('test2'));
  assert.deepEqual(online.player(), account);
  assert.deepEqual(server.calls, [
    READ_ME,
    SEND_CODE,
    verifyCall(CODE),
    call('PATCH /klad/api/players/me', { nick: 'test2' }),
    SEND_CODE,
    verifyCall('654321'),
    READ_ME,
  ]);
});

test('logout posts /logout without a body, the page has no player and asks for no nick', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, ACCOUNT]], 'POST /klad/api/logout': [[204]] });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();

  // when
  const problem = await online.logout();
  await online.onClear(CLEAR);

  // then
  assert.equal(problem, null);
  assert.equal(online.player(), null);
  assert.equal(page.asked, 0);
  assert.deepEqual(server.calls, [READ_ME, call('POST /klad/api/logout')]);
});

test('401 on logout forgets the player and says this browser has no nick', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, ACCOUNT]], 'POST /klad/api/logout': [NO_SESSION] });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();

  // when
  const problem = await online.logout();

  // then
  assert.equal(problem, TEXT.noPlayer);
  assert.equal(online.player(), null);
});

test('a logout that fails keeps the account and says so', async () => {
  // given
  const server = fakeServer({ 'GET /klad/api/players/me': [[200, ACCOUNT]], 'POST /klad/api/logout': [[OFFLINE]] });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();

  // when
  const problem = await online.logout();

  // then
  assert.equal(problem, TEXT.unavailable);
  assert.deepEqual(online.player(), ACCOUNT);
});

test('deleting the guest while a code is out closes the code step', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, PLAYER]],
    'POST /klad/api/login/code': [CODE_SENT],
    'DELETE /klad/api/players/me': [[204]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.requestCode(EMAIL);

  // when
  await online.remove();

  // then
  assert.equal(online.isCodeSent(), false);
  assert.equal(online.player(), null);
});

test('a login after a logout ends the skip, so a result answered 401 asks for a nick again', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [[200, ACCOUNT]],
    'POST /klad/api/logout': [[204]],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [[200, { ...ACCOUNT, merged: false }]],
    'POST /klad/api/clears': [NO_SESSION],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.logout();
  await online.requestCode(EMAIL);

  // when
  const text = await online.verify(CODE);
  await online.onClear(CLEAR);

  // then
  assert.equal(text, TEXT.loggedIn);
  assert.equal(online.player(), null);
  assert.equal(page.asked, 1);
  assert.deepEqual(server.calls, [
    READ_ME,
    call('POST /klad/api/logout'),
    SEND_CODE,
    verifyCall(CODE),
    READ_ME,
    call('POST /klad/api/clears', CLEAR),
  ]);
});

test('a login that reads back no player reports blocked cookies, and no nick is asked for or posted', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [[200, { ...ACCOUNT, merged: false }]],
  });
  const page = fakePage();
  const online = KLAD_ONLINE.create(server.fetch, page);
  await online.start();
  await online.requestCode(EMAIL);

  // when
  const text = await online.verify(CODE);
  await online.onClear(CLEAR);
  const askedAfterClear = page.asked;
  online.ask();
  const problem = await online.choose('test', 'agent');

  // then
  assert.equal(text, TEXT.noCookie);
  assert.equal(askedAfterClear, 0);
  assert.equal(problem, TEXT.noCookie);
  assert.equal(online.player(), null);
  assert.equal(online.isCookieBlocked(), true);
  assert.equal(online.isCodeSent(), false);
  assert.deepEqual(server.calls, [READ_ME, SEND_CODE, verifyCall(CODE), READ_ME]);
});

test('a login whose read-back fails on the network keeps the account', async () => {
  // given
  const server = fakeServer({
    'GET /klad/api/players/me': [NO_SESSION, [OFFLINE]],
    'POST /klad/api/login/code': [CODE_SENT],
    'POST /klad/api/login/verify': [[200, { ...ACCOUNT, merged: false }]],
  });
  const online = KLAD_ONLINE.create(server.fetch, fakePage());
  await online.start();
  await online.requestCode(EMAIL);

  // when
  const text = await online.verify(CODE);

  // then
  assert.equal(text, TEXT.loggedIn);
  assert.deepEqual(online.player(), ACCOUNT);
  assert.equal(online.isCookieBlocked(), false);
});
