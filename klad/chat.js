/* КЛАД room chat: the lines, the two hide switches, the announcements and
   the send field. lobby.js keeps the room's messages and sends them; this
   file reads its state from the klad:lobby event, so it may load after
   the lobby has already rendered. The first half has no DOM, so the node
   tests can require it. The interface is in klad/README.md. */
'use strict';
const KLAD_CHAT = (() => {
  const RULES = 'до 120 знаков в одну строку: латинские и русские буквы, цифры, пробел и знаки препинания, без эмодзи';
  const TEXT = {
    refused: 'Сообщение не принято: ' + RULES + '.',
    tooFast: 'Слишком часто: не больше 5 сообщений за 10 секунд. Подождите и отправьте ещё раз.',
    gone: 'Сообщение не отправлено: вас уже нет в этой комнате, или её больше нет.',
    failed: 'Сервер не отвечает: сообщение не отправлено. Попробуйте ещё раз.',
    empty: 'Сообщений пока нет. Здесь появятся те, что отправят после вашего входа.',
  };
  const KIND = { human: 'человек', agent: 'агент' };
  const POPUPS_MAX = 3;
  const POPUP_FOR = 6 * 1000;

  /* Empty when the message was taken. */
  function problemOf(answer) {
    let text = TEXT.failed;
    if (answer.status === 201) text = '';
    else if (answer.status === 400) text = TEXT.refused;
    else if (answer.status === 429) text = TEXT.tooFast;
    else if (answer.status === 404) text = TEXT.gone;
    return text;
  }

  /* The name carries the member number only when two members of the room
     share the nick (sharedNicks from the lobby's state). */
  function lineOf(message, sharedNicks) {
    const marks = [
      message.isGuest ? ['guest', 'гость'] : ['account', 'аккаунт'],
      ['kind', KIND[message.kind] || message.kind],
    ];
    if (message.isMine) marks.push(['mine', 'вы']);
    const name = message.nick + (sharedNicks.includes(message.nick) ? ' #' + message.member : '');
    return { n: message.n, member: message.member, nick: message.nick, name, marks, isMine: message.isMine, text: message.text };
  }

  /* state is the lobby's: roomId, messages oldest first, hiddenMembers,
     sharedNicks. */
  function create() {
    let isChatHidden = false;

    const isShown = (state, message) => !isChatHidden && !state.hiddenMembers.includes(message.member);

    function lines(state) {
      return state.messages.filter((message) => isShown(state, message)).map((message) => lineOf(message, state.sharedNicks));
    }

    /* Each watcher has its own mark, so the lobby's live region, the race
       dialog's and the pop-ups each see a message once. Another member's
       message is reported once, when it arrives; one that came while the
       chat or its sender was hidden is not reported later. The own message
       can arrive before older ones, so it moves no mark. */
    function watcher() {
      let roomId = null;
      let announcedUpTo = 0;
      return (state) => {
        if (state.roomId !== roomId) {
          roomId = state.roomId;
          announcedUpTo = 0;
        }
        const others = state.messages.filter((message) => !message.isMine && message.n > announcedUpTo);
        for (const message of others) announcedUpTo = Math.max(announcedUpTo, message.n);
        return others.filter((message) => isShown(state, message)).map((message) => lineOf(message, state.sharedNicks));
      };
    }

    return {
      lines, watcher, fresh: watcher(),
      setHidden(isHidden) { isChatHidden = isHidden === true; },
      isHidden: () => isChatHidden,
    };
  }

  /* The race's pop-ups: at most POPUPS_MAX at once, each gone after
     POPUP_FOR, a new one pushing out the oldest. onChange runs after every
     change; the page shows what shown() lists. */
  function createPopups(clock, onChange) {
    let shown = [];

    function remove(n) {
      const popup = shown.find((entry) => entry.n === n);
      if (popup === undefined) return;
      clock.clearTimeout(popup.timer);
      shown = shown.filter((entry) => entry !== popup);
    }

    function add(lines) {
      for (const line of lines) {
        remove(line.n);
        const popup = { n: line.n, name: line.name, text: line.text, timer: null };
        popup.timer = clock.setTimeout(() => {
          remove(line.n);
          onChange();
        }, POPUP_FOR);
        shown.push(popup);
        while (shown.length > POPUPS_MAX) remove(shown[0].n);
      }
      if (lines.length > 0) onChange();
    }

    function clear() {
      for (const popup of shown) clock.clearTimeout(popup.timer);
      const wasShowing = shown.length > 0;
      shown = [];
      if (wasShowing) onChange();
    }

    return { add, clear, shown: () => shown.map(({ n, name, text }) => ({ n, name, text })) };
  }

  return { create, createPopups, problemOf, lineOf, TEXT, POPUPS_MAX, POPUP_FOR };
})();
if (typeof module !== 'undefined') module.exports = KLAD_CHAT;

/* The page half: the "Чат" part of the lobby's room view, the chat dialog of
   a race (the same lines and send field, opened by the HUD button or C) and
   the race's pop-ups. */
if (typeof document !== 'undefined') (() => {
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), lobbyPart = $('lobby-chat'), raceDialog = $('race-chat'), raceButton = $('h-chat'),
        popupList = $('chat-popups');
  const chat = KLAD_CHAT.create();
  const popupWatch = chat.watcher();
  const clock = { setTimeout: (task, wait) => setTimeout(task, wait), clearTimeout: (timer) => clearTimeout(timer) };
  const shownPopups = new Map();
  let lastState = null;
  let isInRace = false;
  let isChatKeyDown = false;

  /* Nick, marks and text go in with textContent only, so a typed tag or web
     address stays text. Another member's line has its own hide button, so
     a member who wrote and then left can still be hidden; it has no
     pressed state, since the line goes with the hide. */
  function lineItem(line) {
    const item = document.createElement('li');
    const nick = document.createElement('span');
    nick.className = 'nick';
    nick.textContent = line.name;
    item.append(nick);
    for (const [className, text] of line.marks) {
      const mark = document.createElement('span');
      mark.className = className;
      mark.textContent = text;
      item.append(' ', mark);
    }
    const text = document.createElement('span');
    text.textContent = line.text;
    item.append(': ', text);
    if (!line.isMine) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'скрыть';
      const whose = document.createElement('span');
      whose.className = 'visually-hidden';
      whose.textContent = ' в чате: ' + line.name;
      button.append(whose);
      button.dataset.line = String(line.n);
      button.addEventListener('click', () => KLAD_LOBBY.page.toggleMemberHidden(line.member));
      item.append(' ', button);
    }
    return item;
  }

  function spoken(line) {
    const item = document.createElement('p');
    item.textContent = line.name + ': ' + line.text;
    return item;
  }

  /* One chat view: the lobby's part and the race dialog have the same
     lines, announcements and send field, under ids with their own prefix. */
  function createView(prefix, isDialogOpen) {
    const hideBox = $(prefix + '-hide'), body = $(prefix + '-body'), list = $(prefix + '-lines'), empty = $(prefix + '-empty'),
          live = $(prefix + '-live'), form = $(prefix + '-form'), field = $(prefix + '-text'), problem = $(prefix + '-problem');
    const watch = chat.watcher();
    let shownRoom = null;
    let shownLines = null;
    let shownHidden = '';

    /* The live region holds only the newest messages, one node each, so
       several in one poll are all read and none twice. The list is rebuilt
       only when its lines change and follows the newest while it is
       scrolled to the end; a focused hide button keeps the focus on its line,
       or on the list when the line went, and on Скрыть чат once the list is
       empty: a held Enter there toggles nothing and sends no draft. A draft
       does not follow the player into another room, and a hidden member's
       last announcement leaves the live region. The region is written only
       while its dialog is open; the mark moves either way, so a message that
       came over a closed dialog is not read when it opens. */
    function render(state) {
      if (state.roomId !== shownRoom) {
        shownRoom = state.roomId;
        problem.textContent = '';
        live.replaceChildren();
        field.value = '';
      }
      const hiddenKey = state.hiddenMembers.join(' ');
      if (hiddenKey !== shownHidden) {
        shownHidden = hiddenKey;
        live.replaceChildren();
      }
      const fresh = watch(state);
      if (fresh.length > 0 && isDialogOpen()) live.replaceChildren(...fresh.map(spoken));
      body.hidden = chat.isHidden();
      const lines = chat.lines(state);
      const keys = lines.map((line) => line.n + ' ' + line.name).join('\n');
      if (keys !== shownLines) {
        const isAtEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
        const focused = document.activeElement;
        const focusedLine = focused && focused.dataset && list.contains(focused) ? focused.dataset.line : null;
        list.replaceChildren(...lines.map(lineItem));
        shownLines = keys;
        if (isAtEnd) list.scrollTop = list.scrollHeight;
        if (focusedLine) {
          const button = Array.from(list.querySelectorAll('button')).find((item) => item.dataset.line === focusedLine);
          (button || (lines.length > 0 ? list : hideBox)).focus();
        }
      }
      empty.textContent = state.messages.length === 0 ? KLAD_CHAT.TEXT.empty : '';
    }

    /* The focus goes back to the field after the button too, and the text
       stays there unless the message was taken. */
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      field.focus();
      const text = field.value;
      if (text.trim() === '') return;
      problem.textContent = '';
      const answer = await KLAD_LOBBY.page.sendMessage(text);
      if (answer === null) return;
      problem.textContent = KLAD_CHAT.problemOf(answer);
      if (answer.status === 201 && field.value === text) field.value = '';
    });

    return { hideBox, live, field, render };
  }

  const lobbyView = createView('lobby-chat', () => $('lobby').open);
  const raceView = createView('race-chat', () => raceDialog.open);
  const views = [lobbyView, raceView];
  /* The attribute autocomplete is not allowed on a checkbox, so a form
     state a browser restored is cleared here, never read: a hide lasts only
     while the page is open. Chrome restores after load, just before
     pageshow, and fires no change, so pageshow sets the boxes again. */
  for (const view of views) view.hideBox.checked = false;
  addEventListener('pageshow', () => {
    for (const view of views) view.hideBox.checked = chat.isHidden();
  });

  /* The pop-ups live in one region with its own polite announcements; each
     one is a node of its own, added once and removed when it expires, so
     nothing is read twice. */
  function showPopups() {
    const current = popups.shown();
    for (const [n, node] of shownPopups) {
      if (current.some((popup) => popup.n === n)) continue;
      node.remove();
      shownPopups.delete(n);
    }
    for (const popup of current) {
      if (shownPopups.has(popup.n)) continue;
      const node = document.createElement('p');
      node.textContent = popup.name + ': ' + popup.text;
      popupList.append(node);
      shownPopups.set(popup.n, node);
    }
  }
  const popups = KLAD_CHAT.createPopups(clock, showPopups);

  function render(state) {
    lastState = state;
    lobbyPart.hidden = state.phase !== 'ready' || state.room === null;
    for (const view of views) view.render(state);
  }

  /* The lobby's switch and the dialog's are one: Скрыть чат lasts while the
     page is open. It also empties the announcement regions and the pop-ups,
     so the last batch is not read out again when the chat shows again. */
  for (const view of views) {
    view.hideBox.addEventListener('change', () => {
      chat.setHidden(view.hideBox.checked);
      for (const other of views) {
        other.hideBox.checked = view.hideBox.checked;
        if (view.hideBox.checked) other.live.replaceChildren();
      }
      if (view.hideBox.checked) popups.clear();
      if (lastState !== null) render(lastState);
    });
  }

  /* A message from another member is a pop-up only in a race and while no
     dialog covers the field; one that came meanwhile is not shown later. */
  document.addEventListener('klad:lobby', (event) => {
    render(event.detail);
    const fresh = popupWatch(event.detail);
    if (isInRace && document.querySelector('dialog[open]') === null) popups.add(fresh);
  });

  /* The chat opens only in a race, and not over another dialog. Opening it
     is the pause: klad.js holds the game while a dialog is open. */
  function openChat() {
    if (!isInRace || document.querySelector('dialog[open]') !== null) return;
    popups.clear();
    raceView.live.replaceChildren();
    raceDialog.showModal();
    (chat.isHidden() ? raceView.hideBox : raceView.field).focus();
  }

  /* preventDefault, or the typed "c" lands in the field that just got the
     focus. The repeats of a held C go to that field too, so they are stopped
     until the key comes up. A held Enter or C in the field is stopped as
     well: Enter would send the kept draft again and again. */
  const heldKeys = ['Enter', 'NumpadEnter', 'KeyC'];
  document.addEventListener('keydown', (event) => {
    if (event.repeat && ((event.code === 'KeyC' && isChatKeyDown) || (event.target.id === 'race-chat-text' && heldKeys.includes(event.code)))) {
      event.preventDefault();
      return;
    }
    if (event.code !== 'KeyC' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || !isInRace) return;
    event.preventDefault();
    openChat();
    isChatKeyDown = raceDialog.open;
  });
  document.addEventListener('keyup', (event) => {
    if (event.code === 'KeyC') isChatKeyDown = false;
  });
  raceButton.addEventListener('click', openChat);
  $('race-chat-close').addEventListener('click', () => raceDialog.close());
  raceDialog.addEventListener('close', () => {
    if (document.querySelector('dialog[open]') === null) canvas.focus({ preventScroll: true });
  });

  /* race.js tells whether the race is on (racing, or finished and waiting
     for the others). At its end the dialog closes before the results screen
     opens, so the focus goes to that screen, and the pop-ups go. */
  KLAD_CHAT.page = {
    setRace(isOn) {
      isInRace = isOn;
      raceButton.hidden = !isOn;
      if (isOn) return;
      popups.clear();
      if (raceDialog.open) raceDialog.close();
      if (document.activeElement === raceButton) canvas.focus({ preventScroll: true });
    },
  };
})();
