/* Fixed-timestep accumulator. The simulation must advance in identical slices
   regardless of display rate: a 144 Hz monitor and a 60 Hz one have to produce
   the same fall distance, and step() is only ever reasoned about -- and
   tested -- at one dt. Rendering stays once per animation frame, because
   drawing more often than the compositor composites is wasted work. */

import { TICK_HZ } from './tuning.js';

/* A backgrounded tab gets no animation frames, so the first frame after it
   comes back reports a delta measured in seconds or minutes. Without this
   clamp the accumulator would ask for thousands of ticks in one frame, which
   costs more than a frame, which grows the next delta -- the spiral that locks
   the tab up. Dropping the missed time instead is the honest trade: the game
   was not visible, so nothing was missed that anyone saw. */
const MAX_FRAME_MS = 250;

export function createLoop({ update, render, hz = TICK_HZ }) {
  const stepMs = 1000 / hz;

  let rafId = 0;
  let last = 0;
  let accumulator = 0;
  let running = false;

  function frame(now) {
    rafId = requestAnimationFrame(frame);

    let elapsed = now - last;
    last = now;
    if (elapsed > MAX_FRAME_MS) elapsed = MAX_FRAME_MS;
    if (elapsed < 0) elapsed = 0;

    accumulator += elapsed;
    while (accumulator >= stepMs) {
      accumulator -= stepMs;
      update(stepMs);
    }

    /* Fraction of a tick already accumulated, for the renderer to interpolate
       with if it wants to; ignoring it simply renders on tick boundaries. */
    render(accumulator / stepMs, now);
  }

  function start() {
    if (running) return;
    running = true;
    /* Reset rather than continue: the gap since stop() is not game time. */
    last = performance.now();
    accumulator = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
  }

  return {
    start,
    stop,
    get running() {
      return running;
    },
    stepMs,
  };
}
