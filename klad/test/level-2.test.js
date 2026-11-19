'use strict';
/* Level 2 played through in both shapes with the guards active, on the real
   page scripts (test/play.js). The key lies in a vault low in the castle that
   is open only to the guards' shaft. Outside, one brick separates it from a
   balcony that the runner reaches by a drop from the right tower. The guards
   climb the shaft to the runner's row. Drawn up to the top of the shaft
   first, they need longer to climb back down to the vault than the drop
   takes, so a runner who shoots the vault open at once is out with the key
   before they arrive; a runner who pauses meets them there. In landscape the
   way up to the right tower takes as long as the guards' climb; the portrait
   shaft is taller, so there the runner waits for them at the tower ladder.
   The second way in, shorter in landscape, is a tunnel shot through the
   pockets on the castle's left onto the shaft, and the guards climb at the
   runner there too: going on to the key at once wins, a pause is caught. A
   runner who steps back off the shaft at once leaves them stranded on a
   ledge beside the inner ladder, and the vault is free; that stays, as the
   reward for winning that race. The guards' room is walled with stone on the
   start row, so a shot from the start cannot let them out for free. Stone
   also closes the foot of the shaft on the vault's side: a runner at the
   foot of the balcony ladder draws the guards only down the shaft, and they
   climb straight back when the runner goes up again. A stone under the vault
   wall stops a shot from the middle of the balcony ladder short of the vault
   floor, so the guards waiting at the wall cannot be walled up from outside.
   In landscape, stone beside the top of the shaft and beside the shaft on
   the row of the life chest stops shots along those rows from the left, so
   the guards cannot be walled up there and the runner cannot cross the
   castle ahead of them. The pockets on the way back from the tower ladder,
   beside the gap (landscape) and the landing (portrait), end in stone, so a
   runner cannot return to the left side behind the guards. Counts are
   tiles. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { playLevel } = require('./play.js');

const RIGHT = 'ArrowRight';
const LEFT = 'ArrowLeft';
const UP = 'ArrowUp';
const DOWN = 'ArrowDown';
/* Waiting at the foot of the tower ladder until both guards stand at the top
   of the shaft: they get there about 1.6 s (landscape) and 4.2 s (portrait)
   after the runner reaches it. */
const GUARDS_UP_SECONDS = { landscape: 2, portrait: 5 };
/* After the drop the guards stand at the inside of the vault wall after
   about 1.6 s (landscape) and 1.4 s (portrait), and reach a runner waiting
   in the open vault after about 1.1 s and 0.9 s. The death screen then
   stays 1.4 s. */
const PAUSE_AT_THE_WALL_SECONDS = 2.5;
const AFTER_THE_SHOT_SECONDS = 0.6;
const WAIT_IN_THE_VAULT_SECONDS = 1.8;
const DEATH_SECONDS = 1.6;
/* In portrait a pause at the wall of up to 0.4 s is survived without the
   wait at the tower ladder, and of up to 1 s after it. */
const SHORT_PAUSE_SECONDS = 0.7;
/* Were the guards' room walled with brick on the start row, a shot from the
   start and a wait at the left ladder of 0.9 to 1.5 s would leave them
   stranded on a ledge outside the castle, with the vault free for any pause. */
const WAIT_AFTER_THE_START_SHOT_SECONDS = 1.2;
const LONG_PAUSE_AT_THE_WALL_SECONDS = 5;
/* The guards reach a runner standing on the shaft after about 0.6 s
   (landscape) and 0.9 s (portrait). */
const PAUSE_ON_THE_SHAFT_SECONDS = 1.4;
/* Were the shaft's foot open toward the room under the vault, a wait of
   0.6 s (landscape) or 1 to 2 s (portrait) at the foot of the balcony ladder
   would leave the guards there, off a ladder, once the runner climbs back. */
const WAIT_AT_THE_LADDER_FOOT_SECONDS = 3;
/* With brick at the shaft's foot, a second shot through the first hole 2.4
   to 4 s (landscape) or 3.4 to 3.6 s (portrait) later, then a wait at the
   ladder foot, would open it and strand the guards below the vault. */
const SECOND_SHOT_SECONDS = 3.6;
/* Were the brick under the vault wall open to a shot from the middle of the
   balcony ladder, two shots from there after a wait on the balcony of 2 s or
   more would wall up the guards waiting at the wall, with the vault free for
   any pause. */
const WAIT_ON_THE_BALCONY_SECONDS = 3;
const AFTER_A_SHOT_FROM_THE_LADDER_SECONDS = 0.5;
/* Were the brick beside the top of the shaft open, three shots from the inner
   ladder along its row 0.4 to 3.4 s apart, and a climb at once, would let the
   guards climbing up step into its hole as it closes and be walled up. */
const AFTER_A_SHOT_ALONG_THE_ROW_SECONDS = 1;
/* Were the pockets beside the tower ladder brick on their far side, a runner
   back on the left side could shoot open a row from a ledge there and draw
   the guards off the shaft, to be walled up or stranded, with the vault free. */
const BETWEEN_SHOTS_FROM_THE_LEDGE_SECONDS = { landscape: 0.5, portrait: 0.4 };
/* Were the brick beside the shaft on the row of the life chest open, eight
   shots 0.4 s apart would open that row through the castle to the notch on
   its right, and the runner would cross the shaft ahead of the guards. */
const SHOTS_ALONG_THE_ROW = 8;
const BETWEEN_SHOTS_ALONG_THE_ROW_SECONDS = 0.4;

/* From the start to the foot of the left edge ladder. */
const TO_THE_LEFT_LADDER = {
  landscape(play) {
    play.walk(LEFT, 2);
  },
  portrait(play) {
    play.walk(LEFT, 1);
  },
};

/* Up the left ladder, along the top plank and down into the gap between the
   towers, to the foot of the ladder there. */
const UP_TO_THE_TOWER_LADDER = {
  landscape(play) {
    play.climb(UP, 14);
    play.walk(RIGHT, 12);
    play.run(0.5);
    play.walk(RIGHT, 3);
  },
  portrait(play) {
    play.climb(UP, 26);
    play.walk(RIGHT, 8);
    play.run(0.9);
    play.walk(RIGHT, 1);
  },
};

function toTheTowerLadder(play, shape) {
  TO_THE_LEFT_LADDER[shape](play);
  UP_TO_THE_TOWER_LADDER[shape](play);
}

/* Up the tower ladder, over the right tower and down onto the balcony. */
const DOWN_TO_THE_BALCONY = {
  landscape(play) {
    play.climb(UP, 4);
    play.walk(RIGHT, 4);
    play.run(1.4);
  },
  portrait(play) {
    play.climb(UP, 3);
    play.walk(RIGHT, 3);
    play.run(2.3);
  },
};

/* Back to the balcony, down its ladder, through the door and up the exit. */
const TO_THE_EXIT = {
  landscape(play) {
    play.walk(RIGHT, 2);
    play.climb(DOWN, 2);
    play.walk(RIGHT, 8);
    play.climb(UP, 14);
  },
  portrait(play) {
    play.walk(RIGHT, 2);
    play.climb(DOWN, 2);
    play.walk(RIGHT, 5);
    play.climb(UP, 26);
  },
};

/* From the start up the inner ladder to the pockets on the castle's left,
   then a shot at each pocket wall and on into the next, onto the shaft. */
const THROUGH_THE_POCKETS_ONTO_THE_SHAFT = {
  landscape(play) {
    play.walk(RIGHT, 5);
    play.climb(UP, 2);
    play.walk(RIGHT, 1);
    shootAndWalkOn(play, 2);
    shootAndWalkOn(play, 2);
  },
  portrait(play) {
    play.walk(RIGHT, 2);
    play.climb(UP, 3);
    play.walk(RIGHT, 1);
    shootAndWalkOn(play, 1);
    shootAndWalkOn(play, 2);
    shootAndWalkOn(play, 2);
  },
};

function shootAndWalkOn(play, tiles) {
  play.shoot();
  play.walk(RIGHT, tiles);
}

/* In landscape, off the shaft along the vault to the key, and a shot through
   the vault wall to the balcony. */
function fromTheShaftOutOfTheVault(play) {
  play.walk(RIGHT, 5);
  play.shoot();
}

/* A walk into the vault wall only turns the runner to face it for the shot. */
function faceTheVault(play) {
  play.walk(LEFT, 1);
}

/* At the foot or the middle of the balcony ladder the same walk faces the wall
   under the vault. */
function faceTheWallUnderTheVault(play) {
  play.walk(LEFT, 1);
}

function takeTheKey(play) {
  play.shoot();
  play.walk(LEFT, 2);
}

function shootAndWalkLeft(play, tiles) {
  play.shoot();
  play.walk(LEFT, tiles);
}

/* Below the tower ladder the same walk faces the wall of the pocket beside
   the gap (landscape) or the landing (portrait). */
function faceThePocket(play) {
  play.walk(LEFT, 1);
}

/* A shot at the pocket's far wall and on through it, down onto a ledge on
   the left side, were that wall brick; at the stone the runner stays put. */
const OUT_OF_THE_POCKET_TO_THE_LEDGE = {
  landscape(play) {
    shootAndWalkLeft(play, 2);
    play.run(0.5);
  },
  portrait(play) {
    shootAndWalkLeft(play, 2);
    play.run(0.8);
  },
};

/* In landscape, from the inner ladder on the row of the shaft top up to the
   top, along it and down into the gap between the towers, to the foot of the
   ladder there. */
function fromTheInnerLadderToTheTowerLadder(play) {
  play.climb(UP, 6);
  play.walk(RIGHT, 5);
  play.run(0.5);
  play.walk(RIGHT, 3);
}

/* In portrait, from the ledge on the left side (if the runner got there) up
   the long ladder beside it, along the top plank and down onto the landing,
   to the foot of the tower ladder. */
function fromTheLedgeToTheTowerLadder(play) {
  play.walk(LEFT, 1);
  play.climb(UP, 11);
  play.walk(RIGHT, 5);
  play.run(0.9);
  play.walk(RIGHT, 1);
}

for (const shape of ['landscape', 'portrait']) {
  test(`level 2 ${shape}: drawing the guards up the shaft, then shooting the key out of its vault at once clears the level at revision 2 with no life lost`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    toTheTowerLadder(play, shape);
    play.run(GUARDS_UP_SECONDS[shape]);
    DOWN_TO_THE_BALCONY[shape](play);
    faceTheVault(play);
    takeTheKey(play);
    TO_THE_EXIT[shape](play);

    // then
    assert.deepEqual(play.events, ['klad:clear']);
    const { level, revision, shape: clearedShape } = play.details[0];
    assert.deepEqual({ level, revision, shape: clearedShape }, { level: 2, revision: 2, shape });
    assert.equal(play.lives(), 3);
  });

  test(`level 2 ${shape}: a pause on the balcony before the shot lets the guards climb down into the vault, and the shot lets them out at the runner`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    toTheTowerLadder(play, shape);
    play.run(GUARDS_UP_SECONDS[shape]);
    DOWN_TO_THE_BALCONY[shape](play);
    faceTheVault(play);
    play.run(PAUSE_AT_THE_WALL_SECONDS);
    play.shoot();
    play.run(AFTER_THE_SHOT_SECONDS);
    const titleAfterTheShot = play.title();
    const isKeyHidden = play.elements['h-key'].hidden;
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterTheShot, 'ПОГИБ');
    assert.equal(isKeyHidden, true);
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 2 ${shape}: waiting in the open vault with the key lets the guards in from the shaft and costs a life`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    toTheTowerLadder(play, shape);
    play.run(GUARDS_UP_SECONDS[shape]);
    DOWN_TO_THE_BALCONY[shape](play);
    faceTheVault(play);
    takeTheKey(play);
    const isKeyHiddenInTheVault = play.elements['h-key'].hidden;
    play.run(WAIT_IN_THE_VAULT_SECONDS);
    const titleInTheVault = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(isKeyHiddenInTheVault, false);
    assert.equal(titleInTheVault, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 2 ${shape}: a shot from the start stops at the stone wall of the guards' room, so a long pause at the vault wall still lets them in and costs a life`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    play.shoot();
    TO_THE_LEFT_LADDER[shape](play);
    play.run(WAIT_AFTER_THE_START_SHOT_SECONDS);
    UP_TO_THE_TOWER_LADDER[shape](play);
    DOWN_TO_THE_BALCONY[shape](play);
    faceTheVault(play);
    play.run(LONG_PAUSE_AT_THE_WALL_SECONDS);
    play.shoot();
    play.run(AFTER_THE_SHOT_SECONDS);
    const titleAfterTheShot = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterTheShot, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 2 ${shape}: on the second way in, through the left pockets onto the shaft, a pause on the shaft lets the guards climb to the runner and costs a life`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    THROUGH_THE_POCKETS_ONTO_THE_SHAFT[shape](play);
    play.run(PAUSE_ON_THE_SHAFT_SECONDS);
    const titleOnTheShaft = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleOnTheShaft, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 2 ${shape}: a step down the balcony ladder and back up does not leave the guards below the vault, so a long pause at the wall still costs a life`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    toTheTowerLadder(play, shape);
    DOWN_TO_THE_BALCONY[shape](play);
    play.climb(DOWN, 2);
    play.run(WAIT_AT_THE_LADDER_FOOT_SECONDS);
    play.climb(UP, 2);
    faceTheVault(play);
    play.run(LONG_PAUSE_AT_THE_WALL_SECONDS);
    play.shoot();
    play.run(AFTER_THE_SHOT_SECONDS);
    const titleAfterTheShot = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterTheShot, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 2 ${shape}: two shots from the foot of the balcony ladder stop at the stone beside the shaft, so a long pause at the wall still costs a life`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    toTheTowerLadder(play, shape);
    DOWN_TO_THE_BALCONY[shape](play);
    play.climb(DOWN, 2);
    faceTheWallUnderTheVault(play);
    play.shoot();
    play.run(SECOND_SHOT_SECONDS);
    play.shoot();
    play.run(WAIT_AT_THE_LADDER_FOOT_SECONDS);
    play.climb(UP, 2);
    faceTheVault(play);
    play.run(LONG_PAUSE_AT_THE_WALL_SECONDS);
    play.shoot();
    play.run(AFTER_THE_SHOT_SECONDS);
    const titleAfterTheShot = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterTheShot, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });

  test(`level 2 ${shape}: two shots from the middle of the balcony ladder stop at the stone under the vault wall, so the guards waiting at the wall are not walled up and a long pause still costs a life`, () => {
    // given
    const play = playLevel(2, shape);

    // when
    toTheTowerLadder(play, shape);
    DOWN_TO_THE_BALCONY[shape](play);
    play.run(WAIT_ON_THE_BALCONY_SECONDS);
    play.climb(DOWN, 1);
    faceTheWallUnderTheVault(play);
    play.shoot();
    play.run(AFTER_A_SHOT_FROM_THE_LADDER_SECONDS);
    play.shoot();
    play.run(AFTER_A_SHOT_FROM_THE_LADDER_SECONDS);
    play.climb(UP, 1);
    faceTheVault(play);
    play.run(LONG_PAUSE_AT_THE_WALL_SECONDS);
    play.shoot();
    play.run(AFTER_THE_SHOT_SECONDS);
    const titleAfterTheShot = play.title();
    play.run(DEATH_SECONDS);

    // then
    assert.equal(titleAfterTheShot, 'ПОГИБ');
    assert.equal(play.lives(), 2);
    assert.deepEqual(play.events, []);
  });
}

test('level 2 landscape: the second way in, through the left pockets and along the shaft row into the vault, clears the level when the runner goes on at once', () => {
  // given
  const play = playLevel(2, 'landscape');

  // when
  THROUGH_THE_POCKETS_ONTO_THE_SHAFT.landscape(play);
  fromTheShaftOutOfTheVault(play);
  TO_THE_EXIT.landscape(play);

  // then
  assert.deepEqual(play.events, ['klad:clear']);
  assert.equal(play.lives(), 3);
});

test('level 2 portrait: without the wait for the guards at the tower ladder, a short pause at the vault wall lets them reach the vault first and costs a life', () => {
  // given
  const play = playLevel(2, 'portrait');

  // when
  toTheTowerLadder(play, 'portrait');
  DOWN_TO_THE_BALCONY.portrait(play);
  faceTheVault(play);
  play.run(SHORT_PAUSE_SECONDS);
  takeTheKey(play);
  const titleInTheVault = play.title();
  const isKeyHidden = play.elements['h-key'].hidden;
  play.run(DEATH_SECONDS);

  // then
  assert.equal(titleInTheVault, 'ПОГИБ');
  assert.equal(isKeyHidden, true);
  assert.equal(play.lives(), 2);
  assert.deepEqual(play.events, []);
});

test('level 2 portrait: after the wait for the guards at the tower ladder, the same short pause at the vault wall still clears the level', () => {
  // given
  const play = playLevel(2, 'portrait');

  // when
  toTheTowerLadder(play, 'portrait');
  play.run(GUARDS_UP_SECONDS.portrait);
  DOWN_TO_THE_BALCONY.portrait(play);
  faceTheVault(play);
  play.run(SHORT_PAUSE_SECONDS);
  takeTheKey(play);
  TO_THE_EXIT.portrait(play);

  // then
  assert.deepEqual(play.events, ['klad:clear']);
  assert.equal(play.lives(), 3);
});

test('level 2 landscape: three shots from the inner ladder along the row of the shaft top stop at the stone beside it, so the guards climbing up are not walled up and a long pause at the wall still costs a life', () => {
  // given
  const play = playLevel(2, 'landscape');

  // when
  play.walk(RIGHT, 5);
  play.climb(UP, 8);
  play.shoot();
  play.run(AFTER_A_SHOT_ALONG_THE_ROW_SECONDS);
  play.shoot();
  play.run(AFTER_A_SHOT_ALONG_THE_ROW_SECONDS);
  play.shoot();
  fromTheInnerLadderToTheTowerLadder(play);
  DOWN_TO_THE_BALCONY.landscape(play);
  faceTheVault(play);
  play.run(LONG_PAUSE_AT_THE_WALL_SECONDS);
  play.shoot();
  play.run(AFTER_THE_SHOT_SECONDS);
  const titleAfterTheShot = play.title();
  play.run(DEATH_SECONDS);

  // then
  assert.equal(titleAfterTheShot, 'ПОГИБ');
  assert.equal(play.lives(), 2);
  assert.deepEqual(play.events, []);
});

test('level 2 portrait: the pocket beside the landing below the tower ladder ends in stone, so a runner cannot get back to the left side behind the guards and draw them out along the row of the ledge into the chest pocket under it', () => {
  // given
  const play = playLevel(2, 'portrait');

  // when
  toTheTowerLadder(play, 'portrait');
  play.walk(LEFT, 1);
  faceThePocket(play);
  shootAndWalkLeft(play, 2);
  const chestsInThePocket = play.elements['h-chests'].textContent;
  OUT_OF_THE_POCKET_TO_THE_LEDGE.portrait(play);
  play.walk(RIGHT, 1);
  play.shoot();
  play.run(BETWEEN_SHOTS_FROM_THE_LEDGE_SECONDS.portrait);
  play.shoot();
  play.run(BETWEEN_SHOTS_FROM_THE_LEDGE_SECONDS.portrait);
  play.shoot();
  play.run(LONG_PAUSE_AT_THE_WALL_SECONDS);
  fromTheLedgeToTheTowerLadder(play);
  DOWN_TO_THE_BALCONY.portrait(play);
  faceTheVault(play);
  play.run(LONG_PAUSE_AT_THE_WALL_SECONDS);
  takeTheKey(play);
  TO_THE_EXIT.portrait(play);

  // then
  assert.equal(chestsInThePocket, '1/10');
  assert.deepEqual(play.events, []);
});

test('level 2 landscape: the pocket of the left tower ends in stone on its far side, so a runner cannot get back from the gap to the left side behind the guards and draw them out along the row of the shaft top', () => {
  // given
  const play = playLevel(2, 'landscape');

  // when
  toTheTowerLadder(play, 'landscape');
  play.walk(LEFT, 3);
  faceThePocket(play);
  shootAndWalkLeft(play, 2);
  const chestsInThePocket = play.elements['h-chests'].textContent;
  OUT_OF_THE_POCKET_TO_THE_LEDGE.landscape(play);
  play.walk(RIGHT, 1);
  play.shoot();
  play.run(BETWEEN_SHOTS_FROM_THE_LEDGE_SECONDS.landscape);
  play.shoot();
  play.walk(LEFT, 1);
  fromTheInnerLadderToTheTowerLadder(play);
  DOWN_TO_THE_BALCONY.landscape(play);
  faceTheVault(play);
  play.run(LONG_PAUSE_AT_THE_WALL_SECONDS);
  takeTheKey(play);
  TO_THE_EXIT.landscape(play);

  // then
  assert.equal(chestsInThePocket, '1/11');
  assert.deepEqual(play.events, []);
});

test('level 2 landscape: shots from the ledge along the row of the life chest stop at the stone beside the shaft, so a runner who walks on along that row is caught on the shaft instead of crossing the castle ahead of the guards', () => {
  // given
  const play = playLevel(2, 'landscape');

  // when
  play.walk(RIGHT, 5);
  play.climb(UP, 5);
  play.walk(RIGHT, 1);
  for (let shot = 1; shot < SHOTS_ALONG_THE_ROW; shot++) {
    play.shoot();
    play.run(BETWEEN_SHOTS_ALONG_THE_ROW_SECONDS);
  }
  play.shoot();
  play.walk(RIGHT, 11);
  play.run(AFTER_THE_SHOT_SECONDS);
  const titleAfterTheRow = play.title();
  play.run(DEATH_SECONDS);
  faceTheVault(play);
  play.run(LONG_PAUSE_AT_THE_WALL_SECONDS);
  takeTheKey(play);
  TO_THE_EXIT.landscape(play);

  // then
  assert.equal(titleAfterTheRow, 'ПОГИБ');
  assert.deepEqual(play.events, []);
});
