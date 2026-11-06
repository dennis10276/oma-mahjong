'use strict';
// An optional initial construction style. Keep the objective readable while
// retaining memory choices in covered background tiles. Every addition must
// preserve the existing whole-level relief rule. This does not predict tries.
const I=require('../lab/ideas.js'),Placement=require('./placement_score.js'),Composer=require('./trap_composer.js'),{roomProfile}=require('./design_traps.js');
function retain(design,share,seed,baselineRoom){
 if(!Number.isFinite(share)||share<0||share>.5)throw Error('Initial hidden share must be between zero and one half');
 const c=I.ctxOf(design),goal=Placement.routeTiles(design,Composer.analyze(design)),markers=new Set([design.clock?.i,design.clockMate,...design.obst.keys,...design.obst.locks,...Object.keys(design.obst.ice).map(Number)].filter(Number.isInteger));
 for(const i of markers)goal.add(i);
 const afterGoal=new Uint8Array(c.n).fill(1);for(const i of goal)afterGoal[i]=0;
 const target=Math.floor(c.n*share),down=new Set(design.down),candidates=global.Layouts.shuffleArr(I.rngOf(seed),c.P.filter(i=>!goal.has(i)&&!markers.has(i)&&!down.has(i)&&!global.Layouts.isFree(i,afterGoal,c.nb))),added=[];
 let d=design,room=baselineRoom||roomProfile(design);if(!room.ok||room.unrelieved>1)throw Error('Hidden-budget style needs a fair baseline');
 for(const i of candidates){if(d.down.length>=target)break;const next={...d,down:[...d.down,i]},r=roomProfile(next);if(!r.ok||r.unrelieved>1)continue;d=next;room=r;added.push(i);}
 return{design:d,room,added,target,before:design.down.length,after:d.down.length};
}
module.exports={retain};
