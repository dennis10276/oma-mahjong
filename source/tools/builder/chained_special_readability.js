'use strict';
// Task 18 lab feedback: a sliver of overlay is not a readable special. Measure
// the actual CSS badge position, including higher tiles' drawn sides. This is
// a board acceptance rule, never a change to how the game draws its tiles.
const {boxOf}=require('./shown.js');
function exposed(region,covers){
  let parts=[region];
  for(const c of covers){const next=[];for(const p of parts){
    const l=Math.max(p.l,c.l),r=Math.min(p.r,c.r),t=Math.max(p.t,c.t),b=Math.min(p.b,c.b);
    if(l>=r||t>=b){next.push(p);continue;}
    if(p.l<l)next.push({...p,r:l});if(r<p.r)next.push({...p,l:r});
    if(p.t<t)next.push({l,r,t:p.t,b:t});if(b<p.b)next.push({l,r,t:b,b:p.b});
  }parts=next;}
  return +(parts.reduce((n,p)=>n+(p.r-p.l)*(p.b-p.t),0)/((region.r-region.l)*(region.b-region.t))).toFixed(4);
}
function measure(d){
  const boxes=d.tiles.map(boxOf),rows=[];
  const add=(i,kind,rect)=>{const a=boxes[i],region={l:a.l+rect[0],t:a.t+rect[1],r:a.l+rect[2],b:a.t+rect[3]};
    const covers=boxes.filter((b,j)=>j!==i&&b.order>a.order).map(b=>({...b,r:b.l+1.15,b:b.t+1.42}));
    const shown=exposed(region,covers);rows.push({tile:i,kind,shown,clear:shown>=.65&&!d.down.includes(i)});
  };
  for(const [key,need]of Object.entries(d.obst.ice||{}))add(+key,'ice',need>1?[.5576,.9916,.98,1.2028]:[.65,.8728,.98,1.2028]);
  for(const i of d.obst.locks||[])add(i,'lock',d.obst.ice[i]?[-.04,-.0744,.2636,.2292]:[.6308,.868,1.04,1.2772]);
  for(const i of d.obst.keys||[])add(i,'key',[-.04,-.0744,.2636,.2292]);
  return {profile:'clear-specials-v1',ok:rows.every(r=>r.clear),rows};
}
module.exports={measure,exposed};
