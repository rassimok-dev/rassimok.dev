# /klad/ — the game

A clean-room homage to «Клад» (Korvet ПК-8020), itself a clone of Rise Out
(ASCII, MSX, 1983). Own code, own art, own levels. Rules: `MECHANICS.md`.

This folder is the **only** place on the site with JavaScript. It is
self-contained on purpose so it can be removed in one go.

## Files
| | |
|---|---|
| `index.html` | page: HUD, canvas, touch pad, footer |
| `klad.css` | styles; defines the palette the game reads |
| `klad.js` | engine: movement, guards (BFS chase), shots, holes, phases, render, input |
| `levels.js` | five levels, each in two shapes (landscape 24×16, portrait 16×24) |
| `test/levels.test.js` | `node --test`: shape, legend, key-then-exit reachability |
| `MECHANICS.md` | the original rules as reconstructed from sources |

No build step, no dependencies, no storage. Level resume is the URL hash
(`/klad/#3`).

## To remove the game entirely
1. `git rm -r klad/`
2. Delete the `/klad/*` block in `_headers`.
3. In `.github/workflows/ci.yml`: drop `klad/index.html` from html-validate,
   the `--exclude-dir=klad` and the klad script check in "No JavaScript", the
   `*.js` third-party grep, and the "Level sanity" step.
4. Remove the `/klad/` links in `index.html` and the exception in `CLAUDE.md`
   and `README.md`.
