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
- 5 levels, our own layouts, same lesson order as Korvet 1-4: wall up a guard; outrun guards;
  wall up several; trick a guard; 5 = everything together.
- Level code = URL hash (no storage). Two shapes per level (landscape/portrait).
- Fire left out of v1 until behaviour is confirmed.
- A wall that regrows while the player stands in the gap waits for them to leave
  instead of killing them (Lode Runner kills; the original is undocumented here).
- Sound is synthesised square waves in the spirit of the Korvet beeper, not
  recordings of the original.
