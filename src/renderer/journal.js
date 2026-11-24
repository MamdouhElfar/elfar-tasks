// ---------------- the day log + search everything ----------------
// Review › Day log: one page per day of what happened. You write short notes ("Ayman asked for the
// risk register"); the day fills itself with what the app already knows: follow-ups written on tasks,
// tasks closed, habits done (with amounts, where you stopped, notes) and time focused.
// Data: data.journal = [{ id, at: 'YYYY-MM-DDTHH:MM', text }]  (synced like tasks)
// Ctrl+K searches all of it, Arabic-aware (اسامه finds أسامة).

const journalList = () => (data.journal = Array.isArray(data.journal) ? data.journal : []);

// Everything that happened, bucketed by day: { 'YYYY-MM-DD': [{ at, kind, text, ... }] }
function dayBuckets() {
  const by = {};
  const put = (d, it) => { if (!d) return; (by[d] = by[d] || []).push(it); };
  for (const e of journalList()) put(e.at.slice(0, 10), { at: e.at, kind: 'note', text: e.text, id: e.id });
  for (const x of data.tasks) {
    for (const l of x.log || []) {
      const holders = (l.holders || []).map(personById).filter(Boolean).map((p) => p.name);
      put(l.date || (l.at || '').slice(0, 10), { at: logAt(l), kind: 'task', text: l.text + (l.handoff ? ` → ${holders.length ? holders.join('، ') : t('me')}` : ''), taskId: x.id, title: x.title });
    }
    if (x.closure) put(x.closure, { at: x.closure + 'T23:58', kind: 'closed', text: x.title, taskId: x.id });
  }
  for (const h of habitsList()) {
    const days = new Set([...Object.keys(h.entries || {}), ...Object.keys(h.log || {}).filter((d) => h.log[d] === 'done')]);
    for (const d of days) {
      const e = (h.entries || {})[d] || {};
      const vals = (h.measures || []).filter((m) => e.vals && e.vals[m.id]).map((m) => `${fmtVal(m, e.vals[m.id])} ${m.unit === 'min' ? m.name : ''}`.trim() + (m.unit === 'min' ? '' : ` ${m.name}`));
      put(d, { at: d + 'T23:59', kind: 'habit', habitId: h.id, title: `${h.emoji ? h.emoji + ' ' : ''}${h.name}`, done: (h.log || {})[d] === 'done',
        text: [vals.join(' · '), e.stop ? `↩ ${e.stop}` : '', e.note || ''].filter(Boolean).join(' — ') });
    }
  }
  const focus = {};
  for (const l of data.focusLog || []) { const d = l.at.slice(0, 10); focus[d] = (focus[d] || 0) + l.ms; }
  for (const [d, ms] of Object.entries(focus)) if (ms >= 60000) put(d, { at: d + 'T23:57', kind: 'focus', text: focusTimeLabel(Math.round(ms / 60000)) });
  for (const d of Object.keys(by)) by[d].sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  return by;
}

// Tasks closed that day share one line, so your own notes stay easy to spot.
function groupClosed(items) {
  const closed = items.filter((i) => i.kind === 'closed');
  const rest = items.filter((i) => i.kind !== 'closed');
  if (closed.length) rest.push({ at: closed[0].at, kind: 'closed', list: closed });
  return rest.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
}

function dayItemHtml(it) {
  const time = it.at && !/T23:5\d$/.test(it.at) && !it.at.endsWith('T00:00') ? `<span class="dl-time">${fmtTime(it.at, lang())}</span>` : '<span class="dl-time"></span>';
  if (it.kind === 'note') return `<div class="dl-it note" data-dlid="${it.id}">${time}<span class="dl-txt" dir="auto">${linkify(it.text)}</span>
      <span class="dl-acts"><button class="icon" data-dledit="${it.id}" title="${t('edit')}">✎</button><button class="icon" data-dldel="${it.id}" title="${t('del')}">✕</button></span></div>`;
  if (it.kind === 'task') return `<div class="dl-it task">${time}<span class="dl-txt" dir="auto">${linkify(it.text)} <button class="dl-chip" data-task="${it.taskId}" dir="auto">${icon('list')} ${esc(it.title)}</button></span></div>`;
  if (it.kind === 'closed') return `<div class="dl-it closed">${time}<span class="dl-txt" dir="auto">✓ ${t('dlClosed')} ${it.list.map((c) => `<button class="dl-chip" data-task="${c.taskId}" dir="auto">${esc(c.text)}</button>`).join(' ')}</span></div>`;
  if (it.kind === 'habit') return `<div class="dl-it habit">${time}<span class="dl-txt" dir="auto"><button class="dl-chip hb" data-dlhabit="${it.habitId}" data-day="${it.at.slice(0, 10)}" dir="auto">${it.done ? '✓ ' : ''}${esc(it.title)}</button> ${esc(it.text)}</span></div>`;
  return `<div class="dl-it focus">${time}<span class="dl-txt">⏱ ${t('dlFocused')} ${it.text}</span></div>`;
}

function renderDayLog() {
  const td = todayStr();
  const by = dayBuckets();
  ui.dlDays = ui.dlDays || 14;
  const days = Object.keys(by).filter((d) => d <= td).sort().reverse();
  if (!days.includes(td)) days.unshift(td);
  const shown = days.slice(0, ui.dlDays);
  const loc = lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  const dayHead = (d) => d === td ? t('today') : d === hAdd(td, -1) ? t('hbYesterday') : new Date(d + 'T00:00').toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
  $('list').innerHTML = `${reviewSubBar()}<div class="dl">
    <div class="dl-add"><input type="text" id="dlText" dir="auto" placeholder="${t('dlPh')}" autocomplete="off">
      <input type="date" id="dlDate" value="${ui.dlDate || td}" max="${td}" title="${t('dlWhen')}"><button class="primary" id="dlAdd">${t('addBtn')}</button></div>
    <p class="small muted dl-hint">${t('dlHint')}</p>
    ${shown.map((d) => `<section class="dl-day ${ui.dlFlash === d ? 'flash' : ''}" data-dlday="${d}"><h4>${dayHead(d)} <small>${fmtDate(d, lang())}</small></h4>
      ${(by[d] || []).length ? groupClosed(by[d]).map(dayItemHtml).join('') : `<div class="small muted dl-empty">${t('dlNothing')}</div>`}</section>`).join('')}
    ${days.length > shown.length ? `<button class="dl-more" id="dlMore">${t('dlOlder')}</button>` : ''}
  </div>`;
  if (ui.dlFlash) { const el = document.querySelector(`[data-dlday="${ui.dlFlash}"]`); if (el) el.scrollIntoView({ block: 'start' }); ui.dlFlash = null; }
}

function addJournal(text, day) {
  text = text.trim(); if (!text) return false;
  const td = todayStr();
  const at = day && day !== td ? `${day}T12:00` : nowLocal();
  journalList().push({ id: uid(), at, text, updated: Date.now() });
  save(); return true;
}

document.addEventListener('click', (e) => {
  if (ui.view !== 'daylog' || !e.target.closest('#list')) return;
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'dlAdd') { const i = $('dlText'); ui.dlDate = $('dlDate').value || null; if (addJournal(i.value, ui.dlDate)) { renderDayLog(); $('dlText').focus(); } else i.focus(); return; }
  if (b.id === 'dlMore') { ui.dlDays += 14; return renderDayLog(); }
  if (b.dataset.dlhabit) { const h = habitById(b.dataset.dlhabit); if (h) openHabitDay(h, b.dataset.day); return; }
  if (b.dataset.dldel) {
    const snap = snapshot();
    data.journal = journalList().filter((x) => x.id !== b.dataset.dldel); save(); renderDayLog();
    return offerUndo(t('deleted'), snap);
  }
  if (b.dataset.dledit) {
    const ent = journalList().find((x) => x.id === b.dataset.dledit); if (!ent) return;
    const row = b.closest('.dl-it');
    row.querySelector('.dl-txt').innerHTML = `<input type="text" class="dl-edit" dir="auto" value="${esc(ent.text)}">`;
    const inp = row.querySelector('.dl-edit'); inp.focus(); inp.select();
    const done = (keep) => { if (keep && inp.value.trim()) { ent.text = inp.value.trim(); ent.updated = Date.now(); save(); } renderDayLog(); };
    inp.onkeydown = (ev) => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') { ev.stopPropagation(); done(false); } };
    inp.onblur = () => done(true);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'dlText' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); $('dlAdd').click(); }
});

// ---------------- Ctrl+K: search everything ----------------
// Tasks (title, notes, steps, people, follow-ups), the day log, and what you wrote on habit days.
function openPalette() {
  $('modalRoot').innerHTML = `<div class="modal-bg palette-bg" id="mBg"><div class="modal palette">
    <input type="text" id="pQ" dir="auto" placeholder="${t('searchAll')}" autocomplete="off">
    <div class="p-list" id="pList"></div>
    <div class="small muted p-hint">↑ ↓ · Enter · Esc</div></div></div>`;
  let idx = 0, results = [];
  // A short piece of text around the first word you searched for.
  const snip = (txt, q) => {
    const w = normText(q).trim().split(' ')[0] || '';
    const s = String(txt || '').replace(/\s+/g, ' ');
    const i = normText(s).indexOf(w);
    if (i < 0 || s.length <= 90) return s.slice(0, 90);
    const a = Math.max(0, i - 30);
    return (a ? '…' : '') + s.slice(a, a + 90) + (a + 90 < s.length ? '…' : '');
  };
  const run = () => {
    const q = $('pQ').value.trim();
    results = [];
    if (!q) {
      results = data.tasks.filter(isOpen).sort(byPriorityThenDue).slice(0, 12).map((x) => ({ kind: 'task', x }));
    } else {
      const tasks = data.tasks.filter((x) => matchText([x.title, x.notes, ...peopleNames(x), ...(x.subtasks || []).map((s) => s.title), ...(x.log || []).map((l) => l.text), areaLabel(x.areaId)].join('\n'), q))
        .sort((a, b) => (!!a.closure - !!b.closure) || byPriorityThenDue(a, b)).slice(0, 20);
      results.push(...tasks.map((x) => {
        const inTitle = matchText(x.title, q);
        const hit = inTitle ? '' : [x.notes, ...(x.log || []).map((l) => l.text), ...(x.subtasks || []).map((s) => s.title)].find((s) => matchText(s, q)) || '';
        return { kind: 'task', x, hit: hit && snip(hit, q) };
      }));
      const notes = journalList().filter((e) => matchText(e.text, q)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15);
      results.push(...notes.map((e) => ({ kind: 'log', e })));
      for (const h of habitsList()) for (const [d, e] of Object.entries(h.entries || {})) {
        if (matchText([e.note, e.stop].join('\n'), q)) results.push({ kind: 'habit', h, d, e });
      }
    }
    idx = Math.min(idx, Math.max(0, results.length - 1));
    let last = '';
    const head = (k) => { if (!q || k === last) return ''; last = k; return `<div class="p-sec">${t({ task: 'psTasks', log: 'psLog', habit: 'psHabits' }[k])}</div>`; };
    $('pList').innerHTML = results.length ? results.map((r, i) => head(r.kind) + (r.kind === 'task'
        ? `<div class="p-item ${i === idx ? 'on' : ''} ${quadClass(r.x)}" data-pi="${i}"><span dir="auto" class="p-title">${r.x.closure ? '✓ ' : ''}${esc(r.x.title)}</span>
            <span class="muted small">${r.hit ? `<span dir="auto">${esc(r.hit)}</span> · ` : ''}${esc(areaLabel(r.x.areaId))}${r.x.due ? ' · ' + fmtDate(r.x.due, lang()) : ''}</span></div>`
        : r.kind === 'log'
        ? `<div class="p-item ${i === idx ? 'on' : ''}" data-pi="${i}"><span dir="auto" class="p-title">${esc(snip(r.e.text, q))}</span><span class="muted small">${icon('log')} ${fmtDate(r.e.at.slice(0, 10), lang())}</span></div>`
        : `<div class="p-item ${i === idx ? 'on' : ''}" data-pi="${i}"><span dir="auto" class="p-title">${esc(snip([r.e.stop && '↩ ' + r.e.stop, r.e.note].filter(Boolean).join(' — '), q))}</span><span class="muted small" dir="auto">${esc(r.h.emoji || '🔁')} ${esc(r.h.name)} · ${fmtDate(r.d, lang())}</span></div>`)).join('')
      : `<div class="empty">${t('psNothing')}</div>`;
    $('pList').querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const go = (r) => {
    if (!r) return;
    closeModal();
    if (r.kind === 'task') { ui.scope = 'all'; ui.person = null; ui.view = isOpen(r.x) ? 'pending' : 'closed'; ui.selected = r.x.id; return refresh(); }
    if (r.kind === 'log') { ui.view = 'daylog'; ui.selected = null; const d = r.e.at.slice(0, 10); ui.dlFlash = d; const n = Object.keys(dayBuckets()).filter((x) => x >= d).length; ui.dlDays = Math.max(ui.dlDays || 14, n + 1); return refresh(); }
    if (r.kind === 'habit') return setTimeout(() => openHabitDay(r.h, r.d), 160);
  };
  $('pQ').oninput = () => { idx = 0; run(); };
  $('pQ').onkeydown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(results.length - 1, idx + 1); run(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); run(); }
    if (e.key === 'Enter') go(results[idx]);
  };
  $('mBg').onclick = (e) => {
    if (e.target.id === 'mBg') return closeModal();
    const it = e.target.closest('[data-pi]'); if (it) go(results[+it.dataset.pi]);
  };
  run();
  $('pQ').focus();
}
