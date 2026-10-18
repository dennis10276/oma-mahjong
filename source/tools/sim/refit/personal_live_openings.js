'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  const rules = fs.readFileSync(path.join(root, 'www/js/rules.js'), 'utf8');
  const database = rules.match(/const DB_URL\s*=\s*['"]([^'"]+)['"]/);
  if (!database) throw new Error('Database endpoint is missing from the game source');
  const entries = await Promise.all(['plays', 'scores'].map(async name => {
    const response = await fetch(database[1] + '/' + name + '.json');
    if (!response.ok) throw new Error('Read-only live opening check failed: ' + name + '/' + response.status);
    const data = await response.json();
    if (!data || typeof data !== 'object') throw new Error('Live opening response is empty');
    return { name, data, serverDate: response.headers.get('date') };
  }));
  const made = new Date().toISOString(), folder = path.join(root, 'analysis/archive/personal-bots/live-openings-' + made.replace(/[:.]/g, '-'));
  fs.mkdirSync(folder);
  const files = {};
  for (const entry of entries) {
    const bytes = Buffer.from(JSON.stringify(entry.data));
    fs.writeFileSync(path.join(folder, entry.name + '.json'), bytes); files[entry.name + '.json'] = hash(bytes);
  }
  const manifest = { made, evidence: 'read-only-live-opening-check', targetMet: false, files,
    serverDates: Object.fromEntries(entries.map(entry => [entry.name, entry.serverDate])),
    note: 'Separate read-only opening/score snapshot, not a replacement of frozen fitting inputs or a numeric forecast. '
      + 'Actual pre-start eligibility is checked again against real opening and freeze timestamps.' };
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ folder, made, files }));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
