'use strict';
// Tuning siblings belong to one creation. They never become extra originals.
const fs = require('fs'), path = require('path');
const I = require('../lab/ideas.js'), L = global.Layouts;
const { roomProfile } = require('./design_traps.js');
const { checkOrigin } = require('./originality.js');
const { boardKey, atomicJson } = require('./meter.js');
const Placement = require('./placement_score.js');
const Composer = require('./trap_composer.js');
const stripped = new Map();
const ICE_REWRITE={frozenGuards:['clockRoute'],iceChain:['clockRoute'],blindTwins:[],trayJuggleFrozen:['trayJuggle'],
  iceLockClock:['clockBesideLock'],chainReaction:['lockedClock'],frozenKey:['clockOnTopLocked'],
  keyGuardIce:[],partnerRelay:[],thawRelay:[],midgameRelay:[]};
const LOCK_REWRITE={lockedClock:['clockRoute'],keysAcross:[],deepKeys:[],lockedPartners:[],clockOnTopLocked:['clockRoute'],
  iceLockClock:['frozenClock'],chainReaction:['frozenDig'],trayJuggleLocked:['trayJuggle'],keyToEscape:['dontGrab'],
  frozenKey:['frozenDig'],clockBesideLock:['clockRoute']};
function remainingRecipe(recipe,removed){let out=recipe.slice();for(const kind of removed){const map=kind==='ice'?ICE_REWRITE:LOCK_REWRITE;
  out=out.flatMap(k=>map[k]||[k]);}return [...new Set(out.length?out:['clockRoute'])];}
function variants(rows, dir) {
  const out = new Map(rows.map(r => [r.id, r]));
  for (const r of rows) {
    if (checkOrigin(r)) throw Error('Only fresh designs may enter this tuner');
    if (r.factoryKeep) continue;
    const d = r.design, route = d.solution.indexOf(d.clock.i) + 1;
    const add = (design, edit, metadata = {}) => {
      const id = boardKey(design).slice(0, 16); if (out.has(id) || !I.valid(design)) return;
      if (r.playerFeedback && !Placement.readable(design)) return;
      const room = roomProfile(design); if (!room.ok || room.unrelieved > 1) return;
      out.set(id, { ...r, ...metadata, id, design, room, edit });
    };
    const qualityFile = path.join(dir, r.id + '.quality.json');
    const quality = fs.existsSync(qualityFile) ? JSON.parse(fs.readFileSync(qualityFile)) : null;
    if (quality?.idle?.some(k => k !== 'clock') && !r.preserveSpecialKinds) {
      const obst = { ...d.obst };
      if (quality.idle.includes('ice')) obst.ice = {};
      if (quality.idle.includes('locks')) { obst.locks = []; obst.keys = []; }
      const removed=quality.idle.filter(k=>k!=='clock');
      if(!r.playerFeedback) add({ ...d, obst }, 'removed measured idle specials: ' + quality.idle.join(', '));
      else if(!r.preserveSpecialKinds){
        const spare=d.clock.n-route,key=JSON.stringify([r.id,removed.slice().sort(),spare,d.trapObjectives||[],r.recipe]);
        if(!stripped.has(key)){
          const candidate={...d,obst,trapObjectives:(d.trapObjectives||[]).filter(g=>obst.ice?.[g.tile])};
          const fixed=I.withSearchBudget(Date.now()+350,()=>I.fix({...candidate,clock:{...candidate.clock,n:999}},spare));
          stripped.set(key,fixed);
        }
        const fixed=stripped.get(key);
        if(fixed){const recipe=remainingRecipe(r.recipe,removed),roles=new Set([fixed.clock.i,...(obst.keys||[]),...(obst.locks||[]),...Object.keys(obst.ice||{}).map(Number)]);
          const steps=(r.trapPlan?.steps||[]).flatMap(step=>remainingRecipe([step.recipe],removed).map(k=>({...step,recipe:k,
            addedSpecials:(step.addedSpecials||[]).filter(i=>roles.has(i))}))).filter(s=>s.addedSpecials.length);
          add(fixed,'removed idle components and re-authored exact clock: '+removed.join(','),{recipe,
            simplifiedFrom:r.recipe,brief:'Re-authored after removing idle '+removed.join('/')+': '+recipe.join(' + '),placementScore:Placement.score(fixed,recipe,r.shape),
            trapPlan:{...(r.trapPlan||{}),authoredBoard:null,steps,analysis:Composer.analyze(fixed)}});
        }
      }
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
module.exports = { variants, remainingRecipe };
if (require.main === module) {
  const rows = variants(JSON.parse(fs.readFileSync(process.argv[2])), process.argv[3]);
  atomicJson(process.argv[4], rows); console.log(rows.length, 'tuning candidates, each confined to its own fresh creation');
}
