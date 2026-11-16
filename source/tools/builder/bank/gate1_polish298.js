'use strict';
process.env.MECH='1';process.env.NARROW_TRAP='core';
const fs=require('fs'),path=require('path'),D=require('./detower'),P=require('./finish_all_sources'),Q=require('./towers_proof'),T=require('./shape_bench_tools');
const OUT=path.resolve(__dirname,'../../../analysis/builder/finish-all/gate1'),r=JSON.parse(fs.readFileSync(path.join(OUT,'stagger-298-final-candidate.json'))),d=r.design;
for(const id of[15,16,56,19,20,43])d.tiles[r.keep.indexOf(id)][1]++;
const route=D.route(d);if(!route)throw Error('No winning route');d.solution=route;
r.certificate=Q.certify(P.original(298),d,r.keep);r.shape=T.geometry(d);r.ok=r.certificate.ok;r.method+='; move the right key porch one half-row inward so its marker stays readable';console.log(r.shape,r.certificate.errors);
fs.writeFileSync(path.join(OUT,'polish-298-candidate.json'),JSON.stringify(r,null,1));if(r.ok)fs.writeFileSync(path.join(OUT,'level-298.json'),JSON.stringify(r,null,1));
