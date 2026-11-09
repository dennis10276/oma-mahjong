'use strict';
const fs=require('fs'),path=require('path');
const B=require('../../../tools/builder/builder.js'),E=require('../../../tools/builder/engine.js');
const L=require('../../../tools/builder/loop/library.js'),P=require('../../../tools/builder/loop/run_pipeline.js');
const {loadOriginal}=require('./load_original.js');
const owner=JSON.parse(fs.readFileSync('source/build/heavy.lock/owner.json'));if(owner.pid!==process.ppid)throw Error('Use heavy.js');
const out=path.join(__dirname,'lead-audit/integration.json');if(fs.existsSync(out))throw Error('Preserve prior integration audit');
const originals=fs.readFileSync(path.join(__dirname,'lead-audit/rows.jsonl'),'utf8').trim().split(/\r?\n/).map(JSON.parse);
const matching=['u-ice61','arch-keys7-59','castle-keys-s2'];
const recipes=JSON.parse(fs.readFileSync(path.join(__dirname,'explicit-recipes.json')));
const rows=recipes.map((brief,i)=>{
 const b=B.build(brief),old=originals.find(r=>r.id===matching[i]);if(!b.design)throw Error(b.fail);
 if(L.contentKey(b.design)!==old.key||b.design.clock.n!==old.design.clock.n)throw Error('Changed frozen recipe '+brief.id);
 if(!E.replay(b.design,b.design.solution,{strict:true}).ok)throw Error('Invalid strict witness');
 return {id:brief.id,key:old.key,clock:b.design.clock,minimum:b.proof.minimum,strictWitness:true,matchesFrozenRecipe:true};
});
const R=require('../../../tools/builder/row_cut.js');
const d={tiles:[[-20,-20,0],[-16,-20,0],...R.PATTERN.map(t=>t.slice()),[-10,-10,0]],faces:[1,1,0,1,2,1,3,0,4,3,2,4],down:[],obst:{},clock:{i:0,n:12},solution:[11,7,1,3,10,4,5,2,6,9,8,0]};
let originalFork;
try{originalFork={returned:loadOriginal('choke_fork.js').analyzeFork(d,3,0,1,2)};}
catch(e){originalFork={error:e.name,message:e.message};}
fs.writeFileSync(out,JSON.stringify({code:P.codeFingerprints(),rows,originalFork,note:'Exact recipe preservation and strict witness verification. No qualification or ACCEPT calls.'},null,2)+'\n');
console.log(JSON.stringify({recipes:rows.length,matches:true,originalFork}));
