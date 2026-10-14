/* Offline audit only. Never edits game files or contacts the database.
 * A certificate proves an actual winning tap sequence without speculative unmatched
 * removals. It does NOT prove the order is deducible for every hidden arrangement.
 * The search may use hindsight to find a certificate; the verifier explicitly says so.
 */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const H=require('../../www/hard'),L=require('../../www/layouts'),{game}=require('./tighten_clocks');
const ROOT=path.resolve(__dirname,'../..');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const readTable=f=>vm.runInNewContext(fs.readFileSync(path.join(ROOT,f),'utf8')+';HARD_LEVELS');

function engine(d,visibility='uncovered') {
 const g=game(d),n=g.tiles.length,bits=Array.from({length:n},(_,i)=>1n<<BigInt(i));
 const mask=xs=>xs.reduce((a,i)=>a|bits[i],0n),all=mask(bits.map((_,i)=>i));
 const above=g.nb.above.map(mask),left=g.nb.left.map(mask),right=g.nb.right.map(mask);
 const ice=g.rules?g.rules.iceNb.map(mask):[],keys=mask(d.obst?.keys||[]),locks=mask(d.obst?.locks||[]);
 const downs=mask(d.down),faces=g.faces,byFace=new Map();
 faces.forEach((f,i)=>byFace.set(f,(byFace.get(f)||0n)|bits[i]));
 const count=x=>{let c=0;while(x){x&=x-1n;c++;}return c;};
 const free=(i,a)=>!!(a&bits[i])&&!(above[i]&a)&&(!(left[i]&a)||!(right[i]&a));
 const can=(i,a)=>free(i,a)&&(!(locks&bits[i])||!(keys&a))&&(!g.rules?.ice[i]||count(ice[i]&~a)>=g.rules.ice[i]);
 const observe=s=>{let k=s.known;for(let i=0;i<n;i++)if((s.alive&bits[i])&&!(downs&bits[i])&&(visibility==='all-face-up'||!(above[i]&s.alive)))k|=bits[i];return {...s,known:k};};
 const initial=()=>observe({alive:all,known:0n,tray:[],peek:-1,moves:0});
 const available=s=>bits.map((_,i)=>i).filter(i=>can(i,s.alive));
 const clockOK=s=>!d.clock||!(s.alive&bits[d.clock.i])||s.moves<d.clock.n;
 function tap(s,i){
  if(!can(i,s.alive)||!clockOK(s))return null;
  const f=faces[i],q=s.tray.indexOf(f),pk=s.peek;
  const peekPair=q<0&&pk>=0&&pk!==i&&(s.alive&bits[pk])&&free(pk,s.alive)&&faces[pk]===f;
  let known=s.known|bits[i];
  if((downs&bits[i])&&pk!==i&&q<0&&!peekPair)return {state:observe({...s,known,peek:i}),removed:[],kind:'peek'};
  let alive=s.alive&~bits[i],tray=s.tray.slice(),peek=pk===i?-1:pk,removed=[i];
  if(peekPair){alive&=~bits[pk];removed.push(pk);peek=-1;known|=bits[pk];}
  else if(q>=0)tray.splice(q,1);else tray.push(f);
  if(tray.length>=L.SLOTS)return null;
  // Use the stricter per-removal clock rule, including both halves of a peek pair.
  let a=s.alive,m=s.moves;
  for(const j of removed){if(d.clock&&(a&bits[d.clock.i])&&m>=d.clock.n)return null;a&=~bits[j];m++;}
  const state=observe({alive,known,tray,peek,moves:s.moves+removed.length});
  return {state,removed,kind:removed.length===2?'peek-match':q>=0?'tray-match':'take'};
 }
 const knownPartner=(s,i)=>s.tray.includes(faces[i])||!!(s.alive&s.known&byFace.get(faces[i])&~bits[i]);
 function normalize(s){
  const actions=[];s=observe(s);
  // Peeking an unknown available tile is safe information gathering: it either
  // exposes a face for free or automatically matches an existing tray/peek face.
  // Fixed index order avoids consulting unknown identities when choosing a peek.
  for(;;){const i=available(s).find(j=>(downs&bits[j])&&!(s.known&bits[j]));if(i===undefined)break;
   const t=tap(s,i);if(!t)return null;actions.push({i,kind:'inspect',removed:t.removed});s=t.state;
  }
  return {state:s,actions};
 }
 return {g,n,bits,all,above,downs,faces,byFace,count,free,can,observe,initial,available,clockOK,tap,knownPartner,normalize};
}

function search(d,limit=30000,visibility='uncovered'){
 const E=engine(d,visibility),{n,bits,faces}=E,dead=new Set(),active=new Set();let nodes=0,hitLimit=false,bestLeft=n;
 const routeRank=new Map(d.solution.map((i,k)=>[i,k]));
 function visit(s){
  if(++nodes>limit){hitLimit=true;return null;}
  const norm=E.normalize(s);if(!norm)return null;s=norm.state;
  const left=E.count(s.alive);bestLeft=Math.min(bestLeft,left);
  if(!left)return s.tray.length?null:norm.actions;
  if(!E.clockOK(s))return null;
  const key=s.alive.toString(36)+'|'+s.known.toString(36)+'|'+s.tray.slice().sort((a,b)=>a-b).join(',')+'|'+s.peek;
  if(dead.has(key)||active.has(key))return null;
  active.add(key);
  const fr=E.available(s),moves=[];
  for(const i of fr){
   if(!(s.known&bits[i])||!E.knownPartner(s,i))continue;
   const t=E.tap(s,i);if(!t)continue;
   const matches=s.tray.includes(faces[i])||t.removed.length===2;
   const pair=fr.some(j=>j!==i&&faces[j]===faces[i]);
   // Ordering is only a search optimisation; not part of a claimed human policy.
   const score=(matches?10000:0)+(pair?1000:0)-routeRank.get(i);
   moves.push({i,t,score});
  }
  moves.sort((a,b)=>b.score-a.score);
  for(const {i,t} of moves){const rest=visit(t.state);if(rest)return norm.actions.concat({i,kind:'choose-known',removed:t.removed},rest);if(hitLimit)return null;}
  active.delete(key);dead.add(key);return null;
 }
 const start=Date.now(),actions=visit(E.initial());
 return {status:actions?'certificate':hitLimit?'search-limit':'no-route-under-this-restricted-policy',nodes,bestLeft,ms:Date.now()-start,actions};
}

// Independent certificate checks use the production legality oracle and plain arrays,
// not the search's bit-mask transitions. Deliberately do not call engine().tap here.
function verify(d,actions,visibility='uncovered'){
 const g=game(d),n=d.tiles.length,alive=new Uint8Array(n).fill(1),initial=alive.slice(),known=new Uint8Array(n),down=new Set(d.down);
 const tray=[],path=[];let peek=-1,inspections=0,chosen=0;
 const can=i=>g.rules?L.takeable(i,alive,g.nb,g.rules,initial):L.isFree(i,alive,g.nb);
 const observe=()=>{for(let j=0;j<n;j++)if(alive[j]&&!down.has(j)&&(visibility==='all-face-up'||!g.nb.above[j].some(k=>alive[k])))known[j]=1;};
 observe();
 for(const [step,a] of actions.entries()){
  const i=a.i;if(!Number.isInteger(i)||!can(i))throw Error('Illegal tap at '+step);
  if(a.kind==='choose-known'){
   chosen++;if(!known[i])throw Error('Unidentified chosen tile at '+step);
   if(!tray.includes(d.faces[i])&&!d.faces.some((f,j)=>j!==i&&alive[j]&&known[j]&&f===d.faces[i]))throw Error('No known partner at '+step);
  }else if(a.kind==='inspect'){
   inspections++;if(!down.has(i)||known[i])throw Error('Not an unknown free peek at '+step);
  }else throw Error('Unknown certificate action');
  const f=d.faces[i],q=tray.indexOf(f),pair=q<0&&peek>=0&&peek!==i&&alive[peek]&&L.isFree(peek,alive,g.nb)&&d.faces[peek]===f;
  known[i]=1;const removed=[];
  if(down.has(i)&&peek!==i&&q<0&&!pair){peek=i;}
  else{
   const old=peek;alive[i]=0;path.push(i);removed.push(i);if(peek===i)peek=-1;
   if(pair){if(!can(old))throw Error('Peek partner is not takeable');alive[old]=0;known[old]=1;path.push(old);removed.push(old);peek=-1;}
   else if(q>=0)tray.splice(q,1);else tray.push(f);
   if(tray.length>=L.SLOTS)throw Error('Tray overflow');
  }
  if(JSON.stringify(removed)!==JSON.stringify(a.removed))throw Error('Removal mismatch at '+step);
  observe();
 }
 if(alive.some(Boolean)||tray.length||path.length!==n||(d.clock&&path.indexOf(d.clock.i)>=d.clock.n))throw Error('Not a complete clock-safe win');
 return {valid:true,removals:path.length,inspections,chosen,clockMove:d.clock?path.indexOf(d.clock.i)+1:null,sequentialWitnessAlsoValid:H.validSolution(g,path),path};
}

function savedRouteMetrics(d){
 const g=game(d),alive=new Uint8Array(d.tiles.length).fill(1),initial=alive.slice(),tray=[],cover=H.coverOf(g.tiles,g.nb);
 let observerUnknown=0,optimisticUnknown=0;
 for(const i of d.solution){
  const can=j=>g.rules?L.takeable(j,alive,g.nb,g.rules,initial):L.isFree(j,alive,g.nb);
  const has=(optimistic)=>tray.includes(d.faces[i])||d.faces.some((f,j)=>j!==i&&alive[j]&&f===d.faces[i]&&(can(j)||(!g.down[j]&&(optimistic||!cover[j].some(k=>alive[k])))));
  observerUnknown+=+!has(false);optimisticUnknown+=+!has(true);
  alive[i]=0;const q=tray.indexOf(d.faces[i]);if(q>=0)tray.splice(q,1);else tray.push(d.faces[i]);
 }
 return {valid:H.validSolution(g,d.solution),observerUnknown,optimisticUnknown};
}

module.exports={engine,search,verify,savedRouteMetrics,readTable,hash};
if(require.main===module){
 const args=process.argv.slice(2),limit=+(args[0]||30000),selected=args[1]&&args[1]!=='all'?args[1].split(',').map(Number):Array.from({length:190},(_,i)=>80+i),visibility=args[2]||'uncovered';
 const files=['www/levels-hard.js','www/hard.js','www/layouts.js','www/js/board.js','www/js/rules.js','www/style.css'];
 const before=Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(path.join(ROOT,f)))]));
 const T=readTable('www/levels-hard.js'),live=readTable('analysis/levels-1.49.js'),rows=[];
 const output=path.join(ROOT,'analysis/information-audit-'+visibility+'.json');
 const report={scope:'Unpublished local boards, with published 1.49 saved-route comparison',from:80,to:269,limit,visibility,visibilityNote:visibility==='uncovered'?'Only completely uncovered face-up tiles; actual free-peek auto-match rules; no x-ray needed':'Every face-up identity is granted known, even when fully covered. This optimistic model exceeds what tapping x-ray can guarantee.',claim:'Certificate proves a clock-safe route with no unidentified deliberate removals and a known matching partner for every deliberately parked tile. It does not prove the choice of route can be deduced from observations or that all consistent hidden arrangements are won. Failure is only for this restricted policy with fixed-order free inspection, NOT proof of required guessing.',hashes:before,rows};
 for(const lv of selected){
  const d=H.unpack(lv,T.levels[lv-T.from]),old=H.unpack(lv,live.levels[lv-live.from]);
  const r={lv,boardHash:hash(JSON.stringify(T.levels[lv-T.from])),saved:savedRouteMetrics(d),liveSaved:savedRouteMetrics(old),...search(d,limit,visibility)};
  if(r.actions)r.certificate=verify(d,r.actions,visibility);
  rows.push(r);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({lv,status:r.status,nodes:r.nodes,bestLeft:r.bestLeft,ms:r.ms,inspections:r.certificate?.inspections}));
 }
 report.unchanged=files.every(f=>before[f]===hash(fs.readFileSync(path.join(ROOT,f))));
 report.summary={count:rows.length,winningRoutes:rows.filter(r=>r.saved.valid).length,liveWinningRoutes:rows.filter(r=>r.liveSaved.valid).length,certificates:rows.filter(r=>r.certificate).length,searchLimits:rows.filter(r=>r.status==='search-limit').length,restrictedFailures:rows.filter(r=>r.status==='no-route-under-this-restricted-policy').length};
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
 if(!report.unchanged)throw Error('Game file changed during audit');
}
