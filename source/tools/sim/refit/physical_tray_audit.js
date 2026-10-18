'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const L = require('../../../www/layouts.js');
const root = path.resolve(__dirname, '../../..');

function visibleKnowledge(game, state, known) {
  for (let index = 0; index < game.faces.length; index++) if (state.alive[index]
    && ((!game.down[index] && !game.nb.above[index].some(above => state.alive[above]
      && game.tiles[above].x === game.tiles[index].x && game.tiles[above].y === game.tiles[index].y)) || state.openPeek === index)) known[index] = 1;
}

function exitsOf(game, state, known, relieved = false) {
  const initial = Array(game.faces.length).fill(1);
  const geometric = game.faces.map((face, index) => index).filter(index => state.alive[index] && L.isFree(index, state.alive, game.nb));
  const legal = !game.rules || relieved ? geometric : geometric.filter(index => L.takeable(index, state.alive, game.nb, game.rules, initial));
  if (!legal.length && geometric.length && game.rules) relieved = true;
  const free = relieved ? geometric : legal;
  const matches = free.filter(index => known[index] && state.tray.includes(game.faces[index]));
  const pairs = free.flatMap((left, position) => free.slice(position + 1).filter(right => known[left] && known[right]
    && game.faces[left] === game.faces[right] && (state.tray.length < 3 || game.down[left] || game.down[right])).map(right => [left, right]));
  const novel = free.filter(index => game.down[index] && !known[index]);
  return { relieved, matches, pairs, novel, kind: matches.length || pairs.length ? 'knownSafeExit' : novel.length ? 'novelInspection' : 'noKnownExit' };
}

function auditTrace(game, frames, result) {
  if (game.faces.some(face => face >= 100)) return { excluded: 'wildcardPhysics' };
  let state = { alive: Array(game.faces.length).fill(1), tray: [], openPeek: -1, moves: 0 }, relieved = false;
  const known = game.memory ? [...game.memory] : Array(game.faces.length).fill(0);
  let fatal = null, clockExit = null, passedKnownMatches = 0, thirdSlotsWithoutKnownExit = 0;
  for (const frame of frames) {
    visibleKnowledge(game, state, known);
    const before = exitsOf(game, state, known, relieved);
    relieved = before.relieved;
    const clockAlive = !!(game.clock && state.alive[game.clock.i]);
    if (!clockAlive && before.matches.length && !before.matches.includes(frame.index) && frame.kind === 'take') passedKnownMatches++;
    if (frame.tray.length >= 4 && state.tray.length < 4) fatal = { exitClass: before.kind,
      moves: state.moves, left: state.alive.reduce((sum, value) => sum + value, 0), clockAlive,
      knownMatches: before.matches.length, knownPairs: before.pairs.length, novelInspections: before.novel.length };
    known[frame.index] = 1;
    for (let index = 0; index < frame.alive.length; index++) if (state.alive[index] && !frame.alive[index]) known[index] = 1;
    visibleKnowledge(game, frame, known);
    const after = exitsOf(game, frame, known, relieved);
    relieved = after.relieved;
    if (frame.tray.length === 3 && state.tray.length < 3 && after.kind !== 'knownSafeExit') thirdSlotsWithoutKnownExit++;
    if (clockAlive && !frame.alive[game.clock.i]) clockExit = { tray: frame.tray.length, exitClass: after.kind,
      left: frame.alive.reduce((sum, value) => sum + value, 0) };
    state = frame;
  }
  return { why: result.why, left: result.left, fatal, clockExit, passedKnownMatches, thirdSlotsWithoutKnownExit };
}

function summarize(rows) {
  const eligible = rows.filter(row => !row.excluded), fatal = eligible.filter(row => row.fatal), clock = eligible.filter(row => row.clockExit);
  return { runs: rows.length, eligible: eligible.length, excluded: rows.length - eligible.length,
    endings: Object.fromEntries([...new Set(eligible.map(row => row.why))].sort().map(why => [why, eligible.filter(row => row.why === why).length])),
    fatalOverflow: fatal.length, fatalExits: Object.fromEntries(['knownSafeExit', 'novelInspection', 'noKnownExit']
      .map(kind => [kind, fatal.filter(row => row.fatal.exitClass === kind).length])),
    trayLossNearEnd12: eligible.filter(row => row.why === 'tray' && row.left <= 12).length,
    trayLossFarFromEnd: eligible.filter(row => row.why === 'tray' && row.left > 12).length,
    passedKnownMatches: eligible.reduce((sum, row) => sum + row.passedKnownMatches, 0),
    thirdSlotsWithoutKnownExit: eligible.reduce((sum, row) => sum + row.thirdSlotsWithoutKnownExit, 0),
    clockCleared: clock.length, clockExitWithThreeAndNoKnownExit: clock.filter(row => row.clockExit.tray === 3
      && row.clockExit.exitClass !== 'knownSafeExit').length };
}

function main() {
  const runs = +(process.argv[2] || 16), pinned = path.resolve(process.argv[3] || path.join(root,
    'analysis/archive/personal-bots/experiments/physical-clock-2026-10-17T09-52-02-603Z'));
  const experiment = process.argv[4] || 'clock';
  if (!['clock', 'finish'].includes(experiment)) throw new Error('Unknown pinned tray experiment');
  if (!Number.isInteger(runs) || runs < 2) throw new Error('At least two diagnostic runs required');
  const dataFile = path.join(pinned, 'analysis/archive/personal-bots/physical-' + experiment + '-count-data.json'), dataRaw = fs.readFileSync(dataFile), data = JSON.parse(dataRaw);
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of data.fingerprintFiles) digest.update(fs.readFileSync(path.join(pinned, file)));
    return digest.digest('hex');
  };
  if (fingerprintOf() !== data.fingerprint) throw new Error('Pinned measurement inputs changed');
  if (!fs.readFileSync(path.join(root, 'www/layouts.js')).equals(fs.readFileSync(path.join(pinned, 'www/layouts.js')))) throw new Error('Audit geometry differs from pinned engine');
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  const Hard = require(path.join(pinned, 'www/hard.js'));
  const { tasksOf, selectModels, actorOf } = require(path.join(pinned, 'tools/sim/refit/physical_count_data.js'));
  const { NAMES } = require(path.join(pinned, 'tools/sim/refit/personal_model.js'));
  const bank = JSON.parse(fs.readFileSync(path.join(pinned, 'analysis/archive/personal-bots/physical-policy-bank.json'), 'utf8'));
  const held = new Set(data.comparisonEpisodes), tasks = tasksOf().filter(row => held.has(row.name + '|' + row.start));
  const rows = tasks.map(row => {
    const models = selectModels(bank, row);
    const profiles = { physicalNovel: actorOf(models.novel), physicalNovelPlan14: { ...actorOf(models.novel), physicalPlan: 14 },
      ...Object.fromEntries(Object.entries(data.profiles).filter(([, profile]) => profile.physicalSafety)
        .map(([name, { scope, ...parameters }]) => [name, { ...actorOf(models[scope]), ...parameters }])) };
    const simulations = Object.fromEntries(Object.entries(profiles).map(([profile, actor]) => [profile,
      Array.from({ length: runs }, (_, index) => {
        const game = { ...row.game, physicalLog: [] }, result = Hard.play(game, actor, 20261028 * 7919 + index * 104729);
        return auditTrace(game, game.physicalLog, result);
      })]));
    return { name: row.name, lv: row.lv, start: row.start, board: row.board, simulations };
  });
  if (fingerprintOf() !== data.fingerprint || !dataRaw.equals(fs.readFileSync(dataFile))
    || sourceHash !== crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')) throw new Error('Tray audit inputs changed');
  const players = Object.fromEntries(NAMES.map(name => [name, Object.fromEntries(Object.keys(rows.find(row => row.name === name)?.simulations || {})
    .map(profile => [profile, summarize(rows.filter(row => row.name === name).flatMap(row => row.simulations[profile]))]))]));
  const report = { made: new Date().toISOString(), evidence: 'pre-fatal-mechanism-diagnostic', pinned, runs, sourceHash,
    measurementFingerprint: data.fingerprint, dataSha256: crypto.createHash('sha256').update(dataRaw).digest('hex'), players, rows,
    note: 'Pre-action knowledge is reconstructed from actual physical taps and actually visible pictures, not hypothetical or future reveals. Ordinary-picture boards only; wildcard boards are explicitly excluded from this mechanism audit, not from count scoring. Novel inspection is an information opportunity, not a guaranteed escape. Passing a match is not automatically a mistake. No forecast or winning-attempt score is changed.' };
  fs.writeFileSync(path.join(root, experiment === 'finish' ? 'analysis/personal-bots/physical-finish-tray-audit.json' : 'analysis/personal-bots/physical-tray-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(players, null, 2));
}

if (require.main === module) main();
module.exports = { visibleKnowledge, exitsOf, auditTrace, summarize };
