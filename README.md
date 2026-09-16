# rassimok.dev

Personal site. Static, dependency-free, and deliberately boring.

This README documents *why* each decision was made, not just what it is.
The reasoning is the point — the page itself is 800 bytes of HTML.

## Principles

**Collect nothing.** No analytics, no cookies, no local storage, no logs I
own. There is nothing to consent to, so there is no cookie banner. The
footer says this, and CI enforces it (see below) so the claim cannot quietly
become false.

**Zero third-party requests.** Fonts are the usual leak here: loading Google
Fonts sends every visitor's IP address to Google. This site uses the system
font stack instead, so it downloads no fonts at all — faster *and* private,
which is the rare case where those agree.

**No JavaScript.** Not minimal JavaScript, none. It removes an entire class
of vulnerability, makes the Content-Security-Policy trivially strict, and
means the page works identically everywhere.

## Security headers

Set in `_headers`, applied by Cloudflare Pages.

| Header | Why |
|---|---|
| `Content-Security-Policy: default-src 'none'` | Deny by default, then allow only same-origin CSS and images. With no JavaScript, no `script-src` exception is needed at all. |
| `Strict-Transport-Security` | Belt-and-braces: the entire `.dev` TLD is already HSTS-preloaded, so plaintext HTTP is impossible, but the header is still correct to send. |
| `X-Content-Type-Options: nosniff` | Stops browsers guessing content types and executing something unintended. |
| `Referrer-Policy: no-referrer` | Outbound links carry no information about where the visitor came from. |
| `Permissions-Policy` | Explicitly denies camera, microphone, geolocation and the rest. The page needs none of them, so none should be available. |
| `X-Frame-Options` / `frame-ancestors` | Cannot be embedded in a frame, which rules out clickjacking. |

## CI

Every push runs four checks:

1. **HTML validation** — catches malformed markup and missing accessibility attributes.
2. **Link checking** — a dead link on a personal site is a cheap bad impression.
3. **No third-party references** — fails the build if any external URL appears in HTML or CSS. This is what keeps the privacy claim honest over time.
4. **No JavaScript** — asserts the design decision rather than trusting discipline.

Checks 3 and 4 exist because *intentions decay*. A future me, or an AI
assistant helping a future me, will eventually paste in a font link or an
analytics snippet. The build should refuse it.

## Accessibility

Semantic HTML, a visible keyboard focus indicator, colour contrast meeting
WCAG AA in both light and dark themes, and a theme that follows the system
preference rather than overriding it.

## Deployment

Cloudflare Pages, built from `main`. There is no build step — the files in
the repository root are the files that get served.

## Licence

Content © rassimok. Code samples MIT.
