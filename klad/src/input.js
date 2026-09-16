/* Keyboard is a SOURCE of input, not the input model.
   The model is the action set below plus press/release; the keyboard handler
   is one adapter onto it, and a planned on-screen d-pad will be another. That
   is why nothing in here reaches into the game and why the game never sees a
   KeyboardEvent: a touch layer can be added by calling press()/release() from
   pointer events, with game.js, world.js and the loop untouched. */

/* Actions that are HELD: their state feeds the Intent the simulation reads. */
const HELD_ACTIONS = ['left', 'right', 'up', 'down', 'shoot'];

/* Actions that only ever matter as an edge -- the shell reacts to the press,
   never to the fact that the key is still down. */
const EDGE_ACTIONS = ['pause', 'restart'];

export const ACTIONS = [...HELD_ACTIONS, ...EDGE_ACTIONS];

const KNOWN = new Set(ACTIONS);

/* Keyed by KeyboardEvent.code, i.e. physical position, not the character the
   layout produces. On a Cyrillic layout event.key for the WASD keys is
   "ц/ф/ы/в" and the mapping would simply fall apart; code keeps the same
   physical keys working under every layout the author is likely to use. */
const KEY_ACTIONS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
  Space: 'shoot',
  KeyZ: 'shoot',
  KeyP: 'pause',
  KeyR: 'restart',
};

/* Returned instead of a fresh [] on the common frame where nothing was
   pressed, so polling every tick does not produce garbage. */
const NO_EDGES = Object.freeze([]);

/* A stuck edge queue would mean a pause or restart arriving minutes late; it
   can only grow if the consumer stopped draining, in which case the oldest
   presses are the ones worth dropping. */
const MAX_QUEUED_EDGES = 16;

export function createInput() {
  const held = new Set();
  let edges = [];

  /* Physical keys currently down, by event.code. Two keys are bound to every
     movement action (ArrowLeft and KeyA, Space and KeyZ), so a keyup must not
     clear the action while the other key is still held: a player switching
     hands between the two advertised schemes would otherwise stop dead
     mid-run. The action is held for as long as ANY key bound to it is.

     This lives in the keyboard adapter rather than in the action model on
     purpose. Only a keyboard has two buttons for one action; the planned
     d-pad has exactly one, and press()/release() stay idempotent for it. */
  const downCodes = new Set();

  /* One object, mutated in place and handed to step() every tick: the Intent
     shape from the contract, allocated once. */
  const intent = {
    left: false,
    right: false,
    up: false,
    down: false,
    shoot: false,
  };

  function press(action) {
    if (!KNOWN.has(action)) return;
    /* An already-held action must not re-emit an edge: key auto-repeat and a
       finger resting on a future d-pad button both arrive as repeated
       presses, and neither should count as a second tap of P or R. */
    if (held.has(action)) return;
    held.add(action);
    if (edges.length >= MAX_QUEUED_EDGES) edges.shift();
    edges.push(action);
  }

  function release(action) {
    held.delete(action);
  }

  /* Anything that takes the keyboard away -- alt-tab, a tab switch, the page
     being hidden -- would otherwise leave the last direction held forever and
     the player walking into the water on return. The keyups for those keys
     will never arrive, so the physical set has to be dropped with them. */
  function releaseAll() {
    held.clear();
    downCodes.clear();
  }

  /* Is some OTHER key still holding this action down? */
  function heldByAnotherKey(action) {
    for (const code of downCodes) {
      if (KEY_ACTIONS[code] === action) return true;
    }
    return false;
  }

  function isHeld(action) {
    return held.has(action);
  }

  function readIntent() {
    intent.left = held.has('left');
    intent.right = held.has('right');
    intent.up = held.has('up');
    intent.down = held.has('down');
    intent.shoot = held.has('shoot');
    return intent;
  }

  function drainEdges() {
    if (edges.length === 0) return NO_EDGES;
    const taken = edges;
    edges = [];
    return taken;
  }

  function onKeyDown(event) {
    /* Never swallow a browser or OS shortcut: ctrl+R must still reload and
       cmd+arrow must still do what the platform says, even though R and the
       arrows are game keys. */
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const action = KEY_ACTIONS[event.code];
    if (!action) return;

    /* preventDefault is scoped to keys the game actually consumes, so Tab,
       the browser's find bar and everything else on the page keep working.
       Space in particular would otherwise scroll the page under the canvas.
       It is also scoped to the listener's target: bound to the canvas, this
       only ever runs while the canvas has the keyboard, so a reader who has
       tabbed on to the legend below still scrolls the page with the arrows
       instead of silently driving a game they are not looking at. */
    event.preventDefault();
    if (event.repeat) return;
    downCodes.add(event.code);
    press(action);
  }

  function onKeyUp(event) {
    /* Deliberately not filtered by modifiers: if a modifier goes down while a
       direction is held, the keyup still has to land or the key stays stuck. */
    const action = KEY_ACTIONS[event.code];
    if (!action) return;
    event.preventDefault();
    downCodes.delete(event.code);
    if (heldByAnotherKey(action)) return;
    release(action);
  }

  function onLostFocus() {
    releaseAll();
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') releaseAll();
  }

  /* The only DOM-aware part of this module, and it is optional: a headless
     test, or a future touch build, can drive press()/release() directly.

     The target is what decides WHERE the game eats keys: main.js passes the
     canvas, so the keys and the focus ring agree. A window target would work
     but would consume the arrows and Space for the whole document. */
  function attachKeyboard(target = window) {
    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    target.addEventListener('blur', onLostFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return function detachKeyboard() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onLostFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      releaseAll();
    };
  }

  return {
    press,
    release,
    releaseAll,
    isHeld,
    readIntent,
    drainEdges,
    attachKeyboard,
  };
}
