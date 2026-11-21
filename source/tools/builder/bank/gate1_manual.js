'use strict';
process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),D=require('./detower'),P=require('./finish_all_sources'),T=require('./shape_bench_tools'),Q=require('./towers_proof');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/'+(process.env.FINISH_GATE==='2'?'gate2':'gate1'));
function manual(level,config){const before=P.original(config.source||level),d=structuredClone(before.design),keep=d.tiles.map((_,i)=>i);if(config.user){const j=JSON.parse(fs.readFileSync(path.resolve(__dirname,`../../../../../codex-tasks/results/narrow-251-299/placements-4/level-${level}.json`)));if(j.erased?.length)throw Error('Restore erased IDs first');d.tiles=j.positions.map(p=>p.slice());}
 for(const[id,p]of Object.entries(config.at||{}))d.tiles[+id]=p;
 const r={level,source:config.source||level,design:d,keep,config,method:config.note||'rebuild original trap support courses',shape:T.geometry(d),ok:false};console.log(level,r.shape);if(r.shape.ok){const route=D.route(d);if(route){d.solution=route;r.certificate=Q.certify(before,d,keep);r.ok=r.certificate.ok;}else r.why='no strict full win';}console.log(r.ok,r.certificate?.errors||r.why);fs.writeFileSync(path.join(OUT,`manual-${level}.json`),JSON.stringify(r,null,1));if(r.ok)fs.writeFileSync(path.join(OUT,`level-${level}.json`),JSON.stringify(r,null,1));return r;}
if(require.main===module)manual(+process.argv[2],JSON.parse(process.argv[3]));module.exports={manual};
