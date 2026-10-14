import {
  initializeApp, getAuth, signInAnonymously, getDatabase, ref, get, set,
  update, remove, onValue, onChildAdded, onChildChanged, onDisconnect,
  runTransaction, serverTimestamp, connectAuthEmulator, connectDatabaseEmulator
} from '../vendor/firebase-room-sdk.js';

export const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
export const ROOM_LIFETIME = 24 * 60 * 60 * 1000;
let connection;
export function configured() {
  const c = window.WDW_FIREBASE_CONFIG;
  return !!(c && c.apiKey && c.projectId && c.databaseURL && c.appId);
}
export function message(error) {
  const code = String(error?.code || error?.message || error || '');
  if (/operation-not-allowed/.test(code)) return 'Anonymous sign-in needs to be enabled in Firebase.';
  if (/permission.denied|permission_denied/i.test(code)) return 'This room is unavailable or the choice has changed. Check the host screen and try again.';
  if (/network|fetch|offline/i.test(code)) return 'Could not connect. Check your internet connection and try again.';
  return 'Could not connect to the room. Check the room code and Firebase setup.';
}
export async function connect() {
  if (!configured()) throw new Error('Firebase is not connected yet. Local play is available.');
  if (!connection) connection = (async () => {
    const app = initializeApp(window.WDW_FIREBASE_CONFIG);
    const auth = getAuth(app), db = getDatabase(app);
    // Emulator routing is restricted to loopback pages; production cannot enable it.
    if (['localhost', '127.0.0.1'].includes(location.hostname) && window.WDW_FIREBASE_EMULATORS) {
      const e = window.WDW_FIREBASE_EMULATORS;
      connectAuthEmulator(auth, `http://127.0.0.1:${e.auth}`, {disableWarnings: true});
      connectDatabaseEmulator(db, '127.0.0.1', e.database);
    }
    await auth.authStateReady();
    const user = auth.currentUser || (await signInAnonymously(auth)).user;
    return {auth, db, uid: user.uid};
  })().catch(error => { connection = null; throw error; });
  return connection;
}
export function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), n => alphabet[n % 32]).join('');
}
export function joinURL(code) {
  const url = new URL('../../board-controller.html', import.meta.url);
  url.searchParams.set('v', '179');
  url.searchParams.set('room', code);
  return url.href;
}
export async function presence(db, code, uid) {
  const node = ref(db, `rooms/${code}/presence/${uid}`);
  await onDisconnect(node).set({online: false, at: serverTimestamp()});
  await set(node, {online: true, at: serverTimestamp()});
}
export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
// Shared sanitization: a host prompt can carry text/controls, never executable HTML.
const tags = new Set(['DIV','SECTION','SPAN','H2','H3','H4','P','STRONG','SMALL','EM','BR','BUTTON','LABEL','INPUT','IMG','UL','LI','A']);
const attrs = new Set(['class','type','disabled','aria-pressed','aria-label','for','min','max','step','value','alt','data-room-action','data-room-field','data-room-snack-mask']);
export function safePrompt(node) {
  const clone = document.createElement('div');
  clone.append(node.cloneNode(true));
  for (const child of [...clone.querySelectorAll('*')]) {
    if (!tags.has(child.tagName)) {
      if (['SCRIPT','STYLE','IFRAME','OBJECT','SVG','LINK'].includes(child.tagName)) child.remove();
      else child.replaceWith(...child.childNodes);
      continue;
    }
    for (const attr of [...child.attributes]) {
      if (child.tagName === 'IMG' && attr.name === 'src' || child.tagName === 'A' && attr.name === 'href') {
        try {
          const url = new URL(attr.value, location.href);
          const hosts = child.tagName === 'A' ? ['commons.wikimedia.org','creativecommons.org'] : ['upload.wikimedia.org','commons.wikimedia.org'];
          if (url.origin === location.origin || (url.protocol === 'https:' && hosts.includes(url.hostname))) continue;
        } catch (_) {}
      }
      if (!attrs.has(attr.name)) child.removeAttribute(attr.name);
    }
    if (child.tagName === 'INPUT' && child.type !== 'number') child.remove();
    if (child.tagName === 'A') {child.rel = 'noopener noreferrer'; child.target = '_blank';}
  }
  return clone;
}
export {ref, get, set, update, remove, onValue, onChildAdded, onChildChanged, runTransaction, serverTimestamp};
