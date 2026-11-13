/* КЛАД online: the nick prompt, sending results, the boards and accounts,
   through the site's own /klad/api. No storage: the API's HttpOnly cookie is
   the only identity. The first half has no DOM, so the node tests can
   require it. */
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
    nickKept: 'Ник мог остаться на сервере, и результаты могут записываться под ним, пока вы не удалите его в «Таблицах».',
    signedIn: 'Этот браузер уже играет под ником ',
    codeSent: 'Код отправлен. Он действует 10 минут; если письма нет, загляните в папку «Спам».',
    invalidEmail: 'Такой email не подойдёт: проверьте адрес.',
    codeLimited: 'Слишком много запросов кода. Попробуйте позже.',
    invalidCode: 'Код не подошёл или устарел. Проверьте его или запросите новый.',
    tooManyAttempts: 'Слишком много неверных попыток: этот код больше не действует. Запросите новый.',
    loginNickTaken: 'Ваш ник уже занят аккаунтом. Смените ник и запросите новый код.',
    loginNoSession: 'Аккаунт создаётся из ника гостя: сначала выберите ник, потом снова откройте «Таблицы» и нажмите «Войти».',
    loggedIn: 'Вы в аккаунте.',
    merged: 'Вы в аккаунте. Результаты гостя перенесены в него.',
    otherKind: 'Вы в аккаунте. Результаты гостя не перенесены: у аккаунта другой выбор (человек или агент). ' +
      'Они остались под ником гостя, и удалить их больше нельзя.',
    kept: (nick) => 'Вы в аккаунте. Результаты ника «' + nick + '» остались с ним.',
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
    let codeEmail = null;

    /* Only 401 means "no player yet"; anything else but 200 means the API
       is not there, and the game does not ask for a nick until it answers
       again (opening the boards checks again). */
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

    async function undoSave() {
      const answer = await call('DELETE', '/players/me');
      if (answer.status === 401) isCookieBlocked = true;
      else if (!isOk(answer.status)) page.notice(TEXT.nickKept);
    }

    /* Until this returns, closing the prompt is a skip, and a skip wins: a
       player this call created is deleted again. After blocked cookies
       nothing more is posted: this browser could not delete it. */
    async function choose(nick, kind) {
      if (isCookieBlocked) return TEXT.noCookie;
      const answer = await call('POST', '/players', { nick, kind });
      const code = errorOf(answer);
      let problem = null;
      if (hasSkipped) {
        if (answer.status === 201) await undoSave();
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
        if (pending.length) await flush();
        else if (answer.status === 201) await readPlayer();
        if (hasSkipped) {
          player = null;
          pending = [];
          if (answer.status === 201) await undoSave();
        } else if (!player) {
          isCookieBlocked = true;
          skip();
          problem = TEXT.noCookie;
        }
        isAsking = false;
      }
      return problem;
    }

    function skip() {
      hasSkipped = true;
      isAsking = false;
      player = null;
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
        codeEmail = null;
      }
      if (answer.status === 401) problem = TEXT.noPlayer;
      else if (!isGone) problem = TEXT.unavailable;
      return problem;
    }

    /* The code is checked against the address it went to, so editing the
       email field afterwards does not break the login. */
    async function requestCode(email) {
      if (isCookieBlocked) return TEXT.noCookie;
      const answer = await call('POST', '/login/code', { email });
      let problem = null;
      if (answer.status === 202) codeEmail = email;
      else if (errorOf(answer) === 'invalid_email') problem = TEXT.invalidEmail;
      else if (answer.status === 429) problem = TEXT.codeLimited;
      else problem = TEXT.unavailable;
      return problem;
    }

    /* Returns the text to show. After no_session the code stays: the guest
       is made first, and a code the API has used up answers invalid_code.
       A login is read back like a new nick, and it ends an earlier skip or
       logout; no player then means blocked cookies, handled as in choose(). */
    async function verify(code) {
      const guest = player && !player.account ? player : null;
      const answer = await call('POST', '/login/verify', { email: codeEmail, code });
      const error = errorOf(answer);
      let text;
      if (answer.status === 200 && answer.data && answer.data.nick) {
        const { merged: isMerged, ...account } = answer.data;
        player = account;
        codeEmail = null;
        await readPlayer();
        if (player) {
          server = 'up';
          hasSkipped = false;
          text = welcome(guest, account, isMerged);
        } else {
          isCookieBlocked = true;
          skip();
          text = TEXT.noCookie;
        }
      } else if (answer.status === 401) {
        player = null;
        text = TEXT.loginNoSession;
      } else if (error === 'invalid_code') {
        text = TEXT.invalidCode;
      } else if (error === 'too_many_attempts') {
        codeEmail = null;
        text = TEXT.tooManyAttempts;
      } else if (error === 'nick_taken') {
        codeEmail = null;
        text = TEXT.loginNickTaken;
      } else {
        text = TEXT.unavailable;
      }
      return text;
    }

    /* merged false with a guest of the same kind is a sign-up (the guest is
       now the account) or a login before guest merging existed; the kept
       text is true for both. */
    function welcome(guest, account, isMerged) {
      let text = TEXT.loggedIn;
      if (isMerged === true) text = TEXT.merged;
      else if (guest && guest.kind !== account.kind) text = TEXT.otherKind;
      else if (guest) text = TEXT.kept(guest.nick);
      return text;
    }

    /* Like a delete, the page then has no player and does not ask for a
       nick again; the boards offer one, or a new login. */
    async function logout() {
      const answer = await call('POST', '/logout');
      const isGone = isOk(answer.status) || answer.status === 401;
      let problem = null;
      if (isGone) {
        player = null;
        hasSkipped = true;
        pending = [];
        codeEmail = null;
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
      start, refresh: readPlayer, choose, skip, ask, rename, remove, requestCode, verify, logout,
      loadBoard, onClear, onRun,
      player: () => player,
      isAvailable: () => server === 'up',
      isAsking: () => isAsking,
      isCookieBlocked: () => isCookieBlocked,
      isCodeSent: () => codeEmail !== null,
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
  const meAccount = $('me-account'), meEmail = $('me-email'), meLogout = $('me-logout'),
        meConfirmGuest = $('me-confirm-guest'), meConfirmAccount = $('me-confirm-account');
  const login = $('login'), loginEmailForm = $('login-email-form'), loginEmail = $('login-email'),
        loginCodeForm = $('login-code-form'), loginCode = $('login-code'), loginNote = $('login-note');
  const KIND = { human: 'человек', agent: 'агент' };
  const SHAPE = { landscape: 'широкое поле', portrait: 'высокое поле' };
  let noticeTimer = 0, boardRequest = 0, isSaving = false, isChangingPlayer = false;

  const online = KLAD_ONLINE.create((url, options) => fetch(url, options), {
    askNick() {
      if (nickDialog.open) return;
      nickForm.reset();
      nickError.textContent = online.isCookieBlocked() ? KLAD_ONLINE.TEXT.noCookie : '';
      nickDialog.showModal();
      nickName.focus();
    },
    /* The kept-nick warning asks the player to act, so it stays longer. It
       is not permanent because the line covers the bottom of the field. */
    notice(text) {
      notice.textContent = text;
      clearTimeout(noticeTimer);
      const seconds = text === KLAD_ONLINE.TEXT.nickKept ? 20 : 6;
      noticeTimer = setTimeout(() => { notice.textContent = ''; }, seconds * 1000);
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
      if (typeof entry.guest === 'boolean') {
        const mark = document.createElement('span');
        mark.className = entry.guest ? 'guest' : 'account';
        mark.textContent = entry.guest ? 'гость' : 'аккаунт';
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

  /* The login part is for a guest or no player; an account logs out first. */
  function showMe() {
    const player = online.player();
    const isAccount = Boolean(player && player.account);
    me.hidden = !online.isAvailable();
    meNone.hidden = Boolean(player);
    meSome.hidden = !player;
    meAccount.hidden = !isAccount;
    meConfirmGuest.hidden = isAccount;
    meConfirmAccount.hidden = !isAccount;
    login.hidden = isAccount;
    loginCodeForm.hidden = !online.isCodeSent();
    meEmail.textContent = isAccount ? 'Email: ' + player.email : '';
    meLine.textContent = player ? 'Вы: ' + player.nick + ' · ' + (KIND[player.kind] || player.kind) +
      (isAccount ? ' · аккаунт' : ' · гость') : '';
  }

  function forgetLogin() {
    loginEmailForm.reset();
    loginCodeForm.reset();
  }

  /* Only here and after a rename, so a rejected nick stays in the field. */
  function fillNick() {
    if (online.player()) meNick.value = online.player().nick;
  }

  async function openBoard() {
    if (isSaving || document.querySelector('dialog[open]')) return;
    $('board-human').checked = true;
    boardShape.value = matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
    meConfirm.hidden = true;
    meNote.textContent = '';
    loginNote.textContent = '';
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
  /* One rename or delete at a time: a second request's answer could arrive
     last and replace the first one's message. */
  meForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isChangingPlayer) return;
    isChangingPlayer = true;
    meNote.textContent = 'сохранение...';
    const problem = await online.rename(meNick.value.trim());
    isChangingPlayer = false;
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
    if (isChangingPlayer) return;
    isChangingPlayer = true;
    const wasAccount = Boolean(online.player() && online.player().account);
    meNote.textContent = 'удаление...';
    const problem = await online.remove();
    isChangingPlayer = false;
    meConfirm.hidden = true;
    showMe();
    meNote.textContent = problem || (wasAccount ? 'Аккаунт, email, ник и результаты удалены.' : 'Ник и результаты удалены.');
    if (online.player()) meDelete.focus();
    else { forgetLogin(); $('me-choose').focus(); showBoard(); }
  });

  meLogout.addEventListener('click', async () => {
    if (isChangingPlayer) return;
    isChangingPlayer = true;
    meNote.textContent = 'выход...';
    const problem = await online.logout();
    isChangingPlayer = false;
    showMe();
    meNote.textContent = problem || 'Вы вышли из аккаунта. Войти снова можно по коду из письма.';
    if (online.player()) meLogout.focus();
    else { forgetLogin(); loginEmail.focus(); }
  });

  /* A code request spends one of three an hour, so it shares the one
     request at a time rule with rename and delete. */
  loginEmailForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isChangingPlayer) return;
    isChangingPlayer = true;
    loginNote.textContent = 'отправка...';
    const problem = await online.requestCode(loginEmail.value.trim());
    isChangingPlayer = false;
    showMe();
    loginNote.textContent = problem || KLAD_ONLINE.TEXT.codeSent;
    if (!problem) { loginCode.value = ''; loginCode.focus(); }
  });

  /* After a login the login part hides, so its text goes to the note that
     stays visible, and the focus moves on. */
  loginCodeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isChangingPlayer) return;
    isChangingPlayer = true;
    loginNote.textContent = 'проверка...';
    const text = await online.verify(loginCode.value.trim());
    isChangingPlayer = false;
    showMe();
    if (login.hidden) {
      loginNote.textContent = '';
      forgetLogin();
      meNote.textContent = text;
      fillNick();
      meNick.focus();
      showBoard();
    } else {
      loginNote.textContent = text;
      if (text === KLAD_ONLINE.TEXT.loginNoSession) $('me-choose').focus();
      else if (text === KLAD_ONLINE.TEXT.loginNickTaken) meNick.focus();
      else if (!online.isCodeSent()) loginEmail.focus();
    }
  });

  document.addEventListener('klad:clear', (event) => online.onClear(event.detail));
  document.addEventListener('klad:run', (event) => online.onRun(event.detail));
  online.start();
})();
