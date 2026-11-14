'use strict';
const B=require('./builder.js'),{shownAll}=require('./shown.js');
function keyRoof(d){
  const c=B.context(d.tiles),shown=shownAll(c.tiles),rows=d.obst.keys.flatMap(key=>[...c.above[key]].filter(i=>d.obst.ice[i]).map(roof=>({key,roof,keyShown:shown[key],roofShown:shown[roof]})));
  return {rows,keyShown:rows.length?Math.min(...rows.map(r=>r.keyShown)):0,roofShown:rows.length?Math.min(...rows.map(r=>r.roofShown)):0};
}
module.exports={keyRoof};
