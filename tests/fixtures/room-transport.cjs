// Local shared-data transport for browser integration tests. This is NOT the
// Firebase rules engine. Real-rule tests live in firebase/rules.test.cjs.
const WebSocketServer = require('/tmp/wdw-firebase/node_modules/ws').Server;
const port = Number(process.env.TEST_ROOM_PORT || 9011);
const server = new WebSocketServer({host:'127.0.0.1',port});
let tree = {};
const clients = new Set();
const copy = x => JSON.parse(JSON.stringify(x));
const parts = path => path.split('/').filter(Boolean);
function read(path) {let value=tree; for (const key of parts(path)) value=value?.[key]; return value ?? null;}
function timestamps(value) {
  if (value && typeof value==='object' && value['.sv']==='timestamp') return Date.now();
  if (Array.isArray(value)) return value.map(timestamps);
  if (value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,timestamps(v)]));
  return value;
}
function write(path, value) {
  const keys=parts(path); value=timestamps(value);
  if (!keys.length) {tree=value || {}; return;}
  let node=tree;
  for (const key of keys.slice(0,-1)) node=node[key] || (node[key]={});
  if (value===null) delete node[keys.at(-1)]; else node[keys.at(-1)]=value;
}
function broadcast() {for (const client of clients) if (client.readyState===1) client.send(JSON.stringify({tree}));}
server.on('connection', socket=>{
  clients.add(socket);socket.disconnects=[];socket.send(JSON.stringify({tree}));
  socket.on('message', raw=>{
    const request=JSON.parse(raw.toString()); let value;
    if (request.kind==='get') value=read(request.path);
    if (request.kind==='set') write(request.path,request.value);
    if (request.kind==='update') for (const [key,v] of Object.entries(request.value)) write(request.path+'/'+key,v);
    if (request.kind==='disconnect') socket.disconnects.push(request);
    if (request.kind==='transaction') {
      const current=read(request.path), committed=JSON.stringify(current)===JSON.stringify(request.expected);
      if (committed) write(request.path,request.value);
      value={committed,value:read(request.path)};
    }
    socket.send(JSON.stringify({id:request.id,value:value ?? null}));
    if (['set','update','transaction'].includes(request.kind)) broadcast();
  });
  socket.on('close',()=>{clients.delete(socket);for (const request of socket.disconnects) write(request.path,request.value);broadcast();});
});
console.log('Local room transport ready on '+port);
