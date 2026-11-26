// uses: core/*, rules, lang, tiles
/* Oma's Mahjong — looks/looks: backgrounds, themes unlocked with stars, the Zonnebloem prize. */
'use strict';
// ---------- backgrounds (unlocked with stars) ----------
// (their names are in lang.js: bg_<id>)
const BGS = [
  { id: 'jade', need: 0, css: 'radial-gradient(circle at 50% 25%, #34b088 0%, #14795d 45%, #0a4a3a 100%)' },
  { id: 'sunrise', need: 8, css: 'linear-gradient(170deg, #ffc28f 0%, #ff8a7a 45%, #c4497e 100%)' },
  { id: 'lavender', need: 20, css: 'linear-gradient(165deg, #c9adff 0%, #8f6ce8 50%, #5a3fb5 100%)' },
  { id: 'ocean', need: 40, css: 'linear-gradient(170deg, #63e6dc 0%, #2b9fd8 50%, #1b56a3 100%)' },
  { id: 'blossom', need: 65, css: 'radial-gradient(circle at 25% 15%, #ffe4ef 0%, #ffaccb 45%, #d9638f 100%)' },
  { id: 'forest', need: 95, css: 'linear-gradient(170deg, #b3e36d 0%, #56ab2f 50%, #285f1a 100%)' },
  { id: 'night', need: 130, css: 'radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 15%, #fff, transparent), radial-gradient(2px 2px at 85% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 35% 75%, #fff, transparent), radial-gradient(1px 1px at 55% 45%, #fff, transparent), radial-gradient(circle at 50% 0%, #3d4fa8 0%, #1d2260 55%, #0c0f30 100%)' },
  { id: 'gold', need: 180, css: 'linear-gradient(160deg, #fff1a8 0%, #f5c043 45%, #b87a0a 100%)' },
  { id: 'rainbow', need: 250, css: 'linear-gradient(165deg, #ff9a9e 0%, #fad0c4 20%, #fbc2eb 40%, #a6c1ee 60%, #84fab0 80%, #8fd3f4 100%)' },
  // comes with the Zonnebloem prize theme
  { id: 'sunfield', sun: true, css: 'radial-gradient(circle at 84% 9%, #fffbe0 0 5%, #ffe979 6% 9%, rgba(255,233,121,.35) 10% 16%, transparent 17%), linear-gradient(180deg, #74c3f2 0%, #b9e3fb 36%, #fff3b8 60%, #f7cd4f 78%, #d99320 100%)' },
];
BGS.forEach(b => Object.defineProperty(b, 'name', { get: () => tx('bg_' + b.id) }));
const numBgs = BGS.filter(b => typeof b.need === 'number');

const sunUnlocked = () => S.level > RULES.sunflower.level;
const bgLocked = b => b.sun ? !sunUnlocked() : totalStars() < b.need;
// what a player has equipped comes from what she owns (ShopEconomy), not from stars
function applyBg() {
  const id = ShopEconomy.resolveEquippedItem(S, 'bg');
  $('#bg').style.background = (findCatalogItem('bg', id) || BGS[0]).css;
  $('#bg').className = id === 'sunfield' ? 'sunfield' : '';
}
function applyTheme() {
  S.theme = ShopEconomy.resolveEquippedItem(S, 'tiles');
  const sunny = S.theme === 'sunflower';
  document.body.classList.toggle('sunny', sunny);
  Sound.setMood(sunny ? 'sunny' : 'calm');
  applyFinish(); applyTray();
}
// tile colour and tray: CSS variables on body that the board's .tile and #tray rules read; the starter items set none, so the board keeps today's colours
function setLookVars(vars) { for (const [k, v] of Object.entries(vars)) v ? document.body.style.setProperty(k, v) : document.body.style.removeProperty(k); }
function applyFinish() {
  const it = findCatalogItem('finish', ShopEconomy.resolveEquippedItem(S, 'finish')), own = it && !it.starter;
  setLookVars({ '--tile-face': own && it.tileBg, '--tile-lip': own && it.tileLip, '--tile-rim': own && it.tileBorder });
}
function applyTray() {
  const it = findCatalogItem('tray', ShopEconomy.resolveEquippedItem(S, 'tray')), own = it && !it.starter;
  setLookVars({ '--tray-bg': own && it.trayBg, '--tray-well': own && it.trayWell, '--tray-lip': own && it.trayLip });
}
