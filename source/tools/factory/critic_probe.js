// what the difficulty bot's own games say about a level, in Dennis's terms (probe for the critic idea)
const {measureHuman}=require('/tmp/claude-0/-home-claude/dadcee87-273a-5b61-b793-8a16944909f6/scratchpad/gemini-1e22fc0/source/tools/sim/refit/human_bot.js');
module.exports=function probe(d){
  const m=measureHuman({tiles:d.tiles,faces:d.faces,down:d.down,obst:d.obst,clock:d.clock},{runs:20,setting:'dennis',seed:4711});
  const n=d.tiles.length, losses=m.results.flatMap(r=>r.attempts.filter(a=>!a.win&&!a.censored));
  const late=losses.filter(a=>a.left<=0.35*n).length/Math.max(1,losses.length);           // lost with a third or less left
  const clock=losses.filter(a=>a.why==='clock').length/Math.max(1,losses.length);
  // a wall: the same loss again and again (same reason, within 3 tiles), try after try
  let walls=0,pairs=0;for(const r of m.results){const a=r.attempts.filter(x=>!x.win);for(let k=1;k<a.length;k++){pairs++;if(a[k].why===a[k-1].why&&Math.abs(a[k].left-a[k-1].left)<=3)walls++;}}
  return {exp:m.expectedTries,first:m.firstTryRate,losses:losses.length,lateShare:+late.toFixed(2),clockShare:+clock.toFixed(2),repeatShare:+(walls/Math.max(1,pairs)).toFixed(2),
    lossLeft:losses.map(a=>a.left).sort((x,y)=>x-y).filter((_,k,arr)=>k%Math.ceil(arr.length/8)===0)};
};
if(require.main===module){const fs=require('fs');const B=fs.readFileSync('/home/claude/repo-oma/source/analysis/factory/batch-175-ordered.jsonl','utf8').trim().split('\n').map(JSON.parse);
 for(const lv of process.argv.slice(2).map(Number)){const r=B.find(x=>x.level===lv);console.log(lv,r.recipe.join('+'),r.shape,JSON.stringify(module.exports(r.design)));}}
