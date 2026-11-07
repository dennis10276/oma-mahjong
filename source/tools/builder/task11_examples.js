'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), M = require('../factory/meter.js'), P = require('./task11_plan.js');
function prepare(root) {
  const selection = P.read(path.join(root, 'selection-plan.json')), profiles = fs.readdirSync(path.join(root, 'profiles')).filter(f => f.endsWith('.json')).map(f => P.read(path.join(root, 'profiles', f)));
  const hard = profiles.filter(r => r.band === 'hard'), chosen = [], add = (kind, options) => {
    options.sort((a, b) => b.fullRatings.family.exp - a.fullRatings.family.exp || b.fullRatings.skilled.exp - a.fullRatings.skilled.exp || a.id.localeCompare(b.id));
    const r = options.find(r => !chosen.some(c => c.profile.id === r.id)); if (r) chosen.push({ kind, profile: r });
  };
  const reference = profiles.find(r => r.id === 'keysFarSide-w14-t5-l0-x0-s1');
  if (reference) chosen.push({ kind: 'hidden key: replay learning', profile: reference }); else add('hidden key: replay learning', hard.filter(r => r.structure.hasKeys && r.structure.keysShownAtStart === 0));
  add('both keys visible: route order', hard.filter(r => r.structure.hasKeys && r.structure.keysShownAtStart === 2));
  add('no keys: pressure and planning', hard.filter(r => !r.structure.hasKeys));
  if (chosen.length < 2) throw Error('Need at least two measured diagnostic examples');
  const examples = [], rows = [], guide = ['# Playable diagnostic examples', '',
    'These are original Task10 study puzzles, not qualified new levels. Their level numbers9001–9003 are local study labels. The published game table is untouched. Family/skilled ratings use the released reference bot, before the separately tested key-memory candidate.', '',
    'Tile numbers in this guide are one-based; stored action arrays remain zero-based. A repeated tile number can be turning it over and then taking it. Removal moves count tiles removed; physical taps count every look and take. Winning alternatives are omniscient engine proofs; whether their pictures were available is recorded separately.', ''];
  for (const [index, x] of chosen.entries()) {
    const r = x.profile, b = selection.boards.find(b => b.id === r.id), p = r.profiles.find(p => p.profile === 'family');
    const attempt = p.attemptProfiles.find(a => a.firstError && !a.recovery && !a.engineMismatches), e = attempt?.firstError;
    if (!e) throw Error('Example lacks an interpretable first error');
    const detail = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, r.detailFile))));
    const cls = detail.states[e.state], describe = i => ({ tile: i + 1, index: i, coordinates: b.design.tiles[i], picture: b.design.faces[i] });
    const wins = cls.options.filter(o => o.result === 'win').map(o => ({ action: o.move, tiles: (typeof o.move === 'number' ? [o.move] : o.move.pair).map(describe),
      picturesAvailable: (typeof o.move === 'number' ? [o.move] : o.move.pair).every(i => e.known[i] === b.design.faces[i]) }));
    const example = { label: String.fromCharCode(65 + index), studyLevel: 9001 + index, id: r.id, kind: x.kind, referenceRatings: r.fullRatings,
      structure: r.structure, campaign: e.campaign + 1, try: e.attempt, physicalTap: e.tap, removalMove: e.removalMove, chosen: describe(e.index),
      errorKind: e.kind, terminal: e.terminalWhy, delayAfterError: e.actualDelayToTerminal, legal: cls.legal, winning: cls.win, losing: cls.lose, unknown: cls.unknown,
      winningAlternatives: wins, botPrefixTileNumbers: e.prefixTaps.map(i => i + 1), zeroBasedPrefixActions: e.prefixTaps,
      repeatedKnownErrors: p.repeatedKnownLosingMove, sampledLosses: p.losses, engineDetail: r.detailFile };
    examples.push(example); rows.push({ id: M.boardKey(b.design).slice(0, 16), level: example.studyLevel, shape: b.brief.shape, recipe: [b.brief.story],
      diagnosticOnly: true, pass: false, brief: x.kind, family: r.fullRatings.family, skilled: r.fullRatings.skilled.exp, design: { ...b.design, level: example.studyLevel } });
    guide.push(`## ${example.label}: ${x.kind}`, '', `Board ${r.id}; family ${r.fullRatings.family.exp}, skilled ${r.fullRatings.skilled.exp}; ${r.structure.way} minimum clock moves with spare${r.structure.spare}. Keys visible at start: ${r.structure.hasKeys ? r.structure.keysShownAtStart : 'no keys'}.`, '',
      `Campaign${example.campaign}, try${e.attempt}: the first proved irreversible error is removal move${e.removalMove}, physical tap${e.tap}, tile${e.index + 1} at [${b.design.tiles[e.index]}], picture${b.design.faces[e.index]}. Kind: ${e.kind}. The observed ${e.terminalWhy} loss arrives ${e.actualDelayToTerminal} removal moves later.`, '',
      `Before that tap: ${cls.win} winning / ${cls.lose} losing / ${cls.unknown} unresolved actions out of${cls.legal}. Known-picture winning alternatives: ${wins.filter(w => w.picturesAvailable).map(w => w.tiles.map(t => t.tile).join('+')).join(', ') || 'none'}.`, '',
      `Physical tap sequence through the error (tile numbers): ${example.botPrefixTileNumbers.join(', ')}.`, '',
      `${p.repeatedKnownLosingMove} sampled errors repeat an earlier losing action while its chosen picture is remembered. This is not by itself evidence that the route or key identity was understood.`, '');
  }
  P.save(root, 'examples.json', examples); fs.writeFileSync(path.join(root, 'example-boards.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'EXAMPLES.md'), guide.join('\n')); return examples;
}
if (require.main === module) console.log(prepare(path.resolve(process.argv[2])).map(e => ({ label: e.label, id: e.id, move: e.removalMove, tile: e.chosen.tile })));
module.exports = { prepare };
