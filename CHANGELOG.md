# Changelog

Dated entries, newest first. Written for a reader picking this up cold —
or a future session needing to know what already exists and why.

## 2026-11-18 (fourth) - Klad level 4: a route across planks over water (RAS-67)

Level 4 has a new layout of our own, revision 2, named "смотри, куда
падаешь" (watch where you fall). It replaces "обмани хранителя"
(revision 1) in both shapes; the user approved that deletion on
2026-11-18. That level's trick was that guards planned as if planks
always hold, and the chase of RAS-60 removed that planning. The lesson
is the one read from level 4 of the Android remake: plan the route
across planks over water, because a plank holds whoever walks onto it
and drops whoever lands on it from a fall. It was read from still
frames, not from play, so the layout is a candidate that the user plays
on the release preview and corrects. Clean room: the layout is drawn
from that lesson only, never transcribed from a screenshot, a video
frame, an original level or a remake level. It ships on
`release/klad-levels` with the new chase and the other rewritten
levels; the API learns revision 2 in RAS-62, which deploys first.

How it plays, in both shapes: a hall over the deadly water (the row
above the stone bottom row), crossed by bridges of planks. The runner
starts on a ledge at the top left. The key lies on a bridge straight
below the gap beside the ledge, but the drop toward it goes through the
planks into the water. A ladder leads only to a shelf with chests. The
way down is the hole at the far left: its fall goes through a plank in
the shelf and ends on stone. From there the bridge is walked to the
key. The key also opens the door of the guard's ledge at the top right.
The guard steps out toward the runner, walks off the edge, falls through
the planks and drowns. While it is gone the runner takes a short ladder
onto a raised pier and climbs the far ladder to the exit.

### Decisions worth not relitigating

- **The only way down is a fall through a plank onto stone.** So every
  clear needs one fall onto a plank, and the runner has to pick the one
  with stone under it, not the drop toward the key.
- **The guard waits behind a door that the key opens** (one key opens
  every door). The runner is always to its left before the key, because
  the right side is reached only past the key, so the guard stands at
  its closed door. A draft without the door had it walk off its ledge
  and drown over and over from the first second, which looks like a
  broken guard.
- **After the key the far ladder has to be climbed while the guard is
  gone.** Whenever the runner is left of the guard's ledge, it falls
  through the planks again; once the runner is right of it, it walks to
  the head of the far ladder and climbs down. A runner who goes straight
  to the foot of the far ladder may wait there up to 1.65 s in landscape
  and 2.4 s in portrait before climbing. The repeated drowning follows
  from the chase as built (a guard may walk into water); it is not a
  bug.
- **The guard falls through the bridge on the runner's way** (landscape
  column 15, portrait column 7), about 1.7 s after the key is taken. A
  runner who stops near the key for about 0.8 to 1.2 s and then walks on
  meets it there. Kept: the guard is in sight, falling, for about a
  second before it reaches the bridge, and it is the lesson's own rule
  at work. Walking on at once is safe. Waiting until it has passed is
  safe on the bridge, but the far ladder must still be climbed before
  the guard comes back: a stop of more than about 1.6 s (landscape) or
  2.4 s (portrait) means waiting for its next fall, about 4.9 s
  (landscape) or 5.8 s (portrait) later.
- **The key lies well left of the guard's door.** So the guard commits
  to its fall before a runner who keeps walking passes under its
  column. A portrait draft had the key two columns left of the door: a
  runner who did not stop turned the guard toward the far ladder and
  met it there, a death the plank lesson does not explain.
- **Every ladder stands on stone, not on a plank.** Climbing down off
  the foot of a ladder into a plank tile drops the runner through it; a
  draft had both short ladders on planks.
- **The raised pier is one row above the bridge.** Walking off it toward
  the bridge is a one-row fall onto a plank and drowns; the short ladder
  is the way back down to the bridge.
- **In portrait the key's bridge spans the middle of the shaft**, so the
  far ladder is 10 rows high; a draft with the bridge at the bottom had
  a 17-row climb and left 0.85 s. The lower level below it, with three
  chests, reaches no further right than the guard's column, so going
  there never sends the guard toward the far ladder.
- **Landscape has a chest on a shelf of the far ladder:** taking it
  costs part of the time the guard is gone.
- **The level has no brick.** A shot changes nothing here, so the lesson
  stays with the planks. Chests may stand on planks over water: the tile
  below them is the plank (the level test's rule, and RAS-66's "no chest
  directly above water" read the same way).
- guardSpeed 3.3. The name follows the imperative of the other level
  names.

### How it was checked

- `klad/test/levels.test.js`: both shapes pass the validator as before.
- `klad/test/level-4.test.js` (new): per shape, a fixed key script
  clears the level with the guard active (`klad:clear` with level 4 and
  revision 2, no life lost); walking off the ledge toward the key costs
  a life in the water; waiting at the foot of the far ladder lets the
  guard come back down it and costs a life. All three give the same
  result with start delays from 0 to 0.3 s in 16 ms steps (checked once
  with a throwaway script).
- Throwaway analyses with the validator's movement rules, exact for the
  runner since the level has no brick: with every plank turned to air
  there is no clear, so the bridge must be walked; with every fall onto
  a plank counted as drowning there is no clear, so the fall through the
  plank over stone is needed; with planks that always hold, the
  quickest clear falls onto planks that in the real game drop the runner
  into the water; and from every tile the runner can stand on, the key
  (before it) and an exit (after it) stay reachable.
- A throwaway search over the runner's one-tile moves and waits on the
  real `klad.js` with the guard active finds the scripted route as the
  shortest clear in both shapes. With the plank over stone turned to
  stone, and with every plank turned to air, it runs to the end with no
  clear. With `klad.js` patched so that planks always hold, all six
  level 4 tests fail, and that game's shortest clear drowns on the real
  one within its first moves. Not played by hand; the user's play on
  the preview stands in.

## 2026-11-18 (later still) - Klad level 3: careful climbing over a lake, no guard (RAS-66)

Level 3 has a new layout of our own, revision 2, named "не оступись"
(don't slip). It replaces "замуруй всех" (revision 1) in both shapes; the
user approved that deletion on 2026-11-18. The lesson is careful
climbing: chests hang over water, every slip is fatal, and there is no
guard. It was read from still frames of level 2 of an Android remake,
not from play, so the layout is a candidate that the user plays on the
release preview and corrects. The name follows the imperative of the
other level names. The user chose the Korvet order where it is verified
(S5 a: level 2 sealed treasure from Korvet maze 2) and put this lesson,
from the remake's level 2 whose Korvet place is not verified, at level 3,
even though the Old-Games wiki cited in `klad/MECHANICS.md` calls Korvet
level 3 "wall up the guards"; Korvet maze 3 itself has not been seen,
and the wiki sentence stays in `MECHANICS.md` as a source. Clean room:
the layout is drawn from the lesson only, never transcribed from a
screenshot, a video frame, an original level or a remake level. It ships
on `release/klad-levels` with the new chase (RAS-60) and the other
rewritten levels; the API learns revision 2 in RAS-62, which deploys
first.

How it plays, in both shapes: a lake two rows deep lies above the stone
bottom row, and ladders and plank bridges hang over it. The runner
starts on a stone ledge at the top left, near the top of a long ladder;
the door and the exit are on a stone ledge at the top right. The
key lies on a plank beside the lowest rung of a ladder, just above the
water: one rung further down, or one step past the key, and the
runner drops into the lake. Back up, each bridge meets a ladder at one
rung, and a step off the rung above or below it drops the runner through
the air or a plank into the water. The other chests sit on planks beside
rungs, on a ladder top (portrait), under the door ledge (the life chest)
and behind the exit.

### Decisions worth not relitigating

- **No guard** (S7 a), so the "at least one guard" check in
  `klad/test/levels.test.js` is gone (deletion approved 2026-11-18).
  `klad.js` needs no change: with no guard its guard loops do nothing.
  `klad/test/level-3.test.js` plays the level and finishes a race on it.
- **No brick either.** Without a guard the gun is only good for opening
  bricks, and this level has none, so a shot flies until stone, the
  locked door or the edge and changes nothing. The lesson is the
  climbing alone, and the search below covers every way to play.
- **Every fall drowns.** No fall ends on a floor, a ladder or a ledge;
  the one exception is a one-tile drop off the exit ladder, after the
  door. A fall onto a plank goes on through it into the water.
- **No chest sits directly above water** (RAS-66 Q3b a): the chests over
  the lake are on planks, the others on a ladder top or on stone. Planks
  rather than bricks: a brick would catch a runner falling from a rung
  above, a slip without a cost.
- **The life chest hangs under the door ledge**, with stone above it, so
  no fall passes through it. A life chest on a fatal fall gives the life
  back that the fall takes, so that slip would cost nothing.
- **The first edge is two or three tiles from the start**, so a player
  who holds the key from the first moment walks off it in under a second
  and drowns. That is the lesson from the first step; the intro shows
  the name.
- **Two rows of water** look like a lake; no rule depends on the depth.
- guardSpeed stays 3.3: no guard reads it, and removing the field was
  not part of the approved deletion.

### How it was checked

- `klad/test/levels.test.js`: both shapes pass the validator, with the
  guard check removed and every other check as before.
- `klad/test/level-3.test.js` (new): per shape, a fixed key script clears
  the level (`klad:clear` with level 3 and revision 2, no life lost);
  the same way with one rung too far down, or one step past the key,
  costs a life; and the clearing keys finish a race on level 3
  (`startRace`), which runs with no guard. Checked once with a throwaway
  script: the same results with start delays from 0 to 0.3 s in 16 ms
  steps, and both slip tests fail on a level with a plank past the key
  and a rung below the ladder's foot.
- A throwaway breadth-first search over one-tile moves on the real
  `klad.js` (through `test/play.js`), compared with a scratch copy of the
  engine's movement rules: every outcome matched (464 moves from 116
  states, a tile with or without the key, in landscape; 524 from 131 in
  portrait). The engine decides only when the runner stands on a tile,
  and with no guard and no brick nothing depends on timing, so any input
  is a sequence of these moves. Found on the real engine: every move that
  starts a fall drowns the runner, except the one-tile drop off the exit
  ladder after the door; and from every state the runner can
  reach, the exit can still be reached. Found on the copy, which matched
  move for move: every clear takes at least 8 careful moves in each
  shape (on the cheapest route 6 stops where one more tile the same way
  drowns, and 2 steps off a ladder where the same step one rung further
  drowns).
- Argued, not proven: that these moves feel like the original's careful
  climbing. Not played by hand; the user's play on the preview stands
  in.

## 2026-11-18 (later) - Klad level 2: shoot the key out of brick while the guards come up from below (RAS-65)

Level 2 has a new layout of our own, revision 2, named "вскрой кладку"
(break open the brickwork; the word for brickwork holds the word for
treasure). It replaces "обгони хранителей" (revision 1) in both shapes;
the user approved that deletion on 2026-11-18. The lesson is the one read
from Korvet maze 2, the second maze in the Korvet order (RAS-65 Q1 a):
shoot open treasure sealed in brick while the guards work below. It was
read from still frames, not from play, so the layout is a candidate that
the user plays on the release preview and corrects (Q2). Clean room: the
layout is drawn from that lesson only, never transcribed from a
screenshot, a video frame, an original level or a remake level. It ships
on `release/klad-levels` with the new chase (RAS-60) and the other
rewritten levels; the API learns revision 2 in RAS-62, which deploys
first.

How it plays, in both shapes: shelves one tile high with stone floors and
chests sealed in brick rooms on them. The first room stands in the way on
the top floor, so the first thing to learn is the shot, with no guard
near. More rooms lie on the way down, and the key lies in a room of its
own on the lowest shelf, with stone above and below it. The two guards
work below that shelf, one in a hall and one in a deeper hall, each
walking under the runner's column. Their only way up is one ladder that
comes out on the key shelf between the runner's ladder down and the key
room, so crossing its column brings both guards up behind the runner.
Shooting the key room open, taking the key and shooting out of the far
side at once gets the runner away; the far side leads to the only ladder
up to the exit. A runner who waits in the key room longer than about
1.9 s (landscape) or 1.5 s (portrait) is caught by a guard walking in
through the hole. A careful runner can instead shoot the key room from the column
before the guards' ladder, wait about three seconds and then go: the wall
grows back behind the runner and shuts the guards out.

### Decisions worth not relitigating

- **The guards' halls end at their ladder, and nothing before the key
  shelf lies at or past its column** (landscape column 13, portrait 9):
  the top floor ends at the door and the upper shelves end before it. A
  guard walks toward the runner's column, so it stays below until the
  runner goes for the key, and then it always comes up. If a walk on the
  top floor could pass that column, the guards would come up early, wait
  at the key room and meet the runner on the way in.
- **The key room is the only way to the exit.** The ladder up to the exit
  is reached only from the key room's far side or from behind the door,
  so the door keeps the runner from walking from the start to the exit,
  and every way to the key passes the guards' ladder.
- **Every chest can be taken.** A sealed chest that no shot can reach
  would read, in a level about opening sealed chests, as a puzzle the
  player failed.
- **The chests after the key sit a short step off the way out:**
  after the key the guards climb the exit ladder behind the runner, and a
  chest further back toward the door would send the runner toward them.
  The one on the top floor (past the exit in landscape, beside the ladder
  top in portrait) and the pocket beside the exit ladder are taken under
  pursuit (each checked once).
- guardSpeed is 3.2, against level 1's 3.0. One door, opened by the one
  key (S4 a). The name follows the imperative of the other level names.
- The note in the RAS-60 entry that a level 2 race with a portrait host
  probably has no finisher was about the old layout and no longer
  applies.

### The level test learns the shot (RAS-65 Q3 b)

- `reach` in `klad/test/levels.test.js` counts a brick as open only where
  a shot always works: the runner stands (not falls) next to it on its
  row, shoots it and steps in, and the hole stays open while they are in
  it (`klad.js` `fire`, `updateShot` and `updateHoles`). A brick shot from further away,
  or a hole to drop into from above, does not count, so "reachable" stays
  true for a real player. Sealed chests are now checked like any other,
  at most one unreachable as before, and the key-then-exit route may pass
  bricks the same way. Built here for RAS-68 and RAS-69 too.
- `cheapest`, behind the fastest-clear check, now takes every brick as
  open or closed, whichever is quicker, so it stays a lower bound with
  shots at any distance and drops through shot floors. Every level stays
  above the API floor of 600 ticks; the lowest is level 2 landscape at
  1118.
- New cases on small maps: a chest sealed in brick next to where the
  runner stands is reachable; behind stone, under a brick floor, or next
  to a brick passed only in a fall it is not; and the fastest clear
  counts a drop through a brick floor.

### How it was checked

- `klad/test/levels.test.js`: both shapes pass, with no unreachable chest.
- `klad/test/level-2.test.js` (new): per shape, a fixed key script clears
  the level with the guards active (`klad:clear` with level 2 and
  revision 2, no life lost); the same keys without the shot at the key
  room leave the runner at the sealed wall, where the guards come up and
  take a life; and waiting 2.6 s in the open key room costs a life too.
  All three give the same result with start delays from 0 to 0.3 s in
  16 ms steps (checked once with a throwaway script).
- Proven on the maps, since only shots make holes: without a shot the
  runner cannot leave the start corridor in either shape, and the key
  room has stone above and below, so no clear exists without shooting it
  open. Checked with the old no-shot route check on the new maps, and with
  a sweep of the new one: from every tile before the key the key can
  still be reached, and from every tile after it an exit.
- Measured with a throwaway script on the real `klad.js`: how long the
  runner may wait in the key room on the scripted way (above), and the
  early shot and the pocket under pursuit (both clear). Argued, not
  searched: that the guards always come up when the runner goes for the
  key (the first decision above). No guard falls into a hole in this
  level, so the late-fall quirk in the RAS-64 entry does not arise. Not
  played by hand; the user's play on the preview stands in.

## 2026-11-18 - Klad level 1: a dense maze and a guard to wall up (RAS-64)

Level 1 has a new layout of our own, revision 2, named "найди дорогу"
(find the way). It replaces "замуруй хранителя" (revision 1) in both
shapes; the user approved that deletion on 2026-11-18. The lesson is the
one read from Korvet maze 1, the first maze in the Korvet order: find the
way through a dense maze of brick, ladders and planks to chests in dead
ends, past one guard you wall up, over a deadly floor. It was read from
still frames, not from play, so the layout is a candidate that the user
plays on the release preview and corrects (RAS-64 Q1). Clean room: the
layout is drawn from that lesson only, never transcribed from a
screenshot, a video frame, an original level or a remake level. It ships
on `release/klad-levels` with the new chase (RAS-60) and the other
rewritten levels; the API learns revision 2 in RAS-62, which deploys
first.

How it plays, in both shapes: corridors one tile high, stacked, with
brick floors and walls, ladders between them and chests in the dead ends.
Water fills the row above the stone bottom row (RAS-64 Q2 a), so a gap in
the lowest floor, or a fall onto a plank, drowns the runner. The key lies
in a room held by the guard. The guard runs toward the player's column, so
it waits at the stone end of its room, on a brick. A ladder ends right
beside that brick, one row below the room: from its top a shot opens the
brick, the guard drops in and is walled up when the brick grows back. The
only way into the room is a drop from the corridor above onto the guard's
waiting tile; without the shot the runner lands on the guard. From the
room a ladder leads up to the door and the exit, and a side with more
chests opens after the key.

### Decisions worth not relitigating

- **Before the room, the player never gets past the guard's waiting
  column** (landscape column 14, portrait column 10), even if every brick
  were shot open. So the guard stays on its tile until it is walled up,
  and the shot always finds it there. A draft that let the player go
  further let the guard follow the player along its room. A player could
  then dodge it at the drop and outrun it to the key, or bring it back
  late over a brick shot open too early (see the engine quirk below).
- **The drop lands on the waiting tile, not beside it.** With the drop two
  tiles away, a player who stepped back and forth above the room landed
  ahead of the guard.
- **The room's shell is stone except the trap brick, the drop and the
  ladder out, with stone under the trap brick**, so no other shot reaches
  the guard and nobody falls through the open hole. The trap brick's row
  is open to a shot only from that one ladder top.
- **The way round from the shot to the drop takes longer than the brick
  takes to grow back**: at full speed about 5.5 s in landscape and 5.1 s
  in portrait, against 4.2 s. A player who shoots and runs at once lands
  on a walled-up guard, never in the open hole on top of it. A first
  draft's way round took 3.5 s in landscape, which would have killed a
  quick player who had done the lesson right.
- **The side after the key** (lower right in landscape, the right column
  in portrait) is reached only through the room, so standing there cannot
  pull the guard off its tile before the shot. Every ladder reaches down
  to the corridor at its foot, so it can be climbed back; a draft had the
  ladder into that side end one tile short, a way down with no way back.
- guardSpeed stays 3.0: the guard only walks from its start to its waiting
  tile. The name follows the imperative of the other level names.

### How it was checked

- `klad/test/levels.test.js`: both shapes pass the validator as before,
  including the guard-free key-then-exit route.
- `klad/test/level-1.test.js` (new): per shape, a fixed key script clears
  the level with the guard active (`klad:clear` with level 1 and revision
  2, no life lost), going on at once after the shot, and the same keys
  without the shot cost a life. Both give the same result with start
  delays from 0 to 0.3 s in 16 ms steps (checked once with a throwaway
  script).
- A throwaway sweep with the validator's movement rules: from every tile
  the player can reach before the key the key can still be reached, and
  from every tile after it an exit; the only exceptions are the tiles of
  a fall into water.
- A throwaway search over the player's one-tile moves, waits and shots on
  the real `klad.js`, with every state that has a walled-in guard dropped:
  no clear and not even the key without shots, and none with shots from
  that ladder top, both searched to the end in both shapes. Shots from
  anywhere else were not searched to the end (too many states). They
  cannot touch the guard, for the reasons in the decisions above. The
  search rounds the guard's position, so this is "no clear found", not a
  proof. Not played by hand; the user's play on the preview stands in.

### An engine quirk found on the way (not changed here)

A guard that falls into a shot hole in the moment the brick grows back
(while it is in the upper half of its one-tile fall, about 55 ms) is not
walled in: it finishes the fall inside the brick and then walks or falls
out of it. The search found this when the brick was shot early and the
guard arrived late. Level 1 avoids it by keeping the guard on its tile;
a level where a guard reaches a hole late can show it.

### The play harness for the level tickets

- `klad/test/play.js` (new) runs `levels.js`, `ticks.js`, `chase.js` and
  `klad.js` in the page's order in a vm context with a stub page.
  `playLevel(n, shape)` starts level n in one shape at its first frame of
  play. The harness gives keys held for seconds, `walk` and `climb` by
  whole tiles, `shoot`, time in 16 ms frames, the dispatched events
  (`events`, the types) with their `details` in the same order, the title
  and the lives. The game is deterministic (a fixed update step, no
  randomness), so a fixed script plays the same game every time.
- It is `loadGame` from `race.test.js`, moved rather than copied:
  `race.test.js` keeps its 68 tests unchanged through a one-line wrapper
  that keeps its test levels as the default. The race tests now also load
  `ticks.js`, as the page does; `klad.js` does not read it.
- `klad/test/level-1.test.js` is the pattern for `level-<n>.test.js` in
  RAS-65 to RAS-71: a script per shape that clears the level with the
  guards active, and where it is cheap, the same script without the
  level's trick, which costs a life.

## 2026-11-17 (fourth) - Klad guards chase straight at the player, no way around (RAS-60)

Guards no longer search for a path to the player. Whenever a guard stands
on a tile it takes one step that brings it closer to the player, never one
that leads away, and plans nothing further. The source is the user's
observation in a remake of the game: guards "apparently" always run toward
the player and do not go around when they stand directly above or below.
It is not a documented rule of the Korvet game, and `klad/MECHANICS.md`
says so. The user decided the cases the remake does not show (RAS-60, Q1 a
to f, 2026-11-17): at a wall on the player's row the guard waits; a gap in
the floor does not stop it, it walks on and falls, which is how it is lured
into a shot hole; with a ladder step toward the player's row it climbs
first; without one it runs toward the player's column; directly above or
below the player with no ladder step it stands still; it never plans around
water, so it may walk into a pool, or off a ledge onto a plank and through
it, and drown.

It ships with the rewritten levels 1 to 5 and the new levels 6 to 8 on
one release branch, `release/klad-levels`, which the user plays on its
Pages preview before it merges (RAS-60 Q2 a, decided 2026-11-18): the
current levels were built for the old guards (below).

### Decisions worth not relitigating

- **This supersedes "Guards path with BFS and believe planks always
  hold" (2026-10-30 (later)).** The breadth-first search is removed from
  `klad.js` (`pathStep`, `gNeighbors`, `gSupported`
  and the arrays `prev`, `queue`, `nb`), and with it two behaviours: guards
  that believe planks hold, and guards that never step into water. The
  user approved the removal on 2026-11-18.
- **The rule is one pure function, `KLAD_CHASE.step` in `klad/chase.js`**
  (a global plus `module.exports`, like `ticks.js`), loaded between
  `ticks.js` and `klad.js`, so `klad/test/chase.test.js` checks each case on
  a small map without a page. `decideGuard` asks it for the next tile;
  falling, holes, walling in, drowning, the respawn and the guard speed per
  level are unchanged. The race tests now load `chase.js` before `klad.js`,
  as the page does, and one of them puts a guard on the player's row and
  sees it catch the player, so a wrong call from `decideGuard` fails there.
  That test loads `chase.js` itself, so it does not see a script tag
  missing from `index.html`.
- **A guard's ladder step is the player's:** up from a ladder tile; down
  onto a ladder tile or from one, so a guard standing on a ladder set into
  the floor climbs down it. "A ladder that leads to the player's row" is
  read as "a ladder step toward that row is possible now", with no look at
  where the ladder ends. The step is checked for walls only (bricks, stone,
  a locked door), never for a floor, a plank or water. The target is the
  player's rounded tile, as before.
- **The ghost race mechanics are unaffected:** guards exist only in each
  player's own copy of the level, and ghosts touch nothing. A race on a
  shape that cannot be cleared is another matter: every player gets the
  host's shape, so a level 2 race with a portrait host (probably
  unclearable, below) has no finisher and ends at the 4 minute cap.

### What the new chase does to the five levels

Checked by reading the layouts and with a throwaway script that ran the
real `klad.js`, with the old and with the new chase, under a search over
the player's moves, waits and shots. It was not played by hand, and a
search that finds no clear is not proof that none exists.

- Level 1 (замуруй хранителя): both shapes can be cleared. Landscape
  without a shot, as before. Portrait: the search found no clear without a
  shot, with the old chase or the new, and found one with the guard walled
  in. A guard that walks toward the player's column over a shot hole falls
  in, so the lesson holds.
- Level 2 (обгони хранителей): landscape can be cleared, but the guards
  now wait above the player instead of running at them, so it is less of a
  race. Portrait: no clear found, with or without shots, by a search that
  covered every state it reached. Each floor has one ladder up, and a guard
  on the floor above follows the player's column and comes down the ladder
  the player needs. This shape probably cannot be finished.
- Level 3 (замуруй всех): portrait: no clear found without a shot, as
  before, and one with a guard walled in. Landscape can now be cleared
  without a shot, where the old chase allowed none, so walling in became
  optional there.
- Level 4 (обмани хранителя): both shapes can be cleared without a shot,
  as before, and guards still drown in the plank pool. There is no trick
  left to play on them: a guard falls through the gaps above the planks
  whenever the player's column lies beyond a gap. The lesson is weaker.
- Level 5 (всё сразу): landscape can be cleared without a shot, as before.
  Portrait could be cleared without a shot before; now no clear was found
  without one, but it can be cleared once the guard from the middle floor
  is walled in: it goes down to the foot of the only ladder up from the
  floor above the start and, if a shot along that floor has opened the
  brick beside it, walks into the gap and stays there (the next brick, or
  the player below) until the wall grows back.

For the new level layouts: standing still is now often safe, since a
guard directly above or below waits where the old guards always arrived;
and a guard held against a brick walks into it once a shot opens it, and
is walled in if it is still there when the brick grows back.

## 2026-11-17 (later still) - Klad: the game shell works with more than five levels (RAS-63)

New levels above 5 are planned. The game already followed `KLAD_LEVELS`
for the lobby, the boards and the hash; this entry removes the number five
from the rest. On the title screen left and right (the arrow keys and the
touch pad's left and right buttons) step through the levels, and the keys 1
to 9 stay shortcuts (a key above the level count does nothing, as before).
Touch players get a level choice this way. The title text shows the current
level and the count from `LEVELS.length`; the win text says "все этапы
пройдены"; the home page, the game page's meta description,
`klad/README.md` and `MECHANICS.md` say "levels" without a count. The user
decided Q1 a and Q2 a. With five levels the game plays as before; the
sixth level is checked only on a Pages preview with a test level, never
merged.

### Decisions worth not relitigating

- **Stepping wraps** (right on the last level goes to level 1, left on level
  1 to the last): with ten levels it saves up to nine presses and a touch
  player has only these two buttons.
- **Only the arrow keys step, not A and D**, and only on the title screen;
  in play they move the runner as before, and on the title screen they no
  longer set the move keys, so nothing is held when the game starts.
- **Digits stay 1 to 9** (`Digit1` to `Digit9`); level 10 and above are
  reached by stepping or the hash. The title text names the digit range as
  1 to min(9, count).
- The hash rule is unchanged: `/klad/#n` starts level n, above the last level
  starts level 1.
- The unit test runs `klad.js` in the vm sandbox of `race.test.js` with six
  levels (key 6, stepping, wrap, hash 6 and 7). The touch pad's step is not
  in the stub page and is checked by hand on the preview.

## 2026-11-17 (later) - Lobby and race: test gaps, edge cases and a Ready that waits (RAS-38)

The joint review of the lobby and the race (RAS-33 and RAS-34, round 2)
and the round 2 review of the open rooms list (RAS-46) left test gaps and
small edge cases. All of them are closed here, the user decided each one
on 2026-11-17 (the recommendations on the ticket). Nothing on the API side
changes.

**Tests that now exist.** A reconnect during the countdown (state
`starting`, then `go`) gives one engine start and the phase `racing`. The
leave button during a held join that answers 0 or 503, with a new room link
opened meanwhile, sends the leave and then joins the new room. The real
`KLAD_GAME.startRace` returns true for a valid level and false for level 99
or an unknown shape. The test called "went offline" drove a 1000 close, so
it is renamed (race_over) and a real offline case (the socket gave up after
its tries) stands beside it. RAS-46: the busy-join test passed without the
`isBusy` guard, so a new one holds `POST /rooms` and then clicks a room;
the refocus after a changed list, `forgetRooms()` in create and in
`lostPlayer`, one list after a failed re-join and the list after a leave
are pinned. Every new test was checked against a mutation of the line it
guards (22 mutations, each caught). Review round 1 added one more: a 404 on
Ready, Level or Start fetches the open rooms once more, so the list at the
end of the action cannot be dropped unseen; and the Ready test now holds a
re-join with the room shown, which fails without the fix.

### Decisions worth not relitigating

- **Ready is disabled while an earlier lobby action is out.** A tap made
  while another own action (a level change, the previous tap) or a re-join
  was out was dropped by the logic half without a sign. A queued tap was
  the other option; it would send an action the player may no longer mean.
  A disabled button loses the
  keyboard focus in some browsers, and the button just pressed is always the
  one that goes busy, so the page remembers that Ready had the focus and
  gives it back when the button is enabled again, only if the focus is
  nowhere (the body). Level, Start and link only are unchanged: they read
  `isBusy` themselves or stay as before.
- **The host's URL gets `#room=<id>` after a create**, with
  `history.replaceState` (a `location.hash` write would fire `hashchange`
  and open the room again). A host who reloads now joins by the link, like
  everyone else. The URL keeps the link after the host leaves, as it does
  for a joiner who leaves; a reload then joins that room again if it
  still exists. Accepted.
- **A tab whose race socket another tab replaced no longer leaves the room
  when its lobby closes.** The socket module remembers a 1000 close with
  the reason `replaced` (`wasReplaced()`), and `close()` counts it as live.
  The reason is the contract's (section 8). Any other 1000 (`race_over`,
  `idle`) still leaves, as the renamed test pins. Not verified here: that
  the reason survives the Pages proxy into the browser; only production
  shows it. If it does not, the tab behaves as before.
- **Results while the lobby dialog is open keep the room.** `race.js`
  closes the lobby through `KLAD_LOBBY.page.closeKeepingRoom()`, which sets
  a one-shot flag only when the dialog is open, and the dialog's close event
  passes it to `lobby.close(isKeepingRoom)`. The result no longer depends on
  whether the socket's close event or the dialog's runs first. "Назад в
  комнату" and the finish screen's other buttons decide the leave as before.
- **A re-join that fails lists the open rooms once.** `poll()` lists only
  after a plain room answer; `enter()` already lists after the failed join.
- **The own leave asks for the open rooms after the leave has answered**,
  not in the same tick, so the API cannot answer the list first and show
  the room just left. A leave deferred behind a held join still lists at
  once, as before: it has not been sent yet either way.
- **`MAX_TICKS` is gone from `race.js`.** The cap is 250 s times the
  `ticksPerSecond` the page gives (`KLAD_TICKS.PER_SECOND`), so the rate is
  written once. A test with a rate of 60 pins it.
- **Room list items have spaces between host, details and button**, so a
  screen reader without CSS does not run the words together.
- **Accepted, not fixed:** after a reload past the player's own finish, a
  normal game started from the title replaces `#room=` in the URL (the write
  is `intro()` in `klad.js`, which knows nothing of the race; a fix needs a
  race flag there, and `klad.js` is held by other tickets). It now also
  holds for a host, and the level in the URL goes with it until the next
  level starts. The lobby still keeps the room, so "Назад в комнату"
  works; only a second reload loses the link.
- `isFull` of a room line is not read anywhere. It stays until the user
  approves its removal.

## 2026-11-17 - Boards: a line says what a board lists (RAS-49)

The boards dialog (`#board`) now carries one line in the dialog's note
style: "В каждой таблице первые 20 мест. У игрока одна строка: его лучший
результат." Nothing was cut off: the API already returns the first 20
places of every board, one row per player (the plan's rule, so that one
player cannot fill a board), and the game draws every row it gets. A player
who saw one row could not tell a short board from a cut one. The user
decided Q1 b (the line on the boards screen) and Q2 a (the size stays 20).

### Decisions worth not relitigating

- **Fixed markup, no script change.** The line is a `p.note` in
  `klad/index.html` between the switches and `#board-status`, so it shows
  for every board and both kinds of player, and `.note` already meets
  WCAG AA contrast. No unit test is needed.
- **The line names 20, which mirrors `Rules.BOARD_SIZE` in the API.** If
  that size changes, the line changes with it.
- The wording is the ticket's example, unchanged.

## 2026-11-16 (later) - Race: chat pop-ups and a chat dialog (RAS-56)

During a race another member's chat message shows as a pop-up, and the
player can write: the HUD button "Чат" and the key C open a chat dialog.
The API side is RAS-55 (live): a message accepted by
`POST /rooms/<id>/messages` while the room is `starting` or `racing` goes
to every other connected racer's socket as a `chat` frame (contract
section 8); there is no replay and the sender gets only its 201. The user
decided Q13 a on 2026-11-15 (a button and a key that open a dialog, which
pauses the own game like every dialog), with at most 3 pop-ups, about 6 s
each, at the lower edge of the field, no sound and no pop-up while a dialog
is open. Pop-ups: a line "nick: text" in `#chat-popups` inside `#stage`.
The dialog: the room's messages, "Скрыть чат", a labelled 16 px field,
"Отправить" and "Закрыть". The privacy texts need no change: the chat is
still read only by the room's members, kept in memory only, and the
notes say "in the room", not "in the lobby".

### Decisions worth not relitigating

- **Frames go into `lobby.js`'s message list at once; `after` does not
  move.** `lobby.js` listens on the race socket it opened and keeps a
  valid `chat` frame by `n` (the validation of a poll message, shared;
  `you` is never read from a frame). Because the list is the one place
  messages live, the dialog needs no second list, twin nicks get their
  numbers and the member hides work in the race as in the lobby, and
  "Назад в комнату" shows each message once: the room poll after the race
  asks from the last room answer, lists the race's messages again and
  anything the socket missed (a reconnect has no replay), and they dedupe
  by `n`. A frame is not a room answer, for the reason the 201 of a send
  is not: its `n` can be above messages of others that have not arrived.
  The alternative (the pop-up queue listening to the socket on its own and
  the lobby learning of race messages only from the poll) would have kept
  `lobby.js` unchanged but needed a second list, a second dedupe and a
  second validation for the dialog.
- **Opening the chat is the pause; no new pause path.** A dialog already
  holds `klad.js` (`isHeld`), so the chat dialog pauses the own game, and
  keys typed in its field are ignored by the same rule that covers the
  lobby chat. After the close the game is on its pause screen (P or ОГОНЬ),
  as after every dialog; only the pause text in a race changed ("чат: C или
  кнопка «Чат»"). The key is handled in `chat.js` on `document`, not in
  `klad.js`, so the engine knows nothing of chat; it calls
  `preventDefault` (else the typed "c" lands in the field that just got the
  focus) and is ignored while typing, with Ctrl, Meta or Alt (copy),
  outside a race and over another dialog. A held C opens the dialog once:
  its repeats go to the field that took the focus, so they are stopped
  (`preventDefault`) until the key comes up (`keyup`), checked before the
  typing test. Repeats of Enter, NumpadEnter and C in the race dialog's
  field are stopped too, so a held Enter cannot send the kept draft (or a
  refused text again and again); the RAS-54 rule that the draft stays
  after a failed send is unchanged.
- **`race.js` tells the chat whether the race is on.** One call,
  `KLAD_CHAT.page.setRace(isOn)`, on each change of phase, made before the
  countdown or results dialog opens: so a chat dialog still open closes
  first and the focus goes to the results screen, not to the canvas. On
  means racing, or finished and waiting for the others (Q11: the chat works
  after the own finish); off at the countdown (a dialog covers the field
  anyway), the results and every end.
- **A pop-up only while no dialog is open, and a message that came while
  one was open is not shown later.** The same watcher mark as the lobby's
  live region, one mark per consumer (`create().watcher()`), so each
  region and the pop-ups see a message once and a hidden member or "Скрыть
  чат" is dropped for good, as in the lobby. A message that came over a
  dialog is in the chat dialog's list and live region, so nothing is lost,
  only not repeated on the field. Opening the chat dialog clears the
  pop-ups.
- **The race dialog has its own "Скрыть чат", one switch with the
  lobby's.** The lobby is out of reach mid-race, and "Скрыть чат" must
  stop the pop-ups; the two boxes follow one flag and hiding clears the
  pop-ups and both live regions.
- **The chat dialog lists the whole room chat, not only the race's.** The
  list is the room's last 30 as the member may read them; a player who
  opens it mid-race sees the conversation, and the pre-race messages are
  context, not noise. It costs no extra request.
- **Pop-ups: base style is the final state, at most two lines each.**
  The fade-in (0.2 s) is under `prefers-reduced-motion: no-preference`
  only, so the reduced case is the plain style, and removal has no
  animation. A line shows at most two lines of text (an ellipsis cut):
  three 120-character messages wrapped fully would cover much of a short
  landscape phone field. The region sits at `bottom: 2.6rem`, above
  `#online-notice` (which keeps `bottom: .6rem`), and inside `#stage`, so
  the touch pad (a separate grid row) is never covered, on a 360 px phone
  too. Nodes are added once and removed on expiry, so the polite live
  region reads each message once and `#race-notice` is untouched.
- **On a short screen a pop-up is one line.** Under
  `@media (max-height: 500px)` the clamp is one line instead of two: a
  landscape phone is about 360 to 430 px high, a desktop window is far
  above 500 px, and 500 leaves room for browser bars. Three pop-ups and
  about 6 s stay, so no decision of 2026-11-15 changes. Residual: one
  member at the API limit (5 messages per 10 s) can keep 3 pop-ups up for
  the whole race; the remedies are "Скрыть чат" or "скрыть" on the line,
  both in the chat dialog, which pauses the own game.
- **A live region is written only while its dialog is open.** The race
  dialog's and the lobby's regions take announcements only while their
  dialog is shown; the watcher mark moves either way, so a message that
  came over a closed dialog is not read when it opens (the pop-up
  announced it once). A browser that restores form state could tick a
  "Скрыть чат" box while the chat shows; `autocomplete="off"` is not
  allowed on a checkbox (html-validate), so `chat.js` unticks both boxes
  at load and sets them from the switch again at `pageshow` (Chrome
  restores after load, just before `pageshow`, with no change event); it
  never reads them, since a hide lasts only while the page is open. The
  race dialog's region is emptied when the dialog opens.
- **A dialog's close handler guards the focus.** The canvas gets the focus
  after the chat dialog closes only when no other dialog is open, as in
  the lobby and the race dialog; otherwise the end of a race with the chat
  open would take the focus from "Назад в комнату".
- **No new script file, no change to the CSP.** `chat.js` carries all of
  it; the only HTML additions are the button, the pop-up region and one
  dialog, with the contact address inside the email_off markers.

Known edge, not fixed here: a dialog opened on the death or intro screen of
a race ("ПОГИБ", then the level intro) does not keep the game paused after
it closes; the timers run on and play resumes by itself, with no P or
ОГОНЬ. It predates RAS-56 and applies to every dialog (`klad.js` holds only
from `play`); it needs an engine change and its own ticket (follow-up).

Not verified here: a race on the live API with two browsers (a Pages
preview cannot run one); the phone layout on a real 360 px screen; the
repeats of a held key and a restored checkbox in a real browser.

## 2026-11-16 - Lobby: chat in the room (RAS-54)

The members of a lobby room can write to each other before a race. The room
view has a part "Чат" at its end: the room's messages oldest first, each
with the nick, `гость` or `аккаунт`, `человек` or `агент`, and `вы` on the
player's own, and the member number after a nick two members share; a
one-line field with "Отправить" (Enter sends); a switch "Скрыть чат"; and
"скрыть в чате" next to each other member in the members list, with
"скрыть" on each other member's chat line. The API side is RAS-53
(contract section 7): messages travel in the 10 s room poll, a send is
`POST /rooms/<id>/messages`. The user decided Q1 to Q10 on 2026-11-15,
each as recommended (room members only, inside the room poll, everyone
writes, memory only and the last 30 per room, 120 characters and 5 per
10 s, the allow-list, nick and both marks, hiding on the device, the notes
with the chat, a new `klad/chat.js`), and named
hello.rassimok@gmail.com as the contact for reports with a one-line rule.
The privacy texts change in the same go, as RAS-53's order b requires:
until now only someone calling the API by hand could chat. They also carry
RAS-59 (guests deleted automatically about 90 days after their last
visit), which went live on 2026-11-15.

### Decisions worth not relitigating

- **`chat.js` loads after `lobby.js`, so the messages stay in `lobby.js`.**
  While the parser waits for a later script to download, the page goes on
  running network answers, so a room answer can arrive before `chat.js`
  has run. The lobby therefore keeps the room's messages, the `after`
  number and the member hides, and never refers to `KLAD_CHAT`. `chat.js`
  keeps no room data: the lobby dispatches `klad:lobby` on `document` at
  the end of every render with its `state()` as `detail` (as the race
  takes its socket from `klad:race`), and `chat.js` sends through
  `KLAD_LOBBY.page.sendMessage`. A `chat.js` that loads late catches up at
  the next render (tested). The Agent notes had the messages "handed to the
  chat"; this keeps them where the answers arrive.
- **The `after` number moves only with room answers.** A room answer holds
  every message above the `after` it was asked with. The send's 201 shows
  the own message at once, but its `n` can be above messages of others
  that have not arrived yet; `after=<that n>` would lose them. So the own
  message is shown at once, the next poll still asks from the last room
  answer, and the own one is not shown twice (messages are kept by `n`).
  A late answer is dropped with its messages (the lobby shows only the
  newest room answer) and a lost one moves nothing, so the next poll asks
  from the last `n` shown and nothing is lost.
- **`?after=` only above 0.** Absent means 0 in the contract, so a room
  nobody writes in polls exactly the old path, and the hour-long request
  test keeps its 360 polls and 602 requests unchanged.
- **A send is not an action.** It does not set the action guard (the poll
  timer does not reschedule while it is set), does not count as a room
  request (an in-flight poll would be dropped) and asks for no poll: one
  message is one request (the hour with one message sent is 603). It has
  its own one-at-a-time guard. 401 means no player, as everywhere; a 404
  only shows "вас уже нет в этой комнате, или её больше нет" and keeps the
  text, and the next regular poll (at most 10 s) decides with the existing
  rules whether the room is gone, the player was removed or a re-join is
  due, so a send can never cause a join.
- **What the game shows of an answer.** A message is left out, and moves no
  number, unless `n` is an integer from 1 to 999999999 (`after` takes at
  most 9 digits; a larger `n` would make every later poll a 400), `member`
  is an integer, the nick is a string, the kind is `human` or `agent` (any
  other string would be looked up as a key: "constructor" showed function
  text) and the text is 1 to 120 characters. The 201 is checked the same
  way. The page keeps the last 30, like the API.
- **Hides.** "скрыть в чате" works by member number, so one of two guests
  with one nick can be hidden. The hides go with the room (numbers start at
  1 in every room, so a hide carried over would hide a stranger) and stay
  through a re-join of the same room. "Скрыть чат" lasts while the page is
  open, across rooms. Neither is stored: no localStorage, a reload forgets
  both. One set of hidden member numbers lives in `lobby.js` next to the
  member numbers; the members list (rendered by `lobby.js`) and the chat
  lines (rendered by `chat.js`, through `KLAD_LOBBY.page.toggleMemberHidden`)
  both toggle it. The members list is rebuilt only when a member line
  changes and the focus follows to the same member's button (the RAS-46 fix
  for the room list); otherwise every poll would take the focus off it.
- **The member number for twin nicks** (review fix). Guests may share a
  nick, and the members list and the chat lines show different marks, so
  without it two "Bill" could not be matched between the two. A nick that
  two member numbers have, among the current members and the senders of
  the kept messages, is shown as "Bill #3" (`textContent`) on the members
  list entry and on the chat line; every other nick has no number, so a
  normal room looks as before. Senders count too, so a member who wrote,
  left and came back (a new number) or a stranger who took a nick of
  someone who left is told apart as well, but only for the same spelling:
  lookalike guest nicks (Latin "TOM" and Cyrillic "ТОМ") are grouped
  apart and get no number (known limit, a follow-up). The privacy texts
  say that a shared nick shows the member number. The player's own entries
  count as one, since a re-join after the sweep gives the player a new number and
  the own lines would otherwise get numbers. The lobby computes the list
  once (`state().sharedNicks`) for both renderers.
- **"скрыть" on a chat line** (review fix). A member who wrote and then
  left has no entry in the members list, so the line itself has the
  button, keyed by the line's member number. It has no pressed state, since
  the line goes with the hide; a hidden member who has left can be shown
  again only by leaving the room, which resets the hides (a list of hidden
  members to undo them was left out as more than the case needs). A
  focused "скрыть" keeps the focus on its line when the list is rebuilt;
  when its line goes, the focus moves to the list, or to the field once no
  line is left (an empty list is not displayed and cannot take it).
- **Each hide button names the member** (review fix). The visible text
  stays short ("скрыть в чате" in the members list, "скрыть" on a line);
  a visually hidden span after it, set with `textContent`, adds the nick,
  so a screen reader hears "скрыть в чате: Bill #3" instead of the same
  name on every button. No `aria-label` is built from the nick. The chat's
  scroll box is positioned, so these spans stay inside it.
- **Announcements.** The visible list is not a live region, so rebuilding
  it (a hide, a new line) announces nothing. A visually hidden
  `aria-live="polite"` region gets one node per new message of another
  member, replaced with each batch, so several messages in one poll are all
  read and none twice. Own messages, hidden ones and those that came while
  the chat was hidden are never announced. The mark of what was announced
  is moved only by others' messages, because the own one can arrive first.
  Checking "Скрыть чат" empties the region, so some browser and screen
  reader pairs do not read the last batch again when the chat shows again.
- **Layout.** The chat is the last block of the room view, after Ready,
  Start, Leave and the hint: still under the members list, as the ticket
  says, but the room's controls stay in view on a phone. The lines scroll in
  their own box (12rem, `tabindex="0"` and labelled by the heading so a
  keyboard can scroll it), follow the newest while scrolled to the end,
  and the dialog still scrolls. The field has the label "Сообщение", 16 px
  (the existing dialog rule), `maxlength="120"` (a longer paste is cut, as
  in the nick field), `enterkeyhint="send"` and its own form, so Enter sends
  and never reaches Старт; `klad.js` already ignores keys typed in a field
  (now tested). The focus goes back to the field after a send, also after a
  click on "Отправить"; the field is never disabled. Its text is emptied
  only after a 201 and only if it did not change meanwhile, and with a new
  room, so a draft (also one whose send answer came after the leave) does
  not follow the player into a room of strangers.
- **Texts.** A refused text names the rules ("до 120 знаков в одну строку:
  латинские и русские буквы, цифры, пробел и знаки препинания, без эмодзи",
  the contract's allow-list in plain words; the same line is under the
  field), 429 says at most 5 messages per 10 s, any other failure says the
  server is not answering. Each keeps the typed text.
- **The address on the klad page is plain text** inside `<!--email_off-->`
  and `<!--/email_off-->` (the chat note, both footers, the nick prompt): a
  `mailto:` link there would need the RAS-48 new-tab handling, and an
  address without the markers would bring Cloudflare's decoder script,
  which the klad CSP's `script-src 'self'` would let run. The privacy page
  keeps its `mailto:` links, inside the markers.
- `_headers` and the CSP are unchanged; the new script is same-origin under
  `script-src 'self'`.

### Privacy texts

Every claim was checked against the API's CHANGELOG (2026-11-15 fourth,
RAS-53; sixth, RAS-59) and contract section 7: only the room's members read
a message, each only what was sent after their join (non-members get
`messages` empty, a re-join reads only later ones); any player with a nick
can join a listed room; members see nick, kind and guest or account, and
the member number after a nick two members share (a join counter of the
room, not a player id; the API has sent it to members since RAS-53); the
last 30 per room, in memory only, never in the database or a log line;
gone with the room (10 minutes after it empties, or when its host opens a
new room) and with a restart; leaving and logging out keep them; deleting
the player, and a login that merges the guest into an existing account,
removes them from every room; a page that already showed one keeps it
until it reloads; guests whose sessions have all expired, or without a
session and last seen 90 days ago, are deleted with sessions and results,
the first request after a start and then once a day; accounts never, their
expired sessions daily.

- Chat note (new, under the field): who reads, what they see, the 30 in
  memory, not in the database or a log, when they go, that a sent message
  cannot be taken back (leaving does not remove it; deleting the nick
  removes it from the server, but not from screens that already have it),
  the rule (nothing illegal, no harassment) and the address.
- Both footers and the nick prompt: added sentences on the guest purge and
  on the chat (who reads it, the 30 in memory, not in the database or a log,
  gone with the room or a restart) with the rule and the address; nothing
  removed. The rule is the user's one-liner, the same in both languages:
  "ничего незаконного, никакой травли" / "nothing illegal, no harassment".
- Login note (boards), reworded: "иначе они останутся под ником гостя, и
  игра уже не сможет их удалить." now ends "... удалить (сервер удалит
  этого гостя сам примерно через 90 дней после его последнего захода)."
- The status line after a login into an account of the other kind
  (`online.js`), reworded to match: "Они остались под ником гостя, и
  удалить их больше нельзя." -> "Они остались под ником гостя: в игре их
  уже не удалить, сервер удалит этого гостя сам примерно через 90 дней
  после его последнего захода."
- `privacy/index.html`, new: a section "Чат в комнате" / "Room chat", and a
  bullet under "Что видят другие игроки" / "What other players see".
  Reworded, in both languages (old -> new, English quoted):
  - "Updated 15 November 2026." -> "Updated 16 November 2026."
  - The cookie key item "(a key that expired or was cleared from the
    browser stays until the nick is deleted)" -> "(a key cleared from the
    browser stays until it expires; the server deletes an account's expired
    keys on its own, about once a day, and a guest's keys go with the
    guest)".
  - "All of this stays until you delete it; nothing deletes it on its own."
    -> "An account, its results and its email stay until you delete it. A
    guest (a
    nick without an account) is deleted by the server on its own, with its
    keys and results, about 90 days after your last visit to the game, when
    its cookie expires."
  - "When the cookie expires after 90 days without a visit or is cleared
    with the browser's data, the guest and its results stay on the server,
    and the game can no longer delete them." -> "When the cookie is cleared
    with the browser's data, the game can no longer delete the guest; the
    server deletes it with its results on its own, about 90 days after your
    last visit. When you have not played for 90 days, the cookie expires and
    the server deletes the guest the same way."
  - "... and then the game can no longer delete it. So delete the guest
    first, then log in." -> "... and then the game can no longer delete it;
    the server deletes it on its own about 90 days after that guest's last
    visit. To avoid the wait, delete the guest first, then log in."
  - "... and it can no longer be deleted from the browser; until the page is
    reloaded, the game saves no further nick." -> "... and it can no longer
    be deleted from the browser; the server deletes it on its own after
    about 90 days. Until the page is reloaded, the game saves no further
    nick."
  - "If the game can no longer delete your nick (its cookie was lost,
    cleared or expired), write to ... and I will delete it and its results
    by hand." (twice: deletion and contact) -> "If the game can no longer
    delete your nick (its cookie was lost or cleared) and you do not want to
    wait the 90 days, write to ... and I will delete it and its results by
    hand sooner."
  - "The API writes no email address into its log." -> "The API writes no
    email address and no chat text into its log."
- `README.md`: the guest purge sentence under "Collect almost nothing", a
  new principle "Room chat in memory only" (the chat note and the privacy
  page say all of it, the footers and the nick prompt in short), and "One
  privacy page" names the two operator's promises (deletion by hand for
  those who do not want to wait, the contact for chat reports).
  `klad/README.md`: a privacy bullet on the chat (members only, the last 30
  per room in memory, never in the database or a log, gone with the room
  or a restart, the report contact as plain text).

### Tests

340 pass (291 before). `klad/test/lobby.test.js` +27: messages kept by
`n` and `after` on the next polls; an action answer repeating them; a lost
and a late poll answer; hostile messages (text not a string, 121 and 0
characters, no `n`, 0, 1.5, 1e10, no member, a nick that is not a string,
`null`, a kind other than `human` or `agent`, a list that is not a
list); the shared nicks (two members, a sender who left, two senders who
left, the same member twice, the own entries as one, an entry without a
number, and in the state); the own message at once without moving
`after`; one request and no poll per send, a poll in flight during a send
kept, and 603 requests in an hour with one; 400, 429, 404, 500, offline and 401; one at a time and an answer after
leaving; nothing before the room answered; hides by number and the reset in
a new room; a re-join keeping messages, `after` and hides; the cap of 30;
and the page: the hide buttons, their hidden names and their focus, the
numbers for two members with one nick and for a sender who left, the
`klad:lobby` event, `lobby.js` with `chat.js` in one `vm` context from a
room link (lines as text, one POST with the typed text, no `img` or `a`
made; a sender who left hidden from the line), and `chat.js` loaded after
the room answered. New `klad/test/chat.test.js` (21): marks, the name with
the number, order, a hidden member next to a twin, announcements once and
never the own, the own message first, "Скрыть чат", a new room, the send
texts; the page half with a stub `KLAD_LOBBY.page`: `<img src=x>` and a
web address as text, Enter and the focus, the text kept on each failure
and while typing during a send, a blank field, announcements once,
"Скрыть чат" (emptying the announcements), a hidden member's
announcement emptied, the part hidden until the room
answered and the field emptied in a new room, the line's "скрыть" (hidden
name, no pressed state, none on the own line), a nick that becomes shared,
and the focus after a hide. `klad/test/race.test.js` +1:
keys typed in a text field start no game and move no runner. Checked by
mutation (a send moving `after`, a send asking for a poll, a send counted
as a room request, hides kept
across rooms, no length check, own messages moving the mark, the field
always emptied, the members list always rebuilt; in the review fix: no
focus fallback, the announcements not emptied on hide, the draft kept in
a new room, the name missing from either rebuild key, the nick without the
number on the line or in the announcement, the own entries counted
apart, any string as kind, no hidden name in the members list button):
each fails a test.

### Not verified here

The two-browser run on production, the 360 px layout (now with a button
on every other member's line) and a screen reader in a real browser (the
hidden button names, the focus after a hide, that a positioned scroll box
keeps the hidden spans from adding scroll), no console errors or CSP
violations on a Pages response, and that Cloudflare leaves the four
addresses on `/klad/` alone.

## 2026-11-15 (sixth) - Lobby: invite a friend by mail through the player's own mail app (RAS-48)

The room view has a link "Отправить по почте" next to "Копировать". It opens
the device's mail app through `mailto:` with a subject, a short text holding
the room link, and no receiver. The player types the address and sends from
their own account.

### Decisions worth not relitigating

- **`mailto:`, not a mail sent by the API.** No API change, no mail quota, no
  stored address, so the privacy notes and the promise that the server mails
  only login codes stay as they are (user, 2026-11-15; the API variant,
  RAS-47, is cancelled). Limit: a device with no mail handler may do nothing;
  "Копировать" stays as the fallback.
- **No `href` in the served HTML, and `target="_blank"`.** Cloudflare's Email
  Address Obfuscation (on for the zone) rewrote a `mailto:` link on
  `/privacy/` and injects a `/cdn-cgi/` decoder script, which the klad CSP
  `script-src 'self'` would let run. The anchor has no `href` in the HTML;
  `renderRoom` sets it before the room part is shown. `target="_blank"` and
  `rel="noopener"` are set there too, because html-validate rejects both on
  an `<a>` without `href`. They make a web mail handler, for example Gmail
  registered in desktop Chrome, open in a new tab; without it the game tab
  would be replaced, the player would drop out of the room until the 60 s
  sweep and a host would have no `#room=` to come back to (main session,
  2026-11-15).
- **An `<a>`, not a form or a script.** A form would be blocked by
  `form-action 'none'`; navigating a link to `mailto:` is not covered by the
  klad CSP (research item 18), so `_headers` is unchanged. To be confirmed on
  a Pages response in Chrome and Safari.
- **Built in `KLAD_LOBBY.inviteMailto` from the link field's value**, so the
  mail carries exactly the link the player sees and copies (page origin plus
  `/klad/#room=<id>`); no URL literal in any `.js` file. Subject and text
  are `TEXT.inviteSubject` and `TEXT.inviteBody` and both are encoded with
  `encodeURIComponent`, so `#`, `&`, spaces and Cyrillic cannot break the
  link. The href is set in `renderRoom`, so it follows the room the player
  is in.
- **Focus.** A link is reachable with Tab and takes the dialog's
  `:focus-visible` outline; the focus handling RAS-46 added is untouched.
- **Tests** in `klad/test/lobby.test.js`: the href decodes back to the
  subject and the exact room link and holds no `+` (spaces are `%20`); in the
  page test `#lobby-mail` has no event listeners and the full list of server
  calls equals the join flow's own (heartbeat, online list, room list, join,
  poll), so the link adds no call.

## 2026-11-15 (fifth) - Email addresses on the privacy page kept out of Cloudflare's rewrite

Cloudflare's Email Address Obfuscation (a zone feature, on by default)
rewrote every address on `/privacy/` into a placeholder and injected its own
decoder script from `/cdn-cgi/`. The page's CSP has no `script-src`, so the
script was blocked: visitors saw "[email protected]" instead of the contact
address, and the browser logged a CSP violation. Each address is now wrapped
in `<!--email_off-->` and `<!--/email_off-->`, which tells Cloudflare to leave
it alone, so no script is injected and the `mailto:` links work.

### Decisions worth not relitigating

- **Markers per address, not a zone setting.** Turning the feature off in
  the Cloudflare dashboard (Scrape Shield) would cover every page, but it is
  a zone setting outside the repo and outside this change; it is listed for
  the user. Any page that shows an address (the chat note of RAS-54, the
  Google sign-in notes of RAS-44) needs the same markers until then.

## 2026-11-15 (fourth) - Privacy page at /privacy/ (RAS-57)

Google's OAuth consent screen "In production" needs a privacy policy on the
app's own domain, linked from the home page, that says how the app uses,
stores and shares data (decided by the user on 2026-11-15). Until now the
only privacy texts were the klad footers and the notes in its dialogs, at
no stable URL of their own. `privacy/index.html` is a new page: plain HTML
on `/style.css`, no JavaScript, Russian first and English after. The home
page footer, both klad footers (English and Russian) and the privacy note
of the boards dialog's login part link to it; that note also says "игра уже
не сможет их удалить" instead of "удалить их будет уже нельзя" (see the
deletion requests below), and the other notes are unchanged. Google
sign-in (RAS-44) and the room chat (RAS-54) add their sections in the same
change as their features.

### Decisions worth not relitigating

- **Only what the code does.** Every claim was checked against the API at
  `main` (migrations V1 to V3, `Sessions`, `PlayersResource`,
  `LoginResource`, `LoginCodes`, `PresenceStore`, the room views,
  `RaceMessage` with contract section 8, `BoardsResource`,
  `application.properties`, `deploy.yml`) and against the site (`_headers`,
  the proxy, `online.js`, the klad notes). The one promise that is not in
  the code is deletion by hand on request (below). The regions of Neon
  (AWS eu-central-1) and Resend (eu-west-1) and the 30 days of Cloud
  Logging come from the run's brief and the workspace state, not from code.
- **The stored list is complete.** Besides the nick, the kind, the results
  and an account's email, the tables hold when the player was created and
  roughly when it was last seen (refreshed at most once a day per browser,
  and at each login), the time of each result, and the hash of each cookie
  key issued to the nick, with when it was issued and when it expires. A key
  that expired or was cleared from the browser stays until the nick is
  deleted; logout and a login delete only the browser's current key, so the
  page no longer says "one per browser". A shorter list would be wrong, so
  the page names them all. "Nothing deletes
  it on its own": there is no guest purge (an open proposal), and expired
  session rows stay too, so the page says the cookie expires, not that the
  session is deleted.
- **Deletion with its limits.** The button deletes a guest only in the
  browser that holds its cookie. The most common way to lose that is a
  cookie that runs out after 90 days without a visit or is cleared with the
  browser's data: the guest and its results stay. A login into an account
  of the other kind leaves the guest with its results and no cookie (as the
  klad login note says); a browser that refuses the cookie leaves the nick
  it just saved on the server, without results (the read-back in
  `online.js` finds no player, and no further `POST /players` goes out
  until a reload); the send-log hashes stay a day and go with the first
  code request after that. Logout deletes the browser's key and the cookie
  and keeps the account. The page and the login note say the game can no
  longer delete such a guest, not that nobody can: the contact address also
  takes deletion requests (decided by the user on 2026-11-15, for GDPR), and
  the page, next to the limits and again under "Contact", asks for the nick
  and roughly when it played, so the nick and its results can be deleted by
  hand.
- **Boards are "open to everyone"**: `GET /boards/*` needs no session. The
  online list, the open rooms and the room members are seen by players with
  a nick, as the lobby note says. In a race the others get, from the race
  socket, each member's position, nick, kind, place and ticks, so the race
  line names all of them (the race dialog's note names runner, nick and
  time).
- **Accounts and merges:** the account part also says that a new account
  is made from the browser's guest with its results, and that a login into
  an existing account of the same kind moves the guest's results into it
  and deletes the guest (contract section 5), because data moves between
  records there.
- **Logs:** Cloud Run's request records and the API's own lines go to Cloud
  Logging for 30 days, with no region named (the default bucket is
  `global`). "The API writes no email address into its log": its two log
  calls hold none (the failed-mail line names only the exception class and
  the SMTP reply code). The unexpected-error mapper logs any other exception
  with its text; of the database constraints only the unique `email` one
  could repeat an address, and verify cannot reach it (the code row's lock
  serialises it, and an existing account is looked up first). The page makes
  no claim about IP addresses: it says only which request headers the proxy
  passes on, which is in the code.
- **No links to the providers.** A `https://` link fails the CI grep on
  `//` and would be the only outbound link besides GitHub; Cloudflare,
  Google, Neon and Resend are named in text. The `mailto:` link has no `//`.
- **Layout from the home page:** `main.crt` and `div.screen`, no new CSS.
  `style.css` colours links and headings for the dark screen only; outside
  it the yellow links would fail contrast on the light background. Only the
  screen's power-on animation runs (none under reduced motion); `.copy`,
  `.reel` and the other attract-mode classes are not used, so no text waits
  for an animation. One `h1` ("Приватность / privacy"), the Russian
  sections as `h2`, then a
  `div lang="en" id="en"` with its own `h2`s; a link at the top jumps to the
  English part. A line "Updated 15 November 2026" in both languages tells a
  reader which version they read; the tickets that add sections update it.
  The meta description is English, like the klad page's.
- **Link texts:** "Privacy policy." closes the home page's privacy line and
  the English klad footer (before "← rassimok"); the Russian footer ends with
  "Подробнее на странице о приватности." `klad.css` hides the game's footer
  on touch devices, so on a phone the game's only link to the page ends the
  login part's privacy note (shown for a guest or no player), and it opens
  in a new tab (`target="_blank" rel="noopener"`, said in the link text) so
  the game in progress and any results waiting in memory are not lost; the
  nick prompt gets no link. A new `dialog a` rule gives it the footer links'
  `--crt-hot`, because the browser's default blue fails contrast on the
  dark dialog.
- **Size:** about 21.4 KB, 7.0 KB gzipped (Cyrillic takes two bytes a
  letter). The home page budget (2026-10-30) is for the apex; this page is
  text that only loads when asked for, and nothing on it is decorative.
- `_headers` is unchanged: the `/*` block covers `/privacy/` (CSP
  `default-src 'none'` with same-origin styles and images, HSTS, nosniff,
  no referrer, the permissions, COOP, CORP, no frames), and `/klad/*` does
  not match it.
- CI: `privacy/index.html` joins the html-validate step. No node test: the
  page has no logic, and html-validate, linkinator (it crawls `/privacy/`
  and skips the `mailto:` link) and the two grep guards check it.
  `klad/README.md` names the page as a reference outside the game's folder
  and in its removal steps.
- Not verified here: `/privacy/` on production (status, headers, a read of
  the page) waits for the deploy.

## 2026-11-15 (later still) - Klad lobby: open rooms with a join button (RAS-46)

The lobby had no list: a room was entered only by its link. The API now
lists open rooms (RAS-45, `GET /rooms`), so the lobby shows them. The user
decided on 2026-11-15: only the list and the counts in the headings (no
player status, no panel layout), and the list only while the player is in
no room (in a room it would invite a join that silently leaves it).

- `lobby.js`: `listRooms()` runs at the end of each presence beat, so it
  shares the 30 s rate and the conditions (lobby open, tab visible), and
  only while the player is in no room. It also runs once after the player
  leaves, after a failed join and after being dropped from a room, so the
  list is not the stale one from before the join. An answer older than a
  newer request, or one that arrives after joining, is dropped. Entries
  with an id that is not a room id are left out. Outside a room the hour
  costs about 360 requests (240 presence, 120 list), as in contract
  section 7; inside it is still about 600 (a room opened after the first
  beat adds that one list). The lobby test counts both.
- Review round 1: the list is cleared (`rooms = null`, "загрузка") when a
  room is entered and when the player is lost, and `listRooms` now also
  drops an answer that arrives while in a room (the comment promised it, the
  check did not do it). The page rebuilds the list only when a line changed
  (id, state, host, counts, level, shape), because a rebuild every beat
  dropped keyboard focus from a "Войти" button; when a line did change, focus
  follows to the button of the same room. After a join from the list that
  does not open the room, focus goes to that room's button if it is still
  there, otherwise to "Создать комнату". "Войти" in the note meant account
  login on this page, so the note now names the audience. The page test
  stub uses a `test://` origin instead of a split `https:` literal, so the
  CI grep guard is not worked around. New tests: late list answer dropped, a
  real race-socket leave with the lobby closed, one list after a drop,
  `joinFromList` while busy, focus kept and moved.
- The join button calls the existing `join(id)` through `joinFromList`,
  which does nothing in a room, while a request is out, or for a malformed
  id, so the messages for a full room, a running race and a room that is
  gone are the old ones. Only a `lobby` room with a free place gets the
  button; full, `starting` and `racing` rooms say "заполнена", "гонка
  начинается", "идёт гонка".
- Link only: a checkbox "Только по ссылке" before "Создать комнату" sends
  exactly `POST /rooms?listed=false`; unchecked sends plain `POST /rooms`
  (no query means listed). The host's room view has the same checkbox
  (`POST /rooms/<id>/listed`, `{"listed":true|false}`); everyone reads the
  setting from `listed` ("Комната в списке открытых комнат." or "Комната
  только по ссылке: в списке её нет."). A missing `listed` counts as
  listed. The checkbox is not rewritten from the poll while its own request
  is out, as with the level select.
- A non-member's `GET /rooms/<id>` has `host` null and `players` empty
  since RAS-45. Checked with tests: `roomView` reads it as no member, a poll
  that gets it ends the room view with the "removed" text, and after a long
  unseen time it counts as dropped and joins once more (`wasDropped`). The
  `#room=<id>` entry joins by POST, which answers the member's own view,
  so it never depends on that answer.
- Page: each room is one `<li>` (host nick, "игроков N из M, Этап ...",
  button or mark), so a screen reader reads the room and its button
  together; the button is a plain `<button>` reached by Tab with the
  dialog's existing focus outline. The item wraps on a phone and the
  dialog already scrolls. Host nicks go in with `textContent`; the page
  test runs `lobby.js` in a `vm` context with a stub page and checks that a
  nick `<img src=x onerror=alert(1)>` is text and no `img` is created.
  After a join from the list focus goes to "Копировать", as after creating
  a room.
- Texts: headings "Сейчас в лобби: N" and "Открытые комнаты: N" (without
  the count until the first answer). The note says every player with a nick
  (guest or account; `GET /rooms` needs only a session) sees a listed
  room's host nick and player count, also during its race; that any such
  player can join an open room and then sees its members; and that link
  only hides a room from later lists but does not take back a link already
  seen. A failed list says "Сервер не отвечает: список комнат
  не загрузился. Остальное в лобби работает." The count counts the 20
  rooms the API returns, so it caps at 20.
- Not verified here: the two-browser run on production and the 360 px
  layout in a real browser.

## 2026-11-15 (later) - Klad: the game is ready for rooms of up to 10 (RAS-42)

The room size comes from the API, but the game had 4 built in. This ships
before the API change (RAS-43) on purpose: with the API still at 4 nothing
changes for players, while in the other order a fifth player's runner
would be invisible to the others. Contract sections 7 and 8 still say 4
until RAS-43 changes them.

- `race.js`: `SLOTS` is 10. A `pos` from slot 0 to 9 makes a ghost (the own
  slot excepted), slot 10 and above makes none; the finish table sorts
  players with no place after 10 places (`SLOTS + 1`). The per-slot ghosts
  of RAS-40 needed no other change.
- Ten ghost colours, `--crt-ghost-0` to `--crt-ghost-9` in `klad.css`,
  with the same fallbacks in `klad.js`, picked by slot (no `% 4`, which
  repeated colours from slot 4). The first four are unchanged. New:
  `#d6f26b` lime, `#ffa45c` orange, `#ff8fb8` rose, `#86b6ff` sky blue,
  `#e6d3a3` sand, `#8ff0e0` aqua. Checked with a throwaway script: contrast
  against `--crt-bg` is 8.7 or more for all ten (the first four are 8.7 to
  16.7; the new ones 8.8 to 15.0), the CIELAB distance of every new colour
  to every other ghost, `--crt-fg` and `--crt-alert` is 22 or more (the
  closest pair is sky blue and the lavender of slot 3), and none is
  green or red. Sand and orange sit near the `--crt-hot` yellow, which no
  ghost uses.
- Texts name no number: the room-full message is now "Комната заполнена:
  свободных мест нет." and the lobby hint is "Создайте комнату и отправьте
  ссылку друзьям." (the "up to N" clause is gone, because any number there
  goes stale with the API). The room view keeps "Игроков: N из <size>" from
  the API.
- Tests: slot 9 makes a ghost and slot 10 none (the bad-slot test moved
  from 4 to 10), results with 10 places in order, ten different colours in
  the `klad.js` test, `roomView` with size 10 and 10 players, and the
  room-full text has no digit.

## 2026-11-15 - Klad ghost race: ghosts move smoothly (RAS-40)

Other players' runners hopped about five times a second, because a ghost
was drawn at the last received position until the next `pos` arrived (a
step of 1 cell walking, 1.8 falling), and unevenly when the network delayed
a message. The receiver now interpolates; the sender and the API are
unchanged (`pos` every 200 ms, contract section 8 as it was). This replaces
the 2026-11-13 (eighth) decision "a ghost is drawn from the latest
position".

### Decisions worth not relitigating

- **Each ghost keeps its last 10 positions with the sender's `tick`, and is
  drawn 250 ms in the past on the line between the two around that
  moment.** Positions are spaced by the sender's ticks (the rate is
  `KLAD_TICKS.PER_SECOND`, passed to `race.js` as `ticksPerSecond` like
  `format`, not repeated), so a message that comes late does not change the
  spacing. A position is shown at the previous one's time plus the tick
  gap, but never sooner than half a send interval (`POSITION_EVERY / 2`,
  100 ms) after the previous one, even when it arrives at once behind it:
  messages that come bunched after a stall (TCP delivers them together)
  would otherwise get a slide of zero length and hop. (A tick gap under
  100 ms, as after a resume, keeps its own shorter slide.) The time may so
  run past the arrival: after N positions arrive together the ghost runs
  at twice its speed, up to 250 + 100 x (N - 1) ms behind their arrival,
  and is back at its usual 250 ms about N x 200 ms later, about the length
  of the stall. Known limit: from about 9 positions together (a stall of
  about 1.8 s) the cap of 10 drops samples the drawn moment still needs,
  and the ghost hops a cell at a time until it has caught up; no worse
  than before this change. When the previous position's time is already
  behind the drawn moment (a pause, a lost frame, latency that rose for
  good), the new one is anchored at its arrival instead and its move starts
  no earlier than the drawn moment, so the ghost waits where it stands and
  slides, and the messages after it keep the floor above. A move
  otherwise starts at its time minus the tick gap.
- **Never extrapolate.** After the last position the ghost stays; a guess
  that is wrong would be a hop back. The 2 s fade is unchanged.
- **At once, no slide:** a lower `tick` than before (a new attempt after a
  death; `intro()` resets the count) or a step over 3 cells (Euclidean, in
  cells) starts the list again at that position. A fall step of 1.8 cells
  is below 3 and slides. A `state` after a reconnect clears the ghosts and
  takes its `positions` the same way, so they show at once.
- **The cap is 10 positions per ghost**, so a member that sends 10 a
  second for 4 minutes does not grow memory; the oldest is dropped.
- **The delay costs jitter room only 250 ms minus the 200 ms spacing.** A
  message up to about 50 ms late is absorbed fully; a later one makes the
  ghost wait at its last position and then slide to it, re-anchored at
  its arrival, so the margin comes back. No tested scenario (late
  message, bunched pair, three after a stall, rising latency, lost ticks)
  moves a ghost more than 0.25 cell per 10 ms frame. Right after a stall
  the lag passes the usual 250 ms by the rule above, which is the price of
  the floor. Do not keep a one-frame catch-up on purpose. A longer delay
  is not needed and would go over the "about a third of a second behind"
  the ticket asks for; `GHOST_DELAY` is one constant.
- **Facing follows the received x** against the previous position, as
  before, and slots still separate the ghosts.

## 2026-11-13 (eighth) - Klad ghost race: countdown, ghosts, finish screen

When the host starts, every player in the room plays the same level on
their own copy and sees the others as coloured, see-through runners with
their nicks. `klad/race.js` takes the lobby's socket at `klad:race` and
speaks contract section 8 on it: the server's `countdown` shows 3, 2, 1 in
a race dialog (which closes the lobby), `go` starts the level fresh in the
host's shape, positions go out about 5 times a second, `finish` goes once at
the exit with the attempt's ticks, the top of the field says "waiting for
the others" until `results`, and the finish screen shows the places, nicks
(winner, you, left marked) and times, with "Назад в комнату" and "Выйти из
комнаты". `klad.js` gains a small race hook (`KLAD_GAME`). Written before
the server side (RAS-32) was deployed: the tests use the lobby's real socket
module on a fake `WebSocket`, a fake clock and a fake engine, and run
`klad.js` itself in a `vm` context. It merges together with the lobby
(RAS-33), after RAS-32 is live.

### Decisions worth not relitigating

- **Forcing the host's shape is a flag, not an engine change.** `loadLevel`
  took its shape from the orientation in one line, and `resize()` already
  fits any width and height into the stage, so a portrait level on a
  landscape screen just gets smaller tiles. The race keeps its shape for the
  whole race (a death reloads the level through `intro()`), and the pad
  layout still follows the device.
- **A race is the engine in race mode, nothing more.** `KLAD_GAME.startRace`
  sets one `race` object; while it is set a death costs no life and there is
  no game over (retries are unlimited), the exit hands the ticks to the race
  and parks the game in a `finish` phase instead of `klad:clear` and the
  next level, so neither `klad:clear` nor `klad:run` is ever dispatched and
  a race never reaches the boards. The level is not written into the URL
  hash, which may hold the room link. `stopRace()` clears the flag and goes
  back to the title; a test proves a lost game after a race reports its run
  again, because a leaked flag would silently switch off game over and the
  boards.
- **The countdown has its own dialog and closes the lobby.** The countdown
  arrives while the lobby dialog is open, and the field behind a modal is
  hidden by its backdrop; the lobby rewrites its own race line on every
  render. So `countdown` closes the lobby (which keeps the room while it is
  `starting`) and opens the race dialog, and `go` closes that. Any open
  dialog holds the game, so the title cannot be played meanwhile. Only a
  change of phase opens or closes the dialog, so one closed with Escape
  stays closed. Racing and finished close the lobby too: a reload in the
  race lands there straight from the lobby dialog.
- **Positions only while racing, visible and in play.** `pos` goes every
  200 ms (the server drops more than 10 a second), rounded to two decimals
  to keep frames far under the 512-byte cap, and only while the tab is
  visible and the game is in its play phase. A paused, dead or
  dialog-held player sends nothing, so their ghost fades on the others'
  screens, as the ticket accepts for a hidden tab. `ping` runs on one timer
  per race from `klad:race`, however often the socket reconnects.
- **A finish is never lost to a reconnect.** `send` returns false while the
  socket is not open; a finish made then waits, and the `state` the server
  sends on every connect decides: this player unfinished there means send it
  now, finished means the server has it.
- **Ghosts by slot, drawn on the canvas.** Four fixed colours
  (`--crt-ghost-0` to `--crt-ghost-3`, none green like the player or red
  like the guards) by the server's `slot`, because guests may share a nick.
  The nick is drawn with `fillText`, never put in HTML. A ghost is drawn
  from the latest position at 0.55 opacity, fades out over 1 s after 2 s
  with no update, and has no collision. Ghosts are drawn under this
  player's own runner, so the player stays readable in a crowd. A `state`
  after a reconnect replaces the ghosts with its `positions`, and a `state`
  that says `racing` before any `go` starts the race (a missed `go`).
- **Waiting for the others is a line on the field, not a dialog.** The
  player can watch the remaining ghosts run to the exit. The finish screen
  is a dialog, since it has buttons; "Назад в комнату" opens the lobby
  again and "Выйти из комнаты" leaves the room through the lobby
  (`KLAD_LOBBY.page`, like `KLAD_ONLINE.page`), so the lobby's own room
  bookkeeping stays the only one.
- **Closing the finish screen leaves the room, unless it is "Назад в
  комнату".** After the results the room is back in the lobby with the
  ready marks cleared. A player who closed the screen with Escape stayed a
  not-ready member until the API's 60 s sweep, and Start answered
  `not_ready` for the others meanwhile. The screen now says that closing
  leaves, like the lobby's hint. The room button's flag is cleared in the
  `close` listener, not in the click handler, because a browser fires
  `close` after the handler has returned; the test's stub dialog does the
  same.
- **A reload during a race resumes it.** The `#room=` link joins again,
  the API answers 200 with the room in `racing`, and the lobby opens the
  socket, so the race starts from the server's `state` (contract section
  8). When that `state` shows this player already finished, the race does
  not start the level again: it waits for `results`, sends no second
  finish (the server has it), and says so without a time, which the reload
  has lost. The host's URL still has no `#room=`, so a host who reloads
  loses the room (an open item from the lobby's second review).
- **Ends without results get a note, not a dialog.** Close 1000 before the
  results (`replaced`, `idle`, or the lobby's own leave button) and
  `offline` after the socket opened end the race and go back to the title
  with a note at the top of the field for 8 s; a dialog would land on top
  of the lobby after a deliberate leave. A drop only shows "reconnecting":
  the lobby's module reconnects and the local game goes on. A socket that
  never opened says online play is not available.
- **Hostile input and small texts (second fix round).** A member's `pos`
  outside cells 0 to 24 (the larger side plus one) makes no ghost, and a
  result time over 4 minutes and 10 s shows as `-`, so nobody can put a
  ghost far outside the field (one bound for both axes, so a position just
  below or beside the field passes and is clipped by the canvas) or stretch
  the results table. Closing the lobby now
  leaves the room unless a race socket is live, so the "closing leaves"
  hint holds after a race too; a deferred leave also goes out when the held
  join answers 0 or 5xx (a leave from a non-member is a harmless 204), and
  that branch renders and resumes. `startRace` returns whether it started
  and the race ends with a notice when not. The lobby's waiting line shows
  only while the room is `starting`. The socket remembers an own leave
  (`close(true)`, `hasLeft()`), so the race says "you left the room"
  instead of the closed-by-server text. The field notice and the dialog's
  status line are both live regions, so only the one in view gets the text
  (the other is emptied) and it is announced once. The race dialog states
  who sees what: room members see the runner, nick and time during the
  race, and nothing goes to the boards.
- **The engine itself is under test now.** A fake engine cannot show that
  `klad.js` suppresses `klad:clear`, `klad:run` and game over, so
  `test/race.test.js` also runs `klad.js` in a `vm` context with a stub
  page and a test level whose two shapes put the exit next to the start,
  drives it with key events and frames,
  and checks the forced shape, the exit, deaths, `stopRace` and the ghost
  text.

## 2026-11-13 (seventh) - Klad lobby: online list, invite link, room and ready

A "Лобби" button in the HUD opens a lobby dialog: who is in the lobby now,
"create room" with an invite link `/klad/#room=<id>` and a Copy button, and
the room view with each player's ready mark, the host marked, the host's
level choice (1 to 5) and Start once everyone is ready and there are at
least 2 players. Opening the page with `#room=<id>` opens the lobby and
joins that room; without a nick it opens the nick prompt first and joins
once there is one. A malformed id, an unknown room (404) and a full room
(409 `room_full`) each show their message. All of it is REST against
contract section 7 (`/presence`, `/rooms`), written in `klad/lobby.js`
before the API side (RAS-31) was deployed. It has not yet run against the
live API: the tests use a fake `fetch`, a fake clock and a fake
`WebSocket`. The one WebSocket client (`KLAD_LOBBY.connect`) is in the
same file. It opens `wss://<host>/klad/api/race/<id>` only when a polled
room is `starting` (or `racing`, after a reload in the race), and the lobby
then only shows a waiting line; the race
itself (RAS-34) takes the socket from there. This merges together with the
race (RAS-34), after the race socket (RAS-32) is live, never alone: without
the race, Start would open a socket and leave the players waiting for
nothing.

### Decisions worth not relitigating

- **REST polling, and nothing outside the open lobby.** The user decided
  on 2026-11-13 that the lobby is REST, not a socket. Every request goes
  through the Pages Function and counts against the shared 100,000 a day
  Workers quota. So the heartbeat (`POST /presence`) and the list
  (`GET /presence`) run only while the lobby dialog is open and the tab is
  visible (`document.visibilityState`), at most once per 30 s each (about
  240 requests an hour). The room poll (`GET /rooms/<id>`) runs every 10 s
  only while the room view is open and visible (about 360 an hour more,
  600 in all). Each poll remembers its last run, so hiding and showing the
  tab, or closing and opening the lobby, never sends sooner; a test plays a
  whole hour with the tab hidden and shown every 7 s. After each own action
  (join, ready, level, start) one poll goes out at once and the 10 s count
  starts again from it, so the view shows the action's effect without
  waiting for the next poll.
- **The socket opens only at race start, once.** It opens when a polled
  room (or the host's own start answer) says `starting`, or `racing` after
  a reload in the race (the API lets a member reconnect within 30 s), and
  only if the lobby has none for that race. A socket that ended stays
  until the room is back in the lobby, so a `racing` poll cannot open
  another one in a loop. After a drop it tries again after 0.5, 1, 2 and
  4 s, then reports `offline` and stops: every attempt is a Workers request,
  and the waits (7.5 s in all) stay short next to the API's 15 s wait for
  every player at race start, which a guest's poll may see up to 10 s
  late. A successful open starts the waits from 0.5 s again, but one
  `connect()` makes at most 8 reconnects in all: a socket the server
  accepts and then drops at once (a repeated policy close, or a proxy
  that loses the connection after the 101) would otherwise reconnect
  every half second for the whole race. A normal close (1000) from
  either side ends it as `closed` without a retry, because the server
  closes the sockets after the results. A policy close (1008) ends it as
  `offline` without a retry: contract section 8 makes it a client bug,
  such as a message over 512 bytes, which a retry would only repeat. The
  lobby closes it itself on leaving and when a poll shows the room back in
  the lobby state. A browser without WebSocket, or a socket that never
  opened before the tries ran out, shows "online play is not available in
  this browser"; the game is not touched. So does a poll that no longer
  lists this player while such a socket is still trying: the API drops a
  member not connected 15 s after Start, and a joiner whose poll saw
  `starting` late gets that poll before the tries run out, where "you are
  no longer in this room" would blame another tab. Contract section 8 is the
  protocol; the module sends and reads none of its messages, and the race
  (RAS-34) adds `ping` (every 20 s), `pos` and `finish`.
- **The hand-off is a `klad:race` event.** Like `klad:clear` and `klad:run`
  between `klad.js` and `online.js`, the lobby dispatches `klad:race` on
  `document` right after it creates the socket, before the first attempt,
  with `detail.room` (the polled room: id, level, shape, players) and
  `detail.socket` (`send`, `on('message')` with parsed JSON, `on('status')`,
  `status()`, `hasOpened()`, `close(isLeaving)`, `hasLeft()`). A listener attached then sees every
  frame, and several listeners can share the socket.
- **Closing the dialog leaves the room unless a race socket is live.**
  Otherwise this player's ready mark would stay for the API's minute and
  the host could start a race with someone who is gone. While a race
  socket is live (not closed, not offline) closing keeps the room and the
  socket, because the race closes this dialog to play (any open dialog
  holds the game). The
  explicit "Выйти из комнаты" button leaves in any state. An answer that
  comes back after the dialog closed does not act: a room created
  meanwhile is left at once, without the portrait host's level choice,
  and a join still out at the close is left once it answers, not in
  parallel, because the API could handle the leave first and then add a
  not-ready member who blocks Start until the sweep.
- **This player is found by the `you` mark.** The room object marks the
  caller's own entry with `you` (contract section 7), and guests may share a
  nick, so matching by nick and kind could pick the wrong entry. The lobby
  now uses `you` for the own ready mark, for being host and for being in the
  room at all. Joining one's own room answers 200 even when it is full or
  not in the lobby, so a reload on `#room=<id>` shows the room with no
  special case.
- **A member the API swept is joined again, once.** The API drops a lobby
  member it has not seen (a room request that lists the player, or a
  heartbeat) for 60 s, on that member's own next request. A host who hides
  the tab to send the invite from a messenger would otherwise lose the
  room and the link with it. The rules as they now are:
  - **What counts as seen.** Only a room answer that lists this player
    (`you`) sets the client's `lastSeen`. A heartbeat does not: the API
    answers 204 even when it has just swept the player, so a visible tab
    back from an outage of over a minute would take the 204 for proof,
    and the next poll would end the room view instead of joining again.
  - **When to join again.** A poll that shows the room in the lobby state
    without a `you` entry, when `lastSeen` is more than 55 s old at
    sending (the API's 60 s minus 5 s, because the client's age is about
    one round trip shorter than the server's), sends one
    `POST /rooms/<id>/join`, keeps the room and polls once more. The view
    then shows whoever is host now; in an empty room the player is host
    again, and the link already sent still works.
  - **An action that gets 404** (a swept member's `/ready`) with the same
    age joins again once instead of saying "room not found". A gone room
    answers 404 on the join too, so that message still comes. A level
    choice or Start from a swept host gets 403 `not_host`, and the poll
    that follows joins again by the rule above.
  - **A join that fails on the network** (status 0 or 5xx) keeps the room
    and shows "offline", like a failed poll. No poll goes out at once: the
    next one, 10 s later, tries the join again, so there is at most one
    join per poll. Other join answers (404, 409, 401) end the view with
    their own message.
  - **A poll answered after the tab hid again** does nothing; the room is
    kept and the next visible poll joins.
  - **Inside the 55 s** the player left in another tab (joining another
    room leaves this one), and a re-join there would pull the player back
    and forth between tabs, so the room view ends with a message. So does
    a room in `starting` or `racing` without the player, where a join gets
    409. A poll without the player right after a re-join ends the view, so
    a server that keeps dropping the member cannot turn the 10 s poll into
    a join loop.
- **Leaving never runs in parallel with a join.** Opening a link for
  another room while in a room now leaves the first room, instead of only
  forgetting it: the API checks the new room before it leaves the old one,
  so a failed join (full, gone) would otherwise leave a ghost member that
  the heartbeat keeps seen. The "Выйти из комнаты" button during a join
  does what closing the dialog does: the room goes from the screen at once
  and the leave is sent after the join answers, because the API could
  handle the leave first and then add a not-ready member who blocks Start.
- **A hint and a small fix in the room view.** A line under the room says
  that closing the lobby leaves the room, since a host who closes it to
  play while waiting would otherwise leave silently. After an own action
  answers, the level select is set from the room even when it has the
  focus (while an action is out the focused select is left alone, so a
  choice being made is not overwritten). The long comments in `lobby.js`
  are cut to the why; the interface is in `klad/README.md`.
- Tests added for each rule above, each failing on the previous version:
  the heartbeat 204 after an outage, a tap on Ready during the return poll
  (and the control that a 404 soon after the last sight still says "room
  not found"), another link while in a room, the leave button during a
  join, a join failing with 0 and with 503, a member unseen for 57 s, a
  poll answered after the tab hid again, and the busy flag for the select.
- **The shape goes with the level choice.** A new room is level 1,
  `landscape`. A host in portrait sends `/level` with level 1 and
  `portrait` right after creating the room, and every level choice sends
  the host's shape at that moment. If the host turns the phone afterwards,
  the room keeps the last sent shape until the next level choice.
- **A malformed `#room=` id sends nothing.** It is checked against
  `^[A-Za-z0-9_-]{10}$` before any request, and the lobby then shows only
  "room not found", without even the presence requests. A link opened in a
  background tab waits until the tab is visible before it joins, or the
  API would drop the new member before the first poll.
- **One request helper and one nick prompt.** `online.js` now exports its
  `request()` and, in its page half, `KLAD_ONLINE.page` (`player`,
  `refresh`, `isAvailable`, `ask`). The lobby uses `ask()` rather than
  opening the nick dialog itself, because `ask()` also ends an earlier skip;
  without that, a nick saved after a skip would be deleted again. Nothing
  else in `online.js` changed. The lobby says in its dialog that, while it
  is open and for about a minute after (the API lists a player for 60 s
  after the last heartbeat), other players see the nick, the human or
  agent choice and whether it is a guest or an account; presence and rooms
  live only in the API's memory and store nothing new, so the privacy
  notes stay as they are.
- **Text from the API is set with `textContent` only**, as on the boards;
  the invite link is built from `location.origin`, never written as a URL
  in code, so the CI grep stays as it is.

## 2026-11-13 (sixth) - The API proxy passes WebSocket upgrades through

The ghost race will run over a WebSocket at
`wss://rassimok.dev/klad/api/race/<room>`. The proxy now forwards a request
with `Upgrade: websocket` (either case) to the same upstream URL as any
other, through the same path checks and the same 404, 503 and 502 answers.
It adds the `Upgrade`, `Origin` and, if present, `Sec-WebSocket-Protocol`
headers to the usual `Content-Type`, `Accept` and `Cookie`. An upgrade whose
`Origin` differs from the origin of the request itself gets 403
`{"error":"forbidden_origin"}` with `Cache-Control: no-store`, and the API
is not called. Requests without the upgrade behave exactly as before.

Status: a spike. The unit tests pass against a fake `fetch`. Whether Pages
Functions really carry the socket is **not yet verified**: the production
check (Chrome and Safari echo through `/klad/api/race/echo`) waits for the
API's echo endpoint (RAS-29) to deploy. The result goes here when it is
known.

### Decisions worth not relitigating

- **Same origin for the socket too.** `wss://rassimok.dev/...` should match
  the game's `connect-src 'self'` in current browsers (Safari from 16, per
  the W3C issue thread; the production check confirms it), so the CSP stays
  as it is, and the session cookie stays first-party. A direct
  `wss://api.rassimok.dev` would need a CSP change, and a ticket in the URL
  because the cookie would be cross-site.
- **The proxy checks `Origin`.** WebSockets have no CORS: any page can open
  one to any host, with that host's cookies as far as `SameSite` allows (a
  page on a same-site subdomain gets even `Strict` ones). The
  exact string compare means a missing Origin, `null`, `http:`, a trailing
  slash, a port or a subdomain is refused too. The browser's own `Origin`
  then goes on unchanged, so the API checks it as well (RAS-29); the proxy
  never sets one itself.
- **The 101 is returned untouched.** `fetch` with `Upgrade: websocket`
  gives a 101 Response whose `webSocket` is the upstream socket, and
  returning that same object is what proxies the connection (Workers
  `Response` docs: "a WebSocket connection proxied through a Worker").
  Rewriting such a response into a new Response throws in workerd ("status
  codes in the range 200 to 599", workerd issue 3047, still open), so
  nothing may wrap or rebuild it. The known risk is workerd issue 7312:
  intermittent "Network connection lost" after a 101 on Pages, reported for
  a Worker that serves the socket itself, not one that proxies it.
- **Few headers.** Cloudflare's WebSocket example sets only `Upgrade`; the
  runtime adds `Sec-WebSocket-Key` and the rest of the handshake. So the
  proxy does not copy `Connection`, `Sec-WebSocket-Key`,
  `Sec-WebSocket-Version` or `Sec-WebSocket-Extensions`; each side of the
  proxy negotiates its own. `Sec-WebSocket-Protocol` goes on so a later
  subprotocol would reach the API.
- **The upgrade's Origin must equal the request's own origin**
  (`new URL(request.url).origin`). The page that opens the socket is served
  by the same host as the Function, so no site origin is written in code:
  no URL literal and no split string to get past the CI grep (an earlier
  version of this ticket split `'https:' + '//rassimok.dev'`, which worked
  around the guard and was removed). A preview host passes the proxy but the
  API, which still checks the exact production origin, refuses it. The
  tests send upgrades to a `ws:` URL (a `test:` URL has no origin, and the
  CI grep only looks for `http:` and `https:`) and cover a foreign Origin
  and a missing one, both 403 with no fetch.

## 2026-11-13 (fifth) - Klad accounts: sign-up and login by emailed code

The boards dialog gains an "Аккаунт" part. A guest, or a browser with no
player, enters an email, gets a 6-digit code (`POST /login/code`) and logs
in with it (`POST /login/verify`). A new account is the guest itself;
logging in to an existing account moves the guest's results into it when
both have the same kind. An account shows its email (only to itself) and
its kind, can rename, log out (`POST /logout`) and delete itself, email
included. The boards mark every nick `гость` or `аккаунт`. Both footer
notes, the login part and the README now say that an account also stores
its email, that a code request keeps only a hash of the address (with the
hashed code until the code is used, replaced or expires, and with the
request time for the limits for a day, outdated records deleted with the
next code request, because nothing runs between requests), that the address itself is
stored only once a login creates or opens an account, that the server mails
nothing but login codes, and that an account can be deleted from any device
after a login. The nick prompt says the same in short; the meta description
says only that an account stores an email and a code request a hash. Built
against the shared contract (sections 1, 3, 5, 6). This change merges, and
so deploys, only after RAS-23 and RAS-24 are live on production: before
RAS-23 every login fails, and with RAS-23 alone account nicks are not
reserved yet and a guest of the same kind is left behind instead of merged,
so the login note would promise what the API does not do.

### Decisions worth not relitigating

- **In the boards dialog, not a dialog of its own.** One dialog open at a
  time keeps the hold rule in `klad.js` as it is, and the login sits next
  to the nick it turns into an account. The login part shows only for a
  guest or no player: an account logs out first, because switching from
  one account to another is not in the contract.
- **The code is checked against the address it went to.** The logic half
  keeps that email in memory, so editing the field after "Получить код"
  cannot send a valid code with the wrong address.
- **What the result says.** `merged: true` says the guest's results moved.
  `merged: false` with a guest of another kind says why (the kinds differ)
  and that the guest stays under its own nick. With a guest of the same
  kind it says "the results of nick X stayed with it", which is true for a
  sign-up (the guest became the account) and for a login against an API
  that does not merge yet; the contract does not say which `merged` a
  sign-up returns. Without a guest it says only that the login worked.
- **A guest of another kind is left behind, and the login part warns before
  it happens.** After such a login the browser's cookie belongs to the
  account, so the old guest's nick and results stay on the boards and can
  no longer be deleted from any browser. The note says so before the code
  is entered, with the way out: delete the guest first, then log in (an
  existing account needs no guest).
- **A code request stores a hash, not the address, and only codes are
  mailed.** The review found that code requests would leave addresses on
  the server for people who never signed up, someone else's address too,
  since anyone can type one. So before an account exists the API keeps no
  address (decided 2026-11-13 after the review, contract section 5): a
  code request keeps the address's SHA-256 with the hashed code until the
  code is used, replaced or expires, and, for the limits (three codes an
  hour per address, 80 mails a day), the hash and the time for a day
  (outdated rows go with the next code request). The address itself is stored only when a login creates or opens an
  account. Every privacy note says exactly that, at its own length. They
  say hash, never anonymous, because the hash of a known address can be
  matched, and they speak only for the game's server: the mail service
  still gets the address to send the code. The notes still say nothing is
  stored before a nick or an email, because a code request is the first
  thing that stores a hash. The notes (all but the meta description) and
  the README also promise that the server mails nothing but login codes; a
  later mail (a login alert, a deletion notice) means changing them first.
- **A login is read back, as a new nick is.** After a 200 from verify the
  game asks `GET /players/me`. No player there means the browser dropped
  the account's cookie, so the dialog says cookies look blocked instead of
  "Вы в аккаунте", and, as after a nick, no further `POST /players` goes
  out: that player could not be deleted from this browser. A network
  failure on the read-back keeps the account, as it does for a nick.
- **A login ends a skip.** Logout and delete count as a skip, so the page
  does not ask for a nick again; a person who then logs in has not
  declined one, so later results send and, if the session is lost, prompt
  again.
- **`no_session` keeps the code.** It means no account exists for the
  email and the browser has no guest; the dialog asks for a nick through
  the existing prompt and then for the same code again. The prompt closes
  the boards, so the text says to open "Таблицы" again before "Войти";
  the code field keeps the code meanwhile. If the API used the
  code up, the retry answers `invalid_code`, which asks for a new one, and
  one of the three codes an hour is not spent for nothing. `nick_taken`
  (rename, then a new code) and `too_many_attempts` (the code is gone) do
  need a new code, as the contract says.
- **One request at a time.** Code, verify and logout share the guard that
  rename and delete already had: a double click on "Получить код" would
  spend two of the three codes an hour.
- **Logout works like delete on the page.** No player, nothing waits, and
  the page does not ask for a nick again until a new login; the dialog
  offers a nick or a new login. 401 on logout says only that this browser
  has no nick on the server.
- **Inputs.** The email is `type="email"` with `autocomplete="email"`. The
  code is `type="text"` with `inputmode="numeric"`,
  `autocomplete="one-time-code"` and a pattern of 6 digits with optional
  spaces around them, and it is sent trimmed, as a string of exactly 6
  digits: `type="number"` would drop a leading zero. It has no
  `maxlength`: the pattern already caps the length, and a code pasted with
  a space in front would lose its last digit and then fail the pattern
  before the trim could run. Text fields and
  selects in the dialogs are at least 16px, because iOS Safari zooms into
  smaller ones.
- **Where results are announced.** Login answers go to a status line in
  the login part (`role="status"`, `aria-live="polite"`). A successful
  login hides that part, and text in a hidden live region is not read, so
  that message goes to the note above it, and the focus moves to the nick
  field. After logout or delete the email line is emptied and the login
  forms are reset, so the address does not linger in a hidden node.
- **The account marker is a word**, `аккаунт`, like `гость`, shown only
  when `guest` is `false`, so a screen reader reads it as text. An
  `aria-label` on a span is not reliably announced.
- **Delete keeps one button.** The confirmation names the email for an
  account, and the privacy notes point to the same button for both.

## 2026-11-13 (fourth) - Klad goes online: nick prompt, results and boards

New `klad/online.js`, loaded after `klad.js`, connects the game to its API
through `/klad/api`. It listens for `klad:clear` and `klad:run`, asks for a
nick at the first result, sends clears and runs (a run only when it started
at level 1), and shows the boards: records, fastest clear and most chests
per level and shape, and chests over all levels, each for humans or agents.
The boards dialog also changes the nick and deletes the nick and every
result (`DELETE /players/me`); the footer's privacy notes and the README say
so. The page gains two `<dialog>` elements, a "Таблицы" button in the HUD
and a short notice line on the stage. `klad.js` holds while a dialog is
open, and Space or Enter on a focused HUD button now presses the button.

### Decisions worth not relitigating

- **The nick prompt opens at the first result, not on load.** Nobody wants
  a form before the first move, and the privacy note can honestly say that
  nothing is stored until a nick is picked. The result that triggered the
  prompt, and any that follow while it is open, wait in memory and are sent
  once the nick is saved. Skipping drops them and the game does not ask
  again on that page; the boards dialog has "Выбрать ник" for a change of
  mind. A reload loses waiting results, which is the price of no storage.
- **A skip always means no nick.** A slow save is likely (the database
  wakes up in 2 to 3 s), so while the nick is being saved the prompt says
  "сохранение...", both buttons are off and Escape is held back. A repeated
  Escape cannot always be held back, so closing the prompt counts as a skip
  until `choose()` returns: it checks for one when the answer arrives and
  again after the waiting results are sent (or the new player is read
  back), and then deletes the player it created (`DELETE /players/me`,
  which also removes results already sent). After `already_signed_in` the
  player belongs to another tab, so this page only forgets it; results it
  already sent stay with that player. If the
  delete fails, a notice says for 20 s, not 6, that the nick may have been
  kept and that results may be recorded under it until it is deleted in the
  boards. A boards visit reads the player again and shows it with the
  delete button, and from then on results go out under it; after a reload
  the skip is forgotten too, because nothing is stored. Retrying the delete
  when the boards find the player was left out: if it failed again, the
  boards would show no nick and no delete button.
- **One rename or delete at a time.** A second click on "Да, удалить"
  during a slow request sent a second `DELETE`, whose 401 could arrive last
  and replace "Ник и результаты удалены." with a vaguer line. While one
  request runs, the dialog ignores further clicks and says "удаление..." or
  "сохранение...".
- **No storage in the browser.** The API's HttpOnly cookie is the only
  identity, so `online.js` cannot see it; it calls `GET /players/me` on load
  instead. Only 401 means "no player yet". Any other answer (404, as
  production gives until the API is deployed, 502, 503, a page that is not
  JSON) or a network failure means the API is unavailable: no prompt,
  results dropped, the game plays as before, and the boards say so. Opening
  the boards asks again, so the game recovers without a reload.
- **Answers.** 401 on a send: the player is gone (expired or deleted
  elsewhere), so the result goes back to waiting and the prompt opens again.
  A 401 right after creating the player means the browser blocks cookies.
  The waiting results show it or, with nothing waiting, one read of the
  player does. The prompt says so, counts as a skip and keeps "Сохранить
  ник" off for the visit, and no further `POST /players` is sent, because
  each would make a player this browser can never delete. 401 on a rename
  or a delete says only that this browser has no nick on the server any
  more: 401 means no valid session, not that the nick is gone. 409
  `already_signed_in`: this browser already has a player, so it reads that
  player and sends the waiting results. 429 and 400 drop the result with a
  short notice, no retry. Sends never block or stop the game.
- **Any open dialog holds the game.** `klad.js` checks for `dialog[open]`
  instead of listening for a new event, so there is no extra contract
  between the two scripts and nothing to get out of step. While held, play
  switches to the pause screen, the intro, clear and death timers stop, and
  game keys are ignored, so Escape, Space and Enter belong to the dialog.
  After closing, the game stays paused until P or fire.
- **`T` opens the boards** ("таблицы"); it was the free key nearest the
  meaning, and the title screen lists it. Like the other keys it is read by
  `e.code`, so it is the same physical key on a Russian layout. Touch
  players use the HUD button.
- **Space and Enter on a HUD button press the button.** The game took them
  as fire even on a focused HUD button, which made the new button unusable
  from the keyboard; the sound button gains the same fix. The touch-pad
  buttons are left out: they react to pointer events only, so on them the
  keys still play.
- **Deletion is promised for this browser only.** The privacy notes say the
  nick and results can be deleted from this browser while it keeps the
  game's cookie, not "at any time": deleting needs the session, and after a
  closed private window, cleared cookies or 90 days away nothing is left to
  show who is asking.
- **The boards' status line ends on "готово"**, not empty, so a screen
  reader hears that the tables arrived, also after each switch.
- **Focus goes back to the field after a dialog closes**, as after the sound
  button, so the next Space fires instead of reopening the boards.
- **Native `<dialog>` with `showModal()`** gives the focus trap, Escape and
  an inert page for free. Forms are handled in script with
  `preventDefault`, because the CSP has `form-action 'none'`.
- **Delete asks first, in the dialog**, with "Нет" focused, rather than
  `confirm()`, which a browser may suppress.
- **Nicks are other people's text.** Every board cell is built with
  `textContent`; nothing from the API goes through `innerHTML`.
- **One file, two halves.** The logic half has no DOM and assigns
  `module.exports`, like `levels.js` and `ticks.js`, so `node --test` covers
  request shapes and every answer above with a fake `fetch`. The page half
  runs only in a browser. A single script tag keeps the CI rule simple.

## 2026-11-13 (later still) - Klad counts engine ticks and reports clears and runs

`klad.js` counts fixed 1/120 s update steps per level attempt and dispatches
two events on `document`: `klad:clear` `{level, shape, revision, ticks,
chests, chestsTotal}` when a level is cleared and `klad:run` `{fromLevelOne,
levelsCleared, score, ticks}` at game over or after the last level. Nothing
is sent or shown yet; the leaderboard tickets listen for the events (shared
contract, section 6). New `klad/ticks.js` holds the formatter
(`KLAD_TICKS.format`, `m:ss.cc`) and `MIN_CLEAR_TICKS`; every level in
`levels.js` has `revision: 1`. `klad.js` also ignores keydown events whose
target is an input, textarea or select.

### Decisions worth not relitigating

- **Ticks, not wall time.** The counter increments only inside the play
  phase of `tick()`, so pause, menus, the title and death screens, tab
  switches and frame rate do not matter: the same play gives the same number
  on any machine, which a leaderboard needs. The counter restarts in
  `intro()`, so a death starts the level's attempt from zero; the clear
  result is the attempt that reached the exit.
- **`revision` per level.** A layout edit changes what a fast time means.
  Bump the level's `revision` whenever either shape changes, so the board
  can keep old and new times apart. `levels.test.js` requires it.
- **A run "from level 1"** is one that began at level 1 (`startGame(0)`:
  the title with level 1 selected, or restart after game over or a win). A
  start from the URL hash or a digit key is not. Run ticks add up every
  play-phase step of the run, failed attempts included, since the run is the
  whole session of lives.
- **Time formatter in its own file.** `klad.js` is a DOM-touching IIFE node
  cannot require, and `levels.js` exports the level array. `ticks.js` follows
  the `levels.js` dual-export pattern and loads with an exact script tag.
- **API floor.** `MIN_CLEAR_TICKS = 600` (5 s) mirrors the API. A test
  computes the cheapest key-then-exit route per layout from the movement
  speeds (walk 24, climb 26.7, fall 13.3 ticks per cell, no shooting) and
  requires it above the floor. Today the fastest are 1238 ticks (level 4
  landscape) to 1848 (level 3 landscape). Shooting through a brick could
  shorten a route, so the figure bounds unshot play only.
- **Typing guard on keydown only.** Keyup still releases movement keys, so
  a key held while focus moves into a field cannot stay stuck.
## 2026-11-13 (later) - The game's API through the site's own origin

`/klad/api/*` now reaches the game's API. A Cloudflare Pages Function,
`functions/klad/api/[[path]].js`, forwards each request to the origin in the
Pages variable `API_ORIGIN`, with the `/klad/api` prefix removed and the
query string kept, and returns the API's answer unchanged; the API's own
Quarkus endpoints under `/q` are not forwarded. `_routes.json` limits
Functions to `/klad/api/*`, and the `/klad/*` CSP gains
`connect-src 'self'`. Nothing calls the proxy yet; the game's online code
comes in a later change.

The privacy promise changes with it, in the README, the klad footer (plus a
short Russian privacy note) and the klad meta description: no analytics and
no tracking; once a player picks a nick, the API stores the nick, whether
they play as a human or an agent, and the results (accounts will add an
email); one HttpOnly cookie, for the game's API only. Still no localStorage,
and the home page still ships no JavaScript and sets no cookies.

### Decisions worth not relitigating

- **Same origin, not a cross-origin call.** The CSP gains only
  `connect-src 'self'`. The API's address lives in a Pages variable, so the
  `.js` URL check in CI needs no exception. The session cookie is
  first-party with `Path=/klad/api`, which avoids Safari's reported 7-day cap
  on cookies from a server whose IP differs from the site's, and there is no
  CORS to get wrong. The price: one more hop through Cloudflare, Function
  requests count against the Workers free quota, and the site is no longer
  purely static, since this Function is server-side code outside `klad/`.
- **No secret between proxy and API.** The API is reachable on its own
  anyway, so a shared secret would only prove that a request came through the
  proxy. That protects nothing the API's per-player limits do not already
  cover, and it would be one more secret to store and rotate.
- **An explicit `_routes.json`.** Pages generates a routes file from
  `functions/` when there is none, but its docs also say that once a project
  has Functions, every request invokes them by default. The explicit file
  removes the doubt and keeps the scope under review: static requests never
  run the Function and never count against the free daily quota.
- **Three headers only.** The proxy forwards `Content-Type`, `Accept` and
  `Cookie`. Requests reaching it also carry the visitor's IP address in
  Cloudflare's headers (`CF-Connecting-IP`, `X-Forwarded-For`), the user
  agent and the referrer, and the API needs none of them; passing everything
  on would hand them over. What Cloudflare itself adds to the outgoing
  request is outside the proxy's control, so the public text promises only
  what the proxy forwards.
- **A prefix check, then concatenation, not resolution.** The Function first
  answers 404 unless the parsed path is `/klad/api` or starts with
  `/klad/api/`. Without it, cutting off nine characters turns
  `/klad/api@other.host/x` into `@other.host/x`, and glued onto `API_ORIGIN`
  that changes the host. Parsing also resolves dot segments, `%2e%2e`
  included, so `/klad/api/%2e%2e/%2e%2e/aaaaaaaa@other.host/x` does the same.
  `_routes.json` and the Pages router should never send such a path, but the
  Function does not rely on them. After the check it concatenates:
  `new URL(path, API_ORIGIN)` would read a path such as `//other.host/x` as a
  new host. Together the check and the concatenation keep every request on
  `API_ORIGIN`, so the Function cannot become an open proxy; the tests assert
  the forwarded host for each path case, and that off-prefix paths make no
  fetch.
- **Quarkus's `/q` endpoints stay off the site origin.** The API serves its
  health checks (and, in dev mode, the dev UI) under `/q`, and the readiness
  answer can carry a database error message. The game needs none of them,
  and the deploy check calls them on the API's own address, so the Function
  answers 404 for `/klad/api/q` and everything under it, before any fetch.
  The check runs on the parsed path, where dot segments are already
  resolved, and on the percent-decoded rest of it, with any number of
  leading slashes and either case: the API's server (Vert.x) decodes `%71`
  to `q` and reads `//` as `/`, so a plain `startsWith('/q/')` would let
  `/klad/api/%71/health/ready` and `/klad/api//q/health` through. `q;x`
  counts as `q` as well, since a server may read `;` as the start of path
  parameters. A path that
  does not decode (`%zz`, or `%ff`, which is not UTF-8) is refused the same
  way; the API has no path parameters, so no real request looks like that.
  The raw path, not the decoded one, is what gets forwarded.
- **`redirect: 'manual'`.** A redirect from the API comes back as it is,
  instead of being followed inside the Function.
- **Proxy errors use the API's error shape.** A path that is not `/klad/api`
  or under `/klad/api/`, or that is under `/klad/api/q`, gives 404
  `{"error":"not_found"}`, `API_ORIGIN` unset 503
  `{"error":"not_configured"}`, an unreachable API 502
  `{"error":"upstream"}`. All three carry `Cache-Control: no-store`, and the
  tests check it. There is no fallback address: a deploy without the
  variable, such as a branch preview before it is set there, answers 503
  rather than guessing.
- **`_headers` does not cover `/klad/api/*`.** Pages never applies `_headers`
  to responses from Functions, so those responses carry only the API's own
  headers, and the API owns them. The game page's CSP is unaffected.
- **"No logs I own" is gone from the README.** The API runs on Cloud Run,
  which keeps standard request logs; once the game calls it, the claim would
  be false.
- **The proxy test uses `test:` URLs.** Only the path and query matter to the
  proxy, and the CI grep rejects any `http://` or `https://` in a `.js` file,
  tests included. A non-http scheme says so openly instead of assembling a
  URL string to slip past the grep.
- **The home page copy is unchanged.** It still says "no cookies", which
  stays true: the game's cookie is scoped to `/klad/api`, and the home page
  sets none.
- **Phones still hide the footer, privacy note included.** Short portrait
  screens and touch screens in landscape have kept the room for the field
  since 2026-10-30. Where the footer shows, it is now a few lines taller,
  and the tile size pays for that. Nothing is stored before a player picks
  a nick, so the screen that asks for the nick must show the note, on every
  device. The Russian note is not folded into a `<details>`: the game's key
  handler takes Space and Enter on the whole page and cancels their default
  action, and opening the note would change the stage height without
  refitting the canvas. Both would need changes in `klad.js`.

## 2026-11-13 - Agent instructions moved out of the repository

`CLAUDE.md` is removed, and its CODEOWNERS entry with it. Agent instructions
for this site now live outside the repository, in a private workspace that
holds every rassimok-dev project, so one set of rules covers all of them and
a stale copy on an old branch cannot compete with it.

### Decisions worth not relitigating

- **Do not re-add a `CLAUDE.md` or `.claude/` here.** CI remains the
  enforcement for the hard rules (no JavaScript on the apex, no third-party
  requests); the instruction file was only ever a reminder of them. A cloud
  agent session that sees this repository alone gets no instructions, and
  that trade was accepted.

## 2026-11-12 - CI check tools pinned

`html-validate` is pinned to 11.17.0 and `linkinator` to 8.1.0 in
`.github/workflows/ci.yml`. Both checks passed with these versions locally
on Node 24.22.3, along with the level tests.

### Decisions worth not relitigating

- **Pinned, not `latest`.** `npx --yes <tool>` downloads and runs whatever
  version was published last, on every CI run and every local check. That is
  code nobody here has reviewed, executed with the repository checked out.
  A pin makes upgrading the tools themselves a deliberate change. Their own
  dependencies still resolve fresh on each run: locking those would need a
  `package.json` and lockfile, which the site deliberately does not have.
- **Pin to a release that has been out for a while.** When these pins were
  chosen, html-validate had published 11.21.1 that same day; 11.17.0 was the
  newest release at least two weeks old. A fresh release is where a
  compromised publish would surface, so let it age before adopting it.

## 2026-10-30 (later still) — Game feel: no selection, no wall deaths, beeper sound

Three changes from the first rounds on a real phone.

- **The play area is not selectable.** A drag that starts on the field, or
  a long press on the pad, used to highlight the HUD and buttons. `user-select:
  none` on the HUD, stage and pad, `-webkit-touch-callout: none`, and
  `touch-action: none` on the canvas. Footer text stays selectable.
- **A regrowing wall never kills the player.** If you are standing in the
  gap when the timer runs out, the hole stays open, flickering, and seals
  the moment you step out. Lode Runner kills you here; the original's
  behaviour is undocumented and dying to a timer you cannot see felt
  arbitrary. Guards are still walled in, which is the whole point of the
  mechanic.
- **Sound, Korvet style.** The ПК-8020 had a 1-bit beeper, so every effect
  is a square wave synthesised at the moment it plays: shot, hole, chest,
  key, extra life, walled guard, death, level clear, level start. No audio
  files, nothing to download, nothing to license. The AudioContext is
  created on the first key or tap, as browsers require. `M` or the HUD
  button mutes; the choice is not remembered, because the site stores
  nothing. Verified on the live preview that the strict
  `Permissions-Policy: autoplay=()` does not block Web Audio after a
  gesture, so `_headers` is untouched.

## 2026-10-30 (later) — КЛАД is playable: five levels at /klad/

The game the title screen has been promising. Five levels, each in two
shapes (landscape 24×16, portrait 16×24) picked from the device orientation
when a level starts, keyboard on desktop, a touch pad on phones. Rules follow
the original as far as sources describe it; see `klad/MECHANICS.md`.

### What was learned about the original (and corrects earlier notes)

- The "five stages then it cycles" claim belongs to the Фотон arcade
  version, not the Korvet. The Korvet game repeated the MSX original's
  gameplay and level design; Onliner remembers 25 labyrinths, the MSX had 20.
  Five levels is **our** scope.
- Guards are not killed by being walled in. On the MSX they die only by
  falling into water, then respawn at their start. A walled-in guard just
  stays stuck, which is exactly why «замуровать чертика» was the trick.
- The shot travels any distance and removes the first breakable wall it hits;
  the wall regrows after a while. Shots never harm guards. Planks hold you
  when you walk on, drop you when you land on them. No jumping, no digging.

### Decisions worth not relitigating

- **One folder, deletable in one go.** Everything lives in `klad/`, with
  `klad/README.md` listing the four places outside it that reference it.
  The apex keeps its zero-JS claim; the footer now says so precisely.
- **Path-scoped CSP with a detach.** `_headers` gets a `/klad/*` block that
  first removes the site-wide `Content-Security-Policy` (`!`) and then sets
  one with `script-src 'self'`. Without the detach both headers are sent
  and both enforced, and the apex policy has no `script-src`, so the game
  would stay blocked. Verify on the live response, not the file.
- **Vanilla JS, canvas 2D, procedural 8×8 sprites, no storage.** Resume is
  the URL hash (`/klad/#3`); `localStorage` would break the "collects
  nothing" promise for a convenience. Palette comes from CSS variables so
  the game and the site stay one system.
- **Guards path with BFS and believe planks always hold.** Physics says
  otherwise. That asymmetry is the whole of level 4 ("обмани хранителя")
  and costs nothing. Guards avoid water in their planning but fall into it
  when a plank gives way.
- **Hole timing.** A hole stays open 4.2 s and flickers for the last
  second. A guard that falls in climbs out after 3.6 s if the hole is still
  open, so only a guard that drops in within half a second of the shot
  escapes; the rest get walled. A player caught in a regrowing wall dies, as
  in Lode Runner. Shooting a brick with a stuck guard inside frees it.
- **Guard speed ramps per level** (3.0 to 3.9 tiles/s against the player's
  5) so level 1 teaches the trap without a guard on your heels, and the
  "outrun" level is the fast one.
- **Two shapes per level, chosen at level start.** Rotating mid-level keeps
  the current shape until the next level; swapping a map under a running
  player is a bad experience and a source of bugs. Desktop always gets
  landscape.
- **Level validator in CI.** Hand-drawn maps broke four times out of ten on
  the first pass, every time in a boring way (a ladder ending under a brick
  ledge, a ledge walling off the only corridor, a one-tile gap in a ladder).
  `klad/test/levels.test.js` checks a key-then-exit route without shooting,
  which is conservative: shooting only ever opens more routes.
- **Footer hidden on short portrait phones.** A phone in portrait has about
  660 CSS px to work with; the footer cost a third of the playfield. The
  same credit is one tap away on the home page.
- **Fire left out.** Sources list it as a hazard but nobody describes its
  behaviour. Levels 1–5 use water, planks, bricks and guards only.
- **Unreachable chests are allowed, one per map.** The Korvet version had
  them as a joke; the validator permits at most one so a typo cannot hide
  behind the tradition.

## 2026-10-30 — Attract mode: the title screen moves

The landing page now plays like a cycled title "video": the tube powers on,
the status line and КЛАД wordmark draw themselves in, and a reel of five
title cards (who / builds / now / next / rules) loops for as long as the
page is open, with a block-character progress bar and a one-glyph runner.
The CV copy still sits below the rule, and a `Next` section was added so the
static text says everything the reel says.

### Decisions worth not relitigating

- **It is CSS, not JavaScript.** The brief said "JS or something you know
  better". A looping title sequence is timed frames, and `@keyframes` with
  `steps()` does that natively, so the apex keeps its zero-JS claim, the
  CI guard, and the CSP with no `script-src`. The earlier decision that JS
  lives only under `/klad/` stands. A `<video>` file was also rejected: it
  would need `media-src`, `Permissions-Policy` already sets `autoplay=()`,
  and it would weigh more than the rest of the site combined.
- **Base styles are the final frame; keyframes supply only the start.**
  If animations are unsupported, disabled, or reduced, nothing is missing
  because nothing's resting state is hidden. The one exception is the reel,
  whose cards are stacked and hidden by default; `prefers-reduced-motion`
  lays them out as a static list instead. Don't "fix" this by hiding
  content with `display: none` in a keyframe.
- **The reel is `aria-hidden`.** Five absolutely-positioned paragraphs
  flickering in and out would be read as overlapping gibberish. Every fact
  on a card also appears in the copy below, so screen readers lose
  nothing. If a card gains a fact, the copy must gain it too.
- **Card timing is a 20 s deck, 4 s per card, delays as slots.** Each card
  runs the same 20 s animation offset by its position, so adding a sixth
  card means a 24 s deck and five delays to adjust, not a new keyframe.
  The progress bar fills once per deck, which makes it the reel's position
  indicator rather than decoration.
- **The runner is one glyph flipped with `scaleX(-1)`.** Animating
  `content` is still discrete-only and uneven across engines; a mirrored
  `▚` reads as a stride and costs nothing.
- **Size:** `index.html` 2.9 KB, `style.css` 8.7 KB uncompressed, zero new
  requests. That is past the original "few kilobytes" aspiration; the
  reasoning is that HTML and CSS together are about 4.5 KB gzipped, and that the motion is the point of this revision.

## 2026-09-16 (later still) — КЛАД-3 title screen

The landing page is now a Korvet CRT screen: block-letter КЛАД wordmark,
phosphor palette, scanlines, blinking caret. The real CV content lives inside
the screen rather than being displaced by it. `RAS-11`.

### What the game actually is, and the rights position

«Клад» is a platformer in the Lode Runner mould, not a top-down maze: you
climb out of a dungeon collecting treasure chests, avoiding the little men
guarding them, and avoiding water and fire. You cannot dig. You *can* shoot
left and right, which temporarily clears certain wall types. Some floor types
drop you through. Some chests hold a key for a locked door, some an extra
life. Level counts differ between sources (20, 25 and 80 all appear) — settle
this against the real thing before building levels.

The lineage matters for the rights question:

- The Korvet version is credited to **Д. Иванов and А. Шаталов**, with two
  sequels — consistent with a `КЛАД-3` in a school lab. Other machines had
  entirely separate authors: the БК-0010 `Клад-2`/`Клад-3` (1988) were
  Баранов Д.Г.'s, so "Клад-3" names several unrelated programs.
- All of them are unlicensed clones of **ライズアウト / Rise Out** (ASCII
  Corporation, 1983, written by Hibiki Godai) for the MSX.

So the thing being recreated is itself a copy, and nothing in the chain is
public domain: ASCII's 1983 work runs to roughly 2053 under Japanese
corporate-authorship terms, and the Soviet versions are life+70 under Russian
and Ukrainian law with named, recent authors.

**Hence: clean-room homage, never a port.** Game mechanics, rules and systems
are not copyrightable — only concrete expression is. Our own code, our own
art, our own level layouts, with the lineage credited on the page, is on solid
ground. What would not be: shipping an original binary or ROM, ripping sprite
sheets or level data, or presenting the page as *being* `КЛАД-3`. «Клад» is
also just the dictionary word for "treasure", so there is no meaningful
trademark exposure in the name.

The name stays Cyrillic because it genuinely was: the Korvet game was
«Клад». The English name belongs to the Japanese ancestor, not to it.

### Decisions worth not relitigating

- **The playable game will live at `/klad/`, not on the apex.** A real КЛАД
  needs JavaScript — keyboard movement, a turn loop, a timer. CSS-only games
  are `:checked`/`:target` state machines, and a grid crawler with an
  inventory explodes combinatorially, so this is JS or it is not the game.
  Putting it behind a path means `_headers` can grant `script-src 'self'` to
  `/klad/*` alone and the apex keeps its zero-JavaScript claim, footer line
  included. Two alternatives were rejected: `klad.rassimok.dev` as a separate
  Pages project (stronger isolation, but a new repo, project and CNAME buy
  nothing here), and making `index.html` itself the game (most literal
  reading, but it spends the site's strongest claim).
- **The screen is dark in both colour schemes.** A CRT has no light mode.
  Fixing the palette also makes the contrast ratios provable rather than
  theme-dependent: 13.9:1 for body text, 8.1:1 for dimmed, 12.6:1 for links.
  The page chrome around the screen still follows `prefers-color-scheme`.
- **Block characters, not a Korvet ROM font.** An authentic `@font-face`
  would have to be self-hosted, and the CSP has no `font-src`, so it falls
  back to `default-src 'none'` and the font is blocked. Loosening the header
  for decoration is exactly the trade the rules say not to make.
- **The wordmark is generated, not hand-aligned.** Hand-editing it once
  produced rows of unequal width that `awk` hid by counting bytes rather than
  characters — `█` is three bytes in UTF-8, so every row looked wrong by a
  different amount. Regenerate it from per-glyph rows if it ever changes.

## 2026-09-16 (later) — Live

`rassimok.dev` and `www.rassimok.dev` serve from Cloudflare Pages. All eight
security headers verified on the live response, not just in CI.

### Two failures worth remembering

- **Attaching a custom domain via the Pages API left it `pending` and did not
  write the DNS records.** The dashboard normally does this implicitly. Fix was
  to create the CNAMEs directly (apex and `www` → `rassimok-dev.pages.dev`,
  proxied); the domain flipped to `active` within a minute.
- **The apex appeared dead locally while `www` worked.** That was a stale
  negative DNS cache: `rassimok.dev` had been queried repeatedly before any
  records existed, so `systemd-resolved` had cached NXDOMAIN. `www` had never
  been queried, so nothing was cached. Every public resolver was correct the
  whole time. `resolvectl flush-caches` fixes it. If a hostname fails locally
  but a sibling on identical records works, suspect the cache before the config.

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

- Commits are **SSH-signed** with `id_ed25519`, registered on GitHub as a
  signing key. Signing was deliberately left off until the key was
  registered: a signature GitHub cannot verify displays as "Unverified",
  which looks worse than no signature at all.

### Decisions worth not relitigating

- **The w3.org exclusion in the third-party guard is deliberate.**
  `xmlns="http://www.w3.org/2000/svg"` is an XML namespace identifier, never
  fetched. Excluding it keeps the check honest instead of teaching us to
  ignore a failing check.
- **Domain registered 2026-09-16** via Cloudflare Registrar, expires
  2027-09-16. Nameservers already Cloudflare's.
- **GitHub account renamed** `hellorassimok` → `rassimok-dev` while it had
  zero public repos, so no URLs broke. Renaming later would have.
