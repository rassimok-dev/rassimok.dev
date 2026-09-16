# Conventions for this repository

## What this is
A static personal site served by Cloudflare Pages. No build step: the repo
root is the document root.

## Hard rules — CI enforces these, do not work around them
- **No JavaScript.** The site ships zero JS. Do not add a script tag.
- **No third-party requests.** No CDN links, no Google Fonts, no analytics,
  no external images. Everything is same-origin. Use the system font stack.
- **No cookies, no storage, no tracking.** The site collects nothing.
- Keep the Content-Security-Policy in `_headers` as strict as it is. If a
  change appears to require loosening it, the change is wrong.

## Style
- Semantic HTML. Accessibility is not optional: keyboard focus must stay
  visible and contrast must meet WCAG AA in both themes.
- CSS lives in `style.css`. No inline styles — they would force
  `unsafe-inline` into the CSP.
- Keep it small. This page should stay under a few kilobytes.

## Commits
Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`). Commits are
SSH-signed.

## Before proposing changes
Run the checks in `.github/workflows/ci.yml` locally. If a change fails
them, fix the change rather than the check.
