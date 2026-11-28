/* Oma's Mahjong — the Winkel (shop) screen: header, four tabs that swipe, one page per tab. */
'use strict';

const SHOP_TABS = ['bord', 'muziek', 'familie', 'hulpen'];
let shopTab = 'bord', shopPlaying = '', shopBusy = false, shopBound = false, shopTapsBound = false;
const shopLabel = tab => tx('shop' + tab[0].toUpperCase() + tab.slice(1));

// ---------- cards: the markup of the approved stills (design-set/redo/capture.js) ----------
const shopName = it => isEn() ? it.en : it.nl, shopSub = it => isEn() ? it.subEn : it.subNl;
const shopOwns = (cat, id) => ShopEconomy.ownsItem(S, cat, id);
const shopOn = (cat, it) => ShopEconomy.resolveEquippedItem(S, cat) === it.id ? ' on' : '';
// the items of a category: the ids in `lead` first (the stills' order), then the rest of the catalogue
const shopItems = (cat, lead = []) => { const all = SHOP_CATALOG[cat]; return lead.map(id => all.find(x => x.id === id)).concat(all.filter(x => !lead.includes(x.id))).filter(Boolean); };
const buyBits = (cat, it) => shopOwns(cat, it.id) ? '' : `<span class="buy"><span class="price${S.coins < it.price ? ' off' : ''}">${it.price} 🪙</span>${ShopEconomy.canGiftShopItem(cat, it.id) ? '<span class="gift">🎁</span>' : ''}</span>`;
const finStyle = it => `background:${it.tileBg};border:2px solid ${it.tileBorder};--lip:${it.tileLip}`;
const minis = (theme, ks, style = '') => ks.map(k => `<div class="mini${style ? ' fin' : ''}"${style ? ` style="${style}"` : ''}>${Tiles.faceHTML(theme, k)}</div>`).join('');
const trayBox = it => `<div class="trayprev" style="background:${it.trayBg}"><i></i><i></i><i></i><i></i></div>`;
const frameBox = it => `<span class="avf" style="border:${it.borderCss};box-shadow:${it.ringShadow}">😊</span>`;
const card = (cat, it, top) => `<button class="th${shopOn(cat, it)}" data-cat="${cat}" data-id="${it.id}">${top}<span class="nm">${shopName(it)}</span>${buyBits(cat, it)}</button>`;
const tileCard = it => card('tiles', it, `<div class="pv">${minis(it.id, it.id === 'classic' ? [0, 31, 22] : [0, 5, 13])}</div>`);
const finCard = it => card('finish', it, `<div class="pv">${minis('sunflower', [0, 5, 13], finStyle(it))}</div>`);
const trayCard = it => card('tray', it, trayBox(it));
const frameCard = it => card('frame', it, frameBox(it));
const bgCard = it => `<button class="bgc${shopOn('bg', it)}${shopOwns('bg', it.id) ? '' : ' pay'}" data-cat="bg" data-id="${it.id}" style="background:${it.css}">${shopName(it)}${buyBits('bg', it)}</button>`;
const titleRow = it => `<button class="row-item${shopOn('title', it)}" data-cat="title" data-id="${it.id}"><span class="ico">${it.icon}</span><span class="tx"><b>${shopName(it)}</b><small>${shopSub(it)}</small></span>${buyBits('title', it)}</button>`;
const musicRow = (cat, it) => `<button class="row-item${shopOn(cat, it)}" data-cat="${cat}" data-id="${it.id}"><span class="pbtn" data-play="${it.id}">${shopPlaying === it.id ? '■' : '▶'}</span><span class="tx"><b>${shopName(it)}</b><small>${shopSub(it)}</small></span>${buyBits(cat, it)}</button>`;
const shopSec = (key, cls, html) => `<h3 class="sec">${tx(key)}</h3><div class="${cls}">${html}</div>`;
const postcardRow = it => `<button class="row-item" data-postcard-shop="${it.id}"><span class="ico">${it.icon}</span><span class="tx">
  <b>${shopName(it)}</b><small>${shopSub(it)}</small></span><span class="price">${it.price} 🪙</span></button>`;

// The one place that builds a tab page (Tasks 3-4 fill the others).
function shopPage(tab) {
  const L = (cat, lead) => shopItems(cat, lead);
  if (tab === 'bord') return shopSec('shopSecTiles', 'theme-list', L('tiles', ['tiles_kitchen', 'tiles_dutch', 'sunflower', 'classic', 'fruit', 'animals', 'happy']).map(tileCard).join(''))
    + shopSec('shopSecBg', 'bg-list', L('bg', ['surf_linen', 'surf_terrace', 'surf_dusk', 'sunfield', 'jade']).map(bgCard).join(''))
    + shopSec('shopSecFinish', 'theme-list', L('finish').map(finCard).join(''))
    + shopSec('shopSecTray', 'theme-list', L('tray').map(trayCard).join(''));
  if (tab === 'familie') return shopSec('shopSecFrame', 'theme-list', L('frame').map(frameCard).join(''))
    + shopSec('shopSecTitle', 'row-list', L('title').map(titleRow).join(''))
    + shopSec('shopSecPostcard', 'row-list', paidPostcards().map(postcardRow).join(''));
  if (tab === 'muziek') return shopSec('shopSecMusic', 'row-list', L('music', ['mus_sunflower', 'mus_piano']).map(it => musicRow('music', it)).join(''))
    + (SHOP_SFX_READY ? shopSec('shopSecSfx', 'row-list', L('sfx', ['sfx_ivory', 'sfx_mahjong_clack']).map(it => musicRow('sfx', it)).join('')) : '');
  return helpCard('undo') + helpCard('peek');
}

// ---------- Hulpen: one card per helper, one button that says what a tap does ----------
const HELPERS = {
  undo: { icon: '↩️', status: () => ShopEconomy.undoStatus(S), claim: h => ShopEconomy.claimFreeUndo(S, h), buy: h => ShopEconomy.buyUndoToken(S, h) },
  peek: { icon: '👁️', status: () => ShopEconomy.peekStatus(S), claim: h => ShopEconomy.claimFreePeek(S, h), buy: h => ShopEconomy.buyPeekToken(S, h) },
};
function helpButton(id, st) {
  const mk = (cls, b, sm, act = '') => `<button class="big-btn ${cls}"${act ? ` data-act="${act}"` : ' disabled'}><span class="bb-text"><b>${b}</b>${sm ? `<small>${sm}</small>` : ''}</span></button>`;
  if (st.canClaimFree) return mk('play', tx('shopHelpFree'), tx('shopHelpFreeSub'), 'claim');
  if (st.canBuy) return mk('daily', tx('shopHelpBuy', st.price), tx('shopHelpLeft', st.buyRemaining), 'buy');
  if (st.buyReason === 'stock_full') return mk('off', tx('shopHelpFull'), tx('shopHelpFullSub'));
  if (st.buyReason === 'week_limit') return mk('off', tx('shopHelpLimit', st.boughtThisWeek), tx('shopHelpLimitSub'));
  if (st.buyReason === 'not_enough_coins') return mk('off', tx('shopHelpBuy', st.price), tx('shopNeed', st.needCoins));
  return mk('off', tx('shopHelpWait'), st.buyReason === 'gift_pending' ? tx('shopHelpWaitSub') : '');
}
function helpCard(id) {
  const st = HELPERS[id].status();
  return `<div class="card help-card" data-help="${id}"><span class="hico">${HELPERS[id].icon}</span><h3>${tx('shopHelp_' + id)}</h3><p>${tx('shopHelpAbout_' + id)}</p><span class="once">${tx('shopHelpOnce')}</span>
    <div class="stock">${[0, 1, 2].map(i => `<i class="${i < st.stock ? 'f' : ''}"></i>`).join('')}<span>${tx('shopHelpStock', st.stock, st.maxStock)}</span></div>${helpButton(id, st)}</div>`;
}
const helperHooks = () => ({ save, log: logEvt, ensureWeek, pushScore });
// a refused buy or claim always says why
const shopRefused = r => { Sound.blocked(); toast(tx('shopBuyFail', r.reason)); };
function helpAct(id, act) {
  const h = HELPERS[id];
  if (act === 'claim') { const r = h.claim(helperHooks()); if (r.ok) { Sound.select(); refreshShop(); } else shopRefused(r); return; }
  const st = h.status();
  confirmBuy({
    title: tx('shopBuyQ', tx('shopHelp_' + id)), previewHTML: `<div class="bigico">${h.icon}</div>`, price: st.price,
    onBuy: () => { const r = h.buy(helperHooks()); if (r.ok) { Sound.select(); refreshShop(); } else shopRefused(r); return r.ok; },
  });
}

// ---------- equipping and buying ----------
const applyLook = cat => ({ tiles: applyTheme, bg: applyBg, finish: applyFinish, tray: applyTray, music: () => { stopShopPreview(); Sound.applyAudio({ musicTrack: S.musicTrack }); }, sfx: () => { stopShopPreview(); Sound.applyAudio({ sfxPack: S.sfxPack }); } })[cat]?.();
// the ▶ of a music row: one preview at a time, a second tap on it stops it; leaving the tab or the shop stops it too
function stopShopPreview() {
  if (!shopPlaying) return;
  const was = shopPlaying;
  shopPlaying = '';
  if (was.startsWith('sfx_')) Sound.stopSfxPreview(); else Sound.stopPreview();
  document.querySelectorAll('#shopView .pbtn').forEach(b => b.textContent = '▶');
}
function togglePreview(id) {
  if (shopPlaying === id) { stopShopPreview(); return; }
  if (shopPlaying && shopPlaying.startsWith('sfx_') !== id.startsWith('sfx_')) stopShopPreview();   // one preview at a time: music or sound pack
  const ended = () => { if (shopPlaying === id) { shopPlaying = ''; document.querySelectorAll('#shopView .pbtn').forEach(b => b.textContent = '▶'); } };
  if (!(id.startsWith('sfx_') ? Sound.previewSfx(id, ended) : Sound.previewMusic(id))) return;
  shopPlaying = id;
  document.querySelectorAll('#shopView .pbtn').forEach(b => b.textContent = b.dataset.play === id ? '■' : '▶');
}
// the Steengeluid rows are shown: audio.js plays every pack
const SHOP_SFX_READY = true;
// on boot: finish or resend a gift a lost connection left unconfirmed (the receiver drops a second copy by its gid),
// so it never keeps blocking buying
async function resumeShopGift() {
  const was = ShopEconomy.hasPendingGiftSpend(S);
  try { await ShopEconomy.resumePendingGift(S, { ...giftHooks(), resend: true, renderCoins: renderHomeCoins }); } catch (e) { }
  if (curScreen === 'shop' && was !== ShopEconomy.hasPendingGiftSpend(S)) refreshShop();   // (a refresh during a swipe would drop the drag)
}
const lookHooks = () => ({ apply: applyLook, save, log: logEvt, pushScore });
function refreshShop() {   // draw the tab again and the coin chip, the scroll stays
  const page = () => $(`#shopView > .scroll[data-tab="${shopTab}"]`), y = page() ? page().scrollTop : 0;
  renderShop();
  page().scrollTop = y;
}
function equipLook(cat, id) {
  const cur = ShopEconomy.resolveEquippedItem(S, cat);
  if (cat === 'title' && cur === id) id = '';   // a tap on the nickname in use takes it off
  else if (cur === id) return;
  if (ShopEconomy.equipItem(S, cat, id, lookHooks()).ok) { Sound.select(); refreshShop(); }
}
// The one confirm popup (looks now, helpers in Task 4). onBuy returns true when it bought; onGift (optional) shows 🎁 Cadeau.
function confirmBuy({ title, previewHTML, price, onBuy, onGift }) {
  const need = price - S.coins, can = need <= 0;
  openModal(`<h2>${title}</h2>${previewHTML}<p>${can ? tx('shopLeft', S.coins - price) : tx('shopNeed', need)}</p>
    <button class="big-btn ${can ? 'play' : 'off'}" id="buyOk"${can ? '' : ' disabled'}><span class="bb-text"><b>${tx('shopBuyBtn', price)}</b></span></button>
    <div class="btn-row">${onGift ? `<button class="btn2" id="buyGift">${tx('shopGift')}</button>` : ''}<button class="btn2" id="buyNo">${tx('shopCancel')}</button></div>`);
  $('#buyNo').onclick = closeModal;
  if (onGift) $('#buyGift').onclick = () => { closeModal(); onGift(); };
  $('#buyOk').onclick = async e => {
    const b = e.currentTarget;
    if (shopBusy || b.disabled) return;
    shopBusy = b.disabled = true;   // a second tap while this runs does nothing
    let ok = false;
    try { ok = await onBuy(); } catch (err) { logErr(err, 'shopBuy'); toast(tx('shopBuyFail', 'error')); } finally { shopBusy = false; }
    if (ok) closeModal(); else b.disabled = !can;
  };
}
function buyPreview(cat, it) {
  const big = h => `<div class="pvbig">${h}</div>`;
  if (cat === 'tiles') return big(minis(it.id, it.id === 'classic' ? [0, 31, 22, 10] : [0, 5, 13, 20]));
  if (cat === 'finish') return big(minis('sunflower', [0, 5, 13, 20], finStyle(it)));
  if (cat === 'tray') return big(trayBox(it));
  if (cat === 'frame') return big(frameBox(it));
  if (cat === 'bg') return `<div class="bgprev" style="background:${it.css}"></div>`;
  return `<div class="bigico">${it.icon}</div>`;
}
function buyPopup(cat, id) {
  const it = findCatalogItem(cat, id);
  if (!it) return;
  confirmBuy({
    title: tx('shopBuyQ', shopName(it)), previewHTML: buyPreview(cat, it), price: it.price,
    onGift: ShopEconomy.canGiftShopItem(cat, id) ? () => giftPicker(cat, id) : null,
    onBuy: () => {
      const r = ShopEconomy.buyItem(S, cat, id, lookHooks());
      if (r.ok) { Sound.select(); refreshShop(); } else shopRefused(r);
      return r.ok;
    },
  });
}
// ---------- gifts: pick a family member, ShopEconomy.sendShopGift does the sending and keeps the retry contract ----------
const giftHooks = () => ({
  send: dbSend, log: logEvt,
  save,
  read: async path => { try { const r = await fetch(dbUrl(path), { cache: 'no-store' }); return r.ok ? { ok: true, value: await r.json() } : { ok: false }; } catch (e) { return { ok: false }; } },
});
function giftPicker(cat, id) {
  const it = findCatalogItem(cat, id);
  if (!it || !ShopEconomy.canGiftShopItem(cat, id)) return;
  const fam = ranking(undefined, 'all').filter(isFam);
  const rows = fam.map(e => `<div class="gift-row">${avatarHTML(e, 'ra')}<span class="gn">${esc(e.name)}</span><button class="gbtn" data-pid="${esc(e.id)}">${tx('shopGive')}</button></div>`).join('');
  openModal(`<h2>${tx('shopGiftTo', shopName(it))}</h2>${fam.length ? `<div class="gift-list">${rows}</div><p>${it.price} 🪙</p>` : `<p>${tx('shopNoFamily')}</p>`}
    <button class="btn2" id="giftNo">${tx('shopCancel')}</button>`);
  $('#giftNo').onclick = closeModal;
  $('#modalBox').querySelectorAll('.gbtn').forEach(b => b.onclick = async () => {
    if (shopBusy) return;
    shopBusy = true;
    $('#modalBox').querySelectorAll('.gbtn').forEach(x => x.disabled = true);   // one gift at a time
    const e = fam.find(x => x.id === b.dataset.pid);
    let r = { ok: false, reason: 'error' };
    try { r = await ShopEconomy.sendShopGift(S, cat, id, e.id, giftHooks()); } finally { shopBusy = false; }
    if (r.ok) { closeModal(); Sound.select(); refreshShop(); toast(tx('shopGiftSent', e.name)); }
    else { $('#modalBox').querySelectorAll('.gbtn').forEach(x => x.disabled = false); toast(tx('shopGiftFail', r.reason)); }
  });
}

function postcardPicker(id) {
  if (!S.name) return askName(() => postcardPicker(id));
  const card = findCatalogItem('postcard', id);
  if (!card?.price) return;
  const family = ranking(undefined, 'all').filter(isFam);
  const rows = family.map(e => `<div class="gift-row">${avatarHTML(e, 'ra')}<span class="gn">${esc(e.name)}</span>
    <button class="gbtn" data-pid="${esc(e.id)}"${postcardSentToday(e.id) ? ' disabled' : ''}>
      ${postcardSentToday(e.id) ? tx('heartCardAlready') : tx('shopGive')}</button></div>`).join('');
  openModal(`<h2>${tx('shopPostcardTo')}</h2>${family.length ? `<div class="gift-list">${rows}</div><p>${card.price} 🪙</p>` : `<p>${tx('shopNoFamily')}</p>`}
    <button class="btn2" id="pcPickerBack">${tx('backPlain')}</button>`);
  $('#pcPickerBack').onclick = closeModal;
  $('#modalBox').querySelectorAll('.gbtn:not([disabled])').forEach(button => button.onclick = () => {
    const recipient = family.find(e => e.id === button.dataset.pid);
    confirmPostcard(recipient.id, recipient.name, id, '', keepModal());
  });
}

function bindShopTaps() {
  if (shopTapsBound) return;
  shopTapsBound = true;
  $('#shopView').addEventListener('click', e => {
    if (shopBusy) return;
    const act = e.target.closest('[data-act]');
    if (act) { helpAct(act.closest('[data-help]').dataset.help, act.dataset.act); return; }
    const play = e.target.closest('[data-play]');
    if (play) { togglePreview(play.dataset.play); return; }
    const postcard = e.target.closest('[data-postcard-shop]');
    if (postcard) { postcardPicker(postcard.dataset.postcardShop); return; }
    const card = e.target.closest('[data-cat]');
    if (!card) return;
    const { cat, id } = card.dataset;
    if (e.target.closest('.gift')) giftPicker(cat, id);
    else if (shopOwns(cat, id)) equipLook(cat, id);
    else buyPopup(cat, id);
  });
}

function renderShop(tab = shopTab) {
  shopTab = tab;
  if (tab !== 'muziek') stopShopPreview();
  $('#shopCoins').textContent = '🪙 ' + S.coins;
  const tabs = $('#shopTabs'), view = $('#shopView');
  tabs.innerHTML = SHOP_TABS.map(id => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${shopLabel(id)}</button>`).join('');
  view.innerHTML = SHOP_TABS.map(id => `<div class="scroll" data-tab="${id}">${shopPage(id)}</div>`).join('');
  paintShop(SHOP_TABS.indexOf(tab));
  bindShopSwipe(); bindShopTaps();
  fitTexts($('#shop'));
}

// progress = fractional tab index: pages and the tab bar's pill follow it
function paintShop(progress) {
  $('#shopTabs').style.setProperty('--slide', progress);
  $('#shopView').querySelectorAll(':scope > .scroll').forEach((page, i) => {
    page.style.setProperty('--x', (i - progress) * 100 + '%');
    page.inert = Math.abs(i - progress) >= 1;
  });
}

// Same mechanics as the ranking's swipe: drag follows the finger, 260 ms settle, 24 px of travel to commit (Dennis 2026-11-27: "the same easy swipe").
function bindShopSwipe() {
  if (shopBound) return;
  shopBound = true;
  const view = $('#shopView'), tabs = $('#shopTabs');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let drag = null, progress = 0, timer = null;
  const index = () => SHOP_TABS.indexOf(shopTab);
  function settle(to) {
    to = Math.max(0, Math.min(SHOP_TABS.length - 1, to));
    clearTimeout(timer);
    const done = () => { view.classList.remove('shop-settling'); tabs.classList.remove('shop-settling'); shopTab = SHOP_TABS[to]; renderShop(shopTab); };
    if (reduce.matches || progress === to) { done(); return; }
    view.getBoundingClientRect();   // fix the drag position before the transition starts
    view.classList.add('shop-settling'); tabs.classList.add('shop-settling');
    progress = to; paintShop(to);
    timer = setTimeout(done, 280);
  }
  tabs.addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (!b || drag) return;
    const to = SHOP_TABS.indexOf(b.dataset.tab);
    if (to !== index()) { progress = index(); settle(to); }
  });
  view.addEventListener('pointerdown', e => {
    if (!e.isPrimary || !modalFree() || view.classList.contains('shop-settling')) return;
    progress = index();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, horizontal: false };
  });
  view.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.horizontal) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
      drag.horizontal = true;
      try { view.setPointerCapture(e.pointerId); } catch (err) { }
    }
    progress = Math.max(0, Math.min(SHOP_TABS.length - 1, index() - dx / view.clientWidth));
    paintShop(progress);
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.horizontal) return;
    const moved = progress - index();
    settle(index() + (e.type === 'pointerup' && Math.abs(moved) * view.clientWidth >= 24 ? Math.sign(moved) : 0));   // 24 px, like the ranking
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
}
