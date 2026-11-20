let data = null;
// scope = which area you're looking at (sidebar); view = how you're filtering it (tabs on top).
// person = optional filter: only tasks pending with that person.
const ui = { scope: 'all', view: 'today', pendingSub: 'all', selected: null, search: '', sort: 'priority', calMonth: null, person: null };
let saveTimer = null;
let dragTaskId = null;

const $ = (id) => document.getElementById(id);
const t = (k) => (I18N[data.settings.lang] || I18N.ar)[k] || k;
const lang = () => data.settings.lang;

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.api.saveData(data), 250);
}
function touch(task) { task.updated = Date.now(); save(); }

const areaById = (id) => data.areas.find((a) => a.id === id);
const taskById = (id) => data.tasks.find((x) => x.id === id);
const topAreas = () => data.areas.filter((a) => !a.parentId);
const childrenOf = (id) => data.areas.filter((a) => a.parentId === id);
// Folders nest up to three levels: folder › subfolder › sub-subfolder.
const MAX_DEPTH = 2;
function ancestorsOf(id) {
  const out = [];
  let a = areaById(id);
  while (a && a.parentId && !out.includes(a.parentId) && areaById(a.parentId)) { out.push(a.parentId); a = areaById(a.parentId); }
  return out;
}
const depthOf = (id) => ancestorsOf(id).length;
function descendantsOf(id) {
  const out = [];
  const walk = (p) => childrenOf(p).forEach((c) => { if (!out.includes(c.id)) { out.push(c.id); walk(c.id); } });
  walk(id);
  return out;
}
const areaColor = (a) => `var(--c-${(a && a.color) || 'gray'})`;
function areaLabel(id) {
  const a = areaById(id);
  if (!a) return t('inbox');
  return [...ancestorsOf(id).reverse().map((pid) => areaById(pid).name), a.name].join(' / ');
}
const isOpen = (x) => !x.closure;
const prioNames = () => ({ q1: t('q1'), q2: t('q2'), q3: t('q3'), q4: t('q4') });

// ---------------- people ----------------
const personById = (id) => data.people.find((p) => p.id === id);
const pendingOf = (x) => (x.pendingWith || []).filter((pw) => personById(pw.personId));
const isPendingWith = (x, pid) => pendingOf(x).some((pw) => pw.personId === pid);
const peopleNames = (x) => pendingOf(x).map((pw) => personById(pw.personId).name);

function findOrCreatePerson(name, areaId) {
  name = name.trim();
  if (!name) return null;
  let p = data.people.find((y) => y.name.toLowerCase() === name.toLowerCase());
  if (!p) { p = { id: uid(), name, areaIds: [] }; data.people.push(p); }
  // First time this person shows up in an area/project, link them to it.
  if (areaId && !p.areaIds.includes(areaId)) p.areaIds.push(areaId);
  return p;
}

// People linked to the task's area (or its parent area) come first in suggestions.
function suggestedPeople(x) {
  const a = areaById(x.areaId);
  const related = a ? [a.id, ...ancestorsOf(a.id)] : [];
  const score = (p) => (p.areaIds.some((id) => related.includes(id)) ? 0 : 1);
  return data.people
    .filter((p) => !isPendingWith(x, p.id))
    .sort((p, q) => score(p) - score(q) || p.name.localeCompare(q.name));
}

// ---------------- filtering ----------------
// Two groups of tabs: task lists (filters) and boards (other ways to look at the same tasks).
// Five tabs: Today (your day, with the plan) · All open tasks · Matrix · Calendar · Review.
// "Closed" lives inside Review, next to the report.
const VIEWS = [
  { id: 'today', lead: true, test: (x) => isOpen(x) && ((x.due && x.due <= todayStr()) || x.starred || inPlan(x)),
    cls: () => (data.tasks.some((x) => inScope(x) && statusOf(x) === 'overdue') ? 'danger' : '') },
  { id: 'pending', test: isActive, cls: () => 'warn' },
  { id: 'closed', test: (x) => !!x.closure, noCount: true, hidden: true },
  { id: 'matrix', test: isActive, noCount: true, board: true },
  { id: 'calendar', test: () => true, noCount: true, board: true },
  { id: 'report', label: 'review', test: () => true, noCount: true, board: true, also: 'closed' }
];

function inScope(x, scope = ui.scope) {
  if (scope === 'all') return true;
  if (scope === 'inbox') return !areaById(x.areaId);
  return x.areaId === scope || ancestorsOf(x.areaId).includes(scope);
}

function currentTasks() {
  const v = VIEWS.find((v) => v.id === ui.view);
  let list = data.tasks.filter((x) => inScope(x) && v.test(x) && (!ui.person || isPendingWith(x, ui.person)));
  if (ui.view === 'pending' && ui.pendingSub === 'later') list = data.tasks.filter((x) => inScope(x) && statusOf(x) === 'scheduled' && (!ui.person || isPendingWith(x, ui.person)));
  else if (ui.view === 'pending' && ui.pendingSub !== 'all') list = list.filter((x) => (pendingOf(x).length > 0) === (ui.pendingSub === 'others'));
  const q = ui.search.trim().toLowerCase();
  if (q) {
    list = list.filter((x) => [x.title, x.notes, ...peopleNames(x), ...(x.subtasks || []).map((s) => s.title), ...(x.log || []).map((l) => l.text)]
      .join('\n').toLowerCase().includes(q));
  }
  const cmp = {
    due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.start || '').localeCompare(b.start || ''),
    start: (a, b) => (a.start || '').localeCompare(b.start || ''),
    updated: (a, b) => (b.updated || 0) - (a.updated || 0),
    priority: byPriorityThenDue
  }[ui.sort];
  list.sort((a, b) => {
    if (ui.view === 'closed') return (b.closure || '').localeCompare(a.closure || '');
    if (ui.view === 'today' && ui.todayOrder) {
      const ia = ui.todayOrder.indexOf(a.id), ib = ui.todayOrder.indexOf(b.id);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    }
    if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1;
    return cmp(a, b);
  });
  return list;
}

// ---------------- rendering ----------------
function renderAll() {
  applyLang(lang());
  document.title = t('appName');
  $('brandName').textContent = t('appName');
  $('areasTitle').textContent = t('areas');
  $('peopleTitle').textContent = t('people');
  $('addPersonBtn').title = t('addPerson');
  $('addAreaBtn').title = t('addArea');
  $('settingsLbl').textContent = t('settings');
  $('langBtn').innerHTML = `${icon('globe')}<span>${lang() === 'ar' ? 'English' : 'عربي'}</span>`;
  $('langBtn').title = t('langSwitch');
  $('search').placeholder = t('search');
  $('fab').title = t('newTask') + ' (Ctrl+N)';
  if ($('composer').classList.contains('open')) renderComposer();
  $('dragHint').textContent = t('dragHint');
  document.querySelectorAll('[data-ico]').forEach((el) => (el.innerHTML = icon(el.dataset.ico)));
  $('sort').innerHTML = ['due', 'priority', 'start', 'updated'].map((s) =>
    `<option value="${s}" ${ui.sort === s ? 'selected' : ''}>${t('sortBy')}: ${t('sort' + s[0].toUpperCase() + s.slice(1))}</option>`).join('');
  refresh();
}

function renderTabs() {
  const tab = (v) => {
    const n = v.noCount ? 0 : data.tasks.filter((x) => inScope(x) && v.test(x) && (!ui.person || isPendingWith(x, ui.person))).length;
    const on = ui.view === v.id || ui.view === v.also;
    return `<button class="tab ${v.board ? 'board' : ''} ${v.lead ? 'lead' : ''} ${on ? 'active' : ''}" data-view="${v.id}" title="${esc(t(v.label || v.id))}">
      ${icon(v.id)}<span class="tab-label">${esc(t(v.label || v.id))}</span>${n ? `<span class="count ${v.cls ? v.cls() : ''}">${n}</span>` : ''}</button>`;
  };
  $('tabs').innerHTML = `<div class="tab-group">${VIEWS.filter((v) => v.lead).map(tab).join('')}</div>
    <span class="tab-sep"></span>
    <div class="tab-group">${VIEWS.filter((v) => !v.board && !v.lead && !v.hidden).map(tab).join('')}</div>
    <span class="tab-sep"></span>
    <div class="tab-group boards">${VIEWS.filter((v) => v.board).map(tab).join('')}</div>`;
  fitTabs();
  // Tools that don't apply to a view are hidden instead of sitting there doing nothing.
  const tools = { search: !['today', 'calendar', 'report'].includes(ui.view), sort: !['today', 'matrix', 'calendar', 'report'].includes(ui.view) };
  $('search').hidden = !tools.search;
  $('sort').hidden = !tools.sort;
}

// The tabs never scroll: when they don't fit (narrow window or big text) they drop
// their labels step by step, keeping the open tab's label for as long as possible.
function fitTabs() {
  const el = $('tabs');
  const over = () => el.scrollWidth > el.clientWidth + 1;
  el.classList.remove('compact-boards', 'compact', 'compact-all', 'tight');
  if (!over()) return;
  el.classList.add('compact-boards');
  if (!over()) return;
  el.classList.add('compact');
  if (!over()) return;
  el.classList.add('compact-all');
  if (over()) el.classList.add('tight');
}
if (window.ResizeObserver) new ResizeObserver(() => fitTabs()).observe(document.getElementById('tabs'));

// Folders start collapsed. They also open while you're inside one of their projects,
// or while you hover over them during a drag.
const dragExpanded = new Set();
function isExpanded(id) {
  return (data.settings.expanded || []).includes(id) || dragExpanded.has(id) || ancestorsOf(ui.scope).includes(id);
}
function toggleExpanded(id) {
  const s = new Set(data.settings.expanded || []);
  s.has(id) ? s.delete(id) : s.add(id);
  data.settings.expanded = [...s];
  save();
}

function renderSidebar() {
  const openCount = (scope) => data.tasks.filter((x) => isActive(x) && inScope(x, scope)).length;
  const item = (scope, inner, extra = '') =>
    `<div class="nav-item ${extra} ${ui.scope === scope ? 'active' : ''}" data-scope="${scope}">${inner}<span class="count">${openCount(scope) || ''}</span></div>`;

  $('scopeNav').innerHTML =
    item('all', `${icon('all')}<span>${t('allAreas')}</span>`) +
    // "No area" only shows when it has tasks (or while dragging, as a drop target).
    item('inbox', `${icon('inbox')}<span>${t('inbox')}</span>`, openCount('inbox') || ui.scope === 'inbox' ? '' : 'empty-inbox');

  // Folders, drawn as a tree: each level folds open and shut on its own.
  const node = (a, depth) => {
    const kids = childrenOf(a.id);
    const open = isExpanded(a.id);
    const chev = `<span class="chev ${open ? 'open' : ''} ${kids.length ? '' : 'no-kids'}" data-toggle="${a.id}">${icon('chevron')}</span>`;
    const lead = depth ? chev : `${chev}<span class="dot" style="background:${areaColor(a)}"></span>`;
    return item(a.id, `${lead}<span dir="auto">${esc(a.name)}</span>`, depth ? `child d${Math.min(depth, MAX_DEPTH)}` : '')
        .replace('</div>', `<button class="edit" data-edit-area="${a.id}">✎</button></div>`) +
      (kids.length ? `<div class="kids ${open ? 'open' : ''}" data-kids="${a.id}"><div>${kids.map((c) => node(c, depth + 1)).join('')}</div></div>` : '');
  };
  $('areasNav').innerHTML = topAreas().map((a) => node(a, 0)).join('');

  updateMascot();

  // People: sorted by how many open tasks are pending with them.
  const pendingCount = (pid) => data.tasks.filter((x) => isOpen(x) && isPendingWith(x, pid)).length;
  $('peopleNav').innerHTML = data.people
    .map((p) => ({ p, n: pendingCount(p.id) }))
    .sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name))
    .map(({ p, n }) => `<div class="nav-item ${ui.person === p.id ? 'active' : ''}" data-person="${p.id}">
      ${icon('user')}<span dir="auto">${esc(p.name)}</span><span class="count">${n || ''}</span>
      <button class="edit" data-edit-person="${p.id}">✎</button></div>`).join('');

}

function statusPill(x) {
  const s = statusOf(x);
  if (s === 'scheduled') return `<span class="pill scheduled">${icon('calendar')} ${t('stScheduled')} ${fmtDate(x.start, lang())}</span>`;
  const key = { pending: 'stPending', overdue: 'stOverdue', closed: 'stClosed', today: 'stDueToday' }[s];
  return `<span class="pill ${s}">${t(key)}</span>`;
}

// The one date a task needs, said the way you'd say it: "2 days late", "Today · 2:00 PM",
// "Tomorrow", "Sunday", "29 Nov". The full date is in the tooltip.
const whenInfo = (x) => whenOf(x, lang());
function whenChip(x, hideToday) {
  if (statusOf(x) === 'scheduled') return statusPill(x);
  const w = whenInfo(x);
  if (!w || (hideToday && w.cls === 'today' && !x.dueTime)) return '';
  return `<span class="when ${w.cls}" ${w.title ? `title="${esc(w.title)}"` : ''}>${w.cls === 'overdue' ? icon('overdue') : ''}${w.text}</span>`;
}
const prioNum = (x) => (x.priority && isOpen(x) ? `<span class="pnum ${x.priority}" title="${PRIO_NUM[x.priority]} · ${esc(t(x.priority))} — ${esc(t(x.priority + 'a'))}">${PRIO_NUM[x.priority]}</span>` : '');
const sinceWord = (since) => { const n = Math.max(0, daysBetween(since || todayStr(), todayStr())); return n ? daysWord(n, lang()) : t('stDueToday'); };

function rowHtml(x) {
  const subs = x.subtasks || [];
  const done = subs.filter((s) => s.done).length;
  const showArea = ui.scope !== x.areaId;
  const remindDay = x.remindAt && x.remindAt.slice(0, 10);
  const next = isOpen(x) && subs.find((s) => !s.done);
  const focusOn = data.focus && data.focus.taskId === x.id;
  return `<div class="task-row ${quadClass(x)} ${x.closure ? 'closed' : ''} ${ui.selected === x.id ? 'sel' : ''}" data-task="${x.id}" draggable="true">
    <button class="check ${x.closure ? 'on' : ''}" data-check="${x.id}" title="${x.closure ? t('reopen') : t('closeToday')}">✓</button>
    <div class="t-main">
      <div class="t-title" dir="auto">${focusOn ? '<span class="in-focus" title="' + t('fWorkingOn') + '">◉</span> ' : ''}${x.starred ? '<span class="star">★</span> ' : ''}${esc(x.title) || '<span class="muted">' + t('title') + '</span>'}</div>
      ${next ? `<div class="t-next" title="${t('nextStep')}"><span class="arrow">↳</span> <span dir="auto">${esc(next.title)}</span></div>` : ''}
      <div class="t-meta">${prioNum(x)}${whenChip(x, ui.view === 'today')}${x.remindAt && isOpen(x) ? `<span class="pill remind ${x.remindAt <= nowLocal() ? 'past' : ''}">${icon('bell')} ${remindDay === todayStr() ? '' : fmtDate(remindDay, lang()) + ' '}${fmtTime(x.remindAt, lang())}</span>` : ''}${x.repeat && isOpen(x) ? `<span class="pill repeat" title="${esc(repeatLabel(x.repeat))}">${icon('repeat')}</span>` : ''}${(x.files || []).length ? `<span class="pill area">${icon('clip')} ${x.files.length}</span>` : ''}
        ${subs.length ? `<span class="progress"><span class="bar"><i style="width:${(done / subs.length) * 100}%"></i></span>${done}/${subs.length}</span>` : ''}
        ${isOpen(x) && (x.postponed || 0) >= 2 ? `<span class="postponed" title="${t('postponedTip')}">↻ ${lang() === 'ar' ? 'اتأجلت ' + timesWord(x.postponed, 'ar') : 'put off ' + timesWord(x.postponed, 'en')}</span>` : ''}
        ${isOpen(x) ? pendingOf(x).map((pw) => `<span class="pill person" title="${t('since')} ${fmtDate(pw.since, lang())}">${icon('user')} <bdi>${esc(personById(pw.personId).name)}</bdi> · ${sinceWord(pw.since)}</span>`).join('') : ''}
        ${showArea ? `<span class="pill area">${esc(areaLabel(x.areaId))}</span>` : ''}
      </div>
    </div>${isOpen(x) && !focusOn ? `<button class="row-focus" data-focus="${x.id}" title="${t('fStartTip')}">▶</button>` : ''}</div>`;
}

function renderList() {
  const a = areaById(ui.scope);
  const scopeName = ui.scope === 'all' ? t('allAreas') : areaLabel(ui.scope);
  $('listTitle').innerHTML = (a ? `<span class="dot" style="background:${areaColor(a)}"></span>` : icon(ui.scope === 'inbox' ? 'inbox' : 'all')) +
    `<span>${esc(scopeName)}</span>`;

  $('personFilter').innerHTML = `<option value="">${t('allPeople')}</option>` +
    data.people.slice().sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => `<option value="${p.id}" ${ui.person === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  $('personFilter').classList.toggle('active', !!ui.person);

  if (ui.view === 'today') return renderHome();
  if (ui.view === 'calendar') return renderCalendar();
  if (ui.view === 'matrix') return renderMatrix();
  if (ui.view === 'report') return renderReport();
  const list = currentTasks();
  // Pending: all / on me / with others. Closed: the Review switch (report / closed).
  const subBar = ui.view === 'pending' ? pendingSubBar() : ui.view === 'closed' ? reviewSubBar() : '';
  // Pending › All: tasks that haven't started yet sit at the bottom, faded, so a folder
  // never looks empty while it still has work coming.
  const later = ui.view === 'pending' && ui.pendingSub === 'all' && !ui.search.trim()
    ? data.tasks.filter((x) => inScope(x) && statusOf(x) === 'scheduled' && (!ui.person || isPendingWith(x, ui.person))).sort((a, b) => a.start.localeCompare(b.start))
    : [];
  const laterHtml = later.length ? `<div class="group-title later-title">${icon('calendar')} ${t('later')} · ${later.length}</div><div class="later-rows">${later.map(rowHtml).join('')}</div>` : '';
  if (!list.length) { $('list').innerHTML = subBar + (laterHtml || `<div class="empty">${t('emptyList')}</div>`); return; }
  // Today: overdue first, then due today, then starred ones that aren't due yet.
  if (ui.view === 'today') {
    const sec = (title, cls, xs) => (xs.length ? `<div class="group-title ${cls}">${title} · ${xs.length}</div>${xs.map(rowHtml).join('')}` : '');
    $('list').innerHTML = sec(t('overdue'), 'danger', list.filter((x) => statusOf(x) === 'overdue')) +
      sec(t('stDueToday'), '', list.filter((x) => statusOf(x) === 'today')) +
      sec(t('starred'), '', list.filter((x) => !['overdue', 'today'].includes(statusOf(x))));
    return;
  }
  // "With others" with no person picked: group by person, for follow-up rounds.
  if (ui.view === 'pending' && ui.pendingSub === 'others' && !ui.person) {
    const groups = new Map();
    for (const x of list) for (const pw of pendingOf(x)) {
      if (!groups.has(pw.personId)) groups.set(pw.personId, []);
      groups.get(pw.personId).push(x);
    }
    $('list').innerHTML = [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([pid, xs]) => `<div class="group-title" data-person-group="${pid}">${icon('user')} <b dir="auto">${esc(personById(pid).name)}</b> · ${xs.length}</div>${xs.map(rowHtml).join('')}`)
      .join('');
    $('list').innerHTML = subBar + $('list').innerHTML;
    return;
  }
  $('list').innerHTML = subBar + list.map(rowHtml).join('') + laterHtml;
}

function pendingSubBar() {
  const mineAll = data.tasks.filter((x) => inScope(x) && (!ui.person || isPendingWith(x, ui.person)));
  const open = mineAll.filter(isActive);
  const n = { all: open.length, mine: open.filter((x) => !pendingOf(x).length).length, others: open.filter((x) => pendingOf(x).length).length,
    later: mineAll.filter((x) => statusOf(x) === 'scheduled').length };
  const b = (k, label) => `<button class="${ui.pendingSub === k ? 'on' : ''}" data-psub="${k}">${label} <span class="n">${n[k]}</span></button>`;
  return `<div class="sub-bar"><span class="seg-joined">${b('all', t('all'))}${b('mine', t('mine'))}${b('others', t('withOthers'))}</span>
    ${n.later || ui.pendingSub === 'later' ? `<span class="seg-joined later">${b('later', `${icon('calendar')} ${t('later')}`)}</span>` : ''}</div>
    ${ui.pendingSub === 'later' ? `<p class="small muted sub-hint">${t('scheduledHint')}</p>` : ''}`;
}

function renderCalendar() {
  const base = ui.calMonth || todayStr().slice(0, 7);
  const [y, m] = base.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const loc = lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  // Week starts Saturday in Arabic, Monday in English.
  const weekStart = lang() === 'ar' ? 6 : 1;
  const offset = (first.getDay() - weekStart + 7) % 7;
  const startDate = new Date(y, m - 1, 1 - offset);
  const gridFrom = todayStr(startDate);
  const gridTo = todayStr(new Date(y, m - 1, 1 - offset + 41));
  const monthName = first.toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  const dows = [...Array(7)].map((_, i) => new Date(2024, 0, 7 + ((weekStart + i) % 7)).toLocaleDateString(loc, { weekday: 'short' }));

  // What to show (remembered): open / closed / all, which priority boxes, upcoming repeats.
  const f = calFilter();
  const prioOk = (x) => !f.prios.length || f.prios.includes(x.priority || 'none');
  const statusOk = (x) => f.status === 'all' || (f.status === 'open' ? !x.closure : !!x.closure);
  const byDay = {};
  const put = (d, item) => (byDay[d] = byDay[d] || []).push(item);
  for (const x of data.tasks) {
    if (!inScope(x) || !prioOk(x) || (ui.person && !isPendingWith(x, ui.person))) continue;
    const d = x.closure || x.due;
    if (d && statusOk(x)) put(d, { x });
    // Future occurrences of a repeating task, shown faded.
    if (f.repeats && f.status !== 'closed' && !x.closure && x.repeat && x.due) {
      let n = x.due;
      for (let k = 0; k < 60; k++) {
        n = shiftDate(n, x.repeat.every || 1, x.repeat.unit);
        if (n > gridTo) break;
        if (n >= gridFrom) put(n, { x, ghost: true });
      }
    }
  }
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate); d.setDate(startDate.getDate() + i);
    const ds = todayStr(d);
    const evs = (byDay[ds] || []).sort((a, b) => !!a.ghost - !!b.ghost || byPriorityThenDue(a.x, b.x)).map(({ x, ghost }) =>
      `<span class="ev ${ghost ? 'ghost' : statusOf(x)} ${quadClass(x)}" data-task="${x.id}" ${x.closure || ghost ? '' : 'draggable="true"'}
        title="${esc(x.title)}${ghost ? ' · ' + esc(repeatLabel(x.repeat, x.due)) : ''}" dir="auto">${ghost || x.repeat ? icon('repeat') : ''}${x.remindAt && !x.closure && !ghost ? icon('bell') : ''}${esc(x.title)}</span>`).join('');
    cells += `<div class="cal-cell ${d.getMonth() !== m - 1 ? 'other' : ''} ${ds === todayStr() ? 'is-today' : ''}" data-date="${ds}">
      <div class="cal-top"><span class="n">${d.getDate()}</span><button class="cal-add" data-add-date="${ds}" title="${t('addOnDay')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg></button></div>${evs}</div>`;
  }
  const chip = (group, val, label, on) => `<button class="chip-f ${on ? 'on' : ''} ${group === 'prio' ? val : ''}" data-cf="${group}" data-cv="${val}">${label}</button>`;
  $('list').innerHTML = `<div class="cal">
    <div class="cal-head">
      <div class="cal-nav">
        <button class="cal-arrow" data-cal="-1" title="${t('prev')}">${icon('chevron')}</button>
        <b class="cal-month">${monthName}</b>
        <button class="cal-arrow next" data-cal="1" title="${t('next')}">${icon('chevron')}</button>
      </div>
      ${ui.calMonth && ui.calMonth !== todayStr().slice(0, 7) ? `<button class="cal-today" data-cal="0">${t('today')}</button>` : ''}
    </div>
    <div class="cal-filters">
      <div class="cf-group"><span class="cf-label">${t('show')}</span>
        <span class="seg-joined">${chip('status', 'open', t('openTasks'), f.status === 'open')}${chip('status', 'closed', t('closed'), f.status === 'closed')}${chip('status', 'all', t('all'), f.status === 'all')}</span></div>
      <div class="cf-group"><span class="cf-label">${t('prioFilter')}</span>
        <span class="seg-f nums">${QUADS.map((q) => chip('prio', q, PRIO_NUM[q], f.prios.includes(q)).replace('<button', `<button title="${PRIO_NUM[q]} · ${esc(t(q))}"`)).join('')}${chip('prio', 'none', '—', f.prios.includes('none')).replace('<button', `<button title="${esc(t('unclassified'))}"`)}</span></div>
      <div class="cf-group cf-end">${chip('repeats', '1', `${icon('repeat')} ${t('upcomingRepeats')}`, f.repeats)}</div>
    </div>
    <div class="cal-grid">${dows.map((d) => `<div class="cal-dow">${d}</div>`).join('')}${cells}</div>
    <p class="small muted">${t('calHint')}</p></div>`;
}

function calFilter() {
  const f = data.settings.calFilter || {};
  return { status: f.status || 'open', prios: Array.isArray(f.prios) ? f.prios : [], repeats: f.repeats !== false };
}

function setCalFilter(group, val) {
  const f = calFilter();
  if (group === 'status') f.status = val;
  if (group === 'prio') f.prios = f.prios.includes(val) ? f.prios.filter((p) => p !== val) : [...f.prios, val];
  if (group === 'repeats') f.repeats = !f.repeats;
  data.settings.calFilter = f;
  save(); renderList();
}

// Eisenhower matrix: Y = importance (top = important), X = urgency (first column = urgent).
function renderMatrix() {
  const list = currentTasks();
  const card = (x) => {
    const s = statusOf(x);
    const due = x.due ? `<span class="${s === 'overdue' ? 'od' : ''}">${fmtDate(x.due, lang())}</span>` : '';
    const ppl = peopleNames(x).map((n) => `<span dir="auto">${icon('user')} ${esc(n)}</span>`).join('');
    const subs = x.subtasks || [];
    return `<div class="mx-card ${ui.selected === x.id ? 'sel' : ''}" data-task="${x.id}" draggable="true">
      <div dir="auto">${x.starred ? '<span class="star">★</span> ' : ''}${esc(x.title)}</div>
      <div class="m">${due}${subs.length ? `<span>${subs.filter((y) => y.done).length}/${subs.length}</span>` : ''}${ppl}${ui.scope === x.areaId ? '' : `<span>${esc(areaLabel(x.areaId))}</span>`}</div></div>`;
  };
  const quad = (q) => {
    const xs = list.filter((x) => x.priority === q);
    return `<div class="quad ${q}" data-quad="${q}" dir="${lang() === 'ar' ? 'rtl' : 'ltr'}">
      <div class="q-head"><b>${t(q + 'a')}</b><span>${PRIO_NUM[q]} · ${t(q)}</span><i class="q-n">${xs.length}</i></div>
      <div class="q-body">${xs.map(card).join('') || `<div class="q-empty">${t(q + 'tip')}</div>`}</div></div>`;
  };
  const none = list.filter((x) => !QUADS.includes(x.priority));
  // Drawn like a chart (left to right in both languages): the further right, the more urgent;
  // the higher, the more important. So "not urgent" sits next to the origin.
  $('list').innerHTML = `<div class="mx-chart" dir="ltr">
      <div class="mx-ylab"><i>↑</i><span>${t('importance')}</span></div>
      <div class="mx-yticks"><span>${t('important')}</span><span>${t('notImportant')}</span></div>
      <div class="mx-plot">${quad('q2')}${quad('q1')}${quad('q4')}${quad('q3')}</div>
      <span class="mx-origin">0</span>
      <div class="mx-xticks"><span>${t('notUrgent')}</span><span>${t('urgent')}</span></div>
      <div class="mx-xlab"><span>${t('urgency')} →</span></div>
    </div>
    <div class="unclassified ${none.length ? '' : 'is-empty'}" data-quad="none">
      <div class="small muted" style="margin-bottom:6px">${t('unclassified')} · ${none.length}</div>${none.map(card).join('')}
    </div>
    <details class="mx-legend" ${data.settings.mxLegendClosed ? '' : 'open'}>
      <summary>${t('mxHow')}</summary>
      <div class="mx-legend-grid">${QUADS.map((q) => `<div class="lg ${q}"><b>${t(q + 'a')}</b><span class="lg-what">${PRIO_NUM[q]} · ${t(q)}</span><p>${t(q + 'how')}</p></div>`).join('')}</div>
      <p class="small muted">${t('matrixHint')}</p>
    </details>`;
  document.querySelector('.mx-legend').ontoggle = (e) => { data.settings.mxLegendClosed = !e.target.open; save(); };
}

function areaOptions(selected) {
  let h = `<option value="">${t('inbox')}</option>`;
  const add = (a, depth) => {
    h += `<option value="${a.id}" ${selected === a.id ? 'selected' : ''}>${'&nbsp;&nbsp;&nbsp;'.repeat(depth)}${esc(depth ? areaLabel(a.id) : a.name)}</option>`;
    childrenOf(a.id).forEach((c) => add(c, depth + 1));
  };
  topAreas().forEach((a) => add(a, 0));
  return h;
}

function renderDetail() {
  const x = ui.selected && taskById(ui.selected);
  const el = $('detail');
  const work = document.querySelector('.work');
  // No task open → the page slides shut so the list / calendar / matrix gets the full width.
  if (!x) {
    ui.selected = null;
    work.classList.remove('has-detail');
    clearTimeout(renderDetail.clearTimer);
    // Keep the content visible while it slides away, then empty it.
    renderDetail.clearTimer = setTimeout(() => { if (!ui.selected) { el.innerHTML = ''; renderDetail.shown = null; } }, 300);
    return;
  }
  clearTimeout(renderDetail.clearTimer);
  const wasOpen = work.classList.contains('has-detail');
  // Switching from one task to another while open: cross-fade the content.
  const swap = wasOpen && renderDetail.shown && renderDetail.shown !== x.id;
  renderDetail.shown = x.id;
  work.classList.add('has-detail');
  const subs = x.subtasks || [];
  const span = statusOf(x) === 'scheduled' ? '' : x.start ? (x.closure ? `${t('tookDays')} ${daysWord(daysBetween(x.start, x.closure), lang())}` : `${t('openedFor')} ${daysWord(Math.max(0, daysBetween(x.start, todayStr())), lang())}`) : '';
  el.innerHTML = `<div class="inner">
    <div class="d-top">
      ${statusPill(x)} <span class="small muted">${span}${x.focusMs >= 60000 ? ` · ⏱ ${focusTimeLabel(focusMinsOf(x))}` : ''}</span>
      <span class="spacer"></span>
      <div class="d-acts">
        ${x.closure ? '' : data.focus && data.focus.taskId === x.id && data.focus.mode === 'work' ? `<button class="focus-btn on" data-focus="${x.id}">◉ ${t('fWorkingOn')}…</button>` : `<button class="focus-btn" data-focus="${x.id}" title="${t('fStartTip')}">▶ ${t('fStart')}</button>`}
        ${x.closure ? `<button id="dReopen">${t('reopen')}</button>` : `<button class="primary" id="dClose">✓ ${t('closeToday')}</button>`}
        <button class="d-act ${x.starred ? 'on' : ''}" id="dStar" title="${t('star')}">${x.starred ? '★' : '☆'}</button>
        <button class="d-act del" id="dDelete" title="${t('del')}">${icon('trash')}</button>
        <button class="d-act" id="dHide" title="${t('closeBtn')} (Esc)">✕</button>
      </div>
    </div>
    <textarea class="d-title" id="dTitle" dir="auto" rows="1" placeholder="${t('title')}">${esc(x.title)}</textarea>
    ${x.pinnedNote ? `<div class="pinned-note"><span>📌</span><span dir="auto">${linkify(x.pinnedNote)}</span><button class="icon" id="dUnpin" title="${t('done')}">✓</button></div>` : ''}
    <div class="d-grid">
      <div class="d-field"><label>${icon('today')} ${t('start')}</label><input type="date" id="dStart" value="${x.start || ''}"></div>
      <div class="d-field"><label>${icon('calendar')} ${t('due')}</label><input type="date" id="dDue" value="${x.due || ''}"></div>
      <div class="d-field"><label>${icon('pending')} ${t('dueTimeShort')}</label>${timeBox('dDueTime', x.dueTime, `title="${t('dueTime')}"`)}</div>
      ${x.closure ? `<div class="d-field"><label>${icon('closed')} ${t('closure')}</label><input type="date" id="dClosure" value="${x.closure}"></div>` : ''}
    </div>
    ${reminderFieldHtml(x)}
    <div class="d-row">
      <div class="d-field grow"><label>${icon('folder')} ${t('area')}</label><select id="dArea">${areaOptions(x.areaId)}</select></div>
      <div class="d-field grow"><label>${icon('repeat')} ${t('repeat')}</label><select id="dRepeat">${repeatOptions(x.repeat, x.due)}</select></div>
    </div>
    <div class="d-field">
      <label>${icon('matrix')} ${t('priority')}${x.priority ? ` · <a href="#" data-prio="">${t('clearPriority')}</a>` : ''}</label>
      ${prioPicker(x.priority, 'data-prio', prioNames(), t('noPrio'))}
    </div>
    <div class="d-field pending-box">
      <label>${icon('user')} ${t('waiting')}</label>
      <div class="chips">
        ${pendingOf(x).map((pw) => {
          const p = personById(pw.personId);
          const days = Math.max(0, daysBetween(pw.since || todayStr(), todayStr()));
          return `<span class="chip ${days >= 7 ? 'old' : ''}">
            <b dir="auto">${esc(p.name)}</b>
            <span class="muted">${t('since')} ${fmtDate(pw.since, lang())} · ${sinceWord(pw.since)}</span>
            <button class="icon" data-follow="${p.id}" title="${t('followUp')}">${icon('waiting')}</button>
            <button class="icon" data-unpend="${p.id}" title="${t('remove')}">✕</button></span>`;
        }).join('')}
        <input type="text" id="dAddPerson" dir="auto" list="peopleList" placeholder="${t('personPh')}" autocomplete="off">
        <datalist id="peopleList">${suggestedPeople(x).map((p) => `<option value="${esc(p.name)}"></option>`).join('')}</datalist>
      </div>
    </div>

    <div class="d-sec"><h3>${icon('list')} ${t('subtasks')} <span class="muted small">${subs.filter((s) => s.done).length}/${subs.length}</span></h3>
      ${subs.map((s) => `<div class="sub ${s.done ? 'done' : ''}">
        <input type="checkbox" data-sub-toggle="${s.id}" ${s.done ? 'checked' : ''}>
        <input type="text" dir="auto" data-sub-title="${s.id}" value="${esc(s.title)}">
        <button class="icon x" data-sub-del="${s.id}">✕</button></div>`).join('')}
      <input type="text" class="add-line" id="dAddSub" dir="auto" placeholder="＋ ${t('addSubtask')}">
    </div>

    ${x.repeat ? `<div class="d-field next-note"><label>${icon('repeat')} ${t('nextNote')}</label>
      <textarea id="dNextNote" dir="auto" rows="2" placeholder="${t('nextNotePh')}">${esc(x.nextNote || '')}</textarea></div>` : ''}
    ${attachmentsHtml(x)}

    ${notesHtml(x)}

    <div class="d-sec"><h3>${icon('log')} ${t('log')}</h3>
      ${timelineHtml(x)}
      <div class="log-add">
        <input type="text" id="dAddLog" dir="auto" placeholder="＋ ${t('addLog')}">
        <div class="log-meta">
          <input type="text" id="dLogPerson" dir="auto" list="allPeopleList" placeholder="${t('logOwner')}" autocomplete="off">
          <input type="date" id="dLogDate" title="${t('logAt')}">${timeBox('dLogTime', '', `title="${t('logAt')}"`)}
          <button class="primary" id="dLogAdd">${t('addBtn')}</button>
        </div>
        <datalist id="allPeopleList">${data.people.map((p) => `<option value="${esc(p.name)}"></option>`).join('')}</datalist>
      </div>
      ${(x.log || []).slice().sort((a, b) => logAt(b).localeCompare(logAt(a))).map((l) => {
        const holders = (l.holders || []).map(personById).filter(Boolean);
        const owner = l.personId && personById(l.personId);
        return `<div class="log-item ${l.handoff ? 'is-handoff' : ''}">
        <span class="ld">${fmtDate(l.date, lang())}${l.at ? `<small>${fmtTime(l.at, lang())}</small>` : ''}</span>
        <span class="lt" dir="auto">${linkify(l.text)}
          ${l.handoff ? `<span class="pill handoff">→ ${holders.length ? holders.map((p) => esc(p.name)).join('، ') : t('me')}</span>` : ''}
          ${owner && !l.handoff ? `<span class="pill person">${icon('user')} ${esc(owner.name)}</span>` : ''}</span>
        <button class="icon x" data-log-del="${l.id}">✕</button></div>`;
      }).join('')}
    </div>
  </div>`;
  fitTitle();
  if (swap) { el.scrollTop = 0; animateIn(el.firstElementChild); }
}

// The title wraps onto more lines instead of running out of the box.
function fitTitle() {
  const el = $('dTitle'); if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}
if (window.ResizeObserver) new ResizeObserver(() => fitTitle()).observe(document.getElementById('detail'));

// Reminder: one dropdown (none / before due with the exact time / a specific time).
// The date-time box only appears for "specific time", so the dropdown never contradicts it.
function reminderFieldHtml(x) {
  const custom = !!x.remindAt && x.remindBefore == null;
  const hint = !x.due ? t('remindNeedsDue') : x.remindBefore != null && !x.dueTime ? t('remindAt9') : '';
  return `<div class="d-field remind-field">
    <label>${icon('bell')} ${t('reminder')}${x.remindAt && isOpen(x) ? ` <span class="remind-when ${x.remindAt <= nowLocal() ? 'past' : ''}">${remindWhen(x.remindAt)}</span>` : ''}</label>
    <div class="remind-row">
      <select id="dRemindSel">${remindBeforeOptions(x.remindBefore ?? null, x.due, x.dueTime, custom)}</select>
      ${custom ? `<div class="dt-pair"><input type="date" id="dRemindDate" value="${(x.remindAt || '').slice(0, 10)}">${timeBox('dRemindTime', (x.remindAt || '').slice(11, 16))}</div>` : ''}
    </div>
    <div class="remind-quick"><button data-remind="1h">${t('in1h')}</button><button data-remind="tom9">${t('tomorrow9')}</button></div>
    ${hint ? `<div class="small muted remind-hint">${hint}</div>` : ''}
  </div>`;
}

// Restart the shared slide-in animation on an element (tab, area or task swaps).
function animateIn(el) {
  if (!el) return;
  el.classList.remove('fade-in');
  void el.offsetWidth;
  el.classList.add('fade-in');
}

function refresh() { renderTabs(); renderSidebar(); renderList(); renderDetail(); }

// ---------------- resizable columns ----------------
function applyLayout() {
  const l = data.settings.layout || {};
  if (l.sideW) document.documentElement.style.setProperty('--side-w', l.sideW + 'px');
  if (l.detailW) document.documentElement.style.setProperty('--detail-w', l.detailW + 'px');
}

function bindSplitters() {
  applyLayout();
  const VARS = { sideW: '--side-w', detailW: '--detail-w' };
  // fromEnd: the task page grows from the far edge, so its width is measured from that side.
  const drag = (handle, pane, key, min, maxFn, fromEnd) => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const rect = pane.getBoundingClientRect();
      const rtl = document.documentElement.dir === 'rtl';
      handle.classList.add('active');
      document.body.classList.add('resizing');
      const move = (ev) => {
        // Width is measured from the pane's starting edge (left in English, right in Arabic).
        const fromLeft = rtl === !!fromEnd;
        const w = fromLeft ? ev.clientX - rect.left : rect.right - ev.clientX;
        const clamped = Math.round(Math.max(min, Math.min(maxFn(), w)));
        document.documentElement.style.setProperty(VARS[key], clamped + 'px');
        data.settings.layout = { ...(data.settings.layout || {}), [key]: clamped };
      };
      const up = () => {
        handle.classList.remove('active');
        document.body.classList.remove('resizing');
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        save();
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
    // Double-click resets to the default width.
    handle.addEventListener('dblclick', () => {
      document.documentElement.style.removeProperty(VARS[key]);
      const l = { ...(data.settings.layout || {}) }; delete l[key]; data.settings.layout = l; save();
    });
  };
  drag($('sideSplit'), document.querySelector('.sidebar'), 'sideW', 170, () => 420);
  drag($('listSplit'), document.querySelector('.detail'), 'detailW', 340, () => document.querySelector('.work').clientWidth - 280, true);
}
function refreshLists() { renderTabs(); renderSidebar(); renderList(); }

// ---------------- actions ----------------
function select(id) { ui.selected = id; renderList(); renderDetail(); }

function setClosed(x, closed) {
  const snap = snapshot();
  x.closure = closed ? todayStr() : null;
  let next = null;
  if (closed) next = spawnNext(x); // repeating task → the next one is created
  touch(x);
  if (closed) offerUndo(next ? `${t('closedMsg')} · ${t('nextOn')} ${fmtDate(next.due, lang())}` : `${t('closedMsg')}: ${x.title}`, snap);
}

function addTask(title, opts = {}) {
  const x = {
    id: uid(), areaId: opts.areaId ?? null, title, start: todayStr(), due: opts.due || null, dueTime: opts.dueTime || null, closure: null,
    priority: opts.priority || null,
    repeat: opts.repeat || null, remindBefore: opts.remindBefore ?? null,
    starred: false, notes: '', subtasks: [], log: [], created: Date.now(), updated: Date.now(),
    // Adding while filtered by a person = the new task is pending with them.
    pendingWith: ui.person ? [{ personId: ui.person, since: todayStr() }] : []
  };
  // Full mode of the add card: start date, notes, subtasks and who it's with.
  if (opts.start) x.start = opts.start;
  if (opts.notes) { x.notes = opts.notes; x.pages = [{ id: uid(), title: '', html: textToNoteHtml(opts.notes) }]; }
  if (opts.subtasks) x.subtasks = opts.subtasks.map((s) => ({ id: uid(), title: s, done: false }));
  if (opts.person) {
    const p = findOrCreatePerson(opts.person, x.areaId);
    if (p && !isPendingWith(x, p.id)) { x.pendingWith.push({ personId: p.id, since: todayStr() }); recordHandoff(x, `${t('nowWith')} ${p.name}`); }
  }
  syncReminder(x);
  data.tasks.push(x);
  save();
  refreshLists();
  const row = document.querySelector(`.task-row[data-task="${x.id}"], .mx-card[data-task="${x.id}"]`);
  if (row) { row.classList.add('just-added'); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  // Not visible in this tab/area? Say where it went, with a link to open it.
  else showToast(`${t('added')}: ${x.title}`, () => { ui.scope = 'all'; ui.view = 'pending'; ui.selected = x.id; refresh(); });
  return x;
}

// ---------------- quick-add card (floating + button) ----------------
// Defaults follow where you are: current area, today's date on Today/Overdue tabs, the matrix box you're in.
const composer = { title: '', areaId: null, due: null, priority: null };

function openComposer(preset = {}) {
  composer.title = '';
  composer.areaId = ui.scope === 'all' || ui.scope === 'inbox' ? null : ui.scope;
  composer.due = preset.due || (ui.view === 'today' ? todayStr() : null);
  composer.priority = null;
  composer.repeat = '';
  composer.remindBefore = '';
  composer.dueTime = null;
  composer.start = null; composer.notes = ''; composer.subs = ''; composer.person = '';
  renderComposer();
  $('composer').classList.add('open');
  $('fab').classList.add('open');
  setTimeout(() => $('cTitle')?.focus(), 30);
}

function closeComposer() {
  $('composer').classList.remove('open');
  $('fab').classList.remove('open');
}

// Quick: title, folder, dates, repeat, reminder, priority. Full: also start, notes, subtasks
// and who it's with, for when you want to write the details as you add it. Remembered.
function renderComposer() {
  const full = !!data.settings.composerFull;
  $('composer').classList.toggle('full', full);
  $('composer').innerHTML = `
    <div class="c-top"><span class="c-name">${icon('note')} ${t('newTask')}</span>
      <span class="seg-joined c-mode"><button class="${full ? '' : 'on'}" data-cmode="quick">${t('quickMode')}</button><button class="${full ? 'on' : ''}" data-cmode="full">${t('fullMode')}</button></span></div>
    <input type="text" class="c-title" id="cTitle" dir="auto" placeholder="${t('newTask')}…" value="${esc(composer.title)}" autocomplete="off">
    <div class="err" id="cErr">${t('titleRequired')}</div>
    <div class="c-sec"><span class="c-sec-lbl">${icon('folder')} ${t('area')}</span>
      <select id="cArea" title="${t('area')}">${areaOptions(composer.areaId)}</select></div>
    <div class="c-sec"><span class="c-sec-lbl">${icon('calendar')} ${t('due')}</span>
      <div class="c-row"><input type="date" id="cDue" title="${t('due')}" value="${composer.due || ''}">${timeBox('cDueTime', composer.dueTime, `title="${t('dueTime')}"`)}</div>
      <div class="c-row"><select id="cRepeat" title="${t('repeat')}">${repeatOptions(composer.repeat ? parseRepeat(composer.repeat) : null, composer.due)}</select>
        <select id="cRemind" title="${composer.due ? t('reminder') : t('remindNeedsDue')}" ${composer.due ? '' : 'disabled'}>${composerRemindOptions()}</select></div></div>
    <div class="c-sec"><span class="c-sec-lbl">${icon('matrix')} ${t('priority')}</span>
      ${prioPicker(composer.priority, 'data-cprio', prioNames(), t('noPrio'))}</div>
    ${full ? `<div class="c-full">
      <div class="c-row"><label class="c-lbl"><span>${icon('today')} ${t('start')}</span><input type="date" id="cStart" value="${composer.start || todayStr()}"></label>
        <label class="c-lbl"><span>${icon('user')} ${t('waiting')}</span><input type="text" id="cPerson" dir="auto" list="cPeople" value="${esc(composer.person)}" placeholder="${t('noOne')}" autocomplete="off"></label>
        <datalist id="cPeople">${data.people.map((p) => `<option value="${esc(p.name)}"></option>`).join('')}</datalist></div>
      <label class="c-lbl"><span>${icon('list')} ${t('subtasks')}</span><textarea id="cSubs" dir="auto" rows="3" placeholder="${t('subsPh')}">${esc(composer.subs)}</textarea></label>
      <label class="c-lbl"><span>${icon('note')} ${t('notes')}</span><textarea id="cNotes" dir="auto" rows="4" placeholder="${t('notesPh')}">${esc(composer.notes)}</textarea></label>
    </div>` : ''}
    <div class="c-foot"><span class="hint">${full ? t('composerHintFull') : t('composerHint')}</span><button class="primary" id="cAdd">${t('addBtn')}</button></div>`;
}

const composerRemindOptions = () =>
  remindBeforeOptions(composer.remindBefore === '' ? null : Number(composer.remindBefore), composer.due, composer.dueTime);

// Date or time changed: the reminder choices show new times (and switch off with no date).
function refreshComposerRemind() {
  if (!composer.due) composer.remindBefore = '';
  const sel = $('cRemind');
  sel.innerHTML = composerRemindOptions();
  sel.disabled = !composer.due;
  sel.title = composer.due ? t('reminder') : t('remindNeedsDue');
}

function submitComposer() {
  const title = $('cTitle').value.trim();
  if (!title) { $('cErr').classList.add('show'); $('cTitle').focus(); return; }
  const full = !!data.settings.composerFull;
  addTask(title, { areaId: $('cArea').value || null, due: $('cDue').value || null, dueTime: ($('cDue').value && timeValue($('cDueTime'))) || null, priority: composer.priority,
    repeat: parseRepeat($('cRepeat').value), remindBefore: $('cRemind').value === '' ? null : Number($('cRemind').value),
    ...(full ? { start: $('cStart').value || null, person: $('cPerson').value.trim(), notes: $('cNotes').value.trim(),
      subtasks: $('cSubs').value.split('\n').map((s) => s.trim()).filter(Boolean) } : {}) });
  // Stay open for the next one, keeping folder/date/priority — handy for adding a batch.
  composer.title = '';
  $('cTitle').value = '';
  if (full) { composer.notes = composer.subs = composer.person = ''; $('cNotes').value = $('cSubs').value = $('cPerson').value = ''; }
  $('cTitle').focus();
}

function bindComposer() {
  $('fab').onclick = () => ($('composer').classList.contains('open') ? closeComposer() : openComposer());
  const c = $('composer');
  c.onclick = (e) => {
    const p = e.target.closest('[data-cprio]');
    if (p) {
      composer.priority = composer.priority === p.dataset.cprio ? null : p.dataset.cprio;
      syncPrioPicker(p.closest('.pp'), composer.priority);
      return $('cTitle').focus();
    }
    if (e.target.id === 'cAdd') submitComposer();
    const m = e.target.closest('[data-cmode]');
    if (m) {
      data.settings.composerFull = m.dataset.cmode === 'full'; save();
      renderComposer();
      setTimeout(() => $('cTitle').focus(), 20);
    }
  };
  c.oninput = (e) => {
    if (e.target.id === 'cTitle') { composer.title = e.target.value; $('cErr').classList.remove('show'); }
    if (e.target.id === 'cNotes') composer.notes = e.target.value;
    if (e.target.id === 'cSubs') composer.subs = e.target.value;
    if (e.target.id === 'cPerson') composer.person = e.target.value;
  };
  c.onchange = (e) => {
    if (e.target.id === 'cArea') composer.areaId = e.target.value || null;
    if (e.target.id === 'cDue') { composer.due = e.target.value || null; $('cRepeat').innerHTML = repeatOptions(parseRepeat(composer.repeat), composer.due); refreshComposerRemind(); }
    if (e.target.id === 'cDueTime') { composer.dueTime = timeValue(e.target) || null; refreshComposerRemind(); }
    if (e.target.id === 'cRepeat') composer.repeat = e.target.value;
    if (e.target.id === 'cRemind') composer.remindBefore = e.target.value;
    if (e.target.id === 'cStart') composer.start = e.target.value || null;
  };
  // Enter adds; in the notes / subtasks boxes Enter is a new line and Ctrl+Enter adds.
  c.onkeydown = (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return;
    if (e.target.tagName === 'TEXTAREA' && !e.ctrlKey) return;
    e.preventDefault(); submitComposer();
  };
  // Clicking anywhere outside closes it (unless you've typed something).
  document.addEventListener('mousedown', (e) => {
    if (!c.classList.contains('open') || c.contains(e.target) || $('fab').contains(e.target) || e.target.closest?.('.tp-pop, .dp-pop')) return;
    if (!$('cTitle').value.trim()) closeComposer();
  });
}

function showToast(text, onAction, label) {
  const el = $('toast');
  el.innerHTML = `<span dir="auto">${esc(text)}</span>${onAction ? `<button id="toastOpen">${label || t('open')}</button>` : ''}`;
  if (onAction) $('toastOpen').onclick = () => { el.classList.remove('show'); closeComposer(); onAction(); };
  el.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove('show'), onAction ? 6000 : 3000);
}

function addPending(x, name) {
  const p = findOrCreatePerson(name, x.areaId);
  if (!p) return;
  x.pendingWith = pendingOf(x);
  if (!isPendingWith(x, p.id)) {
    x.pendingWith.push({ personId: p.id, since: todayStr() });
    recordHandoff(x, `${t('nowWith')} ${p.name}`);
  }
  touch(x); refresh();
  $('dAddPerson').focus();
}

// ---------------- follow-up log + timeline ----------------
// Sort key for log entries; old entries only had a date.
const logAt = (l) => l.at || (l.date ? l.date + 'T00:00' : '');

// A handoff entry snapshots who holds the task from that moment (empty = back with me).
function recordHandoff(x, text, at = nowLocal()) {
  (x.log = x.log || []).push({ id: uid(), at, date: at.slice(0, 10), text, handoff: true, holders: pendingOf(x).map((pw) => pw.personId) });
}

function addLogEntry(x) {
  const text = $('dAddLog').value.trim();
  const who = $('dLogPerson').value.trim();
  if (!text && !who) return;
  // Empty = now. A time with no date = today; a date with no time = now's time on that day.
  const d = $('dLogDate').value, tm = timeValue($('dLogTime'));
  const at = d || tm ? `${d || todayStr()}T${tm || nowLocal().slice(11)}` : nowLocal();
  if (who) {
    // Entry with an owner = the task moves to that person from this moment.
    const p = findOrCreatePerson(who, x.areaId);
    const latest = (x.log || []).filter((l) => l.handoff).map(logAt).sort().pop() || '';
    if (at >= latest) x.pendingWith = [{ personId: p.id, since: at.slice(0, 10) }];
    (x.log = x.log || []).push({ id: uid(), at, date: at.slice(0, 10), text: text || `${t('nowWith')} ${p.name}`, handoff: true, holders: [p.id], personId: p.id });
  } else {
    (x.log = x.log || []).push({ id: uid(), at, date: at.slice(0, 10), text });
  }
  touch(x); refresh(); $('dAddLog').focus();
}

// Who held the task, when, and for how long — built from handoff entries.
function timelineHtml(x) {
  const hand = (x.log || []).filter((l) => l.handoff).sort((a, b) => logAt(a).localeCompare(logAt(b)));
  if (!hand.length) return '';
  const end = x.closure ? new Date(x.closure + 'T23:59') : new Date();
  const startAt = x.start ? x.start + 'T00:00' : logAt(hand[0]);
  const segs = [];
  if (startAt < logAt(hand[0])) segs.push({ ids: [], from: startAt });
  hand.forEach((l) => segs.push({ ids: (l.holders || []).filter((id) => personById(id)), from: logAt(l) }));
  segs.forEach((sg, i) => { sg.to = i + 1 < segs.length ? segs[i + 1].from : null; sg.ms = (sg.to ? new Date(sg.to) : end) - new Date(sg.from); });
  const live = segs.filter((sg) => sg.ms > 0);
  if (!live.length) return '';
  const longest = live.reduce((a, b) => (b.ms > a.ms ? b : a));
  const name = (sg) => (sg.ids.length ? sg.ids.map((id) => personById(id).name).join('، ') : t('me'));
  const color = (sg) => (sg.ids.length ? `var(--c-${COLORS[[...sg.ids[0]].reduce((h, c) => h + c.charCodeAt(0), 0) % 6]})` : 'var(--c-gray)');
  const when = (at) => `${fmtDate(at.slice(0, 10), lang())} ${fmtTime(at, lang())}`;
  return `<div class="timeline">
    <div class="tl-title">${t('timeline')}</div>
    <div class="tl-bar">${live.map((sg) => `<span style="flex-grow:${sg.ms};background:${color(sg)}" title="${esc(name(sg))} · ${fmtDur(sg.ms, lang())}"></span>`).join('')}</div>
    ${live.map((sg) => `<div class="tl-row ${sg === longest && live.length > 1 ? 'longest' : ''}">
      <span class="dot" style="background:${color(sg)}"></span>
      <b dir="auto">${esc(name(sg))}</b>
      <span class="tl-dur">${fmtDur(sg.ms, lang())}</span>
      <span class="muted small">${when(sg.from)} → ${sg.to ? when(sg.to) : (x.closure ? fmtDate(x.closure, lang()) : t('still'))}</span>
      ${sg === longest && live.length > 1 ? `<span class="pill overdue">${t('longest')}</span>` : ''}
    </div>`).join('')}
  </div>`;
}

// Changing the reminder time re-arms it (the main process notifies once per time).
function setReminder(x, at) {
  x.remindAt = at || null;
  delete x.reminded;
  touch(x);
}

// Putting a task off again and again is the clearest sign of procrastination.
// Every third time, the mouse asks what would help.
function notePostpone(x, before) {
  if (!before || !x.due || x.due <= before || x.closure) return;
  x.postponed = (x.postponed || 0) + 1;
  if (x.postponed % 3 === 0) setTimeout(() => postponeNudge(x), 400);
}
function postponeNudge(x) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg confirm-bg';
  const opt = (k, ico, title, sub) => `<button data-pn="${k}"><span class="pn-ico">${ico}</span><span><b>${title}</b><small>${sub}</small></span></button>`;
  bg.innerHTML = `<div class="modal confirm nudge" role="alertdialog">
    <div class="nudge-mouse">${mouseLogo('nudge-logo')}</div>
    <h3>${t('pnTitle').replace('{n}', timesWord(x.postponed, lang()))}</h3>
    <p class="cf-text"><b dir="auto">${esc(x.title)}</b><br>${t('pnText')}</p>
    <div class="pn-opts">${opt('focus', '▶', t('pnFocus').replace('25', data.settings.focusMins || 25), t('pnFocusSub'))}${opt('split', '✂', t('pnSplit'), t('pnSplitSub'))}${opt('hand', '👤', t('pnHand'), t('pnHandSub'))}${opt('drop', '🗑', t('pnDrop'), t('pnDropSub'))}</div>
    <div class="actions"><span style="flex:1"></span><button data-pn="keep">${t('pnKeep')}</button></div></div>`;
  document.body.appendChild(bg);
  const close = () => { document.removeEventListener('keydown', onKey, true); bg.classList.add('leaving'); setTimeout(() => bg.remove(), 150); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  bg.onclick = (e) => {
    const b = e.target.closest('[data-pn]');
    if (!b && e.target !== bg) return;
    close();
    const k = b && b.dataset.pn;
    if (k === 'focus') startFocus(x.id);
    if (k === 'split' || k === 'hand') {
      ui.selected = x.id; refresh();
      setTimeout(() => { const el = $(k === 'split' ? 'dAddSub' : 'dAddPerson'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus(); } }, 120);
    }
    if (k === 'drop') deleteTask(x);
  };
}

function maybeAutoClose(x) {
  const subs = x.subtasks || [];
  if (x.closure || !subs.length || !subs.every((s) => s.done)) return;
  askConfirm({ title: t('allSubsDone'), ok: t('closeToday') }).then((yes) => { if (yes) { setClosed(x, true); refresh(); } });
}

// ---------------- drag and drop ----------------
function bindDragAndDrop() {
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest && e.target.closest('[data-task][draggable=true]');
    if (!el) return;
    dragTaskId = el.dataset.task;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragTaskId);
    el.classList.add('dragging');
    document.body.classList.add('is-dragging');
  });
  let hoverTimer = null, hoverId = null;
  // Runs on dragend, and also right after a drop: the drop re-renders the list, and a
  // re-rendered source row never fires its own dragend.
  const endDrag = () => {
    if (!dragTaskId && !document.body.classList.contains('is-dragging')) return;
    dragTaskId = null;
    clearTimeout(hoverTimer); hoverId = null;
    // Folders opened only for the drag close again, smoothly.
    const temp = [...dragExpanded];
    dragExpanded.clear();
    for (const id of temp) {
      if (isExpanded(id)) continue;
      document.querySelector(`.kids[data-kids="${id}"]`)?.classList.remove('open');
      document.querySelector(`[data-toggle="${id}"]`)?.classList.remove('open');
    }
    document.body.classList.remove('is-dragging');
    document.querySelectorAll('.dragging, .drop-ok').forEach((el) => el.classList.remove('dragging', 'drop-ok'));
  };
  document.addEventListener('dragend', endDrag);
  const target = (e) => {
    if (!dragTaskId || !e.target.closest) return null;
    const scope = e.target.closest('#scopeNav [data-scope=inbox], #areasNav [data-scope]');
    if (scope) return scope;
    return e.target.closest('.cal-cell[data-date], [data-quad]');
  };
  document.addEventListener('dragover', (e) => {
    const el = target(e);
    document.querySelectorAll('.drop-ok').forEach((d) => d !== el && d.classList.remove('drop-ok'));
    // Hovering a closed folder that has projects opens it after a moment, so you can drop inside.
    const sid = el && el.dataset.scope;
    if (sid !== hoverId) {
      clearTimeout(hoverTimer); hoverId = sid;
      if (sid && childrenOf(sid).length && !isExpanded(sid)) {
        hoverTimer = setTimeout(() => {
          dragExpanded.add(sid);
          document.querySelector(`.kids[data-kids="${sid}"]`)?.classList.add('open');
          document.querySelector(`[data-toggle="${sid}"]`)?.classList.add('open');
        }, 500);
      }
    }
    if (!el) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    el.classList.add('drop-ok');
  });
  document.addEventListener('drop', (e) => {
    const el = target(e);
    const x = dragTaskId && taskById(dragTaskId);
    if (!el || !x) return;
    e.preventDefault();
    if (el.dataset.quad) {
      x.priority = el.dataset.quad === 'none' ? null : el.dataset.quad;
    } else if (el.dataset.date) {
      if (!x.closure) { const before = x.due; x.due = el.dataset.date; notePostpone(x, before); syncReminder(x); }
    } else {
      x.areaId = el.dataset.scope === 'inbox' ? null : el.dataset.scope;
    }
    touch(x);
    refresh();
    // Two frames later, so a folder opened for the drag animates closed instead of snapping.
    requestAnimationFrame(() => requestAnimationFrame(endDrag));
  });
}

// ---------------- modals ----------------
function closeModal() {
  const bg = $('modalRoot').firstElementChild;
  if (!bg) return;
  if (bg.classList.contains('leaving')) return;
  bg.classList.add('leaving');
  setTimeout(() => { if (bg.parentNode) bg.remove(); }, 150);
}

function openAreaModal(area, parentId) {
  const isNew = !area;
  const a = area || { id: uid(), name: '', color: parentId ? areaById(parentId).color : 'blue', parentId: parentId || null };
  let color = a.color;
  const canHaveChildren = !isNew && depthOf(a.id) < MAX_DEPTH;
  $('modalRoot').innerHTML = `<div class="modal-bg" id="mBg"><div class="modal">
    <h3>${isNew ? (parentId ? t('addProject') : t('addArea')) : t('rename')}</h3>
    <div class="row"><input type="text" id="mName" dir="auto" style="flex:1" value="${esc(a.name)}" placeholder="${t('name')}"></div>
    ${a.parentId ? '' : `<div class="row"><label>${t('color')}</label><div class="swatches">${COLORS.map((c) =>
      `<button class="swatch ${c === color ? 'on' : ''}" data-color="${c}" style="background:var(--c-${c})"></button>`).join('')}</div></div>`}
    <div class="actions">
      ${!isNew ? `<button class="danger" id="mDel">${t('del')}</button>` : ''}
      ${canHaveChildren ? `<button id="mAddChild">＋ ${t('addProject')}</button>` : ''}
      <span style="flex:1"></span>
      <button id="mCancel">${t('cancel')}</button><button class="primary" id="mSave">${t('save')}</button>
    </div></div></div>`;
  $('mName').focus();
  $('mBg').onclick = async (e) => {
    if (e.target.id === 'mBg' || e.target.id === 'mCancel') return closeModal();
    if (e.target.dataset.color) {
      color = e.target.dataset.color;
      document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s.dataset.color === color));
    }
    if (e.target.id === 'mSave') {
      a.name = $('mName').value.trim() || a.name || '—';
      a.color = color;
      if (isNew) data.areas.push(a);
      descendantsOf(a.id).forEach((id) => (areaById(id).color = color));
      save(); closeModal();
      if (isNew) ui.scope = a.id;
      refresh();
    }
    if (e.target.id === 'mAddChild') { closeModal(); openAreaModal(null, a.id); }
    if (e.target.id === 'mDel' && await askConfirm({ title: t('confirmDelArea'), text: a.name, ok: t('del'), danger: true })) {
      const ids = [a.id, ...descendantsOf(a.id)];
      data.areas = data.areas.filter((x) => !ids.includes(x.id));
      data.tasks.forEach((x) => { if (ids.includes(x.areaId)) x.areaId = null; });
      if (ids.includes(ui.scope)) ui.scope = 'all';
      save(); closeModal(); refresh();
    }
  };
  $('mName').onkeydown = (e) => { if (e.key === 'Enter') $('mSave').click(); };
}

function openPersonModal(person) {
  const isNew = !person;
  const p = person || { id: uid(), name: '', areaIds: [] };
  const sel = new Set(p.areaIds);
  const open = isNew ? [] : data.tasks.filter((x) => isOpen(x) && isPendingWith(x, p.id));
  const box = (a, depth) => `<label class="${depth ? 'child d' + depth : ''}"><input type="checkbox" data-pa="${a.id}" ${sel.has(a.id) ? 'checked' : ''}>
    ${depth ? '' : `<span class="dot" style="background:${areaColor(a)}"></span>`}<span dir="auto">${esc(a.name)}</span></label>`;
  const tree = (a, depth) => box(a, depth) + childrenOf(a.id).map((c) => tree(c, depth + 1)).join('');
  $('modalRoot').innerHTML = `<div class="modal-bg" id="mBg"><div class="modal">
    <h3>${isNew ? t('addPerson') : t('editPerson')}</h3>
    <div class="row"><input type="text" id="mName" dir="auto" style="flex:1" value="${esc(p.name)}" placeholder="${t('name')}"></div>
    <div class="small muted" style="margin-bottom:6px">${t('linkedTo')}</div>
    <div class="person-areas">${topAreas().map((a) => tree(a, 0)).join('')}</div>
    <p class="small muted">${t('personHint')}</p>
    ${open.length ? `<div class="small muted" style="margin:10px 0 4px">${t('openWith')} (${open.length})</div>
      ${open.slice(0, 6).map((x) => `<div class="small" dir="auto">• ${esc(x.title)}</div>`).join('')}` : ''}
    <div class="actions">
      ${!isNew ? `<button class="danger" id="mDel">${t('del')}</button>` : ''}
      <span style="flex:1"></span>
      <button id="mCancel">${t('cancel')}</button><button class="primary" id="mSave">${t('save')}</button>
    </div></div></div>`;
  $('mName').focus();
  $('mBg').onclick = async (e) => {
    if (e.target.id === 'mBg' || e.target.id === 'mCancel') return closeModal();
    if (e.target.id === 'mSave') {
      const name = $('mName').value.trim();
      if (!name) return $('mName').focus();
      const dup = data.people.find((y) => y.id !== p.id && y.name.toLowerCase() === name.toLowerCase());
      if (dup) { $('mName').style.borderColor = 'var(--danger)'; return; }
      p.name = name;
      p.areaIds = [...document.querySelectorAll('[data-pa]')].filter((c) => c.checked).map((c) => c.dataset.pa);
      if (isNew) data.people.push(p);
      save(); closeModal(); refresh();
    }
    if (e.target.id === 'mDel' && await askConfirm({ title: t('confirmDelPerson'), text: p.name, ok: t('del'), danger: true })) {
      data.people = data.people.filter((y) => y.id !== p.id);
      data.tasks.forEach((x) => { x.pendingWith = (x.pendingWith || []).filter((pw) => pw.personId !== p.id); });
      if (ui.person === p.id) ui.person = null;
      save(); closeModal(); refresh();
    }
  };
  $('mName').onkeydown = (e) => { if (e.key === 'Enter') $('mSave').click(); };
}

// Settings: sections on the side, each option with a one-line explanation of what it does.
async function openSettings(section) {
  const s = data.settings, w = s.widget;
  ui.setSec = section || ui.setSec || 'general';
  const [login, info, displays, folder, backups] = await Promise.all([
    window.api.loginItem(), window.api.appInfo(), window.api.displays(), window.api.dataFolder(), window.api.listBackups()
  ]);
  const filterOpts = [['focus', t('focus')], ['overdue', t('overdue')], ['week', t('hWeek')], ['others', t('hOthers')], ['pending', t('pending')], ['starred', t('starred')]]
    .concat(topAreas().map((a) => ['area:' + a.id, a.name]))
    .concat(data.people.map((p) => ['person:' + p.id, `${t('waiting')}: ${p.name}`]));
  const zoom = Math.round((s.zoom || 1) * 100);
  // One setting: title + what it does on one side, the control on the other.
  const row = (title, desc, control, cls = '') => `<div class="set-row ${cls}"><div class="set-txt"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="set-ctl">${control}</div></div>`;
  const toggle = (id, on) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></label>`;
  const card = (inner) => `<div class="set-card">${inner}</div>`;
  const backupLabel = (b) => b.kind === 'safety'
    ? `🛟 ${t('safetyCopy')} · ${fmtDate(b.date, lang())} ${fmtTime(`${b.date}T${b.time}`, lang())} · ${b.tasks} ${t('tasksWord')}`
    : `${fmtDate(b.date, lang())} · ${b.tasks} ${t('tasksWord')}`;
  const SECTIONS = [
    ['general', 'settings', t('general')], ['notifications', 'bell', t('notifications')], ['widget', 'edgeRight', t('widget')],
    ['data', 'folder', t('dataTitle')], ['updates', 'download', t('updates')], ['about', 'help', t('about')]
  ];
  const sec = (id, title, body) => `<section class="set-sec-body" data-sec="${id}" ${ui.setSec === id ? '' : 'hidden'}><h4>${title}</h4>${body}</section>`;

  $('modalRoot').innerHTML = `<div class="modal-bg" id="mBg"><div class="modal settings2">
    <nav class="set-nav">
      <div class="set-nav-title">${t('settings')}</div>
      ${SECTIONS.map(([id, ico, label]) => `<button class="${ui.setSec === id ? 'on' : ''}" data-setsec="${id}">${icon(ico)}<span>${label}</span></button>`).join('')}
    </nav>
    <div class="set-main">
      ${sec('general', t('general'), card(
        row(t('language'), '', `<div class="seg"><button data-lang="ar" class="${s.lang === 'ar' ? 'on' : ''}">عربي</button><button data-lang="en" class="${s.lang === 'en' ? 'on' : ''}">English</button></div>`) +
        row(t('launch'), t('launchDesc'), toggle('sLogin', login)) +
        row(t('planTitle'), t('planAuto'), toggle('sPlanAuto', s.planAuto !== false)) +
        row(t('theme'), t('themeDesc'), `<div class="seg">${['system', 'light', 'dark'].map((m) => `<button data-theme="${m}" class="${(s.theme || 'system') === m ? 'on' : ''}">${t('theme_' + m)}</button>`).join('')}</div>`) +
        row(t('focusLen'), t('focusLenDesc'), `<div class="seg">${[15, 25, 45, 60].map((m) => `<button data-fmins="${m}" class="${(s.focusMins || 25) === m ? 'on' : ''}">${m}</button>`).join('')}</div>
          <span class="small muted" style="margin-inline:8px 4px">${t('breakLen')}</span><div class="seg">${[5, 10].map((m) => `<button data-bmins="${m}" class="${(s.breakMins || 5) === m ? 'on' : ''}">${m}</button>`).join('')}</div>`) +
        row(`${t('textSize')} <span class="muted" id="sZoomVal">${zoom}%</span>`, t('textSizeDesc'), `<input type="range" id="sZoom" min="80" max="160" step="10" value="${zoom}">`)
      ) + card(`<div class="set-txt"><b>${t('shortcuts')}</b></div>
        <div class="keys">${shortcutList(info.quickKey).map(([k, d]) => `<div><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div>`))}

      ${sec('notifications', t('notifications'), card(
        row(t('morningSummary'), t('summaryDesc'), `${timeBox('sSumTime', s.summary.time)} ${toggle('sSum', s.summary.enabled)}`) +
        row(t('reviewSet'), t('reviewSetDesc'), `${timeBox('sRevTime', (s.review || {}).time || '17:00')} ${toggle('sRev', (s.review || {}).enabled !== false)}`) +
        row(t('nudgeTitle'), t('nudgeAfter'), `<span class="num-days"><input type="number" id="sNudge" min="1" max="30" value="${s.nudgeDays || 3}"> ${t('days')}</span>`)
      ) + card(
        row(t('remindStyle'), t('remindStyleDesc'), `<select id="sRemStyle"><option value="mouse" ${(s.remindStyle || 'mouse') === 'mouse' ? 'selected' : ''}>${t('styleMouse')}</option><option value="notification" ${s.remindStyle === 'notification' ? 'selected' : ''}>${t('styleNotif')}</option></select>`) +
        row(t('remindSound'), '', `<select id="sRemSound">${REMIND_SOUNDS.map((k) => `<option value="${k}" ${(s.remindSound || 'chime') === k ? 'selected' : ''}>${t('sound' + k[0].toUpperCase() + k.slice(1))}</option>`).join('')}</select>
          <button id="sRemTry">▶ ${t('tryIt')}</button>`)
      ))}

      ${sec('widget', t('widget'), card(
        row(t('showWidget'), t('widgetDesc'), toggle('sWidget', w.visible)) +
        row(t('widgetMode'), t('widgetModeDesc'), `<select id="sEdge">
          <option value="off" ${(w.edge || 'off') === 'off' ? 'selected' : ''}>${t('onTop')}</option>
          <option value="right" ${w.edge === 'right' ? 'selected' : ''}>${t('autoHide')} · ${t('edgeRight')}</option>
          <option value="left" ${w.edge === 'left' ? 'selected' : ''}>${t('autoHide')} · ${t('edgeLeft')}</option>
          <option value="top" ${w.edge === 'top' ? 'selected' : ''}>${t('autoHide')} · ${t('edgeTop')}</option></select>`) +
        row(t('openOn'), t('openOnDesc'), `<div class="seg"><button data-openon="hover" class="${(w.openOn || 'hover') === 'hover' ? 'on' : ''}">${t('openHover')}</button><button data-openon="click" class="${w.openOn === 'click' ? 'on' : ''}">${t('openClick')}</button></div>`) +
        row(t('widgetShows'), t('widgetShowsDesc'), `<select id="sFilter">${filterOpts.map(([v, l]) => `<option value="${v}" ${w.filter === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`) +
        (displays.length > 1 ? row(t('screen'), '', `<select id="sDisplay">${displays.map((d) => `<option value="${d.id}" ${w.display === d.id ? 'selected' : ''}>${d.label}</option>`).join('')}</select>`) : '') +
        row(t('opacity'), '', `<input type="range" id="sOpacity" min="0.4" max="1" step="0.05" value="${w.opacity || 1}">`)
      ))}

      ${sec('data', t('dataTitle'), `
        ${card(`<div class="data-item">
          <span class="di-ico">${icon('folder')}</span>
          <div class="set-txt"><b>${t('dataWhere')}</b><span>${t('syncHint')}</span>
            <div class="path-row"><code dir="ltr" title="${esc(folder)}">${esc(folder)}</code></div></div>
          <div class="set-ctl"><button id="sFolder">${t('changeFolder')}</button></div></div>`)}
        ${card(`<div class="data-item">
          <span class="di-ico ok">${icon('repeat')}</span>
          <div class="set-txt"><b>${t('autoBk')}</b><span>${t('autoBkDesc')}</span>
            <div class="path-row"><select id="sBackup">${backups.map((b) => `<option value="${esc(b.file)}">${esc(backupLabel(b))}</option>`).join('') || `<option>—</option>`}</select>
              <button class="icon-btn" id="sOpenBackups" title="${t('openBackups')}">${icon('folder')}</button></div></div>
          <div class="set-ctl"><button id="sRestore" ${backups.length ? '' : 'disabled'}>${t('restoreBtn')}</button></div></div>`)}
        <div class="set-group-title">${t('manualCopies')}</div>
        ${card(`<div class="data-item">
          <span class="di-ico">${icon('download')}</span>
          <div class="set-txt"><b>${t('saveCopy')}</b><span>${t('saveCopyDesc')}</span></div>
          <div class="set-ctl"><button id="sExport">${t('saveCopyBtn')}</button></div></div>
          <div class="data-item">
          <span class="di-ico warn">${icon('waiting')}</span>
          <div class="set-txt"><b>${t('loadCopy')}</b><span>${t('loadCopyDesc')}</span></div>
          <div class="set-ctl"><button id="sImport">${t('loadCopyBtn')}</button></div></div>`)}
        ${card(`<div class="data-item">
          <span class="di-ico xl">${icon('report')}</span>
          <div class="set-txt"><b>${t('excelTitle')}</b><span>${t('excelDesc')}</span></div>
          <div class="set-ctl"><button id="sCsv">${t('excelBtn')}</button></div></div>`)}`)}

      ${sec('updates', t('updates'), card(
        row(`${t('version')} ${info.version}`, `<span id="sUpd">${updateLine(info.update) || t('updatesDesc')}</span>`,
          info.update?.status === 'ready' ? `<button class="primary" id="sInstall">${t('restartUpdate')}</button>` : `<button id="sCheck" ${info.update?.status === 'dev' ? 'disabled' : ''}>${t('checkNow')}</button>`)
      ))}

      ${sec('about', t('about'), card(`<div class="about-top">${mouseLogo('about-logo')}<div><b>${esc(info.name)}</b> <span class="muted small">${t('version')} ${info.version}</span>
          <div class="small">${t('creditBy')}: <b>${esc(info.credit)}</b></div></div></div>
        <p class="small muted">${t('feedbackHint')}</p>
        <div class="about-btns">
          <button id="sBug">${icon('bug')} ${t('reportBug')}</button>
          <button id="sIdea">${icon('idea')} ${t('suggestIdea')}</button>
          <button id="sIssues">${icon('github')} ${t('seeRequests')}</button>
        </div>`))}
      <div class="set-foot"><button class="primary" id="mCancel">${t('closeBtn')}</button></div>
    </div>
  </div></div>`;

  const setW = (patch) => { data.settings.widget = { ...data.settings.widget, ...patch }; save(); };
  // Load a copy / restore: confirm with what you're about to load, then replace (a safety copy is kept first).
  const loadFrom = async (file, label, tasks) => {
    if (!(await askConfirm({ title: t('confirmLoadTitle'), text: `${label}${tasks != null ? ` · ${tasks} ${t('tasksWord')}` : ''}\n${t('confirmLoadText')}`, ok: t('restoreBtn'), danger: true }))) return;
    await window.api.restoreBackup(file);
    data = await window.api.getData(); ui.selected = null; renderAll();
    showToast(t('restoredMsg'));
    openSettings('data');
  };
  $('mBg').onclick = async (e) => {
    const id = e.target.closest('button')?.id || e.target.id;
    if (id === 'mBg' || id === 'mCancel') return closeModal();
    const nav = e.target.closest('[data-setsec]');
    if (nav) {
      ui.setSec = nav.dataset.setsec;
      document.querySelectorAll('[data-setsec]').forEach((b) => b.classList.toggle('on', b === nav));
      document.querySelectorAll('.set-sec-body').forEach((x) => { x.hidden = x.dataset.sec !== ui.setSec; if (!x.hidden) animateIn(x); });
      return;
    }
    if (e.target.dataset.lang) { data.settings.lang = e.target.dataset.lang; save(); renderAll(); openSettings(); }
    if (e.target.dataset.theme) { data.settings.theme = e.target.dataset.theme; save(); document.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('on', b === e.target)); }
    if (e.target.dataset.fmins) { data.settings.focusMins = Number(e.target.dataset.fmins); save(); document.querySelectorAll('[data-fmins]').forEach((b) => b.classList.toggle('on', b === e.target)); }
    if (e.target.dataset.bmins) { data.settings.breakMins = Number(e.target.dataset.bmins); save(); document.querySelectorAll('[data-bmins]').forEach((b) => b.classList.toggle('on', b === e.target)); }
    if (e.target.dataset.openon) { setW({ openOn: e.target.dataset.openon }); document.querySelectorAll('[data-openon]').forEach((b) => b.classList.toggle('on', b === e.target)); }
    if (id === 'sBug') window.api.openGithub('bug');
    if (id === 'sIdea') window.api.openGithub('idea');
    if (id === 'sIssues') window.api.openGithub('list');
    if (id === 'sExport' && await window.api.exportData()) showToast(t('savedCopyMsg'));
    if (id === 'sCsv' && await window.api.exportCsv(tasksCsv(data.tasks), 'elfar-tasks')) showToast(t('savedCopyMsg'));
    if (id === 'sOpenBackups') window.api.openBackups();
    if (id === 'sRemTry') { if ((data.settings.remindStyle || 'mouse') === 'mouse') window.api.testReminder(); else playSound(data.settings.remindSound || 'chime'); }
    if (id === 'sCheck') { window.api.checkUpdate(); $('sUpd').textContent = t('upChecking'); }
    if (id === 'sInstall') window.api.installUpdate();
    if (id === 'sFolder') {
      const dir = await window.api.chooseDataFolder();
      if (dir) { data = await window.api.getData(); renderAll(); openSettings('data'); }
    }
    if (id === 'sRestore') {
      const b = backups.find((x) => x.file === $('sBackup').value);
      if (b) loadFrom(b.file, backupLabel(b).replace(/ · \d+ .*$/, ''), b.tasks);
    }
    if (id === 'sImport') {
      const f = await window.api.pickCopy();
      if (f && f.error) return askConfirm({ title: t('badCopy'), text: f.name, ok: t('ok') });
      if (f) loadFrom(f.file, f.name, f.tasks);
    }
  };
  $('sLogin').onchange = (e) => window.api.loginItem(e.target.checked);
  $('sPlanAuto').onchange = (e) => { data.settings.planAuto = e.target.checked; save(); };
  $('sZoom').oninput = (e) => { $('sZoomVal').textContent = e.target.value + '%'; };
  $('sZoom').onchange = (e) => { data.settings.zoom = Number(e.target.value) / 100; save(); };
  $('sRev').onchange = (e) => { data.settings.review = { time: '17:00', ...(data.settings.review || {}), enabled: e.target.checked }; save(); };
  $('sRevTime').onchange = (e) => { if (timeValue(e.target)) { data.settings.review = { enabled: true, ...(data.settings.review || {}), time: timeValue(e.target) }; save(); } };
  $('sSum').onchange = (e) => { data.settings.summary = { ...data.settings.summary, enabled: e.target.checked }; save(); };
  $('sSumTime').onchange = (e) => { if (timeValue(e.target)) { data.settings.summary = { ...data.settings.summary, time: timeValue(e.target) }; save(); } };
  $('sRemStyle').onchange = (e) => { data.settings.remindStyle = e.target.value; save(); };
  $('sRemSound').onchange = (e) => { data.settings.remindSound = e.target.value; save(); playSound(e.target.value); };
  $('sNudge').onchange = (e) => { data.settings.nudgeDays = Math.max(1, Math.min(30, Number(e.target.value) || 3)); save(); };
  $('sWidget').onchange = (e) => setW({ visible: e.target.checked });
  $('sEdge').onchange = (e) => setW(e.target.value === 'off' ? { edge: 'off' } : { edge: e.target.value, lastEdge: e.target.value, edgeOffset: null, visible: true });
  if ($('sDisplay')) $('sDisplay').onchange = (e) => setW({ display: Number(e.target.value) });
  $('sOpacity').oninput = (e) => setW({ opacity: Number(e.target.value) });
  $('sFilter').onchange = (e) => setW({ filter: e.target.value });
}

// The keyboard shortcuts, shown as a list in Settings › General.
function shortcutList(quickKey) {
  const ar = lang() === 'ar';
  return [
    ['Ctrl+N', ar ? 'تاسك جديد' : 'New task'],
    [quickKey || 'Ctrl+Shift+Space', ar ? 'إضافة من أي برنامج' : 'Add from any app'],
    ['Ctrl+K', ar ? 'بحث في كل حاجة' : 'Search everything'],
    ['↑ ↓', ar ? 'تنقل بين التاسكات' : 'Move between tasks'],
    ['Space', ar ? 'قفل التاسك' : 'Close the task'],
    ['1 – 4', ar ? 'التصنيف' : 'Priority'],
    ['S', ar ? 'تمييز' : 'Star'],
    ['Delete', ar ? 'حذف' : 'Delete'],
    ['Ctrl + / −', ar ? 'حجم الخط' : 'Text size']
  ];
}

// ---------------- events ----------------
function bind() {
  $('tabs').onclick = (e) => {
    const v = e.target.closest('[data-view]'); if (!v) return;
    // Moving to another tab closes the open task page.
    if (ui.view === v.dataset.view) return;
    ui.view = v.dataset.view; ui.selected = null; refresh(); animateIn($('list'));
  };
  // Open/close a folder in place (no re-render) so it animates.
  const setFolder = (id, open) => {
    const s = new Set(data.settings.expanded || []);
    open ? s.add(id) : s.delete(id);
    data.settings.expanded = [...s];
    save();
    document.querySelector(`[data-toggle="${id}"]`)?.classList.toggle('open', open);
    document.querySelector(`.kids[data-kids="${id}"]`)?.classList.toggle('open', open);
  };
  const pickScope = (e) => {
    const tg = e.target.closest('[data-toggle]');
    if (tg) { e.stopPropagation(); return setFolder(tg.dataset.toggle, !isExpanded(tg.dataset.toggle)); }
    const ed = e.target.closest('[data-edit-area]');
    if (ed) { e.stopPropagation(); return openAreaModal(areaById(ed.dataset.editArea)); }
    const s = e.target.closest('[data-scope]'); if (!s) return;
    const id = s.dataset.scope;
    const changed = ui.scope !== id;
    // Folder with projects: first click opens it, clicking it again folds it back up.
    if (childrenOf(id).length) setFolder(id, changed ? true : !isExpanded(id));
    // Picking a subfolder keeps the folders above it open.
    for (const p of ancestorsOf(id)) if (!(data.settings.expanded || []).includes(p)) setFolder(p, true);
    if (!changed) return;
    ui.scope = id; ui.selected = null;
    document.querySelectorAll('#scopeNav [data-scope], #areasNav [data-scope]').forEach((n) => n.classList.toggle('active', n.dataset.scope === id));
    renderTabs(); renderList(); renderDetail();
    animateIn($('list'));
  };
  $('scopeNav').onclick = pickScope;
  $('areasNav').onclick = pickScope;
  $('addAreaBtn').onclick = () => openAreaModal(null);
  $('addPersonBtn').onclick = () => openPersonModal(null);
  $('peopleNav').onclick = (e) => {
    const ed = e.target.closest('[data-edit-person]');
    if (ed) { e.stopPropagation(); return openPersonModal(personById(ed.dataset.editPerson)); }
    const p = e.target.closest('[data-person]'); if (!p) return;
    // Click a person = show what's pending with them; click again to clear.
    if (ui.person === p.dataset.person) ui.person = null;
    else { ui.person = p.dataset.person; ui.view = 'pending'; ui.pendingSub = 'others'; }
    ui.selected = null;
    return refresh();
    refreshLists();
  };
  $('personFilter').onchange = (e) => { ui.person = e.target.value || null; refreshLists(); };
  $('settingsBtn').onclick = openSettings;
  $('langBtn').onclick = () => { data.settings.lang = lang() === 'ar' ? 'en' : 'ar'; save(); renderAll(); };
  $('search').oninput = (e) => { ui.search = e.target.value; renderList(); };
  // The sort you pick is remembered.
  $('sort').onchange = (e) => { ui.sort = data.settings.sort = e.target.value; save(); renderList(); };
  bindComposer();

  $('list').onclick = (e) => {
    const cal = e.target.closest('[data-cal]');
    if (cal) {
      const [y, m] = (ui.calMonth || todayStr().slice(0, 7)).split('-').map(Number);
      ui.calMonth = cal.dataset.cal === '0' ? null : todayStr(new Date(y, m - 1 + Number(cal.dataset.cal), 1)).slice(0, 7);
      return renderList();
    }
    const ps = e.target.closest('[data-psub]');
    if (ps) { ui.pendingSub = ps.dataset.psub; return renderList(); }
    const hv = e.target.closest('[data-go]');
    if (hv) return homeGo(hv.dataset.go);
    const add = e.target.closest('[data-add-date]');
    if (add) return openComposer({ due: add.dataset.addDate });
    const cf = e.target.closest('[data-cf]');
    if (cf) return setCalFilter(cf.dataset.cf, cf.dataset.cv);
    const chk = e.target.closest('[data-check]');
    if (chk) {
      const x = taskById(chk.dataset.check);
      const row = chk.closest('.task-row');
      chk.classList.toggle('on', !x.closure);
      setClosed(x, !x.closure);
      // If the task is about to leave this list, let it slide out first.
      const leaves = row && !currentTasks().some((y) => y.id === x.id);
      if (leaves) row.classList.add('leaving');
      setTimeout(() => { refreshLists(); if (ui.selected === x.id) renderDetail(); }, leaves ? 260 : 0);
      return;
    }
    const row = e.target.closest('[data-task]');
    if (row) select(row.dataset.task);
  };

  const d = $('detail');
  d.onclick = (e) => {
    const x = taskById(ui.selected); if (!x) return;
    const id = e.target.closest('button')?.id;
    if (id === 'dHide') { ui.selected = null; return refresh(); }
    if (id === 'dUnpin') { x.pinnedNote = null; touch(x); return refresh(); }
    if (id === 'dStar') { x.starred = !x.starred; touch(x); return refresh(); }
    if (id === 'dClose') { setClosed(x, true); return refresh(); }
    if (id === 'dReopen') { setClosed(x, false); return refresh(); }
    if (id === 'dDelete') return deleteTask(x);
    if (id === 'dLogAdd') return addLogEntry(x);
    const sd = e.target.closest('[data-sub-del]');
    if (sd) { x.subtasks = x.subtasks.filter((s) => s.id !== sd.dataset.subDel); touch(x); return refresh(); }
    const ld = e.target.closest('[data-log-del]');
    if (ld) {
      // The follow-up log is history, so removing an entry asks first.
      const entry = x.log.find((l) => l.id === ld.dataset.logDel);
      askConfirm({ title: t('confirmDelLog'), text: entry ? `${fmtDate(entry.date, lang())} · ${entry.text}` : '', ok: t('del'), danger: true }).then((yes) => {
        if (!yes) return;
        x.log = x.log.filter((l) => l.id !== ld.dataset.logDel); touch(x); refresh();
      });
      return;
    }
    const rm = e.target.closest('[data-remind]');
    if (rm) {
      e.preventDefault();
      const d = new Date();
      const at9 = (ds) => ds + 'T09:00';
      const shift = (ds, n) => { const z = new Date(ds + 'T00:00'); z.setDate(z.getDate() + n); return todayStr(z); };
      const v = { '1h': nowLocal(new Date(d.getTime() + 3600000)), tom9: at9(shift(todayStr(), 1)),
        'due-1': x.due && at9(shift(x.due, -1)), due9: x.due && at9(x.due), clear: null }[rm.dataset.remind];
      x.remindBefore = null;
      setReminder(x, v);
      return refresh();
    }
    const pr = e.target.closest('[data-prio]');
    if (pr) {
      e.preventDefault();
      // Clicking the selected box again clears it.
      x.priority = pr.dataset.prio && pr.dataset.prio !== x.priority ? pr.dataset.prio : null;
      touch(x); return refresh();
    }
    const up = e.target.closest('[data-unpend]');
    if (up) {
      const gone = personById(up.dataset.unpend);
      x.pendingWith = pendingOf(x).filter((pw) => pw.personId !== up.dataset.unpend);
      recordHandoff(x, pendingOf(x).length ? `${gone.name} ${t('finishedPart')}` : `${gone.name} ${t('finishedPart')} · ${t('backWithMe')}`);
      touch(x); return refresh();
    }
    const fu = e.target.closest('[data-follow]');
    if (fu) {
      (x.log = x.log || []).push({ id: uid(), at: nowLocal(), date: todayStr(), personId: fu.dataset.follow, text: `${t('followedUpWith')} ${personById(fu.dataset.follow).name}` });
      touch(x); return refresh();
    }
  };
  d.oninput = (e) => {
    const x = taskById(ui.selected); if (!x) return;
    const el = e.target;
    if (el.id === 'dAddPerson') {
      // Picking a suggestion from the drop list adds it right away.
      const picked = !e.inputType || e.inputType === 'insertReplacementText';
      if (picked && data.people.some((p) => p.name.toLowerCase() === el.value.trim().toLowerCase())) addPending(x, el.value);
      return;
    }
    if (el.id === 'dTitle') { x.title = el.value.replace(/\s*\n\s*/g, ' '); fitTitle(); }
    else if (el.id === 'dNextNote') x.nextNote = el.value;
    else if (el.dataset.subTitle) x.subtasks.find((s) => s.id === el.dataset.subTitle).title = el.value;
    else return;
    touch(x); refreshLists();
  };
  d.onchange = (e) => {
    const x = taskById(ui.selected); if (!x) return;
    const el = e.target;
    if (el.id === 'dStart') x.start = el.value || null;
    else if (el.id === 'dDue') {
      const before = x.due;
      x.due = el.value || null;
      notePostpone(x, before);
      // No due date left to count back from: keep the reminder as a fixed time.
      if (!x.due) x.remindBefore = null;
      syncReminder(x);
    }
    else if (el.id === 'dClosure') { x.closure = el.value || null; if (x.closure) spawnNext(x); }
    else if (el.id === 'dRemindDate' || el.id === 'dRemindTime') {
      const date = $('dRemindDate').value, time = timeValue($('dRemindTime')) || '09:00';
      x.remindBefore = null;
      setReminder(x, date ? `${date}T${time}` : null);
    }
    else if (el.id === 'dArea') x.areaId = el.value || null;
    else if (el.id === 'dRepeat') { x.repeat = parseRepeat(el.value); delete x.spawned; }
    else if (el.id === 'dDueTime') { x.dueTime = timeValue(el) || null; syncReminder(x); }
    else if (el.id === 'dRemindSel') {
      delete x.reminded;
      if (el.value === '') { x.remindBefore = null; x.remindAt = null; }
      else if (el.value === 'custom') {
        // Start from a sensible time; the date-time box appears to fine-tune it.
        x.remindBefore = null;
        const due9 = x.due && `${x.due}T${x.dueTime || '09:00'}`;
        x.remindAt = due9 && due9 > nowLocal() ? due9 : nowLocal(new Date(Date.now() + 3600000));
      } else { x.remindBefore = Number(el.value); syncReminder(x); }
    }
    else if (el.dataset.subToggle) {
      x.subtasks.find((s) => s.id === el.dataset.subToggle).done = el.checked;
      touch(x); maybeAutoClose(x); return refresh();
    } else return;
    touch(x); refresh();
  };
  d.onkeydown = (e) => {
    const x = taskById(ui.selected); if (!x || e.key !== 'Enter') return;
    if (e.target.id === 'dAddSub' && e.target.value.trim()) {
      (x.subtasks = x.subtasks || []).push({ id: uid(), title: e.target.value.trim(), done: false });
      touch(x); refresh(); $('dAddSub').focus();
    } else if (['dAddLog', 'dLogPerson', 'dLogDate'].includes(e.target.id)) {
      e.preventDefault();
      addLogEntry(x);
    } else if (e.target.id === 'dAddPerson' && e.target.value.trim()) {
      e.preventDefault();
      addPending(x, e.target.value);
    } else if (e.target.id === 'dTitle') {
      e.preventDefault();
      $('dAddSub').focus();
    }
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Esc closes a dialog first; otherwise it closes the open task page.
      if ($('modalRoot').innerHTML) closeModal();
      else if (ui.focusView) { ui.focusView = false; renderFocus(true); }
      else if ($('composer').classList.contains('open')) closeComposer();
      else if (ui.selected) { document.activeElement?.blur(); ui.selected = null; refresh(); }
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); openComposer(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); $('search').focus(); }
  });
  bindDragAndDrop();
  bindKeyboard();
  bindAttachments();
  bindNotes();
}

// 1.2: the next round of a repeating task used to start on the day the last one closed.
// Rounds made that way now start on their own day instead.
function migrateRepeatStarts() {
  if (data.settings.repeatStartsFixed) return;
  for (const parent of data.tasks) {
    const next = parent.spawned && taskById(parent.spawned);
    if (next && !next.closure && next.due && next.start === parent.closure && next.start < next.due && next.due > todayStr()) next.start = next.due;
  }
  data.settings.repeatStartsFixed = true;
  save();
}

(async function init() {
  // Wait for the scripts after this one (focus.js, plan.js…) before the first draw.
  if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r));
  data = await window.api.getData();
  if (data.settings.sort) ui.sort = data.settings.sort;
  migrateRepeatStarts();
  bind();
  bindSplitters();
  renderAll();
  maybeWhatsNew();
  setTimeout(maybeAskPlan, 1500);
  window.api.onUpdateStatus((u) => showUpdateBanner(u));
  // An update that finished downloading before this window opened shows its bar right away.
  window.api.appInfo().then((i) => i.update && showUpdateBanner(i.update));
  window.api.onDataChanged((d) => {
    data = d;
    if (ui.scope !== 'all' && ui.scope !== 'inbox' && !areaById(ui.scope)) ui.scope = 'all';
    if (ui.person && !personById(ui.person)) ui.person = null;
    refreshLists();
    // Don't wipe what the user is typing in the task page.
    if (!$('detail').contains(document.activeElement)) renderDetail();
  });
  window.api.onCloseTask((id) => {
    const x = taskById(id);
    if (x && !x.closure) { setClosed(x, true); refresh(); }
  });
  window.api.onOpenTask((id) => {
    const x = taskById(id); if (!x) return;
    if (!currentTasks().some((y) => y.id === id)) { ui.scope = 'all'; ui.view = isOpen(x) ? 'pending' : 'closed'; }
    ui.selected = id; refresh();
  });
  // Re-check statuses after midnight (Pending → Overdue).
  setInterval(() => { if (!$('detail').contains(document.activeElement)) refresh(); else refreshLists(); }, 60000);
})();
