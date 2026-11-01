// Claude's hold-out check of Gemini's bot-designer (3642d85): piles it never saw, the band the factory needs
const fs=require('fs'),path=require('path');const G=process.argv[2];const [pilesFile,ids,band,out]=process.argv.slice(3);
const Hard=require(G+'/source/www/hard.js');const {designWithBot}=require(G+'/source/tools/sim/refit/bot_designer.js');
const I=require(G+'/source/tools/lab/ideas.js');
const piles=JSON.parse(fs.readFileSync(pilesFile,'utf8')).filter(p=>ids.split(',').map(Number).includes(p.level));const B=band.split(',').map(Number);
for(const p of piles){const tiles=p.tiles.map(([x,y,z])=>({x,y,z}));const t0=Date.now();let hit=null,tries=0;
  for(let a=0;a<6&&!hit;a++){tries++;let d;try{d=Hard.makeNow(p.level,1.6,1,50+a,{tiles});}catch(e){continue;}if(!d||!d.solution)continue;
    let res;try{res=designWithBot(d,B,{runs:20,seed:4711,maxAttempts:6,pileIndex:a});}catch(e){fs.appendFileSync(out,JSON.stringify({level:p.level,error:String(e.message).slice(0,200)})+'\n');continue;}
    if(res&&res.g2&&res.g2.exp>=B[0]&&res.g2.exp<=B[1]&&res.specialsMatter&&res.specialsMatter.ok)hit=res;}
  const row={level:p.level,shape:p.shape,n:tiles.length,band:B,tries,sec:Math.round((Date.now()-t0)/1000),hit:!!hit};
  if(hit){const b=hit.board;row.recipe=hit.recipe;row.exp=hit.g2.exp;row.first=hit.g2.first;row.flags=hit.critic.flags;row.matter=hit.specialsMatter.kinds;row.valid=I.valid({tiles:b.tiles,faces:b.faces,down:b.down,gold:b.gold||[],obst:b.obst,clock:b.clock,solution:b.solution});
    row.spare=b.clock?b.clock.n-(b.solution.indexOf(b.clock.i)+1):null;row.keysSame=!b.obst.keys||b.obst.keys.length!==2||b.faces[b.obst.keys[0]]===b.faces[b.obst.keys[1]];row.board=b;}
  fs.appendFileSync(out,JSON.stringify(row)+'\n');}
