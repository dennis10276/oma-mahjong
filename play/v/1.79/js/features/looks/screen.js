// uses: core/*, rules, lang, looks
/* Oma's Mahjong — looks/screen: the Zonnebloem goal on the home screen, the themes screen, the sunflower unlock pop-up. */
'use strict';
// the Zonnebloem prize: levels played so far, out of the levels needed
const sunProgress = () => { const need = RULES.sunflower.level, done = Math.min(need, S.level - 1); return { need, done, left: need - done, pct: Math.round(done / need * 100) }; };
function renderGoal(el) {
  if (!sunUnlocked()) {
    // the big prize comes first
    const { left, pct } = sunProgress();
    el.classList.add('sun');
    el.innerHTML = `<span class="g-ico">🌻</span><div>${fx('goalSun', left)}<div class="bar"><i style="width:${pct}%"></i></div></div>`;
    return;
  }
  el.classList.remove('sun');
  const ts = totalStars();
  const next = numBgs.find(b => b.need > ts);
  if (!next) { el.innerHTML = tx('goalAllBgs'); return; }
  const prev = [...numBgs].reverse().find(b => b.need <= ts);
  const pct = Math.round((ts - prev.need) / (next.need - prev.need) * 100);
  el.innerHTML = `${fx('goalBg', next.need - ts, next.name)}<div class="bar"><i style="width:${pct}%"></i></div>`;
}

function renderThemes() {
  $('#thStars').textContent = '⭐ ' + totalStars();
  const un = sunUnlocked(), sc = $('#sunCard'), sp = sunProgress();
  sc.innerHTML = `<button class="suncard${un ? '' : ' locked'}${S.theme === 'sunflower' ? ' on' : ''}">
    <span class="sun-ico">🌻</span>
    <span class="sun-txt"><b>${tx('sunName')}</b><small>${un ? tx(S.theme === 'sunflower' ? 'inUse' : 'tapToUse') : tx('sunLocked', sp.need)}</small>
    ${un ? `<small>${tx('sunAbout')}</small>` : `<span class="bar"><i style="width:${sp.pct}%"></i></span><small>${tx('sunProgress', sp.done, sp.need)}</small>`}</span>
    <span class="sun-pv">${[0, 1, 2].map(k => `<span class="mini">${Tiles.faceHTML('sunflower', k)}</span>`).join('')}</span></button>`;
  sc.firstElementChild.onclick = () => {
    if (!un) { toast(tx('sunNeedMore', sp.left)); Sound.blocked(); return; }
    S.theme = 'sunflower'; S.bg = 'sunfield'; save(); applyBg(); applyTheme(); renderThemes(); Sound.sunflower(); FX.emoji(innerWidth / 2, innerHeight / 3, ['🌻', '🌼', '🐝'], 12);
  };
  const tl = $('#tileThemes'); tl.innerHTML = '';
  for (const [id, t] of Object.entries(Tiles.THEMES)) {
    if (t.prize) continue;
    const b = document.createElement('button');
    b.className = 'th' + (S.theme === id ? ' on' : '');
    const sample = id === 'classic' ? [0, 31, 22] : [0, 5, 13];
    b.innerHTML = `<div class="pv">${sample.map(k => `<div class="mini">${Tiles.faceHTML(id, k)}</div>`).join('')}</div>${tx('theme_' + id)}`;
    b.onclick = () => { S.theme = id; save(); applyTheme(); renderThemes(); Sound.select(); };
    tl.appendChild(b);
  }
  const bl = $('#bgThemes'); bl.innerHTML = '';
  const ts = totalStars();
  for (const bg of BGS) {
    const b = document.createElement('button');
    const locked = bgLocked(bg);
    b.className = 'bgc' + (locked ? ' locked' : '') + (S.bg === bg.id ? ' on' : '');
    b.style.background = bg.css;
    b.innerHTML = locked ? `<div class="lock">🔒<br>${bg.sun ? tx('levelWord', RULES.sunflower.level) : bg.need + ' ⭐'}</div>` : bg.name;
    b.onclick = () => {
      if (locked) { toast(bg.sun ? tx('bgSunLocked', RULES.sunflower.level) : tx('bgNeedStars', bg.need - ts, bg.name)); Sound.blocked(); return; }
      S.bg = bg.id; save(); applyBg(); renderThemes(); Sound.select();
    };
    bl.appendChild(b);
  }
}
function showSunflowerUnlock(then) {
  S.sunSeen = true; save();
  Sound.sunflower(); FX.sunRain(); buzz([30, 60, 30, 60, 30, 60, 80]);
  openModal(`<div class="sun-big">🌻</div><h2>${tx('sunWin')}</h2>
    <p>${tx('sunWinText')}</p>
    <button class="big-btn gold" id="sunUse"><span class="bb-text"><b>${tx('sunUse')}</b></span></button>
    <button class="link-btn" id="sunLater">${tx('sunLater')}</button>`, false);
  $('#sunUse').onclick = () => { S.theme = 'sunflower'; S.bg = 'sunfield'; save(); applyBg(); applyTheme(); closeModal(); FX.emoji(innerWidth / 2, innerHeight / 2, ['🌻', '🌼', '🐝', '✨'], 16); then(); };
  $('#sunLater').onclick = () => { closeModal(); then(); };
}
