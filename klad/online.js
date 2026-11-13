/* КЛАД online: the nick prompt, sending results and the boards, through the
   site's own /klad/api. No storage: the API's HttpOnly cookie is the only
   identity. The first half has no DOM, so the node tests can require it. */
'use strict';
const KLAD_ONLINE = (() => {
  const BASE = '/klad/api';
  const TEXT = {
    unavailable: 'Сервер игры сейчас недоступен. Играть можно и без него.',
    notSaved: 'Результат не сохранён: сервер не принял его.',
    rateLimited: 'Слишком много результатов за минуту: этот не сохранён.',
    invalidNick: 'Такой ник не подойдёт: нужно от 3 до 16 знаков, латинские или русские буквы (не вперемешку), цифры, _ и -.',
    invalidKind: 'Выберите, кто играет: человек или агент.',
    nickTaken: 'Этот ник занят аккаунтом. Выберите другой.',
    noPlayer: 'У этого браузера больше нет ника на сервере.',
    noCookie: 'Сервер не узнал этот браузер: похоже, cookie заблокированы. Можно играть без ника.',
    nickKept: 'Ник мог остаться на сервере: проверьте «Таблицы», там его можно удалить.',
    signedIn: 'Этот браузер уже играет под ником ',
  };
  const isOk = (status) => status >= 200 && status < 300;
  const errorOf = (answer) => answer.data && answer.data.error;

  async function request(fetchFunction, method, path, body) {
    const options = { method };
    if (body !== undefined) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }
    try {
      const response = await fetchFunction(BASE + path, options);
      const data = await response.json().catch(() => null);
      return { status: response.status, data };
    } catch (e) {
      return { status: 0, data: null };
    }
  }

  function boardPath(kind, view, shape) {
    if (view === 'records' || view === 'chests') return '/boards/' + view + '?' + new URLSearchParams({ kind });
    return '/boards/level?' + new URLSearchParams({ kind, level: view, shape });
  }

  /* page: askNick() opens the nick prompt, notice(text) shows a short note. */
  function create(fetchFunction, page) {
    const call = (method, path, body) => request(fetchFunction, method, path, body);
    let server = 'unknown';
    let player = null;
    let pending = [];
    let hasSkipped = false;
    let isAsking = false;
    let isCookieBlocked = false;

    /* Only 401 means "no player yet"; anything else but 200 means the API
       is not there, and then the game never asks for a nick. */
    async function readPlayer() {
      const answer = await call('GET', '/players/me');
      if (answer.status === 200 && answer.data && answer.data.nick) {
        server = 'up';
        player = answer.data;
      } else if (answer.status === 401) {
        server = 'up';
        player = null;
      } else {
        server = 'down';
      }
    }

    function settle() {
      if (server !== 'up' || player || hasSkipped || isAsking || !pending.length) return;
      isAsking = true;
      page.askNick();
    }

    async function send(result) {
      const answer = await call('POST', result.path, result.body);
      if (answer.status === 401) {
        player = null;
        pending.unshift(result);
        settle();
      } else if (answer.status === 429) {
        page.notice(TEXT.rateLimited);
      } else if (!isOk(answer.status)) {
        page.notice(TEXT.notSaved);
      }
    }

    async function flush() {
      while (player && pending.length) await send(pending.shift());
    }

    function submit(path, body) {
      if (player) return send({ path, body });
      if (server !== 'down' && !hasSkipped) {
        pending.push({ path, body });
        settle();
      }
      return Promise.resolve();
    }

    async function start() {
      await readPlayer();
      if (server === 'down') pending = [];
      if (player) await flush();
      else settle();
    }

    /* A skip while this waits wins: the new player is deleted again. Blocked
       cookies also count as a skip, and after them nothing more is posted,
       because each new player would be one this browser cannot delete. */
    async function choose(nick, kind) {
      if (isCookieBlocked) return TEXT.noCookie;
      const answer = await call('POST', '/players', { nick, kind });
      const code = errorOf(answer);
      let problem = null;
      if (hasSkipped) {
        if (answer.status === 201) {
          const undo = await call('DELETE', '/players/me');
          if (!isOk(undo.status) && undo.status !== 401) page.notice(TEXT.nickKept);
        }
      } else if (answer.status === 201) {
        player = answer.data;
      } else if (code === 'already_signed_in') {
        await readPlayer();
        if (hasSkipped) player = null;
        else if (player) page.notice(TEXT.signedIn + player.nick + '.');
        else problem = TEXT.unavailable;
      } else if (code === 'invalid_nick') {
        problem = TEXT.invalidNick;
      } else if (code === 'invalid_kind') {
        problem = TEXT.invalidKind;
      } else if (code === 'nick_taken') {
        problem = TEXT.nickTaken;
      } else {
        problem = TEXT.unavailable;
      }
      if (!problem && !hasSkipped) {
        isAsking = false;
        if (pending.length) await flush();
        else if (answer.status === 201) await readPlayer();
        if (!player) {
          isCookieBlocked = true;
          skip();
          problem = TEXT.noCookie;
        }
      }
      return problem;
    }

    function skip() {
      hasSkipped = true;
      isAsking = false;
      pending = [];
    }

    function ask() {
      hasSkipped = false;
      isAsking = true;
      page.askNick();
    }

    async function rename(nick) {
      const answer = await call('PATCH', '/players/me', { nick });
      const code = errorOf(answer);
      let problem = null;
      if (answer.status === 200) {
        player = answer.data;
      } else if (answer.status === 401) {
        player = null;
        problem = TEXT.noPlayer;
      } else if (code === 'invalid_nick') {
        problem = TEXT.invalidNick;
      } else if (code === 'nick_taken') {
        problem = TEXT.nickTaken;
      } else {
        problem = TEXT.unavailable;
      }
      return problem;
    }

    /* 401 only says this browser has no session any more, so the player is
       gone for it, but the message must not claim the nick was deleted. */
    async function remove() {
      const answer = await call('DELETE', '/players/me');
      const isGone = isOk(answer.status) || answer.status === 401;
      let problem = null;
      if (isGone) {
        player = null;
        hasSkipped = true;
        pending = [];
      }
      if (answer.status === 401) problem = TEXT.noPlayer;
      else if (!isGone) problem = TEXT.unavailable;
      return problem;
    }

    async function loadBoard(kind, view, shape) {
      const answer = await call('GET', boardPath(kind, view, shape));
      return answer.status === 200 && answer.data ? answer.data : null;
    }

    function onClear(detail) {
      return submit('/clears', { level: detail.level, shape: detail.shape, revision: detail.revision,
        ticks: detail.ticks, chests: detail.chests, chestsTotal: detail.chestsTotal });
    }

    function onRun(detail) {
      if (!detail.fromLevelOne) return Promise.resolve();
      return submit('/runs', { levelsCleared: detail.levelsCleared, score: detail.score, ticks: detail.ticks });
    }

    return {
      start, refresh: readPlayer, choose, skip, ask, rename, remove, loadBoard, onClear, onRun,
      player: () => player,
      isAvailable: () => server === 'up',
      isAsking: () => isAsking,
      isCookieBlocked: () => isCookieBlocked,
    };
  }

  return { create, boardPath, TEXT };
})();
if (typeof module !== 'undefined') module.exports = KLAD_ONLINE;

/* The page half: dialogs, the board tables, the T key and the HUD button. */
if (typeof document !== 'undefined') (() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), notice = $('online-notice');
  const nickDialog = $('nick'), nickForm = $('nick-form'), nickName = $('nick-name'), nickError = $('nick-error'),
        nickSaving = $('nick-saving'), nickSave = $('nick-save'), nickSkip = $('nick-skip');
  const board = $('board'), boardView = $('board-view'), boardShape = $('board-shape'),
        boardShapeRow = $('board-shape-row'), boardStatus = $('board-status'), boardTables = $('board-tables');
  const me = $('me'), meNone = $('me-none'), meSome = $('me-some'), meLine = $('me-line'), meForm = $('me-form'),
        meNick = $('me-nick'), meNote = $('me-note'), meDelete = $('me-delete'), meConfirm = $('me-confirm');
  const KIND = { human: 'человек', agent: 'агент' };
  const SHAPE = { landscape: 'широкое поле', portrait: 'высокое поле' };
  let noticeTimer = 0, boardRequest = 0, isSaving = false;

  const online = KLAD_ONLINE.create((url, options) => fetch(url, options), {
    askNick() {
      if (nickDialog.open) return;
      nickForm.reset();
      nickError.textContent = online.isCookieBlocked() ? KLAD_ONLINE.TEXT.noCookie : '';
      nickDialog.showModal();
      nickName.focus();
    },
    notice(text) {
      notice.textContent = text;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => { notice.textContent = ''; }, 6000);
    },
  });

  /* Focus goes back to the field, as after the sound button, so Space and
     Enter fire again instead of pressing the button that opened a dialog. */
  function backToGame() {
    if (!document.querySelector('dialog[open]')) canvas.focus({ preventScroll: true });
  }

  /* While the nick is being saved the prompt cannot be skipped. The logic
     half still undoes the save if a repeated Escape closes it anyway. */
  nickForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isSaving) return;
    isSaving = true;
    nickSave.disabled = true;
    nickSkip.disabled = true;
    nickError.textContent = '';
    nickSaving.textContent = 'сохранение...';
    const problem = await online.choose(nickName.value.trim(), nickForm.elements.kind.value);
    isSaving = false;
    nickSaving.textContent = '';
    nickSkip.disabled = false;
    nickSave.disabled = online.isCookieBlocked();
    if (problem) {
      nickError.textContent = problem;
      (nickSave.disabled ? nickSkip : nickName).focus();
    } else nickDialog.close();
  });
  nickSkip.addEventListener('click', () => nickDialog.close());
  nickDialog.addEventListener('cancel', (event) => { if (isSaving) event.preventDefault(); });
  nickDialog.addEventListener('close', () => {
    if (online.isAsking()) online.skip();
    backToGame();
  });

  for (const [i, level] of KLAD_LEVELS.entries()) {
    boardView.add(new Option('этап ' + (i + 1) + ': ' + level.name, String(i + 1)), $('board-chests'));
  }

  function table(caption, headings, entries, cellsOf) {
    const element = document.createElement('table');
    element.createCaption().textContent = caption;
    const head = element.createTHead().insertRow();
    for (const heading of headings) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = heading;
      head.append(cell);
    }
    const body = element.createTBody();
    for (const entry of entries || []) {
      const row = body.insertRow();
      row.insertCell().textContent = entry.rank;
      const nick = row.insertCell();
      nick.textContent = entry.nick;
      if (entry.guest) {
        const mark = document.createElement('span');
        mark.className = 'guest';
        mark.textContent = 'гость';
        nick.append(' ', mark);
      }
      for (const value of cellsOf(entry)) row.insertCell().textContent = value;
    }
    if (!body.rows.length) {
      const cell = body.insertRow().insertCell();
      cell.colSpan = headings.length;
      cell.textContent = 'пока никого';
    }
    return element;
  }

  function tablesFor(view, data) {
    const time = (entry) => KLAD_TICKS.format(entry.ticks);
    if (view === 'records') {
      return [table('Рекорды: игры с первого этапа', ['Место', 'Ник', 'Этапы', 'Счёт', 'Время'], data.entries,
        (entry) => [entry.levelsCleared, entry.score, time(entry)])];
    }
    if (view === 'chests') {
      return [table('Клады: лучшие результаты всех этапов вместе', ['Место', 'Ник', 'Клады'], data.entries,
        (entry) => [entry.chests])];
    }
    const where = 'Этап ' + view + ', ' + SHAPE[boardShape.value];
    return [
      table(where + ': быстрее всех', ['Место', 'Ник', 'Время'], data.fastest, (entry) => [time(entry)]),
      table(where + ': больше всех кладов', ['Место', 'Ник', 'Клады', 'Время'], data.chests,
        (entry) => [entry.chests + '/' + entry.chestsTotal, time(entry)]),
    ];
  }

  async function showBoard() {
    const request = ++boardRequest;
    const kind = board.querySelector('input[name="board-kind"]:checked').value;
    const view = boardView.value;
    boardShapeRow.hidden = view === 'records' || view === 'chests';
    boardStatus.textContent = 'загрузка';
    boardTables.replaceChildren();
    const data = await online.loadBoard(kind, view, boardShape.value);
    if (request !== boardRequest) return;
    boardStatus.textContent = data ? 'готово' : 'Таблицы сейчас недоступны. Игра работает и без них.';
    if (data) boardTables.append(...tablesFor(view, data));
  }

  function showMe() {
    const player = online.player();
    me.hidden = !online.isAvailable();
    meNone.hidden = Boolean(player);
    meSome.hidden = !player;
    if (player) {
      meLine.textContent = 'Вы: ' + player.nick + ' · ' + (KIND[player.kind] || player.kind) +
        (player.account ? '' : ' · гость');
    }
  }

  /* Only here and after a rename, so a rejected nick stays in the field. */
  function fillNick() {
    if (online.player()) meNick.value = online.player().nick;
  }

  async function openBoard() {
    if (document.querySelector('dialog[open]')) return;
    $('board-human').checked = true;
    boardShape.value = matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
    meConfirm.hidden = true;
    meNote.textContent = '';
    me.hidden = true;
    board.showModal();
    $('board-human').focus();
    await Promise.all([online.refresh().then(() => { showMe(); fillNick(); }), showBoard()]);
  }

  for (const input of board.querySelectorAll('input[name="board-kind"]')) input.addEventListener('change', showBoard);
  boardView.addEventListener('change', showBoard);
  boardShape.addEventListener('change', showBoard);
  $('board-close').addEventListener('click', () => board.close());
  board.addEventListener('close', backToGame);
  $('h-board').addEventListener('click', openBoard);
  addEventListener('keydown', (event) => {
    if (event.code !== 'KeyT' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    event.preventDefault();
    openBoard();
  });

  $('me-choose').addEventListener('click', () => {
    board.close();
    online.ask();
  });
  meForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    meNote.textContent = '';
    const problem = await online.rename(meNick.value.trim());
    showMe();
    meNote.textContent = problem || 'Ник изменён.';
    if (!problem) { fillNick(); showBoard(); }
  });
  meDelete.addEventListener('click', () => {
    meConfirm.hidden = false;
    $('me-no').focus();
  });
  $('me-no').addEventListener('click', () => {
    meConfirm.hidden = true;
    meDelete.focus();
  });
  $('me-yes').addEventListener('click', async () => {
    const problem = await online.remove();
    meConfirm.hidden = true;
    showMe();
    meNote.textContent = problem || 'Ник и результаты удалены.';
    if (online.player()) meDelete.focus();
    else { $('me-choose').focus(); showBoard(); }
  });

  document.addEventListener('klad:clear', (event) => online.onClear(event.detail));
  document.addEventListener('klad:run', (event) => online.onRun(event.detail));
  online.start();
})();
