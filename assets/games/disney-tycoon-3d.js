const loadThree=()=>import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');
export async function createTycoonView(canvas,map,root){
  const T=await loadThree(),motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');let renderer;
  try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});}catch(e){renderer=softwareRenderer(T,canvas);}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(800,680);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-6.8,6.8,5.78,-5.78,.1,100),world=new T.Group();scene.add(world);
  scene.add(new T.HemisphereLight('#f0f5fc','#7c8799',1.65));
  const key=new T.DirectionalLight('#fff5e7',1.9);key.position.set(-3,10,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:30});key.shadow.bias=-.0004;key.shadow.normalBias=.02;key.shadow.radius=4;scene.add(key);scene.add(key.target);
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
  function sign(p,title,x,y,z,w=.95,h=.2){box(p,x,y,z,w,h,.055,mat('#223b5d',.2,.3));const c=document.createElement('canvas');c.width=384;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#223b5d';ctx.fillRect(0,0,384,96);ctx.fillStyle='#fff0cb';ctx.font='700 35px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(title,192,48,360);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return mesh(p,new T.PlaneGeometry(w*.95,h*.9),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}),x,y,z+.03);}
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

  let sceneryMotions=[],angle=.38,zoom=1,lastDraw=0,elapsed=0;
  const tileGroups=[],visitorModels=[],ray=new T.Raycaster(),pointer=new T.Vector2();
  floor(world,0,-.25,0,9.4,.5,9.4,mat('#253e57',.3,.28));
  floor(world,0,.001,0,9.35,.002,9.35,mat('#7fae96',.02,.65));
  for(const x of [-4.67,4.67])box(world,x,-.06,0,.06,.12,9.4,gold);
  for(const z of [-4.67,4.67])box(world,0,-.06,z,9.4,.12,.06,gold);
  const gate=group(0,4.78);for(const x of [-.5,.5]){box(gate,x,.3,0,.09,.6,.09,cream);ball(gate,x,.65,0,.06,gold);}sign(gate,'PARK ENTRANCE',0,.63,0,1.1,.17);
  const highlight=box(world,0,.035,0,.99,.018,.99,mat('#f2d58a',.12,.4));highlight.visible=false;
  function dispose(g){g.traverse(o=>{if(o.isMesh){if(![...geos.values()].includes(o.geometry))o.geometry.dispose();if(o.material.map){o.material.map.dispose();o.material.dispose();}}});world.remove(g);}
  function rebuild(){
    sceneryMotions=[];for(const g of tileGroups)dispose(g);tileGroups.length=0;
    const buttons=[...map.querySelectorAll('[data-lot]')];
    for(const b of buttons){const i=+b.dataset.lot,x=i%9-4,z=Math.floor(i/9)-4,g=group(x,z);g.userData.lot=i;tileGroups.push(g);
      const kind=b.querySelector('.qt-art')?.classList[1]||(b.querySelector('.qt-castle')?'castle':'');
      floor(g,0,.012,0,.965,.024,.965,mat(b.classList.contains('path')?'#dcd6c5':i%2?'#92bba3':'#9ec3ab',.04,.45));
      if(b.classList.contains('path')){for(const a of [-.25,.25])for(const c of [-.25,.25])floor(g,a,.027,c,.44,.006,.44,cream);}
      else if(kind){const m=new T.Group();g.add(m);m.position.y=.028;
        if(kind==='castle'){m.scale.setScalar(.42);castle(m,0,0,1);}
        else if(kind==='tree'||kind==='treehouse'){m.scale.setScalar(.55);tree(m,0,0,1);if(kind==='treehouse')box(m,0,.7,0,.6,.35,.45,cream);}
        else if(kind==='coaster'||kind==='mountain'){m.scale.setScalar(.29);coaster(m);if(kind==='mountain')cone(m,0,.52,-.3,.65,1.05,mat('#8a9fa5'));}
        else if(kind==='boat'){m.scale.setScalar(.34);boatRide(m);}
        else if(kind==='wheel'){m.scale.setScalar(.34);wheelRide(m);}
        else if(kind==='spinner'){m.scale.setScalar(.37);const label=b.getAttribute('aria-label');if(label.includes('Tea'))teacups(m);else if(/Dumbo|Astro|Carpets/.test(label))flyingRide(m);else carousel(m);}
        else if(kind==='food'||kind==='cart'){m.scale.setScalar(.4);const label=b.getAttribute('aria-label');foodCart(m,/Aloha|Sunshine/.test(label)?'dole':/Pretzel/.test(label)?'pretzel':/Ice Cream|Treats/.test(label)?'icecream':'popcorn');}
        else if(kind==='meet'){m.scale.setScalar(.58);floor(m,0,-.02,0,1.5,.04,1.2,mat('#d4bfd1'));character(m,0,0,'mickey');sign(m,'MEET & GREET',0,.15,.57,1.35,.2);}
        else if(kind==='vehicle'){m.scale.setScalar(.65);box(m,0,.2,0,.8,.25,.45,mat('#cb9195',.1,.3));box(m,0,.45,0,.6,.25,.4,cream);for(const a of [-.3,.3])for(const c of [-.26,.26])ball(m,a,.1,c,.1,windowMat);}
        else{m.scale.setScalar(.45);storefront(m,0,0,['#afc2d4','#c9b2c8','#c5bea2'][i%3],'ATTRACTION');}
        const title=b.getAttribute('aria-label').replace(/^Lot \d+: /,'').replace(/, level \d+$/,'');
        m.traverse(o=>{if(o.isMesh&&o.material.map?.image){const c=o.material.map.image,ctx=c.getContext('2d');ctx.fillStyle='#223b5d';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#fff0cb';ctx.font='700 29px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(title,c.width/2,c.height/2,c.width-18);o.material.map.needsUpdate=true;}});
      }
      if(b.classList.contains('selected')){highlight.visible=true;highlight.position.set(x,.032,z);}
    }
    if(!map.querySelector('.selected'))highlight.visible=false;
  }
  new MutationObserver(rebuild).observe(map,{childList:true});rebuild();
  function cameraUpdate(){const w=canvas.clientWidth||800,h=canvas.clientHeight||680,aspect=w/h,span=6.65/zoom;camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.position.set(Math.sin(angle)*14,13,Math.cos(angle)*14);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.setSize(w,h);}
  new ResizeObserver(cameraUpdate).observe(canvas);cameraUpdate();
  canvas.addEventListener('click',e=>{const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(tileGroups,true);if(!hits.length)return;let g=hits[0].object;while(g&&g.userData.lot===undefined)g=g.parent;if(g)map.querySelector('[data-lot="'+g.userData.lot+'"]').click();});
  const controls=document.createElement('div');controls.className='qt-view-controls';controls.innerHTML='<button data-view="left" aria-label="Rotate park left">↶</button><button data-view="right" aria-label="Rotate park right">↷</button><button data-view="in" aria-label="Zoom in">＋</button><button data-view="out" aria-label="Zoom out">−</button><button data-view="reset">Reset view</button><button data-view="flat" aria-pressed="false">Flat view</button>';canvas.parentNode.append(controls);
  controls.addEventListener('click',e=>{const action=e.target.dataset.view;if(!action)return;if(action==='left')angle-=.25;if(action==='right')angle+=.25;if(action==='in')zoom=Math.min(2,zoom+.15);if(action==='out')zoom=Math.max(.75,zoom-.15);if(action==='reset'){zoom=1;angle=.38;}if(action==='flat'){const flat=root.classList.toggle('qt-flat');e.target.textContent=flat?'3D view':'Flat view';e.target.setAttribute('aria-pressed',String(flat));}cameraUpdate();});
  function guest(){const g=group();ball(g,0,.21,0,.052,mat('#efd2b4'));box(g,0,.13,0,.09,.11,.075,mat(['#d69a98','#80a9c0','#c1b181'][visitorModels.length%3]));const legs=[];for(const x of [-.025,.025]){const leg=box(g,x,.045,0,.027,.08,.04,windowMat);legs.push(leg);}return {g,legs};}
  function frame(now){requestAnimationFrame(frame);if(document.hidden||root.classList.contains('qt-flat')){lastDraw=now;return;}if(now-lastDraw<(renderer.software?1000/15:1000/30))return;const dt=Math.min(.1,(now-lastDraw)/1000);lastDraw=now;if(root.dataset.paused!=='true')elapsed+=dt;const t=motionPreference.matches?0:elapsed;
    for(const m of sceneryMotions){if(m.type==='wave')m.part.rotation.z=-.4+Math.sin(t*3+m.phase)*.34;if(m.type==='spin')m.part.rotation.y=t*m.speed;if(m.type==='carousel'){m.part.rotation.y=t*.38;m.horses.forEach((h,i)=>h.position.y=.49+Math.sin(t*2.1+i)*.065);}if(m.type==='wheel'){m.part.rotation.z=t*.17;m.cabins.forEach(c=>c.rotation.z=-m.part.rotation.z);}if(m.type==='coaster')m.cars.forEach((c,i)=>{const u=(t*.13+i*.045)%1,q=m.track.getPointAt(u),v=m.track.getTangentAt(u);c.position.copy(q);c.rotation.y=-Math.atan2(v.z,v.x);c.rotation.z=Math.atan2(v.y,Math.hypot(v.x,v.z));});if(m.type==='fly'){m.part.rotation.y=t*.4;m.flyers.forEach((f,i)=>f.position.y=.57+Math.sin(t*1.8+i)*.09);}if(m.type==='boat'){m.part.position.x=Math.sin(t*.55)*.74;m.part.position.y=Math.sin(t*2)*.017;}}
    const walkers=[...map.querySelectorAll('.qt-person')];while(visitorModels.length<walkers.length)visitorModels.push(guest());visitorModels.forEach((v,i)=>{v.g.visible=i<walkers.length;if(!v.g.visible)return;const p=walkers[i],x=parseFloat(p.style.left)/100*9-4.5,z=parseFloat(p.style.top)/100*9-4.5;if(Number.isFinite(x)&&Number.isFinite(z)){const dx=x-v.g.position.x,dz=z-v.g.position.z;if(Math.hypot(dx,dz)>.001)v.g.rotation.y=Math.atan2(dx,dz);v.g.position.set(x,.038,z);}v.legs.forEach((leg,j)=>leg.rotation.x=p.classList.contains('qt-walking')?Math.sin(t*10+j*Math.PI)*.5:0);});renderer.render(scene,camera);
  }requestAnimationFrame(frame);root.classList.add('qt-3d');return {software:renderer.software};
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

