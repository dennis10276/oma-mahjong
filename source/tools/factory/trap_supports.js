'use strict';
// A useful main trap must not hide an idle supporting trap in a group ablation.
const { MOTIFS } = require('./trap_composer.js');
const { digest } = require('./meter.js');
const VERSION = 'support-ablations-v2';
const ICE = new Set([...Object.keys(MOTIFS), 'frozenGuards', 'trayJuggleFrozen', 'iceChain']);
const LOCKS = new Set(['lockedPartners', 'trayJuggleLocked']);
function checks(row) {
  const components=(row.trapPlan?.components||[]).filter(c=>['ice','locks'].includes(c.kind)).map((c,index)=>({
    name:c.name||'component@'+index,recipe:c.recipe||c.name||'component',kind:c.kind,
    ...(c.recipe==='midgameRelay'?{phase:'afterClockBefore60Percent',minimumAfterClock:3}:{}),
    indices:[...new Set(c.indices||[])].sort((a,b)=>a-b)}));
  const result = components.concat((row.trapPlan?.steps || []).flatMap((step, index) => {
    if (step.placement !== 'extend existing roles') return [];
    const kind = ICE.has(step.recipe) ? 'ice' : LOCKS.has(step.recipe) ? 'locks' : null;
    return kind ? [{ name: step.recipe + '@' + index, recipe: step.recipe, kind,
      ...(step.recipe==='midgameRelay'?{phase:'afterClockBefore60Percent',minimumAfterClock:3}:{}),
      indices: [...new Set(step.addedSpecials || [])].sort((a, b) => a - b) }] : [];
  }));
  const seen=new Set();
  const unique=result.filter(c=>{const key=c.kind+'|'+c.indices.join(',')+'|'+(c.phase||'');if(seen.has(key))return false;seen.add(key);return true;});
  for (const key of new Set(row.recipe || [])) if (MOTIFS[key] && !result.some(x => x.recipe === key))
    unique.push({ name: key + '@untracked', recipe: key, kind: 'ice', indices: [] });
  return unique;
}
function fingerprint(row) { const list = checks(row); return list.length || row.playerFeedback
  ? digest({ version: VERSION, checks: list, playerFeedback: !!row.playerFeedback }) : null; }
function compatible(row, quality) {
  if (!quality) return false;
  if ((quality.skilledEvidenceFingerprint ?? null) !== require('./skilled_evidence.js').fingerprint(row)) return false;
  const expected = fingerprint(row); return !expected || quality.supportFingerprint === expected;
}
function measure(row, baseline, meter, settings) {
  const supportFingerprint = fingerprint(row); if (!supportFingerprint) return {};
  const supports = {};
  const list=checks(row);let checked=0;
  for (const check of list) {
    checked++;
    const b = row.design, ids = new Set(check.indices);
    const present = ids.size > 0 && [...ids].every(i => check.kind === 'ice' ? b.obst?.ice?.[i] > 0 : b.obst?.locks?.includes(i))&&
      (!check.phase||[...ids].every(i=>require('./trap_composer.js').relayPhase(b,i).ok));
    if (!present) { supports[check.name] = { kind: check.kind, indices: check.indices, present: false, matters: false }; break; }
    const obst = { ...b.obst, ...(check.kind === 'ice'
      ? { ice: Object.fromEntries(Object.entries(b.obst.ice).filter(([i]) => !ids.has(+i))) }
      : { locks: b.obst.locks.filter(i => !ids.has(i)) }) };
    const m = meter.measure({ ...b, obst }, settings);
    supports[check.name] = { kind: check.kind, indices: check.indices, present: true,
      without: m.expectedTries, first: m.firstTryRate, valid: m.valid,
      matters: baseline.valid && m.valid && (Math.abs(baseline.expectedTries - m.expectedTries) >= .3 || Math.abs(baseline.firstTryRate - m.firstTryRate) >= .15) };
    if(!supports[check.name].matters)break;
  }
  return { supportFingerprint, supports,...(checked<list.length?{uncheckedSupports:list.slice(checked).map(c=>c.name)}:{}) };
}
module.exports = { VERSION, checks, fingerprint, compatible, measure };
