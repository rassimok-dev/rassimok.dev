'use strict';
/* The /klad/api proxy (functions/klad/api/[[path]].js) against a fake fetch.
   Only the path and query of the request URL matter to the proxy, so the
   test URLs use a test: scheme instead of a full site URL. The origin is
   URL-shaped so that each test can check the host the proxy would reach. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { onRequest } = require('../../functions/klad/api/[[path]].js');

const API_ORIGIN = 'test://api.origin';
const env = { API_ORIGIN };

function fakeFetch(t, upstreamResponse = new Response('{}')) {
  return t.mock.method(globalThis, 'fetch', async () => upstreamResponse);
}

function forwarded(fetchMock) {
  assert.equal(fetchMock.mock.callCount(), 1);
  const [url, init] = fetchMock.mock.calls[0].arguments;
  assert.equal(new URL(url).host, 'api.origin');
  return { url, init };
}

test('proxy maps the path and keeps the query string', async (t) => {
  const fetchMock = fakeFetch(t);
  const request = new Request('test:/klad/api/boards/level?kind=human&level=3');

  await onRequest({ request, env });

  assert.equal(forwarded(fetchMock).url, API_ORIGIN + '/boards/level?kind=human&level=3');
});

test('proxy keeps a double slash in the path on the configured origin', async (t) => {
  const fetchMock = fakeFetch(t);
  const request = new Request('test:/klad/api//other.host/status');

  await onRequest({ request, env });

  assert.equal(forwarded(fetchMock).url, API_ORIGIN + '//other.host/status');
});

for (const path of [
  '/klad/api@other.host/x',
  '/klad/api.other.host/x',
  '/klad/apix',
  '/klad/api/%2e%2e/%2e%2e/aaaaaaaa@other.host/x',
]) {
  test(`proxy answers 404 without a fetch for ${path}`, async (t) => {
    const fetchMock = fakeFetch(t);
    const request = new Request('test:' + path);

    const response = await onRequest({ request, env });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'not_found' });
    assert.equal(fetchMock.mock.callCount(), 0);
  });
}

test('proxy passes on the method and the body', async (t) => {
  const fetchMock = fakeFetch(t);
  const body = '{"nick":"digger","kind":"human"}';
  const request = new Request('test:/klad/api/players', { method: 'POST', body });

  await onRequest({ request, env });

  const { init } = forwarded(fetchMock);
  assert.equal(init.method, 'POST');
  assert.equal(await new Response(init.body).text(), body);
  assert.equal(init.redirect, 'manual');
});

for (const method of ['GET', 'HEAD']) {
  test(`proxy sends no body for ${method}`, async (t) => {
    const fetchMock = fakeFetch(t);
    const request = new Request('test:/klad/api/players/me', { method });

    await onRequest({ request, env });

    const { init } = forwarded(fetchMock);
    assert.equal(init.method, method);
    assert.equal(init.body, undefined);
  });
}

test('proxy forwards only Content-Type, Accept and Cookie', async (t) => {
  const fetchMock = fakeFetch(t);
  const request = new Request('test:/klad/api/clears', {
    method: 'POST',
    body: '{}',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Cookie': 'klad_session=token',
      'Authorization': 'Bearer secret',
      'User-Agent': 'browser',
      'Referer': 'test:/klad/',
      'CF-Connecting-IP': '192.0.2.1',
      'X-Forwarded-For': '192.0.2.1',
    },
  });

  await onRequest({ request, env });

  assert.deepEqual([...forwarded(fetchMock).init.headers], [
    ['accept', 'application/json'],
    ['content-type', 'application/json'],
    ['cookie', 'klad_session=token'],
  ]);
});

test('proxy returns the upstream response unchanged, every Set-Cookie included', async (t) => {
  const upstreamHeaders = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  upstreamHeaders.append('Set-Cookie', 'klad_session=new; Path=/klad/api; HttpOnly');
  upstreamHeaders.append('Set-Cookie', 'other=1; Path=/klad/api');
  fakeFetch(t, new Response('{"nick":"digger"}', { status: 201, headers: upstreamHeaders }));
  const request = new Request('test:/klad/api/players', { method: 'POST', body: '{}' });

  const response = await onRequest({ request, env });

  assert.equal(response.status, 201);
  assert.deepEqual(response.headers.getSetCookie(), [
    'klad_session=new; Path=/klad/api; HttpOnly',
    'other=1; Path=/klad/api',
  ]);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(await response.text(), '{"nick":"digger"}');
});

test('proxy answers 502 when the upstream fetch fails', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed');
  });
  const request = new Request('test:/klad/api/status');

  const response = await onRequest({ request, env });

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'upstream' });
});

test('proxy answers 503 when API_ORIGIN is not set', async (t) => {
  const fetchMock = fakeFetch(t);
  const request = new Request('test:/klad/api/status');

  const response = await onRequest({ request, env: {} });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'not_configured' });
  assert.equal(fetchMock.mock.callCount(), 0);
});
