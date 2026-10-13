/* 30-day replay cleanup. Dry run by default; --apply deletes only expired attempts.
   Uses indexed Firebase queries and expiry-only delete rules; no admin key or paid Function.
   node tools/prune_replays.js [--apply] */
'use strict';
const config = require('./replay-retention.json');
const validKey = k => typeof k === 'string' && k.length > 0 && k.length <= 128 && !/[.#$\[\]/\u0000-\u001f\u007f]/.test(k);
async function pruneReplays({ base = config.databaseURL, now = Date.now(), apply = false, request = fetch,
  batch = config.attemptsPerBatch, maxDeletes = config.maxDeletesPerRun } = {}) {
  if (!Number.isFinite(now) || !Number.isInteger(batch) || batch < 1 || batch > 100 ||
      !Number.isInteger(maxDeletes) || maxDeletes < 1) throw Error('Invalid cleanup options');
  const cutoff = now - config.days * 86400000;
  const stats = { retentionDays: config.days, apply, cutoff: new Date(cutoff).toISOString(), players: 0, expired: 0, deleted: 0, downloadBytes: 0, dryRunMayHaveMore: false };
  async function get(path, params) {
    const url = new URL(path + '.json', base.replace(/\/$/, '') + '/');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
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
      for (const [aid] of rows) {
        if (stats.deleted >= maxDeletes) throw Error('Cleanup safety limit reached; rerun for remaining expired attempts');
        const url = `${base.replace(/\/$/, '')}/replays/${encodeURIComponent(pid)}/${encodeURIComponent(aid)}.json`;
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
  if (process.argv.slice(2).some(a => a !== '--apply')) { console.error('Usage: node tools/prune_replays.js [--apply]'); process.exitCode = 1; }
  else pruneReplays({ apply: process.argv.includes('--apply') }).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.message); process.exitCode = 1; });
}
