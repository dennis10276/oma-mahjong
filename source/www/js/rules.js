/* Oma's Mahjong — the rules: every number you might want to tune, in one place.
   Also loaded by the family dashboard (site/dash), so it must not touch the page or the saved game.
   The pile itself (shapes, deals, the 4-slot tray, when ice and locks start) lives in layouts.js. */
'use strict';

const RULES = {
  // aspect: ready-made levels and the daily puzzle are the same on every phone (made for this screen
  // shape). Levels 51 and 53-69 come ready-made (levels-early.js): the boards Gerda played (51 and 53
  // switched); 1-50 and 52 are still made for each screen; grandma's own levels follow her screen.
  // blockedFrom: a level number closes that level and all above it (e.g. while new levels wait for approval); null = all open
  levels: { blockedFrom: null, aspect: 1.6 },
  tools: { fromLevel: 15,                      // 💡 Hint and 🔀 Schudden: one of each per level from here
    earn: { every: 5, stars: 3 } },            // from HELP.toolsGoneFrom on they have to be earned, per block of 5 levels (see board.js)
  // from this level: when no order of the remaining taps can fill the tray any more, the rest plays itself
  // (checked exactly, for at most maxTiles tiles left and within a search budget)
  autoFinish: { fromLevel: 50, maxTiles: 24, budget: 200000, stepMs: 260 },
  // the harder levels (www/hard.js): from measureFrom the test player designs each level so a
  // sensible player wins about `sense` of first tries; from `from` the levels get harder (a tile on
  // its own twin, face-down tiles where they hurt, deals tuned against the test player), the
  // target going from `start` to `end` at endLevel; from clockFrom the alarm clock.
  // pile: 'classic' (tower piles were tried: fewer choices, but more luck than skill)
  hard: { measureFrom: 70, from: 75, rebuildFrom: 80, clockFrom: 80, sense: 0.69, start: 0.42, end: 0.22, endLevel: 120, strongSense: 0.88,
    strongCurve: [[75, 0.70], [85, 0.60], [100, 0.45], [120, 0.35], [150, 0.30]],
    minTile: 54, minTileBig: 48, pile: 'classic' },
  sunflower: { level: 20 },                    // the big prize: the Zonnebloem theme after this level
  score: {
    pair: 10, maxCombo: 5,                     // a pair is worth 10 × combo (up to ×5)
    perStar: 50,                               // bonus per star when a level is won
    goldMult: 2, lucky: 150, jokerFinale: 200,
  },
  winStreak: { first: 3, every: 5 },           // levels won in a row: a bonus star at 3, then every 5
  specials: { goldFrom: 20, jokerFrom: 30, jokerChance: 0.6 },
  dailyGift: { twoStarChance: 0.25 },
  chest: { pts: 300, ptsPer10Levels: 100, maxSteps: 4, stars: 2 },
  hearts: {
    showDays: 7,                               // "hartje onderweg / gezien" next to a name
    popupMs: 6500, popupWithMsgMs: 11000,      // a heart during a level (ready-made messages: quickMsgs in lang.js)
  },
};

const levelBlocked = level => RULES.levels.blockedFrom != null && level >= RULES.levels.blockedFrom;

/* Help: what every player gets. (Grandma's extra help is gone; she keeps only her own, easier levels:
   PARTS below.) */
const HELP = {
  normal: {
    comboMs: 10000,                            // time to keep a combo going (everyone)
    lucky: { fromLevel: 10, perLevel: 1, chance: 0.3 },
    toolsGoneFrom: 50,                         // from this level on 💡 Hint and 🔀 Schudden only when earned: every level so far on 3 stars
    jokersGoneFrom: 50,                        // ... and no 🃏 jokers in the deal
  },
};

/* Grandma mode: one part, switchable per player on the family dashboard. 👵 Super-omamodus turns it
   on (by default only for grandma, see GRANDMA). Old settings for parts that no longer exist
   (gentle, adapt, retry, rescue, nudge, shuffleLater, lucky, keepTools) are simply ignored. The
   news ('news') has no switch on the dashboard any more: it follows
   Super-omamodus unless an old setting says otherwise. (The win replay 'pro' is gone.) */
const PARTS = [
  { id: 'levels', group: 'easy', label: 'Eigen, makkelijkere levels', note: 'langzamer moeilijker, weinig omgedraaide stenen' },
];
const PART_GROUPS = { easy: 'Makkelijker spelen' };

/* Grandma: her player id, or a name starting with "Oma" (in case she ever reinstalls the app).
   `like` = players who always get exactly what grandma gets (DennisTEST: to see what she sees). */
const GRANDMA = { pids: ['pmuy4wmdp17hbws'], like: ['pmuxw2uqkzcnbgx'], name: /^oma/i };
// Keep the test account available for diagnostics, but out of family competition.
const hiddenFromRanking = (pid, name) => pid === 'pmuxw2uqkzcnbgx' || /^dennistest$/i.test(String(name || '').trim());
const isGrandma = (pid, name) => GRANDMA.pids.includes(pid) || GRANDMA.like.includes(pid) || GRANDMA.name.test(name || '');
// who else has Super-omamodus by default (besides grandma and DennisTEST); Mama is not in grandma mode
const CARE = { pids: [] };
// players who start in English until they pick a language in the settings (Mama)
const START_ENGLISH = ['pmv13884fc9vndv'];

/* Settings per player, switched on the family dashboard (⚙️ per player): Super-omamodus and each part
   of it (PARTS). They are small events in plays/cfg-<pid>; the newest one per setting counts. A part
   never switched on its own follows Super-omamodus; that one, never switched, follows the defaults
   above (GRANDMA, CARE). Players in GRANDMA.like follow grandma's settings. */
const cfgKey = pid => pid.startsWith('test-') ? 'test-cfg-' + pid.slice(5) : 'cfg-' + pid;
const isCfgKey = id => id.startsWith('cfg-') || id.startsWith('test-cfg-');
const cfgPid = pid => GRANDMA.like.includes(pid) ? GRANDMA.pids[0] : pid;
function playerCfg(list) {
  const c = {};
  (list || []).filter(e => e && e.k === 'cfg').sort((a, b) => a.t - b.t).forEach(e => {
    for (const [k, v] of Object.entries(e)) if (k !== 'k' && k !== 't') c[k === 'care' ? 'super' : k] = typeof v === 'number' || typeof v === 'string' ? v : !!v;   // (care: the old name; numbers: e.g. redo)
  });
  return c;
}
// 👵 Super-omamodus: all parts at once
const isCarePlayer = (pid, name, cfg = {}) => 'super' in cfg ? cfg.super : isGrandma(pid, name) || CARE.pids.includes(pid);
const partOn = (id, pid, name, cfg = {}) => id in cfg ? cfg[id] : isCarePlayer(pid, name, cfg);
// the help one player gets: the same for everyone
const helpFor = () => HELP.normal;
// news from Apeldoorn (a part too; VILLAGE.enabled switches it off for everyone)
const getsNews = (pid, name, cfg = {}) => VILLAGE.enabled && partOn('news', pid, name, cfg);

/* News from Apeldoorn after a won level (js/village.js), only for grandma (and DennisTEST).
   Mostly real local news (collected every two hours by tools/news.py), sometimes a made-up story
   about the computer players in the ranking (js/stories.js), told one part per won level. */
const VILLAGE = {
  enabled: true,                               // false: the news is gone for everyone (see README: removing the news)
  newsUrl: 'https://raw.githubusercontent.com/dennis10276/oma-mahjong/news/news.json',
  storyShare: 0.2,                             // 1 in 5 items is a story part, the rest real news
  newsDays: 7,                                 // real news older than this is not shown any more (events that are over: never)
  staleDays: 2,                                // no fresh news file for this long: stories may fill in
  active: 2,                                   // stories running at the same time
  askStar: 1,                                  // a memory question answered right: a bonus star
  refreshMin: 30,                              // fetch the news again after this many minutes
};

// ---------- the database (Firebase Realtime Database; empty = only the computer players) ----------
const DB_URL = 'https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app';
const dbUrl = path => `${DB_URL}/${path}.json`;
function dbSend(path, body, method = 'PUT', signal) {
  return fetch(dbUrl(path), { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
}
async function dbGet(path) {
  const r = await fetch(dbUrl(path), { cache: 'no-store' });
  return r.ok ? r.json() : null;
}

/* A heart can carry a short message. The heart lives in hearts/<to>/<from>; the message in
   plays/msg-<to> (the database rules take pieces of at most 40 characters there, so a longer
   message is split over m0, m1, m2) and is matched to the heart by sender and time. */
const MSG = { max: 140, piece: 38 };
const msgKey = pid => pid.startsWith('test-') ? 'test-msg-' + pid.slice(5) : 'msg-' + pid;
const isMsgKey = id => id.startsWith('msg-') || id.startsWith('test-msg-');
function msgParts(txt) {
  const out = {}; let k = 0, cur = '';
  for (const ch of Array.from(String(txt).trim().slice(0, MSG.max))) {
    if ((cur + ch).length > MSG.piece) { out['m' + k++] = cur; cur = ''; if (k > 2) break; }
    cur += ch;
  }
  if (cur && k <= 2) out['m' + k] = cur;
  return out;
}
const msgText = m => [m.m0, m.m1, m.m2].filter(Boolean).join('');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtN = n => Number(n || 0).toLocaleString(typeof locale === 'function' ? locale() : 'nl-NL');
const medal = r => r <= 3 ? ['🥇', '🥈', '🥉'][r - 1] : '#' + r;
