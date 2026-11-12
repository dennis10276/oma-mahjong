'use strict';
// GET-only pull of plays/<pid> for every player id seen in the public listing (plays.json?shallow=true). Never writes to Firebase.
// Output: source/build/real-v2/v3/<pid>.json (git-ignored). node normal_pull.js
const fs = require('fs'), path = require('path');
const BASE = 'https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app';
const OUT = path.resolve(__dirname, '../../../../../source/build/real-v2/v3');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const keys = Object.keys(await (await fetch(`${BASE}/plays.json?shallow=true`)).json()).filter(k => /^pm[a-z0-9]+$/.test(k));
  for (const k of keys) { const t = await (await fetch(`${BASE}/plays/${k}.json`)).text(); fs.writeFileSync(path.join(OUT, k + '.json'), t); console.log(k, t.length); }
})();
