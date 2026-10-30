# Conventions for this repository

## What this is
A static personal site served by Cloudflare Pages. No build step: the repo
root is the document root.

## Hard rules — CI enforces these, do not work around them
- **No JavaScript on the apex.** The home page ships zero JS. Do not add a
  script tag to it. The single exception is the game under `klad/`: its own
  same-origin scripts only, no dependencies, no build step, no storage. It is
  self-contained so it can be deleted in one go (see `klad/README.md`).
- **No third-party requests.** No CDN links, no Google Fonts, no analytics,
  no external images. Everything is same-origin. Use the system font stack.
- **No cookies, no storage, no tracking.** The site collects nothing.
- Keep the Content-Security-Policy in `_headers` as strict as it is. If a
  change appears to require loosening it, the change is wrong. The `/klad/*`
  block adds `script-src 'self'` for the game and nothing else.

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

## Changelog
Record every meaningful change in `CHANGELOG.md` — dated entry, newest first.
Include the *reasoning*, especially for decisions that look arbitrary later.
The point is that a future session can recap what exists without re-deriving
it, and does not undo a deliberate choice by mistake.
