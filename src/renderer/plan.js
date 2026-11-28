// ---------------- morning plan + end-of-day review ----------------
// Morning: pick 3–5 things to finish today (data.plan). They lead the Today page.
// Evening: see what got done, and move what's left to tomorrow in one click. What you move
// is offered first in tomorrow's plan (data.planNext).

const PLAN_MAX = 5;
// Today's plan. Open items never belong in it (they have no day to be done on), so any that got
// in (a task picked for today, then turned into an open item) are dropped.
function todayPlan() {
  const p = data.plan;
  if (!p || p.date !== todayStr()) return null;
  if (p.ids.some((id) => taskById(id)?.topic)) p.ids = p.ids.filter((id) => !taskById(id)?.topic);
  return p;
}
function inPlan(x) { const p = todayPlan(); return !!p && p.ids.includes(x.id); }
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return todayStr(d); };

// Review tab: switch between the report and the closed list. ("Review your day" lives on Today only.)
function reviewSubBar() {
  const b = (v, label) => `<button class="${ui.view === v ? 'on' : ''}" data-rview="${v}">${label}</button>`;
  return `<div class="sub-bar review-bar"><span class="seg-joined">${b('report', `${icon('report')} ${t('report')}`)}${b('daylog', `${icon('log')} ${t('dayLog')}`)}${b('closed', `${icon('closed')} ${t('closed')}`)}</span>
    <button class="link" data-weekreview>${icon('calendar')} ${t('wkBtn')}</button></div>`;
}

function planCandidates() {
  const td = todayStr();
  const open = data.tasks.filter((x) => isActive(x) || (statusOf(x) === 'scheduled' && x.due && x.due <= tomorrowStr()));
  const next = data.planNext && data.planNext.date === td ? data.planNext.ids : [];
  const seen = new Set();
  const take = (xs) => xs.sort(byPriorityThenDue).filter((x) => !seen.has(x.id) && seen.add(x.id));
  const soon = (() => { const d = new Date(); d.setDate(d.getDate() + 2); return todayStr(d); })();
  return [
    ['fromYesterday', take(open.filter((x) => next.includes(x.id)))],
    ['overdue', take(open.filter((x) => statusOf(x) === 'overdue'))],
    ['stDueToday', take(open.filter((x) => statusOf(x) === 'today'))],
    ['hDoNow', take(open.filter((x) => x.priority === 'q1'))],
    ['starred', take(open.filter((x) => x.starred))],
    ['planSoon', take(open.filter((x) => x.due && x.due <= soon))],
    ['planOthers', take(open.slice())]
  ].filter(([, xs]) => xs.length);
}

function openPlan() {
  const groups = planCandidates();
  const cur = todayPlan();
  let picked = new Set(cur ? cur.ids : []);
  // A fresh plan starts from a suggestion: the most pressing things that fit in your day.
  const suggest = () => {
    const cands = groups.flatMap(([, xs]) => xs);
    const habitMins = habitsToday().reduce((n, h) => n + (h.duration && h.kind !== 'minutes' && hLog(h, todayStr()) !== 'done' ? h.duration : 0), 0);
    const next = data.planNext && data.planNext.date === todayStr() ? data.planNext.ids : [];
    return suggestPlan(cands, Math.max(60, dayCapacity() - habitMins), { fromYesterday: next });
  };
  if (!cur) suggest().forEach((id) => picked.add(id));
  const row = (x) => {
    const w = whenInfo(x);
    return `<label class="pl-row"><input type="checkbox" data-pick="${x.id}" ${picked.has(x.id) ? 'checked' : ''}>
      ${x.priority ? `<span class="pnum ${x.priority}">${PRIO_NUM[x.priority]}</span>` : '<span class="pnum none"></span>'}
      <span class="pl-t" dir="auto">${esc(x.title)}</span>${w ? `<span class="when ${w.cls}">${w.text}</span>` : ''}</label>`;
  };
  const bg = document.createElement('div');
  bg.className = 'modal-bg plan-bg';
  bg.innerHTML = `<div class="modal plan" role="dialog">
    <div class="pl-head"><span class="pl-ico">${icon('today')}</span><div><h3>${t('planTitle')}</h3><p class="small muted">${t('planIntro').replace('{n}', PLAN_MAX)}</p></div>
      <button class="pl-suggest" id="plSuggest" title="${t('planSuggestTip')}">✨ ${t('planSuggest')}</button></div>
    <div class="pl-list">${groups.length ? groups.map(([k, xs], i) => `<details class="pl-group" ${i < 4 || k === 'fromYesterday' ? 'open' : ''}><summary>${t(k)} · ${xs.length}</summary>${xs.slice(0, 30).map(row).join('')}</details>`).join('') : `<div class="h-empty">${t('planNothing')}</div>`}</div>
    <div class="pl-count" id="plCount"></div><div id="plCap"></div>
    <label class="pl-auto small"><input type="checkbox" id="plAuto" ${data.settings.planAuto !== false ? 'checked' : ''}> ${t('planAuto')}</label>
    <div class="actions"><button id="plSkip">${t('planSkip')}</button><span style="flex:1"></span><button class="primary" id="plGo">${icon('today')} ${t('planGo')}</button></div></div>`;
  document.body.appendChild(bg);
  const count = () => {
    const n = picked.size;
    $('plCount').className = 'pl-count' + (n > PLAN_MAX ? ' warn' : '');
    $('plCount').textContent = n > PLAN_MAX ? t('planTooMany').replace('{n}', n) : `${t('planPicked')} ${n} / ${PLAN_MAX}`;
    $('plGo').disabled = !n;
  };
  bg.addEventListener('est-changed', count);
  count();
  const close = () => { document.removeEventListener('keydown', onKey, true); bg.classList.add('leaving'); setTimeout(() => bg.remove(), 150); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  bg.addEventListener('change', (e) => {
    const c = e.target.closest('[data-pick]');
    if (c) { c.checked ? picked.add(c.dataset.pick) : picked.delete(c.dataset.pick); count(); }
    if (e.target.id === 'plAuto') { data.settings.planAuto = e.target.checked; save(); }
  });
  bg.onclick = (e) => {
    if (e.target === bg || e.target.closest('#plSkip')) return close();
    if (e.target.closest('#plSuggest')) {
      picked = new Set(suggest());
      bg.querySelectorAll('[data-pick]').forEach((c) => { c.checked = picked.has(c.dataset.pick); });
      return count();
    }
    if (e.target.closest('#plGo')) {
      // Keep the plan's order: what was there first, then the new picks by priority.
      const all = groups.flatMap(([, xs]) => xs).map((x) => x.id);
      const ids = [...(cur ? cur.ids.filter((id) => picked.has(id)) : []), ...all.filter((id) => picked.has(id) && !(cur && cur.ids.includes(id)))];
      data.plan = { date: todayStr(), ids };
      data.planLog = data.planLog || {};
      data.planLog[todayStr()] = ids;
      for (const d of Object.keys(data.planLog)) if (d < hAdd(todayStr(), -90)) delete data.planLog[d];
      save(); close();
      ui.view = 'today'; ui.selected = null; refresh(); animateIn($('list'));
    }
  };
}

// Opens the plan by itself once a day (the first time you see the app after 5 AM).
function maybeAskPlan() {
  if (!data || data.settings.planAuto === false || todayPlan() || new Date().getHours() < 5) return;
  if (data.settings.lastPlanAsk === todayStr()) return;
  if (document.querySelector('.modal-bg') || $('modalRoot').innerHTML) return setTimeout(maybeAskPlan, 1500); // after "what's new"
  if (!planCandidates().length) return;
  data.settings.lastPlanAsk = todayStr(); save();
  openPlan();
}
window.addEventListener('focus', () => setTimeout(maybeAskPlan, 400));

// ---------- end-of-day review ----------
function openReview() {
  const td = todayStr();
  const doneToday = data.tasks.filter((x) => x.closure === td);
  const plan = todayPlan();
  const seen = new Set();
  const left = [...(plan ? plan.ids.map(taskById) : []), ...data.tasks.filter((x) => isActive(x) && ['overdue', 'today'].includes(statusOf(x)))]
    .filter((x) => x && !x.closure && !seen.has(x.id) && seen.add(x.id));
  const focusMs = (data.focusLog || []).filter((l) => l.at.startsWith(td)).reduce((n, l) => n + l.ms, 0);
  // The last 7 days, tasks closed per day.
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return todayStr(d); });
  const perDay = days.map((d) => data.tasks.filter((x) => x.closure === d).length);
  const max = Math.max(1, ...perDay);
  const loc = lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  const bg = document.createElement('div');
  bg.className = 'modal-bg review-bg';
  const leftRow = (x) => { const w = whenInfo(x); return `<div class="rv-row" data-rv="${x.id}">
      <span class="rv-t" dir="auto">${x.priority ? `<span class="pnum ${x.priority}">${PRIO_NUM[x.priority]}</span> ` : ''}${esc(x.title)}${w ? ` <span class="when ${w.cls}">${w.text}</span>` : ''}</span>
      <span class="rv-acts"><button data-rva="tomorrow">${t('tomorrowLbl')} →</button><button class="ok" data-rva="done">✓</button></span></div>`; };
  bg.innerHTML = `<div class="modal review" role="dialog">
    <div class="pl-head"><span class="pl-ico">${icon('moon')}</span><div><h3>${t('reviewTitle')}</h3><p class="small muted">${new Date().toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div></div>
    <div class="rv-win">
      <div class="rv-big"><b>${doneToday.length}</b><span>${t('rvDone')}</span></div>
      ${focusMs >= 60000 ? `<div class="rv-big"><b>${focusTimeLabel(Math.round(focusMs / 60000))}</b><span>${t('rvFocus')}</span></div>` : ''}
      ${plan ? `<div class="rv-big"><b>${plan.ids.filter((id) => taskById(id)?.closure).length}/${plan.ids.length}</b><span>${t('rvPlan')}</span></div>` : ''}
      <div class="rv-week" title="${t('rvWeek')}">${perDay.map((n, i) => `<span class="${days[i] === td ? 'today' : ''}" title="${fmtDate(days[i], lang())}: ${n}"><i style="height:${Math.max(4, (n / max) * 100)}%"></i><small>${new Date(days[i] + 'T00:00').toLocaleDateString(loc, { weekday: 'narrow' })}</small></span>`).join('')}</div>
    </div>
    ${doneToday.length ? `<details class="rv-done"><summary>${t('rvDoneList')}</summary>${doneToday.map((x) => `<div dir="auto">✓ ${esc(x.title)}</div>`).join('')}</details>` : ''}
    ${(() => { const hs = habitsToday().filter((h) => h.kind !== 'minutes'); return hs.length ? `<h4 class="rv-h">${t('rvHabits')}</h4><div class="rv-habits">${hs.map(habitRowHtml).join('')}</div>` : ''; })()}
    <h4 class="rv-h">${left.length ? `${t('rvLeft')} · ${left.length}` : t('rvAllDone')}</h4>
    <div class="rv-left" id="rvLeft">${left.map(leftRow).join('')}</div>
    <div class="actions">${left.length ? `<button id="rvAll">${t('rvMoveAll')}</button>` : ''}<span style="flex:1"></span><button class="primary" id="rvOk">${t('rvBye')} 👋</button></div></div>`;
  document.body.appendChild(bg);
  const close = () => { document.removeEventListener('keydown', onKey, true); bg.classList.add('leaving'); setTimeout(() => bg.remove(), 150); refresh(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  const toTomorrow = (x) => {
    const tm = tomorrowStr();
    const before = x.due;
    if (!x.due || x.due < tm) { x.due = tm; notePostpone(x, before); syncReminder(x); }
    const n = data.planNext && data.planNext.date === tm ? data.planNext : { date: tm, ids: [] };
    if (!n.ids.includes(x.id)) n.ids.push(x.id);
    data.planNext = n;
    touch(x);
  };
  const gone = (row, text) => { row.classList.add('moved'); row.querySelector('.rv-acts').innerHTML = `<span class="small muted">${text}</span>`; };
  bg.onclick = (e) => {
    if (e.target === bg || e.target.closest('#rvOk')) return close();
    const a = e.target.closest('[data-rva]');
    if (a) {
      const row = a.closest('[data-rv]'); const x = taskById(row.dataset.rv); if (!x) return;
      if (a.dataset.rva === 'tomorrow') { toTomorrow(x); gone(row, `→ ${t('tomorrowLbl')}`); }
      if (a.dataset.rva === 'done') { setClosed(x, true); gone(row, `✓ ${t('closedOn')}`); }
      return;
    }
    if (e.target.closest('#rvAll')) {
      bg.querySelectorAll('.rv-row:not(.moved)').forEach((row) => { const x = taskById(row.dataset.rv); if (x) { toTomorrow(x); gone(row, `→ ${t('tomorrowLbl')}`); } });
      e.target.closest('#rvAll').disabled = true;
    }
  };
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-plan]')) { e.preventDefault(); return openPlan(); }
  if (e.target.closest('[data-review]')) { e.preventDefault(); return openReview(); }
  const rv = e.target.closest('[data-rview]');
  if (rv && ui.view !== rv.dataset.rview) { ui.view = rv.dataset.rview; ui.selected = null; refresh(); }
});
window.api.onOpenReview && window.api.onOpenReview((kind) => {
  if (kind === 'week') { if (!document.querySelector('.modal.week')) openWeekReview(); }
  else if (!document.querySelector('.modal.review')) openReview();
});
