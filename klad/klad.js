/* КЛАД — a clean-room homage. Vanilla JS, no dependencies, no build step,
   no storage. Rules reconstructed in MECHANICS.md. Levels in levels.js. */
'use strict';
(() => {
  const LEVELS = KLAD_LEVELS;
  const SPEED = { walk: 5, climb: 4.5, fall: 9, guard: 3.8, shot: 15 };
  const HOLE_TIME = 4.2, HOLE_WARN = 1, GUARD_HOLE = 3.6, GUARD_RESPAWN = 3;
  const START_LIVES = 3;
  const SCORE = { '$': 100, 'K': 250, 'L': 150, clear: 500 };

  const $ = (id) => document.getElementById(id);
  const cv = $('game'), ctx = cv.getContext('2d'), stage = $('stage');
  const hud = { level: $('h-level'), lives: $('h-lives'), chests: $('h-chests'),
                key: $('h-key'), score: $('h-score') };
  const msg = $('msg'), msgTitle = $('msg-title'), msgBody = $('msg-body');
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* Palette comes from the stylesheet so the game and the site stay one system. */
  const root = getComputedStyle(document.documentElement);
  const col = (n, fb) => root.getPropertyValue(n).trim() || fb;
  const C = { bg: col('--crt-bg', '#0b1410'), fg: col('--crt-fg', '#7bf7ad'),
    dim: col('--crt-dim', '#5bbd8a'), hot: col('--crt-hot', '#ffd479'),
    alert: col('--crt-alert', '#ff8a7a'), dark: col('--crt-dark', '#163a2a'),
    rule: col('--crt-rule', '#23503c'), water: col('--crt-water', '#2f5d8a'),
    waterHi: col('--crt-water-hi', '#8fb4d9') };
  const PX = { 1: C.fg, 2: C.dim, 3: C.hot, 4: C.alert, 5: C.dark, 6: C.water, 7: C.waterHi, 8: C.rule };

  /* 8x8 sprites. '.' is transparent; digits index PX. Our own art. */
  const SPR = {
    brick: ['22252222', '22252222', '55555555', '22222522', '22222522', '55555555', '22252222', '22252222'],
    stone: ['88888888', '85555558', '85555558', '85558558', '85555558', '85855558', '85555558', '88888888'],
    ladder: ['.1....1.', '.111111.', '.1....1.', '.1....1.', '.111111.', '.1....1.', '.1....1.', '.111111.'],
    exit: ['.3....3.', '.333333.', '.3....3.', '.3....3.', '.333333.', '.3....3.', '.3....3.', '.333333.'],
    plank: ['........', '22222222', '2.22.22.', '........', '........', '........', '........', '........'],
    water0: ['77..77..', '66666666', '66666666', '..77..77', '66666666', '66666666', '77..77..', '66666666'],
    water1: ['..77..77', '66666666', '66666666', '77..77..', '66666666', '66666666', '..77..77', '66666666'],
    chest: ['........', '.333333.', '.3....3.', '.333333.', '.33.333.', '.333333.', '.333333.', '........'],
    doorC: ['33333333', '32222223', '32222223', '32222323', '32222223', '32222223', '32222223', '33333333'],
    doorO: ['33333333', '3......3', '3......3', '3......3', '3......3', '3......3', '3......3', '33333333'],
    p0: ['...11...', '...11...', '..1111..', '.1.11.1.', '...11...', '..1..1..', '.1....1.', '.1....1.'],
    p1: ['...11...', '...11...', '..1111..', '..1111..', '...11...', '..1..1..', '..1..1..', '..1..1..'],
    pc: ['...11...', '..1111..', '.1.11.1.', '.1.11.1.', '...11...', '..1..1..', '.1....1.', '........'],
    g0: ['.4....4.', '..4444..', '..4.4...', '..4444..', '...44...', '..4444..', '.4.44.4.', '..4..4..'],
    g1: ['.4....4.', '..4444..', '...4.4..', '..4444..', '...44...', '..4444..', '..4444..', '.4....4.'],
  };
  let T = 24, cache = {};
  function sprite(name, flip) {
    const key = name + (flip ? 'f' : '');
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas');
    c.width = c.height = T;
    const g = c.getContext('2d'), s = T / 8;
    SPR[name].forEach((row, y) => {
      for (let x = 0; x < 8; x++) {
        if (row[x] === '.') continue;
        g.fillStyle = PX[row[x]];
        const px = flip ? 7 - x : x;
        g.fillRect(Math.floor(px * s), Math.floor(y * s), Math.ceil(s), Math.ceil(s));
      }
    });
    return (cache[key] = c);
  }

  /* ---- State ---- */
  const S = { phase: 'title', level: 0, lives: START_LIVES, score: 0, hasKey: false,
              chestsLeft: 0, total: 0, t: 0, timer: 0, shape: 'landscape' };
  let grid = [], W = 0, H = 0, player = null, guards = [], shot = null;
  const holes = new Map(), chests = new Map();
  const keys = { up: false, down: false, left: false, right: false };

  const idx = (x, y) => y * W + x;
  const at = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? '=' : grid[y][x];
  function isSolid(x, y) {
    const c = at(x, y);
    if (c === '#') return !holes.has(idx(x, y));
    if (c === 'D') return !S.hasKey;
    return c === '=';
  }
  const passable = (x, y) => !isSolid(x, y);
  const isLadder = (x, y) => { const c = at(x, y); return c === 'H' || c === 'E'; };
  const isPlank = (x, y) => at(x, y) === '-';
  const isWater = (x, y) => at(x, y) === '~';
  function supported(e) {
    const { cx, cy } = e;
    if (isLadder(cx, cy) || cy + 1 >= H) return true;
    if (isSolid(cx, cy + 1) || isLadder(cx, cy + 1)) return true;
    return isPlank(cx, cy + 1) && e.fallRows === 0;
  }
  const cellOf = (e) => idx(Math.round(e.x), Math.round(e.y));

  function ent(x, y, speed) {
    return { x, y, cx: x, cy: y, tx: x, ty: y, sx: x, sy: y, speed, moving: false,
             falling: false, fallRows: 0, dir: 1, anim: 0, inHole: 0, stuck: false, dead: 0 };
  }
  const pickShape = () => matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';

  function loadLevel(i) {
    S.shape = pickShape();
    const rows = LEVELS[i][S.shape];
    H = rows.length; W = rows[0].length;
    grid = rows.map((r) => r.split(''));
    guards = []; holes.clear(); chests.clear(); shot = null; S.hasKey = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = grid[y][x];
      if (c === 'P') { player = ent(x, y, SPEED.walk); grid[y][x] = '.'; }
      else if (c === 'G') { guards.push(ent(x, y, LEVELS[i].guardSpeed || SPEED.guard)); grid[y][x] = '.'; }
      else if (c === '$' || c === 'K' || c === 'L') { chests.set(idx(x, y), c); grid[y][x] = '.'; }
    }
    S.total = S.chestsLeft = chests.size;
    resize();
  }

  /* ---- Movement: entities travel cell to cell, deciding only when aligned. ---- */
  function startMove(e, tx, ty) { e.tx = tx; e.ty = ty; e.moving = true; }
  function advance(e, dt) {
    const speed = e.falling ? SPEED.fall : (e.ty !== e.cy ? SPEED.climb : e.speed);
    const dx = e.tx - e.x, dy = e.ty - e.y, dist = Math.abs(dx) + Math.abs(dy), step = speed * dt;
    if (step >= dist) {
      e.x = e.tx; e.y = e.ty; e.cx = e.tx; e.cy = e.ty; e.moving = false; e.anim += dist;
      return dt - dist / speed;
    }
    e.x += Math.sign(dx) * step; e.y += Math.sign(dy) * step; e.anim += step;
    return 0;
  }
  function updateEntity(e, dt, decide) {
    let budget = dt, n = 0;
    while (budget > 0 && n++ < 8) {
      if (e.moving) {
        budget = advance(e, budget);
        if (!e.moving) { onArrive(e); if (S.phase !== 'play') return; }
        continue;
      }
      if (!decide(e)) break;
    }
  }
  function fall(e) { e.falling = true; e.fallRows++; startMove(e, e.cx, e.cy + 1); return true; }

  function decidePlayer(p) {
    if (!supported(p)) return fall(p);
    p.falling = false; p.fallRows = 0;
    if (keys.up && isLadder(p.cx, p.cy) && passable(p.cx, p.cy - 1)) { startMove(p, p.cx, p.cy - 1); return true; }
    if (keys.down && passable(p.cx, p.cy + 1) && (isLadder(p.cx, p.cy) || isLadder(p.cx, p.cy + 1))) {
      startMove(p, p.cx, p.cy + 1); return true;
    }
    const dir = keys.left ? -1 : keys.right ? 1 : 0;
    if (dir) { p.dir = dir; if (passable(p.cx + dir, p.cy)) { startMove(p, p.cx + dir, p.cy); return true; } }
    return false;
  }

  function decideGuard(g) {
    if (g.inHole > 0 || g.stuck || g.dead > 0) return false;
    if (!supported(g)) return fall(g);
    g.falling = false; g.fallRows = 0;
    const next = pathStep(g);
    if (next == null) return false;
    const nx = next % W, ny = (next - nx) / W;
    if (nx !== g.cx) g.dir = nx > g.cx ? 1 : -1;
    startMove(g, nx, ny);
    return true;
  }

  /* Guards believe planks always hold. They do not, which is how you trick them. */
  function gSupported(x, y) {
    return isLadder(x, y) || y + 1 >= H || isSolid(x, y + 1) || isLadder(x, y + 1) || isPlank(x, y + 1);
  }
  function gNeighbors(x, y, out) {
    out.length = 0;
    const ok = (nx, ny) => nx >= 0 && nx < W && ny >= 0 && ny < H && passable(nx, ny) && !isWater(nx, ny);
    if (!gSupported(x, y)) { if (ok(x, y + 1)) out.push(idx(x, y + 1)); return out; }
    if (ok(x - 1, y)) out.push(idx(x - 1, y));
    if (ok(x + 1, y)) out.push(idx(x + 1, y));
    if (isLadder(x, y) && ok(x, y - 1)) out.push(idx(x, y - 1));
    if (ok(x, y + 1)) out.push(idx(x, y + 1));
    return out;
  }
  const prev = new Int32Array(64 * 64), queue = new Int32Array(64 * 64), nb = [];
  function pathStep(g) {
    const start = idx(g.cx, g.cy), goal = cellOf(player);
    if (start === goal) return null;
    prev.fill(-1, 0, W * H);
    prev[start] = start;
    let qh = 0, qt = 0;
    queue[qt++] = start;
    while (qh < qt) {
      const cur = queue[qh++];
      if (cur === goal) break;
      const cx = cur % W, cy = (cur - cx) / W;
      gNeighbors(cx, cy, nb);
      for (const n of nb) if (prev[n] === -1) { prev[n] = cur; queue[qt++] = n; }
    }
    if (prev[goal] === -1) return null;
    let c = goal;
    while (prev[c] !== start) c = prev[c];
    return c;
  }

  function onArrive(e) {
    if (isWater(e.cx, e.cy)) { if (e === player) die(); else drown(e); return; }
    if (e === player) {
      const k = idx(e.cx, e.cy);
      if (chests.has(k)) collect(k);
      if (e.cy === 0 && at(e.cx, 0) === 'E') levelClear();
    } else if (e.falling && holes.has(idx(e.cx, e.cy))) {
      e.inHole = GUARD_HOLE; e.falling = false; e.fallRows = 0;
    }
  }
  function collect(k) {
    const kind = chests.get(k);
    chests.delete(k);
    S.chestsLeft--; S.score += SCORE[kind];
    if (kind === 'K') S.hasKey = true;
    if (kind === 'L') S.lives++;
  }
  function drown(g) { g.dead = GUARD_RESPAWN; g.moving = false; g.inHole = 0; }
  function respawn(g) {
    g.x = g.cx = g.tx = g.sx; g.y = g.cy = g.ty = g.sy;
    g.moving = false; g.falling = false; g.fallRows = 0; g.dead = 0; g.inHole = 0;
  }

  function fire() {
    if (S.phase !== 'play' || shot || player.falling) return;
    shot = { x: player.x + player.dir * 0.5, y: player.cy, dir: player.dir, cell: idx(player.cx, player.cy) };
  }
  function updateShot(dt) {
    shot.x += shot.dir * SPEED.shot * dt;
    const cx = Math.round(shot.x);
    if (cx < 0 || cx >= W) { shot = null; return; }
    const k = idx(cx, shot.y);
    if (k === shot.cell) return;
    shot.cell = k;
    const c = at(cx, shot.y);
    if (c === '#' && !holes.has(k)) {
      holes.set(k, HOLE_TIME);
      for (const g of guards) if (g.stuck && cellOf(g) === k) { g.stuck = false; g.inHole = GUARD_HOLE; }
      shot = null;
    } else if (c === '=' || (c === 'D' && !S.hasKey)) shot = null;
  }
  function updateHoles(dt) {
    for (const [k, t] of holes) {
      const left = t - dt;
      if (left > 0) { holes.set(k, left); continue; }
      holes.delete(k);
      if (cellOf(player) === k) { die(); return; }
      for (const g of guards) if (!g.stuck && g.dead <= 0 && cellOf(g) === k) {
        g.stuck = true; g.inHole = 0; g.moving = false;
        g.x = g.cx = k % W; g.y = g.cy = (k - g.cx) / W;
      }
    }
  }

  /* ---- Phases ---- */
  function show(title, body) { msgTitle.textContent = title; msgBody.textContent = body; msg.hidden = false; }
  function hide() { msg.hidden = true; }
  function setPhase(p, timer) { S.phase = p; S.timer = timer || 0; }

  function startGame(level) {
    S.level = level; S.lives = START_LIVES; S.score = 0;
    intro();
  }
  function intro() {
    loadLevel(S.level);
    history.replaceState(null, '', '#' + (S.level + 1));
    show('ЭТАП ' + (S.level + 1), LEVELS[S.level].name);
    setPhase('intro', 1.4);
  }
  function die() {
    if (S.phase !== 'play') return;
    show('ПОГИБ', S.lives > 0 ? 'осталось жизней: ' + S.lives : 'это была последняя');
    setPhase('dead', 1.4);
  }
  function levelClear() {
    S.score += SCORE.clear;
    show('ЭТАП ПРОЙДЕН', S.chestsLeft === 0 ? 'все клады собраны' : 'кладов осталось: ' + S.chestsLeft);
    setPhase('clear', 1.8);
  }
  function title() {
    loadLevel(S.level);
    show('КЛАД', touch
      ? 'ОГОНЬ — старт · крестовина — ход · этап ' + (S.level + 1)
      : '← → ↑ ↓ ход · Z/пробел выстрел · P пауза · R заново (−1 жизнь) · 1–5 этап · Enter старт');
    setPhase('title');
  }
  function timers(dt) {
    S.timer -= dt;
    if (S.timer > 0) return;
    if (S.phase === 'intro') { hide(); setPhase('play'); }
    else if (S.phase === 'dead') {
      S.lives--;
      if (S.lives < 0) { show('ИГРА ОКОНЧЕНА', 'счёт ' + S.score + ' · ОГОНЬ или Enter — заново'); setPhase('over'); }
      else intro();
    } else if (S.phase === 'clear') {
      S.level++;
      if (S.level >= LEVELS.length) {
        S.level = 0;
        show('ТЫ ВЫБРАЛСЯ', 'все пять этапов пройдены · счёт ' + S.score);
        setPhase('won');
      } else intro();
    }
  }

  function tick(dt) {
    S.t += dt;
    if (S.phase !== 'play') { if (S.timer > 0) timers(dt); return; }
    updateEntity(player, dt, decidePlayer);
    if (S.phase !== 'play') return;
    for (const g of guards) {
      if (g.dead > 0) { g.dead -= dt; if (g.dead <= 0) respawn(g); continue; }
      if (g.inHole > 0) {
        g.inHole -= dt;
        if (g.inHole <= 0 && passable(g.cx, g.cy - 1)) startMove(g, g.cx, g.cy - 1);
        continue;
      }
      updateEntity(g, dt, decideGuard);
    }
    if (shot) updateShot(dt);
    updateHoles(dt);
    if (S.phase !== 'play') return;
    for (const g of guards) {
      if (g.stuck || g.dead > 0) continue;
      if (Math.abs(g.x - player.x) < 0.6 && Math.abs(g.y - player.y) < 0.6) { die(); return; }
    }
  }

  /* ---- Render ---- */
  function resize() {
    const r = stage.getBoundingClientRect();
    const pad = 8;
    T = Math.max(4, Math.floor(Math.min((r.width - pad) / W, (r.height - pad) / H)));
    cv.width = W * T; cv.height = H * T;
    cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
    cache = {};
  }
  function tileSprite(c, k) {
    switch (c) {
      case '=': return 'stone';
      case '#':
        if (!holes.has(k)) return 'brick';
        return holes.get(k) < HOLE_WARN && Math.floor(S.t * 12) % 2 ? 'brick' : null;
      case 'H': return 'ladder';
      case 'E': return 'exit';
      case '-': return 'plank';
      case '~': return Math.floor(S.t * 2) % 2 ? 'water1' : 'water0';
      case 'D': return S.hasKey ? 'doorO' : 'doorC';
      default: return null;
    }
  }
  function render() {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = tileSprite(grid[y][x], idx(x, y));
      if (n) ctx.drawImage(sprite(n), x * T, y * T);
    }
    for (const k of chests.keys()) { const x = k % W; ctx.drawImage(sprite('chest'), x * T, ((k - x) / W) * T); }
    for (const g of guards) {
      if (g.dead > 0) continue;
      if (g.stuck) { ctx.globalAlpha = 0.45; ctx.drawImage(sprite('g0', g.dir < 0), g.x * T, g.y * T); ctx.globalAlpha = 1; continue; }
      const f = g.moving && Math.floor(g.anim * 2) % 2 ? 'g1' : 'g0';
      ctx.drawImage(sprite(f, g.dir < 0), g.x * T, g.y * T);
    }
    const p = player, climbing = p.moving && p.ty !== p.cy && !p.falling;
    const pf = climbing ? 'pc' : (p.moving && Math.floor(p.anim * 2) % 2 ? 'p1' : 'p0');
    ctx.drawImage(sprite(pf, p.dir < 0), p.x * T, p.y * T);
    if (shot) { ctx.fillStyle = C.hot; ctx.fillRect(shot.x * T + T * 0.3, shot.y * T + T * 0.45, T * 0.4, Math.max(1, T * 0.1)); }
    hud.level.textContent = S.level + 1;
    hud.lives.textContent = Math.max(0, S.lives);
    hud.chests.textContent = (S.total - S.chestsLeft) + '/' + S.total;
    hud.key.hidden = !S.hasKey;
    hud.score.textContent = S.score;
  }

  /* ---- Input ---- */
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
                   ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  function press(action) {
    if (action === 'fire') {
      if (S.phase === 'play') fire();
      else if (S.phase === 'title' || S.phase === 'over' || S.phase === 'won') startGame(S.phase === 'title' ? S.level : 0);
      else if (S.phase === 'pause') { hide(); setPhase('play'); }
    } else if (action === 'pause' && (S.phase === 'play' || S.phase === 'pause')) {
      if (S.phase === 'play') { show('ПАУЗА', 'P или ОГОНЬ — продолжить'); setPhase('pause'); }
      else { hide(); setPhase('play'); }
    } else if (action === 'restart' && S.phase === 'play') die();
  }
  addEventListener('keydown', (e) => {
    if (e.repeat) { if (KEYMAP[e.code]) e.preventDefault(); return; }
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); return; }
    if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'KeyX' || e.code === 'Enter') { press('fire'); e.preventDefault(); }
    else if (e.code === 'KeyP' || e.code === 'Escape') press('pause');
    else if (e.code === 'KeyR') press('restart');
    else if (S.phase === 'title' && /^Digit[1-5]$/.test(e.code)) { S.level = +e.code[5] - 1; title(); }
  });
  addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
  for (const b of document.querySelectorAll('[data-k]')) {
    const k = b.dataset.k;
    const down = (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (k === 'fire') press('fire'); else keys[k] = true; };
    const up = () => { if (k !== 'fire') keys[k] = false; };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  addEventListener('resize', () => { if (S.phase === 'title' && pickShape() !== S.shape) title(); else resize(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.phase === 'play') press('pause'); });

  /* ---- Boot ---- */
  const hash = parseInt(location.hash.slice(1), 10);
  if (hash >= 1 && hash <= LEVELS.length) S.level = hash - 1;
  title();
  cv.focus({ preventScroll: true });
  let last = performance.now(), acc = 0;
  const DT = 1 / 120;
  function frame(now) {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= DT) { tick(DT); acc -= DT; }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
