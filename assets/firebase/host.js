import {configured, connect, roomCode, joinURL, presence, message, el, safePrompt,
  ROOM_LIFETIME, ref, set, update, remove, onValue, onChildAdded, onChildChanged,
  runTransaction, serverTimestamp} from './client.js';

let session = null, timer = null;
let revision = 0, lastContent = '', lastBody = null, actionCounter = 0, actionNodes = new Map();
const nodeKeys = new WeakMap();
const processed = new Set();
const hostBar = el('section', undefined, 'room-host-bar');
hostBar.hidden = true;
document.querySelector('.top').after(hostBar);

function installEntry() {
  const lobby = document.querySelector('.adventure-lobby');
  if (!lobby || session || lobby.querySelector('#hostPhones')) return;
  const row = el('div', undefined, 'room-entry actions');
  const button = el('button', 'Host with Phones', 'secondary');
  button.id = 'hostPhones';
  button.addEventListener('click', hostRoom);
  const join = el('a', 'Join a Room', 'room-link');
  join.href = 'board-controller.html';
  row.append(button, join);
  lobby.append(row);
}
function errorDialog(text) {
  modalRoot.replaceChildren();
  const backdrop = el('div', undefined, 'modal-backdrop');
  const modal = el('div', undefined, 'modal');
  const done = el('button', 'Back', 'primary');
  done.addEventListener('click', closeModal);
  modal.append(el('h2', 'Phone play'), el('p', text), done);
  backdrop.append(modal); modalRoot.append(backdrop);
}
function status(text) {
  const node = document.getElementById('roomConnection');
  if (node) node.textContent = text;
}
async function hostRoom() {
  if (session) return;
  if (!configured()) {
    errorDialog('Phone play needs to be connected to Firebase before you can host. You can still play together on this device.');
    return;
  }
  const button = document.getElementById('hostPhones');
  button.disabled = true; button.textContent = 'Creating room…';
  try {
    const {db, uid} = await connect();
    let code;
    for (let attempt = 0; attempt < 8; attempt++) {
      code = roomCode();
      const result = await runTransaction(ref(db, `rooms/${code}/meta`), old => old ? undefined : {
        hostUid: uid, phase: 'lobby', createdAt: serverTimestamp(), expiresAt: Date.now() + ROOM_LIFETIME
      });
      if (result.committed) break;
      code = null;
    }
    if (!code) throw new Error('Could not reserve a room');
    session = {db, uid, code, phase: 'lobby', online: false, members: [], errors: {}, onlineMembers: {}, stops: []};
    revision = 0; lastContent = ''; lastBody = null; processed.clear();
    const catalog = {
      tokens: TOKEN_OPTIONS.map(({id, icon, name}) => ({id, icon, name})),
      pins: PIN_DESIGNS.map(({id, icon, name, park}) => ({id, icon, name, park}))
    };
    await set(ref(db, `rooms/${code}/catalog`), catalog);
    drawHostBar(); drawLobby();
    const fail = error => {status(message(error));};
    session.stops.push(onValue(ref(db, '.info/connected'), async snap => {
      if (!session || session.code !== code) return;
      session.online = snap.val() === true;
      status(session.online ? 'Connected · Keep this screen open' : 'Reconnecting… phone controls paused');
      if (session.online) {
        try {await presence(db, code, uid); schedule();} catch (e) {fail(e);}
      }
    }));
    session.stops.push(onValue(ref(db, `rooms/${code}/members`), snap => {
      if (!session || session.code !== code || session.phase !== 'lobby') return;
      const entries = Object.entries(snap.val() || {}).sort((a,b) => a[1].joinedAt - b[1].joinedAt || a[0].localeCompare(b[0]));
      const names = new Set(), tokens = new Set(), pins = new Set();
      session.errors = {};
      for (const [extraUid] of entries.slice(8)) remove(ref(db, `rooms/${code}/members/${extraUid}`)).catch(fail);
      session.members = entries.slice(0,8).map(([memberUid, m]) => {
        const name = String(m.name || '').trim().slice(0,24);
        const member = {uid: memberUid, name, token: m.token || '', startingPin: m.startingPin || ''};
        if (!name || names.has(name.toLowerCase())) session.errors[memberUid] = 'Choose a different player name.';
        names.add(name.toLowerCase());
        if (member.token && (!TOKEN_OPTIONS.some(t => t.id === member.token) || tokens.has(member.token))) {
          session.errors[memberUid] = 'That playing piece is taken. Choose another.'; member.token = '';
        }
        if (member.startingPin && (!pinInfo(member.startingPin) || pins.has(member.startingPin))) {
          session.errors[memberUid] = 'That starting pin is taken. Choose another.'; member.startingPin = '';
        }
        if (member.token) tokens.add(member.token);
        if (member.startingPin) pins.add(member.startingPin);
        return member;
      });
      drawLobby(); schedule();
    }, fail));
    session.stops.push(onValue(ref(db, `rooms/${code}/presence`), snap => {
      if (!session || session.code !== code) return;
      session.onlineMembers = snap.val() || {};
      if (session.phase === 'lobby') drawLobby();
    }, fail));
    const receive = snap => receiveCommand(snap).catch(fail);
    session.stops.push(onChildAdded(ref(db, `rooms/${code}/commands`), receive, fail));
    session.stops.push(onChildChanged(ref(db, `rooms/${code}/commands`), receive, fail));
    schedule();
  } catch (error) {
    if (session) await disposeRoom();
    else {button.disabled = false; button.textContent = 'Host with Phones';}
    errorDialog(message(error));
  }
}
function drawHostBar() {
  hostBar.replaceChildren(); hostBar.hidden = false;
  const code = el('strong', session.code, 'room-code'); code.id = 'hostRoomCode';
  const link = el('a', 'Open phone controller', 'room-link'); link.href = joinURL(session.code); link.target = '_blank'; link.rel = 'noopener';
  const connection = el('span', 'Connecting…', 'muted'); connection.id = 'roomConnection';
  const close = el('button', 'End Room', 'secondary'); close.id = 'endPhoneRoom';
  close.addEventListener('click', async () => {
    const playing = session.phase === 'playing';
    if (playing && !confirm('Disconnect the phones and continue playing on this device?')) return;
    if (!await disposeRoom()) return;
    if (!playing) {closeModal(); players = []; setupPlayers = [{name:''}]; showSetup();}
  });
  hostBar.append(el('span', 'PHONE ROOM'), code, link, connection, close);
  document.querySelector('.session-tag').textContent = 'PHONE CONTROLLERS';
}
function drawLobby() {
  if (!session || session.phase !== 'lobby') return;
  app.replaceChildren();
  const panel = el('section', undefined, 'panel collection-lobby');
  panel.append(el('div', 'YOUR SHARED SCREEN', 'lobby-kicker'), el('h1', 'Bring your park people.'),
    el('p', 'Open the phone controller on each phone or tablet, enter the room code, then choose your name, playing piece, and starting pin.', 'muted'));
  const link = el('a', joinURL(session.code), 'room-link room-join-address'); link.href = joinURL(session.code);
  panel.append(link);
  const list = el('div', undefined, 'room-party');
  for (const member of session.members) {
    const line = el('div', undefined, 'room-player');
    const token = TOKEN_OPTIONS.find(t => t.id === member.token), pin = pinInfo(member.startingPin);
    const info = el('div');
    info.append(el('strong', `${token?.icon || '🎟️'} ${member.name || 'Player'}`),
      el('p', session.errors[member.uid] || (!token ? 'Choosing a playing piece…' : !pin ? 'Choosing a starting pin…' : `${token.name} · ${pin.name}`), 'muted'));
    const online = session.onlineMembers[member.uid]?.online !== false;
    info.append(el('small', online ? 'Joined' : 'Disconnected — can rejoin'));
    const removePlayer = el('button', 'Remove', 'secondary');
    removePlayer.addEventListener('click', () => remove(ref(session.db, `rooms/${session.code}/members/${member.uid}`)).catch(e => status(message(e))));
    line.append(info, removePlayer); list.append(line);
  }
  if (!session.members.length) list.append(el('p', 'Waiting for your first player…', 'muted'));
  const start = el('button', 'Start Adventure', 'primary'); start.id = 'startPhoneGame';
  start.disabled = !session.members.length || !!Object.keys(session.errors).length || session.members.some(m => !m.token || !m.startingPin);
  start.addEventListener('click', startRoomGame);
  panel.append(list, start, el('p', 'Keep this tab open and this device awake throughout the game. Phones can reconnect using the same browser.', 'muted'));
  app.append(panel);
}
async function startRoomGame() {
  if (!session || !session.online || session.phase !== 'lobby') return;
  if (!session.members.length || Object.keys(session.errors).length || session.members.some(m => !m.token || !m.startingPin)) return;
  const start = document.getElementById('startPhoneGame'); start.disabled = true;
  // Freeze enrollment first, then reread the final roster; a last-second phone choice
  // cannot reserve a duplicate token/pin or change seats while the game starts.
  try {
    await update(ref(session.db, `rooms/${session.code}/meta`), {phase: 'playing'});
    const {get} = await import('./client.js');
    const final = (await get(ref(session.db, `rooms/${session.code}/members`))).val() || {};
    const valid = session.members.length === Object.keys(final).length && session.members.every(m => {
      const f = final[m.uid]; return f && f.name.trim() === m.name && f.token === m.token && f.startingPin === m.startingPin;
    });
    if (!valid) {
      await update(ref(session.db, `rooms/${session.code}/meta`), {phase: 'lobby'});
      status('A player choice changed. Check the party and start again.'); drawLobby(); return;
    }
    session.phase = 'playing';
    players = session.members.map(m => ({name:m.name, token:m.token, startingPin:m.startingPin, cash:1000, pos:0, parkHopperSteps:0, parkHopperLaps:0, badges:[], props:[], autographs:[]}));
    showStartingPinSetup(0);
    document.getElementById('startingPinStart').click();
    schedule();
    try {await navigator.wakeLock?.request('screen');} catch (_) {}
  } catch (error) {status(message(error)); if (session.phase === 'lobby') start.disabled = false;}
}
function actorIndex() {
  if (modalRoot.querySelector('#propertyCashAccept,#propertyAccept,#propertyDecline')) return propertyTradeTurn?.partnerIndex ?? currentPlayer;
  if (modalRoot.querySelector('#pinTradeAccept,#pinTradeDecline')) return pinTradeVisit?.partnerIndex ?? currentPlayer;
  return currentPlayer;
}
function keyFor(node) {
  if (!nodeKeys.has(node)) nodeKeys.set(node, 'c' + (++actionCounter));
  return nodeKeys.get(node);
}
function promptHTML() {
  actionNodes = new Map();
  let source = modalRoot.querySelector('.modal');
  let clone;
  if (source) clone = source.cloneNode(true);
  else {
    source = el('div'); clone = source;
    clone.append(el('h2', gameOver ? 'Adventure complete!' : `${players[currentPlayer].name}’s turn`));
    clone.append(el('p', document.getElementById('status')?.textContent || '', 'muted'));
    const actions = el('div', undefined, 'actions');
    const ids = ['rollBtn','castleFinaleBtn'];
    for (const id of ids) {
      const original = document.getElementById(id);
      if (!original) continue;
      const button = original.cloneNode(true), key = keyFor(original);
      button.dataset.roomAction = key; actionNodes.set(key, original); actions.append(button);
    }
    const pins = document.querySelector(`[data-pin-player="${currentPlayer}"]`);
    if (pins) {
      const button = pins.cloneNode(true), key = keyFor(pins);
      button.dataset.roomAction = key; actionNodes.set(key, pins); actions.append(button);
    }
    clone.append(actions);
    return safePrompt(clone).outerHTML;
  }
  const originalControls = [...source.querySelectorAll('button,input')];
  [...clone.querySelectorAll('button,input')].forEach((control, i) => {
    const original = originalControls[i];
    const key = keyFor(original);
    if (control.tagName === 'BUTTON') control.dataset.roomAction = key;
    else if (control.type === 'number') {control.dataset.roomField = key; control.setAttribute('value', original.value);}
    else return;
    actionNodes.set(key, original);
  });
  if (source.querySelector('#snackPhoto')) {
    clone.querySelector('.snack-picture')?.replaceWith(el('p', 'Look at the snack picture on the shared screen.', 'muted'));
  }
  return safePrompt(clone).outerHTML;
}
function stateBody() {
  const s = session;
  const seats = Object.fromEntries(s.members.map((m,i) => [m.uid,i]));
  if (s.phase === 'lobby') return {phase:'lobby', members:s.members, seats, lobbyErrors:s.errors};
  return {
    phase: gameOver ? 'finished' : 'playing', members:s.members, seats,
    actorUid:s.members[actorIndex()]?.uid || '', currentPlayer,
    players:players.map(p => ({name:p.name, token:p.token, cash:p.cash, pos:p.pos, badges:p.badges,
      properties:p.props.map(i => SPACES[i].name), pins:(p.pins || []).map(id => ({id, name:pinInfo(id)?.name || id, icon:pinInfo(id)?.icon || '📌'})), eliminated:!!p.eliminated})),
    prompt:promptHTML(), log:[...document.querySelectorAll('#logList .log-item')].slice(0,4).map(n => n.textContent)
  };
}
function schedule() {
  installEntry();
  if (!session || timer) return;
  timer = setTimeout(() => {timer = null; publish().catch(e => status(message(e)));}, 120);
}
let writing = false, needsWrite = false;
async function publish() {
  if (!session || !session.online) return;
  if (writing) {needsWrite = true; return;}
  const body = stateBody(), content = JSON.stringify(body);
  if (content === lastContent) return;
  const s = session; lastContent = content;
  const state = {revision:++revision, updatedAt:serverTimestamp()};
  // Send only changed fields. The board animation itself never crosses the network.
  for (const key of new Set([...Object.keys(lastBody || {}), ...Object.keys(body)])) {
    if (JSON.stringify(body[key]) === JSON.stringify(lastBody?.[key])) continue;
    if (key === 'players' && lastBody?.players && body.players) {
      body.players.forEach((player, i) => {
        for (const field of Object.keys(player)) {
          if (JSON.stringify(player[field]) !== JSON.stringify(lastBody.players[i]?.[field])) state[`players/${i}/${field}`] = player[field];
        }
      });
    } else state[key] = body[key] ?? null;
  }
  writing = true;
  try {await update(ref(s.db, `rooms/${s.code}/state`), state); lastBody = body;}
  catch (e) {lastContent = ''; throw e;}
  finally {writing = false; if (needsWrite) {needsWrite = false; schedule();}}
}
async function receiveCommand(snap) {
  const command = snap.val(), s = session;
  if (!s || s.phase !== 'playing' || !s.online || !command || processed.has(command.id)) return;
  processed.add(command.id);
  if (processed.size > 1000) processed.delete(processed.values().next().value);
  const actor = s.members[actorIndex()]?.uid;
  const node = actionNodes.get(command.action);
  if (snap.key === actor && command.revision === revision && node?.isConnected && !node.disabled) {
    revision++; lastContent = ''; // retire the previous prompt before any callback runs
    if (node.tagName === 'BUTTON') node.click();
    else if (node.tagName === 'INPUT' && node.type === 'number' && typeof command.value === 'string' && command.value.length <= 20) {
      node.value = command.value; node.dispatchEvent(new Event('input', {bubbles:true})); node.dispatchEvent(new Event('change', {bubbles:true}));
    }
    schedule();
  }
  await runTransaction(ref(s.db, `rooms/${s.code}/commands/${snap.key}`), old => old?.id === command.id ? null : undefined);
}
async function disposeRoom() {
  const s = session;
  if (!s) return true;
  // Remove while still subscribed/connected so controllers receive room closure.
  try {await remove(ref(s.db, `rooms/${s.code}`));} catch (e) {status(message(e)); return false;}
  s.stops.forEach(stop => stop()); session = null;
  clearTimeout(timer); timer = null; hostBar.hidden = true;
  document.querySelector('.session-tag').textContent = 'LOCAL MULTIPLAYER';
  return true;
}
window.addEventListener('beforeunload', event => {
  if (session?.phase === 'playing') {event.preventDefault(); event.returnValue = '';}
});
document.addEventListener('click', event => {
  if (session?.phase === 'playing' && !session.online && (app.contains(event.target) || modalRoot.contains(event.target))) {
    event.preventDefault(); event.stopImmediatePropagation(); status('Reconnect before continuing the game.');
  }
}, true);
new MutationObserver(schedule).observe(app, {subtree:true, childList:true, attributes:true, attributeFilter:['disabled','aria-pressed','class']});
new MutationObserver(schedule).observe(modalRoot, {subtree:true, childList:true, attributes:true, attributeFilter:['disabled','aria-pressed','class']});
installEntry();
