'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const H = require('../www/hard'), L = require('../www/layouts');
const asGame = d => {
  const tiles = d.tiles.map(([x,y,z]) => ({x,y,z})), ob = d.obst;
  const down = new Uint8Array(tiles.length); d.down.forEach(i => down[i] = 1);
  return {tiles,nb:L.neighbors(tiles),faces:d.faces,down,clock:d.clock,
    rules:ob ? {iceNb:L.iceNeighbors(tiles),ice:ob.ice||{},locks:ob.keys&&ob.keys.length?new Set(ob.locks):null,keys:ob.keys||[]} : null};
};
module.exports = [
  {
    name: 'curve: approved strong checkpoints, interpolation and plateau agree in browser and builder',
    cpu: true,
    async run(t) {
      const points = [[75,0.7],[85,0.6],[100,0.45],[120,0.35],[150,0.3],[300,0.3]];
      points.forEach(([lv,q]) => t.eq(H.target(lv,'strong'),q,'strong target at '+lv));
      t.ok(Math.abs(H.target(80,'strong')-0.65)<1e-10,'interpolate between checkpoints');
      t.eq(H.target(74,'strong'),0.88,'earlier target preserved');
      const rules = vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../www/js/rules.js'),'utf8')+';RULES.hard');
      t.eq(JSON.parse(JSON.stringify(rules.strongCurve)),H.cfg().strongCurve,'browser and build use the approved curve');
      t.eq([rules.start,rules.end,rules.endLevel],[H.cfg().start,H.cfg().end,H.cfg().endLevel],'middle curve agrees too');
    },
  },
  {
    name: 'clock: proof replay checks deadlines per tile, the final allowed move, and tray safety',
    cpu: true,
    async run(t) {
      const tiles=[{x:0,y:0,z:0},{x:2,y:0,z:0}], nb=L.neighbors(tiles);
      const g={tiles,nb,faces:[1,1],clock:{i:1,n:1}};
      t.eq(H.validSolution(g,[0,1]),false,'clock cannot be taken one move late');
      t.eq(H.validSolution(g,[1,0]),true,'taking clock on the final allowed move works');
      t.eq(H.validSolution(g,[1,1]),false,'cannot take the same tile twice');
      const p={...H.persona('strong'),temp:0.01,tray:[0,100,200,300]};
      t.eq(H.play(g,p,1).why,'clock','a selected pair cannot jump over the deadline');
      t.eq(H.play({...g,clock:{i:1,n:2}},p,1).win,true,'the pair fits within two moves');
      const d=H.makeNow(83,1.6), game=asGame(d);
      t.ok(H.validSolution(game,d.solution),'designed clock has a complete legal solution');
      const base=d.solution.indexOf(d.clock.i)+1;
      t.ok(H.clockSpare(83).includes(d.clock.n-base),'deadline has only the early-level spare moves');
      const packed=H.unpack(83,H.pack(d));
      t.eq(packed.solution,d.solution,'witness survives packing');
      t.ok(H.validSolution(asGame(packed),packed.solution),'packed proof is still legal');
    },
  },
  {
    name: 'hard saves: old designs start fresh while the current design resumes',
    async run(t, {startLevel,sleep}) {
      const p=await t.phone({state:{name:'Dennis',pid:'test-save-curve',level:83,seenSp:{clock:1,ice:1,lock:1,gold:1,joker:1}}});
      await startLevel(p,83);
      await p.evaluate(()=>{G.mv=2;saveCur();});
      await p.evaluate(()=>__mj.startLevel(83));
      t.eq(await p.evaluate(()=>G.mv),2,'same design resumes the move count');
      await p.evaluate(()=>{const c=JSON.parse(localStorage.getItem(CUR));c.hv=Hard.GENV-1;localStorage.setItem(CUR,JSON.stringify(c));__mj.startLevel(83);});
      t.eq(await p.evaluate(()=>G.mv),0,'previous design cannot restore an old clock');
    },
  },
];
