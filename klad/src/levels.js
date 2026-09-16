/* The level set. Eight single screens, each 32x15 characters of the charset
 * in ARCHITECTURE.md, in the order they are played.
 *
 * These layouts are original work. They are not transcribed, traced or
 * approximated from the original KLAD, from Rise Out, or from any recording
 * of either -- a level layout is the most protectable thing an old game has,
 * and this one is meant to be publishable. What is borrowed is the SHAPE of
 * the genre: one screen, ladders, no jump, a gun that only opens brick.
 *
 * Two rules every screen here is checked against, because breaking either
 * produces a level that looks finished and cannot be finished:
 *
 *   1. No route requires standing on a brick you shot. Beams travel along
 *      the shooter's own row, so a destroyed brick is always beside you and
 *      never under you -- but a brick used as a floor somewhere else on the
 *      route would come back under a player's feet after BRICK_RESPAWN_MS,
 *      or worse, fail to. Every floor on every route is SOLID.
 *   2. No one-way drop lands anywhere without a ladder out. There is no
 *      jump, so a pocket you can enter and not leave is not a hard level,
 *      it is a soft-lock -- the player would have to die on purpose, and on
 *      the early screens there is nothing to die on.
 *
 * Doors and keys obey a third rule: each screen has exactly as many CHEST_KEY
 * tiles as DOOR tiles, and every door is on the only route to something the
 * level needs. A key can therefore never be spent on a door that did not have
 * to be opened, which is the one way a key economy can dead-end a player.
 *
 * The leading and trailing newlines are an artifact of writing the grids as
 * template literals starting at column zero; level.js strips exactly one of
 * each. Rows are written to the full 32 columns so the right-hand wall is
 * visible in the source, which also keeps trailing whitespace out of the file.
 */

/* 1. Dry Run
 *
 * Nothing to shoot, nothing to dodge: walk, climb, and discover that the gap
 * in the upper floor is a one-way trip. The chest past the gap is the lesson --
 * you cannot walk back over a hole, so you go down, along, and up the far
 * ladder. Sparse on purpose; the first screen is a tutorial with no text. */
const DRY_RUN = `
################################
#                              #
#                              #
#  @    $      $       H       #
############ ##########H########
#                      H       #
#                      H       #
#                      H       #
#    $  H    $         H       #
########H#######################
#       H                      #
#       H                      #
#       H                      #
#       H     $             X  #
################################
`;

/* 2. False Floor
 *
 * Introduces FALLTHRU, which is the only tile that lies to you. The three
 * dots in the second floor read as floor and are not, and the drop they hide
 * is one-way. Every one-way drop on this screen lands somewhere a ladder can
 * climb back out of -- there is no jump, so a drop into a sealed pocket would
 * be a soft-lock, not a challenge. */
const FALSE_FLOOR = `
################################
#                              #
# @     $        $       H     #
############.############H######
#                        H     #
#                        H     #
#    H     $        $    H   H #
#####H########...############H##
#    H                       H #
#    H                       H #
# H  H    $       $          H #
##H#############################
# H                            #
# H     $        +           X #
################################
`;

/* 3. Powder
 *
 * The gun. Four corridors, each walled floor-to-ceiling with brick, each
 * traversed in the opposite direction to the one above. The walls stand in
 * the walking row, so every one of them is destroyed from the floor you are
 * already standing on -- you never have to stand on a brick you shot. */
const POWDER = `
################################
# @     $   =     $  =       H #
#############################H##
#         =        =         H #
# H    $  =    $   =      $  H #
##H#############################
# H          =        =        #
# H   $      =    $   =    $ H #
#############################H##
#        =        =          H #
# H  $   =    $   =      $   H #
##H#############################
# H                            #
# H     $        $          X  #
################################
`;

/* 4. Strongrooms
 *
 * Shooting as a way in rather than a way through. The chests sit in sealed
 * strongrooms; the only opening is the brick you blow out, and since the brick
 * regenerates you may have to shoot your way back out again. That is a delay,
 * never a trap: the floor inside every room is SOLID, so a regenerating wall
 * cannot leave you standing on nothing. */
const STRONGROOMS = `
################################
#     =  =                     #
#     =  =                     #
# @   =$$=      $          H   #
###########################H####
#                =   =     H   #
#                =   =     H   #
#   H      $     =$$$=     H   #
####H###########################
#   H        =     =           #
#   H   $    =  $  =  $ H      #
########################H#######
#  =                    H      #
#$$=     $      +       H   X  #
################################
`;

/* 5. Two Watchers
 *
 * Two guardians, and the first screen where the route matters more than the
 * reflexes. Ladders are staggered so that every tier has at least two ways
 * off it -- a guardian closing from one side can always be answered by
 * leaving from the other. The exit is the far corner from the spawn, so the
 * last chest is never next to the door. */
const TWO_WATCHERS = `
################################
#                              #
#   H   $      H    $      H  X#
####H##########H###########H####
#   H          H           H   #
# $ H   H   $  Hg     H  $ H   #
########H#############H#########
#       H  =          H =      #
#   H $ H  =  $   H   H =   $  #
####H#############H#############
#   H   =         H            #
#  $H   =  H    $ H    $g H    #
###########H##############H#####
#@   $     H       $      H  $ #
################################
`;

/* 6. Three Watchers
 *
 * Three guardians and one full-height ladder down the middle. The shaft is
 * the fastest way to anywhere and the most dangerous place to be, because
 * guardians take it too. The false floors are the escape hatches: one-way,
 * but every landing has a ladder out. The exit sits behind a brick, so the
 * level ends on a shot rather than a walk. */
const THREE_WATCHERS = `
################################
#                              #
#@ $ H   $   $  H       g   $  #
#####H##########H###############
#    H      =   H       =      #
# H  H $    =   H  $    =  H $ #
##H########..###H##########H####
# H   =         H   =      H   #
# H $ =  H   $  H   =g $   H H #
#########H######H############H##
#    =   H      H         =  H #
# $  =   H  H $ H     H   = $H #
############H###H#####H#..######
#  $    =   H   H  g  H  $  = X#
################################
`;

/* 7. Cistern
 *
 * Keys, doors and water. Two doors, two keys, and no third door to waste a
 * key on -- a key is only ever spent where it has to be. The water is a wall
 * you can see through: it cuts the bottom corridors in half, and the ladders
 * are placed so that both halves are reachable without ever stepping into it.
 * Guardians will not walk into water either, which makes the far bank cover. */
const CISTERN = `
################################
#             #          #######
#             #          #######
#@  H  $    $ # $H     $ #######
####H############H##############
#   H         #  H       #######
#   H         #  H       #######
# $ H   g H k D  H $  Hk #######
##H#######H###########H#########
# H       H   #       H  #######
# H$  H   H $ #$H H $gH H#######
######H#####H###H#H#####H#######
#     H     H # H H     H#######
# $   H ~~~ H+#$H$H ~~~$HD $ X #
################################
`;

/* 8. The Heart
 *
 * Everything at once. Fire and water fence the screen into rooms, three
 * guardians work it, and the exit sits in a vault behind the second door --
 * so the last thing you do is spend a key, and the key before it is walled in
 * behind brick. Nothing here is unavoidable: every hazard is static, visible
 * from the spawn, and has a way around it. */
const THE_HEART = `
################################
#              ######     =    #
#@ H  $    $   D  X # H g =$k  #
###H##################H#########
#  H                ^ H        #
#  H $  H   $       ^ H H $    #
########H###############H#######
#  =    H      ^        H      #
#$$=  H H k H  ^  gH $  H  $   #
######H#####H######H############
#     H  ^  H      H           #
# $ H H  ^  H   H +H  D  $  H $#
####H###########H###########H###
#  $H g ~~~~~~~ H$ ~~~~~~ $ H $#
################################
`;

/* Exported as {name, source} rather than bare strings: parseLevel takes a
 * name for its error messages, and a screen that can say "Cistern: unknown
 * tile" beats one that can only say "level 7". The name is also what a title
 * card would show. */
export const LEVELS = Object.freeze([
  { name: 'Dry Run', source: DRY_RUN },
  { name: 'False Floor', source: FALSE_FLOOR },
  { name: 'Powder', source: POWDER },
  { name: 'Strongrooms', source: STRONGROOMS },
  { name: 'Two Watchers', source: TWO_WATCHERS },
  { name: 'Three Watchers', source: THREE_WATCHERS },
  { name: 'Cistern', source: CISTERN },
  { name: 'The Heart', source: THE_HEART },
].map(Object.freeze));
