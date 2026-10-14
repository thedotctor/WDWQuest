// Requires the OFFICIAL database emulator. No production project is used.
const {test, before, after, beforeEach} = require('node:test');
const fs = require('node:fs');
const {initializeTestEnvironment, assertSucceeds, assertFails} = require('/tmp/wdw-firebase/node_modules/@firebase/rules-unit-testing');
const {ref,set,get,update,remove} = require('/tmp/wdw-firebase/node_modules/firebase/database');
let env;
const path='rooms/ABC234';
const meta=()=>({hostUid:'host',phase:'lobby',createdAt:Date.now(),expiresAt:Date.now()+86400000});
const member=()=>({name:'Avery',token:'castle',startingPin:'mk-castle',joinedAt:Date.now()});
const db=uid=>uid ? env.authenticatedContext(uid).database() : env.unauthenticatedContext().database();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-wdwquest',database:{host:'127.0.0.1',port:9000,rules:fs.readFileSync(__dirname+'/database.rules.json','utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearDatabase();await set(ref(db('host'),path+'/meta'),meta());});
test('no public room listing or unauthenticated reads',async()=>{
  await assertFails(get(ref(db(),'rooms')));await assertFails(get(ref(db('outsider'),'rooms')));
  await assertFails(get(ref(db(),path+'/meta')));await assertSucceeds(get(ref(db('guest'),path+'/meta')));
});
test('only host can write state, catalog and host identity',async()=>{
  await assertSucceeds(set(ref(db('host'),path+'/state'),{revision:1,actorUid:'guest',phase:'playing'}));
  await assertFails(set(ref(db('guest'),path+'/state'),{cash:9999}));
  await assertFails(set(ref(db('guest'),path+'/catalog'),{tokens:[]}));
  await assertFails(update(ref(db('host'),path+'/meta'),{hostUid:'guest'}));
  await assertFails(get(ref(db('outsider'),path+'/state')));
});
test('enrollment is self-owned and freezes when play starts',async()=>{
  await assertSucceeds(set(ref(db('guest'),path+'/members/guest'),member()));
  await assertFails(set(ref(db('guest'),path+'/members/other'),member()));
  await assertFails(update(ref(db('guest'),path+'/members/guest'),{cash:9999}));
  await update(ref(db('host'),path+'/meta'),{phase:'playing'});
  await assertFails(update(ref(db('guest'),path+'/members/guest'),{token:'rocket'}));
  await assertFails(set(ref(db('late'),path+'/members/late'),member()));
  await assertSucceeds(remove(ref(db('host'),path+'/members/guest')));
});
test('only current prompt actor with exact revision can issue bounded commands',async()=>{
  await set(ref(db('guest'),path+'/members/guest'),member());
  await set(ref(db('other'),path+'/members/other'),{...member(),name:'Blake'});
  await update(ref(db('host'),path+'/meta'),{phase:'playing'});
  await set(ref(db('host'),path+'/state'),{actorUid:'guest',revision:10});
  const command={id:'test',action:'c1',revision:10,sentAt:Date.now()};
  await assertSucceeds(set(ref(db('guest'),path+'/commands/guest'),command));
  await assertFails(set(ref(db('other'),path+'/commands/other'),command));
  await assertFails(set(ref(db('guest'),path+'/commands/other'),command));
  await assertFails(set(ref(db('guest'),path+'/commands/guest'),{...command,revision:9}));
  await assertFails(set(ref(db('guest'),path+'/commands/guest'),{...command,value:'x'.repeat(100)}));
  await assertSucceeds(remove(ref(db('host'),path+'/commands/guest')));
});
test('presence cannot impersonate host and expired rooms reject game access',async()=>{
  await set(ref(db('guest'),path+'/members/guest'),member());
  await assertSucceeds(set(ref(db('guest'),path+'/presence/guest'),{online:true,at:Date.now()}));
  await assertFails(set(ref(db('guest'),path+'/presence/host'),{online:true,at:Date.now()}));
  await env.withSecurityRulesDisabled(async context=>{await update(ref(context.database(),path+'/meta'),{expiresAt:Date.now()-1000});});
  await assertFails(get(ref(db('guest'),path+'/state')));
  await assertFails(get(ref(db('guest'),path+'/presence')));
  await assertFails(set(ref(db('guest'),path+'/commands/guest'),{id:'expired',action:'c1',revision:10,sentAt:Date.now()}));
  await assertSucceeds(remove(ref(db('host'),path)));
});
