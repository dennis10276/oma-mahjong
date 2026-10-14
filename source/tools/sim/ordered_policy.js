'use strict';
const H=require('../../www/hard'),L=require('../../www/layouts'),{game}=require('./tighten_clocks');
const POLICY={from:80,to:269,lanes:2,maxDown:0.20,selectionRuns:512,validationRuns:8192,selectionSeed:185731,validationSeed:986347,minClockReach:0.99,maxClockLoss:0.005,maxBlind:0.12,maxUnknown:0.28,tailEnd:0.18};
function target(level){return level<=150?H.target(level,'strong'):.30+(POLICY.tailEnd-.30)*Math.min(1,(level-150)/(POLICY.to-150));}
function sample(d,runs,seed){
 const g=game(d),p=H.persona('focused');let wins=0,reached=0,clockLoss=0,decisions=0,blind=0,forced=0,unknown=0,options=0,risky=0;
 // The seed set belongs to the measurement, not a level number. Reordering a whole board must
 // not silently change the games on which its difficulty was measured.
 for(let k=0;k<runs;k++){const r=H.play(g,p,seed*7919+k*104729);wins+=+r.win;reached+=+(r.at[d.clock.i]>=0);clockLoss+=+(r.why==='clock');decisions+=r.decisions;blind+=r.blind;forced+=r.forcedBlind;unknown+=r.unknownOptions;options+=r.singleOptions;risky+=r.risky;}
 return {win:wins/runs,reach:reached/runs,clockLoss:clockLoss/runs,afterClock:reached?wins/reached:0,blindRate:decisions?blind/decisions:0,forcedPerGame:forced/runs,unknownShare:options?unknown/options:0,risky:risky/runs};
}
function frozen(d){return new Set([...d.solution.slice(0,d.solution.indexOf(d.clock.i)+1),...d.gold,...(d.obst?.keys||[])]);}
function prepare(d){
 const g=game(d),cover=H.coverOf(g.tiles,g.nb),prefix=new Set(d.solution.slice(0,d.solution.indexOf(d.clock.i)+1));
 const down=d.down.slice().sort((a,b)=>Number(prefix.has(b))-Number(prefix.has(a))||cover[b].length-cover[a].length||g.tiles[a].z-g.tiles[b].z||a-b).slice(0,Math.floor(d.tiles.length*POLICY.maxDown));
 return {...d,down,faces:d.faces.slice(),info:{...d.info}};
}
function tilePx(d){const xs=d.tiles.map(([x,y,z])=>x/2-z*.14),ys=d.tiles.map(([x,y,z])=>y/2*1.24-z*.14);return Math.min(384/(Math.max(...xs)+1-Math.min(...xs)+.125),592/(Math.max(...ys)+1.24-Math.min(...ys)+.16));}
function protectedBoard(d,before){
 for(const key of ['tiles','gold','obst','clock','solution'])if(JSON.stringify(d[key])!==JSON.stringify(before[key]))return false;
 if(d.down.some(i=>!before.down.includes(i))||d.down.length>Math.floor(d.tiles.length*POLICY.maxDown))return false;
 for(const i of frozen(before))if(d.faces[i]!==before.faces[i])return false;
 return H.validSolution(game(d),d.solution)&&tilePx(d)>=54-.001;
}
function quality(m){return m.reach>=POLICY.minClockReach&&m.clockLoss<=POLICY.maxClockLoss&&m.blindRate<=POLICY.maxBlind&&m.unknownShare<=POLICY.maxUnknown;}
function clockFits(d,level){const spare=d.clock.n-d.solution.indexOf(d.clock.i)-1;return H.clockSpare(level).includes(spare)&&d.clock.n<=(level<90?22:level<110?19:16);}
module.exports={POLICY,target,sample,frozen,prepare,tilePx,protectedBoard,quality,clockFits};
