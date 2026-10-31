'use strict';
// Stable factory entry point. Earlier dual-setting research calls remain in
// human_style_measure.js; this interface always measures one named setting.
const measure=require('./human_style_measure.js').measureHuman;
const { critique } = require('./human_critic.js');
const VERSION=require('./human_release.js').version;
function measureHuman(board,options={}){return measure(board,{setting:'dennis',...options});}
module.exports={measureHuman,critique,VERSION};
if(require.main===module){const fs=require('fs');const board=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));process.stdout.write(JSON.stringify(measureHuman(board,{runs:Number(process.argv[3]??20),setting:process.argv[4]??'dennis'}),null,2)+'\n');}
