/* Offline reader for one attempt exported from replays/<pid>/<aid>. No database writes.
   node tools/replays.js attempt.json [--frames frames.json] */
'use strict';
const fs = require('fs');
const copy = value => JSON.parse(JSON.stringify(value));
function readReplay(records) {
  const rows = Object.entries(records || {}).filter(([k]) => k !== 'createdAt').map(([, v]) => v), chunks = new Map(), issues = [];
  for (const row of rows) {
    if (!row || row.v !== 1 || !Number.isInteger(row.seq) || row.seq < 0) throw Error('Invalid replay chunk');
    const data = JSON.parse(row.data);
    if (!Array.isArray(data.events) || data.events.length > 48) throw Error('Invalid event batch');
    const key = JSON.stringify([row.aid, row.code, data]);
    if (chunks.has(row.seq)) {
      if (chunks.get(row.seq).key !== key) issues.push('Conflicting copies of chunk ' + row.seq);
    } else chunks.set(row.seq, { ...row, ...data, key });
  }
  const ordered = [...chunks.values()].sort((a, b) => a.seq - b.seq);
  const ids = new Set(ordered.map(c => c.aid));
  if (ids.size !== 1) throw Error('Expected exactly one attempt');
  let expected = 0, initial = null, state = null, result = null, lastTime = 0;
  const frames = [], kinds = {};
  for (const chunk of ordered) {
    if (chunk.seq !== expected) issues.push(`Missing chunks ${expected}..${chunk.seq - 1}`);
    expected = chunk.seq + 1;
    if (chunk.init) {
      if (initial) issues.push('Repeated initial state');
      else { initial = copy(chunk.init); state = copy(initial.state); }
    }
    for (const row of chunk.events) {
      const [ms, kind, data] = row;
      if (!Number.isFinite(ms) || ms < 0 || typeof kind !== 'string') throw Error('Invalid replay event');
      if (ms < lastTime) issues.push('Time moved backwards');
      lastTime = ms; kinds[kind] = (kinds[kind] || 0) + 1;
      if (kind === 'state' && state) {
        for (const k of ['a', 'd', 'f']) if (data[k]) for (const [i, v] of data[k]) {
          if (!Number.isInteger(i) || i < 0 || i >= state[k].length) throw Error('Invalid tile edit');
          state[k][i] = v;
        }
        for (const k of ['tr', 'p', 'm', 'ob', 'ck']) if (Object.hasOwn(data, k)) state[k] = copy(data[k]);
      }
      if (kind === 'truncated') issues.push('Attempt exceeded the recording limit');
      if (kind === 'end') result = data.r;
      frames.push({ ms, kind, data: copy(data), state: state && copy(state) });
    }
  }
  if (!initial) issues.push('Missing initial board');
  else if (initial.partial) issues.push('Recording started from an older saved game');
  if (!result) issues.push('No recorded ending (ongoing, abandoned or interrupted attempt)');
  return { aid: [...ids][0], initial, state, result, kinds, frames, issues: [...new Set(issues)], complete: !issues.length,
    bytes: rows.reduce((n, r) => n + Buffer.byteLength(JSON.stringify(r)), 0) };
}
module.exports = { readReplay };
if (require.main === module) {
  try {
    const r = readReplay(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    const at = process.argv.indexOf('--frames');
    if (at >= 0) fs.writeFileSync(process.argv[at + 1], JSON.stringify(r.frames));
    console.log(JSON.stringify({ aid: r.aid, level: r.initial && r.initial.key, result: r.result,
      complete: r.complete, issues: r.issues, bytes: r.bytes, kinds: r.kinds }, null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
