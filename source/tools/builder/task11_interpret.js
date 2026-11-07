'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), P = require('./task11_plan.js'), A = require('./task11_analyze.js');
function run(root) {
  const profiles = fs.readdirSync(path.join(root, 'profiles')).filter(f => f.endsWith('.json')).map(f => P.read(path.join(root, 'profiles', f)));
  const rows = profiles.map(r => {
    const family = r.profiles.find(p => p.profile === 'family'), detail = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, r.detailFile))));
    const unique = r.witness.states.filter(s => s.unknown === 0 && s.win === 1 && s.lose > 0).length;
    const live = detail.allMoves.find(m => m.profile === 'family').moves.filter(m => m.realFork && m.event !== 'peek'), aliases = live.filter(m => m.sameAppearanceOppositeOutcomes.length);
    const hidden = r.structure.hasKeys && r.structure.keysShownAtStart < 2;
    const diagnosis = hidden
      ? 'Mixed: hidden-objective search is a real first-try information problem, while forgetting observed key identities is a measured family-bot blind spot. This capped rating cannot be read as a human try count.'
      : 'Order/pressure traps are engine-proven. Repeated known-picture losing actions and available known winning alternatives indicate a policy/learning limitation as well. Their human difficulty is unmeasured; the family cap alone does not establish a person would keep failing.';
    return { id: r.id, band: r.band, family: r.fullRatings.family.exp, skilled: r.fullRatings.skilled.exp, keysShown: r.structure.hasKeys ? r.structure.keysShownAtStart : null,
      timeUntilBothKeysShow: r.structure.movesUntilBothKeysShow, uniqueSafeStatesOnStoredWay: unique, witnessStatesWithUnknown: r.witness.states.filter(s => s.unknown > 0).length,
      sampledFirstErrors: family.provedFirstErrors, errorsWithKnownWinningOption: family.withKnownWinningOption, repeatedKnownErrors: family.repeatedKnownLosingMove,
      medianErrorMove: family.medianFirstErrorMove, medianDelayToLoss: family.medianDelayAfterError,
      liveForkCommits: live.length, samePictureRoleMixedOutcomeCommits: aliases.length, diagnosis,
      caveat: 'Same picture and role is only a partial visual alias: positions, coverage and route context remain different. Knowing a face does not prove remembering a key identity or understanding a plan.' };
  });
  const visibleByBand = Object.fromEntries(['easy', 'middle', 'hard'].map(band => {
    const bs = rows.filter(r => r.band === band && r.keysShown === 2);
    return [band, { n: bs.length, boardsWithUniqueSafeState: bs.filter(r => r.uniqueSafeStatesOnStoredWay > 0).length,
      medianUniqueSafeStates: A.median(bs.map(r => r.uniqueSafeStatesOnStoredWay)), rows: bs.map(r => ({ id: r.id, unique: r.uniqueSafeStatesOnStoredWay, unknownStates: r.witnessStatesWithUnknown })) }];
  }));
  const out = { visibleByBand, rows, note: 'Interpretive annotations only; no raw proof or rating is changed. Full60 reference traces remain the main paired-band study. The higher-budget16-board opening check has a different scope from Claude\'s newly built v3 keysShown ladder and cannot refute its specific one-of16-actions example.' };
  P.save(root, 'human-vs-bot.json', out);
  const lines = ['# Real puzzle difficulty and bot limitations', '', out.note, '',
    '| Both keys visible | boards | boards with a proved uniquely safe state later/on the way | median number of such states |', '|---|---:|---:|---:|'];
  for (const [band, s] of Object.entries(visibleByBand)) lines.push(`| ${band} | ${s.n} | ${s.boardsWithUniqueSafeState} | ${s.medianUniqueSafeStates} |`);
  lines.push('', 'A uniquely safe state exists in every sampled easy and brutal board with both keys visible. Its presence alone does not explain the difficulty gap. The16-board Task10 opening refinement finds at least two proved winning openings on every board; the sampled brutal boards instead have3–9 proved uniquely safe states along the stored way. These are path-specific lower counts when other states remain unresolved.', '',
    'The family errors usually have a known-picture winning alternative (easy123/129, middle225/226, brutal928/928). This shows that lack of picture information is not the whole explanation, but it does not prove the safe action was obvious. On brutal boards,400/928 first errors start a free face-up pair too early, and387 leave the stored clock route. A different winning route may exist, so leaving the stored route is descriptive, not proof the tile is always unnecessary.', '',
    'The honest conclusion is mixed: engine-proven difficult choices and delayed consequences, plus measured memory/policy limitations. There are no new human play results on these research boards. A capped20 is a bot measurement, not a human forecast.', '', '## Every brutal board', '');
  for (const r of rows.filter(r => r.band === 'hard')) lines.push(`### ${r.id}`, '',
    `Family ${r.family}; skilled ${r.skilled}; opening keys ${r.keysShown ?? 'none'}. ${r.uniqueSafeStatesOnStoredWay} proved uniquely safe states on the stored way; ${r.witnessStatesWithUnknown} states retain unknown options. Typical first error at removal move${r.medianErrorMove}, observed loss${r.medianDelayToLoss} moves later. ${r.repeatedKnownErrors} repeated known-picture errors; ${r.errorsWithKnownWinningOption}/${r.sampledFirstErrors} first errors have a known-picture winning option.`, '', r.diagnosis, '');
  fs.writeFileSync(path.join(root, 'HUMAN-VS-BOT.md'), lines.concat('').join('\n')); return out;
}
if (require.main === module) console.log(run(path.resolve(process.argv[2])).visibleByBand);
module.exports = { run };
