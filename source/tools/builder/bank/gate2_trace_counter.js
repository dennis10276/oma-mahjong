'use strict';
process.env.FINISH_GATE='2';
const fs=require('fs'),path=require('path'),P=require('./finish_all_sources'),D=require('./detower'),E=require(D.CF+'../engine');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate2');
const lv=+process.argv[2],mode=process.argv[3]||'wrong',id=+process.argv[4],n=+process.argv[5],r=JSON.parse(fs.readFileSync(path.join(OUT,`rebuild-${lv}-0-0-candidate.json`))),a=structuredClone(P.original(lv).design),d=structuredClone(r.design),mp=i=>r.keep.indexOf(i);
a.clock.n=d.clock.n=n;
if(mode==='ice'){delete a.obst.ice[id];delete d.obst.ice[mp(id)];}
if(mode==='lock'){a.obst.locks=a.obst.locks.filter(i=>i!==id);d.obst.locks=d.obst.locks.filter(i=>i!==mp(id));}
const g=E.game(d),old=E.game(a);let s=E.start(g),os=E.start(old),start=[];
if(mode==='wrong'){start=[mp(id)];s=E.step(g,s,mp(id));}
const w=E.winnable(g,s,{nodes:2000000,ms:20000});console.log('RESULT',lv,mode,id,n,w.result,w.nodes);
if(w.path){const acts=start.concat(w.path).map(act=>Number.isInteger(act)?r.keep[act]:{pair:act.pair.map(i=>r.keep[i])});console.log('PREFIX',E.flatten(acts).slice(0,E.flatten(acts).indexOf(a.clock.i)+1));for(const act of acts){try{const next=E.step(old,os,act);if(!next){console.log('OLD_LOSS',os.moves,act,'tray',os.tray);break;}os=next;}catch(e){const ids=Number.isInteger(act)?[act]:act.pair;console.log('FIRST_DIVERGENCE',os.moves,JSON.stringify(act),'tray',os.tray);for(const i of ids)console.log(JSON.stringify({id:i,face:a.faces[i],source:a.tiles[i],draft:d.tiles[mp(i)],above:old.nb.above[i].filter(k=>os.alive[k]),left:old.nb.left[i].filter(k=>os.alive[k]),right:old.nb.right[i].filter(k=>os.alive[k]),ice:old.iceNb[i].filter(k=>!os.alive[k])}));break;}}
fs.writeFileSync(path.join(OUT,`trace-${lv}-${mode}-${id}.json`),JSON.stringify({level:lv,mode,id,n,path:acts},null,1));}
