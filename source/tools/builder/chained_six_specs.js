'use strict';
// Declarative only: also consumed by the independent verifier. Do not import
// placement, picture assignment, or story proof here.
const rows=[
  ['doubleMelt',9,'clock<lock; clock<cover:ice; keyA<cover:ice','One pair, two melts','Use the separated pair beside both ice fronts; preparing the two fronts with lonely neighbours strands two pictures.'],
  ['freeMelt',3,'clock<ice; thaw<lock','The dig melts it for you','Follow the dig to thaw the frozen key or thaw tile for free; preparing it with outside neighbours spends the tray room needed by that dig.'],
  ['clockCount',0,'clock<lock; keyA<cover:ice','Count the clock','The ready pair advances an alternative approach, but its extra tap misses the clock; use the shorter single-tile approach.'],
  ['selfLocked',3,'clock<ice; thaw<lock',"The melter’s twin is under the ice",'Leave the free melting neighbour until the other side has opened the ice that holds its twin.'],
  ['savePair',3,'clock<ice; thaw<lock','Three of a kind','Save one of the two free copies for the visible third copy in the dig; pairing both free copies leaves that third picture waiting through a full tray.'],
  ['keysLater',4,'clock<ice; thaw<ice','Keys are not for now','Save the clock before taking the ready keys; their lock guards the second act, and the two key taps miss the deadline.'],
];
const DEFINITIONS=Object.fromEntries(rows.map(([name,chain,baseSignature,title,see])=>[name,{name,chain,title,see,baseSignature}]));
function family(name,baseName=null,old=null){
  const q=DEFINITIONS[name];if(!q)throw Error('Unknown link '+name);
  if(baseName&&!old)throw Error('Unknown base '+baseName);
  const baseSignature=old?.baseSignature||q.baseSignature,mode=old?.mode||'sixIdea';
  return {name:baseName?baseName+'_'+name:name,base:'chain',chain:old?.chain??q.chain,mode,sixIdea:name,sixIdeas:[name],baseName,
    baseSignature,signature:(old?.signature||baseSignature)+'; route<'+name,links:(old?.links||baseSignature.split('; ').length)+1,
    see:q.see,recipe:q.see,title:q.title,trapType:'chained:'+(baseName?baseName+'_'+name:name),chained:true,repeat:old?.repeat||false,
    dials:{easier:'spare 2',harder:'spare 1; obviousness dial 2'}};
}
function compose(name,baseName,kinds,old=null){
  if(!kinds.length||new Set(kinds).size!==kinds.length||kinds.some(k=>!DEFINITIONS[k]))throw Error('Invalid link list');
  const f=family(kinds[0],baseName,old);
  return {...f,name,sixIdeas:kinds.slice(),signature:f.signature+kinds.slice(1).map(k=>'; route<'+k).join(''),links:f.links+kinds.length-1,
    see:kinds.map(k=>DEFINITIONS[k].see).join(' '),recipe:kinds.map(k=>DEFINITIONS[k].see).join(' '),trapType:'chained:'+name};
}
module.exports={DEFINITIONS,family,compose};
