'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const E=require('../tools/builder/engine.js'),L=require('../www/layouts.js'),Hard=require('../www/hard.js');
const fixture=()=>({tiles:[[0,0,0],[6,0,0],[12,0,0],[18,0,0],[24,0,0],[30,0,0],[32,0,0],[38,0,0]],faces:[0,0,1,1,2,3,3,2],down:[],gold:[],obst:{ice:{5:1},locks:[4],keys:[2,3],after:{1:0}},clock:{i:7,n:9},solution:[0,1,2,3,6,5,4,7],info:{rate:0,strong:0}});
module.exports=[
{name:'ribbon: reference taps, incremental search, peek pairs and strict replay agree',cpu:true,async run(t){
  const d=fixture(),g=E.game(d),all=E.start(g).alive;
  const refLegal=s=>[...all.keys()].filter(i=>s.alive[i]&&L.isFree(i,s.alive,g.nb)&&!(i===1&&s.alive[0])&&!(i===4&&(s.alive[2]||s.alive[3]))&&!(i===5&&s.alive[6]));
  const memo=new Map();function reference(s){const k=[...s.alive].join('')+'/'+s.tray.map(i=>d.faces[i]).sort().join(',');if(memo.has(k))return memo.get(k);if(!s.alive.some(Boolean))return s.tray.length===0;
    assert.deepEqual(E.legal(g,s),refLegal(s));let win=false;
    for(const i of refLegal(s)){const tray=s.tray.slice(),q=tray.findIndex(j=>d.faces[j]===d.faces[i]);if(q>=0)tray.splice(q,1);else tray.push(i);if(tray.length>=4)continue;const alive=s.alive.slice();alive[i]=0;const next={alive,tray,moves:s.moves+1,clockTaken:s.clockTaken||i===7};win=reference(next)||win;}
    memo.set(k,win);assert.equal(E.winnable(g,s,{nodes:10000,ms:1000}).result,win?'win':'lose');return win;}
  t.ok(reference(E.start(g)),'reference finds a win');t.ok(memo.size>20,'compared many reachable states');
  t.ok(E.replay(d,d.solution,{strict:true}).ok,'strict solution');t.ok(Hard.validSolution(E.game(d,{strict:true}),d.solution),'game replay shares the rule');
  const peek={...d,down:[1]},pg=E.game(peek);t.ok(!E.legal(pg,E.start(pg)).some(a=>a.pair?.includes(1)),'blocked target cannot join a peek pair');assert.throws(()=>E.step(pg,E.start(pg),{pair:[0,1]}));
  t.ok(!E.replay(d,[1,0,2,3,6,5,4,7]).ok,'target first is refused');
  const clocked={...d,clock:{i:1,n:3}},cs=E.clockShortest(E.game(clocked),{nodes:10000,ms:1000});t.eq(cs.k,2,'minimum includes the ribbon source');t.eq(E.clockShortest(E.game(clocked,{strict:true}),{nodes:10000,ms:1000}).k,2,'strict search has the same minimum');
  t.eq(E.winnable(E.game({...clocked,clock:{i:1,n:1}}),E.start(E.game(clocked)),{nodes:10000,ms:1000}).result,'lose','earlier clock deadline is impossible');
  const cached=E.game(d);d.obst.after={1:2};const changed=E.game(d);t.ok(changed!==cached,'editing the link invalidates cached physics');let state=E.step(changed,E.start(changed),0);t.ok(!E.legal(changed,state).includes(1),'new source remains required');d.obst.after={1:0};
  for(const after of [{1:1},{1:99},{1:'0'},{1:0,0:1},[]])assert.throws(()=>E.game({...d,obst:{...d.obst,after}}));
}},
{name:'ribbon: packed extension round trips and every old level keeps its encoding',cpu:true,async run(t){
  const d=fixture(),packed=Hard.pack(d),back=Hard.unpack(300,packed);t.eq(back.obst.after,{1:0},'ribbon field survives');t.eq(Hard.pack(back),packed,'new packed round trip');
  const legacy=structuredClone(d);delete legacy.obst.after;t.eq(Hard.pack(legacy).length,11,'legacy format stays eleven fields');t.ok(!Hard.unpack(300,Hard.pack(legacy)).obst.after,'old decoder result has no new field');
  const table=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/levels-hard.js'),'utf8')+';HARD_LEVELS');let checked=0;
  function scan(v){if(!v||typeof v!=='object')return;if(Array.isArray(v)&&typeof v[0]==='string'&&typeof v[1]==='string'&&[10,11].includes(v.length)){const plain=JSON.parse(JSON.stringify(v)),normalized=plain.length===10?plain.concat(''):plain;t.eq(Hard.pack(Hard.unpack(1,plain)),normalized,'legacy packed board '+checked);checked++;}else for(const x of Object.values(v))scan(x);}
  scan(table.levels);t.ok(checked>100,'checked the actual existing table',checked);
  assert.throws(()=>Hard.unpack(300,[...Hard.pack(legacy),'r1:AAAA']));assert.throws(()=>Hard.unpack(300,[...Hard.pack(legacy),'unknown']));
}},
{name:'ribbon: real taps, obstacle refresh, saved state and Grandma isolation',async run(t,{sleep}){
  const p=await t.phone({state:{name:'Ribbon test',level:80,seenSp:{gold:1,joker2:1,ice:1,lock:1,clockMoves:1,trayPair:1}}});
  await p.evaluate(d=>{begin({mode:'lab',prototype:'ribbon-v1',key:'RIBBON-TEST',level:300,title:'Ribbon test',track:'',fixedAspect:1.6,makeSpec:()=>({tiles:d.tiles.map(([x,y,z])=>({x,y,z})),kinds:4,seed:14,diff:Layouts.difficultyFor(201),made:d})},true);},fixture());
  await sleep(400);
  t.ok(await p.evaluate(()=>!canTake(1)&&canTake(0)),'only source can be tapped');
  await p.evaluate(()=>onTap(1));t.eq(await p.evaluate(()=>[G.alive[1],G.mv]),[1,0],'blocked tap changes no moves');
  await p.evaluate(()=>onTap(0));await sleep(450);t.ok(await p.evaluate(()=>canTake(1)&&!!G.tiles[1].el.querySelector('.ribbon-open')),'source opens target and badge');
  t.ok(await p.evaluate(()=>!canTake(4)&&!canTake(5)),'keys and ice still block their tiles');
  t.eq(await p.evaluate(()=>{const save=obState();setObstacles(save);return obState().after;}),{1:0},'save and resume retain the link');
  await p.evaluate(()=>{G.o.track='care';setObstacles({...G.ob,after:{1:0},ice:{}});G.alive[0]=1;renderBoard(false);});t.eq(await p.locator('#board .ribbon-badge').count(),0,'care mode draws no ribbon');t.ok(await p.evaluate(()=>!ribbonBlocked(1)),'care mode ignores ribbon');
  t.eq(await p.evaluate(()=>Object.keys(G.ob.after)),[],'no new rules in Grandma track');
  await p.evaluate(()=>{G.o.track='';G.o.prototype=undefined;setObstacles({after:{1:0}});});t.ok(await p.evaluate(()=>!G.ob),'ordinary game ignores proposal fields');
}},
{name:'ribbon: two full prototype boards render, teach and win in the real game',async run(t,lib){
  const server=await lib.serve(lib.ROOT);try{
    const p=await t.phone({url:server.url+'tools/builder/ribbon-prototype.html',size:[390,844],state:{name:'Ribbon review',level:80,theme:'classic',seenSp:{gold:1,joker2:1,ice:1,lock:1,clockMoves:1,trayPair:1}}});
    await p.waitForFunction(()=>window.__ribbonPrototype?.examples.length===2);
    const dir=process.env.CAPTURE_RIBBON_DIR;if(dir)fs.mkdirSync(dir,{recursive:true});
    for(let i=0;i<2;i++){
      await p.selectOption('#ribbonControls select',String(i));await lib.sleep(800);
      t.eq(await p.locator('#board .ribbon-badge').count(),2,'both ribbon markers rendered');
      const check=await p.evaluate(()=>{const r=__ribbonPrototype.examples[+document.querySelector('#ribbonControls select').value],target=r.card.ribbon.target;onTap(target);return {alive:G.alive[target],moves:G.mv,rule:G.ob.after};});t.eq(check.moves,0,'target first is refused in full board');t.eq(check.alive,1,'target stays on board');
      if(dir)await p.screenshot({path:path.join(dir,'ribbon-example-'+(i+1)+'.png')});
      const before=await p.evaluate(()=>JSON.stringify([G.mv,G.alive,G.tray,obState()]));await p.click('#ribbonLesson');
      t.eq(await p.locator('.lesson-demo').getAttribute('data-lesson'),'ribbon','animated lesson is wired');await lib.sleep(2600);t.ok(await p.evaluate(()=>+document.querySelector('.lesson-demo').dataset.step>0),'lesson advances');
      if(dir&&i===0)await p.screenshot({path:path.join(dir,'ribbon-lesson.png')});
      await p.click('#ribbonGotIt');t.eq(await p.evaluate(()=>JSON.stringify([G.mv,G.alive,G.tray,obState()])),before,'lesson leaves game unchanged');
      const result=await p.evaluate(async()=>{const d=__ribbonPrototype.examples[+document.querySelector('#ribbonControls select').value].design;for(const i of d.solution){if(!canTake(i))return {error:'illegal '+i};onTap(i);if(G.alive[i]&&G.peek===i)onTap(i);await new Promise(r=>setTimeout(r,20));}return {left:aliveCount(),tray:G.tray.length,done:G.done,moves:G.mv};});t.eq(result.left,0,'all tiles taken');t.eq(result.tray,0,'tray empty');t.ok(result.done,'prototype wins');await lib.sleep(800);
    }
  }finally{await server.close();}
}},
];
