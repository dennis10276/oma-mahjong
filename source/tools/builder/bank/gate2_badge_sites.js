'use strict';
const D=require('./detower'),SR=require(D.CF+'../chained_special_readability'),{boxOf}=require(D.CF+'../shown');
const rect=(d,i,kind)=>kind==='key'?[-.04,-.0744,.2636,.2292]:kind==='lock'?(d.obst.ice[i]?[-.04,-.0744,.2636,.2292]:[.6308,.868,1.04,1.2772]):d.obst.ice[i]>1?[.5576,.9916,.98,1.2028]:[.65,.8728,.98,1.2028];
function guard(before,d,keep){const regions=SR.measure(before.design).rows.filter(r=>r.clear).map(r=>{const i=keep.indexOf(r.tile),b=boxOf(d.tiles[i]),q=rect(d,i,r.kind);return{i,box:b,region:{l:b.l+q[0],t:b.t+q[1],r:b.l+q[2],b:b.t+q[3]}};});return p=>{const b=boxOf(p);return regions.every(q=>p.join()===d.tiles[q.i].join()||b.order<=q.box.order||SR.exposed(q.region,[{...b,r:b.l+1.15,b:b.t+1.42}])>=.65);};}
module.exports={guard};
