// joins Codex's batch pools with their bot measurements -> rows of board features + family ratings
const fs=require('fs'),path=require('path');
const rows=[];
for(const d of process.argv.slice(2)){
  const pool=JSON.parse(fs.readFileSync(path.join(d,'pool.json')));
  const rd=(id,m)=>{const f=path.join(d,id+'.'+m+'.json');return fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):null};
  for(const r of pool){const s=rd(r.id,'screen'),t=rd(r.id,'rate'),q=rd(r.id,'quality');if(!s)continue;
    const z=r.design,route=z.clock?z.solution.indexOf(z.clock.i)+1:0;
    rows.push({batch:path.basename(d),id:r.id,level:r.level,target:r.target,recipe:[...new Set(r.recipe)].sort().join('+'),shape:r.shape.split(' · ')[0],n:z.tiles.length,
      down:z.down.length/z.tiles.length,ice:Object.keys(z.obst.ice||{}).length,iceH:Object.values(z.obst.ice||{}).reduce((a,b)=>a+b,0),locks:(z.obst.locks||[]).length,
      route,spare:z.clock?z.clock.n-route:null,routeShare:route/z.tiles.length,luck:s.room?s.room.tightBlind:null,unrel:s.room?s.room.unrelieved:null,
      screen:s.exp,full:t&&t.train?t.train.exp:null,val:t&&t.validation?t.validation.exp:null,skilled:q&&q.skilled?q.skilled.exp:null,eligible:q?q.eligible:null,idle:q?q.idle:null,edits:(r.constructionEdits||[]).length});}
}
fs.writeFileSync(process.env.OUT,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');console.log(rows.length,'rows');
