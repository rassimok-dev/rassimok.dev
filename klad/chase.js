/* One step closer to the player, never away, and no plan beyond it. The
   step is checked for walls only, not for a floor, a plank or water: a
   guard walks into a gap or a pool on purpose (MECHANICS.md, Guards). */
const KLAD_CHASE = {
  step(guard, player, world) {
    const rowStep = Math.sign(player.y - guard.y);
    const columnStep = Math.sign(player.x - guard.x);
    const canClimbUp = rowStep < 0 && world.isLadder(guard.x, guard.y) &&
      world.isPassable(guard.x, guard.y - 1);
    const canClimbDown = rowStep > 0 && world.isPassable(guard.x, guard.y + 1) &&
      (world.isLadder(guard.x, guard.y) || world.isLadder(guard.x, guard.y + 1));
    let next = null;
    if (canClimbUp || canClimbDown) next = { x: guard.x, y: guard.y + rowStep };
    else if (columnStep !== 0 && world.isPassable(guard.x + columnStep, guard.y)) {
      next = { x: guard.x + columnStep, y: guard.y };
    }
    return next;
  },
};
if (typeof module !== 'undefined') module.exports = KLAD_CHASE;
