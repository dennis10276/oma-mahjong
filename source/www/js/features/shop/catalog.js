/* Oma's Mahjong — the coin shop catalog, economy rules and legacy unlock IDs. */
'use strict';

const SHOP_RULES = Object.freeze({
  startCap: 250,
  coins: Object.freeze({
    freshBase: 2,
    fullMainWinsPerWeek: 60,
    perfect: 2,
    bigBoard: 4,
    bigEvery: 10,
    dailyBase: 4,
    upgrade3Star: 4,
    goldPair: 1,
    lucky: 3,
    jokerFinale: 3,
    flow: 1,
    autoFinish: 2,
    task: 2,
  }),
  week: Object.freeze({
    steps: Object.freeze([25, 15, 15, 5, 5, 5]),
    minStep: 2,
    dailyPt: 20,
    epoch: 2,
  }),
  cups: Object.freeze({
    tiers: Object.freeze([
      Object.freeze({ id: 'bronze', pt: 100, coins: 15, ico: '🥉' }),
      Object.freeze({ id: 'silver', pt: 250, coins: 25, ico: '🥈' }),
      Object.freeze({ id: 'gold', pt: 420, coins: 40, ico: '🥇' }),
      Object.freeze({ id: 'diamond', pt: 600, coins: 60, ico: '💎' }),
    ]),
    repeatStep: 180,
    repeatCoins: 30,
    prMin: 100,
    prCoins: 20,
  }),
  grit: Object.freeze({
    minClear: 0.60,
    petals: 5,
    coins: 15,
  }),
  dailyGift: Object.freeze({
    base: 5,
    big: 8,
    bigChance: 0.25,
  }),
  chest: Object.freeze({
    coins: 15,
  }),
  winStreak: Object.freeze({
    momentumAt: 3,
  }),
  undo: Object.freeze({
    enabled: true,
    price: 600,
    freePerWeek: 1,
    maxBuyPerWeek: 2,
    maxStock: 3,
    maxUsePerLevel: 1,
    giftable: false,
  }),
  peek: Object.freeze({
    enabled: true,
    price: 450,
    freePerWeek: 1,
    maxBuyPerWeek: 2,
    maxStock: 3,
    maxUsePerLevel: 1,
    durationMs: 4000,
    giftable: false,
  }),
});

/** Match `msgKey(pid)` / `isMsgKey(id)` convention in `source/www/js/rules.js`. */
function giftKey(pid) {
  const s = String(pid || '');
  return s.startsWith('test-') ? 'test-gift-' + s.slice(5) : 'gift-' + s;
}

function isGiftKey(id) {
  const s = String(id || '');
  return s.startsWith('gift-') || s.startsWith('test-gift-');
}

/** Legacy `looks.js` star thresholds used once during `omamj.v1` -> `econV: 2` migration. */
const LEGACY_BG_NEEDS = Object.freeze({
  jade: 0,
  sunrise: 8,
  lavender: 20,
  ocean: 40,
  blossom: 65,
  forest: 95,
  night: 130,
  gold: 180,
  rainbow: 250,
});

const EARNED_FRAMES = Object.freeze(['none', 'bronze', 'silver', 'gold', 'sun', 'heart', 'rainbow', 'crown']);

const STARTER_OWNED = Object.freeze({
  tiles: Object.freeze(['classic']),
  bg: Object.freeze(['jade']),
  finish: Object.freeze(['fin_ivory']),
  tray: Object.freeze(['tray_honey']),
  fx: Object.freeze(['fx_sun']),
  music: Object.freeze(['mus_piano', 'mus_sunflower']),
  sfx: Object.freeze(['sfx_ivory']),
  frame: Object.freeze(['none']),
  title: Object.freeze([]),
});

const SHOP_CATALOG = Object.freeze({
  tiles: Object.freeze([
    { id: 'classic', price: 0, starter: true, icon: '🀄', nl: 'Klassiek', en: 'Classic', subNl: 'Tijdloze Mahjong-stenen', subEn: 'Timeless Mahjong tiles', swatchBg: '#FFFDF3' },
    { id: 'fruit', price: 320, legacy: true, icon: '🍎', nl: 'Lekkernijen', en: 'Treats', subNl: 'Fruit en lekkers', subEn: 'Fruit and treats', swatchBg: '#FFE8D8' },
    { id: 'animals', price: 320, legacy: true, icon: '🐶', nl: 'Dieren', en: 'Animals', subNl: 'Vrolijke dieren', subEn: 'Cheerful animals', swatchBg: '#E7F4E4' },
    { id: 'happy', price: 340, legacy: true, icon: '🌸', nl: 'Vrolijk', en: 'Cheerful', subNl: 'Kleurrijke symbolen', subEn: 'Colorful symbols', swatchBg: '#FFEBF3' },
    { id: 'sunflower', price: 480, legacy: true, icon: '🌻', nl: 'Zonnebloem', en: 'Sunflower', subNl: 'Geliefd zonnethema', subEn: 'Beloved sunny theme', swatchBg: '#FFF5BE' },
    { id: 'tiles_kitchen', price: 440, icon: '☕', nl: 'Gezellige Keuken', en: 'Cozy Kitchen', subNl: 'Koffie en gebak', subEn: 'Coffee and pastries', swatchBg: '#FFEEDA' },
    { id: 'tiles_dutch', price: 480, icon: '🌷', nl: 'Hollands', en: 'Dutch Icons', subNl: 'Tulp, fiets en molen', subEn: 'Tulip, bike & windmill', swatchBg: '#FFE7E0' },
  ]),

  finish: Object.freeze([
    { id: 'fin_ivory', price: 0, starter: true, icon: '⬜', nl: 'Klassiek Ivoor', en: 'Classic Ivory', subNl: 'Warm roomwit', subEn: 'Warm ivory', tileBg: '#FFFDF3', tileLip: '#CFC292', tileBorder: '#E8DBB4', tileInk: '#382618', tileInset: 'none', swatchBg: '#FFFDF3' },
    { id: 'fin_bamboo', price: 360, icon: '🎋', nl: 'Bamboe', en: 'Bamboo', subNl: 'Natuurlijk hout', subEn: 'Natural bamboo', tileBg: 'repeating-linear-gradient(0deg, #F3E0AE 0px, #F3E0AE 5px, #EBD295 5px, #EBD295 7px)', tileLip: '#967028', tileBorder: '#C79D4B', tileInk: '#3B2A0E', tileInset: 'none', swatchBg: '#F3E0AE' },
    { id: 'fin_slate', price: 400, icon: '🪨', nl: 'Donker Leisteen', en: 'Dark Slate', subNl: 'Rustig voor de avond', subEn: 'Calm evening look', tileBg: 'linear-gradient(180deg, #434D5C, #28303B)', tileLip: '#141920', tileBorder: '#6C7A8F', tileInk: '#FFFAF0', tileInset: 'none', swatchBg: '#353D49' },
    { id: 'fin_delft', price: 440, icon: '🏺', nl: 'Delfts Blauw', en: 'Delft Blue', subNl: 'Porseleinen randje', subEn: 'Porcelain trim', tileBg: '#F4F9FF', tileLip: '#184482', tileBorder: '#2763B5', tileInk: '#173C6E', tileInset: 'inset 0 0 0 2px #9EC2F0', swatchBg: '#DCEBFF' },
  ]),

  tray: Object.freeze([
    { id: 'tray_honey', price: 0, starter: true, icon: '🍯', nl: 'Honingbakje', en: 'Honey Tray', subNl: 'Warme standaardrand', subEn: 'Warm honey tray', trayBg: '#CF8A1D', trayWell: '#B27012', trayLip: '#8A5409', swatchBg: '#CF8A1D' },
    { id: 'tray_oak', price: 320, icon: '🪵', nl: 'Eikenhout', en: 'Oak Wood', subNl: 'Warm bruin hout', subEn: 'Warm oak timber', trayBg: '#8A562F', trayWell: '#693E1E', trayLip: '#472811', swatchBg: '#8A562F' },
    { id: 'tray_wicker', price: 340, icon: '🧺', nl: 'Rieten Mand', en: 'Woven Basket', subNl: 'Gezellig gevlochten', subEn: 'Cozy woven rim', trayBg: '#D6A45C', trayWell: '#B5843E', trayLip: '#875F25', swatchBg: '#D6A45C' },
    { id: 'tray_sage', price: 360, icon: '🌿', nl: 'Saliegroen', en: 'Sage Wood', subNl: 'Zacht tuingroen', subEn: 'Soft garden sage', trayBg: '#5E8C6A', trayWell: '#456E50', trayLip: '#2E4F37', swatchBg: '#5E8C6A' },
    { id: 'tray_velvet', price: 400, icon: '🟣', nl: 'Fluweel', en: 'Velvet', subNl: 'Diep bordeaux', subEn: 'Deep burgundy', trayBg: '#7D2846', trayWell: '#5C1A31', trayLip: '#3B0D1D', swatchBg: '#7D2846' },
    { id: 'tray_gold', price: 500, icon: '✨', nl: 'Goudrand', en: 'Gold Trim', subNl: 'Luxe gouden rand', subEn: 'Golden rim', trayBg: '#F0C044', trayWell: '#BE8A17', trayLip: '#8A6006', swatchBg: '#F0C044' },
  ]),

  bg: Object.freeze([
    { id: 'jade', price: 0, starter: true, icon: '💚', nl: 'Jade', en: 'Jade', subNl: 'Klassiek speeltafelgroen', subEn: 'Classic jade table', css: 'radial-gradient(circle at 50% 25%, #34b088 0%, #14795d 45%, #0a4a3a 100%)' },
    { id: 'sunrise', price: 240, legacy: true, icon: '🌅', nl: 'Zonsopgang', en: 'Sunrise', subNl: 'Warme ochtendgloed', subEn: 'Warm morning glow', css: 'linear-gradient(170deg, #ffc28f 0%, #ff8a7a 45%, #c4497e 100%)' },
    { id: 'lavender', price: 260, legacy: true, icon: '💜', nl: 'Lavendel', en: 'Lavender', subNl: 'Zacht paars', subEn: 'Soft violet table', css: 'linear-gradient(165deg, #c9adff 0%, #8f6ce8 50%, #5a3fb5 100%)' },
    { id: 'ocean', price: 280, legacy: true, icon: '🌊', nl: 'Oceaan', en: 'Ocean', subNl: 'Fris zeeblauw', subEn: 'Fresh sea blue', css: 'linear-gradient(170deg, #63e6dc 0%, #2b9fd8 50%, #1b56a3 100%)' },
    { id: 'blossom', price: 300, legacy: true, icon: '🌺', nl: 'Bloesem', en: 'Blossom', subNl: 'Zachte lentebloesem', subEn: 'Soft spring blossom', css: 'radial-gradient(circle at 25% 15%, #ffe4ef 0%, #ffaccb 45%, #d9638f 100%)' },
    { id: 'forest', price: 320, legacy: true, icon: '🌲', nl: 'Bos', en: 'Forest', subNl: 'Natuurlijk bosgroen', subEn: 'Deep woodland green', css: 'linear-gradient(170deg, #b3e36d 0%, #56ab2f 50%, #285f1a 100%)' },
    { id: 'night', price: 360, legacy: true, icon: '✨', nl: 'Sterrennacht', en: 'Starry night', subNl: 'Kalm avondblauw', subEn: 'Calm starry sky', css: 'radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent), radial-gradient(1.5px 1.5px at 70% 15%, #fff, transparent), radial-gradient(2px 2px at 85% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 35% 75%, #fff, transparent), radial-gradient(1px 1px at 55% 45%, #fff, transparent), radial-gradient(circle at 50% 0%, #3d4fa8 0%, #1d2260 55%, #0c0f30 100%)' },
    { id: 'sunfield', price: 380, legacy: true, icon: '🌻', nl: 'Zonnebloemveld', en: 'Sunflower field', subNl: 'Lucht en goud', subEn: 'Sky and gold', css: 'radial-gradient(circle at 84% 9%, #fffbe0 0 5%, #ffe979 6% 9%, rgba(255,233,121,.35) 10% 16%, transparent 17%), linear-gradient(180deg, #74c3f2 0%, #b9e3fb 36%, #fff3b8 60%, #f7cd4f 78%, #d99320 100%)' },
    { id: 'gold', price: 420, legacy: true, icon: '🏆', nl: 'Goud', en: 'Gold', subNl: 'Warme goudgloed', subEn: 'Warm golden sheen', css: 'linear-gradient(160deg, #fff1a8 0%, #f5c043 45%, #b87a0a 100%)' },
    { id: 'rainbow', price: 460, legacy: true, icon: '🌈', nl: 'Regenboog', en: 'Rainbow', subNl: 'Kleurrijk pastel', subEn: 'Soft pastel rainbow', css: 'linear-gradient(165deg, #ff9a9e 0%, #fad0c4 20%, #fbc2eb 40%, #a6c1ee 60%, #84fab0 80%, #8fd3f4 100%)' },
    { id: 'surf_linen', price: 340, icon: '🧵', nl: 'Linnen Tafel', en: 'Linen Table', subNl: 'Zacht warm linnen', subEn: 'Warm soft cloth', css: 'linear-gradient(180deg, #EFE4CF 0%, #DFCCB0 100%)' },
    { id: 'surf_terrace', price: 380, icon: '🌿', nl: 'Zonnig Terras', en: 'Sunny Terrace', subNl: 'Fris tuingroen', subEn: 'Fresh garden green', css: 'linear-gradient(180deg, #A7E4BE 0%, #60B884 100%)' },
    { id: 'surf_dusk', price: 420, icon: '🌙', nl: 'Zomeravond', en: 'Summer Dusk', subNl: 'Rustig donkerblauw', subEn: 'Calm dusk blue', css: 'linear-gradient(180deg, #273E66 0%, #17243D 100%)' },
  ]),

  fx: Object.freeze([
    // Keep the existing save entitlement for the free win.
    { id: 'fx_sun', style: 'rain', price: 0, starter: true, icon: '🌻', nl: 'Zonnebloemregen', en: 'Sunflower Rain', subNl: 'Zonnige regen', subEn: 'Gentle sunny rain', particles: ['🌻', '✨', '💛'] },
  ]),

  music: Object.freeze([
    // Free starters (2): mus_piano + mus_sunflower (`audio.js` `startSunny()` preserved)
    { id: 'mus_piano', group: 'cozy', price: 0, starter: true, icon: '🎹', nl: 'Zonnebloem Piano', en: 'Sunflower Piano', subNl: 'Warm en rustig', subEn: 'Warm and gentle', synth: 'piano', notes: [261.6, 329.6, 392.0, 523.3, 493.9, 392.0, 329.6, 293.7], wave: 'sine', tempo: 370, overtone: 2.0, decay: 0.48 },
    { id: 'mus_sunflower', group: 'cozy', price: 0, starter: true, icon: '🌻', nl: 'Zomerwals', en: 'Summer Waltz', subNl: 'Vertrouwde vogelzang', subEn: 'Classic summer waltz', mood: 'sunny', synth: 'sunflower', notes: [392.0, 493.9, 587.3, 784.0, 659.3, 587.3, 493.9, 440.0], wave: 'sine', tempo: 360, overtone: 2.0, decay: 0.50 },
    // Classical (3 ready)
    { id: 'mus_moonlight', group: 'classical', price: 420, icon: '🌕', nl: 'Maanlicht Sonate', en: 'Moonlight Sonata', subNl: 'Beethoven sfeer', subEn: 'Calm evening sonata', notes: [277.2, 329.6, 415.3, 277.2, 329.6, 415.3, 392.0, 329.6], wave: 'sine', tempo: 420, overtone: 2.0, decay: 0.56 },
    { id: 'mus_clair', group: 'classical', price: 460, icon: '🌙', nl: 'Clair de Lune', en: 'Clair de Lune', subNl: 'Debussy dromerig', subEn: 'Dreamy classical keys', notes: [349.2, 440.0, 523.3, 698.5, 659.3, 523.3, 440.0, 392.0], wave: 'sine', tempo: 430, overtone: 2.0, softAttack: 0.04, decay: 0.60 },
    { id: 'mus_waltz', group: 'classical', price: 400, icon: '🩰', nl: 'Weense Wals', en: 'Vienna Waltz', subNl: 'Zachte strijkerswals', subEn: 'Graceful classic waltz', notes: [261.6, 392.0, 392.0, 329.6, 392.0, 392.0, 349.2, 440.0], wave: 'triangle', tempo: 350, overtone: 2.0, softAttack: 0.035, decay: 0.44 },
    // Mahjong & Zen (4 ready: 3 melodic + Waterval)
    { id: 'mus_guzheng', group: 'zen', price: 380, icon: '🎋', nl: 'Bamboetuin', en: 'Bamboo Garden', subNl: 'Zachte Oosterse harp', subEn: 'Peaceful garden pluck', notes: [293.7, 329.6, 440.0, 587.3, 493.9, 440.0, 329.6, 293.7], wave: 'triangle', tempo: 340, overtone: 2.0, decay: 0.50 },
    { id: 'mus_lotus', group: 'zen', price: 400, icon: '🪷', nl: 'Lotusvijver', en: 'Lotus Pond', subNl: 'Drijvende zenklanken', subEn: 'Still water pentatonic', notes: [261.6, 293.7, 392.0, 440.0, 523.3, 440.0, 392.0, 293.7], wave: 'sine', tempo: 420, overtone: 2.0, decay: 0.58 },
    { id: 'mus_teahouse', group: 'zen', price: 360, icon: '🍵', nl: 'Theehuis Melodie', en: 'Teahouse Melody', subNl: 'Snaren bij de thee', subEn: 'Warm Asian tea mood', notes: [329.6, 392.0, 440.0, 523.3, 659.3, 523.3, 440.0, 392.0], wave: 'sine', tempo: 370, overtone: 1.5, decay: 0.48 },
    { id: 'mus_waterfall', group: 'zen', price: 380, icon: '🏞️', nl: 'Waterval', en: 'Waterfall', subNl: 'Stromend water', subEn: 'Gentle flowing cascade', synth: 'waterfall', auditionId: 'aud_waterval' },
    // Cozy & Warm (5 ready buyable: 4 melodic + Zachte regen)
    { id: 'mus_guitar', group: 'cozy', price: 340, icon: '🎸', nl: 'Gitaar', en: 'Acoustic Guitar', subNl: 'Zonnig tokkelspel', subEn: 'Sunny fingerpicking', notes: [293.7, 370.0, 440.0, 587.3, 493.9, 440.0, 370.0, 329.6], wave: 'triangle', tempo: 320, overtone: 2.0, decay: 0.42 },
    { id: 'mus_rain', group: 'cozy', price: 360, icon: '🌧️', nl: 'Zachte regen', en: 'Soft Rain', subNl: 'Regen en piano', subEn: 'Gentle rain and soft piano', synth: 'rain', auditionId: 'aud_zachte_regen' },
    { id: 'mus_box', group: 'cozy', price: 400, icon: '🎼', nl: 'Muziekdoos', en: 'Music Box', subNl: 'Nostalgisch helder', subEn: 'Nostalgic chime', notes: [523.3, 659.3, 784.0, 1046.5, 987.8, 784.0, 659.3, 587.3], wave: 'sine', tempo: 290, overtone: 3.0, decay: 0.36 },
    { id: 'mus_cafe', group: 'cozy', price: 400, icon: '🥐', nl: 'Frans Café', en: 'French Café', subNl: 'Gezellige wals', subEn: 'Cozy cafe waltz', notes: [329.6, 392.0, 493.9, 659.3, 587.3, 493.9, 392.0, 349.2], wave: 'triangle', tempo: 340, overtone: 1.5, decay: 0.42 },
    { id: 'mus_harp', group: 'cozy', price: 440, icon: '🎶', nl: 'Klassieke Harp', en: 'Classical Harp', subNl: 'Heldere snaren', subEn: 'Golden harp arpeggio', notes: [392.0, 493.9, 587.3, 784.0, 987.8, 784.0, 587.3, 493.9], wave: 'sine', tempo: 300, overtone: 2.0, decay: 0.52 },
  ]),

  sfx: Object.freeze([
    // Mahjong & Tiles (1 starter + 7 buyable)
    { id: 'sfx_ivory', group: 'mahjong', price: 0, starter: true, icon: '🀄', nl: 'Klassiek Ivoor', en: 'Classic Ivory', subNl: 'Heldere stenen tik', subEn: 'Crisp tile clack', freq: 540, type: 'triangle', synth: 'clack', clickFreq: 2100, matchRatios: [1.26, 1.5, 2.0] },
    { id: 'sfx_mahjong_clack', group: 'mahjong', price: 320, icon: '🎴', nl: 'Mahjongsteen', en: 'Authentic Tile Clack', subNl: 'Stevige tik op tafel', subEn: 'Snappy ivory tile snap', freq: 460, type: 'triangle', synth: 'clack', clickFreq: 2700, matchRatios: [1.19, 1.5, 1.89] },
    { id: 'sfx_jade', group: 'mahjong', price: 360, icon: '💎', nl: 'Jaden Stenen', en: 'Jade Stones', subNl: 'Koele edelsteenklank', subEn: 'Cool mineral ring', freq: 680, type: 'sine', synth: 'mineral', overtone: 2.58, matchRatios: [1.25, 1.5, 2.0] },
    { id: 'sfx_marimba', group: 'mahjong', price: 340, icon: '🎵', nl: 'Warme Marimba', en: 'Warm Marimba', subNl: 'Zachte houten plop', subEn: 'Warm bouncy wood chime', freq: 490, type: 'sine', synth: 'mallet', matchRatios: [1.25, 1.5, 1.88] },
    { id: 'sfx_felt', group: 'mahjong', price: 300, icon: '🧶', nl: 'Vilt & Ivoor', en: 'Felt & Ivory', subNl: 'Tik op viltkleed', subEn: 'Soft felted table tap', freq: 390, type: 'sine', synth: 'clack', clickFreq: 1350, matchRatios: [1.2, 1.5] },
    { id: 'sfx_wood', group: 'mahjong', price: 280, icon: '🪵', nl: 'Warm Hout', en: 'Warm Wood', subNl: 'Zachte houtblokjes', subEn: 'Soft woodblocks', freq: 330, type: 'sine', synth: 'mallet', matchRatios: [1.25, 1.5] },
    { id: 'sfx_bamboo', group: 'mahjong', price: 300, icon: '🎋', nl: 'Bamboe Tik', en: 'Bamboo Click', subNl: 'Holle bamboeklik', subEn: 'Hollow bamboo knock', freq: 420, type: 'triangle', synth: 'clack', clickFreq: 1850, matchRatios: [1.25, 1.5] },
    { id: 'sfx_kalimba', group: 'mahjong', price: 320, icon: '🪘', nl: 'Zachte Kalimba', en: 'Soft Kalimba', subNl: 'Duimpianootje', subEn: 'Gentle thumb piano', freq: 620, type: 'sine', synth: 'plucked', overtone: 2.0, matchRatios: [1.25, 1.5, 2.0] },
    // Classical Instruments (7 buyable)
    { id: 'sfx_piano', group: 'classical', price: 320, icon: '🎹', nl: 'Klassieke Piano', en: 'Classical Piano', subNl: 'Heldere vleugel', subEn: 'Warm grand piano notes', freq: 523.3, type: 'triangle', synth: 'classical_key', overtone: 2.0, matchRatios: [1.25, 1.5, 2.0] },
    { id: 'sfx_pizzicato', group: 'classical', price: 360, icon: '🎻', nl: 'Pizzicato Viool', en: 'Pizzicato Violin', subNl: 'Getokkelde viool', subEn: 'Playful plucked strings', freq: 587.3, type: 'triangle', synth: 'plucked', overtone: 1.5, matchRatios: [1.25, 1.5, 2.0] },
    { id: 'sfx_celesta', group: 'classical', price: 380, icon: '✨', nl: 'Celesta Klokje', en: 'Celesta Bell', subNl: 'Sprookjesbel', subEn: 'Clockwork fairy chime', freq: 880.0, type: 'sine', synth: 'classical_key', overtone: 2.0, matchRatios: [1.25, 1.5, 2.0] },
    { id: 'sfx_harpsichord', group: 'classical', price: 340, icon: '🎼', nl: 'Klavecimbel', en: 'Harpsichord', subNl: 'Barok getokkeld', subEn: 'Baroque plucked keys', freq: 587.3, type: 'triangle', synth: 'plucked', overtone: 2.0, bright: true, matchRatios: [1.25, 1.5, 1.88] },
    { id: 'sfx_flute', group: 'classical', price: 340, icon: '🌬️', nl: 'Dwarsfluit', en: 'Classical Flute', subNl: 'Luchtig en zacht', subEn: 'Airy soft woodwind', freq: 740.0, type: 'sine', synth: 'classical_key', overtone: 2.0, softAttack: true, matchRatios: [1.25, 1.5, 2.0] },
    { id: 'sfx_cello', group: 'classical', price: 360, icon: '🤎', nl: 'Warme Cello', en: 'Warm Cello', subNl: 'Diep en warm', subEn: 'Deep warm cello pluck', freq: 293.7, type: 'triangle', synth: 'plucked', overtone: 2.0, softAttack: true, matchRatios: [1.25, 1.5, 2.0] },
    { id: 'sfx_harp', group: 'classical', price: 380, icon: '🎶', nl: 'Harp Plukje', en: 'Harp Pluck', subNl: 'Zachte harpsnaar', subEn: 'Gentle harp pluck', freq: 690, type: 'triangle', synth: 'plucked', overtone: 2.0, matchRatios: [1.25, 1.5, 2.0] },
    // Nature & Chimes (5 buyable)
    { id: 'sfx_porcelain', group: 'nature', price: 320, icon: '🏺', nl: 'Porselein', en: 'Porcelain', subNl: 'Kopje-schotel tikje', subEn: 'Delicate ceramic tap', freq: 860, type: 'sine', synth: 'mineral', overtone: 2.76, matchRatios: [1.25, 1.5, 2.0] },
    { id: 'sfx_glass', group: 'nature', price: 340, icon: '🔔', nl: 'Glazen Klokjes', en: 'Glass Chimes', subNl: 'Kristalklokjes', subEn: 'Clear crystal chimes', freq: 980, type: 'triangle', synth: 'mineral', overtone: 2.42, matchRatios: [1.26, 1.5, 2.0] },
    { id: 'sfx_drops', group: 'nature', price: 300, icon: '💧', nl: 'Waterdruppels', en: 'Water Drops', subNl: 'Frisse waterplopjes', subEn: 'Fresh water blips', freq: 760, type: 'sine', synth: 'drop', sweep: 1.48, matchRatios: [1.26, 1.5, 2.0] },
    { id: 'sfx_bubble', group: 'nature', price: 320, icon: '🫧', nl: 'Zeepbel Plop', en: 'Soft Bubble Pop', subNl: 'Zachte bellenplop', subEn: 'Crisp bubbly pop', freq: 520, type: 'sine', synth: 'drop', sweep: 1.75, matchRatios: [1.25, 1.5, 1.88] },
    { id: 'sfx_dew', group: 'nature', price: 360, icon: '🍃', nl: 'Ochtenddauw', en: 'Morning Dew', subNl: 'Helder druppeltje', subEn: 'Sparkling dewdrop', freq: 1040, type: 'sine', synth: 'mineral', overtone: 2.15, matchRatios: [1.25, 1.5, 2.0] },
  ]),

  frame: Object.freeze([
    { id: 'none', price: 0, starter: true, icon: '⚪', nl: 'Geen', en: 'None', subNl: 'Standaard rand', subEn: 'Default ring', borderCss: '3px solid #DFCCA4', ringShadow: 'none' },
    { id: 'frm_sky', price: 300, icon: '🩵', nl: 'Hemelsblauw', en: 'Sky Ribbon', subNl: 'Frisse blauwe ring', subEn: 'Fresh sky border', borderCss: '3.5px solid #3C9AD4', ringShadow: '0 0 0 4px #C2E7FF' },
    { id: 'frm_tulip', price: 340, icon: '🌷', nl: 'Tulpenkrans', en: 'Tulip Wreath', subNl: 'Vrolijke voorjaarsrand', subEn: 'Cheerful spring wreath', borderCss: '3.5px solid #E25B84', ringShadow: '0 0 0 4px #FFD1E1' },
    { id: 'frm_delft', price: 380, icon: '🏺', nl: 'Delfts Blauw', en: 'Delft Blue', subNl: 'Porseleinen sierlijst', subEn: 'Porcelain border', borderCss: '3.5px solid #2763B5', ringShadow: '0 0 0 4px #CBE1FF' },
    { id: 'frm_velvet', price: 440, icon: '🟣', nl: 'Koninklijk Fluweel', en: 'Royal Velvet', subNl: 'Diep bordeaux & goud', subEn: 'Deep velvet & gold', borderCss: '3.5px solid #7D2846', ringShadow: '0 0 0 3px #F6D273, 0 0 0 5px #7D2846' },
  ]),

  title: Object.freeze([
    { id: 'ttl_sun', price: 220, icon: '🌻', nl: 'Zonnebloem', en: 'Sunflower', subNl: 'Zonnige bijnaam', subEn: 'Sunny nickname' },
    { id: 'ttl_coffee', price: 240, icon: '☕', nl: 'Koffiepauze', en: 'Coffee Break', subNl: 'Even een bakkie erbij', subEn: 'Coffee in the other hand' },
    { id: 'ttl_cheese', price: 260, icon: '🧀', nl: 'Kaaskop', en: 'Cheese Fan', subNl: 'Echt Hollands', subEn: 'Proudly Dutch' },
    { id: 'ttl_cookie', price: 280, icon: '🍪', nl: 'Koekjesmonster', en: 'Cookie Monster', subNl: 'Voor de gezelligheid', subEn: 'Here for snacks and tiles' },
    { id: 'ttl_tea', price: 300, icon: '🫖', nl: 'Theeleut', en: 'Tea Cozy', subNl: 'Met een koekje erbij', subEn: 'With a biscuit on the side' },
    { id: 'ttl_couch', price: 340, icon: '🛋️', nl: 'Bankkoning', en: 'Couch Royalty', subNl: 'Lekker vanaf de bank', subEn: 'Playing from the sofa' },
  ]),

  postcard: Object.freeze([
    { id: 'pc_free', price: 0, icon: '❤️', nl: 'Gewoon hartje', en: 'Regular Heart', subNl: 'Altijd gratis', subEn: 'Always free' },
    { id: 'pc_coffee', price: 20, icon: '☕', nl: 'Kopje koffie', en: 'Cup of Coffee', subNl: 'Even samen bijkletsen', subEn: 'Warm coffee break' },
    { id: 'pc_cheer', price: 20, icon: '💪', nl: "Zet 'm op!", en: "You've got this!", subNl: 'Voor een pittig level', subEn: 'For a tough level' },
    { id: 'pc_sun', price: 25, icon: '🌻', nl: 'Zonnebloem', en: 'Sunflower', subNl: 'Een straaltje zon', subEn: 'Little ray of sun' },
    { id: 'pc_bouquet', price: 25, icon: '💐', nl: 'Bloemetje', en: 'Flower Bouquet', subNl: 'Zomaar voor jou', subEn: 'Just for you' },
    { id: 'pc_proud', price: 30, icon: '💖', nl: 'Trots op jou', en: 'Proud of you', subNl: 'Speciale familiekaart', subEn: 'Special family card' },
  ]),
});

const ONE_TIME_CATS = Object.freeze(['tiles', 'finish', 'tray', 'bg', 'fx', 'music', 'sfx', 'frame', 'title']);

function findCatalogItem(cat, id) {
  const list = SHOP_CATALOG[cat];
  if (!list) return null;
  return list.find(x => x.id === id) || null;
}

function isStarterItem(cat, id) {
  const item = findCatalogItem(cat, id);
  return Boolean(item && item.starter && item.price === 0);
}

function catalogSummary() {
  let newCount = 0;
  let newCoins = 0;
  let legacyCount = 0;
  let legacyCoins = 0;
  let starterCount = 0;
  const byCat = {};

  for (const cat of ONE_TIME_CATS) {
    const items = SHOP_CATALOG[cat];
    let cNew = 0, cNewCoins = 0, cLeg = 0, cLegCoins = 0;
    for (const it of items) {
      if (it.price === 0) {
        starterCount += 1;
      } else if (it.legacy) {
        legacyCount += 1;
        legacyCoins += it.price;
        cLeg += 1;
        cLegCoins += it.price;
      } else {
        newCount += 1;
        newCoins += it.price;
        cNew += 1;
        cNewCoins += it.price;
      }
    }
    byCat[cat] = { total: items.length, newCount: cNew, newCoins: cNewCoins, legacyCount: cLeg, legacyCoins: cLegCoins };
  }

  return {
    starterCount,
    newCount,
    newCoins,
    legacyCount,
    legacyCoins,
    totalBuyableCount: newCount + legacyCount,
    totalBuyableCoins: newCoins + legacyCoins,
    byCat,
  };
}

const catalogExports = {
  SHOP_RULES,
  SHOP_CATALOG,
  ONE_TIME_CATS,
  LEGACY_BG_NEEDS,
  EARNED_FRAMES,
  STARTER_OWNED,
  giftKey,
  isGiftKey,
  findCatalogItem,
  isStarterItem,
  catalogSummary,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = catalogExports;
} else if (typeof globalThis !== 'undefined') {
  Object.assign(globalThis, catalogExports);
} else if (typeof window !== 'undefined') {
  Object.assign(window, catalogExports);
}
