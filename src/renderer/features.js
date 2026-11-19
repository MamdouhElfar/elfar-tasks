// Extra features for the main window. Loaded after app.js and shares its globals
// (data, ui, t, lang, save, refresh, taskById, ...).

// ---------------- recurring tasks ----------------
// task.repeat = { every: n, unit: 'day' | 'week' | 'month' | 'year' }
function shiftDate(ds, n, unit) {
  const d = new Date(ds + 'T00:00');
  if (unit === 'day') d.setDate(d.getDate() + n);
  if (unit === 'week') d.setDate(d.getDate() + 7 * n);
  if (unit === 'month') { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
  if (unit === 'year') d.setFullYear(d.getFullYear() + n);
  return todayStr(d);
}

// Closing a repeating task creates the next one (same details, fresh subtasks, next due date).
function spawnNext(x) {
  if (!x.repeat || x.spawned) return null;
  const { every = 1, unit } = x.repeat;
  const base = x.due || x.closure || todayStr();
  const due = shiftDate(base, every, unit);
  const offset = x.due ? daysBetween(x.due, due) : null;
  const next = {
    ...JSON.parse(JSON.stringify(x)),
    id: uid(), start: todayStr(), due, closure: null, spawned: null, reminded: undefined,
    subtasks: (x.subtasks || []).map((s) => ({ ...s, id: uid(), done: false })),
    log: [], pendingWith: [], created: Date.now(), updated: Date.now(),
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
    const loc = lang() === 'ar' ? 'ar-EG' : 'en-GB';
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
  if (m < 10080) return `${m / 1440} ${t('dayBefore')}`;
  return t('weekBefore');
}
function remindBeforeOptions(cur) {
  return `<option value="" ${cur == null ? 'selected' : ''}>${t('remindPh')}</option>` +
    REMIND_BEFORE.map((m) => `<option value="${m}" ${cur === m ? 'selected' : ''}>🔔 ${remindBeforeLabel(m)}</option>`).join('');
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
    if (['calendar', 'matrix', 'report'].includes(ui.view)) return;
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
    if (e.key === 'Enter') { e.preventDefault(); $('dTitle')?.focus(); return; }
    if (e.key === 'Delete') { deleteTask(x); }
  });
}

function deleteTask(x) {
  const snap = snapshot();
  data.tasks = data.tasks.filter((y) => y.id !== x.id);
  ui.selected = null; save(); refresh();
  offerUndo(`${t('deleted')}: ${x.title}`, snap);
}

// ---------------- weekly report + CSV ----------------
function weekStart() {
  const d = new Date(); const back = (d.getDay() - (lang() === 'ar' ? 6 : 1) + 7) % 7;
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
  const byArea = {};
  for (const x of closed) byArea[areaLabel(x.areaId)] = (byArea[areaLabel(x.areaId)] || 0) + 1;
  const row = (x, extra = '') => `<div class="r-item ${quadClass(x)}" data-task="${x.id}"><span dir="auto">${esc(x.title)}</span><span class="muted small">${extra}</span></div>`;
  $('list').innerHTML = `<div class="report">
    <div class="r-head">
      <label class="small muted">${t('reportFrom')} <input type="date" id="rFrom" value="${from}"></label>
      <span style="flex:1"></span>
      <button id="rCopy">${icon('copy')} ${t('copyReport')}</button>
      <button id="rCsv">${icon('download')} ${t('exportCsv')}</button>
    </div>
    <div class="r-stats">
      <div><b>${closed.length}</b><span>${t('rClosed')}</span></div>
      <div><b>${added.length}</b><span>${t('rAdded')}</span></div>
      <div><b>${open.length}</b><span>${t('openTasks')}</span></div>
      <div class="${overdue.length ? 'bad' : ''}"><b>${overdue.length}</b><span>${t('overdue')}</span></div>
    </div>
    ${Object.keys(byArea).length ? `<div class="r-sec"><h4>${t('rByArea')}</h4>${Object.entries(byArea).sort((a, b) => b[1] - a[1]).map(([a, n]) => `<div class="r-bar"><span dir="auto">${esc(a)}</span><i style="width:${(n / closed.length) * 100}%"></i><b>${n}</b></div>`).join('')}</div>` : ''}
    <div class="r-sec"><h4>${t('rStuck')} (${days}+ ${t('days')})</h4>${stuck.length ? stuck.map((s) => row(s.x, `${icon('user')} ${esc(s.p.name)} · ${s.d} ${t('days')}`)).join('') : `<div class="muted small">—</div>`}</div>
    <div class="r-sec"><h4>${t('overdue')}</h4>${overdue.length ? overdue.map((x) => row(x, fmtDate(x.due, lang()))).join('') : `<div class="muted small">—</div>`}</div>
    <div class="r-sec"><h4>${t('rClosed')}</h4>${closed.length ? closed.map((x) => row(x, fmtDate(x.closure, lang()) + (x.start ? ` · ${daysBetween(x.start, x.closure)} ${t('days')}` : ''))).join('') : `<div class="muted small">—</div>`}</div>
  </div>`;
  $('rFrom').onchange = (e) => { ui.reportFrom = e.target.value || null; renderList(); };
  $('rCopy').onclick = async () => {
    const lines = [`${t('report')} · ${areaLabel(ui.scope === 'all' ? null : ui.scope) === t('inbox') && ui.scope === 'all' ? t('allAreas') : areaLabel(ui.scope)} · ${fmtDate(from, lang())} → ${fmtDate(todayStr(), lang())}`, '',
      `${t('rClosed')}: ${closed.length} · ${t('rAdded')}: ${added.length} · ${t('openTasks')}: ${open.length} · ${t('overdue')}: ${overdue.length}`, ''];
    if (closed.length) lines.push(`✓ ${t('rClosed')}:`, ...closed.map((x) => `  - ${x.title}`), '');
    if (stuck.length) lines.push(`⏳ ${t('rStuck')}:`, ...stuck.map((s) => `  - ${s.x.title} → ${s.p.name} (${s.d} ${t('days')})`), '');
    if (overdue.length) lines.push(`⚠ ${t('overdue')}:`, ...overdue.map((x) => `  - ${x.title} (${x.due})`));
    await navigator.clipboard.writeText(lines.join('\n'));
    showToast(t('copied'));
  };
  $('rCsv').onclick = () => window.api.exportCsv(tasksCsv(inScopeAll), 'elfar-notes-tasks');
}

function tasksCsv(tasks) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Title', 'Area', 'Status', 'Priority', 'Start', 'Due', 'Closure', 'Pending with', 'Subtasks', 'Repeat', 'Notes'];
  const rows = tasks.map((x) => [x.title, areaLabel(x.areaId), statusOf(x), x.priority ? t(x.priority + 'a') : '', x.start, x.due, x.closure,
    peopleNames(x).join(', '), (x.subtasks || []).length ? `${x.subtasks.filter((s) => s.done).length}/${x.subtasks.length}` : '', repeatLabel(x.repeat), x.notes]);
  return [head, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}

// ---------------- what's new + updates ----------------
const CHANGELOG = {
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
  let b = document.getElementById('updateBanner');
  if (u.status !== 'ready') { b && b.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'updateBanner'; b.className = 'update-banner'; document.querySelector('.main').prepend(b); }
  b.innerHTML = `<span>${icon('download')} ${t('upReady')} ${esc(u.version || '')}</span><button id="ubInstall">${t('restartUpdate')}</button>`;
  $('ubInstall').onclick = () => window.api.installUpdate();
}
