'use strict';

const fs = require('node:fs');
const { familyOf, split } = require('./board_check');
const { findOpeningSweep, findOpeningChoices, findFinishPair } = require('./choice_checks');
const { findThawTrap } = require('./thaw_trap');

const labelOf = row => row.class ?? 'unlabelled';
const featureNames = ['openingSweep', 'finishPair', 'strandedThaw'];

// Run this over exact board versions. Unlabelled catalog entries are useful
// for incidence counts and never contribute difficulty labels.
function benchmark({ index }) {
  const labelled = index.filter(row => row.class).map(row => ({ ...row, family: familyOf(row.board) }));
  const { heldOut } = split(labelled);
  const heldIds = new Set(heldOut.map(row => row.id));
  const rows = index.map(row => ({
    id: row.id,
    label: labelOf(row),
    partition: !row.class ? 'unlabelled' : heldIds.has(row.id) ? 'held-out' : 'training',
    live: row.live ?? null,
    openingSweep: findOpeningSweep(row.board),
    openingChoices: findOpeningChoices(row.board),
    finishPair: findFinishPair(row.board),
    strandedThaw: findThawTrap(row.board),
  }));
  const incidence = {};
  for (const row of rows) {
    const key = row.partition + '/' + row.label;
    const group = incidence[key] ??= { deals: 0, openingSweep: 0, competingStarts: 0, finishPair: 0, strandedThaw: 0 };
    group.deals++;
    for (const name of featureNames) if (row[name]) group[name]++;
    if (new Set(row.openingChoices.map(choice => choice.goal)).size > 1) group.competingStarts++;
  }
  return { deals: rows.length, incidence, rows };
}

if (require.main === module) {
  try {
    const [input, output] = process.argv.slice(2);
    if (!input) throw new Error('Usage: node choice_benchmark.js <corpus.json> [results.json]');
    const result = benchmark(JSON.parse(fs.readFileSync(input, 'utf8')));
    if (output) fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ deals: result.deals, incidence: result.incidence }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { benchmark };
