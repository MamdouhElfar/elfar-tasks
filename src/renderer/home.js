// ---------------- Today: the page the app opens on ----------------
// Home and Today in one: how the day looks at the top, the tasks to work on (your plan
// first) on the main side, and what's around them (reminders, who you wait on, what's
// coming, folders) on the other. Everything follows the folder picked in the sidebar.

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

  const chip = (go, n, label, cls) => (n ? `<button class="h-chip ${cls}" data-go="${go}"><b>${n}</b> ${label}</button>` : '');
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
  // The work list: your plan for today first, then what's late, due today, and starred.
  const plan = todayPlan();
  const planned = plan ? plan.ids.map(taskById).filter((x) => x && inScope(x) && (!x.closure || x.closure === td)) : [];
  planned.forEach((x) => seen.add(x.id));
  // The Now card's task isn't repeated in the lists under it (unless it's part of the plan).
  const nowPick = pickNow(plan, overdue, dueToday, open);
  if (nowPick && !planned.includes(nowPick.x)) seen.add(nowPick.x.id);
  const take = (xs) => xs.filter((x) => !seen.has(x.id) && seen.add(x.id));
  const lateRest = take(overdue), todayRest = take(dueToday);
  const starredRest = take(open.filter((x) => x.starred));
  const doNow = take(open.filter((x) => x.priority === 'q1'));
  ui.todayOrder = [...planned, ...lateRest, ...todayRest, ...starredRest, ...doNow].map((x) => x.id);
  const sec = (title, cls, xs, extra = '') => (xs.length ? `<div class="group-title ${cls}">${title} · ${xs.length}${extra}</div>${xs.map(rowHtml).join('')}` : '');
  const planDone = planned.filter((x) => x.closure).length;
  const work = (plan
      ? `<div class="group-title plan-title">${icon('today')} ${t('planTitle')} <span class="plan-n">${planDone}/${planned.length}</span><button class="link" data-plan>${t('planEdit')}</button></div>${capacityHtml(plannedLoad(planned))}
         ${planned.length ? planned.filter((x) => !x.closure).map(rowHtml).join('') + doneFold(planned.filter((x) => x.closure).map(rowHtml), 'plan') : `<div class="h-empty">${t('planEmpty')}</div>`}`
      : `<button class="plan-cta" data-plan><span class="pc-ico">${icon('today')}</span><span><b>${t('planCta')}</b><small>${t('planCtaSub')}</small></span></button>`) +
    (() => { const hs = habitsToday(); return hs.length ? `<div class="group-title habit-title">${icon('habits')} ${t('hbToday')} · ${hs.filter((h) => hLog(h, td) === 'done').length}/${hs.length}<button class="link" data-hopen>${t('hSeeAll')}</button></div>${hs.filter((h) => hLog(h, td) !== 'done').map(habitRowHtml).join('')}${doneFold(hs.filter((h) => hLog(h, td) === 'done').map(habitRowHtml), 'habits')}` : ''; })() +
    sec(t('overdue'), 'danger', lateRest) + sec(t('stDueToday'), '', todayRest) + sec(t('starred'), '', starredRest) + sec(t('hDoNow'), '', doNow);

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
      <div class="h-hi"><h2>${greet} 👋</h2><span class="muted">${longDate}</span>
        <div class="h-chips">${chip('pending', overdue.length, t('overdue'), 'danger')}${chip('pending', dueToday.length, t('stDueToday'), 'warn')}${chip('others', withOthers.length, t('hOthers'), 'violet')}${chip('calendar', week.length, t('hWeek'), '')}${chip('closed', closedWeek.length, t('hClosedWeek'), 'ok')}${!overdue.length && !dueToday.length ? `<span class="h-sum">${t('hAllClear')}</span>` : ''}</div></div>
      ${dayTotal ? `<div class="h-day-prog" title="${doneToday} / ${dayTotal}">
        <div class="h-ring" style="--p:${pct}"><b>${doneToday}<small>/${dayTotal}</small></b></div>
        <span>${t('hDoneToday')}</span></div>` : ''}
      <div class="h-btns"><button class="h-review" data-review title="${t('reviewTip')}">${icon('moon')} ${t('reviewBtn')}</button></div>
    </div>
    ${weekBannerHtml()}${weekGoalsHtml()}
    <div class="h-cols today-cols">
      <div class="h-col t-work">
        ${nowPick ? nowCardHtml(nowPick) : ''}
        ${work || empty(t('hAllClear'))}
      </div>
      <div class="h-col">
        ${reminders.length ? panel(t('hReminders'), 'bell', reminders.map((x) =>
          `<div class="h-row" data-task="${x.id}"><span class="h-time ${x.remindAt <= nowLocal() ? 'past' : ''}">${fmtTime(x.remindAt, lang())}</span><span class="h-title" dir="auto">${esc(x.title)}</span></div>`).join('')) : ''}
        ${people.size ? panel(t('hWaiting'), 'waiting', `<div class="h-people">${waiting}</div>`, 'others') : ''}
        ${panel(t('hComing'), 'calendar', coming || empty(t('hNothing')), 'calendar')}
      </div>
    </div>
  </div>`;
}

// What's already done today folds into one line ("✓ 2 done"), so Today shows what's left.
function doneFold(rows, key) {
  if (!rows.length) return '';
  ui.foldOpen = ui.foldOpen || {};
  return `<details class="done-fold" data-fold="${key}" ${ui.foldOpen[key] ? 'open' : ''}><summary>✓ ${t('doneFold').replace('{n}', rows.length)}</summary>${rows.join('')}</details>`;
}
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.matches && d.matches('[data-fold]')) { ui.foldOpen = ui.foldOpen || {}; ui.foldOpen[d.dataset.fold] = d.open; }
}, true);

// The one thing to do now: the first open task of your plan, else what's late, due today
// (soonest time first), important & urgent, or starred. "Not now" shows the next one.
function pickNow(plan, overdue, dueToday, open) {
  if (data.focus && ['work', 'ended'].includes(data.focus.mode)) return null; // the focus bar already says it
  ui.nowSkip = ui.nowSkip || [];
  const ok = (x) => x && inScope(x) && isActive(x) && !ui.nowSkip.includes(x.id);
  const byTime = (a, b) => (a.dueTime || '99').localeCompare(b.dueTime || '99') || byPriorityThenDue(a, b);
  const lists = [
    [plan ? plan.ids.map(taskById) : [], 'nowFromPlan'],
    [overdue.slice().sort(byPriorityThenDue), 'nowLate'],
    [dueToday.slice().sort(byTime), 'nowToday'],
    [open.filter((x) => x.priority === 'q1').sort(byPriorityThenDue), 'nowDoNow'],
    [open.filter((x) => x.starred), 'nowStarred']
  ];
  for (const [xs, why] of lists) { const x = xs.find(ok); if (x) return { x, why }; }
  return null;
}
// Why this task is "now", said once: "2 days late", "Due today · 2:00 PM", "From your plan"…
function nowWhy(why, x, w) {
  if (why === 'nowLate' && w) return w.text;
  if (why === 'nowToday') return t('nowToday') + (x.dueTime ? ` · ${fmtTime(`${x.due}T${x.dueTime}`, lang())}` : '');
  return t(why) + (w && w.cls === 'overdue' ? ` · ${w.text}` : '');
}
function nowCardHtml({ x, why }) {
  const w = whenInfo(x);
  const next = (x.subtasks || []).find((s) => !s.done);
  const left = minutesLeft(x);
  return `<section class="now-card ${quadClass(x)}">
    <div class="now-top"><span class="now-lbl">${icon('target')} ${t('nowLbl')}</span><span class="now-why">${nowWhy(why, x, w)}</span>
      <button class="link now-skip" data-nowskip="${x.id}" title="${t('nowSkipTip')}">${t('nowSkip')} ›</button></div>
    <h3 dir="auto" data-task="${x.id}">${x.starred ? '<span class="star">★</span> ' : ''}${esc(x.title)}</h3>
    ${next ? `<div class="now-next"><span class="arrow">↳</span> <span dir="auto">${esc(next.title)}</span></div>` : ''}
    <div class="now-acts"><button class="primary now-go" data-focus="${x.id}">▶ ${t('nowStart')}${left ? ` · ${fmtMins(left, lang())}` : ''}</button><button class="ok" data-check="${x.id}">✓ ${t('nowDone')}</button><button class="ghost now-defer" data-defer="${x.id}" title="${t('dfTip')}">${icon('calendar')} ${t('dfShort')}</button>${estChip(x)}</div>
  </section>`;
}
document.addEventListener('click', (e) => {
  const s = e.target.closest && e.target.closest('[data-nowskip]');
  if (!s) return;
  e.stopPropagation();
  (ui.nowSkip = ui.nowSkip || []).push(s.dataset.nowskip);
  renderList();
}, true);

// Where each number / row on Home leads.
function homeGo(go) {
  const [kind, id] = go.split(':');
  if (kind === 'today' || kind === 'calendar' || kind === 'closed') ui.view = kind;
  if (kind === 'pending') { ui.view = 'pending'; ui.pendingSub = 'all'; }
  if (kind === 'others') { ui.view = 'pending'; ui.pendingSub = 'others'; }
  if (kind === 'person') { ui.person = id; ui.view = 'pending'; ui.pendingSub = 'others'; }
  if (kind === 'area') { ui.scope = id; ui.view = 'pending'; ui.pendingSub = 'all'; }
  if (kind === 'calendar') ui.calMonth = null;
  ui.selected = null;
  refresh();
  animateIn($('list'));
}
