/* Oma's Mahjong — the Winkel (shop) screen: header, four tabs that swipe, one page per tab. */
'use strict';

const SHOP_TABS = ['bord', 'muziek', 'familie', 'hulpen'];
let shopTab = 'bord', shopBusy = false, shopBound = false;
const shopLabel = tab => tx('shop' + tab[0].toUpperCase() + tab.slice(1));

// The one place that builds a tab page (Tasks 2-4 fill it per tab).
function shopPage(tab) { return `<h3 class="sec">${shopLabel(tab)}</h3>`; }

function renderShop(tab = shopTab) {
  shopTab = tab;
  $('#shopCoins').textContent = '🪙 ' + S.coins;
  const tabs = $('#shopTabs'), view = $('#shopView');
  tabs.innerHTML = SHOP_TABS.map(id => `<button data-tab="${id}" class="${id === tab ? 'on' : ''}">${shopLabel(id)}</button>`).join('');
  view.innerHTML = SHOP_TABS.map(id => `<div class="scroll" data-tab="${id}">${shopPage(id)}</div>`).join('');
  paintShop(SHOP_TABS.indexOf(tab));
  bindShopSwipe();
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
