// uses: core/*, rules, lang, tiles, screens (setLang, showIntro)
/* Oma's Mahjong — settings/settings: the settings pop-up and wiping all progress. */
'use strict';

function openSettings() {
  const rows = ['sfx', 'music', 'musicShuffle', 'vibrate', 'highlight'];   // no corner-numbers row: the classic tiles never show them (Dennis 2026-11-26)
  const cur = langOf(S);
  openModal(`<h2>${tx('settings')}</h2>
    <div class="set-row">${fx('set_lang')}<span class="lang-pick">${Object.entries(LANGS).map(([c, n]) => `<button class="lp${c === cur ? ' on' : ''}" data-lang="${c}">${n}</button>`).join('')}</span></div>
    ${rows.map(k => `<div class="set-row">${fx('set_' + k)}<button class="tog ${S[k] ? 'on' : ''}" data-k="${k}"></button></div>`).join('')}
    <button class="big-btn gold" id="mHow"><span class="bb-text"><b>${tx('howToPlay')}</b></span></button>
    <button class="link-btn" id="mRestore">${tx('restoreBtn')}</button>
    <button class="link-btn" id="mClose">${tx('close')}</button>
    <button class="reset-btn" id="mReset">${tx('wipe')}</button>
    <div class="version">${tx('version', APP_VERSION)}</div>`);
  $('#modalBox').querySelectorAll('.lp').forEach(b => b.onclick = () => { setLang(b.dataset.lang); openSettings(); });
  $('#modalBox').querySelectorAll('.tog').forEach(t => t.onclick = () => {
    const k = t.dataset.k; S[k] = !S[k]; t.classList.toggle('on', S[k]); save();
    if (k === 'sfx') Sound.setSfx(S.sfx);
    if (k === 'music') Sound.setMusic(S.music);
    if (k === 'musicShuffle') Sound.refreshShuffle();
    if (k === 'vibrate' && S.vibrate) buzz(40);
    if (k === 'highlight') $('#board').classList.toggle('hl', S.highlight);
  });
  $('#mHow').onclick = () => showIntro();
  $('#mReset').onclick = confirmReset;
  $('#mRestore').onclick = () => askRestore();
  $('#mClose').onclick = closeModal;
}

// wipe levels, stars, daily puzzles and prizes; keep the sound/vibration/display settings
function confirmReset() {
  openModal(`<h2>${tx('wipeTitle')}</h2>
    <p>${tx('wipeText')}</p>
    <p style="font-size:17px;color:#a33">${tx('wipeWarn')}</p>
    <button class="big-btn play" id="rsNo"><span class="bb-text"><b>${tx('wipeNo')}</b></span></button>
    <button class="reset-btn" id="rsYes">${tx('wipeYes')}</button>`);
  $('#rsNo').onclick = closeModal;
  $('#rsYes').onclick = () => {
    const keep = { sfx: S.sfx, music: S.music, musicShuffle: !!S.musicShuffle, vibrate: S.vibrate, highlight: S.highlight, nums: S.nums, seenIntro: true, seenTray: true, seenDown: !!S.seenDown, seenSp: S.seenSp, pid: S.pid, name: S.name, avatar: S.avatar, heartsSeen: S.heartsSeen, lang: S.lang };
    const theme = Tiles.THEMES[S.theme] && !Tiles.THEMES[S.theme].prize ? S.theme : 'classic';
    Object.keys(S).forEach(k => delete S[k]);
    Object.assign(S, defaults(), keep, { theme });
    save(); clearCur(); G = null; pushScore();
    applyTheme(); applyBg();
    closeModal(); show('home');
    toast(tx('wiped'));
  };
}
