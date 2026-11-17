'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),dir=path.resolve(__dirname,'../build/test-assignment');fs.mkdirSync(dir,{recursive:true});
function solve(name,job){const input=path.join(dir,name+'.json'),output=path.join(dir,name+'-out.json');fs.writeFileSync(input,JSON.stringify({...job,seconds:5}));cp.execFileSync('python',[path.resolve(__dirname,'../tools/builder/bank/gate1_assignment_milp.py'),input,output],{windowsHide:true});const r=JSON.parse(fs.readFileSync(output));assert.equal(r.ok,true,JSON.stringify(r));return new Map(r.assignment);}
const three=[[0,0,0],[2,0,0],[1,0,1]];
assert.equal(solve('existing-free-down',{ids:[0,1,2],tiles:three,fixed:[[0,0],[1,1],[2,2]],original:three,faces:[0,1,1],down:[2],free:[2],oldFree:[2],oldDepth:[1,1,0],ranks:[],above:[[2],[2],[]],left:[[],[],[]],right:[[],[],[]],closeVisible:[]}).get(2),2);
const four=[[0,0,0],[2,0,0],[0,2,0],[2,2,0]],assignment=solve('ice-before-take',{ids:[0,1,2,3],tiles:four,fixed:[[0,0]],original:[four[0],four[2],four[3],four[1]],faces:[0,1,2,3],down:[],free:[0,1,2,3],oldFree:[0,1,2,3],oldDepth:[0,0,0,0],ranks:[[2,0,1,3]],iceOrders:[[0,1,[1]]],above:[[],[],[],[]],left:[[],[],[],[]],right:[[],[],[],[]],closeVisible:[]});
assert.ok([1,2].some(i=>assignment.get(i)===1),'a melting neighbor must precede the ice tile');
const masked=solve('pinned-special-masks',{ids:[0,1],tiles:four.slice(0,2),fixed:[],original:four.slice(0,2),faces:[0,1],down:[],free:[0,1],oldFree:[0,1],oldDepth:[0,0],ranks:[],above:[[],[]],left:[[],[]],right:[[],[]],closeVisible:[],allowedSites:{0:[1],1:[0]}});
assert.equal(masked.get(0),1);assert.equal(masked.get(1),0);
console.log('Existing free face-down identities are allowed; ice is melted before its ordered tap.');
