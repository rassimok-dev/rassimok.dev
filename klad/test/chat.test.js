'use strict';
/* klad/chat.js without a browser. The logic half gets the lobby's state as
   lobby.js hands it out; the page half runs in a vm context with a stub
   page and a stub KLAD_LOBBY.page, as race.js's page half does in
   race.test.js. The transport (after number, send request) is tested in
   lobby.test.js. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const KLAD_CHAT = require('../chat.js');

const { TEXT } = KLAD_CHAT;
const ID = 'Room_id-42';
const OTHER = 'Other_id-7';
const anna = (n, text) => ({ n, member: 1, nick: 'Anna', kind: 'human', isGuest: false, isMine: false, text });
const twin = (n, text) => ({ n, member: 3, nick: 'Anna', kind: 'agent', isGuest: true, isMine: false, text });
const mine = (n, text) => ({ n, member: 2, nick: 'test', kind: 'agent', isGuest: true, isMine: true, text });

function stateOf(messages, changes) {
  return { phase: 'ready', roomId: ID, room: { id: ID }, messages, hiddenMembers: [], sharedNicks: [], ...changes };
}

const numbersOf = (lines) => lines.map((line) => line.n);

/* ---- the logic half ---- */

test('a line shows the nick, guest or account, human or agent, and marks the own line', () => {
  // when
  const other = KLAD_CHAT.lineOf(anna(1, 'hello'), []);
  const own = KLAD_CHAT.lineOf(mine(2, 'hi'), []);

  // then
  assert.deepEqual(other, {
    n: 1, member: 1, nick: 'Anna', name: 'Anna', marks: [['account', 'аккаунт'], ['kind', 'человек']], isMine: false, text: 'hello',
  });
  assert.deepEqual(own, {
    n: 2, member: 2, nick: 'test', name: 'test', marks: [['guest', 'гость'], ['kind', 'агент'], ['mine', 'вы']], isMine: true,
    text: 'hi',
  });
});

test('a nick two members share is named with the member number, another nick is not', () => {
  // given
  const chat = KLAD_CHAT.create();
  const messages = [anna(1, 'one'), twin(2, 'two'), mine(3, 'three')];

  // when
  const lines = chat.lines(stateOf(messages, { sharedNicks: ['Anna'] }));

  // then
  assert.deepEqual(lines.map((line) => line.name), ['Anna #1', 'Anna #3', 'test']);
  assert.deepEqual(lines.map((line) => line.nick), ['Anna', 'Anna', 'test']);
});

test('lines keep the order and leave out a hidden member, but not another member with the same nick', () => {
  // given
  const chat = KLAD_CHAT.create();
  const messages = [anna(1, 'one'), twin(2, 'two'), mine(3, 'three'), anna(4, 'four')];

  // when
  const all = chat.lines(stateOf(messages));
  const withoutAnna = chat.lines(stateOf(messages, { hiddenMembers: [1] }));

  // then
  assert.deepEqual(numbersOf(all), [1, 2, 3, 4]);
  assert.deepEqual(numbersOf(withoutAnna), [2, 3]);
  assert.equal(withoutAnna[0].nick, 'Anna');
});

test('another member\'s message is announced once, several at a time, and the own message never', () => {
  // given
  const chat = KLAD_CHAT.create();

  // when
  const first = chat.fresh(stateOf([anna(1, 'one'), mine(2, 'mine'), anna(3, 'three')]));
  const again = chat.fresh(stateOf([anna(1, 'one'), mine(2, 'mine'), anna(3, 'three')]));
  const next = chat.fresh(stateOf([anna(1, 'one'), mine(2, 'mine'), anna(3, 'three'), twin(4, 'four')]));

  // then
  assert.deepEqual(numbersOf(first), [1, 3]);
  assert.deepEqual(again, []);
  assert.deepEqual(numbersOf(next), [4]);
});

test('the own message shown before an older one of another member does not keep that one from being announced', () => {
  // given
  const chat = KLAD_CHAT.create();
  chat.fresh(stateOf([anna(1, 'one')]));
  chat.fresh(stateOf([anna(1, 'one'), mine(3, 'sent at once')]));

  // when
  const late = chat.fresh(stateOf([anna(1, 'one'), anna(2, 'sent before'), mine(3, 'sent at once')]));

  // then
  assert.deepEqual(numbersOf(late), [2]);
});

test('a hidden member is not announced, also not after the hide is undone', () => {
  // given
  const chat = KLAD_CHAT.create();
  const messages = [anna(1, 'one'), twin(2, 'two')];

  // when
  const whileHidden = chat.fresh(stateOf(messages, { hiddenMembers: [1] }));
  const afterwards = chat.fresh(stateOf(messages));

  // then
  assert.deepEqual(numbersOf(whileHidden), [2]);
  assert.deepEqual(afterwards, []);
  assert.deepEqual(numbersOf(chat.lines(stateOf(messages))), [1, 2]);
});

test('Скрыть чат: no lines and no announcements while hidden, and what came meanwhile is not announced later', () => {
  // given
  const chat = KLAD_CHAT.create();
  chat.setHidden(true);

  // when
  const lines = chat.lines(stateOf([anna(1, 'one')]));
  const announced = chat.fresh(stateOf([anna(1, 'one')]));
  chat.setHidden(false);
  const afterwards = chat.fresh(stateOf([anna(1, 'one')]));

  // then
  assert.deepEqual(lines, []);
  assert.deepEqual(announced, []);
  assert.deepEqual(afterwards, []);
  assert.equal(chat.isHidden(), false);
  assert.deepEqual(numbersOf(chat.lines(stateOf([anna(1, 'one')]))), [1]);
});

test('a new room starts the announcements from its first message', () => {
  // given
  const chat = KLAD_CHAT.create();
  chat.fresh(stateOf([anna(5, 'old room')]));
  chat.fresh(stateOf([], { roomId: null, room: null }));

  // when
  const announced = chat.fresh(stateOf([anna(1, 'new room')], { roomId: OTHER }));

  // then
  assert.deepEqual(numbersOf(announced), [1]);
});

test('the send answer picks the text: none for 201, the allowed characters for 400, too fast for 429, gone for 404, failed otherwise', () => {
  assert.equal(KLAD_CHAT.problemOf({ status: 201 }), '');
  assert.equal(KLAD_CHAT.problemOf({ status: 400 }), TEXT.refused);
  assert.equal(KLAD_CHAT.problemOf({ status: 429 }), TEXT.tooFast);
  assert.equal(KLAD_CHAT.problemOf({ status: 404 }), TEXT.gone);
  assert.equal(KLAD_CHAT.problemOf({ status: 0 }), TEXT.failed);
  assert.equal(KLAD_CHAT.problemOf({ status: 500 }), TEXT.failed);
  assert.match(TEXT.refused, /120 знаков.*латинские и русские буквы, цифры, пробел/);
});

test('each watcher reports a message once on its own, so the lobby, the race dialog and the pop-ups do not use each other\'s marks', () => {
  // given
  const chat = KLAD_CHAT.create();
  const first = chat.watcher();
  const second = chat.watcher();

  // when
  const firstSees = first(stateOf([anna(1, 'one')]));
  const secondSees = second(stateOf([anna(1, 'one')]));
  const firstAgain = first(stateOf([anna(1, 'one')]));

  // then
  assert.deepEqual(numbersOf(firstSees), [1]);
  assert.deepEqual(numbersOf(secondSees), [1]);
  assert.deepEqual(firstAgain, []);
});

/* ---- the pop-ups ---- */

function popupsOf(clock) {
  const changes = [];
  const popups = KLAD_CHAT.createPopups(clock, () => changes.push(popups.shown().map((popup) => popup.n)));
  return { popups, changes };
}
const linesFor = (...numbers) => numbers.map((n) => KLAD_CHAT.lineOf(anna(n, 'text ' + n), []));

test('a pop-up shows the name and the text, and goes after 6 s', () => {
  // given
  const clock = fakeClock();
  const { popups, changes } = popupsOf(clock);

  // when
  popups.add([KLAD_CHAT.lineOf(twin(7, 'hello'), ['Anna'])]);
  clock.advance(KLAD_CHAT.POPUP_FOR - 1);
  const justBefore = popups.shown();
  clock.advance(1);

  // then
  assert.deepEqual(justBefore, [{ n: 7, name: 'Anna #3', text: 'hello' }]);
  assert.deepEqual(popups.shown(), []);
  assert.deepEqual(changes, [[7], []]);
  assert.equal(clock.pending(), 0);
});

test('at most 3 pop-ups show at once, a fourth pushes out the oldest, and each has its own 6 s', () => {
  // given
  const clock = fakeClock();
  const { popups } = popupsOf(clock);
  popups.add(linesFor(1));
  clock.advance(2000);
  popups.add(linesFor(2, 3));

  // when
  popups.add(linesFor(4));
  const afterFourth = popups.shown().map((popup) => popup.n);
  clock.advance(4000);
  const whenFirstWouldGo = popups.shown().map((popup) => popup.n);
  clock.advance(2000);

  // then
  assert.deepEqual(afterFourth, [2, 3, 4]);
  assert.deepEqual(whenFirstWouldGo, [2, 3, 4]);
  assert.deepEqual(popups.shown(), []);
  assert.equal(clock.pending(), 0);
});

test('five messages in one batch show the newest 3, and a repeated number shows once', () => {
  // given
  const clock = fakeClock();
  const { popups } = popupsOf(clock);

  // when
  popups.add(linesFor(1, 2, 3, 4, 5));
  popups.add(linesFor(5));

  // then
  assert.deepEqual(popups.shown().map((popup) => popup.n), [3, 4, 5]);
  assert.equal(clock.pending(), 3);
});

test('clear removes every pop-up and its timer, and reports a change only when there was one', () => {
  // given
  const clock = fakeClock();
  const { popups, changes } = popupsOf(clock);
  popups.clear();
  popups.add(linesFor(1, 2));

  // when
  popups.clear();
  popups.clear();

  // then
  assert.deepEqual(popups.shown(), []);
  assert.equal(clock.pending(), 0);
  assert.deepEqual(changes, [[1, 2], []]);
});

test('no pop-up line for a hidden member or with the chat hidden: the watcher leaves them out, and they stay out when shown again', () => {
  // given
  const chat = KLAD_CHAT.create();
  const watch = chat.watcher();

  // when
  const hiddenMember = watch(stateOf([anna(1, 'one'), twin(2, 'two')], { hiddenMembers: [1] }));
  chat.setHidden(true);
  const hiddenChat = watch(stateOf([anna(1, 'one'), twin(2, 'two'), anna(3, 'three')], { hiddenMembers: [1] }));
  chat.setHidden(false);
  const afterwards = watch(stateOf([anna(1, 'one'), twin(2, 'two'), anna(3, 'three')]));

  // then
  assert.deepEqual(numbersOf(hiddenMember), [2]);
  assert.deepEqual(hiddenChat, []);
  assert.deepEqual(afterwards, []);
});

/* ---- the page half, in a vm context with a stub page ---- */

function stubNode(tag, registry) {
  return {
    tag, textContent: '', className: '', hidden: false, checked: false, value: '',
    children: [], listeners: {}, attributes: {}, dataset: {}, replaced: 0, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
    addEventListener(type, listener) { this.listeners[type] = listener; },
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...items) { for (const item of items) if (typeof item !== 'string') item.parent = this; this.children.push(...items); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); },
    replaceChildren(...items) { this.children = items; this.replaced++; },
    querySelectorAll(selector) {
      return this.children.flatMap((child) => (typeof child === 'string' ? [] : [...(child.tag === selector ? [child] : []), ...child.querySelectorAll(selector)]));
    },
    contains(other) { return other === this || this.children.some((child) => typeof child !== 'string' && child.contains(other)); },
    focus() { registry.focused = this; },
    open: false,
    showModal() { this.open = true; },
    close() {
      if (!this.open) return;
      this.open = false;
      if (this.listeners.close) registry.closeEvents.push(this.listeners.close);
    },
  };
}

function fakeClock() {
  const timers = new Map();
  let time = 0;
  let nextId = 1;
  return {
    setTimeout(task, wait) {
      const id = nextId++;
      timers.set(id, { at: time + wait, task });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    pending: () => timers.size,
    advance(milliseconds) {
      const end = time + milliseconds;
      for (;;) {
        let next = null;
        for (const [id, timer] of timers) if (timer.at <= end && (next === null || timer.at < next.at)) next = { id, ...timer };
        if (next === null) break;
        timers.delete(next.id);
        time = next.at;
        next.task();
      }
      time = end;
    },
  };
}

function loadChatPage(sendAnswers = [], restoredBoxes = []) {
  const registry = { focused: null, created: [], closeEvents: [] };
  const elements = {};
  for (const id of restoredBoxes) elements[id] = { ...stubNode('#' + id, registry), checked: true };
  const listeners = {};
  const windowListeners = {};
  const sent = [];
  const toggled = [];
  const clock = fakeClock();
  const document = {
    get activeElement() { return registry.focused; },
    querySelector: () => (Object.values(elements).some((element) => element.open) ? {} : null),
    getElementById: (id) => elements[id] || (elements[id] = stubNode('#' + id, registry)),
    createElement: (tag) => { registry.created.push(tag); return stubNode(tag, registry); },
    addEventListener: (type, listener) => { listeners[type] = listener; },
  };
  const sandbox = {
    document,
    addEventListener: (type, listener) => { windowListeners[type] = listener; },
    setTimeout: (task, wait) => clock.setTimeout(task, wait),
    clearTimeout: (timer) => clock.clearTimeout(timer),
    KLAD_LOBBY: {
      page: {
        sendMessage: async (text) => { sent.push(text); return sendAnswers.shift(); },
        toggleMemberHidden: (member) => toggled.push(member),
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'chat.js'), 'utf8'), sandbox);
  const chatPage = vm.runInContext('KLAD_CHAT.page', sandbox);
  const show = (state) => listeners['klad:lobby']({ detail: state });
  const pressKey = (code, changes) => {
    let isPrevented = false;
    listeners.keydown({ code, repeat: false, target: { tagName: 'CANVAS' }, preventDefault() { isPrevented = true; }, ...changes });
    return isPrevented;
  };
  const fireCloseEvents = () => { while (registry.closeEvents.length > 0) registry.closeEvents.shift()(); };
  const submit = async () => {
    let isPrevented = false;
    await elements['lobby-chat-form'].listeners.submit({ preventDefault() { isPrevented = true; } });
    return isPrevented;
  };
  return { elements, registry, sent, toggled, clock, chatPage, listeners, windowListeners, show, submit, pressKey, fireCloseEvents };
}

const textsOf = (node) => [node.textContent, ...node.children.flatMap((child) => (typeof child === 'string' ? [child] : textsOf(child)))];
/* The lobby's live region is written only while the lobby dialog is open. */
const spokenOf = (page) => page.elements['lobby-chat-live'].children.map((item) => item.textContent);
const hideButtonOf = (line) => line.children.find((child) => typeof child !== 'string' && child.tag === 'button') || null;
const linesOf = (page) => page.elements['lobby-chat-lines'].children;

test('chat page: a text and a nick like <img src=x> and a typed web address show as text, and nothing is made from them', () => {
  // given
  const page = loadChatPage();
  page.elements.lobby = { open: true };
  const hostile = '<img src=x onerror=alert(1)>';
  const address = 'www.example.test/klad?x=<b>1</b>';

  // when
  page.show(stateOf([{ ...anna(1, hostile), nick: hostile }, anna(2, address)]));

  // then
  const lines = page.elements['lobby-chat-lines'].children;
  assert.equal(lines.length, 2);
  assert.ok(textsOf(lines[0]).includes(hostile));
  assert.equal(textsOf(lines[0]).filter((text) => text === hostile).length, 2);
  assert.ok(textsOf(lines[1]).includes(address));
  assert.equal(hideButtonOf(lines[0]).children[0].textContent, ' в чате: ' + hostile);
  assert.deepEqual(page.registry.created.filter((tag) => !['li', 'span', 'p', 'button'].includes(tag)), []);
  assert.deepEqual(spokenOf(page), [hostile + ': ' + hostile, 'Anna: ' + address]);
});

test('chat page: Enter sends the text once, a taken message empties the field, and the focus stays in the field', async () => {
  // given
  const page = loadChatPage([{ status: 201, data: {} }]);
  page.show(stateOf([]));
  page.elements['lobby-chat-text'].value = 'привет, этап 3?';

  // when
  const isPrevented = await page.submit();

  // then
  assert.equal(isPrevented, true);
  assert.deepEqual(page.sent, ['привет, этап 3?']);
  assert.equal(page.elements['lobby-chat-text'].value, '');
  assert.equal(page.elements['lobby-chat-problem'].textContent, '');
  assert.equal(page.registry.focused, page.elements['lobby-chat-text']);
});

test('chat page: text typed while the message was out stays in the field', async () => {
  // given
  let finish;
  const page = loadChatPage([new Promise((resolve) => { finish = resolve; })]);
  page.show(stateOf([]));
  page.elements['lobby-chat-text'].value = 'one';

  // when
  const sending = page.submit();
  page.elements['lobby-chat-text'].value = 'one and two';
  finish({ status: 201, data: {} });
  await sending;

  // then
  assert.equal(page.elements['lobby-chat-text'].value, 'one and two');
});

test('chat page: a refused text, writing too fast and a failed request each show their message and keep the text', async () => {
  for (const [status, text] of [[400, TEXT.refused], [429, TEXT.tooFast], [404, TEXT.gone], [0, TEXT.failed]]) {
    // given
    const page = loadChatPage([{ status, data: null }]);
    page.show(stateOf([]));
    page.elements['lobby-chat-text'].value = 'hi';

    // when
    await page.submit();

    // then
    assert.equal(page.elements['lobby-chat-problem'].textContent, text);
    assert.equal(page.elements['lobby-chat-text'].value, 'hi');
    assert.equal(page.registry.focused, page.elements['lobby-chat-text']);
  }
});

test('chat page: an empty or blank field sends nothing, and nothing changes when no message went out', async () => {
  // given
  const page = loadChatPage([null]);
  page.show(stateOf([]));

  // when
  page.elements['lobby-chat-text'].value = '   ';
  await page.submit();
  const blankSent = page.sent.length;
  page.elements['lobby-chat-text'].value = 'hi';
  await page.submit();

  // then
  assert.equal(blankSent, 0);
  assert.deepEqual(page.sent, ['hi']);
  assert.equal(page.elements['lobby-chat-text'].value, 'hi');
  assert.equal(page.elements['lobby-chat-problem'].textContent, '');
});

test('chat page: a new message is announced once, and the list is rebuilt only when its lines change', () => {
  // given
  const page = loadChatPage();
  page.elements.lobby = { open: true };
  const live = page.elements['lobby-chat-live'];
  const list = page.elements['lobby-chat-lines'];
  page.show(stateOf([anna(1, 'one')]));
  const announcedOnce = spokenOf(page);
  const replacedOnce = [live.replaced, list.replaced];

  // when
  page.show(stateOf([anna(1, 'one')]));
  const repeated = [live.replaced, list.replaced];
  page.show(stateOf([anna(1, 'one'), anna(2, 'two'), twin(3, 'three')]));

  // then
  assert.deepEqual(announcedOnce, ['Anna: one']);
  assert.deepEqual(repeated, replacedOnce);
  assert.deepEqual(spokenOf(page), ['Anna: two', 'Anna: three']);
  assert.equal(list.children.length, 3);
});

test('chat page: Скрыть чат hides the chat and stops its announcements', () => {
  // given
  const page = loadChatPage();
  page.elements.lobby = { open: true };
  page.show(stateOf([anna(1, 'one')]));
  const spokenBefore = spokenOf(page);
  const box = page.elements['lobby-chat-hide'];
  const live = page.elements['lobby-chat-live'];

  // when
  box.checked = true;
  box.listeners.change();
  const spokenWhenHidden = spokenOf(page);
  const replacedBefore = live.replaced;
  page.show(stateOf([anna(1, 'one'), anna(2, 'two')]));

  // then
  assert.deepEqual(spokenBefore, ['Anna: one']);
  assert.deepEqual(spokenWhenHidden, []);
  assert.equal(page.elements['lobby-chat-body'].hidden, true);
  assert.equal(live.replaced, replacedBefore);
  assert.equal(page.elements['lobby-chat-lines'].children.length, 0);
});

test('chat page: hiding a member empties the live region, and a later message is still announced', () => {
  // given
  const page = loadChatPage();
  page.elements.lobby = { open: true };
  page.show(stateOf([anna(1, 'one'), twin(2, 'two')]));
  const spokenBefore = spokenOf(page);

  // when
  page.show(stateOf([anna(1, 'one'), twin(2, 'two')], { hiddenMembers: [3] }));
  const spokenAfterHide = spokenOf(page);
  page.show(stateOf([anna(1, 'one'), twin(2, 'two'), anna(4, 'four')], { hiddenMembers: [3] }));

  // then
  assert.deepEqual(spokenBefore, ['Anna: one', 'Anna: two']);
  assert.deepEqual(spokenAfterHide, []);
  assert.deepEqual(spokenOf(page), ['Anna: four']);
});

test('chat page: the part shows only in a room that has answered, says when there is nothing yet, and starts clean in a new room', async () => {
  // given
  const page = loadChatPage([{ status: 429, data: null }]);
  page.elements.lobby = { open: true };
  const part = page.elements['lobby-chat'];

  // when
  page.show(stateOf([], { room: null }));
  const isHiddenWhileLoading = part.hidden;
  page.show(stateOf([]));
  const emptyText = page.elements['lobby-chat-empty'].textContent;
  page.elements['lobby-chat-text'].value = 'hi';
  await page.submit();
  const keptText = page.elements['lobby-chat-text'].value;
  page.show(stateOf([anna(1, 'one')], { roomId: OTHER }));

  // then
  assert.equal(isHiddenWhileLoading, true);
  assert.equal(part.hidden, false);
  assert.equal(emptyText, TEXT.empty);
  assert.equal(keptText, 'hi');
  assert.equal(page.elements['lobby-chat-text'].value, '');
  assert.equal(page.elements['lobby-chat-empty'].textContent, '');
  assert.equal(page.elements['lobby-chat-problem'].textContent, '');
  assert.deepEqual(spokenOf(page), ['Anna: one']);
});

test('chat page: another member\'s line has a скрыть button named with the nick in a hidden span, which hides that member by number', () => {
  // given
  const page = loadChatPage();
  page.show(stateOf([anna(1, 'one'), mine(2, 'two')]));
  const [annaLine, ownLine] = linesOf(page);
  const button = hideButtonOf(annaLine);

  // when
  button.listeners.click();

  // then
  assert.equal(button.type, 'button');
  assert.equal(button.textContent, 'скрыть');
  assert.equal(button.children.length, 1);
  assert.equal(button.children[0].className, 'visually-hidden');
  assert.equal(button.children[0].textContent, ' в чате: Anna');
  assert.deepEqual(button.attributes, {});
  assert.equal(hideButtonOf(ownLine), null);
  assert.deepEqual(page.toggled, [1]);
});

test('chat page: a nick that becomes shared gets the member number on the shown lines, in the button name and in the announcement', () => {
  // given
  const page = loadChatPage();
  page.elements.lobby = { open: true };
  const messages = [anna(1, 'one'), twin(2, 'two')];
  page.show(stateOf(messages));
  const namesBefore = linesOf(page).map((line) => line.children[0].textContent);

  // when
  page.show(stateOf(messages, { sharedNicks: ['Anna'] }));
  const namesAfter = linesOf(page).map((line) => line.children[0].textContent);
  page.show(stateOf([...messages, twin(3, 'three')], { sharedNicks: ['Anna'] }));

  // then
  assert.deepEqual(namesBefore, ['Anna', 'Anna']);
  assert.deepEqual(namesAfter, ['Anna #1', 'Anna #3']);
  assert.equal(hideButtonOf(linesOf(page)[1]).children[0].textContent, ' в чате: Anna #3');
  assert.deepEqual(spokenOf(page), ['Anna #3: three']);
});

test('chat page: a focused скрыть keeps the focus on its line through a rebuild, then goes to the list, and to Скрыть чат once no line is left', () => {
  // given
  const page = loadChatPage();
  const list = page.elements['lobby-chat-lines'];
  page.show(stateOf([anna(1, 'one'), twin(2, 'two')]));
  hideButtonOf(linesOf(page)[0]).focus();

  // when
  page.show(stateOf([anna(1, 'one'), twin(2, 'two'), anna(3, 'three')]));
  const rebuiltButton = hideButtonOf(linesOf(page)[0]);
  const keptOn = page.registry.focused;
  page.show(stateOf([anna(1, 'one'), twin(2, 'two'), anna(3, 'three')], { hiddenMembers: [1] }));
  const afterHide = page.registry.focused;
  hideButtonOf(linesOf(page)[0]).focus();
  page.show(stateOf([anna(1, 'one'), twin(2, 'two'), anna(3, 'three')], { hiddenMembers: [1, 3] }));

  // then
  assert.equal(linesOf(page).length, 0);
  assert.equal(keptOn, rebuiltButton);
  assert.equal(keptOn.dataset.line, '1');
  assert.equal(afterHide, list);
  assert.equal(page.registry.focused, page.elements['lobby-chat-hide']);
});

/* ---- the race: pop-ups, the chat dialog and its key ---- */

const popupTexts = (page) => page.elements['chat-popups'].children.map((node) => node.textContent);
const raceChatField = (page) => page.elements['race-chat-text'];

test('chat page: in a race another member\'s message is a pop-up with the nick and the text as plain text, with no focus and no listener', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  const hostile = '<img src=x onerror=alert(1)>';
  const address = 'www.example.test/klad?x=<b>1</b>';
  page.registry.focused = page.elements.game;

  // when
  page.show(stateOf([{ ...anna(1, hostile), nick: hostile }, anna(2, address)]));

  // then
  assert.deepEqual(popupTexts(page), [hostile + ': ' + hostile, 'Anna: ' + address]);
  assert.deepEqual(page.registry.created.filter((tag) => !['li', 'span', 'p', 'button'].includes(tag)), []);
  assert.equal(page.registry.focused, page.elements.game);
  assert.deepEqual(page.elements['chat-popups'].children.map((node) => Object.keys(node.listeners)), [[], []]);
});

test('chat page: pop-ups show 3 at most, the newest, and each goes after 6 s', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);

  // when
  page.show(stateOf([anna(1, 'one'), anna(2, 'two')]));
  page.clock.advance(3000);
  page.show(stateOf([anna(1, 'one'), anna(2, 'two'), anna(3, 'three'), anna(4, 'four')]));
  const four = popupTexts(page);
  page.clock.advance(3000);
  const afterFirstSix = popupTexts(page);
  page.clock.advance(3000);

  // then
  assert.deepEqual(four, ['Anna: two', 'Anna: three', 'Anna: four']);
  assert.deepEqual(afterFirstSix, ['Anna: three', 'Anna: four']);
  assert.deepEqual(popupTexts(page), []);
});

test('chat page: no pop-up outside a race, for the own message, or for a message that came while the race was over', () => {
  // given
  const page = loadChatPage();

  // when
  page.show(stateOf([anna(1, 'before the race')]));
  page.chatPage.setRace(true);
  page.show(stateOf([anna(1, 'before the race'), mine(2, 'mine')]));
  const duringRace = popupTexts(page);
  page.chatPage.setRace(false);
  page.show(stateOf([anna(1, 'before the race'), mine(2, 'mine'), anna(3, 'after the race')]));
  page.chatPage.setRace(true);
  page.show(stateOf([anna(1, 'before the race'), mine(2, 'mine'), anna(3, 'after the race')]));

  // then
  assert.deepEqual(duringRace, []);
  assert.deepEqual(popupTexts(page), []);
});

test('chat page: no pop-up while a dialog is open, and none appears later for a message that came meanwhile', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  page.elements.board = { open: true };

  // when
  page.show(stateOf([anna(1, 'one')]));
  page.elements.board.open = false;
  page.show(stateOf([anna(1, 'one')]));
  page.show(stateOf([anna(1, 'one'), anna(2, 'two')]));

  // then
  assert.deepEqual(popupTexts(page), ['Anna: two']);
});

test('chat page: no pop-up for a hidden member or with Скрыть чат on, and hiding the chat takes the showing ones away', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  page.show(stateOf([anna(1, 'one')]));
  const shownBefore = popupTexts(page);

  // when
  page.show(stateOf([anna(1, 'one'), twin(2, 'two')], { hiddenMembers: [3] }));
  const hiddenMember = popupTexts(page);
  const box = page.elements['race-chat-hide'];
  box.checked = true;
  box.listeners.change();
  const afterHide = popupTexts(page);
  page.show(stateOf([anna(1, 'one'), twin(2, 'two'), anna(3, 'three')], { hiddenMembers: [3] }));

  // then
  assert.deepEqual(shownBefore, ['Anna: one']);
  assert.deepEqual(hiddenMember, ['Anna: one']);
  assert.deepEqual(afterHide, []);
  assert.deepEqual(popupTexts(page), []);
  assert.equal(page.elements['lobby-chat-hide'].checked, true);
  assert.equal(page.elements['race-chat-body'].hidden, true);
  assert.equal(page.elements['lobby-chat-body'].hidden, true);
});

test('chat page: a nick two members share has its member number in the pop-up, as in the lobby', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);

  // when
  page.show(stateOf([twin(2, 'two')], { sharedNicks: ['Anna'] }));

  // then
  assert.deepEqual(popupTexts(page), ['Anna #3: two']);
});

test('chat page: the button and the key C open the chat dialog only in a race, and outside one the key is left alone', () => {
  // given
  const page = loadChatPage();
  const dialog = page.elements['race-chat'];

  // when
  const preventedOutside = page.pressKey('KeyC');
  page.elements['h-chat'].listeners.click();
  const openOutside = dialog.open;
  page.chatPage.setRace(true);
  const preventedInRace = page.pressKey('KeyC');

  // then
  assert.equal(preventedOutside, false);
  assert.equal(openOutside, false);
  assert.equal(preventedInRace, true);
  assert.equal(dialog.open, true);
  assert.equal(page.registry.focused, raceChatField(page));
  assert.equal(page.elements['h-chat'].hidden, false);
});

test('chat page: the button Чат is hidden outside a race', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  const shownInRace = page.elements['h-chat'].hidden;

  // when
  page.chatPage.setRace(false);

  // then
  assert.equal(shownInRace, false);
  assert.equal(page.elements['h-chat'].hidden, true);
});

test('chat page: the key C is ignored while typing, with a modifier, held down, or with a dialog already open', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  const dialog = page.elements['race-chat'];
  const attempts = [
    { target: { tagName: 'INPUT' } }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true },
  ];

  // when
  const prevented = attempts.map((changes) => page.pressKey('KeyC', changes));
  const openAfterAttempts = dialog.open;
  page.elements.board = { open: true };
  const preventedOverDialog = page.pressKey('KeyC');

  // then
  assert.deepEqual(prevented, [false, false, false, false, false]);
  assert.equal(openAfterAttempts, false);
  assert.equal(preventedOverDialog, true);
  assert.equal(dialog.open, false);
  assert.equal(page.pressKey('KeyP'), false);
});

test('chat page: opening the chat dialog takes the pop-ups away, and the dialog lists the room\'s messages', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  page.show(stateOf([anna(1, 'one')]));

  // when
  page.pressKey('KeyC');

  // then
  assert.deepEqual(popupTexts(page), []);
  assert.equal(page.clock.pending(), 0);
  assert.equal(page.elements['race-chat-lines'].children.length, 1);
});

test('chat page: a message that arrives with the chat dialog open is announced in the dialog, not as a pop-up', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  page.pressKey('KeyC');

  // when
  page.show(stateOf([anna(1, 'one')]));

  // then
  assert.deepEqual(popupTexts(page), []);
  assert.deepEqual(page.elements['race-chat-live'].children.map((item) => item.textContent), ['Anna: one']);
});

test('chat page: the chat dialog sends like the lobby chat, keeps the text on a failure, and Enter only submits the form', async () => {
  // given
  const page = loadChatPage([{ status: 429, data: null }, { status: 201, data: {} }]);
  page.chatPage.setRace(true);
  page.show(stateOf([]));
  page.pressKey('KeyC');
  raceChatField(page).value = 'hi';
  const submit = async () => {
    let isPrevented = false;
    await page.elements['race-chat-form'].listeners.submit({ preventDefault() { isPrevented = true; } });
    return isPrevented;
  };

  // when
  const isPrevented = await submit();
  const keptText = raceChatField(page).value;
  const problem = page.elements['race-chat-problem'].textContent;
  await submit();

  // then
  assert.equal(isPrevented, true);
  assert.equal(keptText, 'hi');
  assert.equal(problem, TEXT.tooFast);
  assert.deepEqual(page.sent, ['hi', 'hi']);
  assert.equal(raceChatField(page).value, '');
  assert.equal(page.elements['race-chat-problem'].textContent, '');
  assert.equal(page.registry.focused, raceChatField(page));
});

test('chat page: closing the chat dialog puts the focus back on the field, unless another dialog is open', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  page.pressKey('KeyC');

  // when
  page.elements['race-chat-close'].listeners.click();
  page.fireCloseEvents();
  const afterClose = page.registry.focused;
  page.pressKey('KeyC');
  page.elements.race = { open: true };
  page.elements['race-chat'].close();
  page.registry.focused = page.elements['race-room'] = { tag: 'button' };
  page.fireCloseEvents();

  // then
  assert.equal(afterClose, page.elements.game);
  assert.equal(page.registry.focused, page.elements['race-room']);
});

test('chat page: when the race ends the chat dialog closes, the pop-ups and the button go, and the focus is left to the results screen', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  page.show(stateOf([anna(1, 'one')]));
  page.pressKey('KeyC');

  // when
  page.chatPage.setRace(false);
  page.elements.race = { open: true };
  page.registry.focused = null;
  page.fireCloseEvents();

  // then
  assert.equal(page.elements['race-chat'].open, false);
  assert.equal(page.elements['h-chat'].hidden, true);
  assert.deepEqual(popupTexts(page), []);
  assert.equal(page.registry.focused, null);
});

test('chat page: the pop-ups have their own polite live region inside the stage, apart from the race notice, and never take a touch or a key', () => {
  // given
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'klad.css'), 'utf8');

  // when
  const stage = html.slice(html.indexOf('<main id="stage"'), html.indexOf('</main>'));
  const rule = css.slice(css.indexOf('.popups {'), css.indexOf('}', css.indexOf('.popups {')));
  const motion = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));

  // then
  assert.match(stage, /<div id="chat-popups" class="popups" aria-live="polite"><\/div>/);
  assert.match(stage, /<p id="race-notice" class="notice race-notice" role="status"><\/p>/);
  assert.doesNotMatch(stage.match(/<div id="chat-popups"[^>]*>/)[0], /tabindex|role=/);
  assert.match(rule, /pointer-events: none/);
  assert.match(motion, /\.popups p \{ animation/);
  assert.doesNotMatch(rule, /animation/);
});

test('chat page: a held C is stopped in the field it opened until the key comes up, and so is a held Enter or C in the race field', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  const inRaceField = { tagName: 'INPUT', id: 'race-chat-text' };
  const inOtherField = { tagName: 'INPUT', id: 'lobby-chat-text' };
  page.pressKey('KeyC');

  // when
  const heldC = page.pressKey('KeyC', { repeat: true, target: inOtherField });
  page.listeners.keyup({ code: 'KeyC' });
  const heldCAfterKeyUp = page.pressKey('KeyC', { repeat: true, target: inOtherField });
  const held = ['Enter', 'NumpadEnter', 'KeyC'].map((code) => page.pressKey(code, { repeat: true, target: inRaceField }));
  const heldEnterElsewhere = page.pressKey('Enter', { repeat: true, target: inOtherField });
  const firstEnter = page.pressKey('Enter', { target: inRaceField });

  // then
  assert.equal(heldC, true);
  assert.equal(heldCAfterKeyUp, false);
  assert.deepEqual(held, [true, true, true]);
  assert.equal(heldEnterElsewhere, false);
  assert.equal(firstEnter, false);
});

test('chat page: a message over the closed race dialog is not written into its live region, and is not read when the dialog opens', () => {
  // given
  const page = loadChatPage();
  page.chatPage.setRace(true);
  page.elements.lobby = { open: false };
  page.show(stateOf([anna(1, 'one')]));
  const writtenWhileClosed = page.elements['race-chat-live'].children.length;

  // when
  page.pressKey('KeyC');
  page.show(stateOf([anna(1, 'one'), anna(2, 'two')]));

  // then
  assert.equal(writtenWhileClosed, 0);
  assert.deepEqual(page.elements['race-chat-live'].children.map((item) => item.textContent), ['Anna: two']);
  assert.deepEqual(spokenOf(page), []);
});

test('chat page: a restored tick in a Скрыть чат box is cleared at load, and the chat shows', () => {
  // given
  const page = loadChatPage([], ['lobby-chat-hide', 'race-chat-hide']);

  // when
  page.show(stateOf([anna(1, 'one')]));

  // then
  assert.equal(page.elements['lobby-chat-hide'].checked, false);
  assert.equal(page.elements['race-chat-hide'].checked, false);
  assert.equal(page.elements['lobby-chat-lines'].children.length, 1);
});

test('chat page: a tick a browser restores after load is set back from the switch at pageshow', () => {
  // given
  const page = loadChatPage();
  page.show(stateOf([anna(1, 'one')]));
  page.elements['lobby-chat-hide'].checked = true;
  page.elements['race-chat-hide'].checked = true;

  // when
  page.windowListeners.pageshow({ persisted: false });
  const afterRestore = [page.elements['lobby-chat-hide'].checked, page.elements['race-chat-hide'].checked];
  page.elements['lobby-chat-hide'].checked = true;
  page.elements['lobby-chat-hide'].listeners.change();
  page.windowListeners.pageshow({ persisted: false });

  // then
  assert.deepEqual(afterRestore, [false, false]);
  assert.equal(page.elements['lobby-chat-hide'].checked, true);
  assert.equal(page.elements['race-chat-hide'].checked, true);
});

test('chat page: a pop-up is one line on a short screen', () => {
  // given
  const css = fs.readFileSync(path.join(__dirname, '..', 'klad.css'), 'utf8');

  // then
  assert.match(css, /@media \(max-height: 500px\) \{\s*\.popups p \{ -webkit-line-clamp: 1; \}/);
});
