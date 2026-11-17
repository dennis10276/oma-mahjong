'use strict';
// Re-lay only a level's own courses, retaining identity pictures and trap roles.
process.env.FINISH_GATE='2';process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),R=require('./gate1_rebuild'),P=require('./finish_all_sources');
function plans(lv){const a=P.original(lv).design,ids=f=>a.tiles.flatMap((p,i)=>f(p,i)?[i]:[]),upper=ids(p=>p[2]>0);
 if(lv===347)return[{moves:[{ids:ids(p=>p[2]>0&&(p[0]>=6||p[1]>=12||p[1]===8)),dx:-1},{ids:ids(p=>p[1]>=6),dy:-2},{ids:[39,17,15,16],dx:-1}],relocate:{3:[11,0,0]},unlock:[6,56]}];
 if(lv===316)return[{moves:[{ids:ids(p=>p[1]>=6),dy:-2}],relocate:{5:[11,0,0]},unlock:[9,17],hardIds:[60,50,52,64,36,85,73],extraPrefixes:[[71,42,5,84,64,85,73,36,2,50,12]]}];
 if(lv===343)return[{moves:[{ids:[48,50,56,58,70],dx:-1}],relocate:{83:[8,12,2],69:[7,13,1],29:[11,10,0]},hardIds:[49,56,29,52,67,69],iceGuard:false}];
 if(lv===348)return[{moves:[{ids:ids(p=>p[2]>0&&(p[0]>=6||p[1]===6)),dx:-1},{ids:[9,10,11,24],dx:-1}],relocate:{42:[9,14,0],1:[11,0,0]},hardIds:[9,11,24,45,50,55,56,57,67,71,72]}];
 if(lv===336)return[{moves:[{ids:[64,66,67,68],dx:-1}],relocate:{65:[9,3,1],52:[9,5,1],19:[11,3,0],36:[9,11,0],35:[11,11,0],72:[6,0,0]},hardIds:[64,66,67,68,52,82,85,87,49,53,54]}];
 if(lv===308)return[{moves:[{ids:[8,9,45],dx:-1}],unlock:[22,49]}];
 if(lv===321)return[{relocate:{75:[9,12,2]},unlock:[78],hardIds:[17,43,68,32,58,54,76,47,26,46,51,39,73,57,77]}];
 if(lv===334)return[{moves:[{ids:upper,dy:2},{ids:[1,2,3,4,5,6],dx:-1,dy:1},{ids:[35],dy:2}],relocate:{0:[1,2,1],12:[11,3,0]},unlock:[36,59]}];
 if(lv===327)return[{moves:[{ids:[...upper,0,13,14,15,21],dy:2}],relocate:{22:[9,9,0],23:[11,9,0]},extraPrefixes:[JSON.parse(fs.readFileSync(path.join(R.OUT,'327-lock-counter.json'))).prefix],witnessFile:path.join(R.OUT,'327-lock-counter-order.json'),orders:2,fullWitness:true}];
 if(lv===331)return[{orders:1}];
 if(lv===341)return[{moves:[{ids:ids(p=>p[2]>0&&p[1]>=10),dy:-1}],relocate:{5:[10,1,0],8:[11,3,0],13:[0,8,0],47:[1,7,1],72:[5,9,3],28:[11,10,0],79:[6,0,0],33:[9,12,0]},hardIds:[33,62],unlock:[27,34,56]}];
 throw Error('No course plan '+lv);
}
function one(lv,index){if(lv<301||lv>349)throw Error('Scope ends at 349');const configs=plans(lv),originalCore=new Set(R.rebuild(lv,{protectPhotos:true,preview:true}).fixed);for(const i of index==null?configs.map((_,i)=>i):[index]){const config={x0:0,y0:0,left:0,protectPhotos:true,guard:false,prefix:true,iceGuard:true,baitFree:true,orders:0,seconds:25,assignSeconds:30,ms:90000,...configs[i]};config.unlock=[...new Set([...(config.unlock||[]),...(config.moves||[]).flatMap(m=>m.ids).filter(id=>!originalCore.has(id))])];const r=R.rebuild(lv,config);console.log('COURSE',lv,i,r.ok,r.certificate?.errors,r.controlGates?.changed.map(r=>r.tile));if(r.ok)return r;}return{level:lv,ok:false};}
if(require.main===module)one(+process.argv[2],process.argv[3]==null?undefined:+process.argv[3]);module.exports={plans,one};
