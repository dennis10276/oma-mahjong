'use strict';
// Tuning siblings belong to one intended level. They never become extra levels.
const fs = require('fs'), path = require('path');
const I = require('../lab/ideas.js'), L = global.Layouts;
const { roomProfile } = require('./design_traps.js');
const { checkOrigin } = require('./originality.js');
const { boardKey, atomicJson } = require('./meter.js');
function variants(rows, dir) {
  const out = new Map(rows.map(r => [r.id, r]));
  for (const r of rows) {
    if (checkOrigin(r)) throw Error('Only fresh designs may enter this tuner');
    const d = r.design, route = d.solution.indexOf(d.clock.i) + 1;
    const add = (design, edit) => {
      const id = boardKey(design).slice(0, 16); if (out.has(id) || !I.valid(design)) return;
      const room = roomProfile(design); if (!room.ok || room.unrelieved > 1) return;
      out.set(id, { ...r, id, design, room, edit });
    };
    const qualityFile = path.join(dir, r.id + '.quality.json');
    const quality = fs.existsSync(qualityFile) ? JSON.parse(fs.readFileSync(qualityFile)) : null;
    if (quality?.idle?.some(k => k !== 'clock')) {
      const obst = { ...d.obst };
      if (quality.idle.includes('ice')) obst.ice = {};
      if (quality.idle.includes('locks')) { obst.locks = []; obst.keys = []; }
      add({ ...d, obst }, 'removed measured idle specials: ' + quality.idle.join(', '));
    }
    // Do not recursively multiply every tuning sibling. Start from its fresh
    // deal, then use actual feedback to decide whether more edits are useful.
    if (r.edit) continue;
    for (const spare of [1, 2, 3]) add({ ...d, clock: { ...d.clock, n: route + spare } }, 'clock spare ' + spare);
    const file = path.join(dir, r.id + '.screen.json');
    const rateFile = path.join(dir, r.id + '.rate.json');
    const rate = fs.existsSync(rateFile) ? JSON.parse(fs.readFileSync(rateFile)) : null;
    // Once the full family measurement exists, it supersedes the noisy scout
    // when deciding whether to hide or reveal pictures. Acceptance is unchanged.
    const exp = rate?.train?.valid ? rate.validation?.valid ? (rate.train.exp + rate.validation.exp) / 2 : rate.train.exp :
      fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)).exp : null;
    if (exp == null || exp < r.target - 4) continue;
    const tiles = d.tiles.map(([x, y, z]) => ({ x, y, z })), nb = L.neighbors(tiles), alive = new Uint8Array(tiles.length).fill(1);
    const special = new Set([d.clock.i, ...(d.obst.keys || []), ...(d.obst.locks || []), ...Object.keys(d.obst.ice || {}).map(Number)]);
    const hidden = new Set(d.down), harder = exp < r.target;
    const choices = harder ? tiles.map((_, i) => i).filter(i => !special.has(i) && !hidden.has(i) && !L.isFree(i, alive, nb)) : d.down;
    const amounts = harder ? [1, 2, 4, 6, 8, 12] : [1, 2, 4, 6, 8, 12, 16, 20];
    for (let k = 0; k < amounts.length; k++) {
      const n = amounts[k], rng = L.rng(parseInt(r.id.slice(0, 6), 16) + k * 1777);
      const selected = new Set(L.shuffleArr(rng, choices.slice()).slice(0, n));
      const down = harder ? d.down.concat([...selected]) : d.down.filter(i => !selected.has(i));
      if (down.length > d.tiles.length / 2) continue;
      add({ ...d, down, clock: { ...d.clock, n: route + 1 + k % 3 } }, (harder ? 'hide ' : 'reveal ') + selected.size + ' covered pictures');
    }
  }
  return [...out.values()];
}
module.exports = { variants };
if (require.main === module) {
  const rows = variants(JSON.parse(fs.readFileSync(process.argv[2])), process.argv[3]);
  atomicJson(process.argv[4], rows); console.log(rows.length, 'tuning candidates, each confined to its own fresh level');
}
