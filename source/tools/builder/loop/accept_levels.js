#!/usr/bin/env node
'use strict';
// Offline acceptance of a fixed assignment. Never writes the game or chooses a replacement puzzle.
const fs = require('fs'), path = require('path');
const L = require('./library.js'), GP = require('./gate_profile.js'), Policy = require('./policy.js');
const CF = require('./counterfactual.js'), TR = require('./traces.js'), Y = require('./yardstick.js');
const ROOT = path.resolve(__dirname, '../../../..');
const VERSION = 'level-acceptance-v1';
const validRating = (r, fp) => r?.valid === true && r.fingerprint === fp && Number.isFinite(r.D) && Number.isFinite(r.se) && r.se >= 0 && r.n >= 160;
const sha = GP.digest;
function preflight(plan, entries, opts, ys) {
  const [from, to] = plan.range || [];
  if (!Number.isInteger(from) || from < 250 || !Number.isInteger(to) || to < from) throw Error('Plan must cover an integer range starting at 250 or later');
  if (plan.levels?.length !== to - from + 1) throw Error('Plan must list every slot, including holes');
  const keys = new Set(), byKey = new Map(entries.map(e => [e.key, e]));
  const slots = plan.levels.slice().sort((a, b) => a.level - b.level);
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s.level !== from + i) throw Error('Plan has a missing or repeated level');
    if (s.hole) continue;
    const e = byKey.get(s.key);
    if (!e || e.key !== L.contentKey(e.design)) throw Error('Missing or altered library puzzle at ' + s.level);
    if (!e.shipSpares?.includes(s.spare)) throw Error('Spare was not eligible in the library at ' + s.level);
    if (keys.has(s.key)) throw Error('Plan reuses a puzzle');
    keys.add(s.key);
    if (!Number.isFinite(s.target) || Math.abs(s.target - Policy.familyTarget(s.level)) > 0.0051) throw Error('Plan target differs from approved curve at ' + s.level);
    if (s.skilledFallback && opts.skilledMin >= 2.5) throw Error('Plan needs explicit skilled minimum-2 fallback mode');
  }
  if (!ys?.fingerprint || !ys.pins?.planner?.fingerprint) throw Error('Acceptance needs pinned family and planner fingerprints');
  return { slots, byKey };
}
function checkLevel(slot, entry, opts, deps, profile) {
  const { ys } = deps, target = Policy.familyTarget(slot.level);
  const out = { level: slot.level, key: slot.key, spare: slot.spare, story: entry.tags?.story ?? null, target, status: 'unresolved', reasons: [], checks: {} };
  const stop = (reason, status = 'unresolved') => { out.reasons.push(reason); out.status = status; return out; };
  if (target > 16) return stop('measurementLimit: targets above 16 need a validated higher-range measure');
  if (entry.gateProfile?.fingerprint !== profile.fingerprint) return stop('gateProfileMismatch: rebuild or requalify this candidate under the selected profile');
  if (entry.fingerprints?.family !== ys.fingerprint || entry.fingerprints?.planner !== ys.pins.planner.fingerprint) return stop('rulerMismatch');
  const at = deps.atSpare(entry.design, slot.spare);
  if (at.fail) return stop('invalidSpare: ' + at.fail, 'refused');
  const d = at.design;
  out.designHash = sha(d); out.clockN = d.clock?.n ?? null;
  const sg = GP.applyStatic(deps.staticGates(d, { story: entry.tags?.story, stopEarly: true }), profile);
  out.checks.static = sg;
  if (sg.warnings?.some(w => /^wallClock/.test(w))) return stop('staticWallClock');
  if (!sg.pass) return stop('staticGates', profile.static.required.some(g => sg.gates?.[g]?.pass === false) ? 'refused' : 'unresolved');
  if (GP.unresolvedStatic(sg, profile, {spare:slot.spare}).length) return stop('staticProofIncomplete');
  const allowed = sg.gates?.A4?.detail?.okSpares || sg.shipSpares || [];
  if (!allowed.includes(slot.spare) || (sg.gates?.A8?.flag && slot.spare < 2)) return stop('staticSpareMismatch', 'refused');
  const traces = deps.traceGates(d, GP.traceOptions({ spare: null, ys, campaigns: 80, secondAct: !!entry.tags?.secondAct }, profile));
  out.checks.traces = traces;
  if (traces.fail || profile.traces.required.some(g => traces[g]?.pass === false)) return stop('traceGates', 'refused');
  if (profile.traces.required.some(g => traces[g]?.pass !== true)) return stop('traceProofIncomplete');
  if (traces.B7?.maxTarget != null && target > traces.B7.maxTarget) return stop('repeatInflatedTarget', 'refused');
  const c1 = deps.c1(d, { spare: null, ys }); out.checks.C1 = c1;
  if (c1?.pass !== true) return stop('C1', c1?.pass === false ? 'refused' : 'unresolved');
  // S and face-up sanity are checked at the actual chosen clock budget, not spare 2.
  const c23 = deps.c2c3(d, { ys, plannerSpare: slot.spare });
  out.checks.C2 = c23?.C2 ?? null; out.checks.C3 = c23?.C3 ?? null;
  const S = c23?.C2?.asIs;
  if (c23?.C2?.pass !== true || c23.C2.valid !== true || c23.C2.fingerprint !== ys.pins.planner.fingerprint || !Number.isFinite(S)) return stop('skilledRatingUntrusted');
  out.S = S; out.skilledFallback = S < 2.5;
  if (S < opts.skilledMin || S > 6) return stop('skilledOutsideBand', 'refused');
  const accepted = ys.accept(d, target, 1, { note: VERSION + ':L' + slot.level }); out.checks.accept = accepted;
  if (accepted.fingerprint !== ys.fingerprint || !Number.isFinite(accepted.D) || !Number.isFinite(accepted.se) || accepted.n < 160) return stop('invalidAcceptanceRating');
  if (accepted.decision !== 'accept' || Math.abs(accepted.D - target) > 1) return stop('acceptDifficulty', accepted.decision === 'invalid' ? 'unresolved' : 'refused');
  // A separate, ledger-reserved ACCEPT block checks the selected level on independent seeds.
  const campaigns = 160, blocks = campaigns / ys.pins.blocks.ACCEPT.blockCampaigns;
  const key = Y.puzzleKey(d), start = ys.ledger.nextBlock(key);
  const reservation = ys.ledger.reserve(key, start, start + blocks, { purpose: 'independent-check-and-specials', level: slot.level, fingerprint: ys.fingerprint });
  out.independentBlocks = [start, start + blocks];
  const independent = ys.rate(d, { block: 'ACCEPT', campaigns, startBlock: start }); out.checks.independent = independent;
  if (!validRating(independent, ys.fingerprint)) {
    ys.ledger.finish(key, reservation, { decision: 'invalid' }); return stop('invalidIndependentRating');
  }
  if (Math.abs(independent.D - target) > 1) {
    ys.ledger.finish(key, reservation, { decision: 'refuse', D: independent.D }); return stop('independentDifficulty', 'refused');
  }
  // Use the independent baseline with the very same seeds for all ablations; no selection follows this check.
  const c4 = deps.c4(d, { spare: null, ys, accepted: independent, campaigns, startBlock: start, per: 'kind' }); out.checks.C4 = c4;
  ys.ledger.finish(key, reservation, { decision: c4?.pass === true ? 'accept' : c4?.pass === false ? 'refuse' : 'unresolved', D: independent.D });
  if (c4?.pass !== true || c4.fingerprint !== ys.fingerprint) return stop('specialAblation', c4?.pass === false ? 'refused' : 'unresolved');
  const expected = CF.specialVariants(d, 'kind').map(v => v.special).sort();
  if (JSON.stringify((c4.specials || []).map(v => v.special).sort()) !== JSON.stringify(expected) || c4.specials.some(v => v.pass !== true || v.valid !== true)) return stop('specialProofIncomplete');
  out.D = accepted.D; out.independentD = independent.D; out.status = 'accepted';
  return out;
}
function summarize(slots, results, entries, context = []) {
  const currentSlots = slots, currentResults = results, from = slots[0].level, history = [];
  for (let level = Math.max(250, from - 4); level < from; level++) {
    const c = context.find(r => r.level === level), T = Policy.familyTarget(level);
    const valid = c?.status === 'accepted' && Number.isFinite(c.D) && Number.isFinite(c.independentD) && c.S >= 2 && c.S <= 6 &&
      Math.abs(c.D - T) <= 1 && Math.abs(c.independentD - T) <= 1;
    history.push(valid ? { ...c, target: T } : { level, status: 'missingContext' });
  }
  slots = [...history, ...slots]; results = [...history, ...results];
  const byLevel = new Map(results.map(r => [r.level, r])), windows = [], conflicts = [];
  const byKey = new Map(entries.map(e => [e.key, e]));
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i], r = byLevel.get(s.level), e = byKey.get(s.key);
    if (s.level < from || r?.status !== 'accepted') continue;
    if (e.tags?.bigBoard && s.level % 10 !== 0) conflicts.push({ level: s.level, rule: 'bigBoardOffSlot' });
    for (let j = Math.max(0, i - 4); j < i; j++) {
      const p = slots[j];
      if (byLevel.get(p.level)?.status !== 'accepted') continue;
      if (s.spare === 1 && p.spare === 1) conflicts.push({ level: s.level, rule: 'spare1Spacing' });
      if (i - j < 3 && e.tags?.story != null && (byKey.get(p.key)?.tags?.story ?? p.story) === e.tags.story) conflicts.push({ level: s.level, rule: 'storySpacing' });
    }
  }
  for (let i = 0; i + 5 <= slots.length; i++) {
    const part = slots.slice(i, i + 5).map(s => byLevel.get(s.level)), complete = part.every(r => r?.status === 'accepted');
    const meanDev = complete ? part.reduce((n, r) => n + r.D - r.target, 0) / 5 : null;
    const independentMeanDev = complete ? part.reduce((n, r) => n + r.independentD - r.target, 0) / 5 : null;
    windows.push({ from: slots[i].level, to: slots[i + 4].level, complete, meanDev, independentMeanDev,
      pass: complete && Math.abs(meanDev) <= 0.5 + 1e-9 && Math.abs(independentMeanDev) <= 0.5 + 1e-9 });
  }
  const counts = currentResults.reduce((o, r) => { o[r.status] = (o[r.status] || 0) + 1; return o; }, {});
  const cpuS = currentResults.reduce((n, r) => n + (r.cpuS || 0), 0), wallS = currentResults.reduce((n, r) => n + (r.wallS || 0), 0);
  const missingContext = history.filter(r => r.status !== 'accepted').map(r => r.level);
  return { counts, windows, conflicts, missingContext, cpuS, wallS, cpuPerAcceptedLevel: counts.accepted ? cpuS / counts.accepted : null,
    cpuNote: 'Acceptance-stage process CPU only; add build/pipeline costs separately. Accepted rows can still fail the batch window rules.',
    readyForReview: currentResults.length === currentSlots.length && currentResults.every(r => r.status === 'accepted') && !missingContext.length && !conflicts.length && windows.every(w => w.pass),
    fallbackLevels: currentResults.filter(r => r.status === 'accepted' && r.skilledFallback).map(r => r.level),
    note: 'Accepted levels are offline evidence for Dennis to review, not authorization to publish.' };
}
function acceptLevels(plan, entries, optsIn = {}, depsIn = {}) {
  const opts = { gateProfile: 'e5-v1', skilledMin: 2.5, maxMinutes: 18, ...optsIn };
  Policy.assertSkilledOptions({ lo: opts.skilledMin });
  if (!(Number.isFinite(opts.maxMinutes) && opts.maxMinutes > 0)) throw Error('maxMinutes must be positive and finite');
  const ys = depsIn.ys || CF.rulerYardstick();
  const deps = { ys, staticGates: require('./static_gates.js').staticGates, traceGates: TR.traceGates, atSpare: TR.atSpare, c1: CF.c1, c2c3: CF.c2c3, c4: CF.c4, ...depsIn };
  const profile = GP.loadProfile(opts.gateProfile), { slots, byKey } = preflight(plan, entries, opts, ys);
  const code = require('./run_pipeline.js').codeFingerprints();
  code['accept_levels.js'] = sha(fs.readFileSync(__filename, 'utf8'));
  const binding = { version: VERSION, plan: sha(plan), entries: slots.filter(s => !s.hole).map(s => [s.key, sha(byKey.get(s.key))]), profile: profile.fingerprint,
    pins: sha(ys.pins), family: ys.fingerprint, planner: ys.pins.planner.fingerprint, skilledMin: opts.skilledMin, code };
  const id = sha(binding), checkpoint = opts.checkpoint ? path.resolve(opts.checkpoint) : null;
  let state = checkpoint && fs.existsSync(checkpoint) ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')) : { schema: VERSION, id, binding, profile, results: [] };
  if (state.id !== id) throw Error('Checkpoint belongs to a different plan, library, code, profile or ruler');
  const save = () => { if (checkpoint) { fs.mkdirSync(path.dirname(checkpoint), { recursive: true }); require('../../factory/meter.js').atomicJson(checkpoint, state); } };
  const t0 = Date.now();
  for (const s of slots) {
    if (state.results.some(r => r.level === s.level)) continue;
    if (Date.now() - t0 >= opts.maxMinutes * 60000) break;
    const started = { level: s.level, key: s.key ?? null, status: 'interrupted', reasons: ['Previous run did not finish this level; no automatic seed retry'] };
    state.results.push(started); save(); // reserve the attempt before any bot work
    let result; const c0 = process.cpuUsage(), w0 = Date.now();
    try { result = s.hole ? { level: s.level, status: 'hole', reasons: ['No assigned puzzle'] } : checkLevel(s, byKey.get(s.key), opts, deps, profile); }
    catch (e) { result = { level: s.level, key: s.key, status: 'unresolved', reasons: ['toolError: ' + String(e.message || e)] }; }
    const cpu = process.cpuUsage(c0); result.cpuS = (cpu.user + cpu.system) / 1e6; result.wallS = (Date.now() - w0) / 1000;
    state.results[state.results.length - 1] = result;
    state.summary = summarize(slots, state.results, entries, plan.context); save();
    deps.log?.(`Level ${s.level}: ${result.status}${result.reasons.length ? ' (' + result.reasons.join(', ') + ')' : ''}`);
  }
  state.summary = summarize(slots, state.results, entries, plan.context); state.pending = slots.filter(s => !state.results.some(r => r.level === s.level)).map(s => s.level);
  state.measured = Object.fromEntries(state.results.filter(r => r.status === 'accepted').map(r => [r.key + ':' + r.spare,
    { D: r.D, se: r.checks.accept.se, n: r.checks.accept.n, source: 'ACCEPT', target: r.target, independentD: r.independentD,
      fingerprint: ys.fingerprint, gateProfile: profile.fingerprint }]));
  save();
  return state;
}
function main() {
  const a = {}; for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) a[process.argv[i].slice(2)] = process.argv[++i];
  if (!a.plan || !a.out) throw Error('Usage: heavy.js --label accept -- node accept_levels.js --plan assignment.json --lib directory --out acceptance.json [--skilled-min 2] [--gate-profile e5-v1|strict-v1] [--max-minutes 18]');
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'source/build/heavy.lock/owner.json'), 'utf8'));
  if (lock.pid !== process.ppid) throw Error('Launch acceptance through heavy.js');
  const lib = L.createLibrary({ dir: a.lib });
  const entries = lib.entries(); if (lib.damaged.length) throw Error('Library contains damaged lines');
  const ys = CF.rulerYardstick();
  const out = acceptLevels(JSON.parse(fs.readFileSync(a.plan, 'utf8')), entries, { checkpoint: a.out, gateProfile: a['gate-profile'] || 'e5-v1', skilledMin: +(a['skilled-min'] || 2.5), maxMinutes: +(a['max-minutes'] || 18) }, { ys, log: console.log });
  console.log(JSON.stringify({ pending: out.pending, ...out.summary }, null, 2));
}
if (require.main === module) main();
module.exports = { acceptLevels, checkLevel, summarize, preflight, VERSION };
