/* Boot and wiring. The only file that touches the DOM at startup, and the only
   one that knows a browser exists at all: input.js owns the keyboard, loop.js
   owns the clock, game.js owns the rules, render.js owns the pixels, and this
   file introduces them to each other. */

import { CANVAS_W, CANVAS_H } from './tuning.js';
import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { createGame } from './game.js';
import { render, preload } from './render.js';

/* Leave room below the screen for the status line and the controls legend, so
   the canvas cannot grow tall enough to push everything readable off-screen. */
const VIEWPORT_HEIGHT_SHARE = 0.68;

/* Room left below the canvas for the accessible status line and a little
 * breathing space, in CSS px. Subtracted from the real measurement rather
 * than guessed at as a share of the viewport. */
const HUD_RESERVE_PX = 96;

const canvas = document.getElementById('screen');
const hud = document.getElementById('hud');

const ctx = canvas.getContext('2d', { alpha: false });

/* The backing store is the contract's geometry; the element's width/height
   attributes in the markup only exist to avoid a reflow before this runs. */
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
/* Pixel art: every upscale must be a nearest-neighbour block, never a blur.
   The CSS image-rendering rule covers the element; this covers anything the
   renderer scales inside the context. */
ctx.imageSmoothingEnabled = false;

const input = createInput();
const game = createGame();

/* Read once and kept current: passed to the renderer every frame so flashes
   and shake can be suppressed at the point they would be drawn, rather than
   the game having a separate reduced-motion mode. */
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionQuery.matches;
motionQuery.addEventListener('change', (event) => {
  reducedMotion = event.matches;
});

/* One object reused for the life of the page: it is handed to render() sixty
   times a second and allocating it each time would be pure garbage. */
const ui = {
  phase: game.phase,
  paused: false,
  outcome: null,
  levelNumber: 1,
  levelCount: game.levelCount,
  score: 0,
  lives: 0,
  reducedMotion,
  alpha: 0,
  /* `now` rather than `timeMs`: render.js names the clock it animates from
     `now`, and it falls back to performance.now() when the field is missing --
     so a mismatch here would not fail, it would quietly animate off a second
     clock and only show up as a stutter after a pause. */
  now: 0,
};

/* CSS pixels per texel, always a whole number: a fractional scale puts texel
   edges inside device pixels and the sprite grid visibly wobbles. */
function fitCanvas() {
  /* The content box, not clientWidth: clientWidth includes the screen's
     padding, and overstating the room by that much is enough to pick a scale
     whose canvas the stylesheet then has to clamp -- which is exactly the
     fractional scale this function exists to avoid. */
  const frame = canvas.parentElement;
  const frameStyle = window.getComputedStyle(frame);
  const availableWidth = frame.clientWidth
    - parseFloat(frameStyle.paddingLeft)
    - parseFloat(frameStyle.paddingRight);
  /* Measure from where the canvas actually sits down to the bottom of the
     viewport, rather than assuming a flat share of it. A flat 68% cost every
     768p laptop a whole scale step: innerHeight ~648 gives 440, which floors
     to scale 1, even though the canvas top sits ~107px down and 107 + 512
     fits above the fold. Nothing above the canvas depends on the canvas's
     size, so reading its top here does not feed back into the next layout.
     The share stays as the fallback for the first call, before layout. */
  const top = canvas.getBoundingClientRect().top;
  const availableHeight = (top > 0
    ? window.innerHeight - top
    : window.innerHeight * VIEWPORT_HEIGHT_SHARE) - HUD_RESERVE_PX;

  const scale = Math.max(
    1,
    Math.min(
      Math.floor(availableWidth / CANVAS_W),
      Math.floor(availableHeight / CANVAS_H),
    ),
  );

  /* Set through the CSSOM rather than a style attribute in the markup: CSP has
     no unsafe-inline, and this is a computed value that cannot live in the
     stylesheet anyway. Below scale 1 the stylesheet's max-width takes over and
     the screen shrinks rather than overflowing.
     Only the width is set: the stylesheet leaves the height auto, so the canvas
     keeps its intrinsic 2:1 ratio even in the sub-scale-1 case where max-width
     clamps it. */
  canvas.style.width = `${CANVAS_W * scale}px`;
}

function describeState() {
  if (game.error) return `Level data rejected: ${game.error}`;

  const world = game.world;
  const chests = world ? world.chestsLeft : 0;
  /* Keys are reported on exactly the condition the canvas band reports them
     (render.js draws KEYS only above zero), because on the two levels with
     doors the count is the difference between a passable door and a dead end
     -- and this line, not the canvas, is the accessible surface. It changes
     only on pickup and on spend, so it adds no chatter to the live region
     during ordinary movement. */
  const keys = world && world.keys > 0 ? ` Keys ${world.keys}.` : '';
  const tail = `Level ${game.levelIndex + 1} of ${game.levelCount}. `
    + `Score ${game.score}. Lives ${Math.max(0, game.lives)}. `
    + `${chests === 0 ? 'All chests collected, exit open.' : `${chests} chests left.`}`
    + keys;

  if (game.phase === 'title') return `Ready. Press Space or Z to start. ${tail}`;
  if (game.paused) return `Paused. Press P to resume. ${tail}`;
  if (game.phase === 'dying') return `Caught. ${tail}`;
  if (game.phase === 'clear') return `Level clear. ${tail}`;
  if (game.phase === 'gameover') {
    const how = game.outcome === 'complete'
      ? 'All levels cleared.'
      : 'Game over.';
    return `${how} Final score ${game.score}. Press Space or Z to play again.`;
  }
  return tail;
}

/* aria-live re-announces on every text change, so the string is only written
   when it actually differs -- otherwise a screen reader would be read a new
   sentence sixty times a second. */
let hudText = '';
function updateHud() {
  const text = describeState();
  if (text === hudText) return;
  hudText = text;
  hud.textContent = text;
}

const loop = createLoop({
  update(dtMs) {
    game.update(dtMs, input.readIntent(), input.drainEdges());
  },
  render(alpha, timeMs) {
    ui.phase = game.phase;
    ui.paused = game.paused;
    ui.outcome = game.outcome;
    ui.levelNumber = game.levelIndex + 1;
    ui.levelCount = game.levelCount;
    ui.score = game.score;
    ui.lives = game.lives;
    ui.reducedMotion = reducedMotion;
    ui.alpha = alpha;
    ui.now = timeMs;

    if (game.world) render(ctx, game.world, ui);
    updateHud();
  },
});

function boot() {
  if (game.error) {
    hud.classList.add('fault');
    updateHud();
    return;
  }

  /* Bake the sprite atlas before the first frame rather than inside it: the
     bake is thousands of one-pixel fillRects, and paying for it during boot is
     invisible where paying for it in frame one is a visible hitch. */
  preload();

  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  /* The keyboard is bound to the canvas, not the window, so that the focus
     ring really does show where the keys are going. Bound to the window the
     game swallowed the arrows and Space across the whole page -- a reader who
     had tabbed on to the legend or the back link could not scroll with them,
     and every press drove a game they were not looking at. The legend below
     says to click or tab to the screen first, and now that is the truth. */
  input.attachKeyboard(canvas);

  /* Safari does not focus a canvas on click even with tabindex, so the focus
     ring would never appear for a mouse user. */
  canvas.addEventListener('pointerdown', () => canvas.focus());

  /* Losing the keyboard means losing control, and a guardian walking into a
     player who cannot move is not a fair death. input.releaseAll() already
     drops held keys; this stops the clock as well.

     Both blurs matter and they are not the same event. The window's covers
     alt-tab and switching tabs. The canvas's covers tabbing from the screen to
     the legend or the back link, which leaves the window focused and used to
     leave the simulation running while the focus ring said otherwise. */
  window.addEventListener('blur', () => game.setPaused(true));
  canvas.addEventListener('blur', () => game.setPaused(true));

  loop.start();
}

boot();
