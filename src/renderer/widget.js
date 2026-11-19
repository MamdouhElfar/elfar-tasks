let data = null;
const $ = (id) => document.getElementById(id);
const t = (k) => (I18N[data.settings.lang] || I18N.ar)[k] || k;

function save() { window.api.saveData(data); }

function filterInfo() {
  const f = data.settings.widget.filter || 'focus';
  const td = todayStr();
  if (f === 'pending') return { title: t('pending'), test: (x) => !x.closure };
  if (f === 'starred') return { title: t('starred'), test: (x) => !x.closure && x.starred };
  if (f.startsWith('person:')) {
    const p = data.people.find((y) => y.id === f.slice(7));
    if (p) return { title: `${t('waiting')}: ${p.name}`, personId: p.id, test: (x) => !x.closure && (x.pendingWith || []).some((pw) => pw.personId === p.id) };
  }
  if (f.startsWith('area:')) {
    const id = f.slice(5);
    const a = data.areas.find((y) => y.id === id);
    const ids = [id, ...data.areas.filter((y) => y.parentId === id).map((y) => y.id)];
    return { title: a ? a.name : t('pending'), areaId: a ? id : null, test: (x) => !x.closure && (!a || ids.includes(x.areaId)) };
  }
  return { title: t('today'), today: true, test: (x) => !x.closure && ((x.due && x.due <= td) || x.starred) };
}

function render() {
  applyLang(data.settings.lang);
  const w = data.settings.widget;
  const f = filterInfo();
  $('wTitle').textContent = `${f.title} · ${new Date().toLocaleDateString(data.settings.lang === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
  $('wOpen').title = t('openApp');
  $('wHide').title = t('hide');
  $('wAdd').placeholder = '＋ ' + t('addTask');

  const edge = w.edge || 'off';
  // Two modes, exactly one active: always on top / hide at the edge.
  const side = edge !== 'off' ? edge : (w.lastEdge || 'right');
  $('wPin').innerHTML = icon('pin');
  $('wPin').classList.toggle('on', edge === 'off');
  $('wPin').setAttribute('aria-pressed', edge === 'off');
  $('wPin').title = t('onTop') + (edge === 'off' ? ' ✓' : '');
  $('wEdge').innerHTML = icon(side === 'left' ? 'edgeLeft' : 'edgeRight');
  $('wEdge').classList.toggle('on', edge !== 'off');
  $('wEdge').setAttribute('aria-pressed', edge !== 'off');
  $('wEdge').title = `${t('autoHide')} · ${t(side === 'left' ? 'edgeLeft' : 'edgeRight')}` + (edge !== 'off' ? ' ✓' : '');

  // Same order as the app: priority (matrix box) first, then nearest due date.
  const list = data.tasks.filter(f.test).sort(byPriorityThenDue);
  // The edge tab shows how many tasks are waiting, red if any are "do it now".
  // The edge tab is a little mouse peeking in, with its tail hanging below 🐭
  $('peek').innerHTML = `<span class="pk-face">${mouseLogo()}</span><span class="pk-count">${list.length}</span>
    <svg class="pk-tail" viewBox="0 0 30 100" aria-hidden="true"><path d="M15 0 C 3 16, 27 28, 15 46 S 3 74, 18 88 Q 24 94, 20 99"/></svg>`;
  $('peek').classList.toggle('q1', list.some((x) => x.priority === 'q1' || statusOf(x) === 'overdue'));
  applyEdge(edge);
  if (!list.length) { $('wList').innerHTML = `<div class="w-empty">${f.today ? t('nothingToday') : t('emptyList')}</div>`; return; }
  const remindPill = (x) => x.remindAt ? `<span class="pill remind ${x.remindAt <= nowLocal() ? 'past' : ''}">${icon('bell')} ${fmtTime(x.remindAt, data.settings.lang)}</span>` : '';
  $('wList').innerHTML = list.map((x) => {
    const subs = x.subtasks || [];
    const s = statusOf(x);
    const pill = s === 'overdue' ? `<span class="pill overdue">${t('stOverdue')}</span>` : s === 'today' ? `<span class="pill today">${t('stDueToday')}</span>` : '';
    return `<div class="w-item ${quadClass(x)}">
      <button class="check" data-check="${x.id}" title="${t('closeToday')}">✓</button>
      <div class="t-main"><div class="t-title" dir="auto" data-open="${x.id}">${x.starred ? '<span class="star">★</span> ' : ''}${esc(x.title)}</div>
        <div class="t-meta">${pill}${remindPill(x)}${QUADS.includes(x.priority) ? `<span class="pill ${x.priority}">${t(x.priority + 'a')}</span>` : ''}${(x.pendingWith || []).map((pw) => data.people.find((p) => p.id === pw.personId)).filter(Boolean).map((p) => `<span class="pill person" dir="auto">${esc(p.name)}</span>`).join('')}${subs.length ? `<span>${subs.filter((y) => y.done).length}/${subs.length}</span>` : ''}${x.due && s !== 'today' ? `<span>${fmtDate(x.due, data.settings.lang)}</span>` : ''}</div>
      </div></div>`;
  }).join('');
}

$('wList').onclick = (e) => {
  const c = e.target.closest('[data-check]');
  if (c) {
    const x = data.tasks.find((y) => y.id === c.dataset.check);
    c.classList.add('on');
    setTimeout(() => c.closest('.w-item')?.classList.add('leaving'), 120);
    setTimeout(() => { x.closure = todayStr(); x.updated = Date.now(); save(); render(); }, 350);
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
  if (edge === curEdge) return;
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
// While tucked away, mouse moves are still forwarded to us; hovering the tab slides the card out.
document.addEventListener('mousemove', (e) => {
  if (curEdge === 'off' || !collapsed) return;
  const r = $('peek').getBoundingClientRect();
  if (e.clientX >= r.left - 4 && e.clientX <= r.right + 4 && e.clientY >= r.top && e.clientY <= r.bottom) setCollapsed(false);
});
// The main process watches the real cursor and tells us when it has left the widget.
window.api.onWidgetCollapse(() => { if (curEdge !== 'off' && !collapsed) setCollapsed(true); });
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
