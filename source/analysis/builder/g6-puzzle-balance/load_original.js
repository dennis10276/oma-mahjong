'use strict';
// Research reproduction only. Preserve G6's source without exposing its
// unimplemented control or proof claims through the builder API.
const fs=require('fs'),path=require('path'),{createRequire}=require('module');
const virtualPath=path.resolve(__dirname,'../../../tools/builder/puzzle_balance.js');
const localRequire=createRequire(virtualPath);
function loadOriginal(){
 const module={exports:{}};
 const source=fs.readFileSync(path.join(__dirname,'puzzle_balance.js.txt'),'utf8');
 new Function('require','module','exports',source)(localRequire,module,module.exports);
 return module.exports;
}
module.exports={loadOriginal,localRequire};
