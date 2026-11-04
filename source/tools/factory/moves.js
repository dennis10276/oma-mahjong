/* What the factory learned about its own changes (Claude, 2026-11-04).
   Dennis: "You should learn from what works and doesnt to tune difficulty and match the factory accordingly."
   Every change the steering measures is written to a journal: what kind of change, the family rating before and after,
   the target. The prior per kind of change (median factor after/before, how often it moved the right way) ranks the
   changes to try next on other boards, so the steering stops spending bot time on changes that rarely work.
   Lessons already in the journal (2026-11-03): all ice thawed is a cliff (179: 20 -> 4.3, 177: 16 -> 11), locks off
   barely moves a board (18.8 -> 16.2), adding a frozen chain made boards EASIER (179: 5.4 -> 4.2), a luck moment adds
   about a try (4.4 -> 5.4 -> 6.0). Hence the graded steps in steer_design.js (one ice softer, half the ice, one lock).
     node moves.js <journal.jsonl ...>   prints the prior per kind                                                   */
'use strict';
const fs = require('fs'), path = require('path');
const SEED = path.join(__dirname, '..', '..', 'analysis', 'factory', 'moves-seed.jsonl');
const DEFAULT = process.env.FACTORY_JOURNAL || path.join(__dirname, '..', '..', 'build', 'factory-moves.jsonl');
// the kind of a change: its description without numbers ("4 tiles face-up ..." -> "n tiles face-up ...")
const kindOf = what => String(what).replace(/\d+/g, 'n').replace(/\s+/g, ' ').trim();
function load(files = [SEED, DEFAULT]) {
  const rows = [];
  for (const f of files) if (f && fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l.trim()) { try { rows.push(JSON.parse(l)); } catch (e) { } }
  // A cloud log may arrive before its authoritative measured seed journal.
  // Preserve both files, but do not count the reconstructed observation twice.
  const key = r => JSON.stringify([r.level, r.target, r.n, r.what, r.before, r.after, [...(r.recipe || [])].sort()]);
  const measured = new Set(rows.filter(r => r.source !== 'claude-cloud-log').map(key));
  return rows.filter(r => r.source !== 'claude-cloud-log' || !measured.has(key(r)));
}
const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
// per kind: n, median log factor (after/before, ratings capped 1..20), share that moved toward the target
function priors(rows = load()) {
  const by = new Map();
  for (const r of rows) {
    if (!(r.before > 0 && r.after > 0)) continue;
    const k = r.kind || kindOf(r.what), b = Math.min(20, Math.max(1, r.before)), a = Math.min(20, Math.max(1, r.after));
    const e = by.get(k) || { n: 0, logs: [], toward: 0 }; e.n++; e.logs.push(Math.log(a / b));
    if (r.target != null && Math.abs(a - r.target) < Math.abs(b - r.target)) e.toward++;
    by.set(k, e);
  }
  const out = {};
  for (const [k, e] of by) out[k] = { n: e.n, factor: +Math.exp(median(e.logs)).toFixed(3), toward: +(e.toward / e.n).toFixed(2) };
  return out;
}
// the rating a change is expected to give from `before` (null when the kind has fewer than `min` records)
function expect(pr, what, before, min = 3) {
  const p = pr[kindOf(what)]; if (!p || p.n < min) return null;
  return Math.min(20, Math.max(1, before * p.factor));
}
function record(entry, file = DEFAULT) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, JSON.stringify({ t: new Date().toISOString(), kind: kindOf(entry.what), ...entry }) + '\n'); } catch (e) { }
}
// a steering log ("start: family X ...", "step k: <what> -> family Y ...", "step k: kept "<what>"") -> journal rows
function fromLog(log, meta = {}) {
  const rows = []; let cur = null;
  for (const line of log || []) {
    let m = /^start: family ([\d.]+)/.exec(line); if (m) { cur = +m[1]; continue; }
    m = /^step \d+: (.+?) -> family ([\d.]+)/.exec(line); if (m && cur != null) { rows.push({ ...meta, what: m[1], kind: kindOf(m[1]), before: cur, after: +m[2] }); continue; }
    m = /^step \d+: kept "(.+)"/.exec(line); if (m) { const k = rows.filter(r => r.what === m[1]).pop(); if (k) cur = k.after; }
  }
  return rows;
}
module.exports = { kindOf, load, priors, expect, record, fromLog, SEED, DEFAULT };
if (require.main === module) {
  const files = process.argv.slice(2);
  const pr = priors(load(files.length ? files : undefined));
  for (const [k, p] of Object.entries(pr).sort((a, b) => b[1].n - a[1].n)) console.log(String(p.n).padStart(4), String(p.factor).padEnd(6), String(p.toward).padEnd(5), k);
}
