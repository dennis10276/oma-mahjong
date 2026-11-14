'use strict';
// Deadline variants remain raw until the complete finishing/audit pipeline passes.
const fs=require('fs'),path=require('path'),{OUT}=require('./chained_v2_run.js'),Q=require('./chained_readability.js');
const names=process.argv[2]?.split(',')||['lookalikeCoverThaw','lookalikeWay','waitNested'],spare=+(process.argv[3]||3);
let made=0;for(const f of fs.readdirSync(path.join(OUT,'raw')).filter(f=>f.endsWith('.json'))){const r=JSON.parse(fs.readFileSync(path.join(OUT,'raw',f)));if(!names.includes(r.brief.story)||r.card.clock.spare===spare||r.card.clock.fewestMoves+spare>19)continue;
  if(r.brief.story==='lookalikeCoverThaw'&&Q.keyRoof(r.design).keyShown<.65)continue;
  const file=f.replace(/-p\d+\.json$/,'-p'+spare+'.json');if(fs.existsSync(path.join(OUT,'raw',file)))continue;
  r.derivation={source:f,deadlineVariant:true};r.design.clock.n=r.card.clock.fewestMoves+spare;r.card.clock.spare=spare;r.card.clock.n=r.design.clock.n;r.brief.frame.spare=spare;
  if(r.brief.story==='lookalikeCoverThaw'){r.brief.targets.keyRoofShownMin=.65;r.brief.targets.keyRoofTopMin=.9;r.roles.bait.keyRoofShownMin=.65;r.roles.bait.keyRoofTopMin=.9;}
  fs.writeFileSync(path.join(OUT,'raw',file),JSON.stringify(r,null,2)+'\n');made++;
}console.log(JSON.stringify({made,spare,names}));
