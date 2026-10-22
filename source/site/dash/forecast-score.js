/* Voorspeltest: locked predictions against what really happened. Read-only.

   A prediction lives in forecasts/<pid>/<level> = { p, t, by, model }:
     p      predicted winning try, 1-8 (8 means "8 or more")
     t      the database server's time of writing ({".sv": "timestamp"}; the rules demand it)
     by     who made it (for example "gemini"), model: free text
   The database rules let it be written once and never changed or deleted (except test- players).

   A prediction only counts when it was in the database before the player first opened that level.
   Correct, as in the bot research: exact for 1-3 tries, +-1 for 4-5, +-2 for 6-7, both 8 or more.
   The baseline is the plain guess "always 1 try". */
(function (root) {
  'use strict';
  const MAX = 8, COHORT = 20, TARGET = 16;
  const tolerance = actual => actual > 5 ? 2 : actual > 3 ? 1 : 0;
  const correct = (p, actual) => (p >= MAX && actual >= MAX) || Math.abs(p - actual) <= tolerance(actual);
  const valid = f => !!f && typeof f === 'object' && Number.isInteger(f.p) && f.p >= 1 && f.p <= MAX && Number.isFinite(f.t);

  /* First opening, winning try and tries so far on one normal level (no daily puzzle). Events sorted by time. */
  function outcome(events, lv) {
    let opened = null, winAt = null, won = null, tries = 0, ends = 0;
    for (const e of events) {
      if (!e || e.m === 'd' || e.lv !== lv || (e.k !== 'start' && e.k !== 'end')) continue;
      if (opened == null) opened = e.t;
      if (Number.isInteger(e.at) && e.at > 0) tries = Math.max(tries, e.at);
      if (e.k === 'end') ends++;
      if (e.k === 'end' && e.r === 'win') { won = e.t; winAt = Number.isInteger(e.at) && e.at > 0 ? e.at : Math.max(tries, ends); break; }
    }
    return { opened, won, winAt, tries: Math.max(tries, ends) };
  }

  /* forecasts: { "<level>": {p, t, by, model} } of one player; events: that player's plays, sorted by time. */
  function score(forecasts, events) {
    const rows = [];
    for (const [key, f] of Object.entries(forecasts || {})) {
      const lv = Number(key);
      if (!/^[1-9][0-9]{0,3}$/.test(key)) continue;
      if (!valid(f)) { rows.push({ lv, status: 'invalid' }); continue; }
      const o = outcome(events || [], lv);
      const row = { lv, p: f.p, locked: f.t, by: typeof f.by === 'string' ? f.by : '', model: typeof f.model === 'string' ? f.model : '', opened: o.opened, tries: o.tries, actual: null };
      if (o.opened == null) row.status = 'waiting';
      else if (f.t >= o.opened) row.status = 'late';
      else if (o.winAt != null) {
        row.status = 'scored'; row.actual = o.winAt;
        row.ok = correct(f.p, o.winAt); row.baseline = correct(1, o.winAt);
      } else {
        // not won yet after k tries: the winning try will be k+1 or later. Decided as soon as that settles it
        // (a prediction of 8+ is right from 8 tries on; a lower one is wrong once k+1 is already too far).
        const next = o.tries + 1, stillPossible = [...Array(MAX + 4).keys()].some(i => correct(f.p, next + i));
        if (o.tries > 0 && f.p >= MAX && o.tries >= MAX) { row.status = 'scored'; row.ok = true; row.baseline = false; }
        else if (o.tries > 0 && !stillPossible) { row.status = 'scored'; row.ok = false; row.baseline = false; }
        else row.status = 'playing';
      }
      rows.push(row);
    }
    rows.sort((a, b) => a.lv - b.lv);
    // the test set: the first 20 levels opened after their prediction was locked (still playing ones included)
    const cohort = rows.filter(r => r.status === 'scored' || r.status === 'playing').sort((a, b) => a.opened - b.opened).slice(0, COHORT);
    const done = cohort.filter(r => r.status === 'scored');
    const count = status => rows.filter(r => r.status === status).length;
    return {
      rows,
      summary: {
        cohort: cohort.length, decided: done.length, ok: done.filter(r => r.ok).length, baseline: done.filter(r => r.baseline).length,
        playing: count('playing'), waiting: count('waiting'), late: count('late'), invalid: count('invalid'),
        target: TARGET, size: COHORT,
      },
    };
  }

  const api = { MAX, COHORT, TARGET, correct, outcome, score };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ForecastScore = api;
})(typeof window === 'object' ? window : globalThis);
