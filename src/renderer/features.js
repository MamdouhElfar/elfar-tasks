// Extra features for the main window. Loaded after app.js and shares its globals
// (data, ui, t, lang, save, refresh, taskById, ...).

// ---------------- recurring tasks ----------------
// task.repeat = { every: n, unit: 'day' | 'week' | 'month' | 'year' }
// Closing a repeating task creates the next one (same details, fresh subtasks, next due date).
function spawnNext(x) {
  if (!x.repeat || x.spawned) return null;
  const { every = 1, unit } = x.repeat;
  const base = x.due || x.closure || todayStr();
  const due = shiftDate(base, every, unit);
  const offset = x.due ? daysBetween(x.due, due) : null;
  const next = {
    ...JSON.parse(JSON.stringify(x)),
    // Each round stands on its own: the next one starts on its own day, not today.
    id: uid(), start: due > todayStr() ? due : todayStr(), due, closure: null, spawned: null, reminded: undefined,
    subtasks: (x.subtasks || []).map((s) => ({ ...s, id: uid(), done: false })),
    log: [], pendingWith: [], created: Date.now(), updated: Date.now(), postponed: 0, focusMs: 0,
    title: x.title
  };
  // Reminder: "X before due" is recalculated; a fixed reminder moves by the same number of days.
  if (x.remindBefore != null) syncReminder(next);
  else if (x.remindAt && offset !== null) next.remindAt = shiftDate(x.remindAt.slice(0, 10), offset, 'day') + x.remindAt.slice(10);
  // "Note for next time" becomes a pinned note on the next one (and shows in its reminder).
  next.pinnedNote = (x.nextNote || '').trim() || null;
  next.nextNote = '';
  x.spawned = next.id;
  data.tasks.push(next);
  return next;
}

// "Every week on Sunday", "Every month on day 5"… (the day comes from the due date).
function repeatLabel(r, due) {
  if (!r) return '';
  const names = { day: t('rDay'), week: t('rWeek'), month: t('rMonth'), year: t('rYear') };
  let s = r.every > 1 ? `${t('every')} ${r.every} ${names[r.unit]}` : t('r1' + r.unit);
  if (due) {
    const d = new Date(due + 'T00:00');
    const loc = lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
    if (r.unit === 'week') s += ` · ${d.toLocaleDateString(loc, { weekday: 'long' })}`;
    if (r.unit === 'month') s += ` · ${t('onDay')} ${d.getDate()}`;
    if (r.unit === 'year') s += ` · ${d.toLocaleDateString(loc, { day: 'numeric', month: 'long' })}`;
  }
  return s;
}

const parseRepeat = (v) => { const m = String(v || '').match(/^(\d+)(day|week|month|year)$/); return m ? { every: +m[1], unit: m[2] } : null; };
const REPEAT_CHOICES = ['1day', '1week', '2week', '1month', '3month', '1year'];
function repeatOptions(cur, due) {
  const curV = cur ? cur.every + cur.unit : '';
  const opts = [['', t('noRepeat')], ...REPEAT_CHOICES.map((v) => [v, repeatLabel(parseRepeat(v), due)])];
  if (curV && !REPEAT_CHOICES.includes(curV)) opts.push([curV, repeatLabel(cur, due)]);
  return opts.map(([v, l]) => `<option value="${v}" ${v === curV ? 'selected' : ''}>${esc(l)}</option>`).join('');
}

// ---------------- reminder "X before due" ----------------
// remindBefore = minutes before the due time (due time defaults to 9:00).
const REMIND_BEFORE = [0, 15, 60, 180, 1440, 2880, 10080];
function remindBeforeLabel(m) {
  if (m === 0) return t('atDueTime');
  if (m < 60) return `${m} ${t('minBefore')}`;
  if (m < 1440) return `${m / 60} ${t('hourBefore')}`;
  if (m < 10080) return m === 1440 ? t('dayBefore1') : `${m / 1440} ${t('dayBefore')}`;
  return t('weekBefore');
}
// When a "before due" reminder would fire. A due date with no time counts from 9:00.
function remindTimeFor(m, due, dueTime) {
  const at = new Date(`${due}T${dueTime || '09:00'}`);
  at.setMinutes(at.getMinutes() - m);
  return nowLocal(at);
}
const remindWhen = (at) => `${fmtDate(at.slice(0, 10), lang())} · ${fmtTime(at, lang())}`;
// One list for every reminder choice. Each "before" option shows the exact time it fires,
// so "1 h before" on a due date with no time reads "1 h before · 19 Nov · 8:00 AM".
// custom: undefined = no "specific time" option (quick-add card); true/false = shown, selected or not.
function remindBeforeOptions(cur, due, dueTime, custom) {
  let h = `<option value="" ${cur == null && !custom ? 'selected' : ''}>${t('remindPh')}</option>`;
  // Choices that would already be in the past are left out (unless it's the one already set).
  if (due) h += REMIND_BEFORE.filter((m) => m === cur || remindTimeFor(m, due, dueTime) > nowLocal()).map((m) => `<option value="${m}" ${cur === m ? 'selected' : ''}>${remindBeforeLabel(m)} · ${remindWhen(remindTimeFor(m, due, dueTime))}</option>`).join('');
  if (custom !== undefined) h += `<option value="custom" ${custom ? 'selected' : ''}>${t('remindCustom')}</option>`;
  return h;
}
function syncReminder(x) {
  if (x.remindBefore == null || !x.due) return;
  const at = new Date(`${x.due}T${x.dueTime || '09:00'}`);
  at.setMinutes(at.getMinutes() - x.remindBefore);
  const v = nowLocal(at);
  if (v !== x.remindAt) { x.remindAt = v; delete x.reminded; }
}

// ---------------- undo ----------------
const snapshot = () => JSON.stringify(data.tasks);
function offerUndo(text, snap) {
  showToast(text, () => {
    data.tasks = JSON.parse(snap);
    save(); refresh();
  }, t('undo'));
}

// ---------------- attachments (files and links) ----------------
function attachmentsHtml(x) {
  const items = x.files || [];
  return `<div class="d-sec" id="dFilesSec"><h3>${icon('clip')} ${t('files')} <span class="muted small">${items.length || ''}</span></h3>
    <div class="files">${items.map((f) => `<div class="file" data-file="${f.id}">
        <span class="f-ico">${/^https?:/.test(f.path) ? icon('link') : icon('file')}</span>
        <a href="#" data-file-open="${f.id}" dir="auto" title="${esc(f.path)}">${esc(f.name)}</a>
        ${/^https?:/.test(f.path) ? '' : `<button class="icon" data-file-reveal="${f.id}" title="${t('showInFolder')}">${icon('folder')}</button>`}
        <button class="icon x" data-file-del="${f.id}">✕</button></div>`).join('')}</div>
    <div class="files-add">
      <button id="dAddFile">${icon('clip')} ${t('attachFile')}</button>
      <input type="text" id="dAddLink" placeholder="${t('pasteLink')}" dir="ltr">
    </div>
    <div class="drop-hint small muted">${t('dropFiles')}</div>
  </div>`;
}

function addFiles(x, paths) {
  x.files = x.files || [];
  for (const p of paths) {
    if (!p || x.files.some((f) => f.path === p)) continue;
    const name = /^https?:/.test(p) ? p.replace(/^https?:\/\//, '').slice(0, 60) : p.split(/[\\/]/).pop();
    x.files.push({ id: uid(), path: p, name });
  }
  touch(x); refresh();
}

function bindAttachments() {
  const d = $('detail');
  d.addEventListener('click', async (e) => {
    const x = taskById(ui.selected); if (!x) return;
    if (e.target.closest('#dAddFile')) return addFiles(x, await window.api.pickFiles());
    const op = e.target.closest('[data-file-open]');
    if (op) { e.preventDefault(); const f = x.files.find((y) => y.id === op.dataset.fileOpen); return f && window.api.openFile(f.path); }
    const rv = e.target.closest('[data-file-reveal]');
    if (rv) { const f = x.files.find((y) => y.id === rv.dataset.fileReveal); return f && window.api.revealFile(f.path); }
    const del = e.target.closest('[data-file-del]');
    if (del) { x.files = x.files.filter((y) => y.id !== del.dataset.fileDel); touch(x); refresh(); }
  });
  d.addEventListener('keydown', (e) => {
    if (e.target.id !== 'dAddLink' || e.key !== 'Enter') return;
    const v = e.target.value.trim(); const x = taskById(ui.selected);
    if (x && v) addFiles(x, [v]);
  });
  // Drag files from Explorer (or links from a browser) onto the task page.
  d.addEventListener('dragover', (e) => {
    if (!ui.selected || dragTaskId) return;
    if ([...e.dataTransfer.types].some((ty) => ty === 'Files' || ty === 'text/uri-list')) { e.preventDefault(); d.classList.add('file-over'); }
  });
  d.addEventListener('dragleave', (e) => { if (!d.contains(e.relatedTarget)) d.classList.remove('file-over'); });
  d.addEventListener('drop', (e) => {
    d.classList.remove('file-over');
    const x = taskById(ui.selected); if (!x || dragTaskId) return;
    const files = [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean);
    const url = e.dataTransfer.getData('text/uri-list');
    if (!files.length && !url) return;
    e.preventDefault();
    addFiles(x, files.length ? files : url.split(/\r?\n/).filter((u) => /^https?:/.test(u)));
  });
}

// ---------------- Ctrl+K: search everything ----------------
function openPalette() {
  $('modalRoot').innerHTML = `<div class="modal-bg palette-bg" id="mBg"><div class="modal palette">
    <input type="text" id="pQ" dir="auto" placeholder="${t('searchAll')}" autocomplete="off">
    <div class="p-list" id="pList"></div>
    <div class="small muted p-hint">↑ ↓ · Enter · Esc</div></div></div>`;
  let idx = 0, results = [];
  const run = () => {
    const q = $('pQ').value.trim().toLowerCase();
    const hay = (x) => [x.title, x.notes, ...peopleNames(x), ...(x.subtasks || []).map((s) => s.title), ...(x.log || []).map((l) => l.text), areaLabel(x.areaId)].join('\n').toLowerCase();
    results = (q ? data.tasks.filter((x) => hay(x).includes(q)) : data.tasks.filter(isOpen))
      .sort((a, b) => (!!a.closure - !!b.closure) || byPriorityThenDue(a, b)).slice(0, 30);
    idx = Math.min(idx, Math.max(0, results.length - 1));
    $('pList').innerHTML = results.length ? results.map((x, i) => `<div class="p-item ${i === idx ? 'on' : ''} ${quadClass(x)}" data-pi="${i}">
        <span dir="auto" class="p-title">${x.closure ? '✓ ' : ''}${esc(x.title)}</span>
        <span class="muted small">${esc(areaLabel(x.areaId))}${x.due ? ' · ' + fmtDate(x.due, lang()) : ''}</span></div>`).join('')
      : `<div class="empty">${t('emptyList')}</div>`;
    $('pList').querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const go = (x) => {
    if (!x) return;
    closeModal();
    ui.scope = 'all'; ui.person = null; ui.view = isOpen(x) ? 'pending' : 'closed'; ui.selected = x.id;
    refresh();
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

// ---------------- keyboard: list navigation + zoom ----------------
function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 'k') { e.preventDefault(); return openPalette(); }
    // Text size: Ctrl + / Ctrl - / Ctrl 0
    if (e.ctrlKey && (k === '=' || k === '+' || k === '-' || k === '0')) {
      e.preventDefault();
      const z = k === '0' ? 1 : Math.round(((data.settings.zoom || 1) + (k === '-' ? -0.1 : 0.1)) * 10) / 10;
      data.settings.zoom = Math.min(1.6, Math.max(0.8, z)); save();
      return;
    }
    // The rest only when you're not typing and no dialog is open.
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (typing || $('modalRoot').innerHTML || e.ctrlKey || e.altKey || e.metaKey) return;
    if (['calendar', 'matrix', 'report', 'habits'].includes(ui.view)) return;
    const list = currentTasks();
    if (!list.length) return;
    const i = list.findIndex((x) => x.id === ui.selected);
    const x = i >= 0 ? list[i] : null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = e.key === 'ArrowDown' ? Math.min(list.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1);
      select(list[n].id);
      document.querySelector(`.task-row[data-task="${list[n].id}"]`)?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (!x) return;
    if (e.key === ' ') { e.preventDefault(); setClosed(x, !x.closure); return refresh(); }
    if (['1', '2', '3', '4'].includes(e.key)) { x.priority = x.priority === 'q' + e.key ? null : 'q' + e.key; touch(x); return refresh(); }
    if (k === 's') { x.starred = !x.starred; touch(x); return refresh(); }
    if (k === 'f' && !x.closure) return startFocus(x.id);
    if (e.key === 'Enter') { e.preventDefault(); $('dTitle')?.focus(); return; }
    if (e.key === 'Delete') { deleteTask(x); }
  });
}

// ---------------- the mouse's mood ----------------
// Nothing due today or overdue → the sidebar mouse is happy, holding a piece of cheese.
// Closing the last task of the day → a mouse pops up from the bottom with a thumbs-up.
const mood = { prev: null };
function updateMascot() {
  const td = todayStr();
  const left = data.tasks.filter((x) => !x.closure && x.due && x.due <= td).length;
  const closedToday = data.tasks.filter((x) => x.closure === td).length;
  const happy = left === 0;
  const el = $('brandLogo');
  if (el && el.dataset.mood !== (happy ? 'happy' : '')) {
    el.innerHTML = mouseLogo('', happy ? 'happy' : '');
    el.dataset.mood = happy ? 'happy' : '';
    el.title = happy ? t('dayClear') : '';
    if (mood.prev) animateIn(el);
  }
  if (mood.prev && mood.prev.left > 0 && left === 0 && closedToday > mood.prev.closed) cheer();
  mood.prev = { left, closed: closedToday };
}

function cheer() {
  document.querySelector('.cheer')?.remove();
  const el = document.createElement('div');
  el.className = 'cheer';
  el.innerHTML = `<div class="cheer-bits">${[...Array(14)].map((_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
    <div class="cheer-card"><div class="cheer-text"><b>${t('cheerTitle')}</b><span>${t('cheerSub')}</span></div></div>
    <div class="cheer-mouse">${cheerMouseSvg()}</div>`;
  document.body.appendChild(el);
  const bye = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 600); };
  el.onclick = bye;
  setTimeout(bye, 3400);
}

// In-app yes/no dialog (instead of the plain Windows box). Resolves true / false.
// Stacks on top of any open dialog; Enter confirms, Esc cancels.
function askConfirm({ title, text = '', ok = t('ok'), danger = false }) {
  return new Promise((resolve) => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg confirm-bg';
    bg.innerHTML = `<div class="modal confirm ${danger ? 'is-danger' : ''}" role="alertdialog">
      <div class="cf-icon">${danger ? icon('trash') : icon('help')}</div>
      <h3 dir="auto">${esc(title)}</h3>
      ${text ? `<p class="cf-text" dir="auto">${esc(text)}</p>` : ''}
      <div class="actions"><span style="flex:1"></span>
        <button id="cfNo">${t('cancel')}</button>
        <button class="${danger ? 'danger-solid' : 'primary'}" id="cfYes">${esc(ok)}</button></div></div>`;
    document.body.appendChild(bg);
    const done = (v) => {
      document.removeEventListener('keydown', onKey, true);
      bg.classList.add('leaving');
      setTimeout(() => bg.remove(), 150);
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); done(false); }
      if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); done(true); }
    };
    document.addEventListener('keydown', onKey, true);
    bg.onclick = (e) => {
      if (e.target === bg || e.target.closest('#cfNo')) done(false);
      else if (e.target.closest('#cfYes')) done(true);
    };
    setTimeout(() => bg.querySelector('#cfYes').focus(), 30);
  });
}

async function deleteTask(x) {
  if (!(await askConfirm({ title: t('confirmDelTask'), text: x.title, ok: t('del'), danger: true }))) return;
  const snap = snapshot();
  data.tasks = data.tasks.filter((y) => y.id !== x.id);
  ui.selected = null; save(); refresh();
  offerUndo(`${t('deleted')}: ${x.title}`, snap);
}

// ---------------- weekly report + CSV ----------------
function weekStart() {
  const d = new Date(); const back = (d.getDay() - appWeekStart() + 7) % 7;
  d.setDate(d.getDate() - back); return todayStr(d);
}

function renderReport() {
  const from = ui.reportFrom || weekStart();
  const inScopeAll = data.tasks.filter((x) => inScope(x));
  const closed = inScopeAll.filter((x) => x.closure && x.closure >= from).sort((a, b) => b.closure.localeCompare(a.closure));
  const added = inScopeAll.filter((x) => x.start && x.start >= from);
  const open = inScopeAll.filter(isOpen);
  const overdue = open.filter((x) => statusOf(x) === 'overdue');
  const days = data.settings.nudgeDays || 3;
  const stuck = [];
  for (const x of open) for (const pw of pendingOf(x)) {
    const d = daysBetween(pw.since || todayStr(), todayStr());
    if (d >= days) stuck.push({ x, p: personById(pw.personId), d });
  }
  stuck.sort((a, b) => b.d - a.d);
  // Focus sessions since the start date, in this folder.
  const focusIn = (data.focusLog || []).filter((l) => l.at.slice(0, 10) >= from && (ui.scope === 'all' || inScope(taskById(l.taskId) || { areaId: l.areaId })));
  const focusTotal = focusIn.reduce((n, l) => n + l.ms, 0);
  const focusByArea = {};
  for (const l of focusIn) { const k = areaLabel((taskById(l.taskId) || l).areaId); focusByArea[k] = (focusByArea[k] || 0) + l.ms; }
  const byArea = {};
  for (const x of closed) byArea[areaLabel(x.areaId)] = (byArea[areaLabel(x.areaId)] || 0) + 1;
  const row = (x, extra = '') => `<div class="r-item ${quadClass(x)}" data-task="${x.id}"><span dir="auto">${esc(x.title)}</span><span class="muted small">${extra}</span></div>`;
  $('list').innerHTML = `${reviewSubBar()}<div class="report">
    <div class="r-head">
      <label class="small muted">${t('reportFrom')} <input type="date" id="rFrom" value="${from}"></label>
      <span style="flex:1"></span>
      <button id="rCopy">${icon('copy')} ${t('copyReport')}</button>
      <button id="rCsv">${icon('download')} ${t('exportCsv')}</button>
    </div>
    <div class="r-stats">
      <div><b>${closed.length}</b><span>${t('rClosed')} <small>${t('sinceDate')} ${fmtDate(from, lang())}</small></span></div>
      <div><b>${added.length}</b><span>${t('rAdded')} <small>${t('sinceDate')} ${fmtDate(from, lang())}</small></span></div>
      <div><b>${open.length}</b><span>${t('openNow')}</span></div>
      <div class="${overdue.length ? 'bad' : ''}"><b>${overdue.length}</b><span>${t('overdue')}</span></div>
      ${focusTotal ? `<div><b class="r-focus">${focusTimeLabel(Math.round(focusTotal / 60000))}</b><span>${t('rFocus')} <small>${t('sinceDate')} ${fmtDate(from, lang())}</small></span></div>` : ''}
    </div>
    ${Object.keys(focusByArea).length > 1 ? `<div class="r-sec"><h4>${t('rFocusByArea')}</h4>${Object.entries(focusByArea).sort((a, b) => b[1] - a[1]).map(([a, ms]) => `<div class="r-bar"><span dir="auto">${esc(a)}</span><span class="r-track"><i class="focus" style="width:${(ms / Math.max(...Object.values(focusByArea))) * 100}%"></i><b>${focusTimeLabel(Math.round(ms / 60000))}</b></span></div>`).join('')}</div>` : ''}
    ${Object.keys(byArea).length ? `<div class="r-sec"><h4>${t('rByArea')}</h4>${Object.entries(byArea).sort((a, b) => b[1] - a[1]).map(([a, n]) => `<div class="r-bar"><span dir="auto">${esc(a)}</span><span class="r-track"><i style="width:${(n / Math.max(...Object.values(byArea))) * 100}%"></i><b>${n}</b></span></div>`).join('')}</div>` : ''}
    <div class="r-sec"><h4>${t('rStuck')} (${days}+ ${t('days')})</h4>${stuck.length ? stuck.map((s) => row(s.x, `${icon('user')} <bdi>${esc(s.p.name)}</bdi> · ${daysWord(s.d, lang())}`)).join('') : `<div class="muted small">—</div>`}</div>
    <div class="r-sec"><h4>${t('overdue')}</h4>${overdue.length ? overdue.map((x) => row(x, fmtDate(x.due, lang()))).join('') : `<div class="muted small">—</div>`}</div>
    <div class="r-sec"><h4>${t('rClosed')}</h4>${closed.length ? closed.map((x) => row(x, fmtDate(x.closure, lang()) + (x.start ? ` · ${daysWord(daysBetween(x.start, x.closure), lang())}` : ''))).join('') : `<div class="muted small">—</div>`}</div>
  </div>`;
  $('rFrom').onchange = (e) => { ui.reportFrom = e.target.value || null; renderList(); };
  $('rCopy').onclick = async () => {
    const lines = [`${t('report')} · ${areaLabel(ui.scope === 'all' ? null : ui.scope) === t('inbox') && ui.scope === 'all' ? t('allAreas') : areaLabel(ui.scope)} · ${fmtDate(from, lang())} → ${fmtDate(todayStr(), lang())}`, '',
      `${t('rClosed')}: ${closed.length} · ${t('rAdded')}: ${added.length} · ${t('openTasks')}: ${open.length} · ${t('overdue')}: ${overdue.length}`, ''];
    if (closed.length) lines.push(`✓ ${t('rClosed')}:`, ...closed.map((x) => `  - ${x.title}`), '');
    if (stuck.length) lines.push(`⏳ ${t('rStuck')}:`, ...stuck.map((s) => `  - ${s.x.title} → ${s.p.name} (${daysWord(s.d, lang())})`), '');
    if (overdue.length) lines.push(`⚠ ${t('overdue')}:`, ...overdue.map((x) => `  - ${x.title} (${x.due})`));
    await navigator.clipboard.writeText(lines.join('\n'));
    showToast(t('copied'));
  };
  $('rCsv').onclick = () => window.api.exportCsv(tasksCsv(inScopeAll), 'elfar-tasks');
}

function tasksCsv(tasks) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Title', 'Folder', 'Status', 'Priority', 'Start', 'Due', 'Closure', 'Pending with', 'Subtasks', 'Repeat', 'Notes'];
  const rows = tasks.map((x) => [x.title, areaLabel(x.areaId), statusOf(x), x.priority ? t(x.priority) : '', x.start, x.due, x.closure,
    peopleNames(x).join(', '), (x.subtasks || []).length ? `${x.subtasks.filter((s) => s.done).length}/${x.subtasks.length}` : '', repeatLabel(x.repeat), x.notes]);
  return [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}

// ---------------- what's new + updates ----------------
const CHANGELOG = {
  '1.19.2': {
    ar: ['التذكير لو مدوستش عليه بيمشي لوحده بعد 10 ثواني، ويرجع تاني بعد 10 دقايق (لحد 3 مرات). ولو الماوس عليه بيستنى',
      'التذكير بالعربي بقى زي الإنجليزي: الكارت على طرف الشاشة والفار جوه. وعينين الفار بتتابع الماوس وإنت بتحركه',
      'لما الشاشة تطفى أو الجهاز ينام ويصحى، الويدجت والتذكير مبقوش بيظهروا مربعات سودا',
      'الإعدادات بتفتح على "عام" على طول بدل صفحة فاضية',
      'الفاصل اللي في النص بقى له حد، فصفحة التاسك مبقتش بتضغط القايمة',
      'في اختيار الفولدر، الفولدر الفرعي بيظهر باسمه بس تحت الأساسي، من غير تكرار اسم الأساسي',
      '"راجع يومك" بقت في صفحة النهارده بس'],
    en: ['A reminder you don’t touch walks away after 10 seconds and comes back 10 minutes later (up to 3 times). It waits while your cursor is on it',
      'The Arabic reminder looks like the English one: the card at the screen edge, the mouse inside. The mouse’s eyes follow your cursor',
      'After the screen sleeps or the computer wakes up, the widget and reminder no longer show as black boxes',
      'Settings opens on General right away instead of an empty page',
      'The divider in the middle has a limit, so the task page no longer squeezes the list',
      'In the folder picker, sub-folders show by their own name under the parent, without repeating it',
      '"Review your day" is on Today only'],
  },
  '1.19.1': {
    ar: ['اللي بتضيفه من صفحة اليوم في العادة بقى لليوم ده بس، ومبقاش بيظهر في كل الأيام. ولو استخدمته قبل كده بيظهرلك تحت "استخدمتها قبل كده" تضيفه بدوسة',
      'تقدر تغيّر اسم أي حاجة بتسجلها، أو وحدتها، أو تشيلها (وتتراجع قبل ما تحفظ)، أو تخليها "كل يوم" أو "اليوم ده بس"',
      'مفيش حاجة بتتغيّر غير لما تدوس حفظ. "إلغاء" بيسيب العادة زي ما كانت',
      'Enter في خانة الإضافة بيضيف، وفي أي خانة تانية بيحفظ. والخانات الفاضية مبقتش بتبان كأنها صفر'],
    en: ['What you add from a habit’s day now belongs to that day only, instead of showing on every day. Things you used before show under "Used before" to add with one click',
      'Rename anything you log, change its unit, remove it (with undo before you save), or switch it between "Every day" and "This day only"',
      'Nothing changes until you press Save. Cancel leaves the habit as it was',
      'Enter in the add box adds, and in any other box saves. Empty boxes no longer look like zeros'],
  },
  '1.19.0': {
    ar: ['العادات بقت بتسجّل تفاصيل كل يوم: دوس على أي يوم، أو "عملتها"، يفتحلك صفحة اليوم: اتعملت ولا إجازة ولا لسه (ومكتوب تحت كل واحدة معناها)، وعملت قد إيه، ووقفت فين، وملاحظة',
      'كل عادة تختار هي بتسجّل إيه: صفحات للقراية، ودقايق للجيم، وعدد للـ Push ups والـ Pull ups… وتقدر تضيف حاجة جديدة من صفحة اليوم نفسها. وبتشوف مجموع الأسبوع على كارت العادة',
      '"وقفت عند…": اكتب وقفت فين، والمرة الجاية العادة بتقولك على الكارت، وفي صفحة النهارده، وفي التذكير',
      'الفار اللي على جنب الشاشة بقى بيوريك العادات الفاضلة النهارده (بالبنفسجي) جنب عدد التاسكات',
      'Google Drive بقى بيتلاقي على أي حرف (مش G: بس) عشان المزامنة'],
    en: ['Habits now log each day: click any day, or "Did it", to open the day: done, day off or not yet (each explained), how much, where you stopped, and a note',
      'Each habit picks what it logs: pages for reading, minutes for the gym, counts for push ups and pull ups… add more right from the day. Week totals show on the habit card',
      '"You were here…": write where you stopped, and next time the habit tells you on its card, on Today and in its reminder',
      'The mouse at the screen edge also shows habits left today (purple) next to the task count',
      'Google Drive is found on any drive letter (not only G:) for sync']
  },
  '1.18.0': {
    ar: ['التقويم بقى فيه شهر وأسبوع ويوم. في الأسبوع واليوم يومك متقسم ساعات، وخط أحمر بيوريك الساعة دلوقتي. اسحب التاسك من "من غير ميعاد" على أي ساعة، واسحب طرفها عشان تطوّلها، ودوستين على ساعة فاضية تضيف تاسك فيها',
      'من النهارده: "رتّب على الساعات" بيفتح يومك بالساعات، والتاسك اللي في ميعادها دلوقتي بتبقى في كارت "دلوقتي"',
      'الخطة بتقترح بنفسها: أول ما تفتحها بتلاقي الأهم اللي يكفّي يومك متعلّم، وزرار "✨ اقترح عليا" يرجّع الاقتراح',
      'الإضافة بتفهم الكلام: "اتصل بأحمد بكرة الساعة 3 ساعة !1 #الشغل @سارة" والميعاد والوقت والمدة والأولوية والفولدر والشخص بيتحطوا لوحدهم، وبتشوفهم وإنت بتكتب',
      'مزامنة بين أجهزتك: من الإعدادات ← البيانات، دوسة واحدة على OneDrive. ولو اتعدّل على الجهازين في نفس الوقت، التعديلات بتتدمج',
      'من جوه: اختبارات شاشات بتفتح التطبيق مستخبي وتجرب كل حاجة قبل كل إصدار، و13 اختبار للحسابات والمزامنة'],
    en: ['The calendar has month, week and day. Week and day show your hours with a red line for now. Drag a task from "No time yet" onto an hour, pull its edge to resize, double-click an empty hour to add one',
      'From Today: "Put on hours" opens your day by the hour, and a task scheduled right now becomes the "Now" card',
      'The plan suggests itself: it opens with the most pressing things that fit your day picked, and "✨ Suggest" brings the suggestion back',
      'Adding understands words: "Call Ahmed tomorrow 3pm 1h !1 #Work @Sara" sets the date, time, length, priority, folder and person, shown as you type',
      'Sync between your computers: Settings › Data, one click on OneDrive. Changes made on both at once are merged',
      'Under the hood: screen tests open the app hidden and try everything before each release, plus 13 tests for the rules and sync']
  },
  '1.17.4': {
    ar: ['دليل التطبيق اتعمل من جديد: فوق "يومك في 4 خطوات"، وتحته المميزات في ليستة قصيرة تفتح واحدة واحدة، وفيها بحث',
      '"وريني" بقى يوديك للمكان بالظبط ويحدده بإطار، ويسيبلك كارت تحت فيه الشرح وزرار "ارجع للدليل" اللي بيرجعك لنفس الميزة',
      'كارت "دلوقتي" مبقاش بيكرر نفس الكلام ("عليها الدور النهارده · عليها الدور النهارده")، واتشال زرار "الخطة" المكرر من فوق',
      'تاسك الترحيب للمستخدم الجديد بقت بتشرح التطبيق زي ما هو دلوقتي، والاختصارات فيها F (ركّز) و Esc',
      'الكيبورد: لما تتنقل بـ Tab بتشوف إطار على الزرار اللي واقف عليه'],
    en: ['A new App guide: "Your day in 4 steps" on top, then the features as a short list you open one at a time, with search',
      '"Show me" takes you to the exact spot and frames it, and leaves a card at the bottom with the explanation and "Back to the guide", which reopens the same feature',
      'The "Now" card no longer repeats itself ("Due today · Due today"), and the extra "Plan" button at the top is gone',
      'The welcome task for new users explains the app as it is now, and the shortcuts list has F (focus) and Esc',
      'Keyboard: moving with Tab shows a frame on the button you are on']
  },
  '1.17.3': {
    ar: ['"مش النهارده": أجّل التاسك لبكرة أو بعد بكرة أو الأسبوع الجاي أو أي يوم، فتختفي من النهارده وترجع في يومها. موجود في كارت "دلوقتي"، وعلى الكروت في صفحة النهارده، وفي صفحة التاسك. ولو كانت متأخرة، موعدها بيتنقل وبتتحسب تأجيل',
      'اللي خلص النهارده من الخطة والعادات بقى يتلم في سطر واحد "✓ خلصت 2" بدل ما يفضل في الصفحة',
      'Pending ← الكل مبقاش فيها التاسكات المجدولة لقدام، بقت في "مجدولة" بس',
      'زرار ▶ ركّز في عادات النهارده بقى زي باقي الزراير'],
    en: ['"Not today": move a task to tomorrow, the day after, next week or any day; it leaves Today and comes back on its day. It is on the Now card, on cards on the Today page, and on the task page. If it was late, its due date moves and it counts as put off',
      "What's done today in the plan and habits folds into one line (\"✓ 2 done\") instead of staying on the page",
      'Pending › All no longer lists tasks scheduled for later; they are under "Scheduled" only',
      "The ▶ Focus button on today's habits looks like the others"]
  },
  '1.17.2': {
    ar: ['التحديثات بقت تتسطب في هدوء من غير شاشة الـ Setup، والتطبيق بيفتح تاني لوحده بعد التحديث'],
    en: ['Updates install quietly without the setup screens, and the app opens again by itself afterwards']
  },
  '1.17.1': {
    ar: ['التحديثات: لو في تحديث نزل وجاهز، التطبيق بقى يفضل يدوّر على الأحدث منه، ولو لقى أحدث بينزّله ويتسطب هو بدل القديم. وفي الإعدادات ← التحديثات زرار "شوف لو في أحدث"، وكل مرة تفتحها بيدوّر لوحده',
      'في الإعدادات ← التحديثات: "كل الجديد في كل إصدار"',
      'قسم جديد في الإعدادات: "دليل التطبيق". فيه كل المميزات، ومكان كل واحدة، وزرار "وريني" يوديك لها'],
    en: ['Updates: when an update is downloaded and ready, the app keeps looking for a newer one; if it finds one it downloads it and installs that instead. Settings › Updates has "Look for a newer one", and it checks by itself whenever you open it',
      'Settings › Updates: "What’s new in every version"',
      'A new Settings section, "App guide": every feature, where to find it, and a "Show me" button that takes you there']
  },
  '1.17.0': {
    ar: ['صفحة النهارده أهدى: الأرقام بقت سطر صغير بدل 5 مربعات، وأهداف الأسبوع فوق، وكارت "دلوقتي" فيه حاجة واحدة تبدأ بيها على طول (و"مش دلوقتي" يوريك اللي بعدها)',
      'التاسك هتاخد قد إيه: حدد الوقت من صفحة التاسك أو من الخطة. الخطة بتقولك "خططت 5 ساعات من 6 متاحين" وبتحذّرك لو يومك اتملى، والتركيز بيقترح الوقت الباقي',
      'مراجعة الأسبوع: آخر يوم في الأسبوع الفار بيعرض عليك تراجع أسبوعك. هتشوف خلصت كام، وركزت قد إيه، والتزامك بالعادات، وإيه اللي بيتأجل، وحاجات عن نفسك (أحسن ساعات تركيزك، وأكتر يوم بتخلّص فيه، ودقة تقديرك). وبعدها تختار 3 أهداف للأسبوع الجاي',
      'أولوية 1 بقى لونها برتقالي، والأحمر بقى للمتأخر بس، والأيقونات اتوحّدت',
      'من جوه: حفظ أأمن (التطبيق والويدجت مش بيمسحوا تعديلات بعض)، واختبارات أوتوماتيك قبل كل إصدار، وسجل للأخطاء (الإعدادات ← عن التطبيق)، وتنضيف ملف الشكل'],
    en: ['A calmer Today page: the numbers are one small line instead of five cards, this week’s goals sit on top, and a "Now" card gives you one thing to start right away ("Not now" shows the next one)',
      'How long a task takes: set it on the task page or in the plan. The plan tells you "Planned 5h of 6h available" and warns when your day is full, and focus suggests the time left',
      'Weekly review: on the last day of the week the mouse offers to review it. See what got done, focus time, habits, what keeps getting put off, and what your data says about you (best focus hours, best day, how good your estimates are). Then pick up to 3 goals for next week',
      'Priority 1 is orange now, red only means late, and the icons are consistent',
      'Under the hood: safer saving (the app and the widget no longer undo each other), automatic tests before every release, an error log (Settings › About), and a cleaned-up stylesheet']
  },
  '1.16.2': {
    ar: ['زرار "▶ ركّز" رجع مكانه الصح: صغير في آخر الكارت، بعيد عن دايرة القفل ومش بيغطي الكلام',
      'متابعة العادات بقت زي النتيجة: الأسبوع ده أيام بالتاريخ واسم اليوم، و"السجل" بيفتح شهر كامل تقلّب فيه، وجنب كل أسبوع نتيجته لو العادة أسبوعية'],
    en: ['The "▶ Focus" button is back where it belongs: small, at the far end of the card, away from the close circle and not covering the text',
      "Habit tracking looks like a calendar: this week's days with their dates and names, and \"History\" opens a full month you can page through, with each week's result for weekly habits"]
  },
  '1.16.1': {
    ar: ['العادات: لو عملت جزء بس (ذاكرت 35 دقيقة من ساعتين) اليوم بيتسجل "جزئي" وبيتحسب بقد اللي عملته، وتقدر تكمّل الباقي أو تعتبرها خلصت',
      'عادات النهارده بقت تظهر في الويدجت، ولكل عادة اختيار "تظهر في الويدجت"',
      'الأسبوع بيبدأ يوم تختاره من الإعدادات ← عام (السبت أو الأحد أو الاتنين)، ونفس اليوم في العربي والإنجليزي. وتقدر تختار يوم مختلف لعادة معينة'],
    en: ['Habits: if you do only part of it (35 of 120 minutes) the day counts as "partly" for the share you did, and you can continue or count it as done',
      "Today's habits now show in the widget, and each habit has a \"Show in the widget\" option",
      'The week starts on the day you pick in Settings › General (Saturday, Sunday or Monday), the same in Arabic and English. A habit can have its own']
  },
  '1.16.0': {
    ar: ['تاب جديد "عاداتي": للحاجات اللي بتعملها على طول زي المذاكرة والجيم. تختار نوعها: أيام محددة (الأحد والتلات والخميس)، أو عدد مرات في الأسبوع (جيم 3 مرات)، أو وقت في الأسبوع (قراية 5 ساعات)',
      'اليوم اللي يعدّي من غير ما تعملها بيتسجل "فات" ومش بيتنقل ليوم تاني، والأسبوع اللي يخلص أقل من الهدف بيتسجل "أقل من الهدف". ولو عندك عذر علّم اليوم "إجازة"',
      'لكل عادة متابعة: خريطة آخر 12 أسبوع، وكام مرة ورا بعض 🔥، ونسبة التزامك. ودوسة على أي يوم فات تصلّحه',
      'الصبح بيسألك عن العادات اللي ما علّمتش عليها: عملتها ولا لأ؟',
      'عادات النهارده بتظهر في "النهارده" وفي مراجعة آخر اليوم، و▶ يبدأ تركيز بمدتها ووقته بيتحسب فيها، والفار يفكّرك في ميعادها'],
    en: ['A new "Habits" tab for things you keep doing, like studying or the gym. Pick how it is measured: set days (Sun, Tue, Thu), times a week (gym 3×), or time a week (reading 5 h)',
      'A day that passes without it counts as "missed" and never moves to another day; a week that ends below target counts as "below target". Have a reason? Mark the day as a day off',
      'Each habit has a tracker: the last 12 weeks, how many in a row 🔥, and how often you kept it up. Click a past day to fix it',
      'In the morning it asks about habits you did not mark: did you do it or not?',
      "Today's habits show on Today and in the evening review; ▶ starts a focus session of its length that counts toward it, and the mouse reminds you at its time"]
  },
  '1.15.0': {
    ar: ['شاشة التركيز اتعملت من جديد: دايرة أوضح، والفار بالساعة في النص، وأزرار دواير (وقفة في النص، و+5 ووقف على الجنب)، و"التاسك خلصت" تحت',
      'زرار "▶ ركّز" على الكارت بقى يظهر في آخر الكارت لما الماوس يعدّي عليه',
      'الإعدادات وأي نافذة بتفتح فوق شاشة التركيز مش وراها',
      'الوضع الغامق بقى رمادي هادي ومريح بدل الأسود التقيل',
      'رتّب الفولدرات بالسحب: اسحب الفولدر لفوق أو لتحت، أو حطّه على فولدر تاني يبقى جواه'],
    en: ['A new focus screen: a clearer ring, the mouse with its stopwatch in the middle, round buttons (pause in the middle, +5 and stop on the sides), and "Task done" below',
      'The "▶ Focus" button on a card now shows at the end of the card when you hover it',
      'Settings and other dialogs open above the focus screen, not behind it',
      'Dark mode is a calm graphite instead of heavy black',
      'Reorder folders by dragging: drag a folder up or down, or onto another folder to put it inside']
  },
  '1.14.1': {
    ar: ['وضع التركيز: كل مرة تبدأ بتختار المدة: 15 أو 25 أو 45 دقيقة، أو تكتب الوقت اللي يناسبك. وآخر مدة اخترتها بتتعلّم',
      'زرار الوقفة بقى علامة بس من غير كلمة',
      'وإنت في جلسة تركيز، الفار في الويدجت (وفي شريط التركيز) ماسك ساعة وبيحسبلك ⏱'],
    en: ['Focus mode: each time you start, pick the length: 15, 25 or 45 minutes, or type your own. The last one you used is remembered',
      'The pause button is just the icon now',
      'During a focus session the mouse in the widget (and in the focus bar) holds a stopwatch, timing you ⏱']
  },
  '1.14.0': {
    ar: ['شكل التطبيق: فاتح، غامق، أو زي ويندوز (الإعدادات ← عام)',
      'أسماء التاسكات العربي والإنجليزي بقت كلها جنب الدايرة بتاعتها، مهما كانت لغة التطبيق',
      'نافذة إضافة تاسك مبقتش بتختفي لما تختار التاريخ قبل ما تكتب الاسم',
      'الفار اللي على جنب الشاشة: لما مفيش تاسكات بياكل جبنة ومش واخد باله من حد 🧀، ولما الماوس يقرب عينه بتلف معاه وودانه بتقف، ولو شديت ديله بيتضايق 😤'],
    en: ['App theme: light, dark, or the same as Windows (Settings › General)',
      'Arabic and English task names now all sit next to their circle, whatever the app language',
      'The add-task card no longer disappears when you pick a date before typing the name',
      'The mouse at the screen edge: with nothing to do it munches cheese and ignores everyone 🧀, when the cursor comes near its eyes follow it and its ears perk up, and pulling its tail makes it cross 😤']
  },
  '1.13.0': {
    ar: ['تابات أقل: "النهارده" بقت فيها الرئيسية والنهارده مع بعض، و"المقفولة" بقت جوه "المراجعة" جنب التقرير. 5 تابات بدل 7',
      'خطة النهارده: أول ما تفتح التطبيق الصبح، تختار 3 لـ 5 حاجات بس تخلّصهم. بيظهروا أول حاجة في "النهارده"، ومعاهم عدّاد (1/4)',
      'مراجعة آخر اليوم: الساعة 5 الفار يفكّرك تراجع يومك. تشوف خلصت كام وركزت قد إيه، وتنقل اللي فاضل لبكرة بدوسة، وبكرة الصبح بيظهرلك أول حاجة في الخطة',
      'وقت المراجعة تغيّره من الإعدادات ← الإشعارات، والخطة اللي بتفتح لوحدها من الإعدادات ← عام'],
    en: ['Fewer tabs: "Today" now holds Home and Today together, and "Closed" moved into "Review" next to the report. 5 tabs instead of 7',
      "Today's plan: when you open the app in the morning, pick 3 to 5 things to finish. They lead the Today page with a counter (1/4)",
      'End-of-day review: at 5 PM the mouse reminds you to review your day. See what got done and how long you focused, move what is left to tomorrow in one click, and it comes first in tomorrow’s plan',
      'Change the review time in Settings › Notifications, and the morning plan in Settings › General']
  },
  '1.12.0': {
    ar: ['وضع التركيز: دوس "▶ ركّز فيها" على أي تاسك (أو حرف F). تايمر 25 دقيقة، وقدامك الخطوة الجاية بس. ولما الوقت يخلص، الفار يسألك تكمّل ولا تاخد استراحة',
      'الخطوة الجاية (أول مهمة فرعية لسه ما خلصتش) بتظهر تحت اسم التاسك',
      'لو أجّلت موعد تاسك 3 مرات، الفار يسألك: تبدأ فيها 25 دقيقة؟ تقسّمها؟ تديها لحد؟ ولا تشيلها؟',
      'التطبيق بيحسب وقت التركيز على كل تاسك، وبيظهر في صفحة التاسك وفي التقرير'],
    en: ['Focus mode: press "▶ Focus" on any task (or F). A 25-minute timer with only the next step in front of you. When time is up, the mouse asks if you want another round or a break',
      'The next step (the first subtask not done yet) shows under the task name',
      'Push a due date back 3 times and the mouse asks: start on it for 25 minutes? break it down? hand it to someone? or remove it?',
      'Focus time is tracked per task and shows on the task page and in the Report']
  },
  '1.11.0': {
    ar: ['شكل أهدى: كارت التاسك بقى أبيض وعليه خط بلون التصنيف بس، والتصنيف رقم صغير (وقّف الماوس عليه يقولك معناه)',
      'التاريخ بقى بالكلام: "متأخرة يومين"، "النهارده · 2:00 م"، "بكرة"، "الأحد"، وتاريخ البداية بقى في صفحة التاسك بس',
      'نتيجة جديدة لاختيار التاريخ بالعربي، فيها النهارده وبكرة وكمان أسبوع بدوسة، بدل نتيجة ويندوز الإنجليزي',
      'الأرقام كلها بقت بنفس الشكل (20 مش ٢٠)',
      'زرار + مبقاش بيغطي آخر تاسك، و"الإغلاق" مبيظهرش غير للتاسك المقفولة، والمدد بقت مكتوبة "3 أيام و6 ساعات"',
      'المصفوفة والتقويم والتقرير بقوا أنضف'],
    en: ['A calmer look: task cards are white with just a stripe in the priority color, and the priority is a small number (hover it to see what it means)',
      'Dates read like words: "2 days late", "Today · 2:00 PM", "Tomorrow", "Sunday". The start date now lives on the task page only',
      'A new date picker in the app\'s language, with Today, Tomorrow and In a week one click away',
      'Numbers look the same everywhere',
      'The + button no longer covers the last task, "Closure" only shows on closed tasks, and durations read "3 days 6 hours"',
      'Tidier Matrix, Calendar and Report']
  },
  '1.10.0': {
    ar: ['الويدجت اللي على جنب الشاشة: تقدر تخليه يفتح لما تدوس على الفار بس، مش أول ما الماوس يعدّي عليه (الإعدادات ← الويدجت ← يفتح إمتى)'],
    en: ['The widget at the screen edge can open only when you click the mouse, not as soon as the cursor passes over it (Settings › Desktop widget › Opens when)']
  },
  '1.9.0': {
    ar: ['الرئيسية اتنظمت في عمودين، وفوق فيها جملة بتلخص يومك ودايرة بتوريك خلصت كام من تاسكات النهارده', 'زرار اللغة بقى شكله زرار واضح', 'في التذكير: "اقفل التاسك" بيسأل الأول، وبعدها الفار بيقولك شكرًا. و✕ بيوقف التذكير بس'],
    en: ['Home is laid out in two columns, with a line that sums up your day and a ring showing how much of today is done', 'The language button now looks like a button', 'In a reminder, "Close the task" asks first, then the mouse says thanks. ✕ just stops the reminder']
  },
  '1.8.0': {
    ar: ['المصفوفة بقت زي الرسم البياني: الاستعجال على المحور اللي تحت والأهمية على الجنب، و"مش مستعجل" جنب الصفر', 'الأولويات بقت بأرقام: 1 مهم ومستعجل، 2 مهم ومش مستعجل، 3 مش مهم ومستعجل، 4 لا ده ولا ده. وقّف الماوس على الرقم يظهر معناه', 'نافذة إضافة التاسك متقسمة ومكتوب على كل جزء: الفولدر، الموعد، التصنيف', '"مش متصنفة" بتختفي من المصفوفة لما تبقى فاضية', 'التحديثات بتظهر لوحدها: التطبيق بيدوّر كل نص ساعة ولما ترجعله'],
    en: ['The Matrix is drawn like a chart: urgency along the bottom axis, importance up the side, with "not urgent" next to zero', 'Priorities are numbered: 1 important & urgent, 2 important & not urgent, 3 not important & urgent, 4 neither. Hover a number to see what it means', 'The add card is split into labeled parts: folder, due, priority', '"Unclassified" is hidden in the Matrix when it is empty', 'Updates show up by themselves: the app looks every 30 minutes and when you come back to it']
  },
  '1.7.0': {
    ar: ['صفحة الملاحظات بقت بتتنسق: عناوين، تقيل، مايل، نقط، ترقيم، قايمة تشيك، اقتباس ولينكات. وكمان تقدر تعمل كذا صفحة للتاسك', 'إضافة تاسك جديد ليها وضعين: سريع، وكامل فيه البداية والملاحظات والمهام الفرعية ومع مين', 'التصنيف وإنت بتختاره مكتوب بالأهمية (مهم ومستعجل…)، والمصفوفة بتقولك تعمل إيه (اعملها دلوقتي…)', 'المصفوفة أوضح: محاور، عنوان لكل مربع، والمربع بيعمل Scroll لو التاسكات كتير، وشرح لكل مربع تحت', 'التذكير: فار بيطلع على جنب الشاشة ويرن الجرس 🔔، وتختار الصوت، وتقدر تقول "فكّرني تاني بعد 10 دقايق"', 'سجل المتابعة بقى بينزل سطر جديد لما الصفحة تضيق'],
    en: ['Notes can be formatted: headings, bold, italic, bullets, numbers, checklists, quotes and links. A task can also have several pages', 'Adding a task has two modes: Quick, and Full with start date, notes, subtasks and who it is with', 'When you pick a priority it is named by importance (Important & urgent…); the Matrix tells you what to do (Do it now…)', 'A clearer Matrix: axes, a header for each box, boxes scroll when full, and what each box means below', 'Reminders: a mouse walks in at the side of the screen and rings a bell 🔔, with a sound you choose, and "remind me again in 10 min"', 'The follow-up log wraps onto a new line when the page is narrow']
  },
  '1.6.0': {
    ar: ['امسك ديل الفار اللي على جنب الشاشة واسحب: الفار بيمشي معاك لفوق ولتحت', 'اسحبه لفوق خالص يتثبت أعلى الشاشة وديله نازل لتحت، أو اسحبه للنص التاني يروح الجنب التاني', 'دوسة على الديل من غير سحب بتفتح الويدجت'],
    en: ['Hold the tail of the mouse at the screen edge and drag: the mouse follows you up and down', 'Drag it to the very top to dock it there with its tail hanging down, or to the other half of the screen to switch sides', 'A click on the tail without dragging opens the widget']
  },
  '1.5.0': {
    ar: ['شكل جديد للإعدادات: الأقسام على الجنب، وكل اختيار مكتوب تحته بيعمل إيه', 'البيانات والنسخ الاحتياطية بقت أوضح: حفظ نسخة، فتح نسخة، النسخ التلقائية، وExcel، وكل واحدة مكتوب دورها', 'قبل أي استرجاع أو فتح نسخة، التطبيق بيحفظ "نسخة أمان" من بياناتك الحالية تقدر ترجعلها'],
    en: ['A new Settings layout: sections on the side, and every option says what it does', 'Data & backups is clearer: save a copy, load a copy, automatic backups and Excel, each with its job explained', 'Before any restore or loaded copy, the app keeps a "safety copy" of your current data that you can go back to']
  },
  '1.4.1': {
    ar: ['التاسكات المجدولة (اللي لسه ميعادها مجاش) بقت بتظهر تحت في Pending ← الكل، باهتة، عشان الفولدر ميبانش فاضي', 'مسح سطر من سجل المتابعة بقى بيسأل الأول'],
    en: ['Scheduled tasks (not started yet) now show at the bottom of Pending › All, faded, so a folder never looks empty', 'Deleting an entry from the follow-up log now asks first']
  },
  '1.4.0': {
    ar: ['فولدرات فرعية جوه الفولدرات الفرعية (لحد ثلاث مستويات)', 'لما مفيش حاجة فاضلة النهارده، الفار اللي فوق في الجنب بيبقى مبسوط وماسك حتة جبنة رومي 🧀', 'لما تقفل آخر تاسك في يومك، فار بيطلع من تحت ويعملك Like 👍'],
    en: ['Subfolders inside subfolders (up to three levels)', 'When nothing is left for today, the mouse at the top of the sidebar is happy and holds a piece of cheese 🧀', 'Close the last task of your day and a mouse pops up from the bottom with a thumbs-up 👍']
  },
  '1.3.0': {
    ar: ['اختيار الوقت بقى عجلات: دوس واسحب لفوق ولتحت (أو استخدم البكرة)، ودوس على أي رقم يتختار', 'الوقت بقى منفصل عن التاريخ في التذكير وفي سجل المتابعة', '"الأقسام" بقى اسمها "الفولدرات"، و"المشروع" بقى "فولدر فرعي"'],
    en: ['Picking a time is now a set of wheels: hold and drag up or down (or scroll), and click a number to pick it', 'Time is now separate from the date in reminders and in the follow-up log', '"Areas" are now "Folders", and "projects" are now "subfolders"']
  },
  '1.2.0': {
    ar: ['الويدجت فيه كروت أرقام زي الرئيسية: متأخرة، النهارده، 7 أيام، عند ناس تانية. دوس على أي كارت يعرض تاسكاته', 'التاسك المتكررة: كل مرة مستقلة، والمرة الجاية بتبدأ يوم ميعادها مش يوم ما قفلت اللي قبلها. ولحد ما ييجي يومها بتبقى "مجدولة" ومش بتتحسب في Pending', 'صفحة التاسك: العنوان بينزل سطر جديد بدل ما يتقص، والتواريخ والوقت مبقتش بتدخل في بعض', 'الضغط في أي حتة على خانة التاريخ أو الوقت بيفتح الاختيار على طول', 'زرار الحذف بقى مربع أحمر واضح، والعناوين كلها بقت بنفس الشكل'],
    en: ['The widget has number cards like Home: overdue, today, 7 days, with others. Click a card to see those tasks', 'Repeating tasks: each round stands on its own, and the next one starts on its own day, not the day you closed the last one. Until then it is "scheduled" and not counted in Pending', 'Task page: the title wraps instead of being cut off, and the dates and time no longer run into each other', 'Clicking anywhere on a date or time box opens the picker', 'The delete button is now a clear red square, and all headings share one style']
  },
  '1.1.0': {
    ar: ['اسم التطبيق بقى Elfar Tasks', 'صفحة رئيسية جديدة: المتأخر، النهارده، الأسبوع الجاي، مستني رد من مين، والأقسام', 'التابات اتبسّطت: المتأخر بقى جوه "النهارده"، و"معلّق عند" بقى جوه Pending (الكل / عندي أنا / عند حد تاني)', 'الحذف بقى بيسأل الأول، بشكل التطبيق نفسه', 'التذكير: اختيار واحد واضح، وكل اختيار مكتوب جنبه هيفكّرك إمتى بالظبط', 'إضافة تاسك: تقدر تحدد وقت الـ Due', 'التقويم: أسهم أوضح جنب اسم الشهر، زرار ＋ أوضح، والفلاتر متقسمة'],
    en: ['The app is now called Elfar Tasks', 'A new Home page: overdue, today, the next 7 days, who you are waiting on, and your areas', 'Simpler tabs: overdue is now inside Today, and "Pending with" is inside Pending (All / On me / With others)', 'Deleting now asks first, in a dialog that matches the app', 'Reminders: one clear choice, and each option shows exactly when it will fire', 'Quick add: you can set a due time', 'Calendar: clearer arrows next to the month, a clearer ＋ button, and grouped filters']
  },
  '1.0.2': {
    ar: ['التابات بقت تتظبط لوحدها مع حجم الخط وعرض الشباك: لو مفيش مكان بتبقى أيقونات بس، ومفيش Scroll', '"كل الأقسام" بقى اسمه "كل التاسكات"', '"الوارد" بقى اسمه "من غير قسم"، وبيظهر بس لما يكون فيه تاسكات'],
    en: ['Tabs now fit any text size or window width: they turn into icons when space is short, with no scrolling', '"All areas" is now "All tasks"', '"Inbox" is now "No area", and only shows when it has tasks']
  },
  '1.0.1': {
    ar: ['زرار "بلّغ عن مشكلة" و"اقترح فكرة" في الإعدادات ← عن التطبيق، بيفتحوا صفحة التطبيق على GitHub', 'نفس الاختيار موجود في أيقونة التطبيق جنب الساعة', 'التحديثات بتنزل لوحدها من GitHub'],
    en: ['"Report a problem" and "Suggest an idea" buttons in Settings → About, opening the app\'s GitHub page', 'The same option is in the tray icon menu', 'Updates now arrive automatically from GitHub']
  },
  '1.0.0': {
    ar: ['تاسكات متكررة (يومي / أسبوعي / شهري / سنوي)', 'تراجع (Undo) بعد القفل أو الحذف', 'إضافة سريعة من أي برنامج: Ctrl+Alt+Space', 'بحث في كل حاجة: Ctrl+K', 'ملفات ولينكات على التاسك', 'ملخص الصبح ومتابعة الأشخاص', 'تقرير أسبوعي ونسخه أو تصديره Excel', 'نسخة احتياطية تلقائية كل يوم ومزامنة عن طريق OneDrive', 'تحكم في حجم الخط: Ctrl + / Ctrl -'],
    en: ['Repeating tasks (daily / weekly / monthly / yearly)', 'Undo after closing or deleting', 'Quick add from any app: Ctrl+Alt+Space', 'Search everything: Ctrl+K', 'Files and links on tasks', 'Morning summary and follow-up nudges', 'Weekly report, copy or export to Excel', 'Automatic daily backups and OneDrive sync', 'Text size: Ctrl + / Ctrl -']
  }
};

async function maybeWhatsNew() {
  const info = await window.api.appInfo();
  const seen = data.settings.lastSeenVersion;
  data.settings.lastSeenVersion = info.version;
  if (!seen) { save(); return; } // brand-new install: the welcome task covers it
  if (seen === info.version || !CHANGELOG[info.version]) { save(); return; }
  save();
  const items = CHANGELOG[info.version][lang()] || CHANGELOG[info.version].en;
  $('modalRoot').innerHTML = `<div class="modal-bg" id="mBg"><div class="modal">
    <h3>✨ ${t('whatsNew')} · ${info.version}</h3>
    <ul class="whatsnew">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    <div class="actions"><button class="primary" id="mCancel">${t('gotIt')}</button></div></div></div>`;
  $('mBg').onclick = (e) => { if (e.target.id === 'mBg' || e.target.id === 'mCancel') closeModal(); };
}

function updateLine(u) {
  if (!u) return '';
  return { dev: t('upDev'), checking: t('upChecking'), latest: t('upLatest'), downloading: `${t('upDownloading')} ${u.version || ''}`, ready: `${t('upReady')} ${u.version || ''}`, error: t('upError'), idle: '' }[u.status] || '';
}

function showUpdateBanner(u) {
  if ($('sUpdRow')) $('sUpdRow').innerHTML = updRowHtml(u); // Settings › Updates is open: keep it current
  let b = document.getElementById('updateBanner');
  if (u.status !== 'ready') { b && b.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'updateBanner'; b.className = 'update-banner'; document.querySelector('.main').prepend(b); }
  b.innerHTML = `<span>${icon('download')} ${t('upReady')} ${esc(u.version || '')}</span><button id="ubInstall">${t('restartUpdate')}</button>`;
  $('ubInstall').onclick = () => window.api.installUpdate();
}
