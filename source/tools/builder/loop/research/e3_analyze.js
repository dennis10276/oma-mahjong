#!/usr/bin/env node
// E3 analysis (no bots): reads source/build/e3/e3-ratings.*.jsonl, writes process-v1/e3-noise.json (the .md is written by hand from it).
'use strict';
const fs = require('fs'), path = require('path');
const WT = path.resolve(__dirname, '../../../../..'), SRC = path.join(WT, 'source'), DIR = path.join(SRC, 'build/e3');
const OUTD = path.join(SRC, 'analysis/builder/process-v1');
const CAP = 20;
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const vari = a => { const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); };
const sum = a => a.reduce((s, x) => s + x, 0);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r3 = x => x == null ? null : Math.round(x * 1000) / 1000;

// capped geometric model: X = min(G, 20), E X = D
function capModel(D) {
  D = Math.min(Math.max(D, 1.0001), CAP - 1e-6);
  let lo = 1e-6, hi = 1;
  const E = p => { const qq = 1 - p; return (1 - Math.pow(qq, CAP)) / p; };
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (E(m) > D) lo = m; else hi = m; }
  const p = (lo + hi) / 2, qq = 1 - p;
  let ex2 = 0; for (let k = 1; k <= CAP; k++) ex2 += (2 * k - 1) * Math.pow(qq, k - 1);
  return { p, sd: Math.sqrt(Math.max(0, ex2 - D * D)) };
}
const sdModel = D => capModel(D).sd;

// ---- load
const rows = [];
for (const f of fs.readdirSync(DIR).filter(f => /^e3-ratings\.\d+\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(DIR, f), 'utf8').trim().split('\n').filter(Boolean)) rows.push(JSON.parse(l));
const boards = JSON.parse(fs.readFileSync(path.join(DIR, 'e3-boards.json'), 'utf8'));
const cellsMap = new Map(); const fails = [];
for (const r of rows) {
  if (r.fail) { fails.push(r); continue; }
  const k = r.b + '|' + r.spare; if (!cellsMap.has(k)) cellsMap.set(k, { b: r.b, spare: r.spare, blocks: [], valid: true, dDiff: 0 });
  const c = cellsMap.get(k); c.blocks[r.block] = r.per; if (!r.valid) c.valid = false;
  c.dDiff = Math.max(c.dDiff, Math.abs(r.D - mean(r.per)));
}
const allCells = [...cellsMap.values()];
const complete = allCells.filter(c => c.blocks.length === 8 && c.blocks.every(x => x && x.length === 40));
const cells = complete.filter(c => c.valid);
const byBoard = new Map(); for (const c of cells) { if (!byBoard.has(c.b)) byBoard.set(c.b, {}); byBoard.get(c.b)[c.spare] = c; }
const pairedBoards = [...byBoard.entries()].filter(([, v]) => v[2] && v[3]).map(([b, v]) => ({ b, c2: v[2], c3: v[3] }));
for (const c of cells) { c.all = c.blocks.flat(); c.D = mean(c.all); c.bm = c.blocks.map(mean); }
const bandOf = D => D < 4 ? '3-4' : D < 6 ? '4-6' : D < 9 ? '6-9' : D < 13 ? '9-13' : '13+';
const BANDS = ['3-4', '4-6', '6-9', '9-13', '13+'];
for (const c of cells) c.band = bandOf(c.D);

let seed = 20261107; const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
function bootRatio(units, num, den, B = 2000) {
  const est = us => sum(us.map(num)) / sum(us.map(den));
  const pt = est(units), vals = [];
  const byB = new Map(); for (const u of units) { if (!byB.has(u.b)) byB.set(u.b, []); byB.get(u.b).push(u); }
  const keys = [...byB.keys()];
  for (let i = 0; i < B; i++) { const us = []; for (let j = 0; j < keys.length; j++) us.push(...byB.get(keys[Math.floor(rnd() * keys.length)])); vals.push(est(us)); }
  return { value: r3(pt), lo: r3(q(vals, 0.025)), hi: r3(q(vals, 0.975)) };
}

const out = { generated: new Date().toISOString().slice(0, 10), seeds: { seed0: 7000003, step: 15838, blocks: 8, blockCampaigns: 40 },
  coverage: { boards: boards.length, ratings: rows.length, cellsComplete: complete.length, cellsValidComplete: cells.length, failRows: fails.length,
    maxAbsDvsMean: r3(Math.max(0, ...allCells.map(c => c.dDiff))), pairedBoards: pairedBoards.length } };

// ---- 1. between-block vs within-block variance
for (const c of cells) {
  c.vw = mean(c.blocks.map(vari)) / 40;
  c.vb = vari(c.bm);
  c.vmodel = sdModel(c.D) ** 2 / 40;
}
const sec1 = { pooledRatio: bootRatio(cells, c => c.vb, c => c.vw), pooledRatioVsCappedModel: bootRatio(cells, c => c.vb, c => c.vmodel),
  perCellRatioMedian: r3(q(cells.map(c => c.vb / c.vw), 0.5)), perCellRatioMean: r3(mean(cells.map(c => c.vb / c.vw))), cells: cells.length, byBand: {}, bySpare: {} };
for (const b of BANDS) { const u = cells.filter(c => c.band === b); if (u.length >= 3) sec1.byBand[b] = { cells: u.length, ...bootRatio(u, c => c.vb, c => c.vw, 800) }; }
for (const s of [2, 3]) { const u = cells.filter(c => c.spare === s); sec1.bySpare[s] = { cells: u.length, ...bootRatio(u, c => c.vb, c => c.vw, 800) }; }
{
  const c2 = cells.filter(c => c.spare === 2), z2 = [];
  for (let j = 0; j < 8; j++) z2.push(mean(c2.map(c => (c.bm[j] - c.D) / Math.sqrt(c.vw))));
  sec1.commonBlockEffectSpare2 = { cells: c2.length, meanZPerBlock: z2.map(r3), sdOfMeanZ: r3(Math.sqrt(vari(z2))), expectedIfIndependent: r3(Math.sqrt((7 / 8) / c2.length)),
    note: 'z = (block mean - cell mean)/sqrt(within-predicted var), averaged over the spare-2 cells (one per board) for each block seed. A lucky seed shared by all boards would give a large sd.' };
  const d = [];
  for (const c of cells) for (const bl of c.blocks) d.push((mean(bl.slice(0, 20)) - mean(bl.slice(20))) / Math.sqrt(vari(bl.slice(0, 20)) / 20 + vari(bl.slice(20)) / 20 || 1));
  sec1.subBlockHalves = { n: d.length, meanZ: r3(mean(d)), varZ: r3(vari(d)), note: 'z of (first 20 - last 20 campaigns) per block (the two meter sub-block seeds); mean near 0 and var near 1 mean the halves behave as independent equal samples.' };
}
out.sec1_betweenWithin = sec1;

// ---- 2. SE vs 1/sqrt(N)
{
  const res = {};
  for (const N of [1, 2, 4]) {
    const g = 8 / N; let vsum = 0, df = 0, lvsum = 0;
    const perBand = {};
    for (const c of cells) {
      const gm = []; for (let i = 0; i < g; i++) gm.push(mean(c.bm.slice(i * N, (i + 1) * N)));
      const v = vari(gm), lv = vari(gm.map(x => Math.log(x)));
      vsum += v * (g - 1); lvsum += lv * (g - 1); df += g - 1;
      const o = (perBand[c.band] = perBand[c.band] || { v: 0, lv: 0, df: 0 }); o.v += v * (g - 1); o.lv += lv * (g - 1); o.df += g - 1;
    }
    res[N] = { campaigns: 40 * N, rmsSE: r3(Math.sqrt(vsum / df)), rmsSElogD: r3(Math.sqrt(lvsum / df)), df,
      byBand: Object.fromEntries(Object.entries(perBand).map(([b, o]) => [b, { se: r3(Math.sqrt(o.v / o.df)), seLogD: r3(Math.sqrt(o.lv / o.df)) }])) };
  }
  const base = res[1].rmsSE;
  for (const N of [1, 2, 4]) { res[N].predictedFrom1BlockBy1overSqrtN = r3(base / Math.sqrt(N)); res[N].ratioObservedToPredicted = r3(res[N].rmsSE / (base / Math.sqrt(N)));
    res[N].cappedModelSE = r3(Math.sqrt(mean(cells.map(c => sdModel(c.D) ** 2 / (40 * N))))); res[N].withinBlockSE = r3(Math.sqrt(mean(cells.map(c => c.vw / N)))); }
  const xs = [1, 2, 4].map(Math.log), ys = [1, 2, 4].map(N => Math.log(res[N].rmsSE)), mx = mean(xs), my = mean(ys);
  const slope = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / sum(xs.map(x => (x - mx) ** 2));
  out.sec2_seScaling = { byN: res, logLogSlope: r3(slope), expectedSlope: -0.5,
    seTable: Object.fromEntries(BANDS.map(b => { const u = cells.filter(c => c.band === b); return [b, u.length ? { cells: u.length, meanD: r3(mean(u.map(c => c.D))), sdPerCampaign: r3(Math.sqrt(mean(u.map(c => mean(c.blocks.map(vari)))))), se40: r3(Math.sqrt(mean(u.map(c => c.vw)))),
      se80: r3(Math.sqrt(mean(u.map(c => c.vw / 2)))), se160: r3(Math.sqrt(mean(u.map(c => c.vw / 4)))), se320: r3(Math.sqrt(mean(u.map(c => c.vw / 8)))) } : null]; })) };
}

// ---- 3. paired vs unpaired steps (D at spare 2 minus D at spare 3, same board)
{
  const sec = { boards: pairedBoards.length };
  const per = [];
  for (const { b, c2, c3 } of pairedBoards) {
    const dP = c2.bm.map((x, j) => x - c3.bm[j]);
    const dU = c2.bm.map((x, j) => x - c3.bm[(j + 3) % 8]);
    const m2 = (c, i) => mean(c.bm.slice(2 * i, 2 * i + 2));
    const dP2 = [0, 1, 2, 3].map(i => m2(c2, i) - m2(c3, i));
    const dU2 = [0, 1, 2, 3].map(i => m2(c2, i) - m2(c3, (i + 1) % 4));
    const diff = c2.all.map((x, i) => x - c3.all[i]);
    per.push({ b, D2: r3(c2.D), D3: r3(c3.D), step: r3(c2.D - c3.D), vP40: vari(dP), vU40: vari(dU), vP80: vari(dP2), vU80: vari(dU2), cmpPaired: vari(diff) / 320, cmpUnpaired: (vari(c2.all) + vari(c3.all)) / 320,
      corr: (vari(c2.all) + vari(c3.all) - vari(diff)) / (2 * Math.sqrt(vari(c2.all) * vari(c3.all))), band: bandOf((c2.D + c3.D) / 2) });
  }
  const red = (num, den, units, B = 1500) => bootRatio(units, u => u[num], u => u[den], B);
  const fix = r => ({ ratioPairedOverUnpaired: r.value, reductionPct: r3((1 - r.value) * 100), reductionCI95Pct: [r3((1 - r.hi) * 100), r3((1 - r.lo) * 100)] });
  sec.blockLevel40 = fix(red('vP40', 'vU40', per)); sec.blockLevel80_CURVEsize = fix(red('vP80', 'vU80', per)); sec.campaignLevel320 = fix(red('cmpPaired', 'cmpUnpaired', per));
  sec.byBand = {};
  for (const b of BANDS) { const u = per.filter(p => p.band === b); if (u.length >= 3) sec.byBand[b] = { boards: u.length, campaignLevel: fix(red('cmpPaired', 'cmpUnpaired', u, 600)), block40: fix(red('vP40', 'vU40', u, 600)) }; }
  const mid = per.filter(p => (p.D2 + p.D3) / 2 >= 6 && (p.D2 + p.D3) / 2 <= 16);
  sec.midBand6to16 = { boards: mid.length, campaignLevel: fix(red('cmpPaired', 'cmpUnpaired', mid, 800)), block40: fix(red('vP40', 'vU40', mid, 800)), block80: fix(red('vP80', 'vU80', mid, 800)) };
  sec.meanCampaignCorrelation = r3(mean(per.map(p => p.corr)));
  sec.stepSE_tries = { paired_n40: r3(Math.sqrt(mean(per.map(p => p.vP40)))), unpaired_n40: r3(Math.sqrt(mean(per.map(p => p.vU40)))), paired_n80: r3(Math.sqrt(mean(per.map(p => p.vP80)))), unpaired_n80: r3(Math.sqrt(mean(per.map(p => p.vU80)))), paired_n320: r3(Math.sqrt(mean(per.map(p => p.cmpPaired)))), unpaired_n320: r3(Math.sqrt(mean(per.map(p => p.cmpUnpaired)))) };
  sec.steps = { medianStep_2minus3: r3(q(per.map(p => p.step), 0.5)), meanStep: r3(mean(per.map(p => p.step))), spare3EasierShare: r3(per.filter(p => p.step > 0).length / per.length) };
  sec.perBoard = per.map(p => ({ b: p.b, D2: p.D2, D3: p.D3, step: p.step, corr: r3(p.corr) }));
  out.sec3_paired = sec;
}

// ---- 4. spread vs sqrt(D(D-1)) and the capped model
{
  const rowsS = cells.map(c => { const sd = Math.sqrt(mean(c.blocks.map(vari))), g = Math.sqrt(c.D * (c.D - 1)), m = sdModel(c.D); return { b: c.b, spare: c.spare, D: r3(c.D), band: c.band, sd: r3(sd), geo: r3(g), cap: r3(m), rGeo: sd / g, rCap: sd / m, atCap: c.all.filter(x => x >= CAP).length / c.all.length }; });
  const byBand = {};
  for (const b of BANDS) { const u = rowsS.filter(r => r.band === b); if (u.length) byBand[b] = { cells: u.length, meanD: r3(mean(u.map(r => r.D))), obsSD: r3(mean(u.map(r => r.sd))), sqrtDD1: r3(mean(u.map(r => r.geo))), cappedGeo: r3(mean(u.map(r => r.cap))), ratioToSqrtDD1: r3(mean(u.map(r => r.rGeo))), ratioToCapped: r3(mean(u.map(r => r.rCap))), shareAtCap: r3(mean(u.map(r => r.atCap))) }; }
  const dev = rowsS.map(r => Math.abs(r.rGeo - 1)), devC = rowsS.map(r => Math.abs(r.rCap - 1));
  out.sec4_spread = { cells: rowsS.length, overallRatioToSqrtDD1: r3(mean(rowsS.map(r => r.rGeo))), overallRatioToCapped: r3(mean(rowsS.map(r => r.rCap))),
    cellsWithin30pctOfSqrtDD1: r3(dev.filter(d => d <= 0.3).length / dev.length), cellsWithin30pctOfCapped: r3(devC.filter(d => d <= 0.3).length / devC.length),
    ratioRangeSqrtDD1: [r3(Math.min(...rowsS.map(r => r.rGeo))), r3(Math.max(...rowsS.map(r => r.rGeo)))], ratioRangeCapped: [r3(Math.min(...rowsS.map(r => r.rCap))), r3(Math.max(...rowsS.map(r => r.rCap)))],
    byBand, worstCells: rowsS.slice().sort((a, b) => Math.abs(b.rCap - 1) - Math.abs(a.rCap - 1)).slice(0, 5).map(r => ({ b: r.b, spare: r.spare, D: r.D, obsSD: r.sd, cappedModel: r.cap })) };
}

// ---- 5. sequential rule, bootstrapping campaigns from each cell's pooled 320 (truth = that cell's mean)
const tolOf = T => Math.max(1, 0.1 * T);
function draw(c, n) { let s = 0; for (let i = 0; i < n; i++) s += c.all[Math.floor(rnd() * c.all.length)]; return s; }
function runRule(rule, c, T) {
  const tol = tolOf(T); const tot1 = draw(c, 160), D1 = tot1 / 160, gap1 = Math.abs(D1 - T);
  if (rule.kind === 'current') {
    if (gap1 <= 0.6 * tol) return { acc: true, n: 160 }; if (gap1 > 2.5 * tol) return { acc: false, n: 160 };
    const D2 = (tot1 + draw(c, 160)) / 320; return { acc: Math.abs(D2 - T) <= tol, n: 320 };
  }
  const se1 = sdModel(Math.min(CAP - 0.5, Math.max(1.5, D1))) / Math.sqrt(160);
  if (gap1 + rule.z * se1 <= tol) return { acc: true, n: 160 };
  if (gap1 - rule.z * se1 > tol) return { acc: false, n: 160 };
  const D2 = (tot1 + draw(c, 160)) / 320; const se2 = se1 / Math.SQRT2;
  if (rule.kind === 'z') return { acc: Math.abs(D2 - T) <= tol, n: 320 };
  if (rule.kind === 'z3') {
    const gap2 = Math.abs(D2 - T);
    if (gap2 + rule.z * se2 <= tol) return { acc: true, n: 320 };
    if (gap2 - rule.z * se2 > tol) return { acc: false, n: 320 };
    const D3 = (tot1 + draw(c, 160) + draw(c, 160)) / 480; return { acc: Math.abs(D3 - T) <= tol, n: 480 };
  }
  return { acc: Math.abs(D2 - T) + rule.zf * se2 <= tol, n: 320 };
}
const RULES = [{ name: 'current 0.6/2.5/1.0', kind: 'current' }, { name: 'z=0.5', kind: 'z', z: 0.5 }, { name: 'z=1.0', kind: 'z', z: 1 }, { name: 'z=1.5', kind: 'z', z: 1.5 }, { name: 'z=2.0', kind: 'z', z: 2 }, { name: 'z=1.0 up to 480', kind: 'z3', z: 1 }, { name: 'z=1.5 up to 480', kind: 'z3', z: 1.5 }, { name: 'z=2.0 final-0.5SE', kind: 'zfinal', z: 2, zf: 0.5 }];
{
  const REP = 60, deltas = [-3, -2, -1.5, -1.25, -1, -0.75, -0.5, 0, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  const res = {};
  const useCells = cells.filter(c => c.D >= 3 && c.D <= 16.5);
  const mk = () => ({ n: 0, accepted: 0, camp: 0, badAccept: 0, badN: 0, goodRefuse: 0, goodN: 0, stop160: 0 });
  for (const rule of RULES) {
    const all = mk(), byDelta = {}, byBand = {};
    for (const c of useCells) {
      const tol0 = tolOf(c.D);
      for (const d of deltas) {
        const T = c.D + d * tol0; if (T < 2) continue;
        const trueGap = Math.abs(c.D - T), tolT = tolOf(T);
        for (let r = 0; r < REP; r++) {
          const o = runRule(rule, c, T);
          for (const t of [all, (byBand[c.band] = byBand[c.band] || mk()), (byDelta[d] = byDelta[d] || mk())]) {
            t.n++; t.accepted += o.acc ? 1 : 0; t.camp += o.n; t.stop160 += o.n === 160 ? 1 : 0;
            if (trueGap >= 1.25 * tolT) { t.badN++; if (o.acc) t.badAccept++; }
            if (trueGap <= 0.75 * tolT) { t.goodN++; if (!o.acc) t.goodRefuse++; }
          }
        }
      }
    }
    const fmt = t => ({ n: t.n, acceptRate: r3(t.accepted / t.n), meanCampaigns: r3(t.camp / t.n), stoppedAt160: r3(t.stop160 / t.n), badAcceptRate_trueGapGE1p25tol: r3(t.badAccept / Math.max(1, t.badN)), goodRefuseRate_trueGapLE0p75tol: r3(t.goodRefuse / Math.max(1, t.goodN)) });
    res[rule.name] = { overall: fmt(all), byBand: Object.fromEntries(Object.entries(byBand).map(([b, t]) => [b, fmt(t)])),
      byDelta: Object.fromEntries(deltas.map(d => [d, { acceptRate: r3(byDelta[d].accepted / byDelta[d].n), meanCampaigns: r3(byDelta[d].camp / byDelta[d].n), stoppedAt160: r3(byDelta[d].stop160 / byDelta[d].n) }])) };
  }
  out.sec5_sequential = { method: 'Bootstrap from each cell\'s 320 pooled campaigns (the cell mean is the truth); targets T = truth + delta x tol; ' + REP + ' replicates per cell and delta; cells with D 3-16.5 (spare 2 and 3). Assumes iid campaigns, which sec1 tests.', rules: res, deltas, cellsUsed: useCells.length };
}

// ---- 5b. SCREEN z=3 check on real campaign sequences
{
  const looks = [5, 10, 15], z = 3; let seqs = 0, stops = 0; const detail = {};
  for (const c of cells) for (const bl of c.blocks) for (const half of [bl.slice(0, 20), bl.slice(20)]) {
    const sd = sdModel(c.D); seqs++;
    let st = false;
    for (const n of looks) if (Math.abs(mean(half.slice(0, n)) - c.D) > z * sd / Math.sqrt(n)) { st = true; break; }
    const o = (detail[c.band] = detail[c.band] || { seqs: 0, stops: 0 }); o.seqs++; if (st) { o.stops++; stops++; }
  }
  out.sec5b_screenZ3 = { sequences: seqs, falseStopRate: r3(stops / seqs), criterion: 0.02, byBand: Object.fromEntries(Object.entries(detail).map(([b, o]) => [b, { seqs: o.seqs, rate: r3(o.stops / o.seqs) }])),
    note: 'threshold = the cell\'s own mean (a board exactly at the threshold, both-sided), sd(t) from the capped geometric as in yardstick.json; truth is the 320-campaign mean (slightly biased toward fewer stops).' };
}

fs.mkdirSync(OUTD, { recursive: true });
fs.writeFileSync(path.join(OUTD, 'e3-noise.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, (k, v) => (k === 'perBoard' || k === 'byDelta' || k === 'worstCells') ? undefined : v));
