'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const H=require('../www/hard'), C=require('../tools/sim/clock_routes');
const {game}=require('../tools/sim/tighten_clocks');
const table=()=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+';HARD_LEVELS');
module.exports=[
  {name:'clocks: explain before level 80 even after the old tip, and repeat after every timeout in both languages',async run(t,{startLevel,modal,click,sleep}){
    for(const lang of ['nl','en']){
      const p=await t.phone({size:[360,640],state:{name:'Dennis',pid:'test-clock-help-'+lang,level:81,sunSeen:true,lang,seenSp:{clock:1,ice:1,lock:1,gold:1,joker2:1}}});
      await startLevel(p,79);t.eq(await modal(p),null,'no clock popup before 80 '+lang);
      await p.evaluate(()=>__mj.startLevel(80));
      t.ok((await modal(p)).buttons.includes('ntGo'),'explanation is present before the first move '+lang);
      t.eq(await p.evaluate(()=>[G.mv,!!S.seenSp.clockMoves]),[0,false],'acknowledgment required '+lang);
      const text=await p.evaluate(()=>['nt_clock_text','clockMoves','clockFree','clockGoal'].map(k=>tx(k).replace(/<[^>]+>/g,'')));
      for(const part of text)t.ok((await modal(p)).text.includes(part),'complete move explanation '+lang);
      await sleep(1400);t.ok((await modal(p)).buttons.includes('ntGo'),'other tile tips do not replace the clock explanation '+lang);
      t.ok(await p.evaluate(()=>$('#modalBox').scrollHeight<=$('#modalBox').clientHeight+1),'intro and acknowledgment fit on a small phone '+lang);
      await click(p,'#ntGo');
      t.ok(await p.evaluate(()=>JSON.parse(localStorage.getItem(STORE)).seenSp.clockMoves),'remember acknowledgment '+lang);
      await startLevel(p,80);t.eq(await modal(p),null,'normal starts do not repeat the acknowledged tip '+lang);
      for(let attempt=0;attempt<2;attempt++){
        await p.evaluate(()=>{const i=G.tiles.findIndex((t,i)=>i!==G.clock.i&&G.alive[i]&&!G.down[i]&&canTake(i));if(i<0)throw Error('No free non-clock tile');G.clock.n=G.mv+1;__mj.onTap(i);});
        await sleep(900);
        const m=await modal(p);t.eq(m.title,await p.evaluate(()=>tx('clockTitle')),'clock timeout explains the loss '+lang);
        for(const part of text)t.ok(m.text.includes(part),'repeat the complete explanation after timeout '+lang);
        t.eq(m.buttons,['sRetry','sMenu'],'retry and menu are available '+lang);
        t.ok(await p.evaluate(()=>$('#modalBox').scrollHeight<=$('#modalBox').clientHeight+1),'explanation, retry and menu fit on a small phone '+lang);
        if(!attempt){await click(p,'#sRetry');await sleep(1400);t.eq(await modal(p),null,'retry starts directly after explanation '+lang);}
      }
      await click(p,'#sMenu');t.eq(await p.evaluate(()=>curScreen),'home','menu works after timeout '+lang);
    }
  }},
  {name:'clocks: peeking and blocked taps are free; a pair removed together costs two moves',async run(t,{startLevel,sleep}){
    const p=await t.phone({state:{name:'Dennis',pid:'test-clock-moves',level:80,sunSeen:true,seenSp:{clock:1,clockMoves:1,ice:1,lock:1,gold:1,joker2:1}}});
    await startLevel(p,80);
    const result=await p.evaluate(()=>{
      const [a,b]=G.tiles.map((t,i)=>i).filter(i=>i!==G.clock.i&&canTake(i));
      if(b===undefined)throw Error('Need two free tiles');
      const blocked=G.tiles.findIndex((t,i)=>G.alive[i]&&!free(i));
      if(blocked<0)throw Error('Need a blocked tile');
      G.tiles[b].face=G.tiles[a].face;G.down[a]=1;G.down[b]=0;G.peek=-1;turn(a,true);turn(b,false);
      const left=clockLeft();__mj.onTap(blocked);__mj.onTap(a);
      const peek=[G.mv,clockLeft(),G.peek===a];__mj.onTap(b);
      return {left,peek,pair:[G.mv,clockLeft(),!!G.alive[a],!!G.alive[b]]};
    });
    t.eq(result.peek,[0,result.left,true],'blocked tap and first flip do not spend a move');
    t.eq(result.pair,[2,result.left-2,false,false],'both removed tiles count, even from one tap');
    await sleep(300);
  }},
  {name:'clocks: harder designs preserve levels through 79 and have complete clock-safe proofs, also after repetition',cpu:true,async run(t){
    const T=table(),old=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../analysis/levels-1.46.js'),'utf8')+';HARD_LEVELS');
    t.eq([T.from,T.aspect,T.levels.length],[old.from,old.aspect,old.levels.length],'same level range and aspect');
    t.eq(T.v,H.GENV,'current design version');t.eq(T.cycleFrom,150,'repeat only the final difficulty plateau');
    for(let lv=T.from;lv<80;lv++)t.eq(T.levels[lv-T.from],old.levels[lv-old.from],'preserved level '+lv);
    for(let lv=80;lv<T.from+T.levels.length;lv++){
      const d=H.unpack(lv,T.levels[lv-T.from]);t.ok(d.clock,'clock exists '+lv);
      t.ok(H.validSolution(game(d),d.solution),'complete route within deadline '+lv);
      // (from 90 the boards were re-ordered in 1.52: each keeps the clock margin it was designed with)
      const spare=d.clock.n-d.solution.indexOf(d.clock.i)-1;
      t.ok(lv<90?H.clockSpare(lv).includes(spare):spare>=1&&spare<=3,'approved clock margin '+lv);
      t.ok(d.clock.n <= (lv<90?22:19),'early clock planning '+lv);
    }
    const context={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/layouts.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../www/hard.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+'\nthis.get=Hard.get;',context);
    const last=T.from+T.levels.length-1,span=last-T.cycleFrom+1;
    for(let lv=last+1;lv<=last+span;lv++){const d=context.get(lv);t.ok(H.validSolution(game(d),d.solution),'mirrored/permuted proof at '+lv);}
  }},
  {name:'clocks: simulator cannot skip a deadline by selecting a pair; final allowed clock tap succeeds',cpu:true,async run(t){
    const L=require('../www/layouts'),tiles=[{x:0,y:0,z:0},{x:2,y:0,z:0}];
    const g={tiles,nb:L.neighbors(tiles),faces:[1,1],clock:{i:1,n:1}},p={...H.persona('strong'),temp:0.01,tray:[0,100,200,300]};
    t.eq(C.validSolution(g,[0,1]),false,'late clock fails');t.eq(C.validSolution(g,[1,0]),true,'final allowed clock tap works');
    t.eq(H.play(g,p,1).why,'clock','pair cannot bypass deadline');t.eq(H.play({...g,clock:{i:1,n:2}},p,1).win,true,'pair within deadline succeeds');
  }},
  {name:'clocks: final allowed tap works in the game',async run(t,{startLevel,sleep}){
    const T=table(),d=H.unpack(80,T.levels[80-T.from]);
    const p=await t.phone({state:{name:'Dennis',pid:'test-clock-hard',level:90,seenSp:{clock:1,ice:1,lock:1,gold:1,joker:1}}});
    await startLevel(p,80);
    t.eq(await p.evaluate(()=>G.clock.n),d.clock.n,'designed counter starts');
    const prefix=d.solution.slice(0,d.solution.indexOf(d.clock.i));
    for(const i of prefix){await p.evaluate(i=>{__mj.onTap(i);if(G.alive[i])__mj.onTap(i);},i);await sleep(500);}
    await p.evaluate(()=>{G.clock.n=G.mv+1;__mj.onTap(G.clock.i);});await sleep(900);
    t.eq(await p.evaluate(()=>[!!G.alive[G.clock.i],clockOn(),!!G.overShown]),[false,false,false],'final allowed clock tap is safe');
    await p.evaluate(path=>{for(const i of path){__mj.onTap(i);if(G.alive[i])__mj.onTap(i);}},d.solution.slice(d.solution.indexOf(d.clock.i)+1));
    await sleep(5000);
    t.ok(await p.evaluate(()=>G.done&&S.stars[80]>0),'the complete designed route also wins in the actual game');
  }},
];
