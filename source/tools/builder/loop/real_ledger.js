#!/usr/bin/env node
/* Real-data ledger (Claude, 2026-11-07; process design section 6 step 12, experiment E2).
   Reads a READ-ONLY export of Firebase plays/ (one object { <pid>: { <key>: record } }, saved under
   source/analysis/archive/, which is git-ignored) and gives, per player and level, the tries up to and
   including the first win on the CURRENT board of that level. Nothing here talks to Firebase.

   Rules (the same as the earlier yardstick: factory/difficulty_fit.py, factory/real_losses.js and
   site/dash/forecast-score.js outcome()):
     - only start/end records of normal levels (no daily puzzle, m === 'd');
     - one try = one attempt id (aid). A resumed try writes a second start with the same aid. A try with
       no end that is followed by another try was abandoned and counts as a loss (outcome() counts it via
       the game's attempt counter `at`). A restart (r === 'restart') is a loss. A try with no end that is
       the player's last on the level is "open": not a loss, the sequence is censored;
     - tries after the first win (replays) are dropped;
     - the current board only: the app version must be at least the release that put the present board
       on that level (85-89: 1.48, 90-91: 1.52, 92+: 1.54, the reorder of 2026-10-16), and the tile count
       (n) and clock moves (ck, on start records) must match the table in source/www/levels-hard.js.
       There is no design-version field in plays/, so version plus signature is the test;
     - a player who had already WON the level on an older board is left out of that level (the current
       board would only be a replay after a win). Earlier losses on an older board are kept as a flag.
   Players: Dennis, Gerda and Mrs. Doubtfire make the family fit. Grandma (OmaHanny) plays her own care
   track and is reported separately (careLedger). DennisTEST is a test account and is never read.

     node source/tools/builder/loop/real_ledger.js <plays-export.json> <out.json> [85-199]           */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FS = require('../../../site/dash/forecast-score.js');

const PLAYERS = {
  pmuy78xu6tsths9: { who: 'Dennis', weight: 2, family: true },
  pmv6yhzz3x9oxs8: { who: 'Gerda', weight: 1, family: true },
  pmv16kj3jr35750: { who: 'MrsD', weight: 2, family: true },
  pmv2gaa0g00eq3q: { who: 'PUK', weight: 0, family: false },
  pmuy4wmdp17hbws: { who: 'OmaHanny', weight: 0, family: false, care: true },
};
const TEST_ACCOUNTS = new Set(['pmuxw2uqkzcnbgx']);
const FAMILY = ['Dennis', 'Gerda', 'MrsD'];
const Y_CAP = 20;

const verNum = v => {
  const m = /^(\d+)\.(\d+)/.exec(String(v || ''));
  return m ? Number(m[1]) * 1000 + Number(m[2]) : 0;
};
// the release that put the present board on a level (AGENTS.md: 1.48 re-arranged 80-269, 1.52 reordered 90-269,
// 1.53 remade 94/98/101 and 106+, 1.54 reordered 92-269; levels-hard.js unchanged since 2026-10-16)
const minVersion = lv => (lv >= 92 ? verNum('1.54') : lv >= 90 ? verNum('1.52') : verNum('1.48'));

/* Tile count and clock moves of every table level, from the game's own table. */
function liveSignatures(from = 70, to = 269) {
  const root = path.resolve(__dirname, '..', '..', '..');
  const Hard = require(path.join(root, 'www', 'hard.js'));
  const previous = global.HARD_LEVELS;
  const sig = {};
  try {
    global.HARD_LEVELS = vm.runInNewContext(fs.readFileSync(path.join(root, 'www', 'levels-hard.js'), 'utf8') + ';HARD_LEVELS');
    for (let lv = from; lv <= to; lv++) {
      const b = Hard.get(lv);
      sig[lv] = { n: b.tiles.length, ck: b.clock ? b.clock.n : null };
    }
  } finally { global.HARD_LEVELS = previous; }
  return sig;
}

const isPlay = e => e && typeof e === 'object' && (e.k === 'start' || e.k === 'end') && e.m !== 'd' && Number.isInteger(e.lv);

function onCurrentBoard(e, sig, opts = {}) {
  const s = sig[e.lv];
  if (!s) return false;
  if (verNum(e.v) < (opts.minVersion || minVersion)(e.lv)) return false;
  if (Number.isInteger(e.n) && e.n !== s.n) return false;
  if (e.k === 'start' && Number.isInteger(e.ck) && s.ck != null && e.ck !== s.ck) return false;
  return true;
}

/* Tries of one player on one level from time-sorted records that all belong to the board being counted.
   Returns { res: [0,0,1], won, open, tries, aids }. res holds only finished-or-abandoned tries. */
function sequenceOf(events) {
  const tries = [];
  const byAid = new Map();
  for (const e of events) {
    let t = e.aid ? byAid.get(e.aid) : null;
    if (!t) {
      if (!e.aid && e.k === 'start') continue; // old records without an id: only their end counts
      // A new id whose game attempt counter did not go up is the same try logged again (the app reopened
      // on a finished board, e.g. MrsD 158: two 'stuck' ends 1 s apart, both at 1, both 58 tiles left).
      const prev = tries[tries.length - 1];
      if (prev && prev.end && prev.end !== 'win' && Number.isInteger(e.at) && Number.isInteger(prev.at) && e.at <= prev.at) {
        if (e.aid) byAid.set(e.aid, { relog: true, end: 'relog' });
        continue;
      }
      t = { aid: e.aid || null, t: e.t, end: null, at: Number.isInteger(e.at) ? e.at : null };
      tries.push(t);
      if (e.aid) byAid.set(e.aid, t);
    }
    if (t.relog) continue;
    if (e.k === 'end' && !t.end) t.end = e.r;
  }
  const res = [];
  let won = false, open = false;
  for (let k = 0; k < tries.length; k++) {
    const t = tries[k];
    if (t.end === 'win') { res.push(1); won = true; break; }
    if (t.end) { res.push(0); continue; }
    if (k === tries.length - 1) { open = true; break; } // still being played (or left): censored, not a loss
    res.push(0); // abandoned without an end, then a new try: a loss, as outcome() counts it
  }
  return { res, won, open, tries: res.length, firstT: tries.length ? tries[0].t : null };
}

/* The ledger: one sequence per player and level in [from, to]. */
function ledger(exportObj, { from = 85, to = 199, sig = liveSignatures(), players = PLAYERS } = {}) {
  const sequences = [], skipped = { replayAfterOldWin: 0, noCurrentBoardTry: 0 }, diag = { outcomeAgree: 0, outcomeDiffer: [] };
  const frontier = {};
  for (const [pid, info] of Object.entries(players)) {
    if (TEST_ACCOUNTS.has(pid) || info.care) continue;
    const node = exportObj[pid];
    if (!node) continue;
    const plays = Object.values(node).filter(isPlay).sort((a, b) => a.t - b.t);
    const reached = plays.reduce((m, e) => Math.max(m, e.lv), 0);
    const wonMax = plays.filter(e => e.k === 'end' && e.r === 'win').reduce((m, e) => Math.max(m, e.lv), 0);
    frontier[info.who] = { highestStarted: reached, highestWon: wonMax, last: plays.length ? new Date(plays[plays.length - 1].t).toISOString() : null };
    const byLv = new Map();
    for (const e of plays) if (e.lv >= from && e.lv <= to) (byLv.get(e.lv) || byLv.set(e.lv, []).get(e.lv)).push(e);
    for (const [lv, evs] of [...byLv].sort((a, b) => a[0] - b[0])) {
      const cur = evs.filter(e => onCurrentBoard(e, sig));
      if (!cur.length) { skipped.noCurrentBoardTry++; continue; }
      const t0 = cur[0].t;
      const older = evs.filter(e => e.t < t0 && !onCurrentBoard(e, sig));
      if (older.some(e => e.k === 'end' && e.r === 'win')) { skipped.replayAfterOldWin++; continue; }
      const s = sequenceOf(cur);
      if (!s.tries) continue; // only an open first try: nothing observed yet
      const o = FS.outcome(cur, lv);
      if (s.won && o.winAt === s.tries) diag.outcomeAgree++;
      else if (s.won) diag.outcomeDiffer.push({ who: info.who, lv, ledger: s.tries, outcomeWinAt: o.winAt });
      sequences.push({
        who: info.who, pid, lv, res: s.res, tries: s.tries, won: s.won, open: s.open,
        priorOldBoardTries: new Set(older.filter(e => e.aid).map(e => e.aid)).size + older.filter(e => !e.aid && e.k === 'end').length,
        family: !!info.family,
      });
    }
  }
  return { sequences, skipped, diag, frontier };
}

/* One row per (player, level, try): what the estimator reads. */
function tryRows(sequences, cap = Infinity) {
  const rows = [];
  for (const s of sequences) s.res.slice(0, cap).forEach((y, k) => rows.push({ who: s.who, lv: s.lv, try: k + 1, win: y }));
  return rows;
}

/* Y per level: (2 Dennis + Gerda + 2 MrsD)/5, each player's tries until the first win capped at 20, a level not
   (yet) won counting as tries + 1 (as in family-weighted-tries.json). Only levels all three have played; censored
   marks a level where somebody has not won yet (Y is then a lower bound). */
function yardstick(sequences, cap = Y_CAP) {
  const by = {};
  for (const s of sequences) if (FAMILY.includes(s.who)) (by[s.lv] = by[s.lv] || {})[s.who] = s;
  const out = {};
  for (const [lv, ps] of Object.entries(by)) {
    if (!FAMILY.every(w => ps[w])) continue;
    const v = w => Math.min(cap, ps[w].won ? ps[w].tries : ps[w].tries + 1);
    out[lv] = { Y: +((2 * v('Dennis') + v('Gerda') + 2 * v('MrsD')) / 5).toFixed(2), censored: FAMILY.some(w => !ps[w].won), Dennis: v('Dennis'), Gerda: v('Gerda'), MrsD: v('MrsD') };
  }
  return out;
}

/* Grandma's care track: her own live-dealt levels; tries to the first win per level on all her records. No version
   or current-board filter: her boards are dealt live for her, so there is no fixed board to match. meanTries uses the
   same rule as Y: a level not won yet counts as tries + 1 (notWon lists how many). */
function careLedger(exportObj, pid = 'pmuy4wmdp17hbws') {
  const plays = Object.values(exportObj[pid] || {}).filter(isPlay).sort((a, b) => a.t - b.t);
  const byLv = new Map();
  for (const e of plays) (byLv.get(e.lv) || byLv.set(e.lv, []).get(e.lv)).push(e);
  const rows = [];
  for (const [lv, evs] of [...byLv].sort((a, b) => a[0] - b[0])) {
    const s = sequenceOf(evs);
    if (s.tries) rows.push({ lv, tries: s.tries, won: s.won, firstVersion: evs[0].v, firstT: new Date(evs[0].t).toISOString().slice(0, 10) });
  }
  const bands = {};
  for (const r of rows) {
    const b = Math.floor((r.lv - 1) / 10) * 10 + 1, k = `${b}-${b + 9}`;
    const x = bands[k] = bands[k] || { levels: 0, firstTry: 0, notWon: 0, tries: [] };
    x.levels++; if (r.won && r.tries === 1) x.firstTry++; if (!r.won) x.notWon++; x.tries.push(r.won ? r.tries : r.tries + 1);
  }
  for (const x of Object.values(bands)) {
    x.firstTryRate = +(x.firstTry / x.levels).toFixed(2);
    x.meanTries = +(x.tries.reduce((a, b) => a + b, 0) / x.tries.length).toFixed(2);
    delete x.tries;
  }
  return { rows, bands, highestStarted: plays.reduce((m, e) => Math.max(m, e.lv), 0), last: plays.length ? new Date(plays[plays.length - 1].t).toISOString() : null };
}

module.exports = { PLAYERS, FAMILY, TEST_ACCOUNTS, Y_CAP, verNum, minVersion, liveSignatures, onCurrentBoard, sequenceOf, ledger, tryRows, yardstick, careLedger };

if (require.main === module) {
  const [file, out, range = '85-199'] = process.argv.slice(2);
  if (!file || !out) { console.error('usage: node real_ledger.js <plays-export.json> <out.json> [85-199]'); process.exit(1); }
  const [from, to] = range.split('-').map(Number);
  const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
  const L = ledger(exp, { from, to });
  const res = { about: 'Tries to the first win per player and level on the current board, from a read-only plays/ export (loop/real_ledger.js).', source: path.basename(file), range, ...L, yardstick: yardstick(L.sequences), care: careLedger(exp) };
  fs.writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
  console.log(L.sequences.length, 'sequences;', 'skipped', JSON.stringify(L.skipped), '; outcome() agrees on', L.diag.outcomeAgree, 'won levels, differs on', L.diag.outcomeDiffer.length);
}
