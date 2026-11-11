'use strict';
// Campaign-level measurements that keep the raw per-campaign tries (never a bare mean).
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const r2 = x => x == null ? null : Math.round(x * 100) / 100;

// raw: per campaign {tries (cap if unwon), censored}
function stats(raw, cap) {
  const t = raw.map(c => c.tries), t20 = t.map(x => Math.min(x, 20));
  return { n: raw.length, cap, D: r2(mean(t)), D20: r2(mean(t20)), D40: r2(mean(t.map(x => Math.min(x, 40)))),
    median: median(t), censoredShare: raw.length ? raw.filter(c => c.censored).length / raw.length : null,
    se: r2(sd(t) / Math.sqrt(t.length || 1)) };
}
const toRaw = (results, cap) => results.map(r => r.wonOn == null
  ? { tries: cap, censored: true }
  : { tries: Math.min(r.wonOn, cap), censored: false });

// family ruler: calls = [{runs, seed}], one sub-block per call (seeds:1), cap attempts.
function family(meter, design, calls, cap) {
  const raw = [], valid = [], fp = meter.fingerprint;
  for (const c of calls) {
    const m = meter.measure(design, { setting: 'family', runs: c.runs, seeds: 1, seed: c.seed, maxAttempts: cap, allResults: true });
    valid.push(m.valid === true);
    raw.push(...toRaw(m.results || [], cap));
  }
  return { ok: valid.every(Boolean) && raw.length === calls.reduce((s, c) => s + c.runs, 0), calls, raw, fingerprint: fp, ...stats(raw, cap) };
}

// skilled bot B3 (planner meter): S = better of route/plain, as the legacy yardstick; cap = bot default 20.
function skilled(meter, design, calls) {
  const raw = [], rawBy = { route: [], plain: [] }, valid = [], styles = [];
  const cap = 20;
  const perCall = [];
  for (const c of calls) {
    const m = meter.measure(design, { setting: 'planner', runs: c.runs, seeds: 1, seed: c.seed, allResults: true });
    valid.push(m.valid === true);
    perCall.push(m);
    for (const st of ['route', 'plain']) rawBy[st].push(...(m.plannerResultsBySeed?.[st] || []).flatMap(b => b.runs || []).map(r => r.wonOn == null ? { tries: cap, censored: true } : { tries: Math.min(r.wonOn, cap), censored: false }));
  }
  // pooled per style, S = better pooled style
  const sty = Object.fromEntries(['route', 'plain'].map(k => [k, stats(rawBy[k], cap).D]));
  const best = sty.route <= sty.plain ? 'route' : 'plain';
  const expected = r2(mean(perCall.map(m => m.expectedTries)));
  return { ok: valid.every(Boolean) && rawBy[best].length === calls.reduce((s, c) => s + c.runs, 0), calls, styles: sty, bestStyle: best,
    rawByStyle: rawBy, raw: rawBy[best], S: stats(rawBy[best], cap).D, Smeter: expected, fingerprint: meter.fingerprint, ...stats(rawBy[best], cap) };
}
module.exports = { family, skilled, stats, mean, sd, median };
