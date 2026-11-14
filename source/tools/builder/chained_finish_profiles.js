'use strict';
// The lighter profile is an explicit revision after Dennis's Task 18 verdicts.
// Historical boards keep their historical band; no acceptance is rewritten.
const PROFILES={
  standard:{parks:1.5,parksMax:3,max3:.1},
  'light-after-verdict':{parks:.5,parksMax:1.5,max3:.05,greedyMin:.55},
};
function check(r,feel,tail){
  const name=r.card.finishProfile||'standard',p=PROFILES[name];
  if(!p)return false;
  if(name!=='standard'&&(!r.reviewRevision?.sourceFile||!r.reviewRevision?.reason))return false;
  const pp=+(feel.parkAt[1]+feel.parkAt[2]).toFixed(1);
  return pp>=p.parks&&pp<=p.parksMax&&feel.waiting[3]<=p.max3&&!feel.lostGames&&(p.greedyMin==null||tail.tailGreedyWin>=p.greedyMin);
}
module.exports={PROFILES,check};
