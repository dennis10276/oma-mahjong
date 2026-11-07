'use strict';
const fs = require('fs'), path = require('path'), P = require('./task11_plan.js'), A = require('./task11_analyze.js');
function run(root) {
  const rows = fs.readdirSync(path.join(root, 'profiles')).filter(f => f.endsWith('.json')).map(f => P.read(path.join(root, 'profiles', f))), out = [];
  for (const band of ['easy', 'middle', 'hard']) for (const player of ['family', 'planner']) for (const [bin, lo, hi] of [['first', 1, 1], ['tries2–5', 2, 5], ['tries6–20', 6, 20]]) {
    const boards = rows.filter(r => r.band === band).map(r => {
      const p = r.profiles.find(p => p.profile === (player === 'family' ? 'family' : r.preferredPlanner)), attempts = p.attemptProfiles.filter(a => a.attempt >= lo && a.attempt <= hi);
      return { id: r.id, attempts, medianKnownRoute: A.median(attempts.map(a => a.knownRouteAtStart)), medianKnownAlive: A.median(attempts.map(a => a.knownAliveAtStart)) };
    }).filter(b => b.attempts.length);
    const attempts = boards.flatMap(b => b.attempts), errors = attempts.filter(a => a.firstError && !a.recovery).map(a => a.firstError);
    out.push({ band, player, bin, boardsPresent: boards.length, attempts: attempts.length, wins: attempts.filter(a => a.win).length,
      medianBoardOpeningKnownRoute: A.median(boards.map(b => b.medianKnownRoute)), medianBoardOpeningKnownAlive: A.median(boards.map(b => b.medianKnownAlive)),
      firstErrors: errors.length, repeatedKnownErrors: errors.filter(e => e.repeatedSameLosingMove && e.knownChoice).length,
      firstErrorsWithKnownWinningOption: errors.filter(e => e.knownWinningOptions > 0).length, medianErrorRemoval: A.median(errors.map(e => e.removalMove)),
      medianFurtherRemovalsUntilLoss: A.median(errors.map(e => e.actualDelayToTerminal)) });
  }
  const value = { rows: out, note: 'Reference diagnostic samples only, not new ratings. Known route/pictures are measured after the opening observation and include currently visible faces as well as retry memory. Board medians prevent long failing campaigns from dominating familiarity. Later bins contain only campaigns that have not already won; denominators/boards differ. These are descriptive survivor-selected comparisons, not causal memory gains. Remembered key identity and known pictures remain separate.' };
  P.save(root, 'memory-across-tries.json', value);
  const pct = v => v == null ? 'unresolved' : (100 * v).toFixed(1) + '%';
  const lines = ['# What changes across retries?', '', value.note, '',
    '| Band / player | tries | boards / attempts | wins | opening known planned route, median board | first errors | repeated known-picture errors | known winning option at first error |', '|---|---|---:|---:|---:|---:|---:|---:|'];
  for (const r of out) lines.push(`| ${r.band} / ${r.player} | ${r.bin} | ${r.boardsPresent}/${r.attempts} | ${r.wins} | ${pct(r.medianBoardOpeningKnownRoute)} | ${r.firstErrors} | ${r.repeatedKnownErrors} | ${r.firstErrorsWithKnownWinningOption} |`);
  lines.push('', 'Picture familiarity can increase while a player repeats an earlier losing action. The reference family has no retained static key identity; the separate candidate repairs that knowledge channel and is compared on the same ten boards in candidate/MEMORY-COMPARISON.md. Known faces alone do not establish a remembered key role or a correctly understood route.', '');
  fs.writeFileSync(path.join(root, 'MEMORY-ACROSS-TRIES.md'), lines.join('\n')); return value;
}
if (require.main === module) console.log(run(path.resolve(process.argv[2])).rows.filter(r => r.player === 'family'));
module.exports = { run };
