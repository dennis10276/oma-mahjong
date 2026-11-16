'use strict';
/* trap_offers.js: the tempting wrong moves on the way to the clock, priced exactly (engine, no bots). Claude 2026-11-16.
   Walks the stored route up to the clock; at every step each tempting move (detour.js: ready pair, tray match, single whose twin
   is in sight) is priced with clockNeed. It "bites" when the clock can no longer be taken in time (need > clock.n) or the board is lost.
     offers(design) -> { k, spare, specialsOnRoute, tempting, biting, trapMoments, firstBite, costs: ['L' | clock moves too late], unknown } */
const E = require('../engine.js'), D = require('../loop/detour.js');
function offers(d, o = {}) {
  const ob = d.obst || {}, C = D.clockGames(d), g = C.at(d.clock.n), N = d.clock.n, w = D.work(o.nodes ?? 4e6, o.wallMs ?? 240000);
  const sp = new Set([...(ob.locks || []), ...(ob.keys || []), ...Object.keys(ob.ice || {}).map(Number)]);
  const ci = d.solution.findIndex(x => x === d.clock.i || (Array.isArray(x) && x.includes(d.clock.i)));
  let s = E.start(g), onRoute = 0; const steps = [], bit = new Set(), all = new Set();
  for (let m = 0; m <= ci && s; m++) {
    const row = { m, bites: [] };
    for (const t of D.temptingMoves(C.free, s, { singles: true })) {
      const key = t.take.slice().sort((x, y) => x - y).join('+'); if (bit.has(key)) continue; all.add(key);
      const p = D.priceMove(C, s, t, { nShipMax: Math.min(N + 6, 24), nodes: 60000, w });
      const bite = p.result === 'lose' || (p.need != null && p.need > N);
      if (bite) bit.add(key);
      if (bite || p.result === 'unknown') row.bites.push({ take: t.take, kind: t.kind, res: p.result, late: p.need != null ? p.need - N : null, bite });
    }
    steps.push(row);
    const act = d.solution[m]; for (const i of (Array.isArray(act) ? act : [act])) if (sp.has(i)) onRoute++;
    s = E.step(g, s, act);
  }
  const b = steps.flatMap(r => r.bites.filter(x => x.bite));
  return { k: ci + 1, spare: N - ci - 1, specialsOnRoute: onRoute, tempting: all.size, biting: b.length,
    trapMoments: steps.filter(r => r.bites.some(x => x.bite)).length, firstBite: (steps.find(r => r.bites.some(x => x.bite)) || {}).m ?? null,
    costs: b.map(x => x.res === 'lose' ? 'L' : x.late), unknown: steps.flatMap(r => r.bites.filter(x => !x.bite)).length, routeOk: !!s, budget: w.hit };
}
module.exports = { offers };
