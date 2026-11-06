'use strict';const {test}=require('node:test'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const F=require('./pressure_frame.js'),I=require('../lab/ideas.js');
test('frame placement realizes the declared grid or fails without mutating its neutral base',()=>{
 const base=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../analysis/factory/piece-bases.json')))[0].design,before=JSON.stringify(base);
 const board=F.construct(base,{depth:2,share:.1,spare:1},419,{milliseconds:1500});assert(board,'A shallow frame fits the neutral frame layout');
 assert.equal(JSON.stringify(base),before);assert(I.valid(board));assert.deepEqual(board.tiles,base.tiles);
 assert.equal(F.describe(board).depth,2);assert(Math.abs(F.describe(board).share-.1)<=.035);assert.equal(F.describe(board).spare,1);assert.equal(board.clockMate,undefined);assert.deepEqual(board.faces,base.faces);
 const grade=F.grade(board,3);assert(I.valid(grade));assert.deepEqual(grade.faces,board.faces);assert.deepEqual(grade.solution,board.solution);assert.equal(grade.clock.i,board.clock.i);assert.equal(grade.clock.n-board.clock.n,2);
 const E=require('./frame_experiment.js'),P=require('./pieces.js'),M=require('./meter.js'),replaced=E.apply(base,board,{name:'clock',params:{depth:2,spare:3}},419,{milliseconds:1500});assert(replaced);assert.equal(M.boardKey(P.remove(replaced,replaced.pieceInstances[0].id)),M.boardKey(board),'Turning off a frame-coordinate treatment restores the measured frame, not the calm board');
 assert.throws(()=>F.construct(board,{depth:0,share:.1,spare:1}),/neutral/);assert.throws(()=>F.construct(base,{depth:7,share:.1,spare:1}),/grid/);
});
