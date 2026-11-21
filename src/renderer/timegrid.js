// ---------------- Calendar › Week and Day: hours, time blocks and a "now" line ----------------
// A task can be given a time block: task.blockAt = 'YYYY-MM-DDTHH:MM', task.blockMins = length
// (defaults to its estimate, or 30 min). Drag tasks from "No time yet" onto an hour, drag a block
// to move it (to another hour or day), pull its bottom edge to make it longer or shorter.
// Tasks with a due time and habits with a time show too. A red line marks the current time.

const TG_PX = 0.8;          // pixels per minute (48 px per hour)
const TG_SNAP = 15;         // minutes
const tgMins = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const tgHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const blockLen = (x) => x.blockMins || x.estimate || 30;

function calView() { return data.settings.calView || 'month'; }
function calViewSeg() {
  const v = calView();
  const b = (id, label) => `<button class="${v === id ? 'on' : ''}" data-calview="${id}">${label}</button>`;
  return `<span class="seg-joined cal-views">${b('month', t('cvMonth'))}${b('week', t('cvWeek'))}${b('day', t('cvDay'))}</span>`;
}

// Everything that happens on a day, in minutes from midnight.
function dayEvents(day) {
  const ev = [];
  for (const x of data.tasks) {
    if (!inScope(x) || (ui.person && !isPendingWith(x, ui.person))) continue;
    if (x.blockAt && x.blockAt.startsWith(day)) {
      const s = tgMins(x.blockAt.slice(11)); ev.push({ id: x.id, kind: 'block', x, start: s, end: Math.min(1440, s + blockLen(x)) });
    } else if (!x.blockAt && x.due === day && x.dueTime && !x.closure) {
      const s = tgMins(x.dueTime); ev.push({ id: x.id, kind: 'due', x, start: s, end: Math.min(1440, s + (x.estimate || 30)) });
    }
  }
  for (const h of data.habits || []) {
    if (!h.time || h.archived || !hActiveOn(h, day)) continue;
    const due = h.kind === 'days' ? hScheduled(h, day) : true;
    if (!due) continue;
    const s = tgMins(h.time); ev.push({ id: 'h:' + h.id, kind: 'habit', h, start: s, end: Math.min(1440, s + (h.duration || 30)) });
  }
  return layoutBlocks(ev);
}
// Tasks for a day that don't have a time yet (to drag onto the hours).
function dayUntimed(day) {
  const td = todayStr();
  const plan = todayPlan();
  return data.tasks.filter((x) => inScope(x) && !x.closure && !x.blockAt && !(x.dueTime && x.due === day) && (!ui.person || isPendingWith(x, ui.person)) &&
    (x.due === day || (day === td && (statusOf(x) === 'overdue' || (plan && plan.ids.includes(x.id)))))).sort(byPriorityThenDue);
}

function renderTimeGrid(view) {
  const td = todayStr();
  ui.calDay = ui.calDay || td;
  const loc = lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  const days = view === 'day' ? [ui.calDay] : [...Array(7)].map((_, i) => hAdd(hWeekStart({}, ui.calDay), i));
  const title = view === 'day'
    ? new Date(ui.calDay + 'T00:00').toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })
    : `${fmtDate(days[0], lang())} → ${fmtDate(days[6], lang())}`;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const hours = [...Array(24)].map((_, h) => `<div class="tg-hour"><span>${h ? fmtTime(`2000-01-01T${String(h).padStart(2, '0')}:00`, lang()).replace(':00', '') : ''}</span></div>`).join('');
  const chip = (x) => `<span class="tg-chip ${quadClass(x)}" draggable="true" data-tgdrag="${x.id}" data-task="${x.id}" title="${esc(x.title)}" dir="auto">${esc(x.title)}${x.estimate ? `<small>${fmtMins(x.estimate, lang())}</small>` : ''}</span>`;
  const evHtml = (e, day) => {
    const top = e.start * TG_PX, h = Math.max(18, (e.end - e.start) * TG_PX);
    const w = 100 / e.lanes, left = e.lane * w;
    const pos = `top:${top}px;height:${h}px;${document.documentElement.dir === 'rtl' ? 'right' : 'left'}:calc(${left}% + 2px);width:calc(${w}% - 4px)`;
    const range = `${fmtTime(`2000-01-01T${tgHHMM(e.start)}`, lang())} – ${fmtTime(`2000-01-01T${tgHHMM(e.end % 1440)}`, lang())}`;
    if (e.kind === 'habit') {
      const done = hLog(e.h, day) === 'done';
      return `<div class="tg-ev habit ${done ? 'done' : ''}" style="${pos};--hc:var(--c-${e.h.color || 'blue'})" data-hopen="${e.h.id}"><b dir="auto">${esc(e.h.emoji || '')} ${esc(e.h.name)}</b><small>${range}</small></div>`;
    }
    const x = e.x;
    return `<div class="tg-ev ${e.kind} ${quadClass(x)} ${x.closure ? 'closed' : ''} ${h < 34 ? 'short' : ''}" style="${pos}" data-task="${x.id}" ${x.closure ? '' : `draggable="true" data-tgdrag="${x.id}"`}>
      <b dir="auto">${x.closure ? '✓ ' : ''}${esc(x.title)}</b><small>${range}${e.kind === 'due' ? ` · ${t('tgDue')}` : ''}</small>
      ${x.closure ? '' : `<span class="tg-tools"><button class="icon" data-focus="${x.id}" title="${t('fStartTip')}">▶</button>${e.kind === 'block' ? `<button class="icon" data-tgclear="${x.id}" title="${t('tgClear')}">✕</button>` : ''}</span>
      ${e.kind === 'block' ? `<span class="tg-resize" data-tgresize="${x.id}"></span>` : ''}`}</div>`;
  };
  const cols = days.map((d) => `<div class="tg-col ${d === td ? 'today' : ''} ${d < td ? 'past' : ''}" data-tgday="${d}">
      ${dayEvents(d).map((e) => evHtml(e, d)).join('')}
      ${d === td ? `<div class="tg-now" id="tgNow" style="top:${nowMin * TG_PX}px"><i></i></div>` : ''}</div>`).join('');
  const heads = days.map((d) => `<div class="tg-dh ${d === td ? 'today' : ''}" data-tgdayhead="${d}"><small>${new Date(d + 'T00:00').toLocaleDateString(loc, { weekday: view === 'day' ? 'long' : 'short' })}</small><b>${Number(d.slice(8))}</b></div>`).join('');
  const allDay = days.map((d) => `<div class="tg-ad" data-tgday="${d}" data-tgallday="1">${dayUntimed(d).slice(0, view === 'day' ? 50 : 4).map(chip).join('')}${view === 'week' && dayUntimed(d).length > 4 ? `<small class="muted">+${dayUntimed(d).length - 4}</small>` : ''}</div>`).join('');
  $('list').innerHTML = `<div class="cal tg tg-${view}">
    <div class="cal-head tg-head">
      ${calViewSeg()}
      <div class="cal-nav"><button class="cal-arrow" data-tgnav="-1" title="${t('prev')}">${icon('chevron')}</button><b class="cal-month">${title}</b><button class="cal-arrow next" data-tgnav="1" title="${t('next')}">${icon('chevron')}</button></div>
      ${days.includes(td) ? '' : `<button class="cal-today" data-tgnav="0">${t('today')}</button>`}
    </div>
    <div class="tg-top"><div class="tg-gut"><small>${t('tgNoTime')}</small></div><div class="tg-heads">${heads}</div></div>
    <div class="tg-top tg-adrow"><div class="tg-gut"></div><div class="tg-ads">${allDay}</div></div>
    <div class="tg-scroll" id="tgScroll"><div class="tg-body"><div class="tg-gut tg-hours">${hours}</div><div class="tg-cols">${cols}</div></div></div>
    <p class="small muted tg-hint">${t('tgHint')}</p>
  </div>`;
  const sc = $('tgScroll');
  if (sc && !renderTimeGrid.keepScroll) sc.scrollTop = Math.max(0, ((days.includes(td) ? nowMin : 8 * 60) - 90) * TG_PX);
  renderTimeGrid.keepScroll = false;
}
// Keep the "now" line moving.
setInterval(() => { const n = $('tgNow'); if (n) n.style.top = (new Date().getHours() * 60 + new Date().getMinutes()) * TG_PX + 'px'; }, 30000);

// Which minute of which day is under the mouse.
function tgSpot(e) {
  const col = e.target.closest && e.target.closest('.tg-col[data-tgday]');
  if (!col) return null;
  const r = col.getBoundingClientRect();
  const min = Math.max(0, Math.min(1440 - TG_SNAP, Math.round((e.clientY - r.top) / TG_PX / TG_SNAP) * TG_SNAP));
  return { col, day: col.dataset.tgday, min };
}
function tgRerender() { renderTimeGrid.keepScroll = true; const s = $('tgScroll')?.scrollTop; renderList(); if ($('tgScroll') && s != null) $('tgScroll').scrollTop = s; }

let tgDragId = null;
document.addEventListener('dragstart', (e) => {
  const el = e.target.closest && e.target.closest('[data-tgdrag]');
  if (!el) return;
  tgDragId = el.dataset.tgdrag;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'tg');
  el.classList.add('dragging');
}, true);
document.addEventListener('dragover', (e) => {
  if (!tgDragId) return;
  const s = tgSpot(e);
  document.querySelectorAll('.tg-ghost').forEach((g) => g.remove());
  const ad = e.target.closest && e.target.closest('[data-tgallday]');
  if (ad) { e.preventDefault(); return; }
  if (!s) return;
  e.preventDefault();
  const x = taskById(tgDragId);
  const g = document.createElement('div');
  g.className = 'tg-ghost';
  g.style.top = s.min * TG_PX + 'px'; g.style.height = blockLen(x) * TG_PX + 'px';
  g.textContent = fmtTime(`2000-01-01T${tgHHMM(s.min)}`, lang());
  s.col.appendChild(g);
}, true);
document.addEventListener('drop', (e) => {
  if (!tgDragId) return;
  const x = taskById(tgDragId);
  const s = tgSpot(e), ad = e.target.closest && e.target.closest('[data-tgallday]');
  tgDragId = null;
  document.querySelectorAll('.tg-ghost').forEach((g) => g.remove());
  if (!x) return;
  e.preventDefault(); e.stopPropagation();
  if (s) { x.blockAt = `${s.day}T${tgHHMM(s.min)}`; if (!x.blockMins) x.blockMins = x.estimate || 30; }
  else if (ad) { x.blockAt = null; }
  else return;
  touch(x); tgRerender();
}, true);
document.addEventListener('dragend', () => { tgDragId = null; document.querySelectorAll('.tg-ghost').forEach((g) => g.remove()); }, true);

// Pull the bottom edge of a block to change how long it is.
document.addEventListener('pointerdown', (e) => {
  const hdl = e.target.closest && e.target.closest('[data-tgresize]');
  if (!hdl) return;
  e.preventDefault(); e.stopPropagation();
  const x = taskById(hdl.dataset.tgresize); const ev = hdl.closest('.tg-ev');
  const y0 = e.clientY, len0 = blockLen(x);
  hdl.setPointerCapture(e.pointerId);
  const move = (m) => { const len = Math.max(TG_SNAP, Math.round((len0 + (m.clientY - y0) / TG_PX) / TG_SNAP) * TG_SNAP); ev.style.height = len * TG_PX + 'px'; ev.dataset.len = len; };
  const up = () => { hdl.removeEventListener('pointermove', move); hdl.removeEventListener('pointerup', up); if (ev.dataset.len) { x.blockMins = Number(ev.dataset.len); touch(x); } tgRerender(); };
  hdl.addEventListener('pointermove', move); hdl.addEventListener('pointerup', up);
}, true);

document.addEventListener('click', (e) => {
  const q = (s) => e.target.closest && e.target.closest(s);
  let b;
  if ((b = q('[data-calview]'))) { data.settings.calView = b.dataset.calview; if (b.dataset.calview !== 'month') ui.calDay = ui.calDay || todayStr(); save(); return renderList(); }
  if ((b = q('[data-tgnav]'))) {
    const n = Number(b.dataset.tgnav);
    ui.calDay = n === 0 ? todayStr() : hAdd(ui.calDay || todayStr(), n * (calView() === 'day' ? 1 : 7));
    return renderList();
  }
  if ((b = q('[data-tgclear]'))) { e.stopPropagation(); const x = taskById(b.dataset.tgclear); x.blockAt = null; touch(x); return tgRerender(); }
  if ((b = q('[data-tgdayhead]')) && calView() === 'week') { ui.calDay = b.dataset.tgdayhead; data.settings.calView = 'day'; save(); return renderList(); }
}, true);
// Double-click an empty hour: add a task there.
document.addEventListener('dblclick', (e) => {
  if (e.target.closest('.tg-ev')) return;
  const s = tgSpot(e); if (!s) return;
  ui.tgNewBlock = `${s.day}T${tgHHMM(s.min)}`;
  openComposer({ due: s.day });
});
