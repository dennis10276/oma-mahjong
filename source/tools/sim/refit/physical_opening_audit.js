'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../../..');

function main() {
  const runs = +(process.argv[2] || 32), pinned = path.resolve(process.argv[3]
    || fs.readFileSync(path.join(root, 'analysis/archive/personal-bots/physical-finish-run-path.txt'), 'utf8').trim());
  if (!Number.isInteger(runs) || runs < 2) throw new Error('At least two opening diagnostic runs required');
  const dataFile = path.join(pinned, 'analysis/archive/personal-bots/physical-finish-count-data.json');
  const dataRaw = fs.readFileSync(dataFile), data = JSON.parse(dataRaw);
  const fingerprintOf = () => {
    const digest = crypto.createHash('sha256');
    for (const file of data.fingerprintFiles) digest.update(fs.readFileSync(path.join(pinned, file)));
    return digest.digest('hex');
  };
  if (fingerprintOf() !== data.fingerprint) throw new Error('Pinned finishing measurement changed');
  const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
  const Hard = require(path.join(pinned, 'www/hard.js'));
  const { recordings } = require(path.join(pinned, 'tools/sim/refit/personal_prefix_data.js'));
  const { selectModels, actorOf } = require(path.join(pinned, 'tools/sim/refit/physical_count_data.js'));
  const bank = JSON.parse(fs.readFileSync(path.join(pinned, 'analysis/archive/personal-bots/physical-policy-bank.json'), 'utf8'));
  const requests = JSON.parse(fs.readFileSync(path.join(pinned, 'analysis/archive/personal-bots/physical-count-requests.json'), 'utf8')).requests;
  const rows = [], missing = [];
  for (const [name, games] of Object.entries(recordings())) for (const recorded of games) {
    if (!['Dennisisdebeste', 'Mrs. Doubtfire'].includes(name) || !recorded.initialNewLevel || !recorded.g.clock
      || recorded.g.faces.some(face => face >= 100)) continue;
    const request = requests.find(row => row.name === name && row.start === recorded.t);
    if (!request) { missing.push({ name, lv: recorded.lv, aid: recorded.aid }); continue; }
    const models = selectModels(bank, request), clockIndex = recorded.g.clock.i;
    const actual = recorded.actions.find(frame => !frame.alive[clockIndex]);
    const simulations = Object.fromEntries(['physicalNovelPlan14', 'physicalFinish95'].map(profile => [profile,
      Array.from({ length: runs }, (_, sample) => {
        const game = { ...recorded.g, physicalLog: [] };
        const result = Hard.play(game, { ...actorOf(models.novel), physicalPlan: 14,
          ...(profile === 'physicalFinish95' ? { physicalSafety: 0.95 } : {}) }, 20261028 * 7919 + sample * 104729);
        const frame = game.physicalLog.find(item => !item.alive[clockIndex]);
        return { why: result.why, firstTapSame: game.physicalLog[0]?.index === recorded.actions[0]?.index,
          firstTap: game.physicalLog[0]?.index, clockTray: frame?.tray.length ?? null, clockMoves: frame?.moves ?? null };
      })]));
    rows.push({ name, lv: recorded.lv, aid: recorded.aid, start: recorded.t, ending: recorded.ending, stopReason: recorded.stopReason,
      firstTap: recorded.actions[0]?.index, clockTray: actual?.tray.length ?? null, clockMoves: actual?.moves ?? null, simulations });
  }
  if (fingerprintOf() !== data.fingerprint || !dataRaw.equals(fs.readFileSync(dataFile))
    || sourceHash !== crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')) throw new Error('Opening audit inputs changed');
  const histogram = values => Object.fromEntries([0, 1, 2, 3].map(count => [count, values.filter(value => value === count).length]));
  const players = Object.fromEntries(['Dennisisdebeste', 'Mrs. Doubtfire'].map(name => {
    const own = rows.filter(row => row.name === name);
    return [name, { recordedFirstTries: own.length, actualClockCleared: own.filter(row => row.clockTray !== null).length,
      actualClockTray: histogram(own.map(row => row.clockTray)), profiles: Object.fromEntries(['physicalNovelPlan14', 'physicalFinish95'].map(profile => {
        const simulated = own.flatMap(row => row.simulations[profile]);
        return [profile, { runs: simulated.length, clockCleared: simulated.filter(row => row.clockTray !== null).length,
          firstTapSame: simulated.filter(row => row.firstTapSame).length, clockTray: histogram(simulated.map(row => row.clockTray)),
          wins: simulated.filter(row => row.why === 'win').length }];
      })) }];
  }));
  const report = { made: new Date().toISOString(), evidence: 'opening-mechanism-diagnostic', pinned, runs, sourceHash,
    measurementFingerprint: data.fingerprint, players, rows, missing,
    note: 'Natural first-clear first-attempt clock prefixes, including restarts/incomplete/assisted-ending prefixes before help. The frozen actor starts from the initial board and never receives the human tap sequence. Actual clock-tray state is compared only after simulation. First-tap agreement is not winning-attempt accuracy, and different openings can be equally valid. No forecasts or count scores change.' };
  fs.writeFileSync(path.join(root, 'analysis/personal-bots/physical-opening-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(players, null, 2));
  console.log('Missing pre-opening models:', missing.length);
}

if (require.main === module) main();
