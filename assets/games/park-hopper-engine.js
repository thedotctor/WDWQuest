(function(root){
  'use strict';
  const W=960,H=540,G=1300,SPEED=265,JUMP=540;
  const themes=[{name:'Main Street Morning',sky:['#62b9eb','#e9f6f9'],grass:'#76bb8b',accent:'#eeab69'}, {name:'Adventure at Sunset',sky:['#776eb7','#ffc4a0'],grass:'#729b80',accent:'#ffd07d'}, {name:'Castle After Dark',sky:['#111b42','#4f659a'],grass:'#506f80',accent:'#a5d7ff'}];
  function level(index){
    const shift=index*45;
    const platforms=[{x:0,y:460,w:890,h:100},{x:1020,y:460,w:1150,h:100},{x:2300,y:460,w:1210,h:100},{x:3640,y:460,w:980,h:100},{x:4750,y:460,w:1250,h:100},
      {x:420,y:355,w:150,h:24},{x:650,y:305,w:140,h:24},{x:1240,y:350,w:175,h:24},{x:1510,y:280,w:160,h:24},{x:1820,y:345,w:145,h:24},{x:2500,y:340,w:170,h:24},{x:2770,y:265,w:180,h:24},{x:3170,y:335,w:160,h:24},{x:3910,y:335,w:190,h:24},{x:4250,y:275,w:175,h:24},{x:4910,y:350,w:170,h:24},{x:5220,y:280,w:180,h:24}];
    const hazards=[650,1330,1870,2660,3270,3960,4440,5120].map((x,i)=>({x:x+shift,y:426,w:42,h:34,type:i%2?'cone':'cart'}));
    const coins=[]; for(let x=250;x<5650;x+=170){if(![890,2170,3510,4620].some(g=>x>g-25&&x<g+155))coins.push({x,y:408,taken:false});}
    platforms.filter(p=>p.y<460).forEach(p=>{for(let j=0;j<3;j++)coins.push({x:p.x+25+j*40,y:p.y-33,taken:false});});
    [955,2235,3575,4685].forEach(x=>coins.push({x,y:330,taken:false}));
    const checkpoints=[{x:2040,y:460,active:false},{x:4540,y:460,active:false}];
    return {width:6000,platforms,hazards,coins,checkpoints,goal:5750,theme:themes[index]};
  }
  class ParkPlatformer{
    constructor(){this.reset();}
    reset(){this.stage=0;this.score=0;this.lives=3;this.elapsed=0;this.mode='ready';this.loadLevel();}
    loadLevel(){this.level=level(this.stage);this.spawn={x:85,y:410};this.player={x:85,y:410,w:30,h:46,vx:0,vy:0,onGround:false,facing:1,invincible:0};this.camera=0;this.jumpBuffer=0;this.coyote=0;this.dropTimer=0;this.events=[];}
    start(){if(this.mode==='ready')this.mode='playing';}
    jump(){if(this.mode==='playing')this.jumpBuffer=.14;}
    drop(){const p=this.player;if(this.mode==='playing'&&p.onGround&&p.y+p.h<459){this.dropTimer=.22;p.onGround=false;p.y+=3;p.vy=70;this.coyote=0;this.jumpBuffer=0;}}
    pause(){if(this.mode==='playing'){this.mode='paused';}else if(this.mode==='paused')this.mode='playing';}
    next(){if(this.mode==='levelComplete'&&this.stage<2){this.stage++;this.loadLevel();this.mode='playing';}}
    hurt(){const p=this.player;if(p.invincible>0||this.mode!=='playing')return;this.lives--;this.events.push('hurt');if(this.lives<=0){this.mode='gameOver';return;}Object.assign(p,{x:this.spawn.x,y:this.spawn.y,vx:0,vy:0,onGround:false,invincible:1.8});this.jumpBuffer=0;this.coyote=0;}
    update(dt,input={}){
      if(this.mode!=='playing')return;
      dt=Math.max(0,Math.min(dt,.05));this.elapsed+=dt;
      const count=Math.max(1,Math.ceil(dt/(1/120)));for(let i=0;i<count&&this.mode==='playing';i++)this.step(dt/count,input);
    }
    step(dt,input){
      const p=this.player,L=this.level;
      p.invincible=Math.max(0,p.invincible-dt);this.dropTimer=Math.max(0,this.dropTimer-dt);this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);this.coyote=p.onGround?.1:Math.max(0,this.coyote-dt);
      p.vx=((input.right?1:0)-(input.left?1:0))*SPEED;if(p.vx)p.facing=Math.sign(p.vx);
      if(this.jumpBuffer>0&&this.coyote>0){p.vy=-JUMP;p.onGround=false;this.coyote=0;this.jumpBuffer=0;this.events.push('jump');}
      const oldBottom=p.y+p.h;p.x=Math.max(0,Math.min(L.width-p.w,p.x+p.vx*dt));p.vy+=G*dt;p.y+=p.vy*dt;p.onGround=false;
      if(p.vy>=0)for(const s of L.platforms){if(this.dropTimer>0&&s.y<460)continue;if(p.x+p.w>s.x&&p.x<s.x+s.w&&oldBottom<=s.y+1&&p.y+p.h>=s.y){p.y=s.y-p.h;p.vy=0;p.onGround=true;break;}}
      for(const c of L.coins){if(!c.taken&&Math.abs(p.x+p.w/2-c.x)<27&&Math.abs(p.y+p.h/2-c.y)<34){c.taken=true;this.score+=10;this.events.push('coin');}}
      for(const f of L.checkpoints){if(!f.active&&p.x+p.w>f.x&&p.x<f.x+42&&p.onGround){f.active=true;this.spawn={x:f.x+50,y:410};this.events.push('checkpoint');}}
      if(p.y>H+60){this.hurt();return;}
      if(p.invincible===0&&L.hazards.some(h=>p.x+p.w>h.x+5&&p.x<h.x+h.w-5&&p.y+p.h>h.y+6&&p.y<h.y+h.h)){this.hurt();return;}
      if(p.x>=L.goal){this.score+=100;this.mode=this.stage===2?'won':'levelComplete';this.events.push('finish');}
      this.camera=Math.max(0,Math.min(L.width-W,p.x-W*.32));
    }
  }
  root.ParkPlatformer=ParkPlatformer;
  if(typeof module!=='undefined')module.exports=ParkPlatformer;
})(typeof window!=='undefined'?window:globalThis);
