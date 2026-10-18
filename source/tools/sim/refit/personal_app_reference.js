'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm'), assert = require('assert/strict');
const { designed } = require('./boards.js');
const { boardId } = require('./personal_model.js');
const root = path.resolve(__dirname, '../../..');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  const commit = process.argv[2];
  assert(/^[0-9a-f]{40}$/.test(commit), 'Use an explicitly verified immutable repository commit');
  const repository = 'dennis10276/oma-mahjong', api = 'https://api.github.com/repos/' + repository;
  const treeResponse = await fetch(api + '/git/trees/' + commit + '?recursive=1');
  if (!treeResponse.ok) throw new Error('Cannot read pinned repository tree: ' + treeResponse.status);
  const tree = await treeResponse.json();
  assert(!tree.truncated);
  const names = ['AGENTS.md', 'play/version.json', 'source/www/js/core.js', 'source/www/layouts.js',
    'source/www/hard.js', 'source/www/levels-hard.js', 'source/www/levels-early.js',
    'source/www/js/board.js', 'source/www/js/specials.js', 'source/www/js/rules.js'];
  const folder = path.join(root, 'analysis/archive/personal-bots/app-reference-' + commit);
  assert(!fs.existsSync(folder), 'Pinned app reference already exists; do not overwrite it');
  const downloads = await Promise.all(names.map(async name => {
    const entry = tree.tree.find(entry => entry.path === name);
    assert(entry?.type === 'blob');
    const response = await fetch('https://raw.githubusercontent.com/' + repository + '/' + commit + '/' + name);
    if (!response.ok) throw new Error('Cannot read pinned app file: ' + name + '/' + response.status);
    const bytes = Buffer.from(await response.arrayBuffer());
    const gitHash = crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
    assert.equal(gitHash, entry.sha, 'Pinned Git blob content differs: ' + name);
    return { name, bytes, gitBlob: gitHash, sha256: sha256(bytes) };
  }));
  fs.mkdirSync(folder, { recursive: true });
  for (const entry of downloads) {
    const destination = path.join(folder, entry.name);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, entry.bytes);
  }
  const manifest = { made: new Date().toISOString(), repository, commit,
    files: Object.fromEntries(downloads.map(entry => [entry.name, entry.sha256])),
    gitBlobs: Object.fromEntries(downloads.map(entry => [entry.name, entry.gitBlob])),
    note: 'Read-only immutable upstream app sources, verified against Git blob IDs. No source checkout, APK, release or player state is modified.' };
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const read = name => fs.readFileSync(path.join(folder, name), 'utf8');
  const version = read('source/www/js/core.js').match(/const APP_VERSION\s*=\s*['"]([^'"]+)/)?.[1];
  assert.equal(version, '1.58');
  assert.equal(JSON.parse(read('play/version.json')).v, version);
  const context = { console, Date: { now: () => 0 } };
  vm.createContext(context);
  vm.runInContext(read('source/www/layouts.js') + ';this.Layouts = Layouts;', context);
  vm.runInContext(read('source/www/hard.js') + ';this.Hard = Hard;', context);
  vm.runInContext(read('source/www/levels-hard.js') + ';this.HL = HARD_LEVELS;', context);
  vm.runInContext(read('source/www/levels-early.js'), context);
  const levels = [51, ...Array.from({ length: 217 }, (unused, index) => index + 53)], boards = [];
  for (const level of levels) {
    const generated = level >= context.HL.from ? context.Hard.get(level) : context.Hard.earlySpec(level).made;
    assert(generated);
    const tiles = generated.tiles.map(([x, y, z]) => ({ x, y, z })), nb = context.Layouts.neighbors(tiles);
    const down = new Uint8Array(tiles.length); generated.down.forEach(index => { down[index] = 1; });
    const obstacles = generated.obst;
    const rules = obstacles && (Object.keys(obstacles.ice || {}).length || (obstacles.keys || []).length)
      ? { iceNb: context.Layouts.iceNeighbors(tiles), ice: obstacles.ice || {},
        locks: (obstacles.keys || []).length ? new Set(obstacles.locks) : null, keys: obstacles.keys || [] } : null;
    const game = { tiles, nb, faces: generated.faces, down, rules, clock: generated.clock || null };
    const previous = designed('1.55', level);
    assert(previous);
    assert.equal(boardId(game), boardId(previous), 'App1.58 board differs at ' + level);
    assert.equal(JSON.stringify(game.nb), JSON.stringify(previous.nb), 'App1.58 physical neighbors differ at ' + level);
    assert.equal(JSON.stringify(game.rules?.iceNb), JSON.stringify(previous.rules?.iceNb), 'App1.58 ice neighbors differ at ' + level);
    boards.push({ level, board: boardId(game) });
  }
  const sourceFiles = ['tools/sim/refit/personal_app_reference.js', 'tools/sim/refit/boards.js',
    'tools/sim/refit/board_versions.js', 'tools/sim/refit/personal_model.js', 'www/layouts.js',
    'tools/sim/refit/tables/levels-1.55.js', 'tools/sim/refit/tables/hard-1.55.js', 'tools/sim/refit/tables/early-1.55.js'];
  const report = { made: new Date().toISOString(), evidence: 'immutable-upstream-fixed-board-compatibility', targetMet: false,
    repository, commit, version, equivalentTableVersion: '1.55', fixedLevelsChecked: boards.length, boards,
    upstream: path.relative(root, folder).replace(/\\/g, '/'), upstreamManifestSha256: sha256(fs.readFileSync(path.join(folder, 'manifest.json'))),
    sourceHashes: Object.fromEntries(sourceFiles.map(name => [name, sha256(fs.readFileSync(path.join(root, name)))])),
    note: 'All218 fixed normal-track boards51,53-269 match exact tiles, faces, down flags, ice, keys, locks, clock, neighbors and ice-neighbors. '
      + 'Remote release sources and version are pinned by commit/Git blob IDs, not inferred from one recording. '
      + 'This verifies board compatibility only, not a new fitted bot, forecast freeze, unchanged human behavior or80% accuracy.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/app158-compatibility.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ folder, commit, version, fixedLevelsChecked: boards.length }));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
