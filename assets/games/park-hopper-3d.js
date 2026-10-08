const loadThree=()=>import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');
export async function createParkView(canvas){
  const T=await loadThree(),motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');let renderer;
  try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});}catch(e){renderer=softwareRenderer(T,canvas);}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(960,540);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-5.4,5.4,3.0375,-3.0375,.1,100),world=new T.Group();scene.add(world);
  scene.add(new T.HemisphereLight('#f0f5fc','#7c8799',1.65));
  const key=new T.DirectionalLight('#fff5e7',1.9);key.position.set(-3,10,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:.1,far:30});key.shadow.bias=-.0004;key.shadow.normalBias=.02;key.shadow.radius=4;scene.add(key);scene.add(key.target);
  const rim=new T.DirectionalLight('#c3daef',.65);rim.position.set(4,5,-5);scene.add(rim);
  if(!renderer.software){const env=new T.Scene();env.background=new T.Color('#becbde');for(const [x,y,z,rx,ry] of [[0,8,0,Math.PI/2,0],[-6,4,0,0,Math.PI/2],[6,4,-3,0,-Math.PI/2]]){const p=new T.Mesh(new T.PlaneGeometry(8,5),new T.MeshBasicMaterial({color:'#fff7e8',side:T.DoubleSide}));p.position.set(x,y,z);p.rotation.set(rx,ry,0);env.add(p);}const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromScene(env,.08).texture;pm.dispose();}
  const mats=new Map(),geos=new Map();function mat(color,metal=0,rough=.28){const id=color+metal+rough;if(!mats.has(id))mats.set(id,new T.MeshPhysicalMaterial({color,metalness:metal,roughness:rough,clearcoat:.7,clearcoatRoughness:.22}));return mats.get(id);}
  const gold=mat('#d7ac61',.72,.2),cream=mat('#e4e1d8',.12,.23),blue=mat('#799dd4',.28,.2),windowMat=mat('#315a80',.45,.13),stone=mat('#e3e9f5',.12,.22);
  function geom(w,h,d){const id=[w,h,d].join(',');if(geos.has(id))return geos.get(id);let g;if(renderer.software)g=new T.BoxGeometry(w,h,d);else{const r=Math.min(.045,w/6,h/6,d/6),shape=new T.Shape(),x=-w/2,z=-d/2;shape.moveTo(x+r,z);shape.lineTo(x+w-r,z);shape.quadraticCurveTo(x+w,z,x+w,z+r);shape.lineTo(x+w,z+d-r);shape.quadraticCurveTo(x+w,z+d,x+w-r,z+d);shape.lineTo(x+r,z+d);shape.quadraticCurveTo(x,z+d,x,z+d-r);shape.lineTo(x,z+r);shape.quadraticCurveTo(x,z,x+r,z);g=new T.ExtrudeGeometry(shape,{depth:h-2*r,bevelEnabled:true,bevelSegments:2,bevelSize:r*.4,bevelThickness:r,steps:1,curveSegments:4});g.rotateX(-Math.PI/2);g.translate(0,-h/2+r,0);g.computeVertexNormals();}geos.set(id,g);return g;}
  function mesh(p,g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
  function box(p,x,y,z,w,h,d,m){return mesh(p,geom(w,h,d),m,x,y,z);}
  function floor(p,x,y,z,w,h,d,m){const o=box(p,x,y,z,w,h,d,m);o.userData.floorLayer=y+h/2;o.userData.hideTop=h>.1;return o;}
  function cyl(p,x,y,z,r,h,m,top=r){return mesh(p,new T.CylinderGeometry(top,r,h,renderer.software?10:24),m,x,y,z);}
  function ball(p,x,y,z,r,m){return mesh(p,new T.SphereGeometry(r,renderer.software?8:20,renderer.software?5:12),m,x,y,z);}
  function cone(p,x,y,z,r,h,m){return mesh(p,new T.ConeGeometry(r,h,renderer.software?8:20),m,x,y,z);}
  function group(x=0,z=0){const g=new T.Group();g.position.set(x,0,z);world.add(g);return g;}
  function sign(p,title,x,y,z,w=.95,h=.2){box(p,x,y,z,w,h,.055,mat('#223b5d',.2,.3));const c=document.createElement('canvas');c.width=384;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#223b5d';ctx.fillRect(0,0,384,96);ctx.fillStyle='#fff0cb';ctx.font='700 35px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(title,192,48,360);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;mesh(p,new T.PlaneGeometry(w*.95,h*.9),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}),x,y,z+.03);}
  function shadow(p,x,z,rx,rz){const s=mesh(p,new T.CircleGeometry(1,20),new T.MeshBasicMaterial({color:'#162b48',transparent:true,opacity:.14,depthWrite:false}),x,.013,z);s.rotation.x=-Math.PI/2;s.scale.set(rx,rz,1);s.castShadow=false;}
  function tree(p,x,z,s=1){cyl(p,x,.4*s,z,.06*s,.8*s,mat('#8a705a'));ball(p,x,1.07*s,z,.38*s,mat('#69a994'));ball(p,x-.21*s,.85*s,z,.26*s,mat('#7fc0a1'));ball(p,x+.23*s,.88*s,z,.27*s,mat('#74b49b'));shadow(p,x,z,.45*s,.28*s);}
  function castle(p,x,z,scale=1){const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);p.add(g);box(g,0,.55,0,1.2,1.1,.65,stone);box(g,0,1,0,.35,2,.4,stone);for(const [a,h] of [[-.66,1.25],[.66,1.25],[-.34,1.65],[.34,1.65],[0,2.25]]){cyl(g,a,h/2,0,.12,h,stone);cone(g,a,h+.18,0,.19,.4,blue);cyl(g,a,h+.51,0,.012,.26,gold);box(g,a+.075,h+.59,0,.15,.08,.018,gold);}box(g,0,.21,.35,.22,.42,.04,windowMat);for(const a of [-.4,0,.4])box(g,a,.69,.35,.085,.19,.04,windowMat);shadow(g,0,0,.85,.65);}
  function storefront(p,x,z,color,title){const g=new T.Group();g.position.set(x,0,z);p.add(g);box(g,0,.8,0,1.4,1.6,.85,mat(color,.12,.3));box(g,0,1.66,0,1.55,.11,1,cream);box(g,0,1.82,0,1.25,.22,.6,mat('#9c8391'));box(g,0,1.08,.55,1.53,.1,.56,cream);for(let i=0;i<6;i++)box(g,-.62+i*.25,1.09,.55,.13,.105,.57,mat('#ca848b',.1,.27));sign(g,title,0,1.39,.45,1.23,.23);for(const x of [-.43,0,.43]){box(g,x,.5,.46,.27,.68,.04,windowMat);box(g,x,.54,.49,.025,.59,.02,cream);}shadow(g,0,.1,.8,.65);}
  function character(p,x,z,type='mickey'){
    const g=new T.Group();g.position.set(x,0,z);p.add(g);const black=mat('#313642',.05,.4),skin=mat('#e9d6ba',.04,.4),white=mat('#edf0e9',.04,.4),orange=mat('#e4b466',.05,.38);const goofy=type==='goofy',donald=type==='donald',top=goofy?.93:.74;
    for(const a of [-.075,.075]){box(g,a,.18,0,.065,.23,.085,goofy?mat('#697c9d'):donald?white:black);box(g,a,.055,.03,.115,.085,.18,donald?orange:goofy?mat('#776959'):mat('#e2bf6b'));}
    box(g,0,.4,0,.23,.23,.16,goofy?mat('#667e9a'):donald?mat('#698fbd'):mat('#c5787c'));
    box(g,0,goofy?.65:.56,0,.245,goofy?.36:.21,.17,goofy?mat('#d2a365'):donald?mat('#698fbd'):black);
    ball(g,0,top,0,.14,donald?white:goofy?skin:black);
    if(donald){box(g,0,top-.03,.135,.17,.06,.14,orange);cyl(g,0,top+.145,0,.115,.034,mat('#668bb7'));}
    else if(goofy){box(g,0,top+.16,0,.16,.13,.15,mat('#9cb881'));ball(g,0,top,.14,.046,black);for(const a of [-.135,.135])box(g,a,top-.03,-.02,.045,.21,.05,black);}
    else{ball(g,0,top-.02,.092,.104,skin);for(const a of [-.125,.125])ball(g,a,top+.115,0,.082,black);ball(g,0,top,.18,.033,black);}
    for(const a of [-.04,.04])ball(g,a,top+.02,donald?.126:goofy?.127:.176,.012,black);
    const arm=new T.Group();arm.position.set(.155,goofy?.74:.62,0);g.add(arm);box(arm,0,.09,0,.055,.18,.065,donald?white:goofy?mat('#d2a365'):black);ball(arm,0,.205,0,.05,white);arm.rotation.z=-.45;
    box(g,-.16,goofy?.61:.51,0,.055,.17,.065,donald?white:goofy?mat('#d2a365'):black);ball(g,-.16,goofy?.5:.405,0,.046,white);shadow(g,0,0,.24,.15);
    sceneryMotions.push({root:p,type:'wave',part:arm,phase:x*1.7});return g;
  }
  function foodCart(p,type){
    const color={popcorn:'#cb8990',dole:'#b9bf87',pretzel:'#c7a780',icecream:'#8faec1'}[type];floor(p,0,-.035,0,1.5,.07,1.1,mat('#c8d5d7',.05,.4));box(p,0,.39,0,.84,.59,.54,mat(color,.1,.34));box(p,0,.71,0,.95,.07,.66,cream);
    for(const x of [-.34,.34]){const wheel=cyl(p,x,.12,.28,.1,.03,windowMat);wheel.rotation.x=Math.PI/2;cyl(p,x,.97,0,.02,.48,gold);}
    box(p,0,1.22,0,1.05,.085,.77,mat(color,.1,.32));for(let i=0;i<5;i++)box(p,-.42+i*.21,1.225,0,.1,.09,.78,cream);
    const names={popcorn:'POPCORN',dole:'DOLE WHIP',pretzel:'PRETZELS',icecream:'ICE CREAM'};sign(p,names[type],0,.44,.29,.68,.19);
    if(type==='popcorn'){box(p,0,.92,0,.43,.4,.34,mat('#d1b173',.15,.3));box(p,0,.96,.18,.34,.23,.02,mat('#a1c9d2',.12,.25));for(let i=0;i<10;i++)ball(p,-.15+(i%4)*.1,1.15+Math.floor(i/4)*.055,0,.048,mat('#eee1b6'));}
    if(type==='dole'||type==='icecream'){cyl(p,0,.85,0,.12,.21,mat(type==='dole'?'#e0c075':'#be9b78'),.16);for(let i=0;i<4;i++)ball(p,Math.sin(i)*.025,1.01+i*.055,0,.115-i*.02,mat(type==='dole'?'#ede0a7':'#ecd3d1'));}
    if(type==='pretzel'){for(const x of [-.19,.19]){const m=mesh(p,new T.TorusGeometry(.11,.03,6,16),mat('#bf8e5f',.08,.35),x,.94,.04);m.rotation.z=.3;const n=mesh(p,new T.TorusGeometry(.085,.025,6,14),mat('#d2a56e',.08,.35),x,1.08,.04);n.rotation.z=-.4;}}
    character(p,1.02,.05,type==='icecream'?'donald':'mickey');
  }
  function carousel(p){
    floor(p,0,-.035,0,2.4,.07,2.1,mat('#d7cedb',.08,.35));cyl(p,0,.075,0,.93,.15,mat('#b69bbd',.18,.28));cyl(p,0,.72,0,.055,1.4,gold);cone(p,0,1.47,0,1.02,.42,mat('#cf9e9a',.1,.3));cyl(p,0,1.29,0,1,.12,cream);ball(p,0,1.71,0,.07,gold);
    const spin=new T.Group();p.add(spin);const horses=[];for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.cos(a)*.62,z=Math.sin(a)*.62;cyl(spin,x,.7,z,.019,1.08,gold);const horse=new T.Group();horse.position.set(x,.49,z);horse.rotation.y=-a;p.add(horse);spin.add(horse);box(horse,0,0,0,.28,.12,.12,stone);box(horse,.13,.065,0,.07,.15,.08,stone);ball(horse,.16,.13,0,.055,stone);box(horse,0,.075,0,.12,.04,.15,mat(i%2?'#92b8c5':'#cc9b9e'));for(const j of [-.09,.09])for(const k of [-.045,.045])box(horse,j,-.085,k,.035,.11,.025,stone);horses.push(horse);}
    sign(p,'CAROUSEL',0,.19,.98,1.05,.18);sceneryMotions.push({root:p,type:'carousel',part:spin,horses});
  }
  function teacups(p){
    floor(p,0,-.035,0,2.4,.07,2,mat('#d3d1e1',.1,.32));cyl(p,0,.08,0,1,.16,mat('#aeb5d0',.15,.3));const spin=new T.Group();p.add(spin);for(let i=0;i<4;i++){const a=i*Math.PI/2,cup=new T.Group();cup.position.set(Math.cos(a)*.57,.17,Math.sin(a)*.57);spin.add(cup);const color=['#d9a7b7','#a0c3c9','#e1c58e','#b9abd2'][i];cyl(cup,0,.13,0,.15,.24,mat(color,.1,.3),.25);const rim=mesh(cup,new T.TorusGeometry(.245,.023,6,18),cream,0,.255,0);rim.rotation.x=Math.PI/2;const handle=mesh(cup,new T.TorusGeometry(.105,.025,6,14),mat(color),.265,.16,0);handle.rotation.y=Math.PI/2;}
    sign(p,'TEA PARTY',0,.16,1.01,1,.19);sceneryMotions.push({root:p,type:'spin',part:spin,speed:.52});
  }
  function wheelRide(p){
    floor(p,0,-.035,0,2.7,.07,1.6,mat('#c5d1dd',.08,.36));for(const x of [-.46,.46]){const leg=box(p,x,.68,.02,.1,1.45,.16,cream);leg.rotation.z=x>0?.24:-.24;}const wheel=new T.Group();wheel.position.set(0,1.32,-.13);p.add(wheel);mesh(wheel,new T.TorusGeometry(1.03,.04,6,36),gold,0,0,0);const cabins=[];for(let i=0;i<8;i++){const a=i*Math.PI/4;const spoke=box(wheel,Math.cos(a)*.51,Math.sin(a)*.51,0,1.02,.025,.03,cream);spoke.rotation.z=a;const c=new T.Group();c.position.set(Math.cos(a)*1.03,Math.sin(a)*1.03,.05);wheel.add(c);box(c,0,-.11,0,.27,.18,.24,mat(['#c697a6','#93b7c8','#c9b479','#a79bc6'][i%4],.12,.3));for(const x of [-.11,.11])box(c,x,.02,0,.025,.16,.025,gold);box(c,0,.11,0,.3,.04,.27,cream);cabins.push(c);}
    sign(p,'SKY WHEEL',0,.16,.8,1,.18);sceneryMotions.push({root:p,type:'wheel',part:wheel,cabins});
  }
  function coaster(p){
    floor(p,0,-.035,0,3.1,.07,1.9,mat('#c8d6d2',.08,.38));const points=[[-1.25,.5,.25],[-.72,1.57,-.12],[0,1.01,-.3],[.8,.78,-.16],[1.25,.98,.17],[.68,.41,.57],[-.1,.31,.5],[-.9,.37,.46]].map(v=>new T.Vector3(...v));const track=new T.CatmullRomCurve3(points,true);mesh(p,new T.TubeGeometry(track,48,.035,5,true),mat('#b09ca7',.28,.25),0,0,0);const rail=mesh(p,new T.TubeGeometry(track,48,.028,5,true),gold,0,0,.12);for(let i=0;i<7;i++){const q=track.getPointAt(i/7);cyl(p,q.x,q.y/2,q.z,.028,q.y,mat('#829a9d',.2,.3));}const cars=[];for(let i=0;i<3;i++){const c=new T.Group();p.add(c);box(c,0,.085,0,.28,.13,.19,mat(['#c8868a','#8daec2','#d0b078'][i],.16,.26));ball(c,.015,.21,0,.048,mat('#e4cdb0'));cars.push(c);}sign(p,'MOUNTAIN EXPRESS',0,.16,.94,1.55,.18);sceneryMotions.push({root:p,type:'coaster',track,cars});
  }
  function flyingRide(p){
    floor(p,0,-.035,0,2.4,.07,2,mat('#cad2e0',.08,.36));cyl(p,0,.3,0,.16,.6,cream);cone(p,0,.77,0,.22,.32,blue);const spin=new T.Group();p.add(spin);const flyers=[];for(let i=0;i<4;i++){const a=i*Math.PI/2,f=new T.Group();f.position.set(Math.cos(a)*.78,.57,Math.sin(a)*.78);f.rotation.y=-a;spin.add(f);const arm=box(spin,Math.cos(a)*.39,.45,Math.sin(a)*.39,.78,.025,.025,gold);arm.rotation.y=-a;ball(f,0,0,0,.15,mat('#9fb6c7'));ball(f,.13,.065,0,.09,mat('#acc4d3'));for(const z of [-.12,.12]){const ear=ball(f,.045,.065,z,.1,mat('#bdadc8'));ear.scale.set(.6,1,1);}const trunk=cyl(f,.21,-.02,0,.025,.16,mat('#acc4d3'));trunk.rotation.z=.35;box(f,-.02,.135,0,.16,.06,.18,mat(i%2?'#c699a7':'#a2c7bd'));flyers.push(f);}sign(p,'FLYING ELEPHANTS',0,.14,1.03,1.4,.18);sceneryMotions.push({root:p,type:'fly',part:spin,flyers});
  }
  function boatRide(p){
    floor(p,0,-.035,0,2.7,.07,1.65,cream);floor(p,0,.015,0,2.45,.03,1.39,mat('#8dc9d5',.1,.35));const boat=new T.Group();p.add(boat);box(boat,0,.16,0,.62,.17,.27,mat('#c0afcf',.14,.3));box(boat,0,.255,0,.4,.08,.31,cream);for(const x of [-.14,.14]){ball(boat,x,.38,0,.055,mat('#e4cdb0'));box(boat,x,.3,0,.09,.11,.09,mat('#8eacba'));}sign(p,'STORYBOOK BOATS',0,.15,.87,1.45,.18);sceneryMotions.push({root:p,type:'boat',part:boat});
  }
  let currentLevel=null,coins=[],flags=[],scenery=[],sceneryMotions=[],decks=[],sparks=[],dangerObjects=[],pawn=null,limbs=[],lastDraw=-1,lightCenter=0;
  function disposeLevel(){world.traverse(o=>{if(o.isMesh){if(![...geos.values()].includes(o.geometry))o.geometry.dispose();const m=o.material;if(m.map){m.map.dispose();m.dispose();}else if(![...mats.values()].includes(m))m.dispose();}});world.clear();coins=[];flags=[];scenery=[];sceneryMotions=[];decks=[];sparks=[];dangerObjects=[];}
  function build(game){disposeLevel();currentLevel=game.level;const L=game.level;
    for(const p of L.platforms){const x=(p.x+p.w/2)/100,y=(460-p.y)/100,w=p.w/100,g=group();floor(g,x,y-.22,0,w,.36,1.85,mat(p.y===460?'#b6bac2':'#c2b28e',.18,.26));floor(g,x,y-.035,0,w+.025,.07,1.95,cream);box(g,x,y-.24,.94,w,.05,.04,gold);if(p.y<460){for(const a of [-w/2+.13,w/2-.13])box(g,x+a,y/2-.25,-.65,.11,y-.15,.18,mat('#87919e',.25,.3));}else for(let j=0;j<Math.floor(w/1.2);j++){floor(g,p.x/100+.7+j*1.2,y+.008,0,.75,.012,1.3,mat('#d8d6ce',.05,.35));}decks.push({g,x,w});}
    for(const c of L.coins){const g=group(c.x/100,0);const m=cyl(g,0,0,0,.105,.037,gold);m.rotation.x=Math.PI/2;const inset=cyl(g,0,0,.023,.073,.007,mat('#ffe49d',.4,.2));inset.rotation.x=Math.PI/2;coins.push({g,c});}
    for(const h of L.hazards){const g=group((h.x+h.w/2)/100,0);
      if(h.type==='flame'){
        box(g,0,.025,0,.42,.05,.34,mat('#354459',.2,.4));
        for(const x of [-.12,0,.12])box(g,x,.058,0,.052,.018,.27,mat('#bbaa69',.2,.34));
        const flames=new T.Group();g.add(flames);
        for(const [x,z,scale] of [[-.105,.03,.78],[0,0,1],[.105,-.02,.68]]){const red=cone(flames,x,.265*scale+.07,z,.086*scale,.46*scale,mat('#e87550',.04,.45));red.rotation.z=-x*1.2;cone(flames,x,.2*scale+.065,z+.02,.051*scale,.31*scale,mat('#ffd38a',.05,.38));}
        dangerObjects.push({g,h,anim:flames,type:'flame'});
      }else if(h.type==='spikedBall'){
        const rolling=new T.Group();rolling.position.y=.22;g.add(rolling);ball(rolling,0,0,0,.14,mat('#667182',.48,.35));
        const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],[.7,.7,0],[-.7,.7,0],[.7,-.7,0],[-.7,-.7,0]];
        for(const dir of directions){const v=new T.Vector3(...dir).normalize();const spike=cone(rolling,v.x*.173,v.y*.173,v.z*.173,.038,.105,mat('#c7ced6',.5,.3));spike.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v);}
        dangerObjects.push({g,h,anim:rolling,type:'spikedBall'});
      }else if(h.type==='thorns'){
        box(g,0,.028,0,.4,.056,.32,mat('#665b65',.05,.6));
        ball(g,0,.14,0,.12,mat('#456f66',.08,.44));
        for(let i=0;i<7;i++){const angle=i*Math.PI*2/7;const spike=cone(g,Math.cos(angle)*.095,.22,Math.sin(angle)*.07,.045,.2,mat(i%2?'#aeb78b':'#ca95ac',.05,.4));spike.rotation.z=-Math.cos(angle)*.62;spike.rotation.x=Math.sin(angle)*.62;}
        cone(g,0,.29,0,.045,.15,mat('#d8b8cb',.08,.3));
      }else{
        box(g,0,.03,0,.42,.06,.34,mat('#d6b34f',.1,.38));
        box(g,0,.19,0,.37,.28,.27,mat('#3b485b',.25,.38));
        box(g,0,.2,.147,.28,.2,.02,mat('#d4b352',.08,.4));
        sign(g,'⚡',0,.2,.16,.19,.14);
        for(const x of [-.1,.1])cyl(g,x,.345,0,.025,.04,mat('#97adbd',.3,.3));
        const wire=new T.CatmullRomCurve3([new T.Vector3(-.1,.35,0),new T.Vector3(-.08,.405,0),new T.Vector3(.025,.37,0)]);mesh(g,new T.TubeGeometry(wire,5,.009,4,false),mat('#697e95'),0,0,0);
        for(let j=0;j<4;j++){const bolt=box(g,0,.39,0,.025,.1,.018,mat('#b4edff',.15,.3));bolt.rotation.z=(j%2?1:-1)*.55;sparks.push({mesh:bolt,x:(j-1.5)*.053,y:.395+(j%2)*.025,phase:h.x+j});}
        for(const x of [-.13,0,.13]){const stripe=box(g,x,.038,.175,.055,.025,.016,mat('#25354b'));stripe.rotation.z=-.45;}
      }shadow(g,0,0,.24,.18);
    }
    for(const f of L.checkpoints){const g=group(f.x/100,-.33);cyl(g,0,.48,0,.02,.96,gold);const flag=box(g,.16,.85,0,.29,.19,.018,mat('#b4becd'));sign(g,'SAVE',0,1.13,0,.55,.16);flags.push({g,f,flag});}
    const scenes=['popcorn','carousel','characters','teacups','dole','coaster','pretzel','wheel','characters','icecream','fly','boat'];
    for(let i=0;i<14;i++){const x=i*4.1+.8,g=group(x,-2.6),kind=scenes[(i+game.stage*3)%scenes.length];
      if(['popcorn','dole','pretzel','icecream'].includes(kind))foodCart(g,kind);
      else if(kind==='carousel')carousel(g);else if(kind==='teacups')teacups(g);else if(kind==='coaster')coaster(g);else if(kind==='wheel')wheelRide(g);else if(kind==='fly')flyingRide(g);else if(kind==='boat')boatRide(g);
      else{floor(g,0,-.035,0,2.1,.07,1.3,mat('#d5cfda',.06,.4));character(g,-.58,0,'mickey');character(g,0,0,'donald');character(g,.58,0,'goofy');sign(g,'CHARACTER FRIENDS',0,.13,.68,1.6,.18);}
      tree(g,-1.57,-.8,.74);scenery.push(g);
    }
    for(const x of [8,24,40]){const g=group(x,-5);castle(g,0,0,1.15);scenery.push(g);}
    const finish=group(L.goal/100+1.1,-.5);castle(finish,0,0,1.25);sign(finish,'CASTLE →',-1.45,1.03,.8,.9,.22);scenery.push(finish);
    pawn=group();const body=box(pawn,0,.25,0,.235,.22,.17,mat('#e0a280',.1,.28));ball(pawn,0,.42,0,.095,mat('#f3d2b1'));cyl(pawn,0,.5,0,.115,.035,mat('#354e78',.2,.2));cyl(pawn,0,.535,0,.073,.045,mat('#4b6a91',.2,.22));box(pawn,-.025,.28,-.105,.18,.19,.08,mat('#7a90b4'));for(const x of [-.064,.064]){const g=new T.Group();g.position.set(x,.16,0);pawn.add(g);box(g,0,-.055,0,.055,.12,.065,mat('#3f567a'));box(g,0,-.115,.02,.072,.035,.1,windowMat);limbs.push(g);}for(const x of [-.145,.145]){const g=new T.Group();g.position.set(x,.32,0);pawn.add(g);box(g,0,-.07,0,.05,.13,.055,mat('#e0a280'));ball(g,0,-.145,0,.03,mat('#f3d2b1'));limbs.push(g);}const eye=ball(pawn,.046,.43,.076,.012,windowMat);shadow(world,0,0,.2,.12);
  }
  const backgrounds=['radial-gradient(ellipse at 75% 12%,#fff1d0 0,transparent 25%),linear-gradient(#7ab6d8,#dbe7ed)','radial-gradient(ellipse at 80% 15%,#ffd89c 0,transparent 26%),linear-gradient(#777aac,#ebc4b9)','radial-gradient(ellipse at 80% 15%,#8199bf 0,transparent 20%),linear-gradient(#142345,#687eaa)'];
  return {draw(game,time){if(document.hidden)return;if(currentLevel!==game.level){limbs=[];build(game);canvas.style.background=backgrounds[game.stage];}if(renderer.software&&time-lastDraw<1/18)return;lastDraw=time;
    for(const danger of dangerObjects){danger.g.position.x=(danger.h.x+danger.h.w/2)/100;danger.g.visible=danger.g.position.x>game.camera/100-2&&danger.g.position.x<game.camera/100+12;if(danger.type==='flame'){danger.anim.scale.y=.92+Math.sin(game.elapsed*13+danger.h.phase)*.08;danger.anim.rotation.y=Math.sin(game.elapsed*7+danger.h.phase)*.13;}else danger.anim.rotation.z=-(danger.h.x-danger.h.baseX)/14;}
    for(const spark of sparks){spark.mesh.position.x=spark.x+Math.sin(time*15+spark.phase)*.012;spark.mesh.position.y=spark.y+Math.sin(time*12+spark.phase)*.02;spark.mesh.visible=Math.sin(time*18+spark.phase)>-.5;}
    const motionTime=motionPreference.matches?0:game.elapsed;
    for(const m of sceneryMotions){if(!m.root.visible)continue;const t=motionTime;
      if(m.type==='wave')m.part.rotation.z=-.4+Math.sin(t*3+m.phase)*.34;
      if(m.type==='spin')m.part.rotation.y=t*m.speed;
      if(m.type==='carousel'){m.part.rotation.y=t*.38;m.horses.forEach((h,i)=>h.position.y=.49+Math.sin(t*2.1+i)*.065);}
      if(m.type==='wheel'){m.part.rotation.z=t*.17;m.cabins.forEach(c=>c.rotation.z=-m.part.rotation.z);}
      if(m.type==='coaster')m.cars.forEach((c,i)=>{const u=(t*.13+i*.045)%1,q=m.track.getPointAt(u),v=m.track.getTangentAt(u);c.position.copy(q);c.rotation.y=-Math.atan2(v.z,v.x);c.rotation.z=Math.atan2(v.y,Math.hypot(v.x,v.z));});
      if(m.type==='fly'){m.part.rotation.y=t*.4;m.flyers.forEach((f,i)=>f.position.y=.57+Math.sin(t*1.8+i)*.09);}
      if(m.type==='boat'){m.part.position.x=Math.sin(t*.55)*.74;m.part.position.y=Math.sin(t*2)*.017;m.part.rotation.y=Math.cos(t*.55)*.12;}
    }
    const center=game.camera/100+4.8;camera.position.set(center+1.25,5.1,12);camera.lookAt(center,1.4,0);camera.updateProjectionMatrix();key.position.set(center-3,10,7);key.target.position.set(center,0,0);for(const g of scenery)g.visible=g.position.x>center-9&&g.position.x<center+11;for(const d of decks)d.g.visible=d.x+d.w/2>center-7&&d.x-d.w/2<center+7;
    for(const {g,c} of coins){g.visible=!c.taken&&c.x/100>center-7&&c.x/100<center+7;g.position.y=(460-c.y)/100+.025+Math.sin(time*3+c.x)*.025;g.rotation.y=time*2;}
    for(const {flag,f} of flags)flag.material=f.active?gold:mat('#b4becd');const p=game.player;pawn.position.set((p.x+p.w/2)/100,(460-p.y-p.h)/100,0);pawn.rotation.y=p.facing>0?Math.PI/3:-Math.PI/3;pawn.visible=!p.invincible||Math.floor(time*12)%2===0;const moving=p.onGround&&Math.abs(p.vx)>0;for(let i=0;i<limbs.length;i++)limbs[i].rotation.x=moving?Math.sin(time*14+(i%2)*Math.PI)*.48:!p.onGround?(i<2?.25:-.5):0;
    renderer.render(scene,camera);
  },software:renderer.software};
}
function softwareRenderer(THREE,canvas){
const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');let width=1,height=1,pixelRatio=1;
const light=new THREE.Vector3(-.5,.85,.5).normalize(),normalMatrix=new THREE.Matrix3(),n=new THREE.Vector3(),camDir=new THREE.Vector3(),position=new THREE.Vector3();
const objectTriangles=new WeakMap();
function affineDraw(image,uv,p,texture){const iw=image.width||image.naturalWidth,ih=image.height||image.naturalHeight;if(!iw||!ih)return;const q=uv.map(v=>[(v[0]*texture.repeat.x+texture.offset.x)*iw,(1-v[1]*texture.repeat.y-texture.offset.y)*ih]);const den=q[0][0]*(q[1][1]-q[2][1])+q[1][0]*(q[2][1]-q[0][1])+q[2][0]*(q[0][1]-q[1][1]);if(Math.abs(den)<.0001)return;
const solve=axis=>[(p[0][axis]*(q[1][1]-q[2][1])+p[1][axis]*(q[2][1]-q[0][1])+p[2][axis]*(q[0][1]-q[1][1]))/den,(p[0][axis]*(q[2][0]-q[1][0])+p[1][axis]*(q[0][0]-q[2][0])+p[2][axis]*(q[1][0]-q[0][0]))/den,(p[0][axis]*(q[1][0]*q[2][1]-q[2][0]*q[1][1])+p[1][axis]*(q[2][0]*q[0][1]-q[0][0]*q[2][1])+p[2][axis]*(q[0][0]*q[1][1]-q[1][0]*q[0][1]))/den];const x=solve(0),y=solve(1);ctx.save();ctx.clip();ctx.transform(x[0],y[0],x[1],y[1],x[2],y[2]);ctx.drawImage(image,0,0);ctx.restore();}
function triangles(mesh){let a=objectTriangles.get(mesh.geometry);if(a)return a;const g=mesh.geometry,pos=g.attributes.position,idx=g.index,norm=g.attributes.normal,uv=g.attributes.uv;a=[];
for(let j=0;j<(idx?idx.count:pos.count);j+=3){const ids=[0,1,2].map(k=>idx?idx.getX(j+k):j+k);a.push({points:ids.map(i=>new THREE.Vector3().fromBufferAttribute(pos,i)),normals:norm?ids.map(i=>new THREE.Vector3().fromBufferAttribute(norm,i)):null,uv:uv?ids.map(i=>[uv.getX(i),uv.getY(i)]):null});}objectTriangles.set(mesh.geometry,a);return a;}
function render(scene,camera){ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);ctx.clearRect(0,0,width,height);const glow=ctx.createRadialGradient(width/2,height*.67,0,width/2,height*.67,width*.45);glow.addColorStop(0,'#00000024');glow.addColorStop(1,'#00000000');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);const faces=[];
scene.traverseVisible(obj=>{if(!obj.isMesh)return;const mat=Array.isArray(obj.material)?obj.material[0]:obj.material;if(!mat||mat.isShadowMaterial)return;normalMatrix.getNormalMatrix(obj.matrixWorld);
for(const tri of triangles(obj)){const world=tri.points.map(v=>v.clone().applyMatrix4(obj.matrixWorld));position.copy(world[0]).add(world[1]).add(world[2]).multiplyScalar(1/3);camera.getWorldDirection(camDir).negate();n.copy(tri.normals?tri.normals[0]:new THREE.Vector3().subVectors(world[1],world[0]).cross(new THREE.Vector3().subVectors(world[2],world[0])));if(tri.normals)n.add(tri.normals[1]).add(tri.normals[2]).multiplyScalar(1/3).applyMatrix3(normalMatrix);n.normalize();if(obj.userData.hideTop&&n.y>.9)continue;if(n.dot(camDir)<0&&mat.side!==THREE.DoubleSide)continue;
const points=world.map(v=>{const p=v.clone().project(camera);return [(p.x+1)*width/2,(1-p.y)*height/2,p.z]});if(points.some(p=>p[2]>1||p[2]<-1))continue;const depth=points.reduce((s,p)=>s+p[2],0)/3;const params=obj.geometry.parameters||{},ground=obj.userData.floorLayer!==undefined&&obj.userData.floorLayer<.05;const layer=ground?obj.userData.floorLayer:-1;const c=mat.color||new THREE.Color('#e9edf6');const diffuse=.78+Math.max(0,n.dot(light))*.24;const half=light.clone().add(camDir).normalize();const rough=mat.roughness===undefined?.5:mat.roughness;const shine=Math.pow(Math.max(0,n.dot(half)),12+(1-rough)*22)*(.025+.065*(mat.metalness||0));const rgb=[c.r,c.g,c.b].map(a=>Math.min(255,Math.round(Math.pow(a,1/2.2)*255*diffuse+shine*255)));faces.push({points,depth,ground,layer,color:'rgb('+rgb.join(',')+')',map:mat.map,uv:tri.uv,opacity:mat.opacity===undefined?1:mat.opacity});}
});faces.sort((a,b)=>a.ground!==b.ground?(a.ground?-1:1):a.ground&&a.layer!==b.layer?a.layer-b.layer:b.depth-a.depth);for(const f of faces){ctx.beginPath();f.points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.globalAlpha=f.opacity;if(f.map&&f.uv&&f.map.image){affineDraw(f.map.image,f.uv,f.points,f.map)}else{ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=.25;ctx.stroke();}}ctx.globalAlpha=1;
}
return {software:true,shadowMap:{},setPixelRatio:v=>pixelRatio=v,setSize:(w,h)=>{width=w;height=h;canvas.width=Math.round(w*pixelRatio);canvas.height=Math.round(h*pixelRatio)},render,dispose(){}};
}
