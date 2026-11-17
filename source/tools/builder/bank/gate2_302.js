'use strict';
process.env.FINISH_GATE='2';
const fs=require('fs'),path=require('path'),P=require('./finish_all_sources'),R=require('./gate1_rebuild'),{subset}=require('./gate2_trim');
function run(){const lv=302,a=P.original(lv).design,pairs=[[23,37],[16,22],[26,27],[20,42],[10,28],[11,29],[15,25],[17,19],[21,24],[34,44]],out=R.OUT,start=Date.now();
 for(const count of[1,2,3,4])for(let k=0;k<pairs.length;k++){if(Date.now()-start>300000)return{ok:false,why:'five-minute own-level stage deadline'};const cut=pairs.slice(k,k+count).flat();if(cut.length!==count*2)continue;const keep=a.tiles.map((_,i)=>i).filter(i=>!cut.includes(i)),design=subset(a,keep),seedFile=path.join(out,'302-pair-seed.json');fs.writeFileSync(seedFile,JSON.stringify({design,keep}));const mp=i=>keep.indexOf(i),config={seedFile,x0:0,y0:0,left:-.14,fold:{x:7,dx:-1},moves:[{ids:[49,53,55,82,85,87,57].map(mp),dx:-1},{ids:[mp(35)],dy:1},{ids:[mp(36)],dy:-1}],protectPhotos:true,guard:false,prefix:true,iceGuard:true,baitFree:true,orders:0,rankPrefix:9,seconds:15,assignSeconds:20},r=R.rebuild(lv,config);console.log('302 pair trim',cut,r.ok,r.attempts?.at(-1));if(r.ok){r.recipe={...config,cut};fs.writeFileSync(path.join(out,'level-302.json'),JSON.stringify(r,null,1));return{ok:true,cut};}}
 return{ok:false};}
if(require.main===module)console.log(run());module.exports={run};
