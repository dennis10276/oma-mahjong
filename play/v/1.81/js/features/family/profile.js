// uses: core/*, rules, lang, family/presence, family/hearts
/* Oma's Mahjong — family/profile: avatar frames, avatars, asking for the name. */
'use strict';

// ---- avatar frames, earned through prizes ----
// (names in lang.js: fr_<id>; how = how you earn it)
const FRAMES = [
  { id: 'none', ok: () => true, how: () => '' },
  { id: 'bronze', ok: () => trophyCount() >= 4, how: () => tx('how_prizes', 4) },
  { id: 'silver', ok: () => trophyCount() >= 8, how: () => tx('how_prizes', 8) },
  { id: 'gold', ok: () => trophyCount() >= 12, how: () => tx('how_prizes', 12) },
  { id: 'sun', ok: () => sunUnlocked(), how: () => tx('how_level', RULES.sunflower.level) },
  { id: 'heart', ok: () => (S.stats.hearts || 0) >= 3, how: () => tx('how_hearts') },
  { id: 'rainbow', ok: () => !!S.trophies.c5, how: () => tx('how_combo') },
  { id: 'crown', ok: () => S.weekWins >= 1, how: () => tx('how_week') },
];
// the shop's photo frames (frm_*): yours once you bought them; the look is `.ra.fr-<id>` in style.css
for (const it of SHOP_CATALOG.frame) if (!it.starter) FRAMES.push({ id: it.id, shop: it, ok: () => ShopEconomy.ownsItem(S, 'frame', it.id), how: () => tx('how_shopFrame') });
FRAMES.forEach(f => Object.defineProperty(f, 'name', { get: () => f.shop ? (isEn() ? f.shop.en : f.shop.nl) : tx('fr_' + f.id) }));
const frameOk = id => (FRAMES.find(f => f.id === id) || FRAMES[0]).ok();
const avatarHTML = (e, cls = 'ra', online = false) => `<span class="${cls} fr-${e.frame && e.frame !== 'none' ? e.frame : 'none'}">${e.avatar}${online ? '<span class="presence-dot" aria-hidden="true"></span>' : ''}</span>`;

const AVATARS = ['👵', '👴', '😊', '🌻', '🐱', '🐶', '🌷', '⭐', '🦋', '🍀', '🎩', '🚀'];
function askName(then) {
  const cur = S.name || '';
  let av = S.avatar || '👵', fr = frameOk(S.frame || 'none') ? (S.frame || 'none') : 'none';
  openModal(`<h2>${tx(cur ? 'profile' : 'whatName')}</h2>
    <p>${fx('nameWhy')}</p>
    <input id="nmIn" class="name-in" maxlength="20" value="${cur.replace(/"/g, '')}" placeholder="${tx('namePh')}" autocomplete="off">
    <div class="quick-names fit-row">${tx('quickNames').map(n => `<button class="qn">${n}</button>`).join('')}</div>
    <div class="avatars">${AVATARS.map(a => `<button class="av${av === a ? ' on' : ''}">${a}</button>`).join('')}</div>
    <h3 class="fr-title">${fx('frameTitle')}</h3>
    <div class="frames">${FRAMES.map(f => `<button class="frm${fr === f.id ? ' on' : ''}${f.ok() ? '' : ' locked'}" data-f="${f.id}"><span class="ra fr-${f.id}">${av}</span><small>${f.ok() ? f.name : '🔒 ' + f.how()}</small></button>`).join('')}</div>
    <button class="big-btn play" id="nmOk"><span class="bb-text"><b>${tx('save')}</b></span></button>`, false);
  document.querySelectorAll('.qn').forEach(b => b.onclick = () => { $('#nmIn').value = b.textContent; });
  document.querySelectorAll('.av').forEach(b => b.onclick = () => { av = b.textContent; document.querySelectorAll('.av').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.frm .ra').forEach(x => x.textContent = av); });
  document.querySelectorAll('.frm').forEach(b => b.onclick = () => {
    const f = FRAMES.find(x => x.id === b.dataset.f);
    if (!f.ok()) { toast(tx('frameHow', f.how())); Sound.blocked(); return; }
    fr = f.id; document.querySelectorAll('.frm').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#nmOk').onclick = () => {
    const v = $('#nmIn').value.trim().replace(/[<>]/g, '').slice(0, 20);
    if (!v) { $('#nmIn').focus(); toast(tx('nameFirst')); return; }
    S.name = v; S.avatar = av; S.frame = fr; ensureId(); save(); closeModal(); pushScore(); startHeartStream(); if (then) then();
  };
}
