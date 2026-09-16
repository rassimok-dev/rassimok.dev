/* Every number the simulation reads lives here.
 *
 * The split below is not decoration. The geometry block is CONFIRMED against
 * the original and is structural -- changing it changes what a level means.
 * The tuning block is a set of considered guesses pending a session with an
 * emulator, which is exactly why the logic modules must never hard-code one:
 * dialling the game in has to be an edit to this file alone. */

/* --- Screen geometry: confirmed, structural --- */

export const TILE = 16;
export const FIELD_W = 32;
export const FIELD_H = 15;
export const STATUS_H = 16;
export const CANVAS_W = FIELD_W * TILE;
export const CANVAS_H = STATUS_H + FIELD_H * TILE;

/* --- Feel: unconfirmed, tunable --- */

export const TICK_HZ = 60;
export const PLAYER_SPEED = 6.0;
export const CLIMB_SPEED = 5.0;
export const FALL_SPEED = 10.0;
export const GUARD_SPEED = 4.0;
export const SHOT_SPEED = 24.0;
export const SHOT_COOLDOWN_MS = 300;
export const BRICK_RESPAWN_MS = 6000;
export const START_LIVES = 3;
export const SCORE_CHEST = 100;
export const DEATH_RESTARTS_LEVEL = true;

/* --- Movement model --- */

/* Float-comparison slack. Positions are floats in tile units, so "is this
 * entity on a grid line" can never be an equality test. */
export const EPS = 1e-6;

/* The same slack in milliseconds, for timers. Counting a cooldown down by
 * 1000/60 repeatedly leaves a few times 1e-15 behind, and a cooldown of
 * 7e-15 ms is "ready" to a player and "not ready" to a comparison -- without
 * this the gun silently skips a beat every few shots. */
export const EPS_MS = 1e-6;

/* Cornering tolerance, in tiles. A turn onto the other axis is only legal
 * once the entity is within this of a grid line; closer than that it is
 * snapped, further away it glides to the line first rather than refusing the
 * input. Without the glide an entity that stopped mid-tile below a ladder
 * could never climb it -- a soft-lock, since there is no jump to escape with. */
export const ALIGN_EPS = 0.25;

/* Overlap, in tiles, before player and guardian count as touching. Boxes are
 * 1x1, so a value of 1.0 would kill on a hairline edge contact between two
 * entities standing in adjacent tiles. */
export const CONTACT_DIST = 0.6;

/* Steering while falling. Off is the Lode Runner-shaped behaviour: a fall is
 * committed to. Flagged as a guess -- it is the one movement rule most likely
 * to be wrong about the original. */
export const AIR_CONTROL = false;

/* How far off, in tiles, a guardian must be before it bothers closing a gap.
 * Below this it is already level with the player and jitter is worse than
 * standing still. */
export const GUARD_CHASE_EPS = 0.25;
