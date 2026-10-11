/* Oma's Mahjong — the rules: every number you might want to tune, in one place.
   Also loaded by the family dashboard (site/dash), so it must not touch the page or the saved game.
   The pile itself (shapes, deals, the 4-slot tray, when ice and locks start) lives in layouts.js. */
'use strict';

const RULES = {
  levels: { blockedFrom: null },              // a level number closes that level and all above it (e.g. while new levels wait for approval); null = all open
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
  hard: { measureFrom: 70, from: 75, clockFrom: 80, sense: 0.69, start: 0.55, end: 0.35, endLevel: 150, strongSense: 0.88, strongStart: 0.75, strongEnd: 0.55, minTile: 54, minTileBig: 48, pile: 'classic' },
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

/* Help: `normal` is what everyone gets; `care` holds the gentler values. Which of them a player gets
   is decided per part (PARTS below): a part that is on takes its values from `care`.
   Change a value here to change it for everyone, e.g. normal.rescue = true. */
const HELP = {
  normal: {
    comboMs: 10000,                            // time to keep a combo going (everyone)
    lucky: { fromLevel: 10, perLevel: 1, chance: 0.3 },
    gentle: 0,                                 // 0 = the normal deal (see Layouts.ease)
    easierAfterFails: 0,                       // 0 = never
    rescue: false,                             // a full tray: put the tiles back once per level
    nudge: null,                               // the helper that makes a pair glow
    shuffleAfter: null,                        // no shuffle right at the start of a level
    adapt: null,                               // difficulty that follows her own results
    toolsGoneFrom: 50,                         // from this level on 💡 Hint and 🔀 Schudden only when earned: every level so far on 3 stars
    jokersGoneFrom: 50,                        // ... and no 🃏 jokers in the deal
  },
  care: {
    lucky: { fromLevel: 1, perLevel: 2, chance: 0.5 },
    gentle: 1,                                 // on top of her own gentle levels (layouts.js, track 'care'); her results move it
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
    toolsGoneFrom: null,                       // grandma mode keeps Hint and Schudden at every level
    jokersGoneFrom: null,                      // ... and the jokers
  },
};
const ADAPT_STEPS = { '-2': 'normaal (zoals de familie)', '-1': 'iets moeilijker', 0: 'zacht (haar standaard)', 1: 'iets makkelijker', 2: 'makkelijker' };

/* Grandma mode in parts, each switchable per player on the family dashboard. 👵 Super-omamodus
   turns them all on (by default only for grandma, see GRANDMA); a part switched on its own (PUK:
   only `adapt`) works without the others. `help`: the HELP.care values the part brings. */
const PARTS = [
  { id: 'levels', group: 'easy', label: 'Eigen, makkelijkere levels', note: 'langzamer moeilijker, weinig omgedraaide stenen' },
  { id: 'gentle', group: 'easy', help: ['gentle'], label: 'Elk level een stapje makkelijker', note: 'meer dezelfde plaatjes' },
  { id: 'adapt', group: 'easy', help: ['adapt'], label: 'Past zich aan de resultaten aan', note: 'laatste 10 pogingen: makkelijker als het vaak misgaat' },
  { id: 'retry', group: 'easy', help: ['easierAfterFails'], label: 'Makkelijker na 3 keer mis', note: 'de 4e poging van hetzelfde level' },
  { id: 'rescue', group: 'help', help: ['rescue'], label: 'Stenen terugleggen', note: 'vol bakje: 1× per level terugleggen (kost een ster)' },
  { id: 'nudge', group: 'help', help: ['nudge'], label: 'Het hulpje', note: 'een paar licht op na een tijdje niets doen' },
  { id: 'shuffleLater', group: 'help', help: ['shuffleAfter'], label: 'Schudden niet meteen', note: 'pas na een paar zetten (bewaart de ster)' },
  { id: 'lucky', group: 'extra', help: ['lucky'], label: 'Meer geluksmomentjes', note: 'vanaf level 1, tot 2 per level' },
  { id: 'keepTools', group: 'extra', help: ['toolsGoneFrom', 'jokersGoneFrom'], label: 'Hint, Schudden en jokers na level 50', note: 'blijven, ook na level 50' },
  { id: 'news', group: 'news', label: 'Nieuws uit Apeldoorn', note: 'na een gewonnen level een nieuwtje of buurtverhaal' },
];
const PART_GROUPS = { easy: 'Makkelijker spelen', help: 'Hulp', extra: "Extra's", news: 'Nieuws' };

/* Grandma: her player id, or a name starting with "Oma" (in case she ever reinstalls the app).
   `like` = players who always get exactly what grandma gets (DennisTEST: to see what she sees). */
const GRANDMA = { pids: ['pmuy4wmdp17hbws'], like: ['pmuxw2uqkzcnbgx'], name: /^oma/i };
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
// the help one player gets: the normal values, with the gentler ones of every part that is on
function helpFor(pid, name, cfg = {}) {
  const h = { ...HELP.normal };
  for (const p of PARTS) if (p.help && partOn(p.id, pid, name, cfg)) for (const k of p.help) h[k] = HELP.care[k];
  return h;
}
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
