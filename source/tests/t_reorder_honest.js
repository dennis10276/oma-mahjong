'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const H = require('../www/hard'), Honest = require('../tools/sim/honest/hard');
const { game } = require('../tools/sim/reorder_honest');
const load = name => vm.runInNewContext(fs.readFileSync(path.join(__dirname, name), 'utf8') + ';HARD_LEVELS');
const hash = r => crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex');
module.exports = [
  { name: 'reorder honest: unchanged through 91, each existing 92+ board exactly once, clock-safe, large boards every tenth', cpu: true, async run(t) {
    const before = load('../analysis/levels-before-reorder-92.js'), now = load('../www/levels-hard.js');
    const report = require('../analysis/reorder-92.json');
    t.eq(report.fingerprint, require('../tools/sim/reorder_honest').fingerprint, 'engine, profiles, baseline and independent sample configuration match the measurements');
    t.eq([now.from, now.aspect, now.cycleFrom, now.levels.length], [before.from, before.aspect, before.cycleFrom, before.levels.length], 'range and repetition retained');
    t.eq(now.v, H.GENV, 'table and runtime generation agree');
    t.eq(report.moves.length, 178, 'all 92–269 boards covered');
    t.eq(new Set(report.moves.map(m => m.was)).size, 178, 'no reused source board');
    for (let lv = before.from; lv <= 91; lv++) {
      t.eq(now.levels[lv - now.from], before.levels[lv - before.from], 'unchanged level ' + lv);
      t.eq(H.designVersion(lv), before.v, 'unchanged saved-game generation ' + lv);
    }
    const previousBand = { true: -1, false: -1 };
    t.eq(report.moves.map(m => m.lv), Array.from({ length: 178 }, (_, i) => 92 + i), 'every destination present exactly once');
    for (const m of report.moves) {
      const r = now.levels[m.lv - now.from], old = before.levels[m.was - before.from];
      t.ok(m.was >= 92 && m.was <= 269, 'source within authorized range ' + m.lv);
      t.eq(hash(r), hash(old), 'whole packed board preserved ' + m.lv);
      t.eq(hash(r), m.hash, 'measurement identifies this board ' + m.lv);
      t.eq(r[0].length / 3 > 88, m.lv % 10 === 0, 'large-board placement ' + m.lv);
      t.ok(m.band >= previousBand[m.big], 'difficulty bands ordered within size class ' + m.lv);
      previousBand[m.big] = m.band;
      t.eq(H.designVersion(m.lv), now.v, 'changed range uses new saved-game generation ' + m.lv);
      t.eq(now.ratingModels[m.lv - now.from], m.was >= 106 ? 'strong' : 'focused', 'legacy rating retains its model ' + m.lv);
      t.eq(H.ratingModel(m.lv), now.ratingModels[m.lv - now.from], 'runtime reports the relocated rating model ' + m.lv);
      const d = Honest.unpack(m.was, old);
      t.ok(Honest.validSolution(game(m.was), d.solution), 'full solution survives reorder ' + m.lv);
      for (const phase of ['primary', 'validation']) for (const p of Object.values(m[phase])) {
        t.ok(0 <= p.first && p.first <= p.two && p.two <= p.four && p.four <= 1, 'valid cumulative chances ' + m.lv + ' ' + phase);
      }
    }
    t.ok(report.phases.primary.seed !== report.phases.validation.seed, 'validation seed independent of ranking');
    t.ok(report.phases.primary.runs >= 1200 && report.phases.validation.runs >= 600, 'sufficient independent chains');
    t.ok(report.comparison.validation.after.totalVariation < report.comparison.validation.before.totalVariation, 'ordering improves progression on independent simulations');
    for (let lv = 270; lv < 390; lv++) {
      const base = now.cycleFrom + (lv - now.cycleFrom) % (269 - now.cycleFrom + 1);
      t.eq(H.ratingModel(lv), now.ratingModels[base - now.from], 'repeated board retains calibration label ' + lv);
    }
  } },
  { name: 'reorder honest: draft predictions follow relocated boards and leave current 1.53 predictions separate', cpu: true, async run(t) {
    const original = require('../site/dash/predict-1.53.json'), draft = require('../analysis/reorder-92-predictions.json');
    const report = require('../analysis/reorder-92.json'), moves = new Map(report.moves.map(m => [m.lv, m]));
    const baseline = load('../analysis/levels-before-reorder-92.js');
    t.eq(original.version, '1.53', 'old-client predictions retained');
    // 1.54's predictions are kept for 1.54 apps (predict-1.54.json); the current file (1.55 on) registers both
    const released = require('../site/dash/predict-1.54.json'), current = require('../site/dash/predict.json');
    t.eq(released.version, '1.54', 'the 1.54 prediction version matches the reorder release');
    t.eq(current.previousVersions['1.53'], 'predict-1.53.json', 'old-client prediction file registered');
    t.eq(current.previousVersions['1.54'], 'predict-1.54.json', '1.54 prediction file registered');
    t.eq(draft.baseVersion, '1.53', 'draft identifies its baseline');
    t.eq(draft.generation, 8, 'draft identifies reordered generation');
    t.eq(draft.version, 'unpublished-reorder-92', 'draft cannot be confused with released predictions');
    for (const [id, p] of Object.entries(draft.players)) {
      t.eq(Object.keys(p.levels), Object.keys(original.players[id].levels), 'same player prediction window ' + p.name);
      for (const [lv, odds] of Object.entries(p.levels)) {
        if (+lv <= 91) { t.eq(odds, original.players[id].levels[lv], 'unchanged board prediction ' + p.name + ' ' + lv); continue; }
        const m = moves.get(+lv), r = m.validation[p.name], old = baseline.levels[m.was - baseline.from];
        t.eq(odds[3], old[7] ? old[7][1] : 0, 'clock belongs to relocated board ' + p.name + ' ' + lv);
        t.ok(0 <= odds[0] && odds[0] <= odds[1] && odds[1] <= odds[2] && odds[2] <= 100, 'valid draft cumulative odds ' + p.name + ' ' + lv);
        if (r) t.eq(odds.slice(0, 3), [r.first, r.two, r.four].map(q => Math.round(q * 100)), 'draft prediction measured on relocated board ' + p.name + ' ' + lv);
        t.eq(released.players[id].levels[lv], odds, 'release uses the reviewed prediction ' + p.name + ' ' + lv);
      }
    }
  } },
  { name: 'reorder honest: generation-7 level 91 resumes, generation-7 level 92 restarts; progress and recordings retained', async run(t, { startLevel, sleep }) {
    const p = await t.phone({ state: { name: 'Dennis', pid: 'test-reorder-save', level: 106,
      stars: { 91: 3, 92: 2 }, seenSp: { clock: 1, clockMoves: 1, ice: 1, lock: 1, gold: 1, joker: 1 } } });
    await startLevel(p, 91);
    await p.evaluate(() => { G.mv = 2; saveCur(); const c = JSON.parse(localStorage.getItem(CUR)); c.hv = 7; localStorage.setItem(CUR, JSON.stringify(c)); __mj.startLevel(91); });
    t.eq(await p.evaluate(() => [G.mv, JSON.parse(localStorage.getItem(CUR)).hv]), [2, 7], 'same 91 resumes with its existing generation');
    await p.evaluate(() => { localStorage.removeItem(CUR); __mj.startLevel(92); });
    const fresh = await p.evaluate(async () => { await flushReplay(); return { moves: G.mv, id: G.rp.id }; });
    await sleep(400);
    const recording = require('../tools/replays').readReplay(p.db.get('replays/test-reorder-save/' + fresh.id));
    t.eq([fresh.moves, recording.initial && recording.initial.gen], [0, 8], 'new 92 and stored replay identify reordered generation');
    await p.evaluate(() => { G.mv = 2; saveCur(); const c = JSON.parse(localStorage.getItem(CUR)); c.hv = 7; localStorage.setItem(CUR, JSON.stringify(c)); __mj.startLevel(92); });
    t.eq(await p.evaluate(() => G.mv), 0, 'old numbered board cannot resume as new 92');
    await p.evaluate(() => { G.mv = 2; saveCur(); __mj.startLevel(92); });
    t.eq(await p.evaluate(() => G.mv), 2, 'new generation resumes normally');
    t.eq(await p.evaluate(() => [S.level, S.stars[91], S.stars[92]]), [106, 3, 2], 'no reset of level or completed stars');
    t.eq(await p.evaluate(() => Hard.ratingModel(92)), require('../analysis/reorder-92.json').moves[0].was >= 106 ? 'strong' : 'focused', 'correct calibration label after relocation');
    await p.evaluate(() => {
      localStorage.removeItem(CUR); __mj.startLevel(92);
      for (const i of Hard.get(92).solution) { __mj.onTap(i); if (G.alive[i]) __mj.onTap(i); }
    });
    await sleep(5000);
    t.ok(await p.evaluate(() => G.done && S.stars[92] > 0), 'relocated board also wins through the actual game rules and animations');
  } },
];
