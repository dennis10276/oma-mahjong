'use strict';
// The shared tail tuner only accepts improving swaps. A separated tail can be
// a plateau of ready pairs (score 1); allow neutral swaps to leave that plateau,
// then submit the entire candidate to the caller's complete trap proof.
const E=require('./engine.js'),Tail=require('./bank/tail.js'),S=require('./bank/separate.js');
function tune(d,opts={}){
  const until=Date.now()+(opts.wallMs??15000),seed=opts.seed??1,rand=Tail.prepare?require('./trap_mixes.js').rngOf(seed*7741):Math.random;
  const prefix=d.solution.slice(0,d.solution.indexOf(d.clock.i)+1),frozen=new Set([...prefix,...(opts.freeze||[])].map(i=>d.faces[i]));
  const movable=d.solution.filter(i=>!frozen.has(d.faces[i])),geo=S.geometry(d),dist=w=>w<.13?.13-w:w>.25?w-.25:0;
  let cur=d,score=Tail.measure(d,{seed,playouts:100}).tailGreedyWin,best=d,bestDist=dist(score),accepted=0,proposals=0,validations=0;
  while(Date.now()<until&&proposals<6000&&movable.length>=4){
    proposals++;const u=movable[Math.floor(rand()*movable.length)],v=movable[Math.floor(rand()*movable.length)];if(u===v||cur.faces[u]===cur.faces[v])continue;
    const faces=cur.faces.slice();[faces[u],faces[v]]=[faces[v],faces[u]];const dd={...cur,faces};
    if(!E.replay(dd,dd.solution,{strict:true}).ok||!S.closeTwins(dd,geo).meets)continue;
    const w=Tail.measure(dd,{seed,playouts:100}).tailGreedyWin;
    if(dist(w)>dist(score)&&rand()>.035)continue;
    cur=dd;score=w;accepted++;
    if(dist(w)<bestDist){best=cur;bestDist=dist(w);}
    if(w>=.12&&w<=.26){
      const fresh=Tail.measure(cur,{seed:977,playouts:800}).tailGreedyWin;
      if(fresh>=.10&&fresh<=.28){validations++;const p=opts.validate(cur);if(p.ok)return {ok:true,design:cur,score:fresh,accepted,proposals,validations};}
      if(validations>=5)break;
    }
    // Restart from the best after a wandering run; neutral exploration still
    // changes pair ordering even when the measured score does not move yet.
    if(accepted%180===0){cur=best;score=Tail.measure(cur,{seed,playouts:100}).tailGreedyWin;}
  }
  return {ok:false,design:d,bestScore:Tail.measure(best,{seed:977,playouts:800}).tailGreedyWin,accepted,proposals,validations};
}
module.exports={tune};
