# Security policy

## Reporting a vulnerability

Please report privately through GitHub:
**Security → Report a vulnerability** on this repository
(<https://github.com/rassimok-dev/rassimok.dev/security/advisories/new>).
Do not open a public issue for anything exploitable.

You will get an acknowledgement within a week. This is a one-person
project, so there is no bounty, but credit is given in the fix's changelog
entry if you want it.

## Scope

- `rassimok.dev` and `www.rassimok.dev`: the static site in this repository,
  including the game under `/klad/`.
- Its response headers (`_headers`) and CI (`.github/workflows/`).

The API at `api.rassimok.dev` has its own policy in
`rassimok-dev/api.rassimok.dev`.

## What this site promises, and how it is enforced

- No JavaScript on the apex, no third-party requests, no cookies or storage.
  CI fails the build if any of these regress.
- A deny-by-default Content-Security-Policy. CI fails if it gains
  `unsafe-inline`, `unsafe-eval`, a wildcard or a plain `http:` source.
- Machine-readable contact: `/.well-known/security.txt` (RFC 9116). CI fails
  30 days before its `Expires` date so it cannot silently lapse.
