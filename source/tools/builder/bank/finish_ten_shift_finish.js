'use strict';
const fs=require('fs'),path=require('path'),P=require('./narrow_proof'),R=require('./finish_ten_records'),Q=require('./finish_ten_proof'),E=require('../engine'),G=require('./narrow_methods'),Tail=require('./tail');
const OUT=path.resolve(P.DIR,'../../finish-ten');
function shift(level){const pack=JSON.parse(fs.readFileSync(path.resolve(P.DIR,'../narrow-final/pack.json'))),row=pack.rows.find(r=>r.level===level),before=P.original(row.swapFrom||row.level),base=P.prepare(before),d=row.draft.design,map=R.mapping(before,d,R.record(row)),fails=[];
  for(const axis of [1,0])for(const cut of [10,12,8,4,2])for(const dir of [-1,1])for(const side of [1,-1]){const b=structuredClone(d);for(const p of b.tiles)if(side>0?p[axis]>=cut:p[axis]<=cut)p[1-axis]+=dir;const min=Math.min(...b.tiles.map(p=>p[1-axis]));for(const p of b.tiles)p[1-axis]-=min;if(!G.valid(b.tiles))continue;
    let t;try{t=Tail.cappedTail(b,3,{peek:false,nodes:300000,ms:1000});}catch(e){continue;}if(t.result!=='win')continue;b.solution=t.solution;const c=Q.certify(before,b,map.keep,base);if(c.ok)return {level,sourceLevel:before.level,ok:true,how:`Shift the connected ${axis?'lower/upper':'side'} finish wing half a tile (axis ${axis}, cut ${cut}, side ${side}, delta ${dir}) while leaving its internal blocking relations intact`,design:b,keep:map.keep,certificate:c,baselineMapInferred:map.inferred};fails.push({axis,cut,dir,side,errors:c.errors});
  }return {level,ok:false,fails};
}
if(require.main===module){const r=shift(+(process.argv[2]||277));fs.writeFileSync(path.join(OUT,'candidates','level-'+r.level+'.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({...r,design:undefined,keep:undefined,certificate:undefined}));}module.exports={shift};
