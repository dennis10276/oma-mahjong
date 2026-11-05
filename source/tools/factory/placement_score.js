'use strict';
// Dennis's round-2 feedback is an authoring preference, not a difficulty model.
const I = require('../lab/ideas.js'), L = global.Layouts;
const {boardOf,digest}=require('./meter.js');
const VERSION = 'dennis-round2-v1';
const trayPuzzle = recipe => (recipe || []).some(k => k === 'trayJuggleFrozen' || k === 'trayJuggleLocked');
const preferredSpare = brief => trayPuzzle(brief.recipe) ? 1 : (brief.spare ?? 2);
const clamp = x => Math.max(0, Math.min(1, x));
const round = x => +x.toFixed(3);
function patternKey(d){const b=boardOf(d);return digest({tiles:b.tiles,faces:b.faces,down:b.down,clockTile:b.clock?.i});}
function slotAllows(row,slot){return slot.big===(row.design.tiles.length>88)&&
  (row.origin?.intendedLevel==null||row.origin.intendedLevel===slot.level)&&
  (!slot.keepId||slot.keepId===row.id)&&(!slot.keepPattern||slot.keepPattern===patternKey(row.design));}
function routeTiles(d, analysis) {
  const c = I.ctxOf(d), targets = [d.clock?.i, ...(d.obst?.keys || [])].filter(Number.isInteger);
  const end = Math.max(0,...targets.map(i=>c.pos[i]+1),...(analysis?.phaseGoals||[]).map(g=>g.availableMove||0));
  return new Set([...d.solution.slice(0, end), ...(analysis?.needed || []), ...targets]);
}
function prepare(d, analysis, protectedHidden = []) {
  const route = routeTiles(d, analysis), authored = new Set(protectedHidden);
  const markers = new Set([d.clock?.i, ...(d.obst?.keys || []), ...(d.obst?.locks || []), ...Object.keys(d.obst?.ice || {}).map(Number)]);
  if (protectedHidden.some(i => markers.has(i))) return { reason: 'authored memory conflicts with visible specials' };
  const authoredOnRoute = d.down.filter(i => authored.has(i) && route.has(i));
  if (authoredOnRoute.length > 1) return { reason: 'authored blind dig exceeds one hidden route tile' };
  const keep = authoredOnRoute[0] ?? d.down.find(i => route.has(i) && !markers.has(i));
  const revealed = d.down.filter(i => markers.has(i) || route.has(i) && i !== keep);
  return { design: { ...d, down: d.down.filter(i => !revealed.includes(i)) }, revealed };
}
function readable(d) {
  const a = require('./trap_composer.js').analyze(d), path = routeTiles(d,a), hidden = new Set(d.down);
  const markers = [d.clock?.i,...(d.obst?.keys||[]),...(d.obst?.locks||[])].filter(Number.isInteger);
  return (a.phaseGoals||[]).every(g=>g.ok)&&[...path].filter(i=>hidden.has(i)).length <= 1 && markers.every(i=>!hidden.has(i));
}
function temptation(d, c, route) {
  if (!d.clock) return { found: false, kind: null, indices: [], provedWrong: false };
  const alive = new Uint8Array(c.n).fill(1), initial = alive.slice(), hidden = new Set(d.down);
  const o = d.obst || {}, rules = { ice: o.ice || {}, iceNb: c.inb, locks: new Set(o.locks || []), keys: o.keys || [] };
  const prefix = d.solution.slice(0, route), prefixSet = new Set(prefix);
  for (let step = 0; step < Math.min(prefix.length, 16); step++) {
    if (d.clockMate !== undefined && !hidden.has(d.clock.i) && L.takeable(d.clock.i, alive, c.nb, rules, initial))
      return { found: true, kind: 'free clock with waiting partner', indices: [d.clock.i], atMove: step, provedWrong: false };
    const faces = new Map();
    for (let i = 0; i < c.n; i++) if (!hidden.has(i) && !(o.keys || []).includes(i) && i !== d.clock.i && L.takeable(i, alive, c.nb, rules, initial)) {
      const mate = faces.get(d.faces[i]);
      if (mate !== undefined && (!prefixSet.has(i) || !prefixSet.has(mate)))
        return { found: true, kind: 'visible pair off the stored shortest clock route', indices: [mate, i], atMove: step, provedWrong: false };
      faces.set(d.faces[i], i);
    }
    alive[prefix[step]] = 0;
  }
  return { found: false, kind: null, indices: [], provedWrong: false };
}
function score(d, recipe = [], shape = '', analysis) {
  analysis ||= require('./trap_composer.js').analyze(d);
  const c = I.ctxOf(d), o = d.obst || {}, hidden = new Set(d.down), keys = o.keys || [], locks = o.locks || [];
  const ice = Object.keys(o.ice || {}).map(Number), markers = [...new Set([d.clock?.i, ...keys, ...locks, ...ice].filter(Number.isInteger))];
  // A lock stops constraining play when the keys match, not when its now-normal
  // tile happens to be taken in a solver tail. Likewise ice resolves at thaw.
  const keysDone = keys.length ? Math.max(...keys.map(i=>c.pos[i]+1)) : null;
  const events = [ ...(d.clock ? [{kind:'clock',tile:d.clock.i,move:c.pos[d.clock.i]+1}] : []),
    ...keys.map(i=>({kind:'key',tile:i,move:c.pos[i]+1})),
    ...locks.map(i=>({kind:'unlock',tile:i,move:keysDone ?? c.pos[i]+1})),
    ...ice.map(i=>{const order=c.inb[i].map(j=>c.pos[j]+1).sort((a,b)=>a-b);
      return {kind:'thaw',tile:i,move:order[o.ice[i]-1] ?? c.n};}) ];
  const decisive = events.map(e => clamp(e.move / c.n));
  const late = decisive.filter(x => x > .6).length / Math.max(1, decisive.length);
  const outside = decisive.reduce((s, x) => s + Math.max(.15 - x, x - .6, 0), 0) / Math.max(1, decisive.length);
  const timing = markers.length ? 30 * clamp(1 - 2 * outside - .6 * late) : 0;
  const faceUp = i => !hidden.has(i), visible = i => faceUp(i) && c.top[i];
  const signposts = locks.length ? locks : ice;
  const signpostShare = signposts.length ? signposts.filter(visible).length / signposts.length : 1;
  const path = routeTiles(d, analysis), blind = [...path].filter(i => hidden.has(i));
  const wayVisible = 1 - blind.length / Math.max(1, path.size);
  const clarity = (d.clock ? visible(d.clock.i) ? 8 : faceUp(d.clock.i) ? 4 : 0 : 0) +
    8 * signpostShare + (keys.every(faceUp) ? 5 : 0) + 4 * wayVisible;
  const information = blind.length === 0 ? 20 : Math.max(0, 17 - 5 * (blind.length - 1));
  const route = d.clock ? d.solution.indexOf(d.clock.i) + 1 : 0, spare = d.clock ? d.clock.n - route : null;
  const clock = !d.clock || spare < 1 || spare > 3 ? 0 : trayPuzzle(recipe) ? [0,15,8,4][spare] : [0,14,15,10][spare];
  const lure = temptation(d, c, route), tempting = lure.found ? 5 : 0;
  const base = shape.split(' · ')[0], readableShape = /^blob|^block/.test(base) ? 0 :
    shape.includes('two islands') ? base === 'castle' ? 2 : 4 : 5;
  const components = Object.fromEntries(Object.entries({ timing, clarity, information, clock, temptation: tempting, shape: readableShape }).map(([k,v]) => [k,round(v)]));
  return { version: VERSION, total: round(Object.values(components).reduce((s,x) => s+x,0)), components,
    facts: { decisiveFrom: decisive.length ? round(Math.min(...decisive)) : null,
      decisiveTo: decisive.length ? round(Math.max(...decisive)) : null, decisiveLateShare: round(late), decisiveEvents:events,
      clockFaceUp: d.clock ? faceUp(d.clock.i) : false, clockUncovered: d.clock ? c.top[d.clock.i] : false,
      visibleMarkerShare: round(signpostShare), hiddenKeys: keys.filter(i => hidden.has(i)),
      hiddenRouteTiles: blind, route, spare, trayPuzzle: trayPuzzle(recipe), temptation: lure } };
}
module.exports = { VERSION, preferredSpare, patternKey, slotAllows, routeTiles, prepare, readable, score };
