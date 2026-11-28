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
  saveTimer = setTimeout(sendChanges, 250);
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
  { id: 'today', lead: true, test: (x) => isOpen(x) && (x.topic ? topicStale(x) : ((x.due && x.due <= todayStr()) || x.starred || inPlan(x))),
    cls: () => (data.tasks.some((x) => inScope(x) && statusOf(x) === 'overdue') ? 'danger' : '') },
  // One Tasks tab, seen as a list, a matrix or a calendar (the switch sits at the top of the tab).
  { id: 'pending', label: 'tasksTab', test: isActive, cls: () => 'warn', group: ['matrix', 'calendar'] },
  { id: 'closed', test: (x) => !!x.closure, noCount: true, hidden: true },
  { id: 'matrix', test: isActive, noCount: true, board: true, hidden: true },
  { id: 'calendar', test: () => true, noCount: true, board: true, hidden: true },
  { id: 'habits', test: () => false, noCount: true, board: true },
  { id: 'report', label: 'review', test: () => true, noCount: true, board: true, also: ['closed', 'daylog'] },
  { id: 'daylog', test: () => false, noCount: true, board: true, hidden: true }
];
const TASK_VIEWS = ['pending', 'matrix', 'calendar'];
function tasksViewBar() {
  const b = (v, ic, label) => `<button class="${ui.view === v ? 'on' : ''}" data-tview="${v}" title="${esc(label)}">${icon(ic)}<span>${esc(label)}</span></button>`;
  return `<span class="seg-joined tview">${b('pending', 'list', t('tvList'))}${b('matrix', 'matrix', t('matrix'))}${b('calendar', 'calendar', t('calendar'))}</span>`;
}

function inScope(x, scope = ui.scope) {
  if (scope === 'all') return true;
  if (scope === 'inbox') return !areaById(x.areaId);
  return x.areaId === scope || ancestorsOf(x.areaId).includes(scope);
}

function currentTasks() {
  const v = VIEWS.find((v) => v.id === ui.view);
  let list = data.tasks.filter((x) => inScope(x) && v.test(x) && (!ui.person || isPendingWith(x, ui.person)));
  if (ui.view === 'pending' && ui.pendingSub === 'topics') {
    list = data.tasks.filter((x) => inScope(x) && x.topic && !x.closure && (!ui.person || isPendingWith(x, ui.person)));
    const q0 = ui.search.trim();
    if (q0) list = list.filter((x) => matchText([x.title, ...peopleNames(x), ...(x.log || []).map((l) => l.text)].join('\n'), q0));
    return list.sort((a, b) => (topicLast(a) || '').localeCompare(topicLast(b) || ''));
  }
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
  $('searchAllLbl').textContent = t('searchBtn');
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
    const on = ui.view === v.id || (v.also || []).includes(ui.view) || (v.group || []).includes(ui.view);
    return `<button class="tab ${v.board ? 'board' : ''} ${v.lead ? 'lead' : ''} ${on ? 'active' : ''}" data-view="${v.id}" title="${esc(t(v.label || v.id))}">
      ${icon(v.id)}<span class="tab-label">${esc(t(v.label || v.id))}</span>${n ? `<span class="count ${v.cls ? v.cls() : ''}">${n}</span>` : ''}</button>`;
  };
  $('tabs').innerHTML = `<div class="tab-group">${VIEWS.filter((v) => v.lead).map(tab).join('')}</div>
    <span class="tab-sep"></span>
    <div class="tab-group">${VIEWS.filter((v) => !v.board && !v.lead && !v.hidden).map(tab).join('')}</div>
    <span class="tab-sep"></span>
    <div class="tab-group boards">${VIEWS.filter((v) => v.board && !v.hidden).map(tab).join('')}</div>`;
  fitTabs();
  // Tools that don't apply to a view are hidden instead of sitting there doing nothing.
  const tools = { search: !['today', 'calendar', 'report', 'habits', 'daylog'].includes(ui.view), sort: !['today', 'matrix', 'calendar', 'report', 'habits', 'daylog'].includes(ui.view) };
  $('personFilter').hidden = ['habits', 'daylog'].includes(ui.view);
  const bare = ['habits', 'today'].includes(ui.view) && ui.scope === 'all';
  $('listTitle').hidden = bare;
  document.querySelector('.list-head').classList.toggle('is-bare', bare);
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
        .replace('<div class="nav-item', `<div draggable="true" title="${esc(t('dragFolder'))}" class="nav-item`)
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
  if (x.topic && !x.closure) return `<span class="pill topic">${icon('log')} ${t('tpOne')}</span>`;
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
      <div class="t-meta">${prioNum(x)}${x.topic && !x.closure ? topicChip(x) : whenChip(x, ui.view === 'today')}${x.remindAt && isOpen(x) ? `<span class="pill remind ${x.remindAt <= nowLocal() ? 'past' : ''}">${icon('bell')} ${remindDay === todayStr() ? '' : fmtDate(remindDay, lang()) + ' '}${fmtTime(x.remindAt, lang())}</span>` : ''}${x.repeat && isOpen(x) ? `<span class="pill repeat" title="${esc(repeatLabel(x.repeat))}">${icon('repeat')}</span>` : ''}${(x.files || []).length ? `<span class="pill area">${icon('clip')} ${x.files.length}</span>` : ''}
        ${subs.length ? `<span class="progress"><span class="bar"><i style="width:${(done / subs.length) * 100}%"></i></span>${done}/${subs.length}</span>` : ''}
        ${isOpen(x) && (x.postponed || 0) >= 2 ? `<span class="postponed" title="${t('postponedTip')}">↻ ${lang() === 'ar' ? 'اتأجلت ' + timesWord(x.postponed, 'ar') : 'put off ' + timesWord(x.postponed, 'en')}</span>` : ''}
        ${isOpen(x) ? pendingOf(x).map((pw) => `<span class="pill person" title="${t('since')} ${fmtDate(pw.since, lang())}">${icon('user')} <bdi>${esc(personById(pw.personId).name)}</bdi> · ${sinceWord(pw.since)}</span>`).join('') : ''}
        ${showArea ? `<span class="pill area">${esc(areaLabel(x.areaId))}</span>` : ''}
      </div>
    </div>${isOpen(x) && !focusOn ? `<span class="row-acts">${ui.view === 'today' ? `<button class="row-defer" data-defer="${x.id}" title="${t('dfTip')}">${icon('calendar')} ${t('dfShort')}</button>` : ''}<button class="row-focus" data-focus="${x.id}" title="${t('fStartTip')}">▶ ${t('fShort')}</button></span>` : ''}</div>`;
}

function renderList() {
  const a = areaById(ui.scope);
  const scopeName = ui.scope === 'all' ? t('allAreas') : areaLabel(ui.scope);
  $('listTitle').innerHTML = (a ? `<span class="dot" style="background:${areaColor(a)}"></span>` : icon(ui.scope === 'inbox' ? 'inbox' : 'all')) +
    `<span>${esc(scopeName)}</span>`;

  // People live here now (not in the sidebar): who has your tasks first, with how many;
  // people with nothing open sit in their own group; "Manage people" adds, renames or deletes.
  const holding = (pid) => data.tasks.filter((x) => isOpen(x) && isPendingWith(x, pid)).length;
  const ppl = data.people.map((p) => ({ p, n: holding(p.id) })).sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name));
  const opt = ({ p, n }) => `<option value="${p.id}" ${ui.person === p.id ? 'selected' : ''}>${esc(p.name)}${n ? ` (${n})` : ''}</option>`;
  const idle = ppl.filter((o) => !o.n);
  $('personFilter').innerHTML = `<option value="">${t('allPeople')}</option>` + ppl.filter((o) => o.n).map(opt).join('') +
    (idle.length ? `<optgroup label="${esc(t('pfIdle'))}">${idle.map(opt).join('')}</optgroup>` : '') +
    `<option value="__manage">✎ ${esc(t('pfManage'))}</option>`;
  $('personFilter').classList.toggle('active', !!ui.person);

  if (ui.view === 'today') return renderHome();
  if (ui.view === 'habits') return renderHabits();
  if (ui.view === 'calendar' || ui.view === 'matrix') {
    if (ui.view === 'calendar') renderCalendar(); else renderMatrix();
    // The calendar has its own toolbar: the switch joins it there instead of adding a row.
    const cv = $('list').querySelector('.cal-views');
    if (cv) return cv.parentElement.insertAdjacentHTML('beforeend', tasksViewBar());
    return $('list').insertAdjacentHTML('afterbegin', `<div class="sub-bar tview-bar">${tasksViewBar()}</div>`);
  }
  if (ui.view === 'report') return renderReport();
  if (ui.view === 'daylog') return renderDayLog();
  const list = currentTasks();
  // Pending: all / on me / with others. Closed: the Review switch (report / closed).
  const subBar = ui.view === 'pending' ? pendingSubBar() : ui.view === 'closed' ? reviewSubBar() : '';
  // Pending › All: tasks that haven't started yet sit at the bottom, faded, so a folder
  // never looks empty while it still has work coming.
  const later = []; // scheduled tasks live under Pending › Scheduled only
  const laterHtml = later.length ? `<div class="group-title later-title">${icon('calendar')} ${t('later')} · ${later.length}</div><div class="later-rows">${later.map(rowHtml).join('')}</div>` : '';
  if (!list.length) { $('list').innerHTML = subBar + (laterHtml || `<div class="empty">${t('emptyList')}</div>`); return; }
  // Today: overdue first, then due today, then starred ones that aren't due yet.
  // "With others" with no person picked: group by person, for follow-up rounds.
  if (ui.view === 'pending' && ui.pendingSub === 'others' && !ui.person) {
    const groups = new Map();
    for (const x of list) for (const pw of pendingOf(x)) {
      if (!groups.has(pw.personId)) groups.set(pw.personId, []);
      groups.get(pw.personId).push(x);
    }
    $('list').innerHTML = [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([pid, xs]) => `<div class="group-title" data-person-group="${pid}">${icon('user')} <b dir="auto">${esc(personById(pid).name)}</b> · ${xs.length}<button class="icon pg-edit" data-edit-person="${pid}" title="${t('editPerson')}">✎</button></div>${xs.map(rowHtml).join('')}`)
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
    later: mineAll.filter((x) => statusOf(x) === 'scheduled').length, topics: mineAll.filter((x) => x.topic && !x.closure).length };
  const b = (k, label) => `<button class="${ui.pendingSub === k ? 'on' : ''}" data-psub="${k}">${label} <span class="n">${n[k]}</span></button>`;
  return `<div class="sub-bar"><span class="seg-joined">${b('all', t('all'))}${b('mine', t('mine'))}${b('others', t('withOthers'))}</span>
    ${n.later || ui.pendingSub === 'later' ? `<span class="seg-joined later">${b('later', `${icon('calendar')} ${t('later')}`)}</span>` : ''}
    <span class="seg-joined topics">${b('topics', `${icon('log')} ${t('tpTab')}`)}</span>
    <span class="tview-push"></span>${tasksViewBar()}</div>
    ${ui.pendingSub === 'later' ? `<p class="small muted sub-hint">${t('scheduledHint')}</p>` : ''}
    ${ui.pendingSub === 'topics' ? `<p class="small muted sub-hint">${t('tpHint')}</p>` : ''}`;
}

function renderCalendar() {
  if (calView() !== 'month') return renderTimeGrid(calView());
  const base = ui.calMonth || todayStr().slice(0, 7);
  const [y, m] = base.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const loc = lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  // Week starts Saturday in Arabic, Monday in English.
  const weekStart = appWeekStart();
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
      ${calViewSeg()}
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
    // Sub-folders show their own name, indented under the parent (not "Parent / Child" again).
    h += `<option value="${a.id}" ${selected === a.id ? 'selected' : ''}>${depth ? '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(depth - 1) + '&nbsp;&nbsp;└&nbsp;' : ''}${esc(a.name)}</option>`;
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
  // Only what this task uses is shown; everything else waits behind small "＋" buttons.
  ui.dOpen = ui.dOpen || {};
  const noteText = (x.notes || '').trim() || (Array.isArray(x.pages) && x.pages.some((p) => (p.html || '').replace(/<[^>]*>/g, '').trim()));
  const has = { estimate: !!x.estimate || (x.focusMs || 0) >= 60000, remind: !!x.remindAt || x.remindBefore != null, repeat: !!x.repeat, prio: !!x.priority,
    people: pendingOf(x).length > 0, files: (x.files || []).length > 0, notes: !!noteText };
  const show = (k) => ui.dShowAll === x.id || has[k] || ui.dOpen[x.id + ':' + k];
  const MORE = [['prio', 'matrix', t('priority')], ['remind', 'bell', t('reminder')], ['people', 'user', t('waiting')],
    ['repeat', 'repeat', t('repeat')], ['files', 'clip', t('files')], ['topic', 'log', t('tpMake')]].filter(([k]) => !show(k) && !(k === 'repeat' && x.topic) && !(k === 'topic' && (x.topic || x.closure)));
  const moreHtml = MORE.length ? `<div class="d-more"><span class="small muted">${t('dAddMore')}</span>${MORE.map(([k, ic, l]) => `<button type="button" data-dmore="${k}">＋ ${icon(ic)} ${esc(l)}</button>`).join('')}</div>` : '';
  const span = statusOf(x) === 'scheduled' ? '' : x.start ? (x.closure ? `${t('tookDays')} ${daysWord(daysBetween(x.start, x.closure), lang())}` : `${t('openedFor')} ${daysWord(Math.max(0, daysBetween(x.start, todayStr())), lang())}`) : '';
  el.innerHTML = `<div class="inner">
    <div class="d-top">
      ${statusPill(x)} <span class="small muted">${span}${x.focusMs >= 60000 ? ` · ⏱ ${focusTimeLabel(focusMinsOf(x))}` : ''}</span>
      <span class="spacer"></span>
      <div class="d-acts">
        ${x.closure || x.topic ? '' : `<button class="d-defer" data-defer="${x.id}" title="${t('dfTip')}">${icon('calendar')} ${t('dfShort')}</button>`}
        ${x.closure ? '' : data.focus && data.focus.taskId === x.id && data.focus.mode === 'work' ? `<button class="focus-btn on" data-focus="${x.id}">◉ ${t('fWorkingOn')}…</button>` : `<button class="focus-btn" data-focus="${x.id}" title="${t('fStartTip')}">▶ ${t('fStart')}</button>`}
        ${x.closure ? `<button id="dReopen">${t('reopen')}</button>` : `<button class="primary" id="dClose">✓ ${t('closeToday')}</button>`}
        <button class="d-act ${x.starred ? 'on' : ''}" id="dStar" title="${t('star')}">${x.starred ? '★' : '☆'}</button>
        <button class="d-act del" id="dDelete" title="${t('del')}">${icon('trash')}</button>
        <button class="d-act" id="dHide" title="${t('closeBtn')} (Esc)">✕</button>
      </div>
    </div>
    <textarea class="d-title" id="dTitle" dir="auto" rows="1" placeholder="${t('title')}">${esc(x.title)}</textarea>
    ${x.pinnedNote ? `<div class="pinned-note"><span>📌</span><span dir="auto">${linkify(x.pinnedNote)}</span><button class="icon" id="dUnpin" title="${t('done')}">✓</button></div>` : ''}
    ${x.topic && !x.closure ? topicBoxHtml(x) : ''}
    <div class="d-grid" ${x.topic && !x.closure ? 'hidden' : ''}>
      <div class="d-field"><label>${icon('today')} ${t('start')}</label><input type="date" id="dStart" value="${x.start || ''}"></div>
      <div class="d-field"><label>${icon('calendar')} ${t('due')}</label><input type="date" id="dDue" value="${x.due || ''}"></div>
      <div class="d-field"><label>${icon('pending')} ${t('dueTimeShort')}</label>${timeBox('dDueTime', x.dueTime, `title="${t('dueTime')}"`)}</div>
      ${x.closure ? `<div class="d-field"><label>${icon('closed')} ${t('closure')}</label><input type="date" id="dClosure" value="${x.closure}"></div>` : ''}
    </div>
    <div class="d-row">
      <div class="d-field grow"><label>${icon('folder')} ${t('area')}</label><select id="dArea">${areaOptions(x.areaId)}</select></div>
      ${show('repeat') ? `<div class="d-field grow"><label>${icon('repeat')} ${t('repeat')}</label><select id="dRepeat">${repeatOptions(x.repeat, x.due)}</select></div>` : ''}
    </div>
    ${show('prio') ? `<div class="d-field">
      <label>${icon('matrix')} ${t('priority')}${x.priority ? ` · <a href="#" data-prio="">${t('clearPriority')}</a>` : ''}</label>
      ${prioPicker(x.priority, 'data-prio', prioNames(), t('noPrio'))}
    </div>` : ''}
    ${show('remind') ? reminderFieldHtml(x) : ''}
    ${show('people') ? `<div class="d-field pending-box">
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
    </div>` : ''}
    ${moreHtml}

    <div class="d-sec"><h3>${icon('list')} ${t('subtasks')} <span class="muted small">${subs.filter((s) => s.done).length}/${subs.length}</span></h3>
      ${subs.map((s) => `<div class="sub ${s.done ? 'done' : ''}">
        <input type="checkbox" data-sub-toggle="${s.id}" ${s.done ? 'checked' : ''}>
        <input type="text" dir="auto" data-sub-title="${s.id}" value="${esc(s.title)}">
        <button class="icon x" data-sub-del="${s.id}">✕</button></div>`).join('')}
      <input type="text" class="add-line" id="dAddSub" dir="auto" placeholder="＋ ${t('addSubtask')}">
    </div>

    ${x.repeat ? `<div class="d-field next-note"><label>${icon('repeat')} ${t('nextNote')}</label>
      <textarea id="dNextNote" dir="auto" rows="2" placeholder="${t('nextNotePh')}">${esc(x.nextNote || '')}</textarea></div>` : ''}
    ${has.notes ? notesHtml(x) : ''}
    ${show('files') ? attachmentsHtml(x) : ''}

    <div class="d-sec"><h3>${icon('log')} ${t('log')}</h3>
      <div class="log-add">
        <input type="text" id="dAddLog" dir="auto" placeholder="＋ ${x.topic ? t('tpLogPh') : t('addLog')}">
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
        if (ui.logEdit === l.id) return `<div class="log-item editing" data-log-row="${l.id}">
          <div class="le-when"><input type="date" id="leDate" value="${l.date || todayStr()}">${timeBox('leTime', (l.at || '').slice(11, 16))}</div>
          <input type="text" id="leText" dir="auto" value="${esc(l.text)}">
          <div class="le-acts"><button data-log-cancel>${t('cancel')}</button><button class="primary" data-log-save="${l.id}">${t('save')}</button></div></div>`;
        return `<div class="log-item ${l.handoff ? 'is-handoff' : ''}">
        <span class="ld">${fmtDate(l.date, lang())}${l.at ? `<small>${fmtTime(l.at, lang())}</small>` : ''}</span>
        <span class="lt" dir="auto">${linkify(l.text)}
          ${l.handoff ? `<span class="pill handoff">→ ${holders.length ? holders.map((p) => esc(p.name)).join('، ') : t('me')}</span>` : ''}
          ${owner && !l.handoff ? `<span class="pill person">${icon('user')} ${esc(owner.name)}</span>` : ''}</span>
        <span class="log-acts"><button class="icon" data-log-edit="${l.id}" title="${t('edit')}">✎</button><button class="icon x" data-log-del="${l.id}" title="${t('del')}">✕</button></span></div>`;
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
  // The list keeps at least 460px so Today doesn't get squeezed; the task page keeps at least 380px.
  drag($('listSplit'), document.querySelector('.detail'), 'detailW', 380, () => Math.max(380, document.querySelector('.work').clientWidth - 460), true);
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
  if (opts.topic) { x.topic = true; x.checkEvery = opts.checkEvery || null; x.due = null; x.dueTime = null; x.repeat = null; x.remindBefore = null; }
  if (opts.notes) { x.notes = opts.notes; x.pages = [{ id: uid(), title: '', html: textToNoteHtml(opts.notes) }]; }
  if (opts.subtasks) x.subtasks = opts.subtasks.map((s) => ({ id: uid(), title: s, done: false }));
  if (opts.person) {
    const p = findOrCreatePerson(opts.person, x.areaId);
    if (p && !isPendingWith(x, p.id)) { x.pendingWith.push({ personId: p.id, since: todayStr() }); recordHandoff(x, `${t('nowWith')} ${p.name}`); }
  }
  if (opts.estimate) x.estimate = opts.estimate;
  if (opts.blockAt) { x.blockAt = opts.blockAt; x.blockMins = opts.estimate || 30; }
  else if (ui.tgNewBlock && (!x.due || x.due === ui.tgNewBlock.slice(0, 10))) { x.blockAt = ui.tgNewBlock; x.blockMins = x.estimate || 30; if (!x.due) x.due = ui.tgNewBlock.slice(0, 10); }
  ui.tgNewBlock = null;
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

// ---------------- follow-up log ----------------
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

// ---------- open items ----------
function topicAgo(x) {
  const last = topicLast(x); if (!last) return '';
  const n = Math.max(0, daysBetween(last, todayStr()));
  return n === 0 ? t('tpToday') : t('tpAgo').replace('{n}', daysWord(n, lang()));
}
function topicChip(x) {
  return `<span class="when topic ${topicStale(x) ? 'stale' : ''}" title="${esc(t('tpLastTip'))}">${icon('log')} ${topicAgo(x)}</span>`;
}
function topicBoxHtml(x) {
  const opts = [[0, t('tpNever')], [7, t('tpEvery7')], [14, t('tpEvery14')], [30, t('tpEvery30')]];
  return `<div class="tp-box ${topicStale(x) ? 'stale' : ''}">
    <div class="tp-line"><span class="pill topic">${icon('log')} ${t('tpOne')}</span>
      <span class="small muted">${x.start ? `${t('since')} ${fmtDate(x.start, lang())} · ` : ''}${topicAgo(x)}</span>
      <span style="flex:1"></span><button class="link small" data-tp-off>${t('tpMakeTask')}</button></div>
    <label class="tp-check small">${icon('bell')} ${t('tpCheck')} <select id="dCheckEvery">${opts.map(([v, l]) => `<option value="${v}" ${(x.checkEvery || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  </div>`;
}

function saveLogEdit(x, id) {
  const l = (x.log || []).find((y) => y.id === id); if (!l) return;
  const text = $('leText').value.trim();
  if (!text) return $('leText').focus();
  const day = $('leDate').value || l.date || todayStr();
  const time = timeValue($('leTime'));
  l.text = text; l.date = day;
  if (time) l.at = `${day}T${time}`; else if (l.at) l.at = `${day}T${l.at.slice(11, 16)}`;
  ui.logEdit = null; touch(x); refresh();
}
document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'leText') return;
  const x = taskById(ui.selected); if (!x) return;
  if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); saveLogEdit(x, ui.logEdit); }
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ui.logEdit = null; renderDetail(); }
}, true);

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

// Everyone in one small list: who holds how many of your tasks; click a name to edit, or add someone.
function openPeopleManager() {
  const holding = (pid) => data.tasks.filter((x) => isOpen(x) && isPendingWith(x, pid)).length;
  const ppl = data.people.map((p) => ({ p, n: holding(p.id) })).sort((a, b) => b.n - a.n || a.p.name.localeCompare(b.p.name));
  $('modalRoot').innerHTML = `<div class="modal-bg" id="mBg"><div class="modal people-mgr">
    <h3>${icon('user')} ${t('people')}</h3>
    <div class="pm-list">${ppl.length ? ppl.map(({ p, n }) => `<button class="pm-row" data-pm="${p.id}"><span dir="auto">${esc(p.name)}</span>
      <span class="muted small">${n ? `${n} ${t('pmOpen')}` : t('pmNone')}</span><span class="pm-ed">✎</span></button>`).join('') : `<p class="small muted">${t('pmEmpty')}</p>`}</div>
    <div class="actions"><button id="pmAdd">＋ ${t('addPerson')}</button><span style="flex:1"></span><button class="primary" id="mCancel">${t('done')}</button></div></div></div>`;
  $('mBg').onclick = (e) => {
    if (e.target.id === 'mBg' || e.target.id === 'mCancel') return closeModal();
    if (e.target.closest('#pmAdd')) return openPersonModal(null);
    const r = e.target.closest('[data-pm]'); if (r) return openPersonModal(personById(r.dataset.pm));
  };
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

// ---------------- events ----------------
function bind() {
  $('tabs').onclick = (e) => {
    const v = e.target.closest('[data-view]'); if (!v) return;
    // Moving to another tab closes the open task page.
    if (ui.view === v.dataset.view) return;
    // The Tasks tab opens the way you last looked at it (list, matrix or calendar).
    const to = v.dataset.view === 'pending' && TASK_VIEWS.includes(data.settings.tasksView) ? data.settings.tasksView : v.dataset.view;
    if (ui.view === to) return;
    ui.view = to; ui.selected = null; refresh(); animateIn($('list'));
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
  $('personFilter').onchange = (e) => {
    if (e.target.value === '__manage') { e.target.value = ui.person || ''; return openPeopleManager(); }
    ui.person = e.target.value || null;
    // Picking someone from Today shows what they hold, under Tasks › With others.
    if (ui.person && !TASK_VIEWS.includes(ui.view)) { ui.view = 'pending'; ui.pendingSub = 'others'; ui.selected = null; return refresh(); }
    refreshLists();
  };
  $('settingsBtn').onclick = () => openSettings('general'); // always start on General
  $('searchAllBtn').onclick = () => openPalette();
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
    const ep = e.target.closest('[data-edit-person]');
    if (ep) return openPersonModal(personById(ep.dataset.editPerson));
    const tv = e.target.closest('[data-tview]');
    if (tv) { if (ui.view !== tv.dataset.tview) { ui.view = tv.dataset.tview; data.settings.tasksView = ui.view; save(); refresh(); animateIn($('list')); } return; }
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
    const more = e.target.closest('[data-dmore]');
    if (more && more.dataset.dmore === 'topic') {
      // Turn a task into an open item: no due date, no repeat; it moves to Tasks › Open items.
      x.topic = true; x.due = null; x.dueTime = null; x.repeat = null; x.remindBefore = null; x.blockAt = null; x.checkEvery = x.checkEvery || 14;
      if (data.plan && Array.isArray(data.plan.ids)) data.plan.ids = data.plan.ids.filter((id) => id !== x.id);
      syncReminder(x); touch(x); ui.view = 'pending'; ui.pendingSub = 'topics'; refresh(); showToast(t('tpMadeToast'));
      return;
    }
    if (e.target.closest('[data-tp-off]')) { x.topic = false; delete x.checkEvery; touch(x); ui.pendingSub = 'all'; return refresh(); }
    if (more) {
      const k = more.dataset.dmore;
      ui.dOpen = ui.dOpen || {}; ui.dOpen[x.id + ':' + k] = true; renderDetail();
      const go = { prio: '#detail [data-prio]', remind: '#dRemindSel', estimate: '#detail .est-pick button', people: '#dAddPerson', repeat: '#dRepeat', notes: '#notesSec', files: '#dFilesSec' }[k];
      const el = document.querySelector(go);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (/^(INPUT|SELECT|BUTTON)$/.test(el.tagName)) el.focus(); el.closest('.d-field, .d-sec')?.classList.add('just-added'); }
      return;
    }
    if (id === 'dStar') { x.starred = !x.starred; touch(x); return refresh(); }
    if (id === 'dClose') { setClosed(x, true); return refresh(); }
    if (id === 'dReopen') { setClosed(x, false); return refresh(); }
    if (id === 'dDelete') return deleteTask(x);
    if (id === 'dLogAdd') return addLogEntry(x);
    const sd = e.target.closest('[data-sub-del]');
    if (sd) { x.subtasks = x.subtasks.filter((s) => s.id !== sd.dataset.subDel); touch(x); return refresh(); }
    // Fix a follow-up you already wrote: its words, day and time.
    const le = e.target.closest('[data-log-edit]');
    if (le) { ui.logEdit = le.dataset.logEdit; renderDetail(); const i = $('leText'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return; }
    if (e.target.closest('[data-log-cancel]')) { ui.logEdit = null; return renderDetail(); }
    const ls = e.target.closest('[data-log-save]');
    if (ls) return saveLogEdit(x, ls.dataset.logSave);
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
    else if (el.id === 'dCheckEvery') x.checkEvery = Number(el.value) || null;
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
  bindFolderDrag();
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
  adoptData(await window.api.getData());
  if (data.settings.sort) ui.sort = data.settings.sort;
  migrateRepeatStarts();
  bind();
  bindSplitters();
  renderAll();
  maybeWhatsNew();
  setTimeout(maybeAskHabits, 1200);
  setTimeout(maybeAskPlan, 1500);
  window.api.onUpdateStatus((u) => showUpdateBanner(u));
  // An update that finished downloading before this window opened shows its bar right away.
  window.api.appInfo().then((i) => i.update && showUpdateBanner(i.update));
  window.api.onDataChanged((d) => {
    receiveData(d);
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
