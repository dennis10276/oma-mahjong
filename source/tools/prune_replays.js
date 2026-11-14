/* 30-day replay cleanup. Dry run by default; --apply deletes only expired attempts.
   Uses indexed Firebase queries and expiry-only delete rules; no admin key or paid Function.
   --archive <dir> writes expired attempts to <dir>/replays/<pid>/<aid>.json before deletion.
   node tools/prune_replays.js [--apply] [--archive <dir>] */
'use strict';
const fs = require('fs'), path = require('path');
const config = require('./replay-retention.json');
const validKey = k => typeof k === 'string' && k.length > 0 && k.length <= 128 && !/[.#$\[\]/\u0000-\u001f\u007f]/.test(k);
// FIREBASE_DB_SECRET (a GitHub secret): needed only if reading replays is locked in the rules
const secret = process.env.FIREBASE_DB_SECRET || '';
async function pruneReplays({ base = config.databaseURL, now = Date.now(), apply = false, archiveDir = '', request = fetch,
  batch = config.attemptsPerBatch, maxDeletes = config.maxDeletesPerRun } = {}) {
  if (!Number.isFinite(now) || !Number.isInteger(batch) || batch < 1 || batch > 100 ||
      !Number.isInteger(maxDeletes) || maxDeletes < 1) throw Error('Invalid cleanup options');
  const cutoff = now - config.days * 86400000;
  const stats = { retentionDays: config.days, apply, cutoff: new Date(cutoff).toISOString(), players: 0, expired: 0, deleted: 0, archived: 0, downloadBytes: 0, dryRunMayHaveMore: false };
  async function get(path, params) {
    const url = new URL(path + '.json', base.replace(/\/$/, '') + '/');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (secret) url.searchParams.set('auth', secret);   // (only when reading is locked: see analysis/replay-access.md)
    const r = await request(url.href, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw Error('Cleanup read failed: HTTP ' + r.status);
    const raw = await r.text(); stats.downloadBytes += Buffer.byteLength(raw);
    if (Buffer.byteLength(raw) > 4 * 1024 * 1024) throw Error('Unexpectedly large cleanup response');
    return JSON.parse(raw);
  }
  // Shallow listing retrieves only player IDs, never the full replay tree.
  const players = await get('replays', { shallow: 'true' }) || {};
  for (const pid of Object.keys(players)) {
    if (!validKey(pid)) throw Error('Invalid player key');
    if (pid.startsWith('test-')) continue;
    stats.players++;
    while (true) {
      const attempts = await get(`replays/${encodeURIComponent(pid)}`, {
        orderBy: JSON.stringify('createdAt'), startAt: '0', endAt: String(cutoff), limitToFirst: String(batch),
      }) || {};
      const rows = Object.entries(attempts);
      if (rows.length > batch) throw Error('Cleanup query was not limited');
      // Validate the WHOLE response before deleting anything from it.
      for (const [aid, record] of rows) {
        if (!validKey(aid) || !record || !Number.isFinite(record.createdAt) || record.createdAt < 0 || record.createdAt > cutoff)
          throw Error('Refusing to delete an unverified or unexpired attempt');
      }
      stats.expired += rows.length;
      if (!apply && rows.length === batch) stats.dryRunMayHaveMore = true;
      if (!apply || !rows.length) break;
      for (const [aid, record] of rows) {
        if (stats.deleted >= maxDeletes) throw Error('Cleanup safety limit reached; rerun for remaining expired attempts');
        if (archiveDir) {
          const targetDir = path.join(archiveDir, 'replays', pid);
          fs.mkdirSync(targetDir, { recursive: true });
          fs.writeFileSync(path.join(targetDir, `${aid}.json`), JSON.stringify(record, null, 2) + '\n');
          stats.archived++;
        }
        const url = `${base.replace(/\/$/, '')}/replays/${encodeURIComponent(pid)}/${encodeURIComponent(aid)}.json` + (secret ? `?auth=${encodeURIComponent(secret)}` : '');
        const r = await request(url, { method: 'DELETE', signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw Error('Cleanup delete failed: HTTP ' + r.status);
        stats.deleted++;
      }
      if (rows.length < batch) break;
    }
  }
  return stats;
}
module.exports = { pruneReplays, config };
if (require.main === module) {
  const args = process.argv.slice(2);
  let apply = false, archiveDir = '', bad = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apply') apply = true;
    else if (args[i] === '--archive' && i + 1 < args.length) archiveDir = args[++i];
    else if (args[i].startsWith('--archive=')) archiveDir = args[i].slice('--archive='.length);
    else { bad = true; break; }
  }
  if (bad) {
    console.error('Usage: node tools/prune_replays.js [--apply] [--archive <dir>]');
    process.exitCode = 1;
  } else {
    pruneReplays({ apply, archiveDir }).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.message); process.exitCode = 1; });
  }
}
