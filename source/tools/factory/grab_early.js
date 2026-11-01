// "Don't grab the clock" boards: can you win when you take the clock first? (1) perfect-information solve after
//   HUMAN_BOT=<g2.1 human_bot.js> node source/tools/factory/grab_early.js   (Claude, 2026-11-01; Dennis: "I feel like I could pass the levels with grabbing the clock early")
// taking the clock as move 1; (2) the human bot with the clock forced as move 1 (clock.n = 1) vs the board as built
const fs=require('fs');const L=require('/home/claude/repo-oma/source/www/layouts.js');global.Layouts=L;
const {measureHuman}=require(process.env.HUMAN_BOT);
const rows=fs.readFileSync('/home/claude/repo-oma/source/analysis/factory/batch-175-200-candidate.jsonl','utf8').trim().split('\n').map(JSON.parse).filter(r=>r.recipe.includes('dontGrab'));
for(const r of rows){const d=r.design,tiles=d.tiles.map(([x,y,z])=>({x,y,z})),nb=L.neighbors(tiles),n=tiles.length,o=d.obst||{};
 const rules={iceNb:L.iceNeighbors(tiles),ice:o.ice||{},locks:new Set(o.locks||[]),keys:o.keys||[]};
 const al=new Uint8Array(n).fill(1),ci=d.clock.i,free=L.takeable(ci,al,nb,rules,al);
 const a2=al.slice();a2[ci]=0;const ice={};for(const k in rules.ice){const gone=rules.iceNb[k].filter(i=>!a2[i]).length;if(rules.ice[k]>gone)ice[k]=rules.ice[k]-gone;}
 const rest=free?L.solve(tiles,nb,d.faces,a2,[ci],200000,{...rules,ice}):null;
 const mate=d.faces.findIndex((f,i)=>i!==ci&&f===d.faces[ci]);
 const b={tiles:d.tiles,faces:d.faces,down:d.down,obst:d.obst,clock:d.clock};
 const m0=measureHuman(b,{runs:20,setting:'dennis',seed:4711}), m1=measureHuman({...b,clock:{i:ci,n:1}},{runs:20,setting:'dennis',seed:4711});
 const at1=m1.results.flatMap(q=>q.attempts),why={};for(const a of at1)if(!a.win)why[a.why]=(why[a.why]||0)+1;
 console.log(r.level,r.shape,'clock free at start:',free,'| clock n',d.clock.n,'stored way takes it at move',d.solution.indexOf(ci)+1,'| solvable after grabbing it first:',!!(rest&&rest.length),
  '| bot as built',m0.expectedTries,'first',m0.firstTryRate,'| bot grabbing it first',m1.expectedTries,'first',m1.firstTryRate,'losses',JSON.stringify(why));}
