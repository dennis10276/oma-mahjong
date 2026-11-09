'use strict';
// These are G6's seven original checks, not evidence that its advertised
// controls have causal effects. The audit tests that separately.
const fs=require('fs'),path=require('path');
const {loadOriginal,localRequire}=require('./load_original.js'),PB=loadOriginal();
const archivedRequire=name=>name==='./puzzle_balance.js'?PB:localRequire(name);
new Function('require',fs.readFileSync(path.join(__dirname,'test_puzzle_balance.js.txt'),'utf8'))(archivedRequire);
