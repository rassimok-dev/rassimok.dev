# КЛАД / Rise Out — original mechanics (reconstructed from sources, 2026-10-30)

Sources read in full: Old-Games.RU wiki «Клад»; Onliner (Korvet nostalgia article);
ameblo «ライズアウト (MSX)» player write-up; idpixel. MobyGames, GoodOldDays, Medium,
4PDA blocked by bot protection; search summaries only.

## Lineage
- Original: ライズアウト / Rise Out (ASCII, MSX, 1983/84), programmer 五代響 (Hibiki Godai). 20 stages.
- Korvet «Клад»: Д. Иванов, А. Шаталов; "repeated the gameplay and level design of the original".
  Onliner remembers 25 labyrinths. The "5 stages then cycles" claim applies to the Фотон arcade
  version, NOT Korvet (old-games wiki).

## Movement
- Run left/right, climb ladders, fall off edges. No jumping. No digging. No hanging bars.
- Trapdoor floors: a floor type you walk across but fall through if you land on it from >=1 block
  above. On MSX they look like ropes ("渡り板", planks); Korvet: "канатные мостики".

## Gun
- Fires horizontally left/right. The shot travels and removes the FIRST breakable wall block it
  hits, at any distance ("距離が離れていてもOK").
- The removed block regrows after a time; delayed/sequenced shooting is a tactic.
- Shots do NOT harm guards.

## Guards (хранители, «чертики» on Korvet)
- Chase the player. Contact = instant death, level restarts.
- How they chase (observed in a remake, 2026-11-15; the user's observation, hedged with
  "apparently", not documented for the Korvet game): straight at the player, never around.
  A guard standing directly above or below the player does not go around; it stays put.
  Our rule (2026-11-17, `chase.js`): whenever a guard reaches a tile it takes one step that
  brings it closer to the player, never one that leads away, and plans nothing further:
  - on the player's row: a step toward the player; a wall in the way -> it waits at the wall;
  - a gap in the floor ahead does not stop it: it walks on and falls (this is how a guard is
    lured into a shot hole);
  - player on another row, and a ladder step toward that row is possible (a ladder at the
    guard's tile, or one set into the floor under it when going down) -> it climbs first;
  - player on another row, no such ladder step -> it runs toward the player's column;
  - directly above or below the player with no such ladder step -> it stands still;
  - no water planning: a step toward the player is taken into water or off a ledge over
    a plank, and the guard drowns.
- Only die by falling into water; then respawn at their start position (MSX).
- Can be walled in: lure into a shot hole, wall regrows -> guard immobilised ("замуровать").
  Korvet players remember this as the core trick. Levels 1 and 3 are "wall up the guard(s)".

## Treasure, key, exit
- Chests (клады / 千両箱) scattered; some are deliberately unreachable (Korvet humour).
- One chest hides the key. Some chests hold an extra life.
- Key opens the locked door(s); beyond them the exit ladder connects to the top of the screen.
  Reaching that ladder = level clear.
- Collecting ALL chests is optional; on MSX it reveals the password for the next stage.

## Hazards
- Water: fatal to player and guards. Fire and "similar obstacles" exist (old-games wiki), no detail.

## Meta
- Lives; extra lives from chests. Score. No timer mentioned anywhere.
- MSX: CTRL+P password entry, CTRL+R restart level (costs a life).

## Our deviations (deliberate)
- Several levels, our own layouts. The lesson order follows Korvet where it is verified
  (levels 1 and 2); level 3's place is the user's choice of 2026-11-18, against the wiki's
  "Levels 1 and 3" above (Korvet maze 3 not seen); level 4 follows the remake. Lessons: find
  the way through a dense maze over deadly water, to a key whose room is held by one guard you
  must wall up first (from Korvet maze 1); shoot open treasure sealed in brick, the key too,
  while the guards come up from below (from Korvet maze 2); climb with care over a lake with no
  guard, every slip fatal (from level 2 of the remake); plan the route across planks over
  water, walking onto them and falling through one only where stone lies below, while the
  guard the key lets out falls through them and drowns (from level 4 of the remake, read from
  still frames); shoot open sealed caches beside a shaft while a guard comes down it after you,
  then run out under pens whose guards the key lets out, one door each (from level 5 of the
  remake, read from still frames). Later levels are new, each from the remake and read from
  still frames: 6, climb between tall brick columns and break through them only on the rows
  below the guards that climb level with you behind them and above the small pools at their
  feet (its level 6); 7, lead the guard away into a pit before you empty a rich treasure room
  with one way in, where it would follow you down and trap you (its level 10); 8, reach two
  treasure vaults across deadly water with the guards between them, standing where they follow
  you into the lake and dropping past their ledges while they are gone (its level 23, a Korvet
  level by the user's word).
- Level code = URL hash (no storage). Two shapes per level (landscape/portrait).
- Fire left out of v1 until behaviour is confirmed.
- Guard chase: only "straight at the player, no way around" was observed. The other cases
  (climb first, run toward the player's column, walk into gaps and water) are our reading of
  that observation, to be checked against the remake. Guards decide only on a tile, never
  mid-step, and climb as fast as the player; their walking speed is ours per level
  (from 3.0 tiles/s, set per level, against the player's 5).
- A wall that regrows while the player stands in the gap waits for them to leave
  instead of killing them (Lode Runner kills; the original is undocumented here).
- Sound is synthesised square waves in the spirit of the Korvet beeper, not
  recordings of the original.
- Ghost race (online, from the lobby): every player runs the same level on
  their own copy, the host's shape for all; the others are see-through
  ghosts with no effect on the game. In a race a death costs no life and
  there is no game over; the first finish the server receives wins.
