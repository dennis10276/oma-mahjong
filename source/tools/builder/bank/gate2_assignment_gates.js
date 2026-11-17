'use strict';
const G=require('./gate2_gates');
// Occupancy determines these masks independently of the picture assignment.
// Keep every control copy behind exactly its original pinned specials.
function constraints(before,d,keep,probe){const a=before.design,pins=[...new Set([a.clock.i,...a.obst.keys,...a.obst.locks,...Object.keys(a.obst.ice).map(Number)])],photos=new Set([...pins,...(before.card?.trap?.baits||[]).flatMap(b=>b.tiles)].map(i=>a.faces[i])),goals=a.faces.flatMap((f,i)=>photos.has(f)?[i]:[]),siteOf=new Map(probe.tiles.map((p,i)=>[[p.x,p.y,p.z].join(),i])),mp=id=>keep.indexOf(id),pinSites=pins.map(id=>siteOf.get(d.tiles[mp(id)].join())),source=G.dependencies(a,goals,pins),next=G.dependencies(probe.design,probe.tiles.map((_,i)=>i),pinSites),normalize=x=>x.slice().sort((a,b)=>a-b).join(),masks=probe.tiles.map((_,i)=>normalize(next[i].map(p=>pins[pinSites.indexOf(p)]))),allowedSites={};
 for(const id of goals)allowedSites[id]=mp(id)<0?[]:masks.flatMap((mask,i)=>mask===normalize(source[id])?[i]:[]);
 return{allowedSites,sourceMasks:source,candidateMasks:masks};}
module.exports={constraints};
