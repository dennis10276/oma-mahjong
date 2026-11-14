'use strict';
// Read-only source collection. Writes only beside this script.
// No builder execution, tuning, ratings changes, level placement or network
// writes. Local HTTP GETs verify the two labs' served board manifests.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const OUT = __dirname, ROOT = path.resolve(OUT, '../../..'), SHARED = path.dirname(ROOT);
const CC = path.join(SHARED, 'cc-builder-loop'), T17 = path.join(SHARED, 'codex-chained-2');
const sha = x => crypto.createHash('sha256').update(typeof x === 'string' || Buffer.isBuffer(x) ? x : JSON.stringify(x)).digest('hex');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, x) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(x, null, 2) + '\n');
function ideas(text) {
  const json = text.trim().replace(/^(?:const|let|var)\s+LAB_IDEAS\s*=\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(json);
}
const sorted = a => (a || []).slice().sort((a, b) => a - b);
function board(d, renamed = false, ignoreClockNumber = false) {
  const ids = new Map(), faces = d.faces.map(f => { if (!ids.has(f)) ids.set(f, ids.size); return renamed ? ids.get(f) : f; });
  return { tiles: d.tiles.map(t => Array.isArray(t) ? t : [t.x, t.y, t.z]), faces, down: sorted(d.down),
    ...(!renamed ? { gold: sorted(d.gold) } : {}),
    obst: { ice: Object.entries(d.obst?.ice || {}).map(([i, h]) => [+i, h]).sort((a, b) => a[0] - b[0]), locks: sorted(d.obst?.locks), keys: sorted(d.obst?.keys) },
    clock: d.clock ? { i: d.clock.i, ...(!ignoreClockNumber ? { n: d.clock.n } : {}) } : null };
}
const exact = d => sha(board(d));
const pairing = d => sha(board(d, true));
const noClockNumber = d => sha(board(d, true, true));
const geometry = d => { const b = board(d); return sha({ tiles: b.tiles, obst: b.obst, clockTile: b.clock?.i }); };
function symmetricPairing(d) {
  const T = board(d).tiles, min = [0, 1, 2].map(k => Math.min(...T.map(t => t[k]))), max = [0, 1].map(k => Math.max(...T.map(t => t[k])));
  const variants = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const ids = new Map(), down = new Set(d.down), lock = new Set(d.obst?.locks), key = new Set(d.obst?.keys);
    const rows = T.map((t, i) => ({ i, p: [sx === 1 ? t[0] - min[0] : max[0] - t[0], sy === 1 ? t[1] - min[1] : max[1] - t[1], t[2] - min[2]] })).sort((a, b) => a.p[2] - b.p[2] || a.p[1] - b.p[1] || a.p[0] - b.p[0]);
    variants.push(JSON.stringify(rows.map(({ i, p }) => { const f = d.faces[i]; if (!ids.has(f)) ids.set(f, ids.size); return { p, f: ids.get(f), down: down.has(i), ice: d.obst?.ice?.[i] || 0, lock: lock.has(i), key: key.has(i), clock: d.clock?.i === i }; })));
  }
  return sha(variants.sort()[0]);
}
function levels(dir, min, max) {
  return fs.readdirSync(dir).filter(f => /^level-\d+\.json$/.test(f)).map(f => ({ file: path.join(dir, f), ...read(path.join(dir, f)) })).filter(j => j.level >= min && j.level <= max);
}
function resultCounts(r) {
  const types = {}; for (const x of r.results || []) types[x.r] = (types[x.r] || 0) + 1;
  return { completedRecords: (r.results || []).length, types, startsCounter: r.starts || 0, triesCounter: r.tries || 0, winsCounter: r.wins || 0 };
}
function commit(dir) { return cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim(); }
async function main() {
  const raw10File = path.join(CC, 'source/build/try-lab-10-findings.json'), raw17File = path.join(T17, 'source/build/chained-v2-lab-findings.json');
  const raw10Text = fs.readFileSync(raw10File, 'utf8'), raw17Text = fs.readFileSync(raw17File, 'utf8');
  const raw10 = JSON.parse(raw10Text), raw17 = JSON.parse(raw17Text);
  fs.writeFileSync(path.join(OUT, 'port8264-raw.json'), raw10Text);
  fs.writeFileSync(path.join(OUT, 'task17-raw.json'), raw17Text);
  const lab10Disk = fs.readFileSync(path.join(CC, 'source/build/try-lab-10/lab-ideas.js'), 'utf8');
  const lab17Disk = fs.readFileSync(path.join(T17, 'source/build/chained-v2-lab/lab-ideas.js'), 'utf8');
  const http = [];
  for (const [port, disk] of [[8264, lab10Disk], [8265, lab17Disk]]) {
    const url = `http://127.0.0.1:${port}/lab-ideas.js`;
    try { const r = await fetch(url), text = await r.text(); http.push({ port, url, status: r.status, matchesDisk: sha(text) === sha(disk), servedSha256: sha(text), diskSha256: sha(disk) }); }
    catch (e) { http.push({ port, url, error: String(e) }); }
  }
  const lab10 = ideas(lab10Disk), lab17 = ideas(lab17Disk);
  write('port8264-served-boards.json', lab10);
  write('task17-served-boards.json', lab17);
  const placed250 = levels(path.join(CC, 'source/analysis/builder/bank/placed-250-B'), 250, 302);
  const placed303 = levels(path.join(CC, 'source/analysis/builder/bank/placed-303'), 303, 331);
  const earlier300 = placed250.filter(j => j.level <= 300);
  const mappings10 = lab10.ideas.map(it => {
    const hash = exact(it.board), matches = placed250.concat(placed303).filter(j => exact(j.design) === hash);
    const r = raw10.ratings[String(it.id)] || null;
    return { id: it.id, labelLevel: it.lv, title: it.title, boardSha256: hash, solutionSha256: sha(it.board.solution), exactPlacedMatches: matches.map(j => ({ level: j.level, source: j.source })),
      rating: r, counters: r ? resultCounts(r) : null };
  });
  write('port8264-mapping.json', { sourceSavedAt: raw10.savedAt, labMade: lab10.made, records: mappings10 });
  const mapping17 = read(path.join(T17, 'source/analysis/builder/bank/chained-v2/lab-selection-original.json'));
  const current17 = read(path.join(T17, 'codex-tasks/results/chained-2/lab-findings.json'));
  const records17 = mapping17.map(m => {
    const it = lab17.ideas.find(x => x.id === m.id), r = raw17.ratings[String(m.id)];
    if (!it) throw new Error('Task17 original ID missing from served page: ' + m.id);
    return { ...m, boardSha256: exact(it.board), rating: r || null, counters: r ? resultCounts(r) : null,
      reportMatchesLiveRating: JSON.stringify(current17.records.find(x => x.id === m.id)?.rating) === JSON.stringify(r) };
  });
  write('task17-mapping.json', { sourceSavedAt: raw17.savedAt, labMade: lab17.made, records: records17 });
  const duplication = placed303.map(j => ({ level: j.level, source: j.source,
    exactMatches250to300: earlier300.filter(x => exact(x.design) === exact(j.design)).map(x => x.level),
    samePairingAndClock250to300: earlier300.filter(x => pairing(x.design) === pairing(j.design)).map(x => x.level),
    samePairingIgnoringClockNumber250to300: earlier300.filter(x => noClockNumber(x.design) === noClockNumber(j.design)).map(x => x.level),
    samePairingAllowingMirrorsAndRenumbering250to300: earlier300.filter(x => symmetricPairing(x.design) === symmetricPairing(j.design)).map(x => x.level),
    sameGeometryAndSpecials250to300: earlier300.filter(x => geometry(x.design) === geometry(j.design)).map(x => x.level) }));
  write('reuse-audit.json', { earlierRange: [250, 300], comparedRange: [303, 331],
    definitions: { exact: 'indexed tile positions, picture IDs, down, gold, ice, locks, keys, clock tile and number; arrays of sets sorted; solution excluded',
      pairing: 'same as exact but picture IDs canonicalised by first occurrence, gold excluded',
      pairingIgnoringClockNumber: 'pairing fingerprint with clock number excluded',
      symmetricPairing: 'canonical coordinate-sorted pairing and specials, allowing tile renumbering, picture relabeling, translation and horizontal/vertical reflection; gold and clock number ignored',
      geometryAndSpecials: 'positions, ice, locks, keys and clock tile only; pictures, down, gold and clock number excluded; a match does not prove the same puzzle or the same AHA' }, records: duplication });
  const rawFiles = [raw10File, raw17File,
    path.join(CC, 'source/analysis/builder/LEVEL-DESIGN-FACTS.md'),
    path.join(CC, 'source/analysis/builder/bank/placed-250-B/level-250.json'),
    path.join(CC, 'source/analysis/builder/bank/placed-303/placed.md'),
    path.join(T17, 'codex-tasks/results/chained-2/REPORT.md'),
    path.join(T17, 'codex-tasks/results/chained-2/LAB-FINDINGS.md'),
    path.join(T17, 'codex-tasks/results/chained-2/validation.json')];
  write('snapshot.json', { collectedAtUtc: new Date().toISOString(), branches: { claude: commit(CC), task17: commit(T17), handoffBase: commit(ROOT) }, http,
    rawSources: rawFiles.map(file => ({ path: file, sha256: sha(fs.readFileSync(file)) })),
    port8264: { writtenNotes: mappings10.filter(x => x.rating?.note?.trim()).length, servedIdeas: lab10.ideas.length },
    task17: { writtenOriginalNotes: records17.filter(x => x.rating?.note?.trim()).length, allReportedRatingsMatchLive: records17.every(x => x.reportMatchesLiveRating) },
    level327: duplication.find(x => x.level === 327) });
  console.log(JSON.stringify({ port8264Notes: mappings10.filter(x => x.rating?.note?.trim()).length, task17Notes: records17.filter(x => x.rating?.note?.trim()).length, http, level327: duplication.find(x => x.level === 327) }, null, 2));
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
