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

  /* Empty when the message was taken. */
  function problemOf(answer) {
    let text = TEXT.failed;
    if (answer.status === 201) text = '';
    else if (answer.status === 400) text = TEXT.refused;
    else if (answer.status === 429) text = TEXT.tooFast;
    else if (answer.status === 404) text = TEXT.gone;
    return text;
  }

  function lineOf(message) {
    const marks = [
      message.isGuest ? ['guest', 'гость'] : ['account', 'аккаунт'],
      ['kind', KIND[message.kind] || message.kind],
    ];
    if (message.isMine) marks.push(['mine', 'вы']);
    return { n: message.n, member: message.member, nick: message.nick, marks, isMine: message.isMine, text: message.text };
  }

  /* state is the lobby's: roomId, messages oldest first, hiddenMembers. */
  function create() {
    let isChatHidden = false;
    let roomId = null;
    let announcedUpTo = 0;

    const isShown = (state, message) => !isChatHidden && !state.hiddenMembers.includes(message.member);

    function lines(state) {
      return state.messages.filter((message) => isShown(state, message)).map(lineOf);
    }

    /* Another member's message is announced once, when it arrives; one that
       came while the chat or its sender was hidden is not announced later.
       The own message can arrive before older ones, so it moves no mark. */
    function fresh(state) {
      if (state.roomId !== roomId) {
        roomId = state.roomId;
        announcedUpTo = 0;
      }
      const others = state.messages.filter((message) => !message.isMine && message.n > announcedUpTo);
      for (const message of others) announcedUpTo = Math.max(announcedUpTo, message.n);
      return others.filter((message) => isShown(state, message)).map(lineOf);
    }

    return {
      lines, fresh,
      setHidden(isHidden) { isChatHidden = isHidden === true; },
      isHidden: () => isChatHidden,
    };
  }

  return { create, problemOf, lineOf, TEXT };
})();
if (typeof module !== 'undefined') module.exports = KLAD_CHAT;

/* The page half: the "Чат" part of the lobby's room view. */
if (typeof document !== 'undefined') (() => {
  const $ = (id) => document.getElementById(id);
  const part = $('lobby-chat'), hideBox = $('lobby-chat-hide'), body = $('lobby-chat-body'), list = $('lobby-chat-lines'),
        empty = $('lobby-chat-empty'), live = $('lobby-chat-live'), form = $('lobby-chat-form'), field = $('lobby-chat-text'),
        problem = $('lobby-chat-problem');
  const chat = KLAD_CHAT.create();
  let lastState = null;
  let shownRoom = null;
  let shownLines = null;

  /* Nick, marks and text go in with textContent only, so a typed tag or web
     address stays text. */
  function lineItem(line) {
    const item = document.createElement('li');
    const nick = document.createElement('span');
    nick.className = 'nick';
    nick.textContent = line.nick;
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
    return item;
  }

  function spoken(line) {
    const item = document.createElement('p');
    item.textContent = line.nick + ': ' + line.text;
    return item;
  }

  /* The live region holds only the newest messages, one node each, so
     several in one poll are all read and none twice. The list is rebuilt
     only when its lines change and follows the newest while it is
     scrolled to the end. */
  function render(state) {
    lastState = state;
    if (state.roomId !== shownRoom) {
      shownRoom = state.roomId;
      problem.textContent = '';
      live.replaceChildren();
    }
    const fresh = chat.fresh(state);
    if (fresh.length > 0) live.replaceChildren(...fresh.map(spoken));
    part.hidden = state.phase !== 'ready' || state.room === null;
    body.hidden = chat.isHidden();
    const lines = chat.lines(state);
    const keys = lines.map((line) => line.n).join(',');
    if (keys !== shownLines) {
      const isAtEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 2;
      list.replaceChildren(...lines.map(lineItem));
      shownLines = keys;
      if (isAtEnd) list.scrollTop = list.scrollHeight;
    }
    empty.textContent = state.messages.length === 0 ? KLAD_CHAT.TEXT.empty : '';
  }

  hideBox.addEventListener('change', () => {
    chat.setHidden(hideBox.checked);
    if (lastState !== null) render(lastState);
  });

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

  document.addEventListener('klad:lobby', (event) => render(event.detail));
})();
