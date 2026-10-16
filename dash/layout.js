/* Local dashboard preferences. Existing panels are moved, never recreated. */
(function () {
  'use strict';
  const KEY = 'omamj.dashboard.layout.v1', root = document.documentElement, main = document.querySelector('main');
  const specs = [
    ['stats', 'Statistieken', '#kpis', 8],
    ['ranking', 'Ranglijst', '#ranking', 4],
    ['game', 'Meekijken', '.game-watch', 4],
    ['activity', 'Speelmomenten', '#chHeat', 4],
    ['family', 'Hartjes en hulp', '#alerts', 4],
    ['closeness', 'Bijna gehaald', '#chClose', 4],
    ['levels', 'Alle levels', '#tbl', 4],
    ['feed', 'Live verloop', '#feed', 4],
    ['prediction', 'Voorspelling', '#pred', 4],
  ];
  const panels = new Map(); let editing = false, saved = null, draft = null, dragging = null, pending = 0, mode = 'original', savedMode = 'original';
  const el = (tag, className, text) => { const n = document.createElement(tag); if (className) n.className = className; if (text) n.textContent = text; return n; };
  const button = (text, label, click) => { const n = el('button', '', text); n.type = 'button'; n.setAttribute('aria-label', label); n.onclick = click; return n; };
  const board = el('div'); board.id = 'layoutBoard'; board.hidden = true; main.appendChild(board);
  const foot = document.querySelector('.foot'), footHome = document.createComment('dashboard footer'); foot.before(footHome);
  const editor = el('section'); editor.id = 'layoutEditor'; editor.hidden = true; editor.setAttribute('aria-label', 'Indeling aanpassen');
  const instructions = el('p'); editor.append(instructions);
  const visibility = el('div', 'layout-options'); visibility.id = 'layoutVisibility'; editor.append(visibility);
  const chooseMode = button('Panelen verplaatsen of vergroten', 'Andere indeling kiezen', () => { mode = mode === 'original' ? 'custom' : 'original'; apply(); });
  const actions = el('div', 'layout-actions'), message = el('span'); message.id = 'layoutMessage'; message.setAttribute('role', 'status');
  actions.append(button('Opslaan', 'Indeling opslaan', save), button('Annuleren', 'Indeling annuleren', cancel), chooseMode, button('Oorspronkelijke indeling', 'Oorspronkelijke indeling herstellen', reset), message);
  [...actions.querySelectorAll('button')].forEach(n => n.className = 'btn'); editor.append(actions);
  document.querySelector('.top').after(editor);
  const editButton = document.getElementById('layoutEdit'); editButton.onclick = begin;

  for (const [id, name, selector, span] of specs) {
    const found = document.querySelector(selector); if (!found) continue;
    const nodes = id === 'family' ? [found, document.getElementById('heartTop')] : [id === 'stats' || id === 'game' ? found : found.closest('section')];
    const homes = nodes.map(node => { const home = document.createComment('layout ' + id); node.before(home); return home; });
    const wrapper = el('section', 'layout-panel'); wrapper.dataset.panel = id; wrapper.setAttribute('aria-label', name);
    const inner = el('div'), bar = el('div', 'layout-bar'), content = el('div', 'layout-content');
    if (id === 'activity' || id === 'closeness') content.classList.add('layout-chart');
    if (id === 'family') { const group = el('div', 'dashboard-side'); content.append(group); }
    const handle = button('⠿', 'Versleep ' + name, () => {}); handle.className = 'layout-drag'; handle.draggable = true;
    handle.addEventListener('dragstart', event => { dragging = id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); wrapper.classList.add('layout-dragging'); });
    handle.addEventListener('dragend', clearDrag);
    const width = el('select'); width.setAttribute('aria-label', 'Breedte ' + name);
    for (let n = 3; n <= 12; n++) { const option = el('option', '', Math.round(n / 12 * 100) + '% breed'); option.value = n; width.append(option); }
    width.onchange = () => { clearColumns(); item(id).span = Number(width.value); apply(); };
    const visible = el('input'); visible.type = 'checkbox'; visible.setAttribute('aria-label', 'Toon ' + name);
    visible.onchange = () => { pinColumns(); item(id).visible = visible.checked; apply(); };
    const originalVisible = el('input'); originalVisible.type = 'checkbox'; originalVisible.setAttribute('aria-label', name);
    originalVisible.onchange = () => { item(id).visible = originalVisible.checked; apply(); };
    const originalShow = el('label'); originalShow.append(originalVisible, document.createTextNode(name)); visibility.append(originalShow);
    const show = el('label'); show.append(visible, document.createTextNode('Tonen'));
    bar.append(handle, el('span', 'layout-title', name), button('↑', 'Verplaats ' + name + ' omhoog', () => move(id, -1)), button('↓', 'Verplaats ' + name + ' omlaag', () => move(id, 1)), width, show);
    const placeholder = el('div', 'layout-placeholder', 'Verborgen of op dit moment geen gegevens.');
    const resize = button('◢', 'Grootte ' + name + ' aanpassen', () => {}); resize.className = 'layout-resize';
    resize.onpointerdown = event => {
      if (!editing) return;
      event.preventDefault(); const x = event.clientX, y = event.clientY, initial = { ...item(id) }, height = content.getBoundingClientRect().height;
      const unit = (board.getBoundingClientRect().width + 12) / 12; resize.setPointerCapture(event.pointerId);
      resize.onpointermove = e => {
        clearColumns(); item(id).span = Math.max(3, Math.min(12, Math.round(initial.span + (e.clientX - x) / unit)));
        item(id).height = Math.max(0, Math.min(1600, Math.round((height + e.clientY - y) / 20) * 20)); apply(false);
      };
      const done = () => { resize.onpointermove = null; resize.onpointerup = null; resize.onpointercancel = null; notifyResize(); };
      resize.onpointerup = done; resize.onpointercancel = done;
    };
    wrapper.ondragover = event => { if (editing && dragging && dragging !== id) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; wrapper.classList.add('layout-drop'); } };
    wrapper.ondragleave = () => wrapper.classList.remove('layout-drop');
    wrapper.ondrop = event => {
      if (!editing || !dragging || dragging === id) return;
      event.preventDefault(); clearColumns(); const moved = item(dragging); draft = draft.filter(p => p.id !== dragging); draft.splice(draft.findIndex(p => p.id === id), 0, moved); clearDrag(); apply();
    };
    inner.append(bar, content, placeholder); wrapper.append(inner, resize);
    panels.set(id, { id, name, span, nodes, homes, wrapper, content, inner, width, visible, originalVisible });
  }
  function defaults() { return [...panels.values()].map(p => ({ id: p.id, span: p.span, visible: true, height: 0 })); }
  function validate(raw) {
    if (!raw || raw.version !== 1 || !Array.isArray(raw.panels) || raw.panels.length > 30) return null;
    const seen = new Set(), result = [];
    for (const p of raw.panels) {
      if (!p || !panels.has(p.id) || seen.has(p.id)) continue;
      const span = Number.isInteger(p.span) && p.span >= 3 && p.span <= 12 ? p.span : panels.get(p.id).span;
      seen.add(p.id); result.push({ id: p.id, span, visible: p.visible !== false, height: Number.isFinite(p.height) ? Math.max(0, Math.min(1600, Math.round(p.height))) : 0, column: Number.isInteger(p.column) && p.column >= 1 && p.column <= 13 - span ? p.column : null });
    }
    return result.length ? result.concat(defaults().filter(p => !seen.has(p.id))) : null;
  }
  function item(id) { return draft.find(p => p.id === id); }
  function clearColumns() { for (const p of draft) p.column = null; }
  function pinColumns() {
    if (mode !== 'custom' || innerWidth <= 700) return;
    const bounds = board.getBoundingClientRect(), unit = (bounds.width + 12) / 12;
    for (const setting of draft) {
      const p = panels.get(setting.id), box = p.wrapper.getBoundingClientRect();
      if (box.width && !setting.column) setting.column = Math.max(1, Math.min(13 - setting.span, Math.round((box.left - bounds.left) / unit) + 1));
    }
  }
  function notifyResize() { dispatchEvent(new Event('resize')); }
  function measure() {
    cancelAnimationFrame(pending); pending = requestAnimationFrame(() => {
      for (const p of panels.values()) {
        if (!p.wrapper.isConnected) continue;
        p.wrapper.dataset.empty = String(p.id === 'family' && p.nodes.every(node => node.childElementCount === 0));
        const height = p.inner.getBoundingClientRect().height + (editing ? 20 : 0);
        p.wrapper.style.gridRowEnd = 'span ' + Math.max(1, Math.ceil((height + 12) / 24));
      }
    });
  }
  const changes = new MutationObserver(measure); for (const node of panels.get('family').nodes) changes.observe(node, { childList: true });
  const observer = new ResizeObserver(measure); for (const p of panels.values()) observer.observe(p.inner);
  function returnPanels() {
    for (const p of panels.values()) { p.nodes.forEach((node, i) => { if (node.previousSibling !== p.homes[i]) p.homes[i].after(node); node.classList.remove('layout-hidden'); }); p.wrapper.remove(); }
    if (foot.previousSibling !== footHome) footHome.after(foot);
  }
  function apply(notify = true) {
    const custom = mode === 'custom';
    root.classList.toggle('layout-custom', custom); root.classList.toggle('layout-editing', editing && custom); editor.hidden = !editing; board.hidden = !custom;
    visibility.hidden = custom; chooseMode.textContent = custom ? 'Vaste indeling gebruiken' : 'Panelen verplaatsen of vergroten';
    instructions.textContent = custom ? 'Versleep onderdelen of gebruik de pijlen. Pas de breedte aan en vink aan wat je wilt zien. Sleep de hoek om een onderdeel groter te maken.' : 'Vink aan wat je wilt zien. De bestaande kolommen en paneelgroottes blijven behouden.';
    editButton.setAttribute('aria-expanded', String(editing)); editButton.disabled = editing;
    if (!custom) {
      returnPanels();
      for (const setting of draft) { const p = panels.get(setting.id); p.originalVisible.checked = setting.visible; for (const node of p.nodes) node.classList.toggle('layout-hidden', !setting.visible); }
      if (notify) notifyResize(); return;
    }
    for (const [index, setting] of draft.entries()) {
      const p = panels.get(setting.id); p.wrapper.style.setProperty('--panel-span', setting.span); p.content.style.setProperty('--panel-height', setting.height + 'px');
      p.wrapper.style.gridColumn = setting.column ? `${setting.column} / span ${setting.span}` : '';
      p.wrapper.dataset.visible = String(setting.visible); p.width.value = setting.span; p.visible.checked = setting.visible;
      const target = setting.id === 'family' ? p.content.firstElementChild : p.content; for (const node of p.nodes) { node.classList.remove('layout-hidden'); if (node.parentNode !== target) target.append(node); }
      if (board.children[index] !== p.wrapper) board.insertBefore(p.wrapper, board.children[index] || null);
    }
    main.append(foot); measure(); if (notify) notifyResize();
  }
  function restore() {
    root.classList.remove('layout-custom', 'layout-editing');
    returnPanels(); board.hidden = true; editor.hidden = true; editButton.disabled = false; editButton.setAttribute('aria-expanded', 'false'); notifyResize();
  }
  function begin() { if (editing) return; editing = true; mode = saved ? savedMode : 'original'; draft = saved ? saved.map(p => ({ ...p })) : defaults(); message.textContent = 'Wijzigingen worden na Opslaan in deze browser onthouden.'; apply(); }
  function save() {
    try { pinColumns(); localStorage.setItem(KEY, JSON.stringify({ version: 1, mode, panels: draft })); saved = draft.map(p => ({ ...p })); savedMode = mode; editing = false; apply(); }
    catch (e) { message.textContent = 'Opslaan is niet gelukt. Sta browseropslag toe en probeer opnieuw.'; }
  }
  function cancel() { editing = false; if (saved) { mode = savedMode; draft = saved.map(p => ({ ...p })); apply(); } else { mode = 'original'; restore(); } }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) { message.textContent = 'Herstellen is niet gelukt. Probeer opnieuw.'; return; } saved = null; draft = null; editing = false; mode = savedMode = 'original'; restore(); }
  function move(id, direction) { const at = draft.findIndex(p => p.id === id), to = at + direction; if (to < 0 || to >= draft.length) return; clearColumns(); [draft[at], draft[to]] = [draft[to], draft[at]]; apply(); }
  function clearDrag() { dragging = null; for (const p of panels.values()) p.wrapper.classList.remove('layout-drop', 'layout-dragging'); }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)); saved = validate(raw);
    if (saved) {
      const baseline = defaults();
      const unchanged = saved.every((p, i) => baseline[i].id === p.id && baseline[i].span === p.span && !p.height);
      savedMode = raw.mode === 'original' || !raw.mode && unchanged ? 'original' : 'custom';
    }
  } catch (e) { saved = null; }
  if (saved) { mode = savedMode; draft = saved.map(p => ({ ...p })); apply(); }
})();
