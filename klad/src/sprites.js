/* Sprites are ASCII art baked once into an offscreen canvas at boot.
 *
 * The ASCII is the point, not a shortcut. КЛАД's ancestry is not public
 * domain (see CHANGELOG), so every pixel shipped here has to be provably
 * ours: text rows show up in a diff, survive review, and cannot be mistaken
 * for a ripped sprite sheet. Binary or base64 art would be none of those
 * things, so it is forbidden here even though it would be smaller.
 *
 * Baking is done once because per-pixel fillRect is fine for ~250 tiles at
 * boot and ruinous at 60 Hz. After bake the renderer only ever calls
 * drawImage from this atlas.
 */

/* Korvet had eight fixed colours -- black, blue, green, cyan, red, magenta,
 * yellow, white. This is that set bent toward a green phosphor tube: blue and
 * magenta are dropped (nothing on screen needs them and they read as "modern
 * RGB" rather than "old monitor"), and two extra greens take their place so
 * masonry can have depth. Every value is either lifted from klad.css or sits
 * between two values that are, which keeps the canvas and the surrounding
 * page looking like one screen rather than a page with a game pasted on it. */
export const PALETTE = [
  '#0b1410', // 0 BLACK  -- ground, same as --crt-bg
  '#23503c', // 1 SHADOW -- structure and mortar, same as --crt-rule
  '#46b8b0', // 2 CYAN   -- water, keys
  '#5bbd8a', // 3 MOSS   -- recessed phosphor, same as --crt-dim
  '#7bf7ad', // 4 GREEN  -- the player and live structure, same as --crt-fg
  '#d7ffe9', // 5 WHITE  -- highlights and beams
  '#ffd479', // 6 AMBER  -- treasure and doors, same as --crt-hot
  '#ff8b6b', // 7 RED    -- every lethal thing, same as --crt-bad
];

/* Named indices so the art below and the renderer agree without either of
 * them repeating a bare number. */
export const INK = {
  BLACK: 0, SHADOW: 1, CYAN: 2, MOSS: 3,
  GREEN: 4, WHITE: 5, AMBER: 6, RED: 7,
};

export const SPRITE_W = 16;
export const SPRITE_H = 16;

/* Sprite row alphabet:
 *   '.' or ' '  transparent
 *   '#'         the sprite's own `ink` index
 *   '0'..'7'    that palette index, overriding `ink`
 * Most tiles use explicit digits because they are genuinely multi-coloured;
 * `ink` exists for the shapes that are one colour and need to be re-baked in
 * another (EXIT, which is the same arch dim and lit). */
const ART = {

  // ---- terrain ---------------------------------------------------------

  /* SOLID is deliberately the darkest thing with structure: it must read as
   * "wall" at a glance without competing with the player for attention. Four
   * short courses rather than two tall ones so it stays legible at 1x. */
  solid: { rows: [
    '3333333333333333',
    '0111111101111111',
    '0111111101111111',
    '0000000000000000',
    '3333333333333333',
    '1111011111110111',
    '1111011111110111',
    '0000000000000000',
    '3333333333333333',
    '0111111101111111',
    '0111111101111111',
    '0000000000000000',
    '3333333333333333',
    '1111011111110111',
    '1111011111110111',
    '0000000000000000',
  ] },

  /* BRICK is the shootable one, so it is brighter and coarser than SOLID.
   * Telling them apart has to be instant -- a player who mistakes one for the
   * other wastes a shot and, on a timed route, a life. */
  brick: { rows: [
    '4444444444444444',
    '0333333303333333',
    '0333333303333333',
    '0333333303333333',
    '0333333303333333',
    '0333333303333333',
    '0333333303333333',
    '0000000000000000',
    '4444444444444444',
    '3333033333330333',
    '3333033333330333',
    '3333033333330333',
    '3333033333330333',
    '3333033333330333',
    '3333033333330333',
    '0000000000000000',
  ] },

  ladder: { rows: [
    '..44........44..',
    '..44........44..',
    '..444444444444..',
    '..333333333333..',
    '..44........44..',
    '..44........44..',
    '..44........44..',
    '..44........44..',
    '..44........44..',
    '..44........44..',
    '..444444444444..',
    '..333333333333..',
    '..44........44..',
    '..44........44..',
    '..44........44..',
    '..44........44..',
  ] },

  /* FALLTHRU has to look like floor from above -- the contract says it "looks
   * solid" -- so its whole upper half is BRICK's first course copied verbatim,
   * down to the mortar. The tell is underneath, where the tile crumbles into
   * nothing: plain once you are beside or below it, invisible while you are
   * walking onto it, which is the trap the mechanic depends on. */
  fallthru: { rows: [
    '4444444444444444',
    '0333333303333333',
    '0333333303333333',
    '0333333303333333',
    '0333333303333333',
    '0333333303333333',
    '0333333303333333',
    '0000000000000000',
    '.1.1.1.1.1.1.1.1',
    '..1...1...1...1.',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ] },

  /* Water is a dark body with a bright crest because a fully bright tile
   * would out-shout the player. The three frames move the crest and the
   * glints; they are a loop, not a strobe, so nothing alternates between
   * bright and dark in the same pixel two frames running. */
  water0: { rows: [
    '..2222....2222..',
    '1111111111111111',
    '1111111111111111',
    '1112111111111111',
    '1111111111111111',
    '1111111111121111',
    '1111111111111111',
    '1121111111111111',
    '1111111111111111',
    '1111111121111111',
    '1111111111111111',
    '1111121111111111',
    '1111111111111111',
    '1111111111111211',
    '1111111111111111',
    '1111111111111111',
  ] },
  water1: { rows: [
    '....2222....2222',
    '1111111111111111',
    '1111112111111111',
    '1111111111111111',
    '1211111111111111',
    '1111111111111111',
    '1111111111211111',
    '1111111111111111',
    '1111211111111111',
    '1111111111111111',
    '1111111111111211',
    '1111111111111111',
    '1111111211111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
  ] },
  water2: { rows: [
    '2222....2222....',
    '1111111111111111',
    '1111111111111211',
    '1111111111111111',
    '1111111211111111',
    '1111111111111111',
    '1112111111111111',
    '1111111111111111',
    '1111111111121111',
    '1111111111111111',
    '1121111111111111',
    '1111111111111111',
    '1111112111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
  ] },

  /* Fire keeps a fixed red base and only moves its tips. The base is what the
   * player reads as "this row is lethal"; if the whole flame danced, the
   * lethal boundary would look negotiable, and it is not. */
  fire0: { rows: [
    '................',
    '................',
    '.......7........',
    '......77...7....',
    '.....777..777...',
    '.....7777.777...',
    '....7777777777..',
    '....7766677777..',
    '...776666677777.',
    '...7766666677777',
    '..77666666667777',
    '..77666556667777',
    '..77666556667777',
    '.777666666667777',
    '.777766666677777',
    '7777766666677777',
  ] },
  fire1: { rows: [
    '................',
    '.........7......',
    '....7....77.....',
    '....77..777.....',
    '...777..7777....',
    '...7777777777...',
    '...7777777777...',
    '...7766677777...',
    '..776666677777..',
    '..7766666677777.',
    '..77666666667777',
    '.777666556667777',
    '.777666556667777',
    '.777666666667777',
    '7777666666667777',
    '7777766666677777',
  ] },
  fire2: { rows: [
    '................',
    '......7.........',
    '.....77......7..',
    '....777.....77..',
    '....7777...777..',
    '....777777777...',
    '...7777777777...',
    '...7766677777...',
    '...766666677777.',
    '..7766666677777.',
    '..77666666667777',
    '..77665566667777',
    '.777665566667777',
    '.777666666667777',
    '7777666666667777',
    '7777766666677777',
  ] },

  // ---- treasure --------------------------------------------------------

  /* All three chests share one silhouette on purpose: they are one class of
   * object to the collision code (they all count toward chestsLeft) and
   * should be one class of object to the eye too. Only the emblem differs,
   * and its colour is the payload -- amber nothing, red life, cyan key. */
  chest: { rows: [
    '................',
    '................',
    '................',
    '..666666666666..',
    '..655555555556..',
    '..666666666666..',
    '..600000000006..',
    '..666661166666..',
    '..666661166666..',
    '..666666666666..',
    '..655555555556..',
    '..666666666666..',
    '..666666666666..',
    '..111111111111..',
    '................',
    '................',
  ] },
  chestLife: { rows: [
    '................',
    '................',
    '................',
    '..666666666666..',
    '..666667766666..',
    '..667777777766..',
    '..667777777766..',
    '..666667766666..',
    '..666666666666..',
    '..600000000006..',
    '..666666666666..',
    '..655555555556..',
    '..666666666666..',
    '..111111111111..',
    '................',
    '................',
  ] },
  chestKey: { rows: [
    '................',
    '................',
    '................',
    '..666666666666..',
    '..655555555556..',
    '..662226666666..',
    '..662622222266..',
    '..662226662626..',
    '..666666666666..',
    '..600000000006..',
    '..666666666666..',
    '..655555555556..',
    '..666666666666..',
    '..111111111111..',
    '................',
    '................',
  ] },

  // ---- fixtures --------------------------------------------------------

  /* DOOR fills its tile edge to edge because it blocks like SOLID does; a
   * door drawn with a margin would imply you can squeeze past it. */
  door: { rows: [
    '6666666666666666',
    '6111111111111116',
    '6100000000000016',
    '6100000000000016',
    '6100000000000016',
    '6100000660000016',
    '6100006666000016',
    '6100000660000016',
    '6100000660000016',
    '6100000000000016',
    '6100000000066016',
    '6100000000000016',
    '6100000000000016',
    '6100000000000016',
    '6111111111111116',
    '6666666666666666',
  ] },

  /* One arch, baked twice. The inert exit is drawn in the same colour as
   * masonry so it reads as part of the wall until the last chest is taken;
   * the open one is treasure-coloured, which is the only other place amber
   * appears, so "amber means go there" needs no tutorial. */
  exitDim: { ink: INK.SHADOW, rows: [
    '................',
    '....########....',
    '...##########...',
    '..####....####..',
    '..###......###..',
    '..##........##..',
    '..##...##...##..',
    '..##..####..##..',
    '..##.##..##.##..',
    '..##.#....#.##..',
    '..##........##..',
    '..##........##..',
    '..##........##..',
    '..##........##..',
    '..##........##..',
    '..##........##..',
  ] },

  /* A brick that a shot destroyed and that world.bricks is counting back in.
   * Drawn as an outline rather than left blank so a route that depends on the
   * gap closing is readable before it closes. */
  brickGhost: { ink: INK.SHADOW, rows: [
    '#.#.#.#.#.#.#.#.',
    '................',
    '#..............#',
    '................',
    '#..............#',
    '................',
    '#..............#',
    '................',
    '#..............#',
    '................',
    '#..............#',
    '................',
    '#..............#',
    '................',
    '#..............#',
    '.#.#.#.#.#.#.#.#',
  ] },

  // ---- actors ----------------------------------------------------------

  /* The player is the only white-headed figure on screen and the only one
   * drawn in --crt-fg. Two walk frames is what the contract asks for and what
   * the original had; the cycle is driven by distance travelled rather than
   * by the clock (see render.js) so the feet track the ground. */
  playerWalk0: { rows: [
    '................',
    '......5555......',
    '......55055.....',
    '......5555......',
    '.......44.......',
    '.....444444.....',
    '.....44444444...',
    '.....444444.....',
    '.....444444.....',
    '.....444444.....',
    '.....444444.....',
    '....33....33....',
    '....33....33....',
    '...33......33...',
    '...33......33...',
    '..333......333..',
  ] },
  playerWalk1: { rows: [
    '................',
    '......5555......',
    '......55055.....',
    '......5555......',
    '.......44.......',
    '.....444444.....',
    '...44444444.....',
    '.....444444.....',
    '.....444444.....',
    '.....444444.....',
    '.....444444.....',
    '......3333......',
    '......3333......',
    '......3333......',
    '.....33..33.....',
    '....333..333....',
  ] },

  /* Climbing is drawn front-on with both eyes showing. It is a separate pose,
   * not a recoloured walk, because on a ladder the facing flag stops meaning
   * anything and a side-on figure would look like it is standing in mid-air. */
  playerClimb0: { rows: [
    '................',
    '......5555......',
    '......5005......',
    '......5555......',
    '....44.44.44....',
    '....44444444....',
    '.....444444.....',
    '.....444444.....',
    '.....444444.....',
    '.....444444.....',
    '.....444444.....',
    '.....33..33.....',
    '.....33..33.....',
    '....33....33....',
    '....33....33....',
    '...333....333...',
  ] },
  playerClimb1: { rows: [
    '................',
    '......5555......',
    '......5005......',
    '......5555......',
    '....44.44.......',
    '....44444444....',
    '.....4444444....',
    '.....4444444....',
    '.....444444.....',
    '.....444444.....',
    '.....444444.....',
    '....33....33....',
    '....33....33....',
    '.....33..33.....',
    '.....33..33.....',
    '....333..333....',
  ] },

  /* Death is a heap on the floor rather than a burst, so the frame stays
   * still. Anything that flashes here would have to be suppressed under
   * prefers-reduced-motion and would then leave that user with no feedback
   * at all at the exact moment they need it. */
  playerDead: { rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....7......7....',
    '..777777777777..',
    '..755555555557..',
    '..777777777777..',
  ] },

  /* Guardians are red-bodied and amber-helmeted. They cannot be shot, so they
   * are painted as hazards -- the same red as fire and water's lethality --
   * rather than as enemies you might try to fight. The out-thrust arm is what
   * makes the mirrored copy read as a direction. */
  guardWalk0: { rows: [
    '................',
    '.....666666.....',
    '....66666666....',
    '....66000000....',
    '....66666666....',
    '......7777......',
    '....77777777....',
    '...777777777777.',
    '...7777777777...',
    '....77777777....',
    '....77777777....',
    '....77777777....',
    '....77....77....',
    '...77......77...',
    '...77......77...',
    '..777......777..',
  ] },
  guardWalk1: { rows: [
    '................',
    '.....666666.....',
    '....66666666....',
    '....66000000....',
    '....66666666....',
    '......7777......',
    '....77777777....',
    '...77777777777..',
    '...7777777777...',
    '....77777777....',
    '....77777777....',
    '....77777777....',
    '.....777777.....',
    '.....77..77.....',
    '.....77..77.....',
    '....777..777....',
  ] },

  /* The beam runs the full tile width so that consecutive positions join into
   * an unbroken streak at speed instead of a dotted line. */
  shot0: { rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.....444444.....',
    '4455555555555544',
    '4455555555555544',
    '.....444444.....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ] },
  shot1: { rows: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '....55555555....',
    '5544444444444455',
    '5544444444444455',
    '....55555555....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ] },
};

/* Left-facing frames are the right-facing rows reversed at bake time. This is
 * a transform of our own ASCII, so it costs nothing in provenance, and it
 * keeps the two facings from drifting apart when one of them is edited. */
const MIRRORS = {
  playerWalk0L: 'playerWalk0',
  playerWalk1L: 'playerWalk1',
  guardWalk0L: 'guardWalk0',
  guardWalk1L: 'guardWalk1',
  shot0L: 'shot0',
  shot1L: 'shot1',
};

/* The same arch as exitDim, re-baked in amber. Kept as an alias rather than a
 * second copy of the rows for the reason above. */
const RECOLOURS = {
  exitLit: { from: 'exitDim', ink: INK.AMBER },
};

// ---- text ---------------------------------------------------------------

export const FONT_W = 5;
export const FONT_H = 7;
/* One pixel of tracking. The status band is 16px tall and the glyphs are 7,
 * so the band can hold one line with room above and below for the rule. */
export const FONT_ADVANCE = 6;

/* Uppercase Latin only. The status band says SCORE / LIVES / LEVEL in Latin
 * even though the game's name is Cyrillic: the band is a readout, the
 * aria-live line in the DOM is the real accessible surface, and a Cyrillic
 * face would double the glyph count for no gain to either. */
const FONT = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '..#..', '..#..'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
};

/* The font is baked once per colour it is ever drawn in. Tinting at draw time
 * would need a composite-operation dance per string; four extra copies of a
 * 40-glyph 5x7 face costs about 6 KB of atlas and nothing per frame. */
const FONT_INKS = [
  INK.SHADOW, INK.CYAN, INK.MOSS, INK.GREEN, INK.WHITE, INK.AMBER, INK.RED,
];

// ---- baking -------------------------------------------------------------

const ATLAS_W = 256;

function mirrorRows(rows) {
  return rows.map((row) => row.split('').reverse().join(''));
}

/* Our own art is either always valid or always broken, so a malformed row is
 * a build-time-class bug that should be loud at boot rather than a silently
 * clipped sprite three levels in. */
function validate(name, rows, w, h) {
  if (rows.length !== h) {
    throw new Error(`sprite ${name}: ${rows.length} rows, expected ${h}`);
  }
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].length !== w) {
      throw new Error(
        `sprite ${name} row ${i}: ${rows[i].length} chars, expected ${w}`,
      );
    }
  }
}

function makeCanvas(w, h) {
  /* OffscreenCanvas where it exists, a detached <canvas> otherwise. Either way
   * nothing is appended and nothing is queried -- the atlas never enters the
   * document, which is what keeps render.js honest about touching no DOM. */
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  return el;
}

function paint(ctx, rows, ox, oy, ink) {
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < row.length; x += 1) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const index = ch === '#' ? ink : Number(ch);
      ctx.fillStyle = PALETTE[index];
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

let atlas = null;

/**
 * Bake every sprite and every font glyph into one offscreen canvas.
 * Idempotent: the second and later calls hand back the first bake.
 *
 * @returns {{canvas: *, frame: function(string): ?{x:number,y:number,w:number,h:number},
 *            has: function(string): boolean}}
 */
export function bakeSprites() {
  if (atlas) return atlas;

  /* Two passes: lay everything out to learn the height, then allocate the
   * canvas and draw. A canvas cannot be grown without losing its contents. */
  const plan = [];
  let x = 0;
  let y = 0;
  let shelf = 0;

  const place = (name, w, h, rows, ink) => {
    if (x + w > ATLAS_W) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    plan.push({ name, x, y, w, h, rows, ink });
    x += w;
    if (h > shelf) shelf = h;
  };

  for (const [name, def] of Object.entries(ART)) {
    validate(name, def.rows, SPRITE_W, SPRITE_H);
    place(name, SPRITE_W, SPRITE_H, def.rows, def.ink ?? INK.GREEN);
  }
  for (const [name, source] of Object.entries(MIRRORS)) {
    const def = ART[source];
    place(name, SPRITE_W, SPRITE_H, mirrorRows(def.rows), def.ink ?? INK.GREEN);
  }
  for (const [name, spec] of Object.entries(RECOLOURS)) {
    place(name, SPRITE_W, SPRITE_H, ART[spec.from].rows, spec.ink);
  }

  // Font glyphs start on a fresh shelf so their names stay easy to reason about.
  x = 0;
  y += shelf;
  shelf = 0;
  for (const ink of FONT_INKS) {
    for (const [ch, rows] of Object.entries(FONT)) {
      validate(`font ${ch}`, rows, FONT_W, FONT_H);
      place(`${ink}:${ch}`, FONT_ADVANCE, FONT_H + 1, rows, ink);
    }
  }

  const height = y + shelf;
  const canvas = makeCanvas(ATLAS_W, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const frames = new Map();
  for (const cell of plan) {
    paint(ctx, cell.rows, cell.x, cell.y, cell.ink);
    frames.set(cell.name, { x: cell.x, y: cell.y, w: cell.w, h: cell.h });
  }

  atlas = {
    canvas,
    frame: (name) => frames.get(name) ?? null,
    has: (name) => frames.has(name),
  };
  return atlas;
}

/**
 * Blit one baked sprite. Coordinates are pixels in the destination context.
 * An unknown name draws nothing rather than throwing: a missing frame should
 * cost one sprite, not the whole running game.
 */
export function drawSprite(ctx, name, dx, dy) {
  const sheet = bakeSprites();
  const f = sheet.frame(name);
  if (!f) return;
  ctx.drawImage(sheet.canvas, f.x, f.y, f.w, f.h, dx | 0, dy | 0, f.w, f.h);
}

/** Width in pixels the given string will occupy, trailing tracking included. */
export function textWidth(text) {
  return text.length * FONT_ADVANCE;
}

/**
 * Draw a string from the baked font. Unmapped characters fall back to a
 * space, which keeps a stray character from shifting the rest of the line.
 *
 * @param {number} ink palette index; must be one of FONT_INKS.
 */
export function drawText(ctx, text, dx, dy, ink) {
  const upper = String(text).toUpperCase();
  let cursor = dx | 0;
  for (let i = 0; i < upper.length; i += 1) {
    const ch = upper[i];
    drawSprite(ctx, `${ink}:${ch in FONT ? ch : ' '}`, cursor, dy);
    cursor += FONT_ADVANCE;
  }
  return cursor;
}
