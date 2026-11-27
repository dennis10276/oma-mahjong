// uses: core/*, rules, lang, board, family/*
/* Oma's Mahjong — hearts between family members, with an optional short message.
   hearts/<to>/<from> = { name, t }: t < 0 means "seen" (the receiver turns it negative).
   Messages and standalone paid postcards go to plays/msg-<to> (see MSG in rules.js).
   Timings are in RULES.hearts. */
'use strict';

const sentToday = pid => S.heartsSent[pid] === todayKey();
const postcardSentToday = pid => S.postcardsSent?.[pid] === todayKey();
const heartBtn = e => `<button class="heart-btn${sentToday(e.id) ? ' sent' : ''}" data-pid="${e.id}" data-name="${esc(e.name)}" aria-label="${tx('sendHeartLbl')}">${sentToday(e.id) ? '💛✓' : '💛'}</button>`;
const recent = t => Date.now() - Math.abs(t) <= RULES.hearts.showDays * 864e5;
const paidPostcards = () => SHOP_CATALOG.postcard.filter(card => card.price > 0);

// ---------- sending ----------
async function sendHeart(pid, name, btn, context = null) {
  if (!S.name) return askName(() => sendHeart(pid, name, btn, context));
  const canSendFree = !sentToday(pid);
  const cards = !postcardSentToday(pid) ? paidPostcards() : [];
  if (!canSendFree && !cards.length) { toast(tx('heartAlready', name)); return; }
  // pick a short message to go with it (or none): just tapping, no typing needed
  const quick = tx('quickMsgs', S.level);
  const free = canSendFree ? `<p class="note small">${tx('heartMsgQ')}</p>
    <div class="msg-pick">${quick.map((m, i) => `<button class="mp" data-i="${i}">${esc(m)}</button>`).join('')}</div>
    <label class="custom-message">${tx('heartCustom')}<textarea id="hmMessage" rows="2" maxlength="${Math.min(MSG.max, (MSG.piece - 1) * 3)}" placeholder="${tx('heartPlaceholder')}"></textarea></label>
    <div class="heart-error" id="hmError" role="status" hidden></div>
    <button class="big-btn play" id="hmNone"><span class="bb-text"><b>${tx(cards.length ? 'heartFreeBtn' : 'heartOnly')}</b></span></button>` : '';
  const postcards = cards.length ? `<section class="postcard-section"><h3>${tx('heartCardHead')}</h3><div class="postcard-strip">
    ${cards.map(card => `<button class="th" data-postcard="${card.id}" aria-label="${esc(shopName(card))} · ${card.price} 🪙"><span class="postcard-art" aria-hidden="true">${card.icon}</span><span class="price">${card.price} 🪙</span></button>`).join('')}
    </div></section>` : '';
  openModal(`<div class="heart-big sm">💛</div><h2>${tx('heartFor', esc(name))}</h2>${free}${postcards}
    <button class="link-btn" id="hmBack">${tx('heartBack')}</button>`, true, context ? context.restore : null, 'heart-compose');
  if (context) $('#modalBox').style.setProperty('--heart-dialog-height', context.height + 'px');
  const input = $('#hmMessage'), action = $('#hmNone b');
  let busy = false;
  $('#hmBack').onclick = closeModal;
  $('#modalBox').querySelectorAll('[data-postcard]').forEach(b => b.onclick = () => {
    if (!busy) confirmPostcard(pid, name, b.dataset.postcard, input?.value.trim() || '', keepModal(), context?.restore);
  });
  if (!canSendFree) return;
  const label = () => { action.textContent = tx(input.value.trim() ? 'heartSendMessage' : cards.length ? 'heartFreeBtn' : 'heartOnly'); };
  input.oninput = label;
  const send = async msg => {
    if (busy) return; busy = true; modalClosable = false;
    const controls = [...$('#modalBox').querySelectorAll('button, textarea')];
    controls.forEach(b => b.disabled = true); action.textContent = tx('heartSending'); $('#hmError').hidden = true;
    const ok = await doSendHeart(pid, name, btn, msg, false);
    if (ok) {
      if (context) showHeartSent(name, context, !!msg);
      else { closeModal(); showHeartSent(name); }
    }
    else {
      busy = false; modalClosable = true; controls.forEach(b => b.disabled = false); label();
      $('#hmError').textContent = tx('heartFail'); $('#hmError').hidden = false;
    }
  };
  document.querySelectorAll('.msg-pick .mp').forEach(b => b.onclick = () => send(quick[+b.dataset.i]));
  $('#hmNone').onclick = () => send(input.value.trim());
}

function postcardPaper(card, message = '') {
  return `<div class="postcard-paper"><span class="postcard-art" aria-hidden="true">${card.icon}</span>
    <strong>${esc(shopName(card))}</strong><small>${esc(shopSub(card))}</small>
    <span class="postcard-stamp" aria-hidden="true">💛</span>${message ? `<q>${esc(message)}</q>` : ''}</div>`;
}

function confirmPostcard(pid, name, id, message, back, done) {
  const card = findCatalogItem('postcard', id);
  if (!card?.price) return;
  if (postcardSentToday(pid)) { toast(tx('heartCardAlready')); return; }
  const canPay = S.coins >= card.price;
  openModal(`<h2>${tx('heartCardTitle', esc(name))}</h2>${postcardPaper(card, message)}
    <p class="note">${canPay ? tx('shopLeft', S.coins - card.price) : tx('shopNeed', card.price - S.coins)}</p>
    <div class="heart-error" id="pcError" role="status" hidden></div>
    <div class="btn-row"><button class="big-btn ${canPay ? 'daily' : 'off'}" id="pcSend"${canPay ? '' : ' disabled'}><span class="bb-text"><b>${tx('heartCardSend', card.price)}</b></span></button>
    <button class="btn2" id="pcBack">${tx('backPlain')}</button></div>`, true, back, 'postcard-confirm');
  const send = $('#pcSend'), cancel = $('#pcBack'), error = $('#pcError'), label = send.querySelector('b');
  cancel.onclick = closeModal;
  send.onclick = async () => {
    if (send.disabled) return;
    send.disabled = cancel.disabled = true;
    modalClosable = false;
    error.hidden = true;
    label.textContent = tx('heartSending');
    const result = await ShopEconomy.sendPostcard(S, id, pid, msgParts(message), { ...giftHooks(), renderCoins: renderHomeCoins });
    if (result.ok) {
      Sound.trophy(); buzz(30); heartRain();
      if (curScreen === 'shop') refreshShop();
      openModal(`<h2>${tx('heartCardSent')}</h2>${postcardPaper(card, message)}
        <button class="big-btn play" id="pcDone"><span class="bb-text"><b>${tx('nice')}</b></span></button>`, true, done);
      $('#pcDone').onclick = closeModal;
      return;
    }
    modalClosable = true;
    send.disabled = result.reason === 'postcard_already_sent' || result.reason === 'not_enough_coins';
    cancel.disabled = false;
    label.textContent = tx('heartCardSend', card.price);
    error.textContent = result.reason === 'postcard_already_sent' ? tx('heartCardAlready')
      : result.reason === 'gift_unconfirmed' ? tx('heartCardPending')
      : result.reason === 'gift_pending' ? tx('shopGiftFail', result.reason)
      : result.reason === 'not_enough_coins' ? tx('shopNeed', result.need)
      : tx('heartFail');
    error.hidden = false;
  };
}
async function doSendHeart(pid, name, btn, msg, notify = true) {
  ensureId();
  try {
    const t = Date.now(), me = S.name.slice(0, 24);
    // Store the message first: never report success if the custom message could not be saved.
    if (msg) {
      const m = await dbSend(`plays/${msgKey(pid)}`, { k: 'msg', t, from: S.pid, name: me, ...msgParts(msg) }, 'POST');
      if (!m.ok) throw 0;
    }
    const r = await dbSend(`hearts/${pid}/${S.pid}`, { name: me, t });
    if (!r.ok) throw 0;
    S.heartsSent[pid] = todayKey(); bumpStat('heartsSent');
    S.heartsOut[pid] = { t, seen: 0, name }; save();
    logEvt('heart_out', { to: name, msg: msg ? 1 : undefined });
    Sound.unlock(); buzz(20);
    if (btn) { btn.classList.add('sent'); btn.textContent = '💛✓'; }
    if (notify) showHeartSent(name);
    return true;
  } catch (e) { if (notify) toast(tx('heartFail')); return false; }
}
// a big, clear "it is on its way" moment for the sender
function showHeartSent(name, context = null, withMessage = false) {
  Sound.trophy(); buzz([20, 40, 20, 40, 60]); heartRain();
  openModal(`<div class="heart-big">💛</div><h2>${tx(context && withMessage ? 'heartMessageSent' : 'heartSent')}</h2>
    <p>${tx(context && withMessage ? 'heartMessageSentText' : 'heartSentText', esc(name))}</p>
    ${context ? '' : `<p class="note small">${tx('heartSentNote')}</p>`}
    <button class="big-btn play" id="hsOk"><span class="bb-text"><b>${tx('nice')}</b></span></button>`, !!context, context ? context.restore : null, context ? 'heart-confirm' : '');
  setTimeout(heartRain, 700);
  $('#hsOk').onclick = () => { closeModal(); if (curScreen === 'ranking') renderRanking(); };
}
// short "seen" tag for the ranking row's line under the name (the heart button itself shows 'sent')
function heartSeenShort(pid) {
  const o = S.heartsOut[pid];
  return o && recent(o.t) && o.seen ? `<span class="hs seen">${tx('heartSeenShort')}</span>` : '';
}
// small status next to a family member: did they see my heart?
function heartState(pid) {
  const o = S.heartsOut[pid];
  if (!o || !recent(o.t)) return '';
  return o.seen ? `<small class="hs seen">${tx('heartSeenTag')}</small>` : `<small class="hs">${tx('heartOnWay')}</small>`;
}
// did the people I sent a heart to see it?
let sentCheckAt = 0;
async function checkSentHearts() {
  let changed = false;
  for (const [pid, o] of Object.entries(S.heartsOut)) {
    if (o.seen || !recent(o.t)) continue;
    try {
      const v = await dbGet(`hearts/${pid}/${S.pid}`);
      if (v && v.t < 0) { o.seen = Date.now(); changed = true; toast(tx('heartSeenToast', o.name), 3200); }
    } catch (e) { }
  }
  if (changed) save();
  return changed;
}

// ---------- receiving ----------
// tell the sender we saw it: the heart is stored again with a negative time
function markHeartsSeen(list) {
  ensureId();
  list.filter(h => !h.postcardReceipt).forEach(h =>
    dbSend(`hearts/${S.pid}/${h.from}`, { name: h.name.slice(0, 24), t: -Math.abs(h.t) }).catch(() => { }));
}
// new hearts since last time (one request at a time, so a heart is never shown twice)
let heartsBusy = false;
async function fetchHearts({ queue = false } = {}) {
  if (!DB_URL || !S.pid || heartsBusy) return [];
  heartsBusy = true;
  try {
    const [data, inbox] = await Promise.all([
      dbGet(`hearts/${S.pid}`).catch(() => null),
      dbGet(`plays/${msgKey(S.pid)}`).catch(() => null),
    ]);
    const visibleSender = from => S.pid.startsWith('test-') || !from.startsWith('test-');
    const fresh = Object.entries(data || {}).filter(([from, v]) => v && v.t > (S.heartsSeen[from] || 0) && visibleSender(from))
      .map(([from, v]) => ({ from, name: String(v.name || tx('someone')).slice(0, 24), t: v.t }));
    const entries = Object.entries(inbox || {});
    const cards = entries.filter(([key, m]) => isStandalonePostcard(key, m));
    fresh.forEach(h => { S.heartsSeen[h.from] = h.t; });
    attachMsgs(fresh, entries.filter(([key, m]) => !isStandalonePostcard(key, m)).map(([, m]) => m));
    for (const [key, m] of cards) {
      if (!visibleSender(m.from) || S.postcardsSeen?.[key]) continue;
      S.postcardsSeen ??= {};
      S.postcardsSeen[key] = m.t;
      fresh.push({ from: m.from, name: String(m.name || tx('someone')).slice(0, 24), t: m.t, pc: m.pc,
        msg: msgText(m).slice(0, MSG.max), postcardReceipt: true });
    }
    if (fresh.length) {
      if (queue) S.pendingHearts = S.pendingHearts.concat(fresh);
      bumpStat('hearts', fresh.length); save();
    }
    return fresh;
  } catch (e) { return []; } finally { heartsBusy = false; }
}
const isStandalonePostcard = (key, m) => m?.k === 'msg' && typeof m.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(m.day) &&
  key === `pc-${m.from}-${m.day}` && Number.isFinite(m.t) && m.t > 0 && Boolean(findCatalogItem('postcard', m.pc)?.price);
// Legacy messages used a time window; an exact timestamp takes precedence, and card metadata requires an exact match.
function attachMsgs(list, messages) {
  for (const h of list) {
    const fromSender = messages.filter(m => m?.from === h.from);
    const m = fromSender.findLast(m => m.t === h.t) || fromSender.findLast(m => !m.pc && Math.abs(m.t - h.t) < 120000);
    if (!m) continue;
    if (msgText(m)) h.msg = msgText(m).slice(0, MSG.max);
    if (findCatalogItem('postcard', m.pc)?.price) h.pc = m.pc;
  }
}
const heartNames = list => [...new Set(list.map(h => h.name))];
const heartCard = h => h && findCatalogItem('postcard', h.pc);
const msgHTML = list => list.map(h => heartCard(h) ? postcardPaper(heartCard(h), h.msg)
  : h.msg ? `<p class="heart-msg">“${esc(h.msg)}”<small>${esc(h.name)}</small></p>` : '').join('');
const logHeartIn = (list, where) => logEvt('heart_in', { from: heartNames(list).join(', '), where, msg: list.some(h => h.msg) ? 1 : undefined });
// at home: a big pop-up
function showHearts(list, then) {
  Sound.trophy(); buzz([20, 40, 20, 40, 40]);
  heartRain();
  const names = heartNames(list).map(esc);
  const oneCard = list.length === 1 && Boolean(heartCard(list[0]));
  const who = oneCard ? tx('heartCardFrom', names[0]) : names.length === 1 ? tx('heartFrom1', names[0])
    : tx('heartFromMany', names.slice(0, -1).join(', '), names.slice(-1));
  const senders = [...new Map(list.map(h => [h.from, h])).values()];
  const recipients = senders.filter(h => h.from && h.from !== S.pid && !sentToday(h.from));
  const replies = recipients.map(h => {
    const label = senders.length === 1 ? tx('heartReply') : '💛 ' + tx('heartFor', esc(h.name));
    return `<button class="big-btn play" data-heart-reply><span class="bb-text"><b>${label}</b></span></button>`;
  }).join('');
  const dismiss = replies ? `<button class="link-btn" id="hOk">${tx('close')}</button>`
    : `<button class="big-btn play" id="hOk"><span class="bb-text"><b>${tx('howSweet')}</b></span></button>`;
  openModal(`${oneCard ? '' : '<div class="heart-big">💛</div>'}<h2 class="heart-h">${tx(oneCard ? 'heartCardReceived' : 'heartForYou')}</h2><p class="heart-who">${who}</p>${msgHTML(list)}
    ${replies}${dismiss}`, false);
  setTimeout(heartRain, 900); setTimeout(heartRain, 1900);
  markHeartsSeen(list); logHeartIn(list, 'popup');
  $('#hOk').onclick = () => { closeModal(); if (then) then(); };
  const buttons = [...document.querySelectorAll('#modalBox [data-heart-reply]')];
  const controls = [...buttons, $('#hOk')];
  let busy = false;
  buttons.forEach((button, i) => {
    const { from, name } = recipients[i];
    const reply = async () => {
      if (busy || sentToday(from)) return;
      busy = true;
      if (!S.name) {
        const restore = keepModal();
        askName(() => { restore(); busy = false; reply(); });
        return;
      }
      const label = button.querySelector('b'), text = label.textContent;
      controls.forEach(control => { control.disabled = true; });
      label.textContent = tx('heartSending');
      const ok = await doSendHeart(from, name, null, '', false);
      busy = false;
      controls.forEach(control => { control.disabled = false; });
      label.textContent = text;
      if (!ok) { toast(tx('heartFail')); return; }
      button.remove();
      // Finish the original flow once the acknowledgment closes, or let the player reply to the other senders.
      showHeartSent(name, { restore: buttons.some(b => b.isConnected) ? keepModal() : then });
    };
    button.onclick = reply;
  });
}
// during a level: a short heart moment that closes by itself
function heartPop(list) {
  const names = heartNames(list).map(esc);
  const oneCard = list.length === 1 && Boolean(heartCard(list[0]));
  let el = $('#heartPop');
  if (!el) { el = document.createElement('div'); el.id = 'heartPop'; document.body.appendChild(el); }
  el.innerHTML = `<div class="hp-card">${oneCard ? '' : '<div class="hp-heart">💛</div>'}<b>${names.join(' ' + tx('and') + ' ')}</b>
    <span>${oneCard ? tx('heartCardSendsYou') : tx('sendsYou', names.length)}</span>${msgHTML(list)}<small>${tx('tapToPlay')}</small></div>`;
  el.className = 'on';
  Sound.trophy(); buzz([20, 40, 20, 40, 60]); heartRain(); setTimeout(heartRain, 900);
  markHeartsSeen(list); logHeartIn(list, 'level');
  const close = () => { el.className = ''; clearTimeout(el._t); };
  el.onclick = close; clearTimeout(el._t);
  el._t = setTimeout(close, list.some(h => h.msg || h.pc) ? RULES.hearts.popupWithMsgMs : RULES.hearts.popupMs);
}
// hearts fountain up from the bottom of the screen, so the words stay readable
function heartRain() { [0.08, 0.3, 0.7, 0.92].forEach((f, i) => setTimeout(() => FX.emoji(innerWidth * f, innerHeight - 20, ['💛', '💖', '💛', '✨'], 12), i * 120)); }
async function checkHearts() {
  const fresh = await fetchHearts();
  if (fresh.length) deliverHearts(fresh);
}
// show new hearts right away: a big pop-up at home, a short heart moment during a level, later otherwise
function deliverHearts(fresh) {
  const free = modalFree();
  if (free && curScreen === 'home') showHearts(fresh, () => renderHome());
  else if (free) heartPop(fresh);
  else { S.pendingHearts = S.pendingHearts.concat(fresh); save(); }
}
// live: the database tells us the moment someone sends a heart
let heartStreams = [];
function startHeartStream() {
  if (heartStreams.length || !DB_URL || !S.pid || typeof EventSource === 'undefined') return;
  let t = 0;
  const ping = () => { clearTimeout(t); t = setTimeout(checkHearts, 400); };
  for (const path of [`hearts/${S.pid}`, `plays/${msgKey(S.pid)}`]) {
    try {
      const stream = new EventSource(dbUrl(path));
      stream.addEventListener('put', ping);
      stream.addEventListener('patch', ping);
      heartStreams.push(stream);
    } catch (e) { }
  }
}
