/* Oma's Mahjong — the Winkel (shop) screen: header, four tabs that swipe, one page per tab. */
'use strict';

const SHOP_TABS = ['bord', 'muziek', 'familie', 'hulpen'];
let shopTab = 'bord', shopBusy = false, shopBound = false, shopTapsBound = false;
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
const shopSec = (key, cls, html) => `<h3 class="sec">${tx(key)}</h3><div class="${cls}">${html}</div>`;

// The one place that builds a tab page (Tasks 3-4 fill the others).
function shopPage(tab) {
  const L = (cat, lead) => shopItems(cat, lead);
  if (tab === 'bord') return shopSec('shopSecTiles', 'theme-list', L('tiles', ['tiles_kitchen', 'tiles_dutch', 'sunflower', 'classic', 'fruit', 'animals', 'happy']).map(tileCard).join(''))
    + shopSec('shopSecBg', 'bg-list', L('bg', ['surf_linen', 'surf_terrace', 'surf_dusk', 'sunfield', 'jade']).map(bgCard).join(''))
    + shopSec('shopSecFinish', 'theme-list', L('finish').map(finCard).join(''))
    + shopSec('shopSecTray', 'theme-list', L('tray').map(trayCard).join(''));
  if (tab === 'familie') return shopSec('shopSecFrame', 'theme-list', L('frame').filter(it => !it.starter).map(frameCard).join(''))
    + shopSec('shopSecTitle', 'row-list', L('title').map(titleRow).join(''));
  return `<h3 class="sec">${shopLabel(tab)}</h3>`;
}

// ---------- equipping and buying ----------
const applyLook = cat => ({ tiles: applyTheme, bg: applyBg, finish: applyFinish, tray: applyTray })[cat]?.();
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
    try { ok = await onBuy(); } finally { shopBusy = false; }
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
      if (r.ok) { Sound.select(); refreshShop(); }
      return r.ok;
    },
  });
}
function giftPicker(cat, id) { toast(tx('shopGiftSoon')); }   // Task 3 replaces this with the real picker

function bindShopTaps() {
  if (shopTapsBound) return;
  shopTapsBound = true;
  $('#shopView').addEventListener('click', e => {
    const card = e.target.closest('[data-cat]');
    if (!card || shopBusy) return;
    const { cat, id } = card.dataset;
    if (e.target.closest('.gift')) giftPicker(cat, id);
    else if (shopOwns(cat, id)) equipLook(cat, id);
    else buyPopup(cat, id);
  });
}

function renderShop(tab = shopTab) {
  shopTab = tab;
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

// Same mechanics as the ranking's swipe: drag follows the finger, 260 ms settle, 25% of the width to commit.
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
    settle(index() + (e.type === 'pointerup' && Math.abs(moved) >= .25 ? Math.sign(moved) : 0));
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
}
