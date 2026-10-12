'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const H=require('../www/hard'), C=require('../tools/sim/clock_routes');
const {game}=require('../tools/sim/tighten_clocks');
const table=()=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+';HARD_LEVELS');
module.exports=[
  {name:'clocks: harder designs preserve levels through 79 and have complete clock-safe proofs, also after repetition',cpu:true,async run(t){
    const T=table(),old=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../analysis/levels-1.46.js'),'utf8')+';HARD_LEVELS');
    t.eq([T.from,T.aspect,T.levels.length],[old.from,old.aspect,old.levels.length],'same level range and aspect');
    t.eq(T.v,H.GENV,'current design version');t.eq(T.cycleFrom,150,'repeat only the final difficulty plateau');
    for(let lv=T.from;lv<80;lv++)t.eq(T.levels[lv-T.from],old.levels[lv-old.from],'preserved level '+lv);
    for(let lv=80;lv<T.from+T.levels.length;lv++){
      const d=H.unpack(lv,T.levels[lv-T.from]);t.ok(d.clock,'clock exists '+lv);
      t.ok(H.validSolution(game(d),d.solution),'complete route within deadline '+lv);
      t.ok(H.clockSpare(lv).includes(d.clock.n-d.solution.indexOf(d.clock.i)-1),'approved clock margin '+lv);
      t.ok(d.clock.n <= (lv<90?22:lv<110?19:16),'early clock planning '+lv);
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
