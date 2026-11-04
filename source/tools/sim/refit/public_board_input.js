'use strict';
const assert=require('assert/strict'),Layouts=require('./physics/layouts.js');
const {encodeGame}=require('./personal_game_io.js');
function normalizeBoard(input){
 const board=Array.isArray(input.tiles)?input:input.game??input.board;
 assert(board&&Array.isArray(board.tiles)&&board.tiles.length>0);
 const packed=Array.isArray(board.tiles[0]);
 const tiles=Array.from(board.tiles,tile=>packed?{x:tile[0],y:tile[1],z:tile[2]}:{x:tile.x,y:tile.y,z:tile.z});
 const values=Array.from(board.down??[]),indices=packed||values.length!==tiles.length;
 if(indices)assert(values.every(i=>Number.isInteger(i)&&i>=0&&i<tiles.length));
 const faceDown=new Set(indices?values:[]),down=indices?tiles.map((_,i)=>+faceDown.has(i)):values;
 const obstacle=board.rules??board.obst,rows=values=>Array.from(values,row=>Array.from(row));
 const neighbors=board.nb?Object.fromEntries(['above','left','right'].map(name=>[name,rows(board.nb[name])])):Layouts.neighbors(tiles);
 const encoded=encodeGame({tiles,nb:neighbors,faces:board.faces,down,rules:obstacle?{ice:obstacle.ice??obstacle.need??{},
  iceNb:obstacle.iceNb?rows(obstacle.iceNb):Layouts.iceNeighbors(tiles),locks:obstacle.locks??null,keys:obstacle.keys??[]}:null,clock:board.clock??null});
 assert.deepEqual(encoded.nb,Layouts.neighbors(tiles),'Board neighbors must match production geometry');
 if(encoded.rules)assert.deepEqual(encoded.rules.iceNb,Layouts.iceNeighbors(tiles),'Ice neighbors must match production geometry');
 return encoded;
}
module.exports={normalizeBoard};
