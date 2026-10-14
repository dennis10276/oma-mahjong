/* Read-only reconstruction of the existing v1 replay chunks. No game engine or writes. */
(function (root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const fail = () => { throw Error('Ongeldige spelopname'); };
  const index = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
  const face = v => Number.isInteger(v) && (v >= 0 && v < 36 || v === 101);
  function validateState(s, n) {
    if (!s || !['a', 'd', 'f'].every(k => Array.isArray(s[k]) && s[k].length === n) ||
        !s.a.every(v => v === 0 || v === 1) || !s.d.every(v => v === 0 || v === 1) || !s.f.every(face) ||
        !Array.isArray(s.tr) || s.tr.length > 4 || !s.tr.every(i => index(i, n)) || new Set(s.tr).size !== s.tr.length ||
        !Number.isInteger(s.p) || s.p < -1 || s.p >= n || !Number.isInteger(s.m) || s.m < 0) fail();
    if (s.ob != null) {
      if (typeof s.ob !== 'object' || !Array.isArray(s.ob.locks) || !Array.isArray(s.ob.keys) ||
          !s.ob.locks.concat(s.ob.keys).every(i => index(i, n))) fail();
      for (const k of ['need', 'left']) {
        if (!s.ob[k] || typeof s.ob[k] !== 'object' || Array.isArray(s.ob[k]) ||
            !Object.entries(s.ob[k]).every(([i, hits]) => index(Number(i), n) && Number.isInteger(hits) && hits >= 0 && hits <= 20)) fail();
      }
    }
    if (s.ck != null && (!index(s.ck.i, n) || !Number.isInteger(s.ck.n) || s.ck.n < 0)) fail();
  }
  function read(records, aid) {
    const chunks = new Map();
    const rows = Object.entries(records || {}).filter(([k]) => k !== 'createdAt');
    if (rows.length > 2048) fail();
    for (const [, row] of rows) {
      if (!row || row.v !== 1 || row.aid !== aid || !Number.isInteger(row.seq) || row.seq < 0 || row.seq > 10000 ||
          !Number.isFinite(row.t) || typeof row.data !== 'string' || row.data.length > 16384) fail();
      const data = JSON.parse(row.data);
      if (!Array.isArray(data.events) || data.events.length > 48) fail();
      const old = chunks.get(row.seq);
      if (old && (old.data !== row.data || old.code !== row.code)) throw Error('Tegenstrijdige opname');
      if (!old) chunks.set(row.seq, { ...row, parsed: data });
    }
    const out = { initial: null, state: null, view: null, ms: 0, updatedAt: 0, result: null, paused: false, gap: false, truncated: false, tap: null };
    let expected = 0;
    for (const chunk of [...chunks.values()].sort((a, b) => a.seq - b.seq)) {
      if (chunk.seq !== expected++) { out.gap = true; break; }
      const data = chunk.parsed;
      if (data.init) {
        if (out.initial) fail();
        const init = data.init;
        if (!Array.isArray(init.tiles) || !init.tiles.length || init.tiles.length > 512 ||
            !init.tiles.every(t => Array.isArray(t) && t.length === 3 && t.every(Number.isFinite) && t.every(v => Math.abs(v) <= 5000) && t[2] >= 0) ||
            typeof init.key !== 'string' || init.key.length > 40 || !Array.isArray(init.gold) || !init.gold.every(i => index(i, init.tiles.length))) fail();
        validateState(init.state, init.tiles.length);
        out.initial = copy(init); out.state = copy(init.state);
      }
      if (!out.initial) { out.gap = true; break; }
      for (const event of data.events) {
        if (!Array.isArray(event) || event.length !== 3 || !Number.isFinite(event[0]) || event[0] < 0 || typeof event[1] !== 'string') fail();
        const [ms, kind, value] = event;
        out.ms = ms;
        if (kind === 'state') {
          if (!value || typeof value !== 'object') fail();
          for (const k of ['a', 'd', 'f']) if (Object.hasOwn(value, k)) {
            if (!Array.isArray(value[k])) fail();
            for (const edit of value[k]) {
              if (!Array.isArray(edit) || edit.length !== 2 || !index(edit[0], out.initial.tiles.length)) fail();
              out.state[k][edit[0]] = edit[1];
            }
          }
          for (const k of ['tr', 'p', 'm', 'ob', 'ck']) if (Object.hasOwn(value, k)) out.state[k] = copy(value[k]);
          validateState(out.state, out.initial.tiles.length);
        }
        if (kind === 'view' && Array.isArray(value)) out.view = copy(value);
        if (kind === 'tap' && Array.isArray(value) && index(value[0], out.initial.tiles.length)) out.tap = value[0];
        if (kind === 'pause') out.paused = true;
        if (kind === 'resume' || kind === 'begin') out.paused = false;
        if (kind === 'end' && value && ['win', 'stuck', 'restart'].includes(value.r)) out.result = value.r;
        if (kind === 'truncated') out.truncated = true;
      }
      out.updatedAt = Math.max(out.updatedAt, chunk.t);
    }
    return out;
  }
  const api = { read };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DashReplay = api;
})(typeof window === 'object' ? window : globalThis);
