'use strict';
// A frame has three independent requested coordinates. Geometry can make a
// combination impossible; never substitute a different depth/share silently.
const I=require('../lab/ideas.js'),P=require('./pieces.js'),{boardKey,digest}=require('./meter.js');
const VERSION='pressure-frame-v1';
function covering(c,i){const out=new Set(),todo=[i];while(todo.length)for(const j of c.nb.above[todo.pop()])if(!out.has(j)){out.add(j);todo.push(j);}return out;}
function describe(board){if(!board.clock)return null;const c=I.ctxOf(board),i=board.clock.i;return {depth:covering(c,i).size,share:(board.solution.indexOf(i)+1)/board.tiles.length,spare:P.spareOf(board),clock:i,mate:board.clockMate??null};}
function construct(base,requested,seed=1,options={}){
 const {depth,share,spare}=requested;if(!Number.isInteger(depth)||depth<0||depth>6||!Number.isFinite(share)||share<=0||share>.5||![1,2,3].includes(spare))throw Error('Unsupported pressure frame grid coordinate');
 if(base.clock||Object.keys(base.obst?.ice||{}).length||base.obst?.locks?.length||base.obst?.keys?.length)throw Error('Frame base must be neutral');
 const c=I.ctxOf(base),cover=Array.from({length:c.n},(_,i)=>covering(c,i)),random=I.rngOf(seed),rank=c.P.map(()=>random()),candidates=[];
 const alive=new Uint8Array(c.n).fill(1);
 // A normal frame changes only the clock. Side blockers and tray relief can
 // make equal cover depths have different shortest winning routes. Never pad
 // that route with optional moves or insert an unrequested partner mechanism.
 for(const clock of c.P.filter(i=>cover[i].size===depth)){
  const bound=require('../lab/exact.js').makeLowerBound({tiles:c.tiles,nb:c.nb,faces:base.faces},clock)(alive);
  if(bound/c.n>share+(options.shareTolerance??.035))continue;
  candidates.push({clock,score:Math.abs(bound/c.n-share)+rank[clock]*.001});
 }
 candidates.sort((a,b)=>a.score-b.score);const deadline=Date.now()+(options.milliseconds??3500);let tried=0;
 I.setExact(true,{nodes:options.nodes??20000,milliseconds:options.routeMilliseconds??250});
 return I.withSearchBudget(deadline,()=>{
  for(const candidate of candidates){if(Date.now()>=deadline)break;tried++;const {clock}=candidate,x=I.clone(base);
   x.clock={i:clock,n:999};delete x.clockMate;x.down=x.down.filter(i=>i!==clock);delete x.pieceInstances;
   const fixed=I.fix(x,spare);if(!fixed)continue;const actual=describe(fixed);if(actual.depth!==depth||Math.abs(actual.share-share)>(options.shareTolerance??.035)||actual.spare!==spare)continue;
   fixed.pressureFrame={version:VERSION,requested:{...requested},realized:actual,base:boardKey(base),seed,construction:{tried,normalClockOnly:true},patch:P.diff(base,fixed),id:digest([boardKey(base),requested,seed]).slice(0,20)};
   return fixed;
  }return null;
 });
}
function grade(board,spare){if(![1,2,3].includes(spare)||!board.pressureFrame)return null;const out=I.clone(board);out.clock.n=out.solution.indexOf(out.clock.i)+1+spare;if(!I.valid(out))return null;out.pressureFrame.requested.spare=spare;out.pressureFrame.realized=describe(out);const clockPatch=out.pressureFrame.patch.find(p=>p.path[0]==='clock');if(clockPatch)clockPatch.after=I.clone(out.clock);out.pressureFrame.id=digest([out.pressureFrame.base,out.pressureFrame.requested,out.pressureFrame.seed]).slice(0,20);return out;}
module.exports={VERSION,covering,describe,construct,grade};
