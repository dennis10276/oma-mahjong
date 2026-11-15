(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NarrowPlacement=factory();})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const overlap=(a,b)=>Math.abs(a[0]-b[0])<2&&Math.abs(a[1]-b[1])<2;
  function supported(tiles,p){if(!p[2])return true;for(const x of [p[0],p[0]+1])for(const y of [p[1],p[1]+1])if(!tiles.some(t=>t&&t[2]===p[2]-1&&t[0]<=x&&t[0]+2>x&&t[1]<=y&&t[1]+2>y))return false;return true;}
  function propose(positions,id,x,y,layer){
    const others=positions.filter((p,i)=>i!==id&&p);
    for(const z of layer==='auto'?[0,1,2,3,4,5,6,7]:[Number(layer)]){const p=[x,y,z];if(p.some(n=>!Number.isInteger(n)||n<0)||z>7)continue;if(others.some(t=>t[2]===z&&overlap(t,p))||!supported(others,p))continue;return p;}
    return null;
  }
  function footprint(positions){const t=positions.filter(Boolean);if(!t.length)return {tilePx:0,rows:0,ok:false};
    const l=Math.min(...t.map(p=>p[0]/2-p[2]*.14)),r=Math.max(...t.map(p=>p[0]/2-p[2]*.14+1)),top=Math.min(...t.map(p=>p[1]*.62-p[2]*.14)),bottom=Math.max(...t.map(p=>p[1]*.62-p[2]*.14+1.24));
    const w=388/(r-l+.125),den=bottom-top+.159,h=((579/den<w)?596:579)/den,px=Math.min(150,w,h),rows=(Math.max(...t.map(p=>p[1]))-Math.min(...t.map(p=>p[1])))/2+1;
    return {tilePx:px,rows,ok:px>=58&&rows<=8};
  }
  function initial(row){return {level:row.level,baseHash:row.baseHash,positions:row.base.tiles.map((p,i)=>row.problem.includes(i)?null:p.slice()),note:'',updatedAt:0};}
  function validate(row,input){
    if(!input||input.level!==row.level||input.baseHash!==row.baseHash)throw Error('This layout has changed. Reload the lab before saving.');
    if(!Array.isArray(input.positions)||input.positions.length!==row.base.tiles.length)throw Error('The tile list is incomplete.');
    for(const p of input.positions)if(p!==null&&(!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isInteger(v)||v<0||v>32)||p[2]>7))throw Error('Use the half-tile grid and a layer from 1 to 8.');
    return {level:row.level,baseHash:row.baseHash,positions:copy(input.positions),note:String(input.note||'').slice(0,4000),updatedAt:Date.now()};
  }
  const key=s=>JSON.stringify([s.baseHash,s.positions]);
  return {copy,overlap,supported,propose,footprint,initial,validate,key};
});
