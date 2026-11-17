/* КЛАД lobby: presence, rooms by invite link, ready marks, race start, and
   the room chat's messages and send (chat.js shows them). The first half
   has no DOM, so the node tests can require it. The interface is in
   klad/README.md. */
'use strict';
const KLAD_LOBBY = (() => {
  const PRESENCE_EVERY = 30 * 1000;
  const ROOM_EVERY = 10 * 1000;
  const SWEEP_AFTER = 60 * 1000;
  const REJOIN_AFTER = SWEEP_AFTER - 5 * 1000;
  const SOCKET_TRIES = 4;
  const SOCKET_RECONNECTS = 8;
  const SOCKET_FIRST_WAIT = 500;
  const NORMAL_CLOSE = 1000;
  const POLICY_CLOSE = 1008;
  const REPLACED_REASON = 'replaced';
  const FIRST_SHAPE = 'landscape';
  const ROOM_LINK = '#room=';
  const ROOM_ID = /^[A-Za-z0-9_-]{10}$/;
  const CHAT_KEPT = 30;
  const CHAT_TEXT_MAX = 120;
  const AFTER_MAX = 999999999;
  const TEXT = {
    unavailable: 'Сервер игры сейчас недоступен. Играть можно и без него.',
    offline: 'Нет связи с сервером. Игра работает и без него.',
    noPlayer: 'У этого браузера больше нет ника на сервере.',
    roomNotFound: 'Комната не найдена. Комнаты живут, только пока сервер не уснул, так что старая ссылка может не работать.',
    roomFull: 'Комната заполнена: свободных мест нет.',
    raceRunning: 'В этой комнате уже идёт гонка. Зайдите по ссылке, когда она закончится.',
    removed: 'Вы больше не в этой комнате: вы вышли из неё в другой вкладке, или гонка началась без вас.',
    tooManyRooms: 'Сейчас открыто слишком много комнат. Попробуйте позже.',
    notHost: 'Это может только хозяин комнаты.',
    roomsDown: 'Сервер не отвечает: список комнат не загрузился. Остальное в лобби работает.',
    notInLobby: 'Гонка уже начинается.',
    notReady: 'Старт возможен, когда готовы все, а игроков хотя бы двое.',
    refused: 'Сервер не принял это действие.',
    raceWaiting: 'Гонка начинается: ждём остальных...',
    inviteSubject: 'Приглашение в КЛАД',
    inviteBody: 'Заходи играть вместе в КЛАД. Комната здесь: ',
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

  /* The mail app opens with the subject and text filled in and no receiver.
     The link sits inside the text, so it is encoded whole. */
  function inviteMailto(roomLink) {
    return 'mailto:?subject=' + encodeURIComponent(TEXT.inviteSubject)
      + '&body=' + encodeURIComponent(TEXT.inviteBody + roomLink);
  }

  function raceUrl(protocol, host, id) {
    return (protocol === 'http:' ? 'ws://' : 'wss://') + host + '/klad/api/race/' + id;
  }

  /* One line of the open rooms. Only a lobby room with a free place can be
     joined from the list; the API says the rest with its own errors. */
  function roomLine(entry) {
    const host = entry.host && typeof entry.host.nick === 'string' ? entry.host.nick : '';
    return {
      id: entry.id, state: entry.state, hostNick: host, players: entry.players, size: entry.size,
      level: entry.level, shape: entry.shape,
      isFull: entry.players >= entry.size,
      canJoin: entry.state === 'lobby' && entry.players < entry.size,
    };
  }

  /* The player is the entry the API marks with "you": nicks may repeat
     among guests, so nick and kind cannot tell entries apart. An empty
     room has no players and no host. */
  function roomView(room) {
    const entries = room.players || [];
    const players = entries.map((player) => ({
      nick: player.nick, kind: player.kind, isReady: player.ready === true, isHost: player.host === true,
      member: player.member, isMine: player.you === true,
    }));
    const mine = players[entries.findIndex((player) => player.you === true)];
    const isHost = Boolean(mine && mine.isHost);
    return {
      id: room.id, state: room.state, level: room.level, shape: room.shape, size: room.size, players,
      isMember: Boolean(mine),
      isHost,
      isReady: Boolean(mine && mine.isReady),
      isListed: room.listed !== false,
      canStart: room.state === 'lobby' && isHost && players.length >= 2 && players.every((player) => player.isReady),
    };
  }

  /* n goes back to the API as after=, which takes at most 9 digits, so a
     larger one would make every later poll a 400. */
  function isMessage(message) {
    return Boolean(message) && Number.isInteger(message.n) && message.n >= 1 && message.n <= AFTER_MAX
      && Number.isInteger(message.member) && typeof message.nick === 'string'
      && (message.kind === 'human' || message.kind === 'agent')
      && typeof message.text === 'string' && message.text.length >= 1 && message.text.length <= CHAT_TEXT_MAX;
  }

  function chatMessage(message) {
    return {
      n: message.n, member: message.member, nick: message.nick, kind: message.kind,
      isGuest: message.guest === true, isMine: message.you === true, text: message.text,
    };
  }

  /* Nicks that two members of the room have, among the members and the
     senders of the kept messages; these are shown with the member number.
     The player's own entries count as one, since a re-join gives a new
     number. */
  function sharedNicks(players, messages) {
    const membersByNick = new Map();
    for (const entry of [...players, ...messages]) {
      if (!Number.isInteger(entry.member)) continue;
      if (!membersByNick.has(entry.nick)) membersByNick.set(entry.nick, new Set());
      membersByNick.get(entry.nick).add(entry.isMine ? 'mine' : entry.member);
    }
    return [...membersByNick].filter(([, members]) => members.size >= 2).map(([nick]) => nick);
  }

  /* Every attempt is a Workers request on the shared quota, so retries are
     capped. 1008 is a client bug a retry would repeat. */
  function connect(url, WebSocket, clock) {
    const listeners = { message: [], status: [] };
    let socket = null;
    let timer = null;
    let tries = 0;
    let reconnects = 0;
    let status = 'connecting';
    let hasOpened = false;
    let hasLeft = false;
    let wasReplaced = false;

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

    function dropped(code, reason) {
      socket = null;
      if (code === NORMAL_CLOSE) {
        wasReplaced = reason === REPLACED_REASON;
        report('closed');
      } else if (code === POLICY_CLOSE || tries >= SOCKET_TRIES || reconnects >= SOCKET_RECONNECTS) {
        report('offline');
      } else {
        timer = clock.setTimeout(attempt, SOCKET_FIRST_WAIT * 2 ** tries);
        tries++;
        reconnects++;
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
      current.onclose = (event) => { if (current === socket) dropped(event.code, event.reason); };
    }

    function send(message) {
      const isSent = status === 'open';
      if (isSent) socket.send(JSON.stringify(message));
      return isSent;
    }

    function close(isLeaving) {
      hasLeft = isLeaving === true;
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
      hasLeft: () => hasLeft,
      wasReplaced: () => wasReplaced,
    };
  }

  /* Never sooner than interval after the last run, however often it is
     stopped and started, so hiding and showing the tab does not raise the rate. */
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

  /* environment and page are described in klad/README.md (Lobby). */
  function create(environment, page) {
    const { call, clock } = environment;
    let isOpen = false;
    let phase = 'closed';
    let message = '';
    let online = null;
    let isOnlineDown = false;
    let rooms = null;
    let isRoomsDown = false;
    let roomsRequest = 0;
    let roomId = null;
    let room = null;
    let isRoomDown = false;
    let pendingRoom = null;
    let isWaitingForNick = false;
    let isBusy = false;
    let isJoining = false;
    let leaveAfterJoin = null;
    let roomRequest = 0;
    let lastSeen = -Infinity;
    let socket = null;
    let messages = [];
    let chatAfter = 0;
    let hiddenMembers = new Set();
    let isSending = false;

    /* No room poll while an own action is out: its answer would be dropped
       as older. Every action ends with a poll of its own. */
    const isActive = () => isOpen && phase === 'ready' && environment.isVisible();
    const presence = every(clock, PRESENCE_EVERY, isActive, beat);
    const roomPoll = every(clock, ROOM_EVERY, () => isActive() && roomId !== null && !isBusy, poll);
    const roomPath = (action) => '/rooms/' + roomId + (action ? '/' + action : '');
    const pollPath = () => roomPath() + (chatAfter > 0 ? '?after=' + chatAfter : '');

    /* What runs is decided here alone; a room link waits for a visible tab. */
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

    function closeSocket(isLeaving) {
      if (socket !== null) socket.close(isLeaving);
      socket = null;
    }

    /* Member numbers count from 1 in every room, so the hides go with the room. */
    function forgetRoom(text) {
      closeSocket();
      roomId = null;
      room = null;
      isRoomDown = false;
      roomRequest++;
      message = text;
      messages = [];
      chatAfter = 0;
      hiddenMembers = new Set();
      roomPoll.stop();
    }

    /* A room answer holds every message above the after number it was asked
       with, so only room answers move that number: the send's answer can
       carry a number above messages of others that have not arrived yet. */
    function keepMessages(list, isRoomAnswer) {
      if (!Array.isArray(list)) return;
      for (const message of list.filter(isMessage)) {
        if (!messages.some((kept) => kept.n === message.n)) messages.push(chatMessage(message));
        if (isRoomAnswer) chatAfter = Math.max(chatAfter, message.n);
      }
      messages.sort((first, second) => first.n - second.n);
      messages = messages.slice(-CHAT_KEPT);
    }

    function forgetRooms() {
      rooms = null;
      isRoomsDown = false;
    }

    function lostPlayer() {
      forgetRoom(TEXT.noPlayer);
      phase = 'no-nick';
      online = null;
      forgetRooms();
      resume();
    }

    /* The lobby closes the socket once the room is back in the lobby, so it
       never keeps reconnecting after a race. */
    function startRace() {
      const current = environment.openSocket(roomId);
      socket = current;
      current.on('status', () => page.render());
      current.on('message', (data) => { if (current === socket) takeChat(data); });
      page.race(room, current);
    }

    /* A chat frame of the race socket (contract section 8) is kept at once,
       checked like a poll message. It is not a room answer, so `after` stays
       where it was and the poll after the race lists the same message again
       by its `n`, together with any the socket missed. A frame is never the
       player's own, whatever it says. */
    function takeChat(data) {
      if (!data || data.type !== 'chat' || !isMessage(data)) return;
      keepMessages([{ ...data, you: false }], false);
      page.render();
    }

    /* The API drops a member whose socket has not connected 15 s after
       Start, so a socket that never opened is the reason, not another tab.
       A reload in a race finds it racing; a reconnect within 30 s resumes. */
    function showRoom(data) {
      isRoomDown = false;
      if (!roomView(data).isMember) {
        forgetRoom(socket !== null && !socket.hasOpened() ? TEXT.raceUnavailable : TEXT.removed);
      } else {
        lastSeen = clock.now();
        room = data;
        keepMessages(data.messages, true);
        if (data.state === 'lobby') closeSocket();
        else if ((data.state === 'starting' || data.state === 'racing') && socket === null) startRace();
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

    const wasDropped = (answer) => answer.status === 200 && answer.data && answer.data.id === roomId
      && answer.data.state === 'lobby' && !roomView(answer.data).isMember;

    /* The API drops a member unseen for 60 s. Only a room answer that lists
       this player counts as seen: a heartbeat answers 204 even after the
       sweep. The margin covers the answer's round trip. */
    const isLongUnseen = () => clock.now() - lastSeen > REJOIN_AFTER;

    async function poll() {
      const request = ++roomRequest;
      const wasLongUnseen = isLongUnseen();
      const answer = await call('GET', pollPath());
      if (request !== roomRequest) {
        page.render();
        return;
      }
      if (wasLongUnseen && wasDropped(answer)) {
        if (isActive()) await enter();
        page.render();
      } else {
        take(answer, true);
        page.render();
        if (roomId === null) listRooms();
      }
    }

    /* The open rooms, only while the player is in no room. An answer that
       comes back after a newer request or after joining a room is dropped. */
    async function listRooms() {
      if (!isActive() || roomId !== null) return;
      const request = ++roomsRequest;
      const answer = await call('GET', '/rooms');
      if (request !== roomsRequest || phase !== 'ready' || roomId !== null) return;
      if (answer.status === 401) {
        lostPlayer();
      } else if (answer.status === 200 && answer.data && Array.isArray(answer.data.rooms)) {
        rooms = answer.data.rooms.filter((entry) => entry && isRoomId(entry.id)).map(roomLine);
        isRoomsDown = false;
      } else {
        isRoomsDown = true;
      }
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
      await listRooms();
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
      if (id === roomId && answer.status === 404 && isLongUnseen()) {
        if (isActive()) await enter();
        else page.render();
        return;
      }
      if (id === roomId) take(answer, request === roomRequest);
      page.render();
      roomPoll.now();
      if (roomId === null) listRooms();
    }

    async function join(id) {
      if (id === roomId) {
        roomPoll.now();
        return;
      }
      leave();
      forgetRoom('');
      forgetRooms();
      roomId = id;
      await enter();
    }

    /* The join button of the list: only while in no room and nothing is out. */
    function joinFromList(id) {
      if (isBusy || roomId !== null || !isRoomId(id)) return Promise.resolve();
      message = '';
      return join(id);
    }

    /* A re-join keeps the room shown until it answers. A leave asked for
       meanwhile goes out only after the join answers: the API could handle
       it first and then add the player. */
    async function enter() {
      const id = roomId;
      const isRejoin = room !== null;
      isBusy = true;
      isJoining = true;
      const request = ++roomRequest;
      page.render();
      const answer = await call('POST', roomPath('join'));
      isBusy = false;
      isJoining = false;
      const isNetworkFailure = answer.status === 0 || answer.status >= 500;
      if (leaveAfterJoin === id) {
        leaveAfterJoin = null;
        if (answer.status === 200 || isNetworkFailure) call('POST', '/rooms/' + id + '/leave');
        page.render();
        resume();
        return;
      }
      if (request !== roomRequest) return;
      if (!isOpen) {
        if (answer.status === 200 || isNetworkFailure) leave();
        else forgetRoom('');
        return;
      }
      const code = errorOf(answer);
      if (answer.status === 200 && answer.data && answer.data.id === id) showRoom(answer.data);
      else if (answer.status === 401) lostPlayer();
      else if (answer.status === 404) forgetRoom(TEXT.roomNotFound);
      else if (code === 'room_full') forgetRoom(TEXT.roomFull);
      else if (code === 'not_in_lobby') forgetRoom(TEXT.raceRunning);
      else if (isRejoin && isNetworkFailure) isRoomDown = true;
      else forgetRoom(TEXT.unavailable);
      page.render();
      if (!(isRejoin && isNetworkFailure)) roomPoll.now();
      if (roomId === null) listRooms();
      resume();
    }

    /* A new room is level 1 in the landscape shape; a host in portrait
       sends its shape with that first level choice. A room made after the
       lobby closed is left at once. */
    async function createRoom(isListed) {
      if (isBusy || roomId !== null) return;
      isBusy = true;
      message = '';
      page.render();
      const answer = await call('POST', isListed === false ? '/rooms?listed=false' : '/rooms');
      isBusy = false;
      if (answer.status === 201 && answer.data && isRoomId(answer.data.id)) {
        forgetRoom('');
        forgetRooms();
        roomId = answer.data.id;
        lastSeen = clock.now();
        const shape = environment.shape();
        if (!isOpen) leave();
        else if (shape !== FIRST_SHAPE) await act('level', { level: 1, shape });
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

    function setListed(isListed) {
      return act('listed', { listed: isListed === true });
    }

    /* A chat message is one request: unlike act() it takes no room answer,
       so it neither holds the poll nor asks for one. null means nothing was
       sent, or the player left the room before the answer. */
    async function sendMessage(text) {
      if (room === null || isSending) return null;
      const id = roomId;
      isSending = true;
      const answer = await call('POST', roomPath('messages'), { text });
      isSending = false;
      if (id !== roomId) return null;
      if (answer.status === 201) keepMessages([answer.data], false);
      else if (answer.status === 401) lostPlayer();
      page.render();
      return answer;
    }

    function toggleMemberHidden(member) {
      if (hiddenMembers.has(member)) hiddenMembers.delete(member);
      else hiddenMembers.add(member);
      page.render();
    }

    /* The player's own leave: the open rooms are fetched once more, after
       the leave has answered, so the list does not still count this player. */
    function leaveRoom() {
      const wasInRoom = roomId !== null;
      const sent = leave();
      if (wasInRoom) sent.then(() => listRooms());
      return sent;
    }

    function leave() {
      if (roomId === null) return Promise.resolve();
      const path = roomPath('leave');
      if (isJoining) leaveAfterJoin = roomId;
      closeSocket(true);
      forgetRoom('');
      page.render();
      return isJoining ? Promise.resolve() : call('POST', path);
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

    /* A live race socket keeps the room, and so does one that another tab
       took over: leaving here would end the race in that tab. The race
       closes this dialog with isKeepingRoom when it needs the screen. A
       join still out leaves in enter(). */
    function close(isKeepingRoom) {
      isOpen = false;
      phase = 'closed';
      const isRaceLive = socket !== null
        && (socket.wasReplaced() || (socket.status() !== 'closed' && socket.status() !== 'offline'));
      if (!isJoining && roomId !== null && !isRaceLive && isKeepingRoom !== true) leave();
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
      else if (socket !== null && socket.status() !== 'closed' && room !== null && room.state === 'starting') text = TEXT.raceWaiting;
      return text;
    }

    function state() {
      const view = room === null ? null : roomView(room);
      return {
        phase, message, online, isOnlineDown, rooms, isRoomsDown, roomId, isRoomDown, isBusy,
        room: view,
        race: raceText(),
        messages: messages.slice(), hiddenMembers: [...hiddenMembers],
        sharedNicks: sharedNicks(view === null ? [] : view.players, messages),
      };
    }

    return {
      open, close, askNick, afterNick, createRoom, joinFromList, toggleReady, chooseLevel, start, setListed, leave: leaveRoom, state,
      sendMessage, toggleMemberHidden,
      onVisibility: resume,
    };
  }

  return {
    create, connect, ROOM_LINK, roomIdOf, inviteMailto, isRoomId, raceUrl, roomView, sharedNicks, TEXT,
    PRESENCE_EVERY, ROOM_EVERY, SWEEP_AFTER, REJOIN_AFTER, SOCKET_TRIES, SOCKET_RECONNECTS, SOCKET_FIRST_WAIT,
    CHAT_KEPT,
  };
})();
if (typeof module !== 'undefined') module.exports = KLAD_LOBBY;

/* The page half: the lobby dialog, its HUD button and the room link. */
if (typeof document !== 'undefined') (() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), dialog = $('lobby'), status = $('lobby-status'), noNick = $('lobby-no-nick'),
        main = $('lobby-main'), onlineTitle = $('lobby-online-title'), roomsTitle = $('lobby-rooms-title'),
        roomsStatus = $('lobby-rooms-status'), roomsList = $('lobby-rooms'), privateBox = $('lobby-private'),
        listedLine = $('lobby-listed-line'), listedRow = $('lobby-listed-row'), linkOnlyBox = $('lobby-link-only'),
        onlineStatus = $('lobby-online-status'), onlineList = $('lobby-online'),
        out = $('lobby-out'), createButton = $('lobby-create');
  const roomPart = $('lobby-room'), link = $('lobby-link'), mailLink = $('lobby-mail'), copyButton = $('lobby-copy'), copyNote = $('lobby-copy-note'),
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
    onlineTitle.textContent = 'Сейчас в лобби' + (state.online ? ': ' + state.online.length : '');
    onlineStatus.textContent = state.isOnlineDown ? TEXT.offline : (state.online ? '' : 'загрузка');
    onlineList.replaceChildren(...(state.online || []).map((player) => person(player.nick, [
      [player.guest ? 'guest' : 'account', player.guest ? 'гость' : 'аккаунт'],
      ['kind', KIND[player.kind] || player.kind],
    ])));
  }

  /* The room and its button are one list item. Nick and level text go in
     with textContent only. */
  function roomItem(line) {
    const item = document.createElement('li');
    const host = document.createElement('span');
    host.textContent = line.hostNick;
    const details = document.createElement('span');
    details.className = 'kind';
    details.textContent = 'игроков ' + line.players + ' из ' + line.size + ', ' + levelText(line);
    item.append(host, ' ', details, ' ');
    if (line.canJoin) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Войти';
      button.dataset.roomId = line.id;
      button.addEventListener('click', async () => {
        await lobby.joinFromList(line.id);
        if (!roomPart.hidden) copyButton.focus();
        else focusRoomButton(line.id);
      });
      item.append(button);
    } else {
      const mark = document.createElement('span');
      mark.className = 'full';
      mark.textContent = line.state === 'racing' ? 'идёт гонка' : (line.state === 'starting' ? 'гонка начинается' : 'заполнена');
      item.append(mark);
    }
    return item;
  }

  const roomKey = (line) => [line.id, line.state, line.hostNick, line.players, line.size, line.level, line.shape].join('|');
  let shownRooms = null;

  function roomButtonOf(id) {
    return Array.from(roomsList.querySelectorAll('button')).find((button) => button.dataset.roomId === id) || null;
  }

  function focusRoomButton(id) {
    const button = roomButtonOf(id);
    (button || createButton).focus();
  }

  function renderRooms(state) {
    const lines = state.rooms || [];
    roomsTitle.textContent = 'Открытые комнаты' + (state.rooms ? ': ' + lines.length : '');
    roomsStatus.textContent = state.isRoomsDown ? TEXT.roomsDown
      : (state.rooms === null ? 'загрузка' : (lines.length === 0 ? 'Открытых комнат нет. Нажмите «Создать комнату».' : ''));
    const keys = lines.map(roomKey).join('\n');
    if (keys === shownRooms) return;
    const focused = document.activeElement;
    const focusedId = focused && focused.dataset && roomsList.contains(focused) ? focused.dataset.roomId : null;
    roomsList.replaceChildren(...lines.map(roomItem));
    shownRooms = keys;
    if (focusedId) focusRoomButton(focusedId);
  }

  const isNumbered = (player, state) => Number.isInteger(player.member) && state.sharedNicks.includes(player.nick);
  const nameOf = (player, state) => player.nick + (isNumbered(player, state) ? ' #' + player.member : '');

  /* A member hidden in the chat is found by the member number: two guests
     may share a nick. The button's name carries the nick in a hidden span,
     so each one says whose lines it hides. */
  function memberItem(player, state) {
    const isHidden = state.hiddenMembers.includes(player.member);
    const marks = [];
    if (player.isHost) marks.push(['host', 'хозяин']);
    marks.push(player.isReady ? ['ready', 'готов'] : ['waiting', 'не готов']);
    const item = person(nameOf(player, state), marks);
    if (!player.isMine && Number.isInteger(player.member)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'скрыть в чате';
      const whose = document.createElement('span');
      whose.className = 'visually-hidden';
      whose.textContent = ': ' + nameOf(player, state);
      button.append(whose);
      button.dataset.member = String(player.member);
      button.setAttribute('aria-pressed', String(isHidden));
      button.addEventListener('click', () => lobby.toggleMemberHidden(player.member));
      item.append(' ', button);
    }
    return item;
  }

  const memberKey = (player, state) => [player.member, nameOf(player, state), player.isHost, player.isReady, player.isMine,
    state.hiddenMembers.includes(player.member)].join('|');
  let shownPlayers = null;

  /* Rebuilt only when a line changed, as the room list: a rebuild on every
     poll would take the keyboard focus off a "скрыть в чате" button. */
  function renderPlayers(state) {
    const players = state.room ? state.room.players : [];
    const keys = players.map((player) => memberKey(player, state)).join('\n');
    if (keys === shownPlayers) return;
    const focused = document.activeElement;
    const focusedMember = focused && focused.dataset && playerList.contains(focused) ? focused.dataset.member : null;
    playerList.replaceChildren(...players.map((player) => memberItem(player, state)));
    shownPlayers = keys;
    if (focusedMember) {
      const button = Array.from(playerList.querySelectorAll('button')).find((item) => item.dataset.member === focusedMember);
      (button || copyButton).focus();
    }
  }

  /* A tap on Ready while an earlier action is out would be dropped, so the
     button waits. A disabled button can lose the keyboard focus, so the
     focus it had is given back when it is enabled again, unless it went
     somewhere else meanwhile. */
  let wasReadyFocused = false;

  function renderReady(state, isLobby) {
    if (state.isBusy && document.activeElement === readyButton) wasReadyFocused = true;
    readyButton.disabled = !isLobby || state.isBusy;
    if (state.isBusy || !wasReadyFocused) return;
    wasReadyFocused = false;
    const active = document.activeElement;
    if (isLobby && (active === null || active === document.body)) readyButton.focus();
  }

  function renderRoom(state) {
    const view = state.room;
    const isLobby = Boolean(view && view.state === 'lobby');
    link.value = location.origin + '/klad/#room=' + state.roomId;
    mailLink.href = KLAD_LOBBY.inviteMailto(link.value);
    mailLink.target = '_blank';
    mailLink.rel = 'noopener';
    listedLine.textContent = view ? (view.isListed ? 'Комната в списке открытых комнат.' : 'Комната только по ссылке: в списке её нет.') : '';
    listedRow.hidden = !(view && view.isHost);
    if (view && (document.activeElement !== linkOnlyBox || !state.isBusy)) linkOnlyBox.checked = !view.isListed;
    roomStatus.textContent = state.isRoomDown ? TEXT.offline
      : (view ? 'Игроков: ' + view.players.length + ' из ' + view.size : 'загрузка');
    renderPlayers(state);
    levelLine.textContent = view ? levelText(view) : '';
    levelRow.hidden = !(view && view.isHost);
    if (view && (document.activeElement !== levelSelect || !state.isBusy)) levelSelect.value = String(view.level);
    levelSelect.disabled = !isLobby;
    readyButton.hidden = !view;
    renderReady(state, isLobby);
    readyButton.setAttribute('aria-pressed', String(Boolean(view && view.isReady)));
    startButton.hidden = !(view && view.canStart);
    startNote.textContent = view && view.isHost && isLobby && !view.canStart
      ? 'Кнопка «Старт» появится, когда готовы все, а игроков хотя бы двое.' : '';
    raceLine.textContent = state.race || (view && view.state === 'racing' ? 'В комнате идёт гонка.' : '');
  }

  /* Buttons stay enabled while a request is out: a disabled button loses the
     keyboard focus, and the logic half drops a second action. Ready is the
     one exception (renderReady). */
  function render() {
    const state = lobby.state();
    const isReady = state.phase === 'ready';
    status.textContent = state.phase === 'checking' ? 'загрузка' : state.message;
    noNick.hidden = state.phase !== 'no-nick';
    main.hidden = !isReady;
    out.hidden = !isReady || state.roomId !== null;
    roomPart.hidden = !isReady || state.roomId === null;
    if (isReady) renderOnline(state);
    if (isReady && state.roomId === null) renderRooms(state);
    if (isReady && state.roomId !== null) renderRoom(state);
    if (state.roomId === null) copyNote.textContent = '';
    document.dispatchEvent(new CustomEvent('klad:lobby', { detail: state }));
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
  let isKeepingRoom = false;
  dialog.addEventListener('close', () => {
    lobby.close(isKeepingRoom);
    isKeepingRoom = false;
    backToGame();
  });
  $('nick').addEventListener('close', () => { if (lobby.afterNick()) showLobby(); });
  $('lobby-choose').addEventListener('click', () => lobby.askNick());

  /* replaceState fires no hashchange, so the new room is not joined again. */
  createButton.addEventListener('click', async () => {
    await lobby.createRoom(!privateBox.checked);
    const { roomId } = lobby.state();
    if (roomId !== null) history.replaceState(null, '', KLAD_LOBBY.ROOM_LINK + roomId);
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
  linkOnlyBox.addEventListener('change', () => lobby.setListed(!linkOnlyBox.checked));
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
  /* race.js opens the lobby again, closes it and leaves the room from its
     finish screen; chat.js sends and hides members through it and reads the
     state from klad:lobby. The flag is set only for an open dialog, whose
     close event resets it. */
  function closeKeepingRoom() {
    if (!dialog.open) return;
    isKeepingRoom = true;
    dialog.close();
  }
  KLAD_LOBBY.page = {
    open: () => showLobby(), closeKeepingRoom, leave: () => lobby.leave(), sendMessage: (text) => lobby.sendMessage(text),
    toggleMemberHidden: (member) => lobby.toggleMemberHidden(member),
  };
  openLink();
})();
