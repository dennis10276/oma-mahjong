'use strict';
// Cheap necessary conditions for placement, before an expensive skilled run.
// This is scheduling only; batch_assign still certifies the full batch.
const O=require('./originality.js'),F=require('./piles_for.js'),Placement=require('./placement_score.js');
function compatibleSlots(plan,kept,row,rate){
 if(!rate.train?.valid||!rate.validation?.valid||Math.abs(rate.train.exp-rate.validation.exp)>(plan.maxSeedGap??2)||row.design.tiles.length<(plan.minTiles??72)||O.checkOrigin(row))return[];
 if(kept.some(k=>k.origin.creationId===row.origin.creationId||O.compare(row,k,plan.originality?.maxLayoutShare??.75)))return[];
 const recipe=r=>[...new Set(r.recipe)].sort().join('+');if(kept.filter(k=>recipe(k)===recipe(row)).length>=(plan.originality?.maxSameRecipe??3))return[];
 const family=(rate.train.exp+rate.validation.exp)/2,base=row.shape.split(' · ')[0];
 return plan.levels.filter(s=>!s.keepId&&Placement.slotAllows(row,s)&&family>=(s.productionBand?.[0]??s.target-plan.tolerance)-1e-9&&family<=(s.productionBand?.[1]??s.target+plan.tolerance)+1e-9&&kept.every(k=>Math.abs(k.level-s.level)>10||base!==k.shape.split(' · ')[0]&&F.share(row.design.tiles,F.spots(k.design.tiles)[0])<=(plan.originality?.maxLayoutShare??.75)));
}
module.exports={compatibleSlots};
