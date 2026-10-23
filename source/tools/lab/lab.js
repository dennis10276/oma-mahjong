/* Level lab: Dennis plays level ideas (LAB_IDEAS, tools/lab/ideas.js) in the real game and rates how
   clever each combination of specials is. Only in the lab build (tools/lab/build_lab.js), never in the
   game. Ratings go to the artifact's database (collection "ratings", one document per idea) when the
   page runs as a claude.ai artifact, otherwise they stay on this device. */
'use strict';
(function () {
  const LAB = typeof LAB_IDEAS !== 'undefined' ? LAB_IDEAS : { ideas: [] }, IDEAS = LAB.ideas;
  const KEY = 'omamj.lab.ratings';
  let db = null;
  const local = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const R = local();   // id -> { stars, note, tries, wins, results: [] }
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(R)); } catch (e) { } };
  const rec = id => (R[id] = R[id] || { stars: 0, note: '', starts: 0, tries: 0, wins: 0, results: [] });
  async function push(id) {
    keep();
    if (!db) return;
    const it = IDEAS.find(x => x.id === id), r = rec(id);
    try { await db.doc('ratings/idea-' + id).set({ id, kind: it.kind, level: it.level || null, title: it.title, shape: it.shape, made: LAB.made, m: it.m || null, stars: r.stars, note: r.note, starts: r.starts || 0, tries: r.tries, wins: r.wins, results: r.results.slice(-30), t: Date.now() }); setSync(true); }
    catch (e) { setSync(false); }
  }
  // the database, when this runs as an artifact (null elsewhere: ratings stay here)
  (async () => {
    try {
      if (!window.claude || !claude.use) return;
      db = await claude.use('db');
      if (!db) return;
      const snap = await db.collection('ratings').get();
      for (const d of snap.docs) { const x = d.data(); if (x && x.id) Object.assign(rec(x.id), { stars: x.stars || 0, note: x.note || '', starts: x.starts || 0, tries: x.tries || 0, wins: x.wins || 0, results: x.results || [] }); }
      keep(); render(); setSync(true);
    } catch (e) { db = null; }
  })();

  // ---------- the panel ----------
  const css = document.createElement('style');
  css.textContent = `
  #labBtn{position:fixed;left:62px;top:calc(env(safe-area-inset-top,0px) + 12px);z-index:2000;border:0;border-radius:999px;padding:7px 11px;font:800 14px Nunito,sans-serif;background:#fff3c4;color:#3b2a14;box-shadow:0 3px 10px rgba(0,0,0,.35)}
  #labPanel{position:fixed;inset:0;z-index:1999;background:#0b3d30;color:#fff;overflow:auto;padding:calc(env(safe-area-inset-top,0px) + 20px) 16px 140px;font-family:Nunito,sans-serif}
  #labPanel.hidden{display:none}
  #labPanel h1{font-size:22px;margin:0 0 4px}
  #labPanel .sub{opacity:.8;font-size:14px;margin:0 0 14px;line-height:1.35}
  .lab-card{background:#fff;color:#2b2116;border-radius:16px;padding:14px;margin:0 0 12px;box-shadow:0 4px 14px rgba(0,0,0,.25)}
  .lab-card h2{font-size:18px;margin:0 0 4px}
  .lab-card p{margin:0 0 8px;font-size:15px;line-height:1.35}
  .lab-meta{font-size:13px;color:#6b5a45;margin-bottom:8px}
  .lab-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .lab-play{border:0;border-radius:12px;padding:10px 16px;font:800 16px Nunito,sans-serif;background:#1f8a5b;color:#fff}
  .lab-stars button{border:0;background:none;font-size:26px;padding:0 2px;line-height:1;filter:grayscale(1);opacity:.45}
  .lab-stars button.on{filter:none;opacity:1}
  .lab-note{width:100%;box-sizing:border-box;margin-top:8px;border:1px solid #d8cbb5;border-radius:10px;padding:8px;font:600 15px Nunito,sans-serif;min-height:44px}
  .lab-saved{font-size:13px;color:#1f8a5b;margin-left:auto}
  #labSync{font-size:12px;opacity:.75}`;
  document.head.appendChild(css);
  const btn = document.createElement('button'); btn.id = 'labBtn'; btn.textContent = '🧪'; btn.title = 'Level lab'; btn.setAttribute('aria-label', 'Level lab');
  const panel = document.createElement('div'); panel.id = 'labPanel';
  document.body.appendChild(panel); document.body.appendChild(btn);
  btn.onclick = () => { panel.classList.toggle('hidden'); if (!panel.classList.contains('hidden')) render(); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = x => Math.round(x * 100) + '%';
  function setSync(ok) { const s = document.getElementById('labSync'); if (s) s.textContent = !db ? 'Ratings are kept on this device.' : ok ? 'Ratings are saved with this page, so Claude can read them.' : 'Could not save to the page just now; kept on this device.'; }
  function render() {
    const T = LAB.target || {};
    panel.innerHTML = `<h1>Level lab</h1>
      <p class="sub">New piles without towers, normal tile size. Each idea combines the specials in its own way. Play it as often as you like, then rate how clever the combination is. These ideas are not in the game, and playing here changes nothing in the game or on the dashboard.<br><span id="labSync">${db ? '' : 'Ratings are kept on this device.'}</span></p>
      ${IDEAS.map(it => { const r = rec(it.id), m = it.m || {}, d = m.Dennisisdebeste, md = m['Mrs. Doubtfire'];
        return `<div class="lab-card" data-id="${it.id}">
        <h2>Idea ${it.id} · ${esc(it.title)}</h2>
        <p>${esc(it.idea)}</p>
        <div class="lab-meta">${it.tiles} tiles${it.specials ? ` · ${it.specials.down} face down, ${it.specials.ice} frozen, ${it.specials.locks} locked${it.specials.clockSpare !== null && it.specials.clockSpare !== undefined ? `, clock with ${it.specials.clockSpare} spare move${it.specials.clockSpare === 1 ? '' : 's'}` : ''}` : ''} · test players win the first try: Dennis ${d ? pct(d.first) : '?'}, Mrs. Doubtfire ${md ? pct(md.first) : '?'}${r.starts || r.tries ? ` · you: started ${r.starts || 0}×, finished ${r.tries}, won ${r.wins}` : ''}</div>
        <div class="lab-row"><button class="lab-play">Play</button>
          <span class="lab-stars">${[1, 2, 3, 4, 5].map(k => `<button data-k="${k}" class="${r.stars >= k ? 'on' : ''}" aria-label="${k} stars">⭐</button>`).join('')}</span>
          <span class="lab-saved"></span></div>
        <textarea class="lab-note" placeholder="What makes it clever or not? (optional)">${esc(r.note)}</textarea>
      </div>`; }).join('')}`;
    setSync(!!db);
    panel.querySelectorAll('.lab-card').forEach(card => {
      const id = +card.dataset.id, it = IDEAS.find(x => x.id === id), r = rec(id), saved = card.querySelector('.lab-saved');
      card.querySelector('.lab-play').onclick = () => play(it);
      card.querySelectorAll('.lab-stars button').forEach(b => b.onclick = () => {
        r.stars = +b.dataset.k; card.querySelectorAll('.lab-stars button').forEach(x => x.classList.toggle('on', +x.dataset.k <= r.stars));
        push(id).then(() => saved.textContent = 'saved');
      });
      let tm = null; const note = card.querySelector('.lab-note');
      note.oninput = () => { clearTimeout(tm); saved.textContent = ''; tm = setTimeout(() => { r.note = note.value.slice(0, 1000); push(id).then(() => saved.textContent = 'saved'); }, 800); };
    });
  }

  // ---------- playing an idea in the real game ----------
  function specOf(it) {
    const d = JSON.parse(JSON.stringify(it.board));
    d.info = d.info || {};
    return { tiles: d.tiles.map(([x, y, z]) => ({ x, y, z })), kinds: new Set(d.faces).size, seed: it.id * 104729 + 1, diff: Layouts.difficultyFor(Layouts.effLevel(201)), made: d };
  }
  function play(it) {
    panel.classList.add('hidden');
    rec(it.id).starts = (rec(it.id).starts || 0) + 1; push(it.id);
    begin({ mode: 'lab', lab: it.id, key: 'X' + it.id, track: '', level: 201, title: 'Idea ' + it.id, fixedAspect: 1.6, makeSpec: () => specOf(it) });
  }
  // a finished try: counted for the idea; a win shows the lab's own end screen (no stars, no next level)
  const endLevel0 = window.endLevel;
  window.endLevel = function (r, extra) {
    if (G && G.o && G.o.lab && !G.logged) {
      const x = rec(G.o.lab); x.tries++; if (r === 'win') x.wins++;
      x.results.push({ r, ck: extra && extra.ck ? 1 : undefined, left: typeof aliveCount === 'function' ? aliveCount() : undefined, s: Math.round(G.elapsed || 0), t: Date.now() });
      push(G.o.lab);
      // every tap of this try, so the test players can be compared with how Dennis really plays these
      // boards: [tile, ms since the start, 0 taken / 1 turned over / 2 nothing happened]
      if (db && G.labTaps && G.labTaps.length) { const taps = G.labTaps.slice(0, 2000); db.collection('taps').add({ id: G.o.lab, r, ck: extra && extra.ck ? 1 : 0, t: Date.now(), made: LAB.made, n: taps.length, taps: taps.flat() }).catch(() => { }); }
    }
    return endLevel0.apply(this, arguments);
  };
  const onTap0 = window.onTap;
  window.onTap = function (i, auto) {
    if (!(G && G.o && G.o.lab) || auto) return onTap0.apply(this, arguments);
    if (!G.labTaps) G.labTaps = [];   // (a new G for every try)
    const was = G.alive[i], t0 = G.labTaps.t0 || (G.labTaps.t0 = Date.now());
    const res = onTap0.apply(this, arguments);
    G.labTaps.push([i, Date.now() - t0, was && !G.alive[i] ? 0 : G.peek === i ? 1 : 2]);
    return res;
  };
  const win0 = window.win;
  window.win = function () {
    if (!(G && G.o && G.o.lab)) return win0.apply(this, arguments);
    syncClock(); G.tStart = 0; if (G.autoFin) autoBanner(false); clearCur();
    endLevel('win', {}); G.done = true;
    Sound.win(); FX.confetti();
    const id = G.o.lab;
    setTimeout(() => {
      openModal(`<h2>Idea ${id}: won!</h2><p>How clever was this combination? Rate it in the lab.</p>
        <button class="big-btn play" id="labRate"><span class="bb-text"><b>Rate it</b></span></button>
        <button class="link-btn" id="labAgain">Play again</button>`, false);
      document.getElementById('labRate').onclick = () => { closeModal(); show('home'); panel.classList.remove('hidden'); render(); const c = panel.querySelector(`.lab-card[data-id="${id}"]`); if (c) c.scrollIntoView({ block: 'center' }); };
      document.getElementById('labAgain').onclick = () => { closeModal(); begin(G.o, true); };
    }, 900);
  };
  render();
})();
