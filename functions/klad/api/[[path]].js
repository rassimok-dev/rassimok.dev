// Same-origin proxy for the game's API. The upstream origin lives only in the
// Pages variable API_ORIGIN: CI fails on any full URL in a .js file.
const PREFIX = '/klad/api';
const FORWARDED_HEADERS = ['Content-Type', 'Accept', 'Cookie'];

export async function onRequest({ request, env }) {
  if (!env.API_ORIGIN) {
    return errorResponse(503, 'not_configured');
  }

  const url = new URL(request.url);
  // Plain concatenation, not new URL(path, origin): a path such as
  // //other.host/x must not be able to change the upstream host.
  const upstreamUrl = env.API_ORIGIN + url.pathname.slice(PREFIX.length) + url.search;

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  try {
    return await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
    });
  } catch {
    return errorResponse(502, 'upstream');
  }
}

function errorResponse(status, code) {
  return Response.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } });
}
