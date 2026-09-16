# Changelog

Dated entries, newest first. Written for a reader picking this up cold —
or a future session needing to know what already exists and why.

## 2026-09-16 — Site created

**Repo:** `rassimok-dev/rassimok.dev` (private for now) · **Host:** Cloudflare Pages (pending)

- Static personal site. No build step: the repo root is the document root.
- **Zero JavaScript, zero third-party requests.** System font stack rather
  than a font CDN, which would leak every visitor's IP to Google.
- `Content-Security-Policy: default-src 'none'` — with no JavaScript, no
  `script-src` exception is needed at all.
- **CI enforces the privacy claims** rather than trusting discipline: the
  build fails on any external reference or added `<script>`. Intentions
  decay; build failures do not.
- Mesh-node identity mark as `avatar.svg`/`avatar.png` and `favicon.svg`.
  Two separate drawings, not one scaled asset — the detailed mesh is
  illegible at 16 px, so the favicon is a heavier five-peer reduction.
  Avatar is composed inside the inscribed circle because GitHub crops to one.

### Decisions worth not relitigating

- **The w3.org exclusion in the third-party guard is deliberate.**
  `xmlns="http://www.w3.org/2000/svg"` is an XML namespace identifier, never
  fetched. Excluding it keeps the check honest instead of teaching us to
  ignore a failing check.
- **Domain registered 2026-09-16** via Cloudflare Registrar, expires
  2027-09-16. Nameservers already Cloudflare's.
- **GitHub account renamed** `hellorassimok` → `rassimok-dev` while it had
  zero public repos, so no URLs broke. Renaming later would have.
