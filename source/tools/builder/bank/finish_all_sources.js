'use strict';
const fs=require('fs'),path=require('path');
const CF=path.resolve(__dirname,'../../../../../codex-finish-ten/source/tools/builder/bank'),P=require(path.join(CF,'narrow_proof'));
const BANK=path.resolve(__dirname,'../../../analysis/builder/bank');
function original(level){
 if(level<=300)return P.original(level);
 const placed=JSON.parse(fs.readFileSync(path.join(BANK,`placed-all/level-${level}.json`))),stem=placed.source.replace(/^(chained|two) /,'');
 const dirs=placed.source.startsWith('two ')?['new-ideas-light','new-ideas/examples','new-ideas/checked']:['chained-gentle','chained-v2/examples','chained-v1/examples'];
 const file=dirs.map(dir=>path.join(BANK,dir,stem+'.json')).find(fs.existsSync);
 if(!file)throw Error('Missing authored context '+placed.source);
 const rich=JSON.parse(fs.readFileSync(file));
 const identity=d=>JSON.stringify([d.tiles,d.clock.i,d.obst]);
 if(identity(placed.design)!==identity(rich.design))throw Error('Placed/authored identity differs '+level);
 return {...rich,...placed,authoredSource:path.relative(BANK,file)};
}
module.exports={...P,original};
