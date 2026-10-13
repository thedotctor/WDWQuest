(async()=>{
 const pause=()=>new Promise(r=>setTimeout(r,0));
 const preferred=['Magic Kingdom','EPCOT','Hollywood Studios','Animal Kingdom',null];
 window.fullGameReport={turns:0,actions:0,events:{},issues:[],visited:{},finaleAttempts:0,initial:JSON.parse(JSON.stringify(players)),timeline:[]};
 const report=fullGameReport;let lastActor=currentPlayer,lastSignature='',idle=0,planned=null,questionCount=0;
 const count=key=>report.events[key]=(report.events[key]||0)+1;
 const originalPick=pickQuestion;pickQuestion=function(...args){const q=originalPick(...args);window.testQuestion=q;return q;};
 const originalSnack=pickSnackBreak;pickSnackBreak=function(...args){const q=originalSnack(...args);window.testSnack=q;return q;};
 const originalAdvance=advanceTurn;advanceTurn=function(...args){const result=originalAdvance(...args);report.turns++;count('turns-player-'+lastActor);lastActor=currentPlayer;return result;};
 wait=()=>Promise.resolve();
 const click=element=>{if(!element||element.disabled)throw Error('Invalid action '+element?.id);count(element.id||Object.keys(element.dataset).join(','));report.actions++;element.click();};
 const pinNeeded=(id,actor=currentPlayer)=>{const pin=pinInfo(id),p=players[actor];return pin&&pin.park===preferred[actor]&&!p.pins.includes(id);};
 const snapshot=()=>({turn:report.turns,player:currentPlayer,players:players.map(p=>({name:p.name,pos:p.pos,cash:p.cash,eliminated:p.eliminated,badges:p.badges,pins:p.pins,props:p.props.length,security:p.inSecurity,finaleLap:p.finaleLapRemaining||0})),owners:{...owners},status:document.querySelector('#status')?.textContent});
 const check=()=>{
  for(let i=0;i<players.length;i++){
   const p=players[i];if(!Number.isInteger(p.pos)||p.pos<0||p.pos>=80)throw Error('Invalid position for '+i);
   if(!Number.isFinite(p.cash))throw Error('Invalid balance for '+i);
   if(p.cash<0&&!report.issues.some(x=>x.type==='negative-cash'&&x.player===i)){report.issues.push({type:'negative-cash',player:i,turn:report.turns,cash:p.cash,lastCard:lastMagicCard?.id});}
   if(new Set(p.badges).size!==p.badges.length||p.badges.some(b=>!BADGES.includes(b)))throw Error('Invalid badges');
   const owned=Object.keys(owners).map(Number).filter(k=>owners[k]===i).sort((a,b)=>a-b);if(JSON.stringify(owned)!==JSON.stringify(p.props.slice().sort((a,b)=>a-b)))throw Error('Property ledger mismatch '+i);
   if(p.eliminated&&owned.length)throw Error('Eliminated owner '+i);
   if(p.eliminated&&p.pins.length&&!report.issues.some(x=>x.type==='stranded-pins'&&x.player===i)){report.issues.push({type:'stranded-pins',player:i,turn:report.turns,pins:p.pins.slice()});}
  }
 };
 const tradePlan=()=>{
  const actor=currentPlayer,mine=ownedPropertyIndices(actor),goal=preferred[actor];
  for(let partner=0;partner<players.length;partner++){
   if(partner===actor||players[partner].eliminated)continue;
   const theirs=ownedPropertyIndices(partner);
   const take=theirs.find(index=>goal&&SPACES[index].park===goal);
   const give=mine.find(index=>SPACES[index].park!==goal&&SPACES[index].park===preferred[partner])??mine.find(index=>SPACES[index].park!==goal);
   if(take!==undefined&&give!==undefined)return {partner,give,take};
   if(!goal){const give2=mine.find(index=>SPACES[index].park===preferred[partner]),take2=theirs.find(index=>SPACES[index].park!==preferred[partner]);if(give2!==undefined&&take2!==undefined)return {partner,give:give2,take:take2};}
  }return null;
 };
 for(let steps=0;steps<45000&&!gameOver&&report.turns<6000;steps++){
  const active=players.filter(p=>!p.eliminated);if(active.length===1&&preferred[currentPlayer]===null)preferred[currentPlayer]=finaleProgress(currentPlayer).bestPark.park;
  check();const enabled=Array.from(modalRoot.querySelectorAll('button')).filter(b=>!b.disabled);const by=id=>document.getElementById(id);
  let selected=null;
  if(enabled.length){
   if(by('qAnswers')&&!by('qContinue')&&!by('propertyContinue')&&!by('winClose')){
    questionCount++;const options=enabled.filter(b=>b.classList.contains('answer'));const final=document.querySelector('.modal .badge')?.textContent==='FINAL CHALLENGE';
    const wrong=final&&report.finaleAttempts===1 || !final&&questionCount<100&&questionCount%9===0;
    selected=options.find(b=>wrong?b.textContent!==testQuestion.a:b.textContent===testQuestion.a);count(wrong?'wrong-answer':'correct-answer');
   }else if(by('snackAnswers')&&!by('snackContinue')){selected=enabled.find(b=>b.textContent===testSnack.name);count('snack-answer');}
   else if(by('propertyTryBuy'))selected=by('propertyTryBuy');
   else if(by('rentPay'))selected=!by('rentPay').disabled?by('rentPay'):players[currentPlayer].rentPasses>0?by('rentPass'):by('rentBroke');
   else if(by('doublesPinYes')){const p=players[currentPlayer],want=unownedPins().some(pin=>pinNeeded(pin.id));selected=p.cash>230&&want?by('doublesPinYes'):by('doublesPinNo');}
   else if(enabled.some(b=>b.dataset.buyPin)){selected=enabled.find(b=>b.dataset.buyPin&&pinNeeded(b.dataset.buyPin))||by('doublesPinSkip');}
   else if(by('transportRoll'))selected=by('transportRoll');
   else if(by('endTurnTrade')){planned=tradePlan();selected=planned&&!by('endTurnTrade').disabled?by('endTurnTrade'):by('endTurnDone');}
   else if(enabled.some(b=>b.dataset.propertyPartner!==undefined)){selected=planned?enabled.find(b=>Number(b.dataset.propertyPartner)===planned.partner):by('propertyTradeSkip');}
   else if(by('propertyMakeOffer')){
    if(!planned)selected=by('propertyTradeSkip');
    else{const give=by('propertyMakeOffer');if(!give.disabled)selected=give;else{const mine=modalRoot.querySelector('[data-property-give="'+planned.give+'"]');selected=mine?.getAttribute('aria-pressed')==='true'?modalRoot.querySelector('[data-property-take="'+planned.take+'"]'):mine;}}
   }else if(by('propertyAccept'))selected=by('propertyAccept');
   else if(enabled.some(b=>b.dataset.pinPartner!==undefined)){
    const actor=currentPlayer,p=players[actor];const partner=players.findIndex((other,i)=>i!==actor&&!other.eliminated&&other.pins.some(id=>pinNeeded(id))&&p.pins.some(id=>!pinNeeded(id,i)));
    selected=modalRoot.querySelector('[data-pin-partner="'+partner+'"]')||modalRoot.querySelector('[data-pin-partner="-1"]');
   }else if(by('pinOffer')){
    const takes=enabled.filter(b=>b.dataset.pinTake&&pinNeeded(b.dataset.pinTake));
    const gives=enabled.filter(b=>b.dataset.pinGive&&(pinInfo(b.dataset.pinGive).park!==preferred[currentPlayer]||players[currentPlayer].pins.filter(id=>id===b.dataset.pinGive).length>1));
    const chosenGive=modalRoot.querySelector('[data-pin-give][aria-pressed="true"]'),chosenTake=modalRoot.querySelector('[data-pin-take][aria-pressed="true"]');
    if(!chosenGive)selected=gives[0]||by('pinTradeClose');else if(!chosenTake)selected=takes[0]||by('pinTradeClose');else selected=by('pinOffer');
   }else if(by('pinTradeAccept'))selected=by('pinTradeAccept');
   else if(enabled.some(b=>b.dataset.pinAbility!==undefined))selected=enabled[0];
   else{const priority=['winClose','qContinue','propertyContinue','snackContinue','autographContinue','pinRewardContinue','propertyTradeNext','pinTradeClose','propertyEndTurn','magicDrawBtn','magicApplyBtn','endTurnDone','pinChoiceSkip'];selected=priority.map(by).find(e=>e&&!e.disabled)||enabled[0];}
   click(selected);
  }else if(!turnLocked){
   const actor=currentPlayer;report.visited[players[actor].pos]=(report.visited[players[actor].pos]||0)+1;
   if(finaleProgress(actor).ready){report.finaleAttempts++;click(by('castleFinaleBtn'));}
   else click(by('rollBtn'));
  }
  await pause();
  const signature=[currentPlayer,turnLocked,players.map(p=>p.pos+':'+p.cash).join(','),modalRoot.innerHTML,report.actions].join('|');
  if(signature===lastSignature)idle++;else idle=0;lastSignature=signature;
  if(idle>800)throw Error('Game stalled at '+JSON.stringify(snapshot())+' modal '+modalRoot.textContent);
  if(report.turns&&report.turns%50===0&&!report.timeline.some(t=>t.turn===report.turns)){const state=snapshot();report.timeline.push(state);console.log('FULLGAME '+JSON.stringify({turn:state.turn,active:state.players.filter(p=>!p.eliminated).length,cash:state.players.map(p=>p.cash),badges:state.players.map(p=>p.badges.length),props:state.players.map(p=>p.props),pins:state.players.map(p=>p.pins.length)}));}
 }
 check();report.final=snapshot();report.gameOver=gameOver;report.log=Array.from(document.querySelectorAll('#logList>div')).map(d=>d.textContent);return report;
})()
