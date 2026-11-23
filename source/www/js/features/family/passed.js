/* Oma's Mahjong — family/passed: "someone in the family passed you". */
'use strict';

/* Passed by family: who was below you in the all-time ranking (highest level, then points) the
   last time you had the app open, and is above you now. You hear it the next time you open the
   app (or come back to it after a while), with where they are now. S.famBelow: the players below
   you then; your own wins only add to it (so being passed during a session is still told later). */
const famOrder = () => ranking(undefined, 'all').filter(e => !e.bot);
function famBelowIds() { const l = famOrder(), me = l.findIndex(e => e.me); return me < 0 ? [] : l.slice(me + 1).map(e => e.id); }
function notePassedBaseline(reset) { const now = famBelowIds(); S.famBelow = reset || !Array.isArray(S.famBelow) ? now : [...new Set([...S.famBelow, ...now])]; save(); }
function checkPassed() {
  if (!S.name) return;
  const l = famOrder(), me = l.findIndex(e => e.me);
  if (me < 0) return;
  if (!Array.isArray(S.famBelow)) { notePassedBaseline(true); return; }
  const by = l.slice(0, me).filter(e => S.famBelow.includes(e.id));
  notePassedBaseline(true);
  if (!by.length) return;
  S.passedNews = { t: Date.now(), rank: me + 1, mine: S.level, by: by.map(e => ({ id: e.id, name: e.name, avatar: e.avatar, frame: e.frame, level: e.level, online: e.online, t: e.t })) };
  save();
  logEvt('passed', { by: by.map(e => e.name).join(', ').slice(0, 40), lv: S.level, rk: me + 1 });
  showPassed();
}
// the news waits for the home screen with no other pop-up open (hearts first)
function showPassed() {
  const n = S.passedNews;
  if (!n) return;
  if (curScreen !== 'home' || !modalFree()) { clearTimeout(showPassed.t); showPassed.t = setTimeout(showPassed, 1500); return; }
  S.passedNews = null; save();
  Sound.blocked(); buzz([30, 60, 30]);
  const latest = new Map(onlineEntries('all').map(e => [e.id, e]));
  const rows = n.by.map(e => {
    const presence = presenceOf(latest.get(e.id) || e);
    return `<div class="fam-row passed-row">${avatarHTML(e, 'ra', presence?.online)}<span class="fr-name">${esc(e.name)}<small class="fr-sub">${tx('passedNow', e.level)}${presenceSubHTML(presence)}</small></span><span class="fr-val">${tx('levelWord', e.level)}</span></div>`;
  }).join('');
  openModal(`<div class="nt-ico">🏃</div><h2>${tx(n.by.length > 1 ? 'passedTitleMany' : 'passedTitle')}</h2>
    <p>${tx('passedText', n.by.length > 1 ? n.by.map(e => esc(e.name)).join(' & ') : esc(n.by[0].name), n.by.length)}</p>
    <div class="fam-box">${rows}</div>
    <p class="note">${tx('passedYou', n.mine, n.rank)}</p>
    <button class="big-btn play" id="psOk"><span class="bb-text"><b>${tx('passedGo')}</b></span></button>`, false);
  $('#psOk').onclick = () => { closeModal(); renderHome(); };
}
