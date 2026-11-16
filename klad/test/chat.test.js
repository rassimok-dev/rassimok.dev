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

/* ---- the page half, in a vm context with a stub page ---- */

function stubNode(tag, registry) {
  return {
    tag, textContent: '', className: '', hidden: false, checked: false, value: '',
    children: [], listeners: {}, attributes: {}, dataset: {}, replaced: 0, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
    addEventListener(type, listener) { this.listeners[type] = listener; },
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; this.replaced++; },
    querySelectorAll(selector) {
      return this.children.flatMap((child) => (typeof child === 'string' ? [] : [...(child.tag === selector ? [child] : []), ...child.querySelectorAll(selector)]));
    },
    contains(other) { return other === this || this.children.some((child) => typeof child !== 'string' && child.contains(other)); },
    focus() { registry.focused = this; },
  };
}

function loadChatPage(sendAnswers = []) {
  const registry = { focused: null, created: [] };
  const elements = {};
  const listeners = {};
  const sent = [];
  const toggled = [];
  const document = {
    get activeElement() { return registry.focused; },
    getElementById: (id) => elements[id] || (elements[id] = stubNode('#' + id, registry)),
    createElement: (tag) => { registry.created.push(tag); return stubNode(tag, registry); },
    addEventListener: (type, listener) => { listeners[type] = listener; },
  };
  const sandbox = {
    document,
    KLAD_LOBBY: {
      page: {
        sendMessage: async (text) => { sent.push(text); return sendAnswers.shift(); },
        toggleMemberHidden: (member) => toggled.push(member),
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'chat.js'), 'utf8'), sandbox);
  const show = (state) => listeners['klad:lobby']({ detail: state });
  const submit = async () => {
    let isPrevented = false;
    await elements['lobby-chat-form'].listeners.submit({ preventDefault() { isPrevented = true; } });
    return isPrevented;
  };
  return { elements, registry, sent, toggled, show, submit };
}

const textsOf = (node) => [node.textContent, ...node.children.flatMap((child) => (typeof child === 'string' ? [child] : textsOf(child)))];
const spokenOf = (page) => page.elements['lobby-chat-live'].children.map((item) => item.textContent);
const hideButtonOf = (line) => line.children.find((child) => typeof child !== 'string' && child.tag === 'button') || null;
const linesOf = (page) => page.elements['lobby-chat-lines'].children;

test('chat page: a text and a nick like <img src=x> and a typed web address show as text, and nothing is made from them', () => {
  // given
  const page = loadChatPage();
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
  page.show(stateOf([anna(1, 'one')]));
  const box = page.elements['lobby-chat-hide'];
  const live = page.elements['lobby-chat-live'];

  // when
  box.checked = true;
  box.listeners.change();
  const spokenWhenHidden = spokenOf(page);
  const replacedBefore = live.replaced;
  page.show(stateOf([anna(1, 'one'), anna(2, 'two')]));

  // then
  assert.deepEqual(spokenWhenHidden, []);
  assert.equal(page.elements['lobby-chat-body'].hidden, true);
  assert.equal(live.replaced, replacedBefore);
  assert.equal(page.elements['lobby-chat-lines'].children.length, 0);
});

test('chat page: hiding a member empties the live region, and a later message is still announced', () => {
  // given
  const page = loadChatPage();
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
