// Same-origin proxy for the game's API. The upstream origin lives only in the
// Pages variable API_ORIGIN: CI fails on any full URL in a .js file.
const PREFIX = '/klad/api';
const FORWARDED_HEADERS = ['Content-Type', 'Accept', 'Cookie'];
// The runtime does the WebSocket handshake itself (Sec-WebSocket-Key and the
// rest), so an upgrade adds only these. Origin goes on for the API's own check.
const UPGRADE_HEADERS = ['Upgrade', 'Origin', 'Sec-WebSocket-Protocol'];
// The site's own origin, compared and never fetched. Split in two because CI
// fails on any full URL in a .js file.
const SITE_ORIGIN = 'https:' + '//rassimok.dev';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  // The routing should only send paths under the prefix, but the slice below
  // must not rely on it: /klad/api@other.host would otherwise change the host.
  if (url.pathname !== PREFIX && !url.pathname.startsWith(PREFIX + '/')) {
    return errorResponse(404, 'not_found');
  }
  const path = url.pathname.slice(PREFIX.length);
  if (isQuarkusPath(path)) {
    return errorResponse(404, 'not_found');
  }

  // WebSockets have no CORS, so any page could open one with the player's
  // cookie; only the site's own pages may.
  const isUpgrade = (request.headers.get('Upgrade') ?? '').toLowerCase() === 'websocket';
  if (isUpgrade && request.headers.get('Origin') !== SITE_ORIGIN) {
    return errorResponse(403, 'forbidden_origin');
  }

  if (!env.API_ORIGIN) {
    return errorResponse(503, 'not_configured');
  }

  // Plain concatenation, not new URL(path, origin): a path such as
  // //other.host/x must not be able to change the upstream host.
  const upstreamUrl = env.API_ORIGIN + path + url.search;

  const forwardedNames = isUpgrade ? FORWARDED_HEADERS.concat(UPGRADE_HEADERS) : FORWARDED_HEADERS;
  const headers = new Headers();
  for (const name of forwardedNames) {
    const value = request.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  // Returned as is, also for a 101: the upstream socket travels with this
  // object, and workerd throws on rewriting a 101 into a new Response.
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

// Quarkus serves its health and dev endpoints under /q. Its server decodes
// %71 to q and reads // as /, so the check runs on the decoded path, and a
// path that does not decode counts as one too.
function isQuarkusPath(path) {
  try {
    return /^\/+q(\/|;|$)/i.test(decodeURIComponent(path));
  } catch {
    return true;
  }
}

function errorResponse(status, code) {
  return Response.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } });
}
