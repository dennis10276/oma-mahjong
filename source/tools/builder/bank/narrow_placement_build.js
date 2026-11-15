'use strict';
const fs=require('fs'),path=require('path');
const P=require('./narrow_proof'),L=require('./narrow_lab'),N=require('./narrow'),F=require('../footprint'),E=require('../engine');
const OUT=path.join(L.TMP,'placement-8269'),DATA=path.resolve(P.ROOT,'../codex-tasks/results/narrow-251-299/placements');
const copy=x=>JSON.parse(JSON.stringify(x));
function seedProposal(before){
  const d=before.design,x=d.tiles.map(t=>t[0]),y=d.tiles.map(t=>t[1]),needX=Math.max(...x)-Math.min(...x)>10||F.measure(d).limit==='width',needY=Math.max(...y)-Math.min(...y)>14||F.measure(d).limit==='height';
  const cols=needX?[...new Set(x)]:[null],rows=needY?[...new Set(y)]:[null];let best=null,fallback=null;
  const g=E.game(d),roles=[d.clock.i,...d.obst.keys,...d.obst.locks,...Object.keys(d.obst.ice).map(Number)],core=N.trapSet(before,{g,roles});
  for(const col of cols)for(const row of rows){const q=N.squeeze(d,new Set(),col,row);if(!q.tiles)continue;
    const problem=new Set(q.moved),fixed=q.tiles.filter((_,i)=>!problem.has(i));if(!fixed.length)continue;
    const minX=Math.min(...q.tiles.map(t=>t[0])),minY=Math.min(...q.tiles.map(t=>t[1])),tiles=q.tiles.map(([x,y,z])=>[x-minX,y-minY,z]),fit=F.measure(fixed,{minimum:58});
    const draft={design:{...copy(d),tiles},problem:q.moved.slice(),column:col,row,score:q.moved.length*5};
    if(!fallback||draft.score<fallback.score)fallback=draft;
    if(!fit.ok)continue;
    const remaining=[...core].filter(i=>!problem.has(i)),after=E.game({...copy(d),tiles});
    const beforeRelations=P.relations(g,remaining),afterRelations=P.relations(after,remaining),breaks=beforeRelations.reduce((n,r,i)=>n+(JSON.stringify(r)!==JSON.stringify(afterRelations[i])),0);
    const shifted=d.tiles.filter((t,i)=>!problem.has(i)&&t.some((v,k)=>v!==tiles[i][k])).length;
    const score=q.moved.length*5+breaks*20+shifted*.05;
    if(!best||score<best.score)best={design:{...copy(d),tiles},problem:q.moved,column:col,row,score};
  }
  // A few outlines are limited by an upper edge even after the strip is out.
  // Put those extra top tiles at the side too, keeping the remaining base
  // supported. They remain in the level and are for Dennis to place himself.
  if(!best&&fallback){
    const trial=fallback,parked=new Set(trial.problem),T=trial.design.tiles;
    for(let n=0;n<12&&!F.measure(T.filter((_,i)=>!parked.has(i)),{minimum:58}).ok;n++){
      let choice=null;for(let i=0;i<T.length;i++)if(!parked.has(i)){
        const ids=T.map((_,j)=>j).filter(j=>!parked.has(j)&&j!==i),remaining=ids.map(j=>T[j]);if(!require('./narrow_methods').supported(remaining))continue;
        const fit=F.measure(remaining,{minimum:58}),score=fit.tilePx+T[i][2]*.0001;if(!choice||score>choice.score)choice={i,score};
      }
      if(!choice)break;parked.add(choice.i);
    }
    trial.problem=[...parked];best=trial;
  }
  if(!best)throw Error('No manual foundation for level '+before.level);
  return best;
}
function build(){
  const known=new Map(L.accepted().map(r=>[r.level,r])),levels=[];
  for(let level=251;level<=299;level++){
    if(level%10===0)continue;const before=P.original(level);if(F.measure(before.design,{minimum:58}).ok)continue;
    const accepted=known.get(level),seed=accepted?{design:accepted.design,problem:accepted.relocated||accepted.moved,column:accepted.column,row:accepted.row}:seedProposal(before);
    const base=copy(seed.design),g=E.game(before.design),roles=[before.design.clock.i,...before.design.obst.keys,...before.design.obst.locks,...Object.keys(before.design.obst.ice).map(Number)];
    const entry={level,status:accepted?'remade':'needs placement',base,baseHash:P.hash(base),original:before.design,problem:seed.problem,trap:[...N.trapSet(before,{g,roles})],column:seed.column,row:seed.row};
    const revision=path.join(P.DIR,'placement-lab/improvements',`level-${level}.json`);
    if(fs.existsSync(revision)){
      const r=JSON.parse(fs.readFileSync(revision));
      if(r.baseHash===entry.baseHash&&r.positions?.length===base.tiles.length&&!r.error){
        entry.proposal={positions:r.positions,problem:r.problem,status:r.status,method:r.method,message:r.message,check:r.check,
          review:[r.note?'Your feedback: '+r.note:'',r.method+'. '+r.message].filter(Boolean).join('\n\n')};
      }
    }
    levels.push(entry);
    console.log(JSON.stringify({level,status:levels.at(-1).status,toPlace:seed.problem.length}));
  }
  // User edits live beside, never inside, this generated asset directory.
  fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(DATA,{recursive:true});fs.cpSync(L.LAB,OUT,{recursive:true});
  for(const file of ['lab.html','index.html']){
    let html=fs.readFileSync(path.join(OUT,file),'utf8');if(!html.includes("'lab.js']"))throw Error('Lab boot list changed');
    html=html.replace("'lab.js']","'lab.js', 'placement-model.js', 'placement-client.js']").replace('<title>Mahjong Level Lab</title>','<title>Tile placement lab</title>');
    fs.writeFileSync(path.join(OUT,file),html);
  }
  fs.copyFileSync(path.join(__dirname,'narrow_placement_model.js'),path.join(OUT,'placement-model.js'));
  fs.copyFileSync(path.join(__dirname,'narrow_placement_client.js'),path.join(OUT,'placement-client.js'));
  const dataset={version:1,rendererCommit:'3b188bcd',levels};fs.writeFileSync(path.join(OUT,'placement-data.json'),JSON.stringify(dataset));
  fs.writeFileSync(path.join(L.TMP,'placement-manifest.json'),JSON.stringify({levels:levels.map(({level,status,problem})=>({level,status,toPlace:problem.length})),assetDirectory:OUT,userDataDirectory:DATA},null,2)+'\n');
  return {OUT,DATA,dataset};
}
if(require.main===module)build();module.exports={build,OUT,DATA,seedProposal};
