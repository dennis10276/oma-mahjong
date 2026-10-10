/* Oma's Mahjong — news from Apeldoorn after a won level, for grandma (and DennisTEST, see GRANDMA
   in rules.js). Mostly real local news (tools/news.py collects it every two hours), and now and
   then a part of a made-up story about the computer players in the ranking (js/stories.js), which
   ends with a little cliffhanger: the next level tells how it goes on. VILLAGE in rules.js has the
   numbers (1 in 5 a story, how old news may be, ...).
   Everything read so far stays in "Het krantje" (📰 on the home screen); in the ranking, 💬 next
   to a computer player shows its story so far. */
'use strict';

const villageOn = () => typeof isGrandma === 'function' && isGrandma(S.pid, S.name);
const NEWS_KEY = 'omamj.news';
// what she has read: n/s = news items / story parts shown, sp = parts shown per story, act = the
// stories running now, seen = news ids, log = Het krantje, ask = memory questions (1 right, 0 wrong)
const vg = () => (S.vg = S.vg || { n: 0, s: 0, sp: {}, act: [], seen: [], log: [], ask: {}, rr: 0 });

// ---------- the real news (news.json on the `news` branch, kept on the phone) ----------
function newsData() { try { return JSON.parse(localStorage.getItem(NEWS_KEY) || 'null'); } catch (e) { return null; } }
let newsBusy = false;
async function loadNews(force = false) {
  if (!villageOn() || newsBusy) return;
  const d = newsData();
  if (!force && d && Date.now() - (d.at || 0) < VILLAGE.refreshMin * 60000) return;
  newsBusy = true;
  try {
    const r = await fetch(VILLAGE.newsUrl + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    if (j && Array.isArray(j.items)) { localStorage.setItem(NEWS_KEY, JSON.stringify({ at: Date.now(), updated: j.updated || 0, items: j.items })); if (curScreen === 'home') renderPaperChip(); }
  } catch (e) { } finally { newsBusy = false; }
}
function freshNews() {
  const d = newsData(), v = vg(), from = Date.now() - VILLAGE.newsDays * 864e5;
  return ((d && d.items) || []).filter(it => it && it.id && it.title && it.t > from && !v.seen.includes(it.id)).sort((a, b) => b.t - a.t);
}
// no news file for a while (no internet, or the collecting stopped): then stories may fill in
const newsStale = () => { const d = newsData(); return !d || Date.now() - (d.updated || 0) > VILLAGE.staleDays * 864e5; };

// ---------- the stories ----------
function storyPlan() {
  const v = vg();
  const left = id => { const st = STORIES.find(s => s.id === id); return st && (v.sp[id] || 0) < st.parts.length; };
  const act = v.act.filter(left);
  for (const st of STORIES) { if (act.length >= VILLAGE.active) break; if (!act.includes(st.id) && !(v.sp[st.id] > 0)) act.push(st.id); }
  if (!act.length) return null;
  const st = STORIES.find(s => s.id === act[v.rr % act.length]);
  return { act, st, p: v.sp[st.id] || 0 };
}

// what comes after the next won level (nothing changes yet): about 4 news items, then a story part
function villageNext() {
  if (!villageOn()) return null;
  const v = vg(), news = freshNews(), plan = storyPlan();
  const storyTurn = (v.s + 1) / (v.n + v.s + 1) <= VILLAGE.storyShare;
  if (plan && storyTurn) return { k: 's', ...plan };
  if (news.length) return { k: 'n', item: news[0] };
  if (plan && newsStale()) return { k: 's', ...plan };
  return null;
}
// at the start of a level: a hint of what winning it brings
function villageTease() {
  const x = villageNext();
  if (!x || !G || G.done) return;
  const text = x.k === 'n' ? tx('vgTeaseNews') : x.p ? `${x.st.ico} ${x.st.parts[x.p - 1][1]}` : tx('vgTeaseNew', x.st.ico, x.st.title);
  gameMsg(text, 4500);
  preloadNext();
}

// ---------- after a won level ----------
function showVillage(then) {
  const x = villageNext();
  if (!x) return then();
  if (x.k === 'n') return showNewsItem(x.item, then);
  const ask = x.st.ask;
  if (ask && x.p === ask.at && vg().ask[x.st.id] === undefined) return askMemory(x.st, () => showStoryPart(x, then));
  showStoryPart(x, then);
}
const whoAvatar = name => (BOTS.find(b => b[0] === name) || [name, '🙂'])[1];
const vgCard = (head, body, btn) => `<div class="vg-head">${head}</div>${body}<button class="big-btn play" id="vgOk"><span class="bb-text"><b>${btn}</b></span></button>`;
function newsAgo(t) {
  const d = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5);
  return d <= 0 ? tx('today') : d === 1 ? tx('yesterday') : tx('daysAgo', d);
}
// the news photo, shown from the news site itself (if it does not load: the smaller one, or none)
function vgImgErr(img) { if (img.dataset.alt) { img.src = img.dataset.alt; img.dataset.alt = ''; } else img.parentNode.remove(); }
const photoHTML = it => it.img && /^https:\/\//.test(it.img) ? `<div class="vg-photo"><img src="${esc(it.img)}"${it.thumb ? ` data-alt="${esc(it.thumb)}"` : ''} alt="" referrerpolicy="no-referrer" onerror="vgImgErr(this)"></div>` : '';
const newsHTML = it => `${photoHTML(it)}<h2 class="vg-title">${esc(it.title)}</h2>${it.text ? `<p class="vg-text">${esc(it.text)}</p>` : ''}<p class="vg-src">${tx('vgSource', esc(it.src || ''), newsAgo(it.t))}</p>`;
// fetch the next news photo in the background while she plays, so it is there right away
function preloadNext() { const x = villageNext(); if (x && x.k === 'n' && x.item.img) { const i = new Image(); i.referrerPolicy = 'no-referrer'; i.src = x.item.img; } }
function showNewsItem(it, then) {
  const v = vg();
  v.seen = v.seen.concat(it.id).slice(-400); v.n++;
  v.log = v.log.concat({ k: 'n', t: Date.now(), it: { id: it.id, title: it.title, text: it.text, src: it.src, t: it.t, img: it.img, thumb: it.thumb } }).slice(-60);
  save(); logEvt('vnews', { src: it.src, title: it.title });
  Sound.hint(); buzz(15);
  openModal(vgCard(tx('vgNewsHead'), newsHTML(it), tx('vgOn')), false, null, 'vg');
  $('#vgOk').onclick = () => { closeModal(); then(); };
}
const partHTML = (st, p) => `<h2 class="vg-title">${st.ico} ${esc(st.title)} <small>${tx('vgPart', p + 1, st.parts.length)}</small></h2>
  <p class="vg-text">${esc(st.parts[p][0])}</p>${st.parts[p][1] ? `<p class="vg-cliff">${tx('vgMore')} ${esc(st.parts[p][1])}</p>` : `<p class="vg-end">${tx('vgEnd')}</p>`}`;
function showStoryPart(x, then) {
  const v = vg(), { st, p } = x;
  v.act = x.act; v.sp[st.id] = p + 1; v.s++; v.rr++;
  v.log = v.log.concat({ k: 's', t: Date.now(), id: st.id, p }).slice(-60);
  save(); logEvt('vstory', { id: st.id, p: p + 1 });
  Sound.hint(); buzz(15);
  openModal(vgCard(`<span class="vg-who">${whoAvatar(st.who)}</span>${tx('vgStoryHead', esc(st.who))}`, partHTML(st, p), st.parts[p][1] ? tx('vgOn') : tx('vgNice')), false, null, 'vg');
  $('#vgOk').onclick = () => { closeModal(); then(); };
}
// a memory question about an earlier part: right is a bonus star, wrong just shows the answer
function askMemory(st, then) {
  const a = st.ask, order = a.a.map((t, i) => i).sort(() => Math.random() - 0.5);
  openModal(`<div class="vg-head">${tx('vgAskHead')}</div><h2 class="vg-title">${st.ico} ${esc(a.q)}</h2>
    <div class="vg-answers">${order.map(i => `<button class="big-btn vg-a" data-i="${i}"><span class="bb-text"><b>${esc(a.a[i])}</b></span></button>`).join('')}</div>`, false, null, 'vg');
  document.querySelectorAll('.vg-a').forEach(b => b.onclick = () => {
    const ok = +b.dataset.i === a.ok, v = vg();
    v.ask[st.id] = ok ? 1 : 0; save();
    logEvt('vask', { id: st.id, ok: ok ? 1 : 0 });
    document.querySelectorAll('.vg-a').forEach(o => { o.disabled = true; o.classList.toggle('right', +o.dataset.i === a.ok); o.classList.toggle('wrong', o === b && !ok); });
    if (ok) { giveBonus(VILLAGE.askStar); Sound.trophy(); FX.confetti(); buzz([20, 40, 60]); toast(tx('vgAskRight'), 2200); }
    else { Sound.blocked(); toast(tx('vgAskWrong', a.a[a.ok]), 2600); }
    setTimeout(() => { closeModal(); then(); }, ok ? 1600 : 2400);
  });
}

// ---------- Het krantje: everything read so far, newest first ----------
function openPaper() {
  const v = vg();
  const items = v.log.slice().reverse().map(e => {
    if (e.k === 'n') return `<div class="vg-item">${newsHTML(e.it)}</div>`;
    const st = STORIES.find(s => s.id === e.id);
    return st && st.parts[e.p] ? `<div class="vg-item">${partHTML(st, e.p)}</div>` : '';
  }).join('');
  openModal(`<h2>${tx('vgPaper')}</h2>${items || `<p>${tx('vgPaperEmpty')}</p>`}
    <button class="big-btn play" id="vgClose"><span class="bb-text"><b>${tx('close')}</b></span></button>`, true, null, 'vg paper');
  $('#vgClose').onclick = closeModal;
}
// the story so far of one computer player (💬 in the ranking)
function storyOf(name) { const v = vg(); return STORIES.filter(st => st.who === name && v.sp[st.id] > 0); }
function openWho(name) {
  const v = vg();
  const html = storyOf(name).map(st => Array.from({ length: v.sp[st.id] }, (_, p) => `<div class="vg-item">${partHTML(st, p)}</div>`).join('')).join('');
  openModal(`<div class="vg-head"><span class="vg-who">${whoAvatar(name)}</span>${esc(name)}</div>${html}
    <button class="big-btn play" id="vgClose"><span class="bb-text"><b>${tx('close')}</b></span></button>`, true, null, 'vg paper');
  $('#vgClose').onclick = closeModal;
}
const chatBtn = e => villageOn() && e.bot && storyOf(e.name).length ? `<button class="vg-chat" data-who="${esc(e.name)}" aria-label="${tx('vgChatLbl')}">💬</button>` : '';
function renderPaperChip() {
  const b = $('#btnPaper'); if (!b) return;
  b.classList.toggle('hidden', !villageOn());
  b.classList.toggle('new', villageOn() && !!villageNext());
}
