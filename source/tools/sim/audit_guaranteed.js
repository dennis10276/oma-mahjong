/* Exact AND/OR audit over a finite set of indistinguishable, individually solvable
 * boards. A loss is a genuine counterexample to an observation-only guarantee over
 * that set. A win applies ONLY to that finite set, not every possible hidden deal.
 * Optimistic player: all face-up identities known, free unlimited non-removing peeks.
 * Node limits always mean inconclusive. No files in www/ are modified.
 */
'use strict';
const fs=require('fs'),path=require('path'),H=require('../../www/hard'),L=require('../../www/layouts');
const A=require('./audit_information'),{game}=require('./tighten_clocks');
function audit(d,{worldCount=16,seed=918731,fullLimit=100000,beliefLimit=300000,worldFaces=null}={}){
 const E=A.engine(d,'all-face-up'),{n,bits}=E;
 const seenWorlds=new Set(),worlds=[],generation={tried:0,unsolved:0,limited:0};
 let fullNodes=0;
 function fullSolver(faces){
  const good=new Map(),bad=new Set(),ranks=new Map(d.solution.map((i,k)=>[i,k]));
  function install(p){let a=E.all;for(let k=0;k<=p.length;k++){good.set(a.toString(36),p.slice(k));if(k<p.length)a&=~bits[p[k]];}}
  function solve(alive, tray, limit=fullLimit){
   let nodes=0,capped=false;
   function rec(a,tr,moves){
    const key=a.toString(36);if(good.has(key))return {win:true,path:good.get(key)};if(bad.has(key))return {win:false};
    if(++nodes>limit){capped=true;return {win:null};}
    if(!a){const win=tr.length===0;if(!win)bad.add(key);return {win,path:win?[]:undefined};}
    if(d.clock&&(a&bits[d.clock.i])&&moves>=d.clock.n){bad.add(key);return {win:false};}
    const choices=[];
    for(let i=0;i<n;i++)if(E.can(i,a)){
     const q=tr.indexOf(faces[i]);if(q<0&&tr.length>=L.SLOTS-1)continue;
     choices.push({i,q,score:(q>=0?10000:0)-ranks.get(i)});
    }
    choices.sort((x,y)=>y.score-x.score);let unknown=false;
    for(const {i,q} of choices){const next=q<0?tr.concat(faces[i]):tr.filter((_,j)=>j!==q),r=rec(a&~bits[i],next,moves+1);
     if(r.win===true){const path=[i,...r.path];good.set(key,path);return {win:true,path};}
     if(r.win===null)unknown=true;
     if(capped)break;
    }
    if(!unknown){bad.add(key);return {win:false};}return {win:null};
   }
   const r=rec(alive,tray,n-E.count(alive));fullNodes+=nodes;return {...r,nodes,capped};
  }
  return {solve,install,bad,good};
 }
 function add(faces,provided){
  if(faces.length!==d.faces.length||faces.some((f,i)=>!d.down.includes(i)&&f!==d.faces[i]))throw Error('World changes initially granted face-up information');
  if(faces.slice().sort((a,b)=>a-b).join(',')!==d.faces.slice().sort((a,b)=>a-b).join(','))throw Error('World changes the tile multiset');
  const key=faces.join(',');if(seenWorlds.has(key))return;seenWorlds.add(key);
  const solver=fullSolver(faces),g={...game(d),faces};let witness=provided;
  if(!witness||!H.validSolution(g,witness)){const r=solver.solve(E.all,[]);if(r.win!==true){generation[r.win===null?'limited':'unsolved']++;return;}witness=r.path;}
  if(!H.validSolution(g,witness))throw Error('Invalid world witness');solver.install(witness);
  worlds.push({faces,witness,solver});
 }
 add(d.faces.slice(),d.solution);
 if(worldFaces)for(const faces of worldFaces)add(faces,null);
 const rng=L.rng(seed),pool=d.down.filter(i=>i!==d.clock?.i);
 while(!worldFaces&&worlds.length<worldCount&&generation.tried<worldCount*12){
  generation.tried++;const faces=d.faces.slice();
  // Mix simple swaps and larger permutations; every accepted world gets a full witness.
  if(generation.tried%2){const a=pool[Math.floor(rng()*pool.length)],b=pool[Math.floor(rng()*pool.length)];[faces[a],faces[b]]=[faces[b],faces[a]];}
  else{const shuffled=L.shuffleArr(rng,pool.map(i=>faces[i]));pool.forEach((i,k)=>faces[i]=shuffled[k]);}
  add(faces,null);
 }
 const memo=new Map();let beliefNodes=0,beliefCapped=false,splitNodes=0,orNodes=0;
 function rec(alive,tray,ids){
  const key=alive.toString(36)+'|'+ids.join(',');if(memo.has(key))return memo.get(key);
  if(++beliefNodes>beliefLimit){beliefCapped=true;return null;}
  if(!alive)return tray.length?false:true;
  const moves=n-E.count(alive);
  if(d.clock&&(alive&bits[d.clock.i])&&moves>=d.clock.n){memo.set(key,false);return false;}
  if(ids.length===1){const r=worlds[ids[0]].solver.solve(alive,tray);if(r.win!==null)memo.set(key,r.win);return r.win;}
  const fr=bits.map((_,i)=>i).filter(i=>E.can(i,alive)),unknownFree=fr.filter(i=>E.downs&bits[i]),groups=new Map();
  for(const w of ids){const signature=unknownFree.map(i=>worlds[w].faces[i]).join(',');if(!groups.has(signature))groups.set(signature,[]);groups.get(signature).push(w);}
  if(groups.size>1){
   splitNodes++;let unknown=false;
   for(const group of groups.values()){const r=rec(alive,tray,group);if(r===false){memo.set(key,false);return false;}if(r===null)unknown=true;if(beliefCapped)break;}
   if(!unknown){memo.set(key,true);return true;}return null;
  }
  orNodes++;const faces=worlds[ids[0]].faces,rank=new Map(d.solution.map((i,k)=>[i,k]));
  const options=fr.map(i=>({i,q:tray.indexOf(faces[i])})).filter(o=>o.q>=0||tray.length<L.SLOTS-1);
  options.sort((a,b)=>(b.q>=0?10000:0)-rank.get(b.i)-((a.q>=0?10000:0)-rank.get(a.i)));
  let unknown=false;
  for(const {i,q} of options){const next=q<0?tray.concat(faces[i]):tray.filter((_,j)=>j!==q),r=rec(alive&~bits[i],next,ids);
   if(r===true){memo.set(key,true);return true;}if(r===null)unknown=true;if(beliefCapped)break;
  }
  if(!unknown){memo.set(key,false);return false;}return null;
 }
 const start=Date.now(),win=rec(E.all,[],worlds.map((_,i)=>i));
 return {level:d.level,win,status:win===false?'proved-no-guarantee-for-these-worlds':win===true?'winning-policy-for-this-finite-set-only':'inconclusive',worldCount:worlds.length,seed,fullLimit,beliefLimit,generation,beliefNodes,fullNodes,splitNodes,orNodes,beliefCapped,ms:Date.now()-start,
  assumptions:'All face-up tiles known, including covered ones; every available face-down tile inspected for free without automatic removal. These give more information/control than the real UI. Worlds differ only in originally face-down identities and preserve the full multiset and all mechanics. Every accepted world has a legal clock-safe witness.',
  scope:'A false result disproves a guaranteed observation-only strategy across these indistinguishable solvable alternatives. A true result does not prove the real level requires no guessing.',
  worlds:worlds.map(({faces,witness})=>({faces,witness}))};
}
module.exports=audit;
if(require.main===module){const lv=+(process.argv[2]||86),worldCount=+(process.argv[3]||16),T=A.readTable('www/levels-hard.js'),d=H.unpack(lv,T.levels[lv-T.from]);
 const start=Date.now(),r=audit(d,{worldCount});r.totalMs=Date.now()-start;r.boardHash=A.hash(JSON.stringify(T.levels[lv-T.from]));
 fs.writeFileSync(path.resolve(__dirname,'../../analysis/information-guarantee-'+lv+'.json'),JSON.stringify(r,null,2)+'\n');const {worlds,...summary}=r;console.log(JSON.stringify(summary));
}
