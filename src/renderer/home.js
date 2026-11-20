// ---------------- Home: the dashboard the app opens on ----------------
// Everything here follows the area picked in the sidebar (or all tasks).
// Every number and row is clickable and leads to the list behind it.

function renderHome() {
  const td = todayStr();
  const loc = lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  const plus = (n) => { const d = new Date(td + 'T00:00'); d.setDate(d.getDate() + n); return todayStr(d); };
  const in7 = plus(7);
  const mine = data.tasks.filter((x) => inScope(x) && (!ui.person || isPendingWith(x, ui.person)));
  const open = mine.filter(isActive);
  const scheduled = mine.filter((x) => statusOf(x) === 'scheduled');

  const overdue = open.filter((x) => statusOf(x) === 'overdue');
  const dueToday = open.filter((x) => statusOf(x) === 'today');
  const week = [...open, ...scheduled].filter((x) => x.due && x.due > td && x.due <= in7).sort((a, b) => a.due.localeCompare(b.due) || byPriorityThenDue(a, b));
  const withOthers = open.filter((x) => pendingOf(x).length);
  const closedWeek = mine.filter((x) => x.closure && x.closure >= weekStart());

  const h = new Date().getHours();
  const greet = h < 12 ? t('gMorning') : h < 18 ? t('gAfternoon') : t('gEvening');
  const longDate = new Date().toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });

  const stat = (go, n, label, cls, ico) => `<button class="h-stat ${cls} ${n ? '' : 'zero'}" data-go="${go}">
    <span class="h-ico">${icon(ico)}</span><b>${n}</b><span>${label}</span></button>`;

  const meta = (x, noDate) => {
    const bits = [];
    const w = !noDate && whenInfo(x);
    if (w) bits.push(`<span class="${w.cls === 'overdue' ? 'od' : ''}" title="${esc(w.title || '')}">${w.text}</span>`);
    const ppl = peopleNames(x);
    if (ppl.length) bits.push(`${icon('user')} <span dir="auto">${esc(ppl.join('، '))}</span>`);
    if (ui.scope !== x.areaId && areaById(x.areaId)) bits.push(`<span dir="auto">${esc(areaLabel(x.areaId))}</span>`);
    return bits.join(' · ');
  };
  const row = (x, noDate) => `<div class="h-row ${quadClass(x)} ${ui.selected === x.id ? 'sel' : ''}" data-task="${x.id}">
    <span class="h-bar"></span><span class="h-title" dir="auto">${x.starred ? '<span class="star">★</span> ' : ''}${esc(x.title)}</span>
    <span class="h-meta">${meta(x, noDate === true)}</span>${isOpen(x) ? `<button class="row-focus" data-focus="${x.id}" title="${t('fStartTip')}">▶</button>` : ''}</div>`;
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
    `<div class="h-day"><span>${dayName(ds)}</span><small>${fmtDate(ds, lang())}</small></div>${xs.map((x) => row(x, true)).join('')}`).join('');

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
      <span class="h-n">${p.n}</span><span class="h-age ${d >= nudge ? 'old' : ''}">${t('oldestDays')} ${daysWord(d, lang())}</span></button>`;
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

  // One line that sums up the day, and how much of today's list is already done.
  const ar = lang() === 'ar';
  const bits = [];
  if (dueToday.length) bits.push(ar ? `${dueToday.length} عليها الدور النهارده` : `${dueToday.length} due today`);
  if (overdue.length) bits.push(ar ? `${overdue.length} متأخرة` : `${overdue.length} overdue`);
  if (withOthers.length) bits.push(ar ? `${withOthers.length} مستنية حد تاني` : `${withOthers.length} waiting on others`);
  const summary = bits.length ? (ar ? `عندك ${bits.join('، ')}.` : `You have ${bits.join(', ')}.`) : t('hAllClear');
  const doneToday = mine.filter((x) => x.closure === td).length;
  const dayTotal = doneToday + dueToday.length + overdue.length;
  const pct = dayTotal ? Math.round((doneToday / dayTotal) * 100) : 0;

  $('list').innerHTML = `<div class="home">
    <div class="h-hello">
      <div class="h-hi"><h2>${greet} 👋</h2><span class="muted">${longDate}</span><p class="h-sum">${summary}</p></div>
      ${dayTotal ? `<div class="h-day-prog" title="${doneToday} / ${dayTotal}">
        <div class="h-ring" style="--p:${pct}"><b>${doneToday}<small>/${dayTotal}</small></b></div>
        <span>${t('hDoneToday')}</span></div>` : ''}
    </div>
    <div class="h-stats">
      ${stat('today', overdue.length, t('overdue'), 'danger', 'overdue')}
      ${stat('today', dueToday.length, t('stDueToday'), 'warn', 'today')}
      ${stat('calendar', week.length, t('hWeek'), 'info', 'calendar')}
      ${stat('others', withOthers.length, t('hOthers'), 'violet', 'waiting')}
      ${stat('closed', closedWeek.length, t('hClosedWeek'), 'ok', 'closed')}
    </div>
    <div class="h-cols">
      <div class="h-col">
        ${panel(t('hFocus'), 'today', focus.length ? capped(focus, 7, 'today') : empty(t('hAllClear')), focus.length > 7 ? 'today' : '')}
        ${panel(t('hComing'), 'calendar', coming || empty(t('hNothing')), 'calendar')}
      </div>
      <div class="h-col">
        ${reminders.length ? panel(t('hReminders'), 'bell', reminders.map((x) =>
          `<div class="h-row" data-task="${x.id}"><span class="h-time ${x.remindAt <= nowLocal() ? 'past' : ''}">${fmtTime(x.remindAt, lang())}</span><span class="h-title" dir="auto">${esc(x.title)}</span></div>`).join('')) : ''}
        ${people.size ? panel(t('hWaiting'), 'waiting', `<div class="h-people">${waiting}</div>`, 'others') : ''}
        ${areaList.length ? panel(t('hAreasTitle'), 'folder', `<div class="h-areas">${areas}</div>`) : ''}
      </div>
    </div>
    <p class="h-foot small muted">${t('openTasks')}: ${open.length} · ${t('closedThisMonth')}: ${closedMonth}${avg !== null ? ` · ${t('avgClose')}: ${daysWord(avg, lang())}` : ''}</p>
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
