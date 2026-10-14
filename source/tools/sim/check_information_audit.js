/* Checks for audit code only; production game and release files are untouched. */
'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),L=require('../../www/layouts'),H=require('../../www/hard');
const A=require('./audit_information'),guarantee=require('./audit_guaranteed');
const checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS '+name);}
const simple={level:0,tiles:[[0,0,0],[4,0,0]],faces:[0,0],down:[],gold:[],obst:null,clock:null,solution:[0,1]};
check('Uncovered known pair gets a verified certificate',()=>{
 const r=A.search(simple,100);assert.equal(r.status,'certificate');assert.equal(A.verify(simple,r.actions).valid,true);
});
check('Unknown free peeks and automatic pair are replayed correctly',()=>{
 const d={...simple,down:[0,1]},r=A.search(d,100),v=A.verify(d,r.actions);assert.equal(v.removals,2);assert.equal(v.inspections,2);assert.equal(v.chosen,0);
});
check('Verifier rejects a deliberate unidentified tap',()=>{
 const d={...simple,down:[0,1]};assert.throws(()=>A.verify(d,[{i:0,kind:'choose-known',removed:[]}]));
});
check('Verifier rejects an incomplete winning claim',()=>assert.throws(()=>A.verify(simple,[])));
// Two physically identical piles of height five. Top faces are A and B in BOTH
// worlds, everything else is face-down. World 0 only wins when B is taken first;
// world 1 only wins when A is taken first. The player cannot distinguish them yet.
const tiles=Array.from({length:10},(_,i)=>[i<5?0:4,0,i%5]);
const f0=[0,1,2,3,0,2,4,3,4,1],f1=[1,0,2,3,0,3,2,4,4,1];
const nb=L.neighbors(tiles.map(([x,y,z])=>({x,y,z}))),all=new Uint8Array(10).fill(1);
const fixture={level:0,tiles,faces:f0,down:[0,1,2,3,5,6,7,8],gold:[],obst:null,clock:null,solution:L.solve(tiles.map(([x,y,z])=>({x,y,z})),nb,f0,all,[],10000)};
check('Exact information search detects a real indistinguishable-world guessing trap',()=>{
 const r=guarantee(fixture,{worldFaces:[f1],worldCount:2});assert.equal(r.worldCount,2);assert.equal(r.win,false);assert.equal(r.beliefCapped,false);
 for(const w of r.worlds)assert.equal(H.validSolution({...require('./tighten_clocks').game(fixture),faces:w.faces},w.witness),true);
});
check('A computation limit is inconclusive, not evidence of guessing',()=>{
 const r=guarantee(fixture,{worldFaces:[f1],worldCount:2,beliefLimit:0});assert.equal(r.win,null);assert.equal(r.status,'inconclusive');
});
check('Every recorded optimistic certificate verifies independently',()=>{
 const T=A.readTable('www/levels-hard.js'),report=require('../../analysis/information-audit-all-face-up.json');
 for(const r of report.rows)if(r.actions){const d=H.unpack(r.lv,T.levels[r.lv-T.from]);assert.equal(A.hash(JSON.stringify(T.levels[r.lv-T.from])),r.boardHash);assert.equal(A.verify(d,r.actions,'all-face-up').valid,true);}
});
check('Game sources still match the pre-audit hashes',()=>{
 const r=require('../../analysis/information-audit-uncovered.json');for(const [f,h] of Object.entries(r.hashes))assert.equal(A.hash(fs.readFileSync(path.resolve(__dirname,'../..',f))),h,f);
});
fs.writeFileSync(path.resolve(__dirname,'../../analysis/information-audit-checks.json'),JSON.stringify({passed:checks.length,checks,gameChanged:false},null,2)+'\n');
