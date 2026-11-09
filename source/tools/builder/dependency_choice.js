'use strict';
// An authored dependency cycle, rather than pressure on just one stored route.
// Four exposed tops cover four exposed petals. Each top's partner is behind
// two OTHER tops. No petal can be removed with fewer than three tray places.
const B=require('./builder.js'), E=require('./engine.js');
const L=require('../../www/layouts.js');
const Reserve=require('./reserve_cuts.js');
const {tileVisibility}=require('../sim/refit/human_board_visibility.js');

function clover() {
  const tiles=[],base=[],stem=[],underStem=[],modules=[];
  const add=(x,y,z)=>{tiles.push([x,y,z]);return tiles.length-1;};
  for(const y of [-5,-3,-1,1,3,5])for(const x of [-5,-3,-1,1,3,5])
    if(!(Math.abs(x)===5&&Math.abs(y)===5))base.push(add(x,Math.abs(x)===3&&y===-5?-6:y,1));
  for(const z of [0,1])for(const y of [7,9])for(const x of [-1,1]) {
    const t=add(x,y,z);base.push(t);if(z===1)stem.push(t);else underStem.push(t);
  }
  for(const [cx,cy] of [[-3,-3],[3,-3],[-3,3],[3,3]]) {
    const petals=[[0,-2],[2,0],[0,2],[-2,0]].map(([x,y])=>add(cx+x,cy+y,2));
    const heads=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>add(cx+x,cy+y,3));
    modules.push({heads,tails:[petals[1],petals[2],petals[3],petals[0]]});
  }
  return {tiles,base,stem,underStem,modules};
}

// Exhaustive local relaxation: remove all external tiles/obstacles and ignore
// the clock. If even this easier board cannot remove any petal at cap 2, the
// real board cannot either. This is independent of a chosen witness or bot.
function firstPetalProof(design, module, cap=2) {
  const ids=module.heads.concat(module.tails), tiles=ids.map(i=>design.tiles[i]);
  const d={tiles,faces:ids.map(i=>design.faces[i]),down:[],obst:{},clock:null,solution:[]};
  const g=E.game(d),seen=new Set();let states=0;
  function visit(s) {
    const key=Array.from(s.alive).join('')+'/'+s.tray.map(t=>g.faces[t]).sort((a,b)=>a-b).join(',');
    if(seen.has(key))return false;seen.add(key);states++;
    for(const t of E.legal(g,s)) {
      const next=E.step(g,s,t);if(!next||next.tray.length>cap)continue;
      if(t>=module.heads.length||visit(next))return true;
    }
    return false;
  }
  const reachable=visit(E.start(g));
  return {cap,petalReachable:reachable,exhaustive:true,states,scope:`isolated ${ids.length}-tile relaxation; no clock, hidden tiles or external blockers`};
}

function build(brief={},opts={}) {
  const t0=Date.now(),count=brief.targets?.choiceModules??3,spare=brief.frame?.spare??2,thaw=brief.frame?.thaw??2;
  const links=brief.targets?.links??0;
  const inspect=brief.targets?.inspect??[];
  const baitModules=brief.targets?.baitModules??Array.from({length:count},(_,i)=>i),rewardLures=brief.targets?.rewardLures??false;
  const placement=brief.frame?.clockPlacement??'thaw';
  if(!Number.isInteger(count)||count<1||count>4||![1,2,3].includes(spare)||![1,2].includes(thaw))return {fail:'incompatibleBrief',detail:'choiceModules 1..4, spare 1..3 and thaw 1..2 required',ms:0};
  if(!['thaw','stem'].includes(placement))return {fail:'incompatibleBrief',detail:'clockPlacement must be thaw or stem',ms:0};
  if(!Number.isInteger(links)||links<0||links>=count)return {fail:'incompatibleBrief',detail:'links must be 0..choiceModules-1',ms:0};
  if(!Array.isArray(inspect)||inspect.length>2||new Set(inspect).size!==inspect.length||inspect.some(i=>!Number.isInteger(i)||i<0||i>=count))return {fail:'incompatibleBrief',detail:'inspect selects at most two distinct active lobes',ms:0};
  if(!Array.isArray(baitModules)||!baitModules.length||new Set(baitModules).size!==baitModules.length||baitModules.some(i=>!Number.isInteger(i)||i<0||i>=count))return {fail:'incompatibleBrief',detail:'baitModules selects distinct active lobes',ms:0};
  if(typeof rewardLures!=='boolean'||(rewardLures&&(placement!=='thaw'||count!==4||links!==3||inspect.length||baitModules.join(',')!=='2,3')))return {fail:'incompatibleBrief',detail:'rewardLures requires four linked lobes, baitModules [2,3], thaw clock and no inspection caps',ms:0};
  if(Object.keys(brief.frame||{}).some(k=>!['spare','thaw','clockPlacement'].includes(k))||Object.keys(brief.targets||{}).some(k=>!['choiceModules','links','inspect','baitModules','rewardLures'].includes(k)))return {fail:'incompatibleBrief',detail:'unsupported dependencyChoice plan control',ms:0};
  if(brief.story&&brief.story!=='reserveTray')return {fail:'incompatibleBrief',detail:'dependencyChoice constructs the reserveTray story',ms:0};
  if(brief.shape&&brief.shape!=='clover')return {fail:'unknownShape',detail:'dependencyChoice currently supports clover only',ms:0};
  if(brief.tiles||brief.layout!=null||opts.keep||opts.hardWork!=null||opts.softWork!=null)return {fail:'unsupportedOption',detail:'dependencyChoice uses its explicit clover template and node-bounded proofs',ms:0};
  if(opts.wallMs===0)return {fail:'wallClock',ms:0};
  const shape=clover();
  shape.inspections=inspect.map(module=>{
    const target=shape.modules[module].tails[1],[x,y,z]=shape.tiles[target],pair=[shape.tiles.length,shape.tiles.length+1];
    shape.tiles.push([x-1,y+1,z+2],[x+1,y+1,z+2]);return {module,target,pair};
  });
  shape.rewards=rewardLures?[2,3].map((module,j)=>{const donor=shape.tiles.length;shape.tiles.push([j?1:-1,7,2]);return {module,donor,released:shape.underStem[module]};}):[];
  const c=B.context(shape.tiles),n=c.n,all=new Uint8Array(n).fill(1);
  const visible=tileVisibility(c.tiles,{alive:all,down:new Uint8Array(n),openPeek:-1},null).tiles;
  const faces=new Array(n).fill(-1),pairs=[],fixed=new Map(),usedBait=new Set();
  // Seed changes picture labels only; anchors and dependencies stay fixed.
  let seed=(brief.seed??1)>>>0;const labels=Array.from({length:36},(_,i)=>i);
  for(let i=35;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[labels[i],labels[j]]=[labels[j],labels[i]];}
  const pair=(a,b)=>{pairs.push([a,b]);};
  const modules=shape.modules.map((m,index)=>{
    const active=index<count;
    if(active)for(let j=0;j<4;j++)pair(m.heads[j],m.tails[j]);
    else {pair(m.heads[0],m.heads[1]);pair(m.heads[2],m.heads[3]);pair(m.tails[0],m.tails[1]);pair(m.tails[2],m.tails[3]);}
    const candidates=shape.base.filter(t=>!usedBait.has(t)&&visible[t].picture&&m.tails.some(p=>c.above[t].has(p)));
    candidates.sort((a,b)=>c.above[a].size-c.above[b].size||a-b);
    const bait=active&&baitModules.includes(index)?{head:shape.stem[index],tail:candidates[0]}:null;
    if(bait&&Number.isInteger(bait.tail)) {usedBait.add(bait.tail);pair(bait.head,bait.tail);fixed.set(bait.head,bait.tail);fixed.set(bait.tail,bait.head);}
    return {...m,active,bait};
  });
  if(modules.some(m=>m.bait&&!Number.isInteger(m.bait.tail)))return {fail:'visibleBait',ms:Date.now()-t0};
  // Keep the clock's matching partner fixed across module counts/placements.
  // Regenerating this pair would silently retune a second dependency.
  pair(shape.underStem[0],shape.underStem[1]);
  fixed.set(shape.underStem[0],shape.underStem[1]);fixed.set(shape.underStem[1],shape.underStem[0]);
  for(const p of shape.rewards)pair(p.donor,p.released);
  const clock=placement==='stem'?shape.underStem[0]:modules[1].heads[0],keys=placement==='stem'?[]:[modules[0].heads[0],modules[0].tails[0]];
  // One displayed obstacle per tile. Lock the thawing neighbours, never the
  // frozen clock itself: otherwise its lock is hidden behind the ice overlay.
  const locks=placement==='stem'?[]:thaw===2?[modules[1].heads[3]]:[modules[1].heads[1],modules[1].heads[3]];
  const d={tiles:shape.tiles,faces,down:[],gold:[],obst:{ice:placement==='stem'?{}:{[clock]:thaw},locks,keys},clock:{i:clock,n:99},solution:[]};
  // Pair the base along a geometric removal order. Reserved loose tiles wait
  // until their partners are available, so the constructive route stays legal.
  const alive=new Uint8Array(n).fill(1);for(const m of modules)for(const i of m.heads.concat(m.tails))alive[i]=0;
  for(const p of shape.inspections)for(const i of p.pair)alive[i]=0;
  for(const p of shape.rewards)alive[p.donor]=alive[p.released]=0;
  const rest=[],rules={ice:d.obst.ice,iceNb:c.inb,locks:new Set(locks),keys};let open=null;
  const baseTiles=shape.base.filter(i=>!shape.rewards.some(p=>p.released===i));
  while(rest.length<baseTiles.length) {
    const free=baseTiles.filter(i=>alive[i]&&L.takeable(i,alive,c.nb,rules,all));
    const ready=free.find(i=>fixed.has(i)&&free.includes(fixed.get(i)));
    if(Number.isInteger(ready)) {const twin=fixed.get(ready);alive[ready]=alive[twin]=0;rest.push(ready,twin);continue;}
    const t=free.find(i=>!fixed.has(i));if(t==null)return {fail:'baseOrder',ms:Date.now()-t0};
    alive[t]=0;rest.push(t);if(open==null)open=t;else {pair(open,t);open=null;}
  }
  for(const p of shape.inspections)pair(...p.pair);
  if(open!=null||pairs.length!==n/2)return {fail:'pairing',ms:Date.now()-t0};
  const calm=pairs.map((p,i)=>({p,i})).filter(({p})=>p.every(i=>shape.base.includes(i)&&!fixed.has(i)&&!shape.rewards.some(r=>r.released===i)));
  const aliases=new Map();for(let i=0;i<pairs.length-36;i++)aliases.set(calm[2*i+1].i,calm[2*i].i);
  const assigned=new Map();let faceIndex=0;
  pairs.forEach((p,i)=>{const root=aliases.get(i)??i;if(!assigned.has(root))assigned.set(root,labels[faceIndex++]);for(const t of p)faces[t]=assigned.get(root);});
  const inspectionProofs=shape.inspections.map(p=>{
    const opened=all.slice();for(const t of p.pair)opened[t]=0;
    const exposed=tileVisibility(c.tiles,{alive:opened,down:new Uint8Array(n),openPeek:-1},null).tiles[p.target].picture;
    return {...p,concealed:!visible[p.target].picture,revealed:exposed,
      publicPair:p.pair.every(t=>visible[t].picture&&L.isFree(t,all,c.nb)),
      scope:'after the clock, removing this known free pair with at least one tray place is safe and reveals the picture'};
  });
  if(inspectionProofs.some(p=>!p.concealed||!p.revealed||!p.publicPair))return {fail:'inspectionProof',ms:Date.now()-t0};
  // Link matching partners across lobes without moving roles or the frame pair.
  // One bridge picture must wait while another branch supplies its partner.
  for(let i=0;i<links;i++) {
    const a=modules[i].tails[1],b=modules[i+1].tails[1];[faces[a],faces[b]]=[faces[b],faces[a]];
  }
  const groups=Reserve.compile(E.game(d)),localProofs=new Map();
  const proofs=modules.filter(m=>m.bait).map(m=>{
    const group=groups.find(g=>g.blocked.some(b=>b.other===m.bait.head&&b.covered===m.bait.tail));
    if(!group)return {module:modules.indexOf(m),forcedLose:false,public:false};
    if(!localProofs.has(group))localProofs.set(group,firstPetalProof(d,group,2));
    const local=localProofs.get(group),cover=group.tails.find(t=>c.above[m.bait.tail].has(t));
    return {module:modules.indexOf(m),...local,bait:m.bait,cover,public:visible[m.bait.head].picture&&visible[m.bait.tail].picture,
      appliesWhile:'no petal of this dependency group has been removed',petals:group.tails.slice(),
      forcedLose:local.petalReachable===false&&Number.isInteger(cover)&&group.heads.concat(group.tails,[m.bait.head]).every(i=>faces.filter(f=>f===faces[i]).length===2),
      detail:'Taking the loose tile reserves one tray place. Its partner is below a petal; removing any petal needs three free places. Clear this lobe first.'};
  });
  if(proofs.some(p=>!p.forcedLose||!p.public))return {fail:'dependencyProof',proofs,ms:Date.now()-t0};
  const rewards=shape.rewards.map(p=>{
    const temptation=modules[p.module].bait.head,after=all.slice();after[temptation]=0;
    const paid=tileVisibility(c.tiles,{alive:after,down:new Uint8Array(n),openPeek:-1},null).tiles;
    return {...p,temptation,publicReward:visible[p.donor].picture&&paid[p.released].picture&&L.isFree(p.released,after,c.nb)&&L.isFree(p.donor,after,c.nb)&&faces[p.released]===faces[p.donor],
      detail:'The premature single uncovers a matching pair, but still parks the picture whose branch needs the tray room.'};
  });
  if(rewards.some(p=>!p.publicReward))return {fail:'rewardProof',ms:Date.now()-t0};
  const limits={nodes:opts.nodes??400000,totalNodes:opts.totalNodes??700000,ms:Infinity,finishNodes:300000,finishMs:Infinity};
  const shortest=E.clockShortest(E.game(d),limits);
  if(!shortest||shortest.unsure)return {fail:'clockMinimum',ms:Date.now()-t0};
  if(shortest.k+spare>19)return {fail:'clockTooDeep',minimum:shortest.k,ms:Date.now()-t0};
  d.clock.n=shortest.k+spare;d.solution=E.flatten(shortest.path);
  if(!E.replay(d,d.solution,{strict:true}).ok)return {fail:'witness',ms:Date.now()-t0};
  // The clock's floating badge is above every tile (board.js clockBadge).
  // Keys and obstacle overlays, in contrast, must be geometrically exposed.
  const markers=[...keys,...locks,...Object.keys(d.obst.ice).map(Number)];
  if(markers.some(i=>!visible[i].role))return {fail:'visibleSpecials',ms:Date.now()-t0};
  if(Date.now()-t0>(opts.wallMs??60000))return {fail:'wallClock',ms:Date.now()-t0};
  return {design:d,card:{shape:'clover',story:'Leave room to clear each lobe',tiles:n,clock:{tile:clock,fewestMoves:shortest.k,spare,placement},
    choiceModules:count,links,inspectionPairs:inspectionProofs,rewardLures:rewards,dependencyChoices:proofs,dependencyGroups:groups.map(g=>({heads:g.heads,tails:g.tails})),scope:'construction proofs; difficulty and quality require measurement'},
    intents:[{name:'complete strict witness',proven:true},{name:'visible clock and any keys/locks',proven:true},{name:'visible reserve-space choices with proven dependency groups',proven:true,detail:proofs.length}],
    modules,ms:Date.now()-t0};
}
module.exports={build,clover,firstPetalProof};
