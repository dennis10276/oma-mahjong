'use strict';
// Existing working constraints on additional dependency graphs. No new tile,
// timer, key system or wrong-idea mechanic is introduced here.
function register(shapes,Six){
  const added=[];
  const add=(base,kinds)=>{const name=base+'_'+kinds.join('_');if(shapes[name])return;shapes[name]=Six.compose(name,base,kinds,shapes[base]);added.push(name);};
  for(const base of ['lookalikeWay','lookalikeNested','lookalikeCover','lookalikeCoverThaw','roofNested','roofCoverKey','roofCoverWay','roofThawWay','roofCoverThaw','waitCoverKey','waitLockCover','waitKeyRoofs','waitCoverWay','waitNested'])add(base,['savePair']);
  for(const base of ['lookalikeWay','lookalikeNested','lookalikeCover','lookalikeCoverThaw','waitCoverKey','waitLockCover'])add(base,['clockCount']);
  for(const base of ['waitNested','waitThawKey','waitThawWay','roofThawKey','lookalikeThaw'])add(base,['selfLocked','savePair']);
  const thaw={chain:3,mode:'sixIdea',baseSignature:'clock<ice; thaw<lock',signature:'clock<ice; thaw<lock',links:2};
  shapes.clockCountThaw_selfLocked=Six.compose('clockCountThaw_selfLocked','thawRoute',['clockCount','selfLocked'],thaw);added.push('clockCountThaw_selfLocked');
  shapes.clockCount_selfLocked_savePair=Six.compose('clockCount_selfLocked_savePair',null,['clockCount','selfLocked','savePair']);added.push('clockCount_selfLocked_savePair');
  return added;
}
module.exports={register};
