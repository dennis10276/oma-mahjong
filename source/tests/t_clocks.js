'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const H=require('../www/hard'), C=require('../tools/sim/clock_routes');
const {game}=require('../tools/sim/tighten_clocks');
const table=()=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+';HARD_LEVELS');
const report=require('../analysis/clock-changes.json');
module.exports=[
  {name:'clocks: only countdowns from 80 change; every clock has a complete legal solution, including repeated levels',cpu:true,async run(t){
    const T=table(),old=require('./fixtures/clock-baseline.json');
    t.eq([T.v,T.from,T.cycleFrom,T.aspect],[old.v,old.from,old.cycleFrom,old.aspect],'same table and repeat pool');
    t.eq(T.levels.length,old.rows.length,'same level count');
    T.levels.forEach((r,k)=>{r=JSON.parse(JSON.stringify(r));if(r[7]&&T.from+k>=80)r[7]=[r[7][0],0];
      t.eq(crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex'),old.rows[k],'all non-countdown fields unchanged at '+(T.from+k));});
    for(const r of report.rows){
      const d=H.unpack(r.lv,T.levels[r.lv-T.from]);
      t.eq(d.clock,{i:r.i,n:r.budget},'table matches verified clock '+r.lv);
      t.ok(r.budget<=r.old,'deadline never increases '+r.lv);
      t.ok(C.clockSpare(r.lv).includes(r.spare),'spare moves in approved range '+r.lv);
      t.ok(r.focusedRate>=r.focusedFloor,'independent deliberate-play check passes '+r.lv);
      t.ok(C.validSolution(game(d),r.solution),'whole board finishes within deadline '+r.lv);
    }
    const context={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/layouts.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../www/hard.js'),'utf8')+'\n'+fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+'\nthis.get=Hard.get;',context);
    const last=T.from+T.levels.length-1,span=last-T.cycleFrom+1;
    for(let lv=last+1;lv<=last+span;lv++){
      const base=T.cycleFrom+(lv-T.cycleFrom)%span,r=report.rows.find(x=>x.lv===base);
      if(r)t.ok(C.validSolution(game(context.get(lv)),r.solution),'mirrored/permuted proof at '+lv);
    }
    t.eq([H.cfg().start,H.cfg().end,H.cfg().endLevel,H.cfg().strongStart,H.cfg().strongEnd],[0.55,0.35,150,0.75,0.55],'1.45 curve remains active');
  }},
  {name:'clocks: simulator cannot skip a deadline by selecting a pair; final allowed clock tap succeeds',cpu:true,async run(t){
    const L=require('../www/layouts'),tiles=[{x:0,y:0,z:0},{x:2,y:0,z:0}];
    const g={tiles,nb:L.neighbors(tiles),faces:[1,1],clock:{i:1,n:1}},p={...H.persona('strong'),temp:0.01,tray:[0,100,200,300]};
    t.eq(C.validSolution(g,[0,1]),false,'late clock fails');t.eq(C.validSolution(g,[1,0]),true,'final allowed clock tap works');
    t.eq(H.play(g,p,1).why,'clock','pair cannot bypass deadline');t.eq(H.play({...g,clock:{i:1,n:2}},p,1).win,true,'pair within deadline succeeds');
  }},
  {name:'clocks: old saved countdown survives resume, next attempt gets new countdown, final allowed tap works in game',async run(t,{startLevel,sleep}){
    const r=report.rows.find(x=>x.lv===80),p=await t.phone({state:{name:'Dennis',pid:'test-clock-only',level:90,seenSp:{clock:1,ice:1,lock:1,gold:1,joker:1}}});
    await startLevel(p,80);
    t.eq(await p.evaluate(()=>G.clock.n),r.budget,'new counter starts');
    await p.evaluate(old=>{G.clock.n=old;G.mv=2;G.score=123;saveCur();__mj.startLevel(80);},r.old);
    t.eq(await p.evaluate(()=>[G.clock.n,G.mv,G.score]),[r.old,2,123],'in-progress game resumes without sudden deadline change');
    await p.evaluate(()=>restart());await sleep(900);
    t.eq(await p.evaluate(()=>[G.clock.n,G.mv]),[r.budget,0],'retry uses the shorter counter');
    for(const i of r.solution.slice(0,r.routeMoves-1)){await p.evaluate(i=>__mj.onTap(i),i);await sleep(500);}
    await p.evaluate(()=>{G.clock.n=G.mv+1;__mj.onTap(G.clock.i);});await sleep(900);
    t.eq(await p.evaluate(()=>[!!G.alive[G.clock.i],clockOn(),!!G.overShown]),[false,false,false],'clock removed on final allowed move is safe');
  }},
];
