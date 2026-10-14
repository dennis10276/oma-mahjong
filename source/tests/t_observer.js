'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),H=require('../www/hard'),L=require('../www/layouts'),{game}=require('../tools/sim/tighten_clocks');
module.exports=[
 {name:'observer: unseen pictures under candidate moves cannot influence the choice',cpu:true,async run(t){
  const tiles=[{x:0,y:0,z:1},{x:0,y:0,z:0},{x:2,y:0,z:1},{x:2,y:0,z:0},{x:4,y:0,z:0},{x:6,y:0,z:0},{x:8,y:0,z:0},{x:10,y:0,z:0}],nb=L.neighbors(tiles);
  const a=[0,1,2,3,0,1,2,3],b=a.slice();[b[1],b[3]]=[b[3],b[1]];
  for(const who of ['focused','strong','sensible','average'])for(let seed=1;seed<=40;seed++){
   const first=faces=>{const trace=[];H.play({tiles,nb,faces}, {...H.persona(who),end:0},seed,trace);return trace[0]?.pick;};
   t.eq(first(a),first(b),'same visible board gives same first choice '+who+' seed '+seed);
  }
 }},
 {name:'observer: level 86 hidden-swap regression stays identical until information becomes available',cpu:true,async run(t){
  const T=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../analysis/levels-1.49.js'),'utf8')+';HARD_LEVELS'),d=H.unpack(86,T.levels[86-T.from]),g=game(d),cover=H.coverOf(g.tiles,g.nb),all=new Uint8Array(g.tiles.length).fill(1),faces=g.faces.slice();
  [faces[15],faces[38]]=[faces[38],faces[15]];
  for(let k=0;k<40;k++){
   const seed=4390333195+k*104729,run=faces=>{const r=H.play({...g,faces},H.persona('focused'),seed);return {r,order:Array.from(r.at,(_,i)=>i).filter(i=>r.at[i]>=0).sort((a,b)=>r.at[a]-r.at[b])};},left=run(g.faces),right=run(faces),a=left.order,b=right.order,alive=all.slice();
   for(let n=0;n<=Math.max(a.length,b.length);n++){
    if([15,38].some(i=>alive[i]&&(L.takeable(i,alive,g.nb,g.rules,all)||!g.down[i]&&!cover[i].some(j=>alive[j]))))break;
    if(n>=a.length||n>=b.length){t.eq([left.r.why,a.length],[right.r.why,b.length],'unseen swap cannot change termination '+seed);break;}
    if(!t.eq(a[n],b[n],'unseen swap cannot steer move '+(n+1)+' seed '+seed))break;
    alive[a[n]]=0;
   }
  }
 }},
];
