// ---------------- the week: review, goals, and what your data says about you ----------------
// Once a week (on its last day, or in the first days of the next one) you look back:
// what got done, focus time, habits, your plans, what keeps getting put off. Then you pick up to
// three goals for the coming week; they sit at the top of the Today page all week.
// data.weekGoals = { 'YYYY-MM-DD' (week start): [{ id, text, done }] }
// data.planLog   = { 'YYYY-MM-DD': [task ids] }   (each day's plan, to see how plans went)

const wkStart = (d = todayStr()) => hWeekStart({}, d);
const inRange = (d, a, b) => d && d >= a && d <= b;

// Which week to review: the one ending now, or last week if it just ended and wasn't reviewed.
function weekToReview() {
  const td = todayStr(), cur = wkStart(td);
  const prev = hAdd(cur, -7);
  return daysBetween(cur, td) <= 1 && data.settings.lastWeekReview !== prev ? prev : cur;
}

function weekStats(ws) {
  const we = hAdd(ws, 6), td = todayStr(), end = we < td ? we : td;
  const closed = data.tasks.filter((x) => inRange(x.closure, ws, we));
  const focusMin = (data.focusLog || []).filter((l) => inRange(l.at.slice(0, 10), ws, we)).reduce((n, l) => n + l.ms, 0) / 60000;
  // Habits: how much of what was due got done (a partly done day counts for its share).
  const habitRows = [];
  for (const h of data.habits || []) {
    if (h.archived || h.start > end) continue;
    if (h.kind === 'days') {
      const days = [...Array(7)].map((_, i) => hAdd(ws, i)).filter((d) => d <= end && hScheduled(h, d) && hLog(h, d) !== 'skip');
      if (!days.length) continue;
      const got = days.reduce((n, d) => n + (hLog(h, d) === 'done' ? 1 : hPartial(h, d)), 0);
      habitRows.push({ h, ratio: got / days.length, label: `${Math.round(got * 10) / 10} / ${days.length}` });
    } else {
      const w = hWeek(h, ws), val = hWeekVal(h, w), target = hTarget(h);
      habitRows.push({ h, ratio: Math.min(1, val / target), label: h.kind === 'times' ? `${val} / ${target}` : `${fmtMins(val, lang())} / ${fmtMins(target, lang())}` });
    }
  }
  const habitPct = habitRows.length ? Math.round((habitRows.reduce((n, r) => n + r.ratio, 0) / habitRows.length) * 100) : null;
  // Plans: days whose plan was all done by the end of that day.
  const plans = Object.entries(data.planLog || {}).filter(([d]) => inRange(d, ws, end));
  const plansKept = plans.filter(([d, ids]) => ids.length && ids.every((id) => { const x = taskById(id); return !x || (x.closure && x.closure <= d); })).length;
  const perDay = [...Array(7)].map((_, i) => { const d = hAdd(ws, i); return { d, closed: closed.filter((x) => x.closure === d).length, focus: (data.focusLog || []).filter((l) => l.at.startsWith(d)).reduce((n, l) => n + l.ms, 0) / 60000 }; });
  return { ws, we, closed, focusMin, habitRows, habitPct, plans: plans.length, plansKept, perDay };
}

// A few things worth knowing, from the last four weeks.
function insights() {
  const td = todayStr(), from = hAdd(td, -28), out = [];
  const ar = lang() === 'ar';
  const logs = (data.focusLog || []).filter((l) => l.at.slice(0, 10) >= from);
  const total = logs.reduce((n, l) => n + l.ms, 0) / 60000;
  if (total >= 60) {
    const byHour = Array(24).fill(0);
    for (const l of logs) byHour[Number(l.at.slice(11, 13))] += l.ms;
    let best = 0;
    for (let h = 0; h < 23; h++) if (byHour[h] + byHour[h + 1] > byHour[best] + byHour[best + 1]) best = h;
    const span = `${fmtTime(`2000-01-01T${String(best).padStart(2, '0')}:00`, lang())} – ${fmtTime(`2000-01-01T${String(best + 2).padStart(2, '0')}:00`, lang())}`;
    out.push({ ico: 'clock', text: t('inBestHours').replace('{t}', span) });
  }
  const closed = data.tasks.filter((x) => x.closure && x.closure >= from);
  if (closed.length >= 5) {
    const byDay = Array(7).fill(0);
    closed.forEach((x) => byDay[hDow(x.closure)]++);
    const best = byDay.indexOf(Math.max(...byDay));
    out.push({ ico: 'calendar', text: t('inBestDay').replace('{d}', new Date(2024, 0, 7 + best).toLocaleDateString(ar ? 'ar-EG-u-nu-latn' : 'en-GB', { weekday: 'long' })) });
  }
  const put = {};
  data.tasks.filter((x) => !x.closure && (x.postponed || 0) >= 2).forEach((x) => { const k = areaLabel(x.areaId); put[k] = (put[k] || 0) + x.postponed; });
  const worst = Object.entries(put).sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] >= 3) out.push({ ico: 'overdue', text: t('inPutOff').replace('{f}', worst[0]).replace('{n}', timesWord(worst[1], lang())) });
  return out;
}

function openWeekReview() {
  const ws = weekToReview();
  const s = weekStats(ws), p = weekStats(hAdd(ws, -7));
  const next = hAdd(ws, 7);
  const goalsNow = (data.weekGoals || {})[ws] || [];
  const goalsNext = (data.weekGoals || {})[next] || [];
  const loc = lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  // ▲/▼ against the week before, in the same unit as the number.
  const trend = (a, b, fmt) => (b === null || b === undefined || Math.round(a) === Math.round(b) ? '' : `<em class="${a > b ? 'up' : 'down'}" title="${t('wkVsLast')}">${a > b ? '▲' : '▼'} ${fmt(Math.abs(Math.round(a - b)))}</em>`);
  const big = (val, label, prev, fmt = (v) => v) => `<div class="rv-big"><b>${fmt(val)}</b><span>${label} ${prev !== null ? trend(val, prev, fmt) : ''}</span></div>`;
  const maxC = Math.max(1, ...s.perDay.map((d) => d.closed)), maxF = Math.max(1, ...s.perDay.map((d) => d.focus));
  const stuck = data.tasks.filter((x) => !x.closure && (x.postponed || 0) >= 2).sort((a, b) => b.postponed - a.postponed).slice(0, 3);
  const ins = insights();
  const bg = document.createElement('div');
  bg.className = 'modal-bg week-bg';
  bg.innerHTML = `<div class="modal week" role="dialog">
    <div class="pl-head"><span class="pl-ico">${icon('calendar')}</span><div><h3>${t('wkTitle')}</h3><p class="small muted">${fmtDate(ws, lang())} → ${fmtDate(s.we, lang())}</p></div></div>
    <div class="wk-body">
      <div class="rv-win">
        ${big(s.closed.length, t('wkClosed'), p.closed.length)}
        ${big(Math.round(s.focusMin), t('wkFocus'), Math.round(p.focusMin), (v) => fmtMins(v, lang()))}
        ${s.habitPct !== null ? big(s.habitPct, t('wkHabits'), p.habitPct, (v) => v + '%') : ''}
        ${s.plans ? `<div class="rv-big"><b>${s.plansKept}/${s.plans}</b><span>${t('wkPlans')}</span></div>` : ''}
      </div>
      <div class="wk-days">${s.perDay.map((d) => `<div class="wk-day ${d.d === todayStr() ? 'today' : ''}" title="${fmtDate(d.d, lang())}: ${d.closed} · ${fmtMins(d.focus, lang())}">
        <span class="bars"><i class="c" style="height:${(d.closed / maxC) * 100}%"></i><i class="f" style="height:${(d.focus / maxF) * 100}%"></i></span>
        <small>${new Date(d.d + 'T00:00').toLocaleDateString(loc, { weekday: 'short' })}</small></div>`).join('')}
        <div class="wk-key"><span><i class="c"></i>${t('wkClosed')}</span><span><i class="f"></i>${t('wkFocus')}</span></div></div>
      ${s.habitRows.length ? `<h4 class="rv-h">${t('habits')}</h4><div class="wk-habits">${s.habitRows.map((r) => `<div class="wk-hrow" style="--hc:var(--c-${r.h.color || 'blue'})"><span>${esc(r.h.emoji || '')} <span dir="auto">${esc(r.h.name)}</span></span><span class="wk-hbar"><i style="width:${Math.round(r.ratio * 100)}%"></i></span><b class="${r.ratio >= 1 ? 'ok' : r.ratio < 0.5 ? 'bad' : ''}">${r.label}</b></div>`).join('')}</div>` : ''}
      ${stuck.length ? `<h4 class="rv-h">${t('wkStuck')}</h4>${stuck.map((x) => `<div class="rv-row"><span class="rv-t" dir="auto">${esc(x.title)} <span class="postponed">↻ ${timesWord(x.postponed, lang())}</span></span><span class="rv-acts"><button data-wk-open="${x.id}">${t('open')}</button></span></div>`).join('')}` : ''}
      ${ins.length ? `<h4 class="rv-h">${t('wkInsights')}</h4><div class="wk-ins">${ins.map((i) => `<div>${icon(i.ico)}<span>${esc(i.text)}</span></div>`).join('')}</div>` : ''}
      ${goalsNow.length ? `<h4 class="rv-h">${t('wkGoalsWere')}</h4><div class="wk-goals-old">${goalsNow.map((g) => `<label><input type="checkbox" data-goal="${ws}:${g.id}" ${g.done ? 'checked' : ''}> <span dir="auto">${esc(g.text)}</span></label>`).join('')}</div>` : ''}
      <h4 class="rv-h">${t('wkGoalsNext')} <small class="muted">${fmtDate(next, lang())} →</small></h4>
      <div class="wk-goals-new">${[0, 1, 2].map((i) => `<input type="text" dir="auto" class="wk-goal-in" placeholder="${t('wkGoalPh').replace('{n}', i + 1)}" value="${esc((goalsNext[i] || {}).text || '')}">`).join('')}</div>
    </div>
    <div class="actions"><span style="flex:1"></span><button class="primary" data-wk-ok>${t('wkDone')}</button></div></div>`;
  document.body.appendChild(bg);
  const save2 = () => {
    const texts = [...bg.querySelectorAll('.wk-goal-in')].map((i) => i.value.trim()).filter(Boolean);
    data.weekGoals = data.weekGoals || {};
    const old = data.weekGoals[next] || [];
    if (texts.length) data.weekGoals[next] = texts.map((text) => old.find((g) => g.text === text) || { id: uid(), text, done: false });
    else delete data.weekGoals[next];
    data.settings.lastWeekReview = ws;
    save();
  };
  const close = () => { document.removeEventListener('keydown', onKey, true); bg.classList.add('leaving'); setTimeout(() => bg.remove(), 150); refresh(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); save2(); close(); } };
  document.addEventListener('keydown', onKey, true);
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) { save2(); close(); } });
  bg.addEventListener('click', (e) => {
    if (e.target.closest('[data-wk-ok]')) { save2(); close(); }
    const o = e.target.closest('[data-wk-open]');
    if (o) { save2(); close(); ui.view = 'pending'; ui.selected = o.dataset.wkOpen; refresh(); }
  });
}

// Goals of this week, at the top of Today.
function weekGoalsHtml() {
  const ws = wkStart();
  const goals = (data.weekGoals || {})[ws] || [];
  if (!goals.length) return '';
  return `<div class="wk-strip"><span class="wk-strip-t">${icon('target')} ${t('wkGoalsThis')} · ${goals.filter((g) => g.done).length}/${goals.length}</span>
    ${goals.map((g) => `<label class="wk-goal ${g.done ? 'done' : ''}"><input type="checkbox" data-goal="${ws}:${g.id}" ${g.done ? 'checked' : ''}><span dir="auto">${esc(g.text)}</span></label>`).join('')}</div>`;
}
// "Your week ended: review it" (first days of a new week, if last week had anything in it).
function weekBannerHtml() {
  const td = todayStr(), cur = wkStart(td), prev = hAdd(cur, -7);
  if (daysBetween(cur, td) > 2 || data.settings.lastWeekReview === prev || data.settings.weekBannerHidden === prev) return '';
  const busy = data.tasks.some((x) => inRange(x.closure, prev, hAdd(prev, 6))) || (data.focusLog || []).some((l) => inRange(l.at.slice(0, 10), prev, hAdd(prev, 6)));
  if (!busy) return '';
  return `<div class="wk-banner">${icon('calendar')}<span><b>${t('wkBanner')}</b><small>${t('wkBannerSub')}</small></span>
    <button class="primary" data-weekreview>${t('wkBannerGo')}</button><button class="icon" data-wk-hide="${prev}" title="${t('hide')}">✕</button></div>`;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-weekreview]')) { e.preventDefault(); return openWeekReview(); }
  const h = e.target.closest('[data-wk-hide]');
  if (h) { data.settings.weekBannerHidden = h.dataset.wkHide; save(); return renderList(); }
});
document.addEventListener('change', (e) => {
  const g = e.target.closest && e.target.closest('[data-goal]');
  if (!g) return;
  const [ws, id] = g.dataset.goal.split(':');
  const goal = ((data.weekGoals || {})[ws] || []).find((x) => x.id === id);
  if (goal) { goal.done = g.checked; save(); if (!g.closest('.modal')) renderList(); }
});
