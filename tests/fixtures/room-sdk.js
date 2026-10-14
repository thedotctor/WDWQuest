// Test SDK substitute. Uses a local WebSocket store, not a live Firebase project.
let db, counter=0;
function read(path) {let v=db.tree;for(const k of path.split('/').filter(Boolean)) v=v?.[k];return v ?? null;}
function snapshot(path,value=read(path)) {return {key:path.split('/').at(-1),val:()=>value,exists:()=>value!==null};}
function notify() {
  for(const listener of db.listeners) {
    const value=read(listener.path), json=JSON.stringify(value);
    if (json===listener.previous) continue;
    if(listener.kind==='value') listener.fn(snapshot(listener.path,value));
    else {
      const old=listener.previous ? JSON.parse(listener.previous) || {} : {}, next=value || {};
      for(const [k,v] of Object.entries(next)) {
        if(listener.kind==='added' && !(k in old)) listener.fn(snapshot(listener.path+'/'+k,v));
        if(listener.kind==='changed' && k in old && JSON.stringify(old[k])!==JSON.stringify(v)) listener.fn(snapshot(listener.path+'/'+k,v));
      }
    }
    listener.previous=json;
  }
}
function request(kind,node,value,expected) {
  return db.ready.then(()=>new Promise(resolve=>{
    const id=++counter;db.requests.set(id,resolve);db.socket.send(JSON.stringify({id,kind,path:node.path,value,expected}));
  }));
}
function watch(kind,node,fn) {
  if(node.path==='.info/connected') {db.ready.then(()=>fn({val:()=>true}));return ()=>{};}
  const listener={kind,path:node.path,fn,previous:undefined};db.listeners.add(listener);db.ready.then(notify);return ()=>db.listeners.delete(listener);
}
export function initializeApp(config) {return {config};}
export function getAuth() {
  let uid=localStorage.getItem('test-wdw-uid');
  if(!uid) {uid=crypto.randomUUID();localStorage.setItem('test-wdw-uid',uid);}
  return {currentUser:{uid},authStateReady:async()=>{}};
}
export async function signInAnonymously(auth) {return {user:auth.currentUser};}
export function getDatabase() {
  if(db) return db;
  const socket=new WebSocket('ws://127.0.0.1:9011');
  db={socket,tree:{},listeners:new Set(),requests:new Map()};
  db.ready=new Promise(resolve=>socket.addEventListener('open',resolve));
  socket.addEventListener('message',event=>{
    const response=JSON.parse(event.data);
    if('tree' in response) {db.tree=response.tree;notify();}
    else {db.requests.get(response.id)?.(response.value);db.requests.delete(response.id);}
  });
  return db;
}
export const ref=(database,path='')=>({path});
export async function get(node) {return snapshot(node.path,await request('get',node));}
export const set=(node,value)=>request('set',node,value);
export const update=(node,value)=>request('update',node,value);
export const remove=node=>set(node,null);
export const onValue=(node,fn)=>watch('value',node,fn);
export const onChildAdded=(node,fn)=>watch('added',node,fn);
export const onChildChanged=(node,fn)=>watch('changed',node,fn);
export const onDisconnect=node=>({set:value=>request('disconnect',node,value)});
export async function runTransaction(node,fn) {
  for(let i=0;i<20;i++) {
    const old=await request('get',node),next=fn(old);
    if(next===undefined) return {committed:false};
    const result=await request('transaction',node,next,old);if(result.committed) return result;
  }
  throw Error('Test transaction retries exhausted');
}
export const serverTimestamp=()=>({'.sv':'timestamp'});
export function connectAuthEmulator() {}
export function connectDatabaseEmulator() {}
