let data = null;
const $ = (id) => document.getElementById(id);
const t = (k) => (I18N[data.settings.lang] || I18N.ar)[k] || k;

function save() { window.api.saveData(data); }

const in7 = () => { const d = new Date(); d.setDate(d.getDate() + 7); return todayStr(d); };
const hasPeople = (x) => (x.pendingWith || []).some((pw) => data.people.some((p) => p.id === pw.personId));

function filterInfo() {
  const f = data.settings.widget.filter || 'focus';
  const td = todayStr();
  if (f === 'overdue') return { title: t('overdue'), test: (x) => statusOf(x) === 'overdue' };
  if (f === 'dueToday') return { title: t('stDueToday'), today: true, test: (x) => statusOf(x) === 'today' };
  if (f === 'week') return { title: t('hWeek'), test: (x) => !x.closure && x.due && x.due > td && x.due <= in7() };
  if (f === 'others') return { title: t('hOthers'), test: (x) => isActive(x) && hasPeople(x) };
  if (f === 'pending') return { title: t('pending'), test: isActive };
  if (f === 'starred') return { title: t('starred'), test: (x) => isActive(x) && x.starred };
  if (f.startsWith('person:')) {
    const p = data.people.find((y) => y.id === f.slice(7));
    if (p) return { title: `${t('waiting')}: ${p.name}`, personId: p.id, test: (x) => isActive(x) && (x.pendingWith || []).some((pw) => pw.personId === p.id) };
  }
  if (f.startsWith('area:')) {
    const id = f.slice(5);
    const a = data.areas.find((y) => y.id === id);
    const ids = [id];
    for (let i = 0; i < ids.length; i++) data.areas.forEach((y) => { if (y.parentId === ids[i] && !ids.includes(y.id)) ids.push(y.id); });
    return { title: a ? a.name : t('pending'), areaId: a ? id : null, test: (x) => isActive(x) && (!a || ids.includes(x.areaId)) };
  }
  return { title: t('today'), today: true, test: (x) => !x.closure && ((x.due && x.due <= td) || x.starred) };
}

// The four numbers on top. Clicking one shows those tasks; clicking it again goes back
// to what the widget showed before (picked in Settings).
function renderStats() {
  const td = todayStr();
  const open = data.tasks.filter((x) => !x.closure);
  const cards = [
    ['overdue', open.filter((x) => statusOf(x) === 'overdue').length, t('overdue'), 'danger'],
    ['dueToday', open.filter((x) => statusOf(x) === 'today').length, t('stDueToday'), 'warn'],
    ['week', open.filter((x) => x.due && x.due > td && x.due <= in7()).length, t('wWeek'), 'info'],
    ['others', open.filter((x) => isActive(x) && hasPeople(x)).length, t('wOthers'), 'violet']
  ];
  const cur = data.settings.widget.filter;
  $('wStats').innerHTML = cards.map(([k, n, label, cls]) =>
    `<button class="w-stat ${cls} ${n ? '' : 'zero'} ${cur === k ? 'on' : ''}" data-stat="${k}" title="${esc(label)}"><b>${n}</b><span>${esc(label)}</span></button>`).join('');
}
$('wStats').onclick = (e) => {
  const b = e.target.closest('[data-stat]'); if (!b) return;
  const w = data.settings.widget;
  if (w.filter === b.dataset.stat) w.filter = w.prevFilter || 'focus';
  else { if (!['overdue', 'dueToday', 'week', 'others'].includes(w.filter)) w.prevFilter = w.filter; w.filter = b.dataset.stat; }
  save(); render();
};

function render() {
  applyLang(data.settings.lang);
  const w = data.settings.widget;
  const f = filterInfo();
  $('wTitle').textContent = `${f.title} · ${new Date().toLocaleDateString(data.settings.lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
  $('wOpen').title = t('openApp');
  $('wHide').title = t('hide');
  $('wAdd').placeholder = '＋ ' + t('addTask');

  renderStats();
  const edge = w.edge || 'off';
  // Two modes, exactly one active: always on top / hide at the edge.
  const side = edge !== 'off' ? edge : (w.lastEdge || 'right');
  $('wPin').innerHTML = icon('pin');
  $('wPin').classList.toggle('on', edge === 'off');
  $('wPin').setAttribute('aria-pressed', edge === 'off');
  $('wPin').title = t('onTop') + (edge === 'off' ? ' ✓' : '');
  $('wEdge').innerHTML = icon(side === 'left' ? 'edgeLeft' : side === 'top' ? 'edgeTop' : 'edgeRight');
  $('wEdge').classList.toggle('on', edge !== 'off');
  $('wEdge').setAttribute('aria-pressed', edge !== 'off');
  $('wEdge').title = `${t('autoHide')} · ${t(side === 'left' ? 'edgeLeft' : side === 'top' ? 'edgeTop' : 'edgeRight')}` + (edge !== 'off' ? ' ✓' : '');

  // Same order as the app: priority (matrix box) first, then nearest due date.
  const list = data.tasks.filter(f.test).sort(byPriorityThenDue);
  // The edge tab shows how many tasks are waiting, red if any are "do it now".
  // The edge tab is a little mouse peeking in, with its tail hanging below 🐭
  $('peek').innerHTML = `<span class="pk-face">${mouseLogo()}</span><span class="pk-count">${list.length}</span>
    <svg class="pk-tail" viewBox="0 0 30 100" aria-hidden="true"><path d="M15 0 C 3 16, 27 28, 15 46 S 3 74, 18 88 Q 24 94, 20 99"/></svg>
    <span class="pk-grab" id="pkGrab" title="${esc(t('dragTail'))}"></span>`;
  $('peek').classList.toggle('q1', list.some((x) => x.priority === 'q1' || statusOf(x) === 'overdue'));
  applyEdge(edge);
  if (!list.length) { $('wList').innerHTML = `<div class="w-empty">${f.today ? t('nothingToday') : t('emptyList')}</div>`; return; }
  const remindPill = (x) => x.remindAt ? `<span class="pill remind ${x.remindAt <= nowLocal() ? 'past' : ''}">${icon('bell')} ${fmtTime(x.remindAt, data.settings.lang)}</span>` : '';
  $('wList').innerHTML = list.map((x) => {
    const subs = x.subtasks || [];
    const s = statusOf(x);
    const w = whenOf(x, data.settings.lang);
    const pill = w ? `<span class="when ${w.cls}" title="${esc(w.title || '')}">${w.text}</span>` : '';
    return `<div class="w-item ${quadClass(x)}">
      <button class="check" data-check="${x.id}" title="${t('closeToday')}">✓</button>
      <div class="t-main"><div class="t-title" dir="auto" data-open="${x.id}">${x.starred ? '<span class="star">★</span> ' : ''}${esc(x.title)}</div>
        <div class="t-meta">${QUADS.includes(x.priority) ? `<span class="pnum ${x.priority}" title="${PRIO_NUM[x.priority]} · ${esc(t(x.priority))}">${PRIO_NUM[x.priority]}</span>` : ''}${pill}${remindPill(x)}${(x.pendingWith || []).map((pw) => data.people.find((p) => p.id === pw.personId)).filter(Boolean).map((p) => `<span class="pill person" dir="auto">${esc(p.name)}</span>`).join('')}${subs.length ? `<span>${subs.filter((y) => y.done).length}/${subs.length}</span>` : ''}</div>
      </div></div>`;
  }).join('');
}

$('wList').onclick = (e) => {
  const c = e.target.closest('[data-check]');
  if (c) {
    const x = data.tasks.find((y) => y.id === c.dataset.check);
    c.classList.add('on');
    setTimeout(() => c.closest('.w-item')?.classList.add('leaving'), 120);
    // Same as closing in the app: a repeating task gets its next round.
    setTimeout(() => { x.closure = todayStr(); x.updated = Date.now(); spawnNext(x); save(); render(); }, 350);
    return;
  }
  const o = e.target.closest('[data-open]');
  if (o) window.api.openTask(o.dataset.open);
};
$('wPin').onclick = () => {
  if ((data.settings.widget.edge || 'off') === 'off') return;
  data.settings.widget.edge = 'off'; save(); render();
};
$('wOpen').onclick = () => window.api.openTask(null);
// Toggle edge mode (uses the side picked in Settings, right by default).
$('wEdge').onclick = () => {
  const w = data.settings.widget;
  if ((w.edge || 'off') !== 'off') return;
  w.edge = w.lastEdge || 'right';
  save(); render();
};

// ---------------- edge mode (hide at screen edge, slide out on hover) ----------------
// Hover the tab → it slides out. Move the mouse away → it slides back, always.
// (To keep it visible, switch to the 📌 always-on-top mode.)
let curEdge = null, collapsed = false;
function applyEdge(edge) {
  if (edge === curEdge || tailDragging) return;
  curEdge = edge;
  document.body.classList.toggle('edge', edge !== 'off');
  document.body.dataset.edge = edge;
  if (edge === 'off') { collapsed = false; document.body.classList.remove('collapsed'); }
  else setCollapsed(true);
}
function setCollapsed(c) {
  collapsed = c;
  document.body.classList.toggle('collapsed', c);
  if (curEdge === 'off') return;
  if (c) {
    // Let clicks pass through to the apps below once the slide-away finishes.
    setTimeout(() => { if (collapsed) window.api.widgetIgnoreMouse(true); }, 260);
  } else {
    window.api.widgetIgnoreMouse(false);
  }
}
// While tucked away, mouse moves are still forwarded to us.
// Hovering the mouse's face slides the card out. Hovering the tail makes it grabbable:
// hold and drag to move the mouse along the edge, or to another edge (top, left, right).
// "Open on click" (Settings › Desktop widget): hovering the face only highlights it; a click opens it.
const openOnClick = () => (data.settings.widget.openOn || 'hover') === 'click';
let tailHot = false, tailDragging = false, hotPart = null;
const inRect = (e, r, pad = 4) => e.clientX >= r.left - pad && e.clientX <= r.right + pad && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
// part: 'tail' / 'face' = the window takes the mouse there (to drag or click); null = clicks pass through.
function setHot(part) {
  if (part === hotPart) return;
  hotPart = part; tailHot = !!part;
  document.body.classList.toggle('tail-hot', part === 'tail');
  document.body.classList.toggle('face-hot', part === 'face');
  window.api.widgetIgnoreMouse(!part);
}
const setTailHot = (hot) => setHot(hot ? 'tail' : null);
function openCard() { hotPart = null; tailHot = false; document.body.classList.remove('tail-hot', 'face-hot'); setCollapsed(false); }
document.addEventListener('mousemove', (e) => {
  if (curEdge === 'off' || !collapsed || tailDragging) return;
  const grab = $('pkGrab');
  if (grab && inRect(e, grab.getBoundingClientRect(), 2)) return setHot('tail');
  if (inRect(e, $('peek').getBoundingClientRect())) return openOnClick() ? setHot('face') : openCard();
  setHot(null);
});
// Open on click: a click on the face opens the card.
document.addEventListener('click', (e) => {
  if (curEdge === 'off' || !collapsed || !e.target.closest || !e.target.closest('#peek') || e.target.closest('#pkGrab')) return;
  openCard();
});
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest || !e.target.closest('#pkGrab') || curEdge === 'off') return;
  e.preventDefault();
  e.target.setPointerCapture(e.pointerId);
  tailDragging = true;
  const x0 = e.screenX, y0 = e.screenY;
  document.body.classList.add('tail-drag');
  window.api.tailDrag('start');
  const up = (ev) => {
    e.target.removeEventListener('pointerup', up);
    e.target.removeEventListener('pointercancel', up);
    window.api.tailDrag('end');
    tailDragging = false;
    document.body.classList.remove('tail-drag');
    // A click without dragging opens the card.
    if (Math.abs(ev.screenX - x0) + Math.abs(ev.screenY - y0) < 4) openCard();
  };
  e.target.addEventListener('pointerup', up);
  e.target.addEventListener('pointercancel', up);
});
// While dragging, the main process tells us which edge we're on, so the tab turns to face it.
window.api.onWidgetDock((edge) => { document.body.dataset.edge = edge; curEdge = edge; });
// The main process watches the real cursor and tells us when it has left the widget.
window.api.onWidgetCollapse(() => {
  if (curEdge === 'off' || tailDragging) return;
  if (!collapsed) setCollapsed(true);
  else setHot(null);
});
$('wHide').onclick = () => window.api.setWidgetVisible(false);
$('wAdd').onkeydown = (e) => {
  if (e.key !== 'Enter' || !e.target.value.trim()) return;
  const f = filterInfo();
  data.tasks.push({
    id: uid(), areaId: f.areaId || null, title: e.target.value.trim(), start: todayStr(), due: f.today ? todayStr() : null,
    closure: null, starred: false, notes: '',
    pendingWith: f.personId ? [{ personId: f.personId, since: todayStr() }] : [], subtasks: [], log: [], created: Date.now(), updated: Date.now()
  });
  e.target.value = '';
  save(); render();
};

(async () => {
  data = await window.api.getData();
  render();
  window.api.onDataChanged((d) => { data = d; render(); });
  setInterval(render, 60000);
})();
