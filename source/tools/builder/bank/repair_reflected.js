'use strict';
// Reflections preserve physical rules; they expose different edges for repacking.
// Only the independent intent certificate may accept the resulting draft.
const fs=require('fs'),path=require('path'),R=require('./compact_range'),G=require('./compact_geometry'),I=require('../preserve_intent'),P=require('../preserve_trap'),F=require('../footprint');
const OUT=path.resolve(__dirname,'../../../build/footprint60-250-300/drafts');
function run(levels){
  for(const before of R.baseline().filter(b=>levels.includes(b.level))){
    let ready=null,built=0;const failures={},started=Date.now();
    outer:for(const [mx,my]of [[false,false],[true,false],[false,true],[true,true]]){
      const source=structuredClone(before),d=source.design,xs=d.tiles.map(t=>t[0]),ys=d.tiles.map(t=>t[1]),xx=Math.max(...xs)+Math.min(...xs),yy=Math.max(...ys)+Math.min(...ys);
      d.tiles=d.tiles.map(([x,y,z])=>[mx?xx-x:x,my?yy-y:y,z]);
      for(const mode of ['roles','core','plain']){
        const start=Date.now(),roleKeep=I.constraints(source,{criticalPairs:true}),keep=P.constraints(source);
        pass:for(const extraCount of [0,2,4,8,16])for(const w of G.enumerateWindows(d,8,6.5))for(let seed=1;seed<=5;seed++){
          if(Date.now()-start>4000)break pass;
          const candidate=G.buildRestackedTiles(d,before.level,w,{seed,extraCount,useStripShift:false,roleKeep:mode==='roles'?roleKeep:undefined,preserve:mode==='core'?keep:undefined,jitter:seed>3?25:4});
          if(!candidate||!F.measure(candidate,{minimum:58}).ok)continue;built++;
          const proof=I.verify(before,{design:candidate});
          if(proof.ok){ready={...before,design:candidate,footprint:F.measure(candidate,{minimum:58}),preservation:proof,footprintOriginal:before.design,repair:{strategy:'reflected-core-restack',mx,my,mode}};break outer;}
          for(const e of proof.errors)failures[e]=(failures[e]||0)+1;
        }
      }
    }
    if(ready)fs.writeFileSync(path.join(OUT,'level-'+before.level+'.json'),JSON.stringify(ready));
    console.log(JSON.stringify({level:before.level,ok:!!ready,px:ready?.footprint.tilePx,built,failures,ms:Date.now()-started}));
  }
}
if(require.main===module)run(process.argv[2].split(',').map(Number));
module.exports={run};
