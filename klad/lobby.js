/* КЛАД lobby: who is in the lobby, rooms joined by an invite link, ready
   marks and the race start. Plain REST through the site's /klad/api,
   polled only while the lobby is open and the tab is visible; the
   WebSocket opens only when a room starts. The first half has no DOM, so
   the node tests can require it. */
'use strict';
const KLAD_LOBBY = (() => {
  const PRESENCE_EVERY = 30 * 1000;
  const ROOM_EVERY = 10 * 1000;
  const SOCKET_TRIES = 4;
  const SOCKET_FIRST_WAIT = 500;
  const NORMAL_CLOSE = 1000;
  const FIRST_SHAPE = 'landscape';
  const ROOM_LINK = '#room=';
  const ROOM_ID = /^[A-Za-z0-9_-]{10}$/;
  const TEXT = {
    unavailable: 'Сервер игры сейчас недоступен. Играть можно и без него.',
    offline: 'Нет связи с сервером. Игра работает и без него.',
    noPlayer: 'У этого браузера больше нет ника на сервере.',
    roomNotFound: 'Комната не найдена. Комнаты живут, только пока сервер не уснул, так что старая ссылка может не работать.',
    roomFull: 'Комната заполнена: в ней уже 4 игрока.',
    raceRunning: 'В этой комнате уже идёт гонка. Зайдите по ссылке, когда она закончится.',
    removed: 'Вы больше не в комнате: лобби было закрыто или скрыто дольше минуты.',
    tooManyRooms: 'Сейчас открыто слишком много комнат. Попробуйте позже.',
    notHost: 'Это может только хозяин комнаты.',
    notInLobby: 'Гонка уже начинается.',
    notReady: 'Старт возможен, когда готовы все, а игроков хотя бы двое.',
    refused: 'Сервер не принял это действие.',
    raceWaiting: 'Гонка начинается: ждём остальных...',
    raceUnavailable: 'Онлайн-игра недоступна в этом браузере. Обычная игра работает как прежде.',
  };
  const ACTION_ERRORS = { not_host: TEXT.notHost, not_in_lobby: TEXT.notInLobby, not_ready: TEXT.notReady };

  const errorOf = (answer) => answer.data && answer.data.error;
  const isRoomId = (id) => typeof id === 'string' && ROOM_ID.test(id);

  /* null when the hash is not a room link. The id is checked on its own,
     so a malformed one still says "room not found". */
  function roomIdOf(hash) {
    return hash.startsWith(ROOM_LINK) ? hash.slice(ROOM_LINK.length) : null;
  }

  function raceUrl(protocol, host, id) {
    return (protocol === 'http:' ? 'ws://' : 'wss://') + host + '/klad/api/race/' + id;
  }

  /* The player is the entry the API marks with "you": nicks may repeat
     among guests, so nick and kind cannot tell entries apart. An empty
     room has no players and no host. */
  function roomView(room) {
    const entries = room.players || [];
    const players = entries.map((player) => ({
      nick: player.nick, kind: player.kind, isReady: player.ready === true, isHost: player.host === true,
    }));
    const mine = players[entries.findIndex((player) => player.you === true)];
    const isHost = Boolean(mine && mine.isHost);
    return {
      id: room.id, state: room.state, level: room.level, shape: room.shape, size: room.size, players,
      isMember: Boolean(mine),
      isHost,
      isReady: Boolean(mine && mine.isReady),
      canStart: room.state === 'lobby' && isHost && players.length >= 2 && players.every((player) => player.isReady),
    };
  }

  /* One WebSocket with JSON text frames. After a drop it tries again with
     doubling waits, at most SOCKET_TRIES times in a row, then reports
     'offline' and stops: every attempt is a Workers request on the shared
     free quota. A normal close (1000) from either side ends it as 'closed'.
     on('message', listener) gets each frame parsed; on('status', listener)
     gets 'open', 'reconnecting', 'offline' or 'closed'. */
  function connect(url, WebSocket, clock) {
    const listeners = { message: [], status: [] };
    let socket = null;
    let timer = null;
    let tries = 0;
    let status = 'connecting';
    let hasOpened = false;

    function report(next) {
      status = next;
      for (const listener of listeners.status) listener(next);
    }

    function receive(data) {
      if (typeof data !== 'string') return;
      let message;
      try {
        message = JSON.parse(data);
      } catch (e) {
        return;
      }
      for (const listener of listeners.message) listener(message);
    }

    function dropped(code) {
      socket = null;
      if (code === NORMAL_CLOSE) {
        report('closed');
      } else if (tries >= SOCKET_TRIES) {
        report('offline');
      } else {
        timer = clock.setTimeout(attempt, SOCKET_FIRST_WAIT * 2 ** tries);
        tries++;
        report('reconnecting');
      }
    }

    /* A browser without WebSocket, or one that refuses the URL, throws
       here; trying again cannot help. */
    function attempt() {
      timer = null;
      let current = null;
      try {
        current = new WebSocket(url);
      } catch (e) {
        current = null;
      }
      socket = current;
      if (current === null) {
        report('offline');
        return;
      }
      current.onopen = () => {
        if (current !== socket) return;
        tries = 0;
        hasOpened = true;
        report('open');
      };
      current.onmessage = (event) => { if (current === socket) receive(event.data); };
      current.onclose = (event) => { if (current === socket) dropped(event.code); };
    }

    function send(message) {
      const isSent = status === 'open';
      if (isSent) socket.send(JSON.stringify(message));
      return isSent;
    }

    function close() {
      clock.clearTimeout(timer);
      timer = null;
      const current = socket;
      socket = null;
      if (current !== null) current.close(NORMAL_CLOSE);
      if (status !== 'closed') report('closed');
    }

    /* The first try waits for the next turn, so listeners added right
       after connect() see every status. */
    timer = clock.setTimeout(attempt, 0);
    return {
      send,
      close,
      on(type, listener) { listeners[type].push(listener); },
      status: () => status,
      hasOpened: () => hasOpened,
    };
  }

  /* Runs task every interval while canRun() holds, and never sooner than
     interval after its last run however often it is stopped and started,
     so a tab that is hidden and shown again does not raise the rate. now()
     runs it at once, for the poll after an own action. */
  function every(clock, interval, canRun, task) {
    let timer = null;
    let last = -Infinity;

    function run() {
      timer = null;
      if (!canRun()) return;
      last = clock.now();
      timer = clock.setTimeout(run, interval);
      task();
    }

    return {
      start() {
        if (timer !== null) return;
        const wait = last + interval - clock.now();
        if (wait > 0) timer = clock.setTimeout(run, wait);
        else run();
      },
      stop() {
        clock.clearTimeout(timer);
        timer = null;
      },
      now() {
        clock.clearTimeout(timer);
        run();
      },
    };
  }

  /* environment: call(method, path, body) as in online.js, clock (now,
     setTimeout, clearTimeout), isVisible(), player(), refreshPlayer(),
     isAvailable(), shape() and openSocket(roomId). page: render(),
     askNick() and race(room, socket), the hand-off at race start. */
  function create(environment, page) {
    const { call, clock } = environment;
    let isOpen = false;
    let phase = 'closed';
    let message = '';
    let online = null;
    let isOnlineDown = false;
    let roomId = null;
    let room = null;
    let isRoomDown = false;
    let pendingRoom = null;
    let isWaitingForNick = false;
    let isBusy = false;
    let roomRequest = 0;
    let socket = null;

    /* No room poll while an own action is out: its answer would be dropped
       as older, and a poll before a join's answer would not list this
       player yet. Every action ends with a poll of its own. */
    const isActive = () => isOpen && phase === 'ready' && environment.isVisible();
    const presence = every(clock, PRESENCE_EVERY, isActive, beat);
    const roomPoll = every(clock, ROOM_EVERY, () => isActive() && roomId !== null && !isBusy, poll);
    const roomPath = (action) => '/rooms/' + roomId + (action ? '/' + action : '');

    /* What runs is decided here alone: both polls only while the lobby is
       open and the tab visible, and a room link waits for that too. */
    function resume() {
      if (isActive()) presence.start();
      else presence.stop();
      if (isActive() && roomId !== null) roomPoll.start();
      else roomPoll.stop();
      if (isActive() && pendingRoom !== null && !isBusy) {
        const id = pendingRoom;
        pendingRoom = null;
        join(id);
      }
    }

    function closeSocket() {
      if (socket !== null) socket.close();
      socket = null;
    }

    function forgetRoom(text) {
      closeSocket();
      roomId = null;
      room = null;
      isRoomDown = false;
      roomRequest++;
      message = text;
      roomPoll.stop();
    }

    function lostPlayer() {
      forgetRoom(TEXT.noPlayer);
      phase = 'no-nick';
      online = null;
      resume();
    }

    /* The race takes the socket from here, through page.race(). The lobby
       only opens it, and closes it on leaving or once the room is back in
       the lobby, so it never keeps reconnecting after a race. */
    function startRace() {
      socket = environment.openSocket(roomId);
      socket.on('status', () => page.render());
      page.race(room, socket);
    }

    function showRoom(data) {
      isRoomDown = false;
      if (!roomView(data).isMember) {
        forgetRoom(TEXT.removed);
      } else {
        room = data;
        if (data.state === 'lobby') closeSocket();
        else if (data.state === 'starting' && socket === null) startRace();
      }
    }

    /* A room answer to a poll or an own action. A room is shown only from
       the newest request, so a late answer cannot undo a newer one. */
    function take(answer, isNewest) {
      const code = errorOf(answer);
      if (answer.status === 200) {
        if (isNewest && answer.data && answer.data.id === roomId) showRoom(answer.data);
      } else if (answer.status === 401) {
        lostPlayer();
      } else if (answer.status === 404) {
        forgetRoom(TEXT.roomNotFound);
      } else if (answer.status === 0 || answer.status >= 500) {
        isRoomDown = true;
      } else {
        message = ACTION_ERRORS[code] || TEXT.refused;
      }
    }

    async function poll() {
      const request = ++roomRequest;
      const answer = await call('GET', roomPath());
      if (request === roomRequest) take(answer, true);
      page.render();
    }

    /* POST /presence first, so the list includes this player. */
    async function beat() {
      const heartbeat = await call('POST', '/presence');
      const list = heartbeat.status === 401 ? heartbeat : await call('GET', '/presence');
      if (phase !== 'ready') return;
      if (list.status === 401) {
        lostPlayer();
      } else if (list.status === 200 && list.data && Array.isArray(list.data.players)) {
        online = list.data.players;
        isOnlineDown = false;
      } else {
        isOnlineDown = true;
      }
      page.render();
    }

    /* An answer that comes back after the player left the room is dropped. */
    async function act(action, body) {
      if (isBusy || roomId === null) return;
      const id = roomId;
      isBusy = true;
      message = '';
      const request = ++roomRequest;
      page.render();
      const answer = await call('POST', roomPath(action), body);
      isBusy = false;
      if (id === roomId) take(answer, request === roomRequest);
      page.render();
      roomPoll.now();
    }

    async function join(id) {
      if (id === roomId) {
        roomPoll.now();
        return;
      }
      forgetRoom('');
      roomId = id;
      isBusy = true;
      const request = ++roomRequest;
      page.render();
      const answer = await call('POST', roomPath('join'));
      isBusy = false;
      if (request !== roomRequest) return;
      const code = errorOf(answer);
      if (answer.status === 200 && answer.data && answer.data.id === id) showRoom(answer.data);
      else if (answer.status === 401) lostPlayer();
      else if (answer.status === 404) forgetRoom(TEXT.roomNotFound);
      else if (code === 'room_full') forgetRoom(TEXT.roomFull);
      else if (code === 'not_in_lobby') forgetRoom(TEXT.raceRunning);
      else forgetRoom(TEXT.unavailable);
      page.render();
      roomPoll.now();
      resume();
    }

    /* A new room is level 1 in the landscape shape; a host in portrait
       sends its shape with that first level choice. */
    async function createRoom() {
      if (isBusy || roomId !== null) return;
      isBusy = true;
      message = '';
      page.render();
      const answer = await call('POST', '/rooms');
      isBusy = false;
      if (answer.status === 201 && answer.data && isRoomId(answer.data.id)) {
        forgetRoom('');
        roomId = answer.data.id;
        const shape = environment.shape();
        if (shape !== FIRST_SHAPE) await act('level', { level: 1, shape });
        else roomPoll.now();
      } else if (answer.status === 401) {
        lostPlayer();
      } else {
        message = answer.status === 429 ? TEXT.tooManyRooms : TEXT.unavailable;
      }
      page.render();
      resume();
    }

    function toggleReady() {
      if (room === null) return Promise.resolve();
      return act('ready', { ready: !roomView(room).isReady });
    }

    function chooseLevel(level) {
      return act('level', { level, shape: environment.shape() });
    }

    function start() {
      return act('start');
    }

    function leave() {
      if (roomId === null) return Promise.resolve();
      const path = roomPath('leave');
      forgetRoom('');
      page.render();
      return call('POST', path);
    }

    /* linkId is the id from a #room= link. A malformed one sends nothing. */
    async function open(linkId) {
      isOpen = true;
      message = '';
      if (linkId !== undefined && !isRoomId(linkId)) {
        pendingRoom = null;
        message = TEXT.roomNotFound;
        if (phase !== 'ready') phase = 'message';
        page.render();
        return;
      }
      if (linkId !== undefined) pendingRoom = linkId;
      phase = 'checking';
      page.render();
      await environment.refreshPlayer();
      if (!isOpen) return;
      if (!environment.isAvailable()) {
        phase = 'unavailable';
        message = TEXT.unavailable;
      } else if (!environment.player()) {
        phase = 'no-nick';
        if (pendingRoom !== null) askNick();
      } else {
        phase = 'ready';
      }
      page.render();
      resume();
    }

    /* Closing in the lobby state leaves the room, or the ready mark would
       stay for the API's minute. A starting or running race keeps it: the
       race closes this dialog to play. */
    function close() {
      isOpen = false;
      phase = 'closed';
      if (roomId !== null && (room === null || room.state === 'lobby')) leave();
      resume();
    }

    function askNick() {
      isWaitingForNick = true;
      page.askNick();
    }

    /* After the nick prompt the lobby goes on only if a player exists now;
       a skip drops the room link. True means: open the lobby again. */
    function afterNick() {
      if (!isWaitingForNick) return false;
      isWaitingForNick = false;
      const hasPlayer = Boolean(environment.player());
      if (!hasPlayer) pendingRoom = null;
      return hasPlayer;
    }

    function raceText() {
      let text = '';
      if (socket !== null && socket.status() === 'offline') text = socket.hasOpened() ? TEXT.offline : TEXT.raceUnavailable;
      else if (socket !== null && socket.status() !== 'closed') text = TEXT.raceWaiting;
      return text;
    }

    function state() {
      return {
        phase, message, online, isOnlineDown, roomId, isRoomDown,
        room: room === null ? null : roomView(room),
        race: raceText(),
      };
    }

    return {
      open, close, askNick, afterNick, createRoom, toggleReady, chooseLevel, start, leave, state,
      onVisibility: resume,
    };
  }

  return {
    create, connect, roomIdOf, isRoomId, raceUrl, roomView, TEXT,
    PRESENCE_EVERY, ROOM_EVERY, SOCKET_TRIES, SOCKET_FIRST_WAIT,
  };
})();
if (typeof module !== 'undefined') module.exports = KLAD_LOBBY;

/* The page half: the lobby dialog, its HUD button and the room link. */
if (typeof document !== 'undefined') (() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), dialog = $('lobby'), status = $('lobby-status'), noNick = $('lobby-no-nick'),
        main = $('lobby-main'), onlineStatus = $('lobby-online-status'), onlineList = $('lobby-online'),
        out = $('lobby-out'), createButton = $('lobby-create');
  const roomPart = $('lobby-room'), link = $('lobby-link'), copyButton = $('lobby-copy'), copyNote = $('lobby-copy-note'),
        roomStatus = $('lobby-room-status'), playerList = $('lobby-players'), levelLine = $('lobby-level-line'),
        levelRow = $('lobby-level-row'), levelSelect = $('lobby-level'), startNote = $('lobby-start-note'),
        readyButton = $('lobby-ready'), startButton = $('lobby-start'), leaveButton = $('lobby-leave'),
        raceLine = $('lobby-race');
  const { TEXT } = KLAD_LOBBY;
  const shared = KLAD_ONLINE.page;
  const KIND = { human: 'человек', agent: 'агент' };
  const SHAPE = { landscape: 'широкое поле', portrait: 'высокое поле' };
  const clock = {
    now: () => Date.now(),
    setTimeout: (task, wait) => setTimeout(task, wait),
    clearTimeout: (timer) => clearTimeout(timer),
  };

  const lobby = KLAD_LOBBY.create({
    call: (method, path, body) => KLAD_ONLINE.request((url, options) => fetch(url, options), method, path, body),
    clock,
    isVisible: () => document.visibilityState === 'visible',
    player: shared.player,
    refreshPlayer: shared.refresh,
    isAvailable: shared.isAvailable,
    shape: () => matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape',
    openSocket: (id) => KLAD_LOBBY.connect(KLAD_LOBBY.raceUrl(location.protocol, location.host, id), window.WebSocket, clock),
  }, {
    render,
    askNick() {
      dialog.close();
      shared.ask();
    },
    /* The race listens for this on document. detail.room is the polled
       room (id, level, shape, players), detail.socket the open connection
       from KLAD_LOBBY.connect. */
    race(room, socket) {
      document.dispatchEvent(new CustomEvent('klad:race', { detail: { room, socket } }));
    },
  });

  for (const [i, level] of KLAD_LEVELS.entries()) {
    levelSelect.add(new Option('этап ' + (i + 1) + ': ' + level.name, String(i + 1)));
  }

  function person(nick, marks) {
    const item = document.createElement('li');
    item.textContent = nick;
    for (const [className, text] of marks) {
      const mark = document.createElement('span');
      mark.className = className;
      mark.textContent = text;
      item.append(' ', mark);
    }
    return item;
  }

  function levelText(view) {
    const level = KLAD_LEVELS[view.level - 1];
    return 'Этап ' + view.level + (level ? ': ' + level.name : '') + ', ' + (SHAPE[view.shape] || view.shape);
  }

  function renderOnline(state) {
    onlineStatus.textContent = state.isOnlineDown ? TEXT.offline : (state.online ? '' : 'загрузка');
    onlineList.replaceChildren(...(state.online || []).map((player) => person(player.nick, [
      [player.guest ? 'guest' : 'account', player.guest ? 'гость' : 'аккаунт'],
      ['kind', KIND[player.kind] || player.kind],
    ])));
  }

  function renderRoom(state) {
    const view = state.room;
    const isLobby = Boolean(view && view.state === 'lobby');
    link.value = location.origin + '/klad/#room=' + state.roomId;
    roomStatus.textContent = state.isRoomDown ? TEXT.offline
      : (view ? 'Игроков: ' + view.players.length + ' из ' + view.size : 'загрузка');
    playerList.replaceChildren(...(view ? view.players : []).map((player) => {
      const marks = [];
      if (player.isHost) marks.push(['host', 'хозяин']);
      marks.push(player.isReady ? ['ready', 'готов'] : ['waiting', 'не готов']);
      return person(player.nick, marks);
    }));
    levelLine.textContent = view ? levelText(view) : '';
    levelRow.hidden = !(view && view.isHost);
    if (view && document.activeElement !== levelSelect) levelSelect.value = String(view.level);
    levelSelect.disabled = !isLobby;
    readyButton.hidden = !view;
    readyButton.disabled = !isLobby;
    readyButton.setAttribute('aria-pressed', String(Boolean(view && view.isReady)));
    startButton.hidden = !(view && view.canStart);
    startNote.textContent = view && view.isHost && isLobby && !view.canStart
      ? 'Кнопка «Старт» появится, когда готовы все, а игроков хотя бы двое.' : '';
    raceLine.textContent = state.race || (view && view.state === 'racing' ? 'В комнате идёт гонка.' : '');
  }

  /* Buttons are not disabled while a request is out: a disabled button
     loses the keyboard focus, and the logic half drops a second action. */
  function render() {
    const state = lobby.state();
    const isReady = state.phase === 'ready';
    status.textContent = state.phase === 'checking' ? 'загрузка' : state.message;
    noNick.hidden = state.phase !== 'no-nick';
    main.hidden = !isReady;
    out.hidden = !isReady || state.roomId !== null;
    roomPart.hidden = !isReady || state.roomId === null;
    if (isReady) renderOnline(state);
    if (isReady && state.roomId !== null) renderRoom(state);
    if (state.roomId === null) copyNote.textContent = '';
  }

  /* Focus goes back to the field, as after the other dialogs. */
  function backToGame() {
    if (!document.querySelector('dialog[open]')) canvas.focus({ preventScroll: true });
  }

  function showLobby(linkId) {
    if (!dialog.open) {
      if (document.querySelector('dialog[open]')) return;
      dialog.showModal();
    }
    lobby.open(linkId);
  }

  function openLink() {
    const linkId = KLAD_LOBBY.roomIdOf(location.hash);
    if (linkId !== null) showLobby(linkId);
  }

  $('h-lobby').addEventListener('click', () => showLobby());
  $('lobby-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    lobby.close();
    backToGame();
  });
  $('nick').addEventListener('close', () => { if (lobby.afterNick()) showLobby(); });
  $('lobby-choose').addEventListener('click', () => lobby.askNick());

  createButton.addEventListener('click', async () => {
    await lobby.createRoom();
    if (!roomPart.hidden) copyButton.focus();
  });
  copyButton.addEventListener('click', async () => {
    let isCopied = false;
    try {
      await navigator.clipboard.writeText(link.value);
      isCopied = true;
    } catch (e) {
      isCopied = false;
    }
    if (!isCopied) link.select();
    copyNote.textContent = isCopied ? 'Ссылка скопирована.' : 'Скопировать не получилось: ссылка выделена, скопируйте её сами.';
  });
  readyButton.addEventListener('click', () => lobby.toggleReady());
  levelSelect.addEventListener('change', () => lobby.chooseLevel(Number(levelSelect.value)));
  startButton.addEventListener('click', async () => {
    await lobby.start();
    if (startButton.hidden) leaveButton.focus();
  });
  leaveButton.addEventListener('click', () => {
    lobby.leave();
    createButton.focus();
  });

  document.addEventListener('visibilitychange', () => lobby.onVisibility());
  addEventListener('hashchange', openLink);
  openLink();
})();
