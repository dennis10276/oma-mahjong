'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { PIDS } = require('./mimic_games.js');
const root = path.resolve(__dirname, '../../..');

async function refresh() {
  const rules = fs.readFileSync(path.join(root, 'www/js/rules.js'), 'utf8');
  const database = rules.match(/const DB_URL\s*=\s*['"]([^'"]+)['"]/);
  if (!database) throw new Error('Database URL missing from game rules');
  const files = [['plays', 'realdata/plays.json'], ['scores', 'realdata/scores.json'],
    ...Object.values(PIDS).map(pid => ['replays/' + pid, 'replays/' + pid + '.json'])];
  const downloaded = await Promise.all(files.map(async ([endpoint, file]) => {
    const response = await fetch(database[1] + '/' + endpoint + '.json');
    if (!response.ok) throw new Error('Database read failed for ' + endpoint + ': ' + response.status);
    const data = await response.json();
    if (!data || typeof data !== 'object') throw new Error('Database response missing for ' + endpoint);
    return { file, data };
  }));
  for (const { file, data } of downloaded) {
    const target = path.join(root, 'analysis/archive', file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(data));
  }
  const execute = args => execFileSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  fs.writeFileSync(path.join(__dirname, 'attempts.json'), execute([path.join(__dirname, 'dataset.js')]));
  for (const [name, pid] of Object.entries(PIDS)) {
    const output = execute([path.join(__dirname, 'mimic_data.js'), path.join(root, 'analysis/archive/replays', pid + '.json'), name]);
    const filename = name === 'Mrs. Doubtfire' ? 'Mrs_Doubtfire' : name;
    fs.writeFileSync(path.join(__dirname, 'mimic', filename + '.json'), output);
  }
  fs.writeFileSync(path.join(root, 'analysis/archive/realdata/snapshot.json'), JSON.stringify({ downloadedAt: new Date().toISOString(), files: files.map(([, file]) => file) }, null, 2));
  console.log('Refreshed attempts and personal move recordings.');
}

if (require.main === module) refresh().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { refresh };
