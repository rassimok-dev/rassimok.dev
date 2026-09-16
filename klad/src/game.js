/* The state machine around a World: title | play | dying | clear | gameover.
   world.js knows one level and nothing else -- it cannot restart itself,
   advance to the next one, or end a run -- so everything that outlives a
   single World lives here: the level cursor, the score and the life ledger.

   DOM-free and canvas-free on purpose, like the simulation modules: the shell
   passes in an Intent and a list of edge actions, and gets plain fields back.
   Nothing here knows whether those came from a keyboard or a d-pad. */

import { START_LIVES } from './tuning.js';
import { parseLevel } from './level.js';
import { createWorld, step } from './world.js';
import { LEVELS } from './levels.js';

/* Presentation-only holds: how long the death and level-clear beats sit on
   screen before the machine moves on. They are not simulation constants --
   nothing in world.js reads them -- so they stay out of tuning.js until there
   is a reason to dial them alongside the rest. */
const DEATH_HOLD_MS = 900;
const CLEAR_HOLD_MS = 1300;

export function createGame(options = {}) {
  const sources = options.levels || LEVELS;

  const game = {
    phase: 'title',
    paused: false,
    /* Why the run ended: 'dead' after the last life, 'complete' after the last
       level. The contract's machine has one terminal state, not two. */
    outcome: null,
    /* A level that fails validation is an authoring bug, not a crash: the
       message is surfaced instead of the game. */
    error: null,

    levelIndex: 0,
    levelCount: 0,
    score: 0,
    lives: 0,
    world: null,

    update,
    startRun,
    setPaused,
    togglePause,
  };

  let holdMs = 0;
  let levels = [];

  /* levels.js ships {name, source} so parse errors can say "Cistern: unknown
     tile" instead of "level 7". A bare string is still accepted because a test
     that hands in one screen should not have to wrap it, and the number is
     then the only name available. */
  function nameOf(entry, index) {
    return typeof entry === 'string' ? `level ${index + 1}` : entry.name;
  }
  function sourceOf(entry) {
    return typeof entry === 'string' ? entry : entry.source;
  }

  /* Parsed up front rather than per level: a malformed level is worth knowing
     about on load, not three levels into a run. */
  try {
    levels = sources.map((entry, index) => parseLevel(sourceOf(entry), nameOf(entry, index)));
  } catch (err) {
    game.error = err && err.message ? err.message : String(err);
  }

  game.levelCount = levels.length;
  if (!game.error && game.levelCount === 0) game.error = 'No levels to play.';

  game.score = 0;
  game.lives = START_LIVES;
  if (!game.error) loadLevel(0);

  /* The title screen draws over a real, un-stepped World so the machine never
     has to hand the renderer a null. */
  function loadLevel(index) {
    game.levelIndex = index;
    game.world = createWorld(levels[index]);
    syncWorldLedger();
  }

  /* score and lives are seeded into the World so the in-canvas status band can
     read everything from one object. */
  function syncWorldLedger() {
    if (!game.world) return;
    game.world.score = game.score;
    game.world.lives = game.lives;
  }

  function startRun() {
    if (game.error) return;
    game.score = 0;
    game.lives = START_LIVES;
    game.outcome = null;
    game.paused = false;
    holdMs = 0;
    loadLevel(0);
    game.phase = 'play';
  }

  function setPaused(value) {
    const next = Boolean(value);
    /* Pause is a flag, not a state: the contract's machine has five states and
       'paused' is not one of them, and a pause must not lose the phase it
       interrupted. It only means anything while the world is live. */
    if (game.phase !== 'play' && game.phase !== 'dying') {
      game.paused = false;
      return;
    }
    game.paused = next;
  }

  function togglePause() {
    setPaused(!game.paused);
  }

  function update(dtMs, intent, edges) {
    if (game.error) return;

    if (edges && edges.length) {
      for (const action of edges) handleEdge(action);
    }
    if (game.paused) return;

    switch (game.phase) {
      case 'play':
        advancePlay(dtMs, intent);
        break;
      case 'dying':
        holdMs -= dtMs;
        if (holdMs <= 0) afterDeath();
        break;
      case 'clear':
        holdMs -= dtMs;
        if (holdMs <= 0) afterClear();
        break;
      default:
        /* title and gameover advance only on an edge. */
        break;
    }
  }

  function handleEdge(action) {
    if (action === 'pause') {
      togglePause();
      return;
    }
    if (action === 'restart') {
      startRun();
      return;
    }
    /* Shoot doubles as the confirm key so the legend stays four lines long and
       no key exists that is only ever pressed on a menu. */
    if (action === 'shoot' && (game.phase === 'title' || game.phase === 'gameover')) {
      startRun();
    }
  }

  function advancePlay(dtMs, intent) {
    const world = game.world;
    const events = step(world, dtMs, intent) || [];

    /* world.js owns scoring; the game only carries the total across levels. */
    game.score = world.score;

    /* The life ledger is computed here from the events rather than read back
       from world.lives, because a World is thrown away on death and cannot be
       the authority on a count that has to survive it. Reading events keeps
       this correct whether or not world.js also charges the death itself. */
    let died = false;
    for (const event of events) {
      if (event === 'life') game.lives += 1;
      else if (event === 'death') died = true;
    }

    if (died || world.status === 'dead') {
      game.lives -= 1;
      syncWorldLedger();
      holdMs = DEATH_HOLD_MS;
      game.phase = 'dying';
      return;
    }

    if (world.status === 'clear') {
      syncWorldLedger();
      holdMs = CLEAR_HOLD_MS;
      game.phase = 'clear';
      return;
    }

    syncWorldLedger();
  }

  function afterDeath() {
    if (game.lives <= 0) {
      game.outcome = 'dead';
      game.phase = 'gameover';
      return;
    }
    /* DEATH_RESTARTS_LEVEL is true in the contract, and the alternative --
       respawning in place -- would need an entry point world.js does not
       expose. If that value is ever dialled to false, this is the branch that
       has to grow a second arm. */
    loadLevel(game.levelIndex);
    game.phase = 'play';
  }

  function afterClear() {
    const next = game.levelIndex + 1;
    if (next >= levels.length) {
      game.outcome = 'complete';
      game.phase = 'gameover';
      return;
    }
    loadLevel(next);
    game.phase = 'play';
  }

  return game;
}
