/* КЛАД race: the ghost race over the lobby's socket (contract section 8).
   The first half has no DOM, so the node tests can require it. The
   interface is in klad/README.md. */
'use strict';
const KLAD_RACE = (() => {
  const PING_EVERY = 20 * 1000;
  const POSITION_EVERY = 200;
  const SECOND = 1000;
  const COUNTDOWN = 3;
  const GHOST_ALPHA = 0.55;
  const FADE_AFTER = 2 * 1000;
  const FADE_FOR = 1000;
  const NOTICE_FOR = 8 * 1000;
  const SLOTS = 4;
  const LAST_CELL = 24;
  const MAX_TICKS = (4 * 60 + 10) * 120;
  const SHAPES = ['landscape', 'portrait'];
  const ACTIVE = ['starting', 'countdown', 'racing', 'finished'];
  const TEXT = {
    reconnecting: 'Связь прервалась, подключаемся снова... Игра идёт дальше.',
    waiting: (time) => 'Финиш: ' + time + '. Ждём остальных...',
    finishedWaiting: 'Ваш финиш уже засчитан. Ждём остальных...',
    closed: 'Гонка закрыта: её закрыл сервер, или она идёт в другой вкладке.',
    left: 'Вы вышли из комнаты.',
    notStarted: 'Не удалось начать гонку: этап недоступен. Обычная игра работает как прежде.',
    lost: 'Связь с сервером пропала, гонка для вас закончилась. Обычная игра работает как прежде.',
    unavailable: 'Онлайн-игра недоступна в этом браузере. Обычная игра работает как прежде.',
  };

  const isObject = (value) => value !== null && typeof value === 'object';
  const rounded = (cells) => Math.round(cells * 100) / 100;

  /* environment and page are described in klad/README.md (Race). */
  function create(environment, page) {
    const { clock, engine } = environment;
    const ghosts = new Map();
    let socket = null;
    let phase = 'idle';
    let level = 1;
    let shape = SHAPES[0];
    let count = 0;
    let players = [];
    let mySlot = null;
    let finishTicks = null;
    let isFinishSent = false;
    let places = null;
    let message = '';
    let pingTimer = null;
    let positionTimer = null;
    let countdownTimer = null;
    let messageTimer = null;

    function stopTimers() {
      for (const timer of [pingTimer, positionTimer, countdownTimer]) clock.clearTimeout(timer);
      pingTimer = null;
      positionTimer = null;
      countdownTimer = null;
    }

    /* One ping timer per race, whatever the reconnects; send() drops it
       while the socket is not open. */
    function schedulePing() {
      pingTimer = clock.setTimeout(() => {
        socket.send({ type: 'ping' });
        schedulePing();
      }, PING_EVERY);
    }

    /* engine.position() is null unless the race is in play, so a paused,
       dead or held game sends nothing, like a hidden tab. */
    function sendPosition() {
      positionTimer = clock.setTimeout(sendPosition, POSITION_EVERY);
      const position = environment.isVisible() ? engine.position() : null;
      if (position !== null) socket.send({ type: 'pos', x: rounded(position.x), y: rounded(position.y), tick: position.tick });
    }

    function sendFinish() {
      if (finishTicks !== null && !isFinishSent) isFinishSent = socket.send({ type: 'finish', ticks: finishTicks });
    }

    function nickOf(slot) {
      const player = players.find((entry) => entry.slot === slot);
      return player && typeof player.nick === 'string' ? player.nick : '';
    }

    function takePosition(entry, nick) {
      const isValid = isObject(entry) && Number.isInteger(entry.slot) && entry.slot >= 0 && entry.slot < SLOTS
        && entry.slot !== mySlot && Number.isFinite(entry.x) && Number.isFinite(entry.y)
        && entry.x >= 0 && entry.x <= LAST_CELL && entry.y >= 0 && entry.y <= LAST_CELL;
      if (!isValid) return;
      const previous = ghosts.get(entry.slot);
      let direction = previous ? previous.direction : 1;
      if (previous && entry.x !== previous.x) direction = entry.x < previous.x ? -1 : 1;
      ghosts.set(entry.slot, {
        slot: entry.slot, nick: typeof nick === 'string' ? nick : nickOf(entry.slot), x: entry.x, y: entry.y, direction,
        seenAt: clock.now(),
      });
    }

    function go() {
      clock.clearTimeout(countdownTimer);
      countdownTimer = null;
      phase = 'racing';
      if (!engine.start(level, shape)) {
        end(TEXT.notStarted);
        return;
      }
      positionTimer = clock.setTimeout(sendPosition, POSITION_EVERY);
      page.render();
    }

    function countDown() {
      count--;
      countdownTimer = count > 1 ? clock.setTimeout(countDown, SECOND) : null;
      page.render();
    }

    function startCountdown(seconds) {
      phase = 'countdown';
      count = Number.isInteger(seconds) && seconds > 0 ? seconds : COUNTDOWN;
      if (count > 1) countdownTimer = clock.setTimeout(countDown, SECOND);
      page.render();
    }

    /* Sent on every connect, so it also resyncs after a reconnect: the
       ghosts, a finish the server has not got yet, and a missed go. After a
       reload past this player's finish there is nothing left to play. */
    function takeState(data) {
      if (Number.isInteger(data.level) && data.level >= 1 && SHAPES.includes(data.shape)) {
        level = data.level;
        shape = data.shape;
      }
      players = Array.isArray(data.players) ? data.players.filter(isObject) : [];
      const mine = players.find((player) => player.you === true);
      mySlot = mine ? mine.slot : null;
      ghosts.clear();
      for (const entry of Array.isArray(data.positions) ? data.positions : []) takePosition(entry);
      const hasFinished = Boolean(mine && mine.finished === true);
      isFinishSent = hasFinished;
      sendFinish();
      const isBeforeGo = phase === 'starting' || phase === 'countdown';
      if (data.state === 'racing' && isBeforeGo && hasFinished) arriveFinished();
      else if (data.state === 'racing' && isBeforeGo) go();
      else page.render();
    }

    function arriveFinished() {
      clock.clearTimeout(countdownTimer);
      countdownTimer = null;
      phase = 'finished';
      page.render();
    }

    function takeResults(data) {
      stopTimers();
      phase = 'results';
      places = Array.isArray(data.places) ? data.places.filter(isObject) : [];
      engine.stop();
      page.render();
    }

    function receive(data) {
      if (!isObject(data) || !ACTIVE.includes(phase)) return;
      if (data.type === 'state') takeState(data);
      else if (data.type === 'countdown' && phase === 'starting') startCountdown(data.seconds);
      else if (data.type === 'go' && (phase === 'starting' || phase === 'countdown')) go();
      else if (data.type === 'pos') takePosition(data, data.nick);
      else if (data.type === 'results') takeResults(data);
    }

    function end(text) {
      stopTimers();
      phase = 'idle';
      engine.stop();
      message = text;
      clock.clearTimeout(messageTimer);
      messageTimer = text ? clock.setTimeout(() => {
        message = '';
        page.render();
      }, NOTICE_FOR) : null;
      page.render();
    }

    /* The lobby's module reconnects on its own; a drop only shows a notice
       and the local game goes on. Close 1000 (race_over, replaced, idle, or
       leaving the room) and offline end the race. */
    function changed(status) {
      if (!ACTIVE.includes(phase)) return;
      if (status === 'closed') end(phase === 'starting' ? '' : (socket.hasLeft() ? TEXT.left : TEXT.closed));
      else if (status === 'offline') end(socket.hasOpened() ? TEXT.lost : TEXT.unavailable);
      else page.render();
    }

    /* room is the lobby's polled room, newSocket the connection from
       KLAD_LOBBY.connect. A socket from an earlier race is ignored. */
    function begin(room, newSocket) {
      stopTimers();
      clock.clearTimeout(messageTimer);
      socket = newSocket;
      phase = 'starting';
      level = room.level;
      shape = room.shape;
      count = 0;
      players = [];
      mySlot = null;
      finishTicks = null;
      isFinishSent = false;
      places = null;
      message = '';
      ghosts.clear();
      newSocket.on('message', (data) => { if (newSocket === socket) receive(data); });
      newSocket.on('status', (status) => { if (newSocket === socket) changed(status); });
      schedulePing();
      page.render();
    }

    /* Called by the engine once the player reaches the exit. */
    function finish(ticks) {
      if (phase !== 'racing') return;
      phase = 'finished';
      finishTicks = ticks;
      clock.clearTimeout(positionTimer);
      positionTimer = null;
      sendFinish();
      page.render();
    }

    /* Drawn by the engine every frame, from the latest position. */
    function visibleGhosts() {
      const now = clock.now();
      const list = [];
      for (const ghost of ghosts.values()) {
        const age = now - ghost.seenAt;
        const alpha = age <= FADE_AFTER ? GHOST_ALPHA : GHOST_ALPHA * (1 - (age - FADE_AFTER) / FADE_FOR);
        if (alpha > 0) list.push({ slot: ghost.slot, nick: ghost.nick, x: ghost.x, y: ghost.y, direction: ghost.direction, alpha });
      }
      return list;
    }

    /* The server's order: place 1, 2, ... by the receipt of finish, then
       those with no finish. A time over the race cap is shown as '-', so one
       member cannot stretch the table. */
    function timeOf(ticks) {
      let time = null;
      if (Number.isInteger(ticks)) time = ticks >= 0 && ticks <= MAX_TICKS ? environment.format(ticks) : '-';
      return time;
    }

    function placesView() {
      const order = (entry) => (Number.isInteger(entry.place) ? entry.place : SLOTS + 1);
      return [...places].sort((first, second) => order(first) - order(second)).map((entry) => ({
        place: Number.isInteger(entry.place) ? entry.place : null,
        nick: typeof entry.nick === 'string' ? entry.nick : '',
        time: timeOf(entry.ticks),
        isWinner: entry.place === 1,
        isMine: mySlot !== null && entry.slot === mySlot,
        hasLeft: entry.left === true,
      }));
    }

    function notice() {
      let text = message;
      if (ACTIVE.includes(phase) && socket.status() === 'reconnecting') text = TEXT.reconnecting;
      else if (phase === 'finished' && finishTicks === null) text = TEXT.finishedWaiting;
      else if (phase === 'finished') text = TEXT.waiting(environment.format(finishTicks));
      return text;
    }

    function state() {
      return { phase, count, level, shape, notice: notice(), places: places === null ? null : placesView() };
    }

    return { begin, finish, ghosts: visibleGhosts, state };
  }

  return { create, TEXT, PING_EVERY, POSITION_EVERY, GHOST_ALPHA, FADE_AFTER, FADE_FOR, NOTICE_FOR };
})();
if (typeof module !== 'undefined') module.exports = KLAD_RACE;

/* The page half: the race dialog (countdown and finish screen), the notice
   on the field, and the wiring to klad.js and the lobby. */
if (typeof document !== 'undefined') (() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), dialog = $('race'), heading = $('race-title'), levelLine = $('race-level'),
        countLine = $('race-count'), status = $('race-status'), results = $('race-results'), placesPart = $('race-places'),
        notice = $('race-notice'), roomButton = $('race-room'), lobbyDialog = $('lobby');
  const SHAPE = { landscape: 'широкое поле', portrait: 'высокое поле' };
  const clock = {
    now: () => Date.now(),
    setTimeout: (task, wait) => setTimeout(task, wait),
    clearTimeout: (timer) => clearTimeout(timer),
  };
  let shownPhase = 'idle';
  let isBackToRoom = false;

  const race = KLAD_RACE.create({
    clock,
    isVisible: () => document.visibilityState === 'visible',
    format: KLAD_TICKS.format,
    engine: {
      start: (level, shape) => KLAD_GAME.startRace(level, shape, {
        onFinish: (ticks) => race.finish(ticks),
        ghosts: () => race.ghosts(),
      }),
      stop: () => KLAD_GAME.stopRace(),
      position: () => KLAD_GAME.racePosition(),
    },
  }, { render });

  function levelText(state) {
    const level = KLAD_LEVELS[state.level - 1];
    return 'Этап ' + state.level + (level ? ': ' + level.name : '') + ', ' + (SHAPE[state.shape] || state.shape);
  }

  function placesTable(places) {
    const table = document.createElement('table');
    table.createCaption().textContent = 'Места';
    const head = table.createTHead().insertRow();
    for (const text of ['Место', 'Ник', 'Время']) {
      const cell = document.createElement('th');
      cell.textContent = text;
      head.append(cell);
    }
    const body = table.createTBody();
    for (const entry of places) {
      const row = body.insertRow();
      if (entry.isWinner) row.className = 'winner';
      row.insertCell().textContent = entry.place === null ? '-' : String(entry.place);
      const nick = row.insertCell();
      nick.textContent = entry.nick;
      const marks = [[entry.isWinner, 'won', 'победитель'], [entry.isMine, 'mine', 'вы'], [entry.hasLeft, 'gone', 'вышел']];
      for (const [isShown, className, text] of marks) {
        if (!isShown) continue;
        const mark = document.createElement('span');
        mark.className = className;
        mark.textContent = text;
        nick.append(' ', mark);
      }
      row.insertCell().textContent = entry.time === null ? 'нет финиша' : entry.time;
    }
    return table;
  }

  /* The countdown closes the lobby (any open dialog holds the game), and so
     does a race that starts or resumes without one; go closes the countdown.
     Only a change of phase opens or closes the dialog, so Escape stays closed. */
  function showDialogFor(phase) {
    const isDialogPhase = phase === 'countdown' || phase === 'results';
    if ((isDialogPhase || phase === 'racing' || phase === 'finished') && lobbyDialog.open) lobbyDialog.close();
    if (isDialogPhase && !dialog.open) dialog.showModal();
    else if (!isDialogPhase && dialog.open) dialog.close();
    if (phase === 'results') roomButton.focus();
  }

  function render() {
    const state = race.state();
    heading.textContent = state.phase === 'results' ? 'Итоги гонки' : 'Гонка';
    levelLine.textContent = levelText(state);
    countLine.hidden = state.phase !== 'countdown';
    countLine.textContent = String(state.count);
    results.hidden = state.places === null;
    placesPart.replaceChildren(...(state.places === null ? [] : [placesTable(state.places)]));
    if (state.phase !== shownPhase) {
      shownPhase = state.phase;
      showDialogFor(state.phase);
    }
    const isInDialog = dialog.open;
    notice.textContent = isInDialog ? '' : state.notice;
    status.textContent = isInDialog ? state.notice : '';
  }

  /* The lobby opens only when no other dialog is open, so this one closes
     first. Any other close of the finish screen (Escape too) leaves the room,
     or this player blocks Start for a minute. close fires after the click. */
  roomButton.addEventListener('click', () => {
    isBackToRoom = true;
    dialog.close();
    KLAD_LOBBY.page.open();
  });
  $('race-leave').addEventListener('click', () => {
    KLAD_LOBBY.page.leave();
    dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (race.state().phase === 'results' && !isBackToRoom) KLAD_LOBBY.page.leave();
    isBackToRoom = false;
    if (!document.querySelector('dialog[open]')) canvas.focus({ preventScroll: true });
  });
  document.addEventListener('klad:race', (event) => race.begin(event.detail.room, event.detail.socket));
})();
