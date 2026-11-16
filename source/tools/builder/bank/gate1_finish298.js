'use strict';
process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),D=require('./detower'),P=require('./finish_all_sources'),Q=require('./towers_proof'),T=require('./shape_bench_tools');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate1'),before=P.original(298),a=before.design,j=JSON.parse(fs.readFileSync(path.join(OUT,'stagger-298-partial.json'))),pos=j.pos;
// Three ordinary complete picture pairs leave; the remaining loose tile takes
// the vacated ordinary support spot. Special, bait and route pictures stay.
pos[80]=pos[24];pos[24]=null;
const keep=pos.map((p,i)=>p?i:null).filter(i=>i!=null),map=i=>keep.indexOf(i),d={...structuredClone(a),tiles:keep.map(i=>pos[i]),faces:keep.map(i=>a.faces[i]),down:a.down.filter(i=>keep.includes(i)).map(map),clock:{i:map(a.clock.i),n:a.clock.n},obst:{ice:Object.fromEntries(Object.entries(a.obst.ice).map(([i,h])=>[map(+i),h])),keys:a.obst.keys.map(map),locks:a.obst.locks.map(map)},solution:a.solution.filter(i=>keep.includes(i)).map(map)};
const route=D.route(d);if(!route)throw Error('No complete winning route');d.solution=route;
const certificate=Q.certify(before,d,keep),r={level:298,source:298,ok:certificate.ok,method:'Same lower trap with vertical brick support courses; three complete ordinary finish pairs removed',design:d,keep,certificate,shape:T.geometry(d),fixed:[54,71,75]};
console.log(r.shape,certificate.errors);fs.writeFileSync(path.join(OUT,'stagger-298-final-candidate.json'),JSON.stringify(r,null,1));if(r.ok)fs.writeFileSync(path.join(OUT,'level-298.json'),JSON.stringify(r,null,1));
