'use strict';
process.env.FINISH_GATE='2';
const fs=require('fs'),path=require('path'),P=require('./finish_all_sources'),D=require('./detower'),E=require(D.CF+'../engine');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate2'),lv=+process.argv[2],kind=process.argv[3],id=+process.argv[4],a=structuredClone(P.original(lv).design);
a.clock.n=99;if(kind==='ice')delete a.obst.ice[id];else a.obst.locks=a.obst.locks.filter(i=>i!==id);
const force=process.argv[5]==null?null:+process.argv[5];let w;
if(force==null)w=E.clockShortest(E.game(a),{nodes:1000000,ms:10000});else{a.clock.n=+process.argv[6];const g=E.game(a),s=E.step(g,E.start(g),force),r=E.winnable(g,s,{nodes:2000000,ms:20000});if(r.result==='win')w={k:a.clock.n,path:[force,...r.path]};}
if(!w||w.unsure)throw Error('Unresolved source counterfactual');
const flat=E.flatten(w.path),prefix=flat.slice(0,flat.indexOf(a.clock.i)+1),file=path.join(OUT,`${lv}-${kind}-${id}-counter.json`);fs.writeFileSync(file,JSON.stringify({level:lv,kind,id,k:w.k,path:w.path,prefix},null,1));console.log(file,'k',w.k,'prefix',prefix);
