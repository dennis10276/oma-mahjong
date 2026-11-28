// uses: core/*, rules, lang, family/*
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
  S.passedNews = { t: Date.now(), rank: me + 1, mine: S.level, by: by.map(e => ({ id: e.id, name: e.name, avatar: e.avatar, frame: e.frame, title: e.title, level: e.level, online: e.online, t: e.t })) };
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
  Sound.pass();
  const latest = new Map(onlineEntries('all').map(e => [e.id, e]));
  const single = n.by.length === 1;
  const rows = n.by.map(e => {
    const player = latest.get(e.id) || e, presence = presenceOf(player), title = titleOf(player);
    return `<div class="fam-row passed-row">${avatarHTML(e, 'ra', presence?.online)}<span class="fr-name">${esc(e.name)}
      <small class="fr-sub">${esc(title)}${presenceSubHTML(presence, !!title)}<br>${tx('levelWord', player.level)}</small></span>
      ${single ? '' : heartBtn(e)}</div>`;
  }).join('');
  openModal(`<div class="nt-ico">🏃</div><h2>${single ? tx('passedByOne', esc(n.by[0].name)) : tx('passedTitleMany')}</h2>
    <div class="fam-box">${rows}</div>
    <p class="note">${tx('passedPlace', n.rank)}</p>
    <div class="btn-row"><button class="big-btn play" id="psOk"><span class="bb-text"><b>${fx('passedPlay', S.level)}</b></span></button>
    ${single ? `<button class="big-btn gold" id="psCheer"><span class="bb-text"><b>${fx('passedCheer')}</b></span></button>` : ''}</div>
    <button class="link-btn" id="psMenu">${tx('menu')}</button>`, true, null, 'passed-dialog');
  const cheer = async (e, button) => {
    if (button.disabled || sentToday(e.id)) { toast(tx('heartAlreadyShort')); return; }
    button.disabled = true;
    if (!(await doSendHeart(e.id, e.name, button, '', false))) {
      button.disabled = false;
      toast(tx('heartFail'));
    }
  };
  if (single) $('#psCheer').onclick = ev => cheer(n.by[0], ev.currentTarget);
  $('#modalBox').querySelectorAll('.heart-btn').forEach(btn => btn.onclick = () => cheer(n.by.find(e => e.id === btn.dataset.pid), btn));
  $('#psOk').onclick = () => { closeModal(); startLevel(S.level); };
  $('#psMenu').onclick = closeModal;
}
