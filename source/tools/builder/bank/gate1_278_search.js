'use strict';
const fs=require('fs'),path=require('path'),R=require('./gate1_rebuild');
const base={guard:false,iceGuard:true,baitFree:true,prefixExtra:3,unlock:[57,60,62,58,59],fold:{x:0,y0:10,dx:1},relocate:{10:[2,4,0],16:[2,9,0],42:[3,9,1],61:[4,9,2],47:[3,7,1],55:[3,2,1],50:[12,12,1],28:[13,12,0],69:[8,4,1],65:[10,4,1],64:[12,4,1],79:[9,4,2],77:[11,4,2]},prefix:true,x0:2,y0:1,orders:0,seconds:10,assignSeconds:20};
const began=Date.now(),attempts=[];
outer:for(const a of[-1,0,1])for(const b of[-1,0,1])for(const c of[0,1])for(const d of[0,1]){
 if(Math.abs(a-b)>1||c<a||d<b)continue;if(Date.now()-began>240000)break outer;
 const opts=structuredClone(base);Object.assign(opts.relocate,{72:[5,10+a,3],70:[7,10+b,3],76:[4,12+c,3],74:[6,12+d,3]});
 console.log('278 stagger',a,b,c,d);const r=R.rebuild(278,opts);attempts.push({a,b,c,d,ok:r.ok,errors:r.certificate?.errors,attempts:r.attempts});if(r.ok)break outer;
}
fs.writeFileSync(path.join(R.OUT,'stair-278-search.json'),JSON.stringify({attempts,ms:Date.now()-began},null,2));
