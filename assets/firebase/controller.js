import {configured, connect, presence, message, el, safePrompt, CODE_PATTERN,
  ref, get, set, update, remove, onValue, serverTimestamp} from './client.js?v=179';

const app = document.getElementById('controllerApp');
const connection = document.getElementById('controllerConnection');
const errorBox = document.getElementById('controllerError');
let session = null, state = null, catalog = null, hostOnline = false, connected = false;
let pending = false, pendingTimer = null, renderedRevision = -1;
function error(text) {errorBox.textContent = text;}
function button(text, action, className = 'primary') {
  const node = el('button', text, className); node.type = 'button'; node.addEventListener('click', action); return node;
}
function joinForm(prefill = new URLSearchParams(location.search).get('room') || '') {
  clearView();
  const card = el('section', undefined, 'controller-card');
  const form = el('form');
  const codeLabel = el('label', 'Room code'); codeLabel.htmlFor = 'joinCode';
  const code = el('input'); code.id = 'joinCode'; code.name = 'room'; code.maxLength = 6; code.required = true;
  code.autocomplete = 'off'; code.autocapitalize = 'characters'; code.spellcheck = false; code.value = prefill.toUpperCase();
  code.pattern = '[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}'; code.placeholder = 'ABC234';
  const nameLabel = el('label', 'Your name'); nameLabel.htmlFor = 'joinName';
  const name = el('input'); name.id = 'joinName'; name.name = 'name'; name.maxLength = 24; name.required = true; name.autocomplete = 'nickname';
  name.value = localStorage.getItem('wdw-player-name') || '';
  const join = el('button', 'Join Adventure', 'primary'); join.id = 'joinRoom'; join.type = 'submit';
  join.disabled = !configured();
  form.append(codeLabel, code, nameLabel, name, join);
  form.addEventListener('submit', async event => {
    event.preventDefault(); error('');
    const room = code.value.trim().toUpperCase(), playerName = name.value.trim();
    if (!CODE_PATTERN.test(room) || !playerName) {error('Enter the six-character room code and your name.'); return;}
    join.disabled = true;
    try {if (!await joinRoom(room, playerName)) join.disabled = false;} catch (e) {error(message(e)); join.disabled = false;}
  });
  card.append(el('h1', 'Your adventure starts here.'), el('p', 'Enter the code shown on the computer or tablet hosting your board.', 'muted'), form);
  if (!configured()) card.append(el('p', 'Phone play is being connected. For now, you can play together on one device.', 'muted'));
  app.append(card);
}
async function joinRoom(code, name) {
  const {db, uid} = await connect();
  const base = `rooms/${code}`;
  const meta = (await get(ref(db, `${base}/meta`))).val();
  if (!meta || meta.expiresAt <= Date.now()) throw new Error('Room unavailable');
  const existing = (await get(ref(db, `${base}/members/${uid}`))).val();
  if (!existing) {
    if (meta.phase !== 'lobby') {error('This adventure has already started. Join the next game.'); return false;}
    await set(ref(db, `${base}/members/${uid}`), {name, token:'', startingPin:'', joinedAt:serverTimestamp()});
  }
  catalog = (await get(ref(db, `${base}/catalog`))).val();
  if (!catalog) throw new Error('Room still opening');
  session = {db, uid, code, meta, member:existing || {name,token:'',startingPin:''}, stops:[]};
  localStorage.setItem('wdw-player-name', existing?.name || name);
  const url = new URL(location.href); url.searchParams.set('room', code); history.replaceState({}, '', url);
  const fail = e => {if (session) error(message(e));};
  session.stops.push(onValue(ref(db, '.info/connected'), async snap => {
    if (session?.code !== code) return;
    connected = snap.val() === true;
    if (connected) {try {await presence(db, code, uid);} catch (e) {fail(e);}}
    refreshConnection();
  }));
  session.stops.push(onValue(ref(db, `${base}/presence/${meta.hostUid}`), snap => {hostOnline = snap.val()?.online === true; refreshConnection();}, fail));
  session.stops.push(onValue(ref(db, `${base}/meta`), snap => {
    if (session?.code !== code) return;
    const value = snap.val();
    if (!value) {closedRoom(); return;}
    session.meta = value;
  }, fail));
  session.stops.push(onValue(ref(db, `${base}/state`), snap => {
    if (!session) return;
    state = snap.val();
    if (!state) return;
    if (state.revision !== renderedRevision) {pending = false; clearTimeout(pendingTimer); renderedRevision = state.revision;}
    render();
  }, fail));
  session.stops.push(onValue(ref(db, `${base}/members/${uid}`), snap => {
    if (!session) return;
    if (!snap.exists()) {closedRoom('You were removed from this room.'); return;}
    session.member = snap.val();
  }, fail));
  return true;
}
function refreshConnection() {
  connection.textContent = !connected ? 'Reconnecting… your choices are paused.' : !hostOnline ? 'Waiting for the shared screen to reconnect…' : `Connected · Room ${session?.code || ''}`;
  const disabled = !connected || !hostOnline || pending;
  app.querySelectorAll('[data-room-action],[data-apply-field],[data-room-field]').forEach(node => {node.disabled = disabled || node.dataset.originalDisabled === 'true';});
}
function render() {
  if (!session || !state) return;
  error(''); clearView();
  if (state.phase === 'lobby') {renderLobby(); refreshConnection(); return;}
  const index = state.seats?.[session.uid];
  const player = state.players?.[index];
  if (!player) {app.append(el('p', 'Waiting for the host to finish setting up your seat.', 'controller-card')); return;}
  const hud = el('section', undefined, 'controller-card player-hud');
  hud.append(el('h2', `${catalog.tokens.find(t => t.id === player.token)?.icon || '🎟️'} ${player.name}`),
    el('strong', `$${player.cash.toLocaleString()}`, 'phone-cash'),
    el('p', `${(player.badges || []).length}/6 badges · ${(player.properties || []).length} properties · ${(player.pins || []).length} pins`, 'muted'));
  app.append(hud);
  const active = state.actorUid === session.uid && !player.eliminated;
  const card = el('section', undefined, 'controller-card room-prompt');
  if (active) {
    const template = document.createElement('template'); template.innerHTML = state.prompt || '<p>Watch the shared screen…</p>';
    for (const node of [...template.content.children]) card.append(safePrompt(node));
    decorateSnackPictures(card);
    card.querySelectorAll('[data-room-action]').forEach(node => {
      node.dataset.originalDisabled = String(node.disabled);
      node.addEventListener('click', () => send(node.dataset.roomAction));
    });
    card.querySelectorAll('[data-room-field]').forEach(input => {
      input.dataset.originalDisabled = String(input.disabled);
      input.id = 'field-' + input.dataset.roomField;
      if (card.querySelectorAll('[data-room-field]').length === 1) card.querySelector('label')?.setAttribute('for', input.id);
      const apply = button('Update Amount', () => send(input.dataset.roomField, input.value), 'secondary');
      apply.dataset.applyField = input.dataset.roomField; input.after(apply);
    });
  } else {
    const actorIndex = state.seats?.[state.actorUid], actor = state.players?.[actorIndex];
    card.append(el('h2', player.eliminated ? 'Enjoy the rest of the adventure.' : state.phase === 'finished' ? 'Adventure complete!' : 'Watch the shared screen.'),
      el('p', player.eliminated ? 'You are out of this game. The remaining players can keep exploring.' : state.phase === 'finished' ? 'Check the board for your Castle Quest winner.' : `${actor?.name || 'The host'} is making a choice. Your controls will appear when it is your turn.`, 'muted'));
  }
  app.append(card);
  const collection = el('details', undefined, 'controller-card phone-collection');
  collection.append(el('summary', 'Your collection'));
  collection.append(el('h3', 'Badges'), el('p', (player.badges || []).join(' · ') || 'No badges yet.', 'muted'), el('h3', 'Pins'));
  for (const pin of player.pins || []) collection.append(el('p', `${pin.icon} ${pin.name}`));
  collection.append(el('h3', 'Properties'));
  for (const name of player.properties || []) collection.append(el('p', name));
  app.append(collection);
  refreshConnection();
}
function decorateSnackPictures(card) {
  card.querySelectorAll('.snack-picture img').forEach(photo => {
    const frame = photo.parentElement;
    let mask = null;
    try {
      const bounds = JSON.parse(photo.dataset.roomSnackMask || 'null');
      if (bounds && ['left','top','width','height'].every(k => Number.isFinite(bounds[k]) && bounds[k] >= 0 && bounds[k] <= 100) && bounds.left + bounds.width <= 100 && bounds.top + bounds.height <= 100) {
        mask = el('div', undefined, 'phone-snack-mask'); mask.setAttribute('aria-hidden','true'); frame.append(mask);
        const position = () => {
          if (!photo.isConnected || !photo.naturalWidth || !photo.naturalHeight) return;
          const scale = Math.max(frame.clientWidth / photo.naturalWidth, frame.clientHeight / photo.naturalHeight);
          const width = photo.naturalWidth * scale, height = photo.naturalHeight * scale;
          mask.style.left = ((frame.clientWidth - width)/2 + bounds.left * width/100) + 'px';
          mask.style.top = ((frame.clientHeight - height)/2 + bounds.top * height/100) + 'px';
          mask.style.width = bounds.width * width/100 + 'px'; mask.style.height = bounds.height * height/100 + 'px';
        };
        photo.addEventListener('load', position);
        const observer = new ResizeObserver(position); observer.observe(frame);
        // A replaced prompt releases its resize observer rather than retaining images.
        photo._releaseSnackObserver = () => observer.disconnect();
        position();
      }
    } catch (_) {}
    photo.addEventListener('error', () => {
      if (!photo.isConnected) return;
      photo._releaseSnackObserver?.(); frame.replaceChildren(el('p', 'The snack picture could not load.', 'muted'));
    });
  });
}
function clearView() {
  app.querySelectorAll('.snack-picture img').forEach(photo => photo._releaseSnackObserver?.());
  app.replaceChildren();
}
function renderLobby() {
  const member = session.member, others = (state.members || []).filter(m => m.uid !== session.uid);
  const card = el('section', undefined, 'controller-card');
  card.append(el('h1', `Welcome, ${member.name}.`), el('p', state.lobbyErrors?.[session.uid] || 'Pick your playing piece and a starting pin. Then wait for the host to start.', 'muted'));
  if (state.lobbyErrors?.[session.uid]?.includes('name')) {
    const name = el('input'); name.value = member.name; name.maxLength = 24; name.setAttribute('aria-label','New player name');
    card.append(name, button('Update Name', () => choose({name:name.value.trim()})));
  }
  card.append(el('h2', 'Your playing piece'));
  const tokens = el('div', undefined, 'phone-choice-grid');
  for (const token of catalog.tokens || []) {
    const selected = member.token === token.id, taken = others.some(m => m.token === token.id);
    const choice = button(`${token.icon} ${token.name}`, () => choose({token:token.id}), selected ? 'secondary selected' : 'secondary');
    choice.dataset.chooseToken = token.id; choice.setAttribute('aria-pressed',String(selected)); choice.disabled = taken;
    tokens.append(choice);
  }
  card.append(tokens, el('h2', 'Your starting pin'));
  const pins = el('div', undefined, 'phone-choice-grid');
  for (const pin of catalog.pins || []) {
    const selected = member.startingPin === pin.id, taken = others.some(m => m.startingPin === pin.id);
    const choice = button(`${pin.icon} ${pin.name}`, () => choose({startingPin:pin.id}), selected ? 'secondary selected' : 'secondary');
    choice.dataset.choosePin = pin.id; choice.setAttribute('aria-pressed',String(selected)); choice.disabled = taken;
    pins.append(choice);
  }
  card.append(pins, el('p', `${(state.members || []).length} player${(state.members || []).length === 1 ? '' : 's'} joined. ${member.token && member.startingPin ? 'You are ready!' : 'Choose both to get ready.'}`, 'muted'));
  card.append(button('Leave Room', leaveRoom, 'secondary')); app.append(card);
}
async function choose(values) {
  if (!session || !connected || !hostOnline || session.meta.phase !== 'lobby') return;
  try {
    await update(ref(session.db, `rooms/${session.code}/members/${session.uid}`), values);
    session.member = {...session.member, ...values}; render();
  } catch (e) {error(message(e));}
}
async function send(action, value) {
  if (!session || !state || pending || !connected || !hostOnline || state.actorUid !== session.uid) return;
  pending = true; refreshConnection();
  const revision = state.revision;
  const command = {id:crypto.randomUUID(), action, revision, sentAt:serverTimestamp()};
  if (value !== undefined) command.value = value.slice(0,20);
  try {
    await set(ref(session.db, `rooms/${session.code}/commands/${session.uid}`), command);
    if (pending && state?.revision === revision) pendingTimer = setTimeout(() => {
      pending = false; refreshConnection(); error('Still waiting for the host. Check the shared screen before trying again.');
    }, 6000);
  } catch (e) {pending = false; refreshConnection(); error(message(e));}
}
async function leaveRoom() {
  if (!session || session.meta.phase !== 'lobby') return;
  try {await remove(ref(session.db, `rooms/${session.code}/members/${session.uid}`)); closedRoom('You left the room.');}
  catch (e) {error(message(e));}
}
function closedRoom(text = 'The host ended this room. Join another adventure when you are ready.') {
  session?.stops.forEach(stop => stop()); session = null; state = null; renderedRevision = -1;
  pending = false; clearTimeout(pendingTimer); connected = false; hostOnline = false;
  connection.textContent = text; error(''); joinForm('');
}
joinForm();
// Refreshing a controller rejoins its existing seat without registering a new player.
const initialCode = new URLSearchParams(location.search).get('room')?.toUpperCase();
if (configured() && initialCode && CODE_PATTERN.test(initialCode)) {
  (async () => {
    const {db,uid} = await connect();
    const existing = (await get(ref(db, `rooms/${initialCode}/members/${uid}`))).val();
    if (existing) await joinRoom(initialCode, existing.name);
  })().catch(() => {});
}
