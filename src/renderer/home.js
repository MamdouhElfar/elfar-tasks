// ---------------- Home: the dashboard the app opens on ----------------
// Everything here follows the area picked in the sidebar (or all tasks).
// Every number and row is clickable and leads to the list behind it.

function renderHome() {
  const td = todayStr();
  const loc = lang() === 'ar' ? 'ar-EG' : 'en-GB';
  const plus = (n) => { const d = new Date(td + 'T00:00'); d.setDate(d.getDate() + n); return todayStr(d); };
  const in7 = plus(7);
  const mine = data.tasks.filter((x) => inScope(x) && (!ui.person || isPendingWith(x, ui.person)));
  const open = mine.filter(isOpen);

  const overdue = open.filter((x) => statusOf(x) === 'overdue');
  const dueToday = open.filter((x) => statusOf(x) === 'today');
  const week = open.filter((x) => x.due && x.due > td && x.due <= in7).sort((a, b) => a.due.localeCompare(b.due) || byPriorityThenDue(a, b));
  const withOthers = open.filter((x) => pendingOf(x).length);
  const closedWeek = mine.filter((x) => x.closure && x.closure >= weekStart());

  const h = new Date().getHours();
  const greet = h < 12 ? t('gMorning') : h < 18 ? t('gAfternoon') : t('gEvening');
  const longDate = new Date().toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });

  const stat = (go, n, label, cls, ico) => `<button class="h-stat ${cls} ${n ? '' : 'zero'}" data-go="${go}">
    <span class="h-ico">${icon(ico)}</span><b>${n}</b><span>${label}</span></button>`;

  const meta = (x) => {
    const bits = [];
    if (x.due) bits.push(`<span class="${statusOf(x) === 'overdue' ? 'od' : ''}">${fmtDate(x.due, lang())}</span>`);
    const ppl = peopleNames(x);
    if (ppl.length) bits.push(`${icon('user')} <span dir="auto">${esc(ppl.join('، '))}</span>`);
    if (ui.scope !== x.areaId && areaById(x.areaId)) bits.push(`<span dir="auto">${esc(areaLabel(x.areaId))}</span>`);
    return bits.join(' · ');
  };
  const row = (x) => `<div class="h-row ${quadClass(x)} ${ui.selected === x.id ? 'sel' : ''}" data-task="${x.id}">
    <span class="h-bar"></span><span class="h-title" dir="auto">${x.starred ? '<span class="star">★</span> ' : ''}${esc(x.title)}</span>
    <span class="h-meta">${meta(x)}</span></div>`;
  const panel = (title, ico, body, go) => `<section class="h-panel">
    <header>${icon(ico)}<b>${title}</b>${go ? `<button class="link" data-go="${go}">${t('hSeeAll')}</button>` : ''}</header>${body}</section>`;
  const empty = (text) => `<div class="h-empty">${text}</div>`;
  const capped = (xs, n, go) => xs.slice(0, n).map(row).join('') +
    (xs.length > n ? `<button class="h-more" data-go="${go}">+ ${xs.length - n} ${t('more')}</button>` : '');

  // Start with these: overdue, due today, then "do it now" boxes that aren't due yet.
  const seen = new Set();
  const focus = [...overdue, ...dueToday, ...open.filter((x) => x.priority === 'q1')]
    .filter((x) => !seen.has(x.id) && seen.add(x.id));

  // Coming up, by day.
  const days = new Map();
  for (const x of week.slice(0, 10)) { if (!days.has(x.due)) days.set(x.due, []); days.get(x.due).push(x); }
  const dayName = (ds) => (ds === plus(1) ? t('tomorrowLbl') : new Date(ds + 'T00:00').toLocaleDateString(loc, { weekday: 'long' }));
  const coming = [...days.entries()].map(([ds, xs]) =>
    `<div class="h-day"><span>${dayName(ds)}</span><small>${fmtDate(ds, lang())}</small></div>${xs.map(row).join('')}`).join('');

  // Waiting on: who holds what, and for how long.
  const people = new Map();
  for (const x of withOthers) for (const pw of pendingOf(x)) {
    const p = people.get(pw.personId) || { n: 0, since: td };
    p.n++; if ((pw.since || td) < p.since) p.since = pw.since;
    people.set(pw.personId, p);
  }
  const nudge = data.settings.nudgeDays || 3;
  const waiting = [...people.entries()].sort((a, b) => a[1].since.localeCompare(b[1].since)).map(([pid, p]) => {
    const d = Math.max(0, daysBetween(p.since, td));
    return `<button class="h-person" data-go="person:${pid}">${icon('user')}<b dir="auto">${esc(personById(pid).name)}</b>
      <span class="h-n">${p.n}</span><span class="h-age ${d >= nudge ? 'old' : ''}">${t('oldestDays')} ${d} ${t('days')}</span></button>`;
  }).join('');

  // Areas: open work per area, with what's overdue.
  const areaList = ui.scope === 'all' ? topAreas() : childrenOf(ui.scope);
  const maxOpen = Math.max(1, ...areaList.map((a) => data.tasks.filter((x) => isOpen(x) && inScope(x, a.id)).length));
  const areas = areaList.map((a) => {
    const xs = data.tasks.filter((x) => isOpen(x) && inScope(x, a.id));
    const od = xs.filter((x) => statusOf(x) === 'overdue').length;
    return `<button class="h-area" data-go="area:${a.id}"><span class="dot" style="background:${areaColor(a)}"></span>
      <span class="h-an" dir="auto">${esc(a.name)}</span>
      <span class="h-track"><i style="width:${(xs.length / maxOpen) * 100}%;background:${areaColor(a)}"></i></span>
      <span class="h-n">${xs.length}</span>${od ? `<span class="pill overdue">${od}</span>` : ''}</button>`;
  }).join('');

  const reminders = open.filter((x) => x.remindAt && x.remindAt.startsWith(td)).sort((a, b) => a.remindAt.localeCompare(b.remindAt));

  const durations = mine.filter((x) => x.closure && x.start).map((x) => daysBetween(x.start, x.closure));
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const month = td.slice(0, 7);
  const closedMonth = mine.filter((x) => x.closure && x.closure.startsWith(month)).length;

  $('list').innerHTML = `<div class="home">
    <div class="h-hello"><h2>${greet} 👋</h2><span class="muted">${longDate}</span></div>
    <div class="h-stats">
      ${stat('today', overdue.length, t('overdue'), 'danger', 'overdue')}
      ${stat('today', dueToday.length, t('stDueToday'), 'warn', 'today')}
      ${stat('calendar', week.length, t('hWeek'), 'info', 'calendar')}
      ${stat('others', withOthers.length, t('hOthers'), 'violet', 'waiting')}
      ${stat('closed', closedWeek.length, t('hClosedWeek'), 'ok', 'closed')}
    </div>
    <div class="h-grid">
      ${panel(t('hFocus'), 'today', focus.length ? capped(focus, 7, 'today') : empty(t('hAllClear')), focus.length > 7 ? 'today' : '')}
      ${panel(t('hComing'), 'calendar', coming || empty(t('hNothing')), 'calendar')}
      ${people.size ? panel(t('hWaiting'), 'waiting', `<div class="h-people">${waiting}</div>`, 'others') : ''}
      ${areaList.length ? panel(t('hAreasTitle'), 'all', `<div class="h-areas">${areas}</div>`) : ''}
      ${reminders.length ? panel(t('hReminders'), 'bell', reminders.map((x) =>
        `<div class="h-row" data-task="${x.id}"><span class="h-time">${fmtTime(x.remindAt, lang())}</span><span class="h-title" dir="auto">${esc(x.title)}</span></div>`).join('')) : ''}
    </div>
    <p class="h-foot small muted">${t('openTasks')}: ${open.length} · ${t('closedThisMonth')}: ${closedMonth}${avg !== null ? ` · ${t('avgClose')}: ${avg} ${t('days')}` : ''}</p>
  </div>`;
}

// Where each number / row on Home leads.
function homeGo(go) {
  const [kind, id] = go.split(':');
  if (kind === 'today' || kind === 'calendar' || kind === 'closed') ui.view = kind;
  if (kind === 'others') { ui.view = 'pending'; ui.pendingSub = 'others'; }
  if (kind === 'person') { ui.person = id; ui.view = 'pending'; ui.pendingSub = 'others'; }
  if (kind === 'area') { ui.scope = id; ui.view = 'pending'; ui.pendingSub = 'all'; }
  if (kind === 'calendar') ui.calMonth = null;
  ui.selected = null;
  refresh();
  animateIn($('list'));
}
