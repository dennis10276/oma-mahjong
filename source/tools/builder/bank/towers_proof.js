'use strict';
// Task 23 is an additional gate on top of every Task 20 mechanic, never a
// substitute certificate or an adjustment of the clock number.
const D=require('./detower'),T=require('./shape_bench_tools'),Q=require(D.CF+'finish_ten_proof');
function certify(before,d,keep,prepared){
 const shape=T.geometry(d);
 if(!shape.ok)return{ok:false,errors:shape.errors.map(e=>'shape:'+e),shape,checks:[],policy:'Task 23 geometry + unchanged Task 20 mechanics'};
 const result=Q.certify(before,d,keep,prepared);
 return{...result,shape,checks:['zeroStraightTowers','supportedIntegerGrid','72to88Tiles','6.5Columns8Rows58px',...(result.checks||[])],policy:'Task 23 geometry + unchanged Task 20 mechanics'};
}
module.exports={certify};
