'use strict';
const Q=require('./finish_all_mechanics');
module.exports={...Q,certify:(before,d,keep,prepared)=>Q.certify(before,d,keep,prepared,{tenth:true})};
