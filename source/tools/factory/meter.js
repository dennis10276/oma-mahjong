'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

// Canonical keys ignore JSON property order and input tile notation.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
const digest = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function boardOf(d) {
  return { tiles: d.tiles.map(t => Array.isArray(t) ? t : [t.x, t.y, t.z]), faces: d.faces,
    down: [...(d.down || [])].sort((a, b) => a - b),
    obst: { ice: d.obst?.ice || {}, locks: [...(d.obst?.locks || [])].sort((a, b) => a - b), keys: d.obst?.keys || [] },
    clock: d.clock || null };
}
const boardKey = d => digest(boardOf(d));
// A changed policy is an explicit opt-in, with its own source fingerprint.
// Do not add behavioral candidates to FAMILY_CACHE_MIGRATIONS.
const BOT_VERSIONS = Object.freeze({
  'family-key-memory-v1': path.join(__dirname, '../sim/refit/human_bot_key_memory_v1.js'),
  'family-key-memory-v1-fast': path.join(__dirname, '../sim/refit/human_bot_key_memory_v1_fast.js')
});
// Task 04 / upstream 8e33270 changes the planner only. Family decisions and
// physics are identical. Permit this exact, documented revision pair only;
// any later bot/profile/environment change falls back to new measurements.
const FAMILY_CACHE_MIGRATIONS = Object.freeze({
  // 2026-11-07 Task G3: zero-drift CPU fast path for family-key-memory-v1 (post-G2 and pre-G2 slow key-memory hashes)
  '63be677ee17677754b17e9c835e8a0f757d1d5ec62738950bf2a2f5e4357413a': [
    '5372bd4e5d29acce926c537400b8a069dd0d04c3f4d2032024c9f34a1d99863d',
    'd362e85fba3d61523c54bc53a92745458e4467fb4a59624aad1312e9d9003ae3'
  ],
  // 2026-11-07 Task G2: zero-drift CPU fast path (identical family and planner moves and ratings)
  '4cf0b4c7057c2242f27fe529bb1885e4ad06cdf94588b79411cc06c522509e39': [
    'f32859281c746f4277ab5ef4c0006d43c76dddcc342741af8b0ff45a1b63d561',
    'cae3bc38f7b01e627e288330d5ba0cf210383e39e864ab35976e29faff64f83d',
    'ac24aad82490bab263850596afacb302f2f50b4b73464430c8e95962562808ef'
  ],
  // 2026-11-05 Claude: skilled planner = better of two styles, worked back from the clock; family unchanged
  'f32859281c746f4277ab5ef4c0006d43c76dddcc342741af8b0ff45a1b63d561':
    ['cae3bc38f7b01e627e288330d5ba0cf210383e39e864ab35976e29faff64f83d', 'ac24aad82490bab263850596afacb302f2f50b4b73464430c8e95962562808ef'],
  cae3bc38f7b01e627e288330d5ba0cf210383e39e864ab35976e29faff64f83d:
    ['ac24aad82490bab263850596afacb302f2f50b4b73464430c8e95962562808ef']
});
function sourceHash(entry) {
  const seen = new Set(), files = [];
  function visit(file) {
    if (seen.has(file)) return;
    seen.add(file);
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    files.push([path.relative(path.dirname(entry), file).replace(/\\/g, '/'), text]);
    for (const [, dep] of text.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
      if (dep.startsWith('.')) visit(require.resolve(path.resolve(path.dirname(file), dep)));
    }
  }
  visit(entry);
  return digest(files.sort(([a], [b]) => a.localeCompare(b)));
}
function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value));
  // Windows can briefly deny replacement while an antivirus/indexer or reader
  // holds the destination. Preserve atomic replacement and the old checkpoint;
  // retry only transient sharing errors, never delete the destination first.
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(tmp, file); break; }
    catch (e) {
      if (!['EPERM', 'EACCES', 'EBUSY'].includes(e.code) || attempt >= 7) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5 * 2 ** attempt);
    }
  }
}
function compact(m) {
  // Steering needs only the loss location and final tray. Avoid megabytes of
  // observations for every candidate while preserving the bot's actual ratings.
  const { results = [], ...rest } = m;
  return { ...rest, results: results.map(r => ({ wonOn: r.wonOn, attempts: r.attempts.map(a => ({
    win: a.win, censored: a.censored, why: a.why, left: a.left, clockLeft: a.clockLeft,
    decisions: (a.decisions || []).slice(-5).map(x => ({ index: x.index, state: { tray: x.state.tray } }))
  })) })) };
}
function createMeter(options = {}) {
  if (options.botVersion && (!BOT_VERSIONS[options.botVersion] || options.bot || options.measureHuman || options.fingerprint))
    throw Error('Unknown botVersion or conflicting explicit bot options');
  const entry = path.resolve(options.bot || BOT_VERSIONS[options.botVersion] || process.env.HUMAN_BOT || path.join(__dirname, '../sim/refit/human_bot.js'));
  const loaded = options.measureHuman ? null : require(entry);
  const bot = options.measureHuman || (options.fast === false ? (loaded.measureHumanSlow || loaded.measureHuman) : (loaded.measureHumanFast || loaded.measureHuman));
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('G51_')));
  const fingerprint = options.fingerprint || digest({ schema: 1, source: sourceHash(entry), env });
  const cacheDir = options.cacheDir === false ? null : path.resolve(options.cacheDir || path.join(__dirname, '../../build/factory-cache'));
  const memory = new Map(), stats = { calls: 0, hits: 0, seconds: 0, familyReused: 0 };
  function measure(board, opts) {
    const input = boardOf(board), settings = { runs: 20, seeds: 2, seed: 4711, ...opts };
    const key = digest({ fingerprint, input, settings });
    const file = cacheDir && path.join(cacheDir, key + '.json');
    if (memory.has(key)) { stats.hits++; return memory.get(key); }
    if (file && fs.existsSync(file)) {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      memory.set(key, saved); stats.hits++; return saved;
    }
    const approved = !options.measureHuman && !options.fingerprint &&
      (settings.setting === 'family' || settings.setting === 'family-key-memory-v1') ? FAMILY_CACHE_MIGRATIONS[fingerprint] || [] : [];
    if (cacheDir) for (const prior of approved) {
      const oldFile = path.join(cacheDir, digest({ fingerprint: prior, input, settings }) + '.json');
      if (!fs.existsSync(oldFile)) continue;
      const saved = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
      if (saved.valid !== true) continue;
      atomicJson(file, saved); memory.set(key, saved); stats.hits++; stats.familyReused++;
      return saved;
    }
    const started = Date.now(), m = compact(bot(input, settings));
    stats.calls++; stats.seconds += (Date.now() - started) / 1000;
    // Computation-censored or otherwise invalid results must be retried, never cached.
    if (m.valid === true) {
      memory.set(key, m);
      if (file) atomicJson(file, m);
    }
    return m;
  }
  return { measure, fingerprint, stats };
}
module.exports = { createMeter, boardKey, boardOf, digest, sourceHash, atomicJson, compact, FAMILY_CACHE_MIGRATIONS, BOT_VERSIONS };
