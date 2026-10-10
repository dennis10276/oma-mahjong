/* Oma's Mahjong — the rules: every number you might want to tune, in one place.
   Also loaded by the family dashboard (site/dash), so it must not touch the page or the saved game.
   The pile itself (shapes, deals, the 4-slot tray, when ice and locks start) lives in layouts.js. */
'use strict';

const RULES = {
  tools: { fromLevel: 15 },                    // 💡 Hint and 🔀 Schudden: one of each per level from here
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

/* Help per kind of player. Grandma gets "care"; everyone else "normal".
   Change a value here to give (or take away) a kind of help, e.g. normal.rescue = true. */
const HELP = {
  normal: {
    comboMs: 6000,                             // time to keep a combo going
    lucky: { fromLevel: 10, perLevel: 1, chance: 0.3 },
    gentle: 0,                                 // 0 = the normal deal (see Layouts.ease)
    easierAfterFails: 0,                       // 0 = never
    rescue: false,                             // a full tray: put the tiles back once per level
    nudge: null,                               // the helper that makes a pair glow
    shuffleAfter: null,                        // no shuffle right at the start of a level
    adapt: null,                               // difficulty that follows her own results
  },
  care: {
    comboMs: 10000,
    lucky: { fromLevel: 1, perLevel: 2, chance: 0.5 },
    gentle: 1,
    easierAfterFails: 3,
    rescue: true,
    // the helper: a pair with a face-down tile glows after downS seconds, a visible pair after upS.
    // pace: the waits follow her last n tries: won ≥ high -> × slow (she can do it herself),
    // won ≤ low or already failed this level -> × fast (sooner help), in between gradually
    nudge: { downS: 6, upS: 14, pace: { n: 8, min: 3, low: 0.4, high: 0.85, fast: 0.7, slow: 2.8 } },
    shuffleAfter: { taken: 8, tray: 2 },       // Schudden works after 8 tiles are gone or with 2 in the tray
    // her last n tries: won < low -> half a step easier, > high -> half a step back (only when a new
    // level starts, after at least `min` tries since the last change); starting over within
    // quickRestartS seconds does not count
    adapt: { n: 10, min: 5, low: 0.6, high: 0.85, minStep: -2, maxStep: 2, quickRestartS: 30 },
  },
};
const ADAPT_STEPS = { '-2': 'normaal (zoals de familie)', '-1': 'iets moeilijker', 0: 'zacht (haar standaard)', 1: 'iets makkelijker', 2: 'makkelijker' };

/* Grandma: her player id, or a name starting with "Oma" (in case she ever reinstalls the app).
   `like` = players who always get exactly what grandma gets (DennisTEST: to see what she sees). */
const GRANDMA = { pids: ['pmuy4wmdp17hbws'], like: ['pmuxw2uqkzcnbgx'], name: /^oma/i };
const isGrandma = (pid, name) => GRANDMA.pids.includes(pid) || GRANDMA.like.includes(pid) || GRANDMA.name.test(name || '');
// who gets the "care" help: grandma (and DennisTEST), and Mama
const CARE = { pids: ['pmv13884fc9vndv'] };
// players who start in English until they pick a language in the settings (Mama)
const START_ENGLISH = ['pmv13884fc9vndv'];
const isCarePlayer = (pid, name) => isGrandma(pid, name) || CARE.pids.includes(pid);

/* News from Apeldoorn after a won level (js/village.js), only for grandma (and DennisTEST).
   Mostly real local news (collected every two hours by tools/news.py), sometimes a made-up story
   about the computer players in the ranking (js/stories.js), told one part per won level. */
const VILLAGE = {
  newsUrl: 'https://raw.githubusercontent.com/dennis10276/oma-mahjong/news/news.json',
  storyShare: 0.2,                             // 1 in 5 items is a story part, the rest real news
  newsDays: 7,                                 // real news older than this is not shown any more
  staleDays: 2,                                // no fresh news file for this long: stories may fill in
  active: 2,                                   // stories running at the same time
  askStar: 1,                                  // a memory question answered right: a bonus star
  refreshMin: 30,                              // fetch the news again after this many minutes
};

// ---------- the database (Firebase Realtime Database; empty = only the computer players) ----------
const DB_URL = 'https://oma-mahjong-default-rtdb.europe-west1.firebasedatabase.app';
const dbUrl = path => `${DB_URL}/${path}.json`;
function dbSend(path, body, method = 'PUT') {
  return fetch(dbUrl(path), { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
