'use strict';
const fs=require('fs'),path=require('path'),{createRequire}=require('module');
function loadOriginal(name){
 const filename=path.join(__dirname,name),relative=createRequire(filename),module={exports:{}};
 const requireOriginal=id=>id.startsWith('./')&&fs.existsSync(path.join(__dirname,id+'.txt'))?loadOriginal(id.slice(2)):relative(id);
 new Function('require','module','exports','__filename','__dirname',fs.readFileSync(filename+'.txt','utf8'))(requireOriginal,module,module.exports,filename,__dirname);
 return module.exports;
}
module.exports={loadOriginal};
