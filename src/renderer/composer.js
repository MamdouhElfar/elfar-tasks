// The add-task card (the floating + button).
// Part of the main window; loaded after app.js and shares its globals (data, ui, t, save, refresh…).

// ---------------- quick-add card (floating + button) ----------------
// Defaults follow where you are: current area, today's date on Today/Overdue tabs, the matrix box you're in.
const composer = { title: '', areaId: null, due: null, priority: null };

function openComposer(preset = {}) {
  composer.title = '';
  composer.areaId = ui.scope === 'all' || ui.scope === 'inbox' ? null : ui.scope;
  composer.due = preset.due || (ui.view === 'today' ? todayStr() : null);
  composer.priority = null;
  composer.repeat = '';
  composer.remindBefore = '';
  composer.dueTime = null;
  composer.start = null; composer.notes = ''; composer.subs = ''; composer.person = '';
  renderComposer();
  $('composer').classList.add('open');
  $('fab').classList.add('open');
  setTimeout(() => $('cTitle')?.focus(), 30);
}

function closeComposer() {
  $('composer').classList.remove('open');
  $('fab').classList.remove('open');
}

// Quick: title, folder, dates, repeat, reminder, priority. Full: also start, notes, subtasks
// and who it's with, for when you want to write the details as you add it. Remembered.
function renderComposer() {
  const full = !!data.settings.composerFull;
  $('composer').classList.toggle('full', full);
  $('composer').innerHTML = `
    <div class="c-top"><span class="c-name">${icon('note')} ${t('newTask')}</span>
      <span class="seg-joined c-mode"><button class="${full ? '' : 'on'}" data-cmode="quick">${t('quickMode')}</button><button class="${full ? 'on' : ''}" data-cmode="full">${t('fullMode')}</button></span></div>
    <input type="text" class="c-title" id="cTitle" dir="auto" placeholder="${t('newTask')}…" value="${esc(composer.title)}" autocomplete="off">
    <div class="err" id="cErr">${t('titleRequired')}</div>
    <div class="c-sec"><span class="c-sec-lbl">${icon('folder')} ${t('area')}</span>
      <select id="cArea" title="${t('area')}">${areaOptions(composer.areaId)}</select></div>
    <div class="c-sec"><span class="c-sec-lbl">${icon('calendar')} ${t('due')}</span>
      <div class="c-row"><input type="date" id="cDue" title="${t('due')}" value="${composer.due || ''}">${timeBox('cDueTime', composer.dueTime, `title="${t('dueTime')}"`)}</div>
      <div class="c-row"><select id="cRepeat" title="${t('repeat')}">${repeatOptions(composer.repeat ? parseRepeat(composer.repeat) : null, composer.due)}</select>
        <select id="cRemind" title="${composer.due ? t('reminder') : t('remindNeedsDue')}" ${composer.due ? '' : 'disabled'}>${composerRemindOptions()}</select></div></div>
    <div class="c-sec"><span class="c-sec-lbl">${icon('matrix')} ${t('priority')}</span>
      ${prioPicker(composer.priority, 'data-cprio', prioNames(), t('noPrio'))}</div>
    ${full ? `<div class="c-full">
      <div class="c-row"><label class="c-lbl"><span>${icon('today')} ${t('start')}</span><input type="date" id="cStart" value="${composer.start || todayStr()}"></label>
        <label class="c-lbl"><span>${icon('user')} ${t('waiting')}</span><input type="text" id="cPerson" dir="auto" list="cPeople" value="${esc(composer.person)}" placeholder="${t('noOne')}" autocomplete="off"></label>
        <datalist id="cPeople">${data.people.map((p) => `<option value="${esc(p.name)}"></option>`).join('')}</datalist></div>
      <label class="c-lbl"><span>${icon('list')} ${t('subtasks')}</span><textarea id="cSubs" dir="auto" rows="3" placeholder="${t('subsPh')}">${esc(composer.subs)}</textarea></label>
      <label class="c-lbl"><span>${icon('note')} ${t('notes')}</span><textarea id="cNotes" dir="auto" rows="4" placeholder="${t('notesPh')}">${esc(composer.notes)}</textarea></label>
    </div>` : ''}
    <div class="c-foot"><span class="hint">${full ? t('composerHintFull') : t('composerHint')}</span><button class="primary" id="cAdd">${t('addBtn')}</button></div>`;
}

const composerRemindOptions = () =>
  remindBeforeOptions(composer.remindBefore === '' ? null : Number(composer.remindBefore), composer.due, composer.dueTime);

// Date or time changed: the reminder choices show new times (and switch off with no date).
function refreshComposerRemind() {
  if (!composer.due) composer.remindBefore = '';
  const sel = $('cRemind');
  sel.innerHTML = composerRemindOptions();
  sel.disabled = !composer.due;
  sel.title = composer.due ? t('reminder') : t('remindNeedsDue');
}

function submitComposer() {
  const title = $('cTitle').value.trim();
  if (!title) { $('cErr').classList.add('show'); $('cTitle').focus(); return; }
  const full = !!data.settings.composerFull;
  addTask(title, { areaId: $('cArea').value || null, due: $('cDue').value || null, dueTime: ($('cDue').value && timeValue($('cDueTime'))) || null, priority: composer.priority,
    repeat: parseRepeat($('cRepeat').value), remindBefore: $('cRemind').value === '' ? null : Number($('cRemind').value),
    ...(full ? { start: $('cStart').value || null, person: $('cPerson').value.trim(), notes: $('cNotes').value.trim(),
      subtasks: $('cSubs').value.split('\n').map((s) => s.trim()).filter(Boolean) } : {}) });
  // Stay open for the next one, keeping folder/date/priority — handy for adding a batch.
  composer.title = '';
  $('cTitle').value = '';
  if (full) { composer.notes = composer.subs = composer.person = ''; $('cNotes').value = $('cSubs').value = $('cPerson').value = ''; }
  $('cTitle').focus();
}

function bindComposer() {
  $('fab').onclick = () => ($('composer').classList.contains('open') ? closeComposer() : openComposer());
  const c = $('composer');
  c.onclick = (e) => {
    const p = e.target.closest('[data-cprio]');
    if (p) {
      composer.priority = composer.priority === p.dataset.cprio ? null : p.dataset.cprio;
      syncPrioPicker(p.closest('.pp'), composer.priority);
      return $('cTitle').focus();
    }
    if (e.target.id === 'cAdd') submitComposer();
    const m = e.target.closest('[data-cmode]');
    if (m) {
      data.settings.composerFull = m.dataset.cmode === 'full'; save();
      renderComposer();
      setTimeout(() => $('cTitle').focus(), 20);
    }
  };
  c.oninput = (e) => {
    if (e.target.id === 'cTitle') { composer.title = e.target.value; $('cErr').classList.remove('show'); }
    if (e.target.id === 'cNotes') composer.notes = e.target.value;
    if (e.target.id === 'cSubs') composer.subs = e.target.value;
    if (e.target.id === 'cPerson') composer.person = e.target.value;
  };
  c.onchange = (e) => {
    if (e.target.id === 'cArea') composer.areaId = e.target.value || null;
    if (e.target.id === 'cDue') { composer.due = e.target.value || null; $('cRepeat').innerHTML = repeatOptions(parseRepeat(composer.repeat), composer.due); refreshComposerRemind(); }
    if (e.target.id === 'cDueTime') { composer.dueTime = timeValue(e.target) || null; refreshComposerRemind(); }
    if (e.target.id === 'cRepeat') composer.repeat = e.target.value;
    if (e.target.id === 'cRemind') composer.remindBefore = e.target.value;
    if (e.target.id === 'cStart') composer.start = e.target.value || null;
  };
  // Enter adds; in the notes / subtasks boxes Enter is a new line and Ctrl+Enter adds.
  c.onkeydown = (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return;
    if (e.target.tagName === 'TEXTAREA' && !e.ctrlKey) return;
    e.preventDefault(); submitComposer();
  };
  // Clicking anywhere outside closes it (unless you've typed something).
  document.addEventListener('mousedown', (e) => {
    if (!c.classList.contains('open') || c.contains(e.target) || $('fab').contains(e.target) || e.target.closest?.('.tp-pop, .dp-pop')) return;
    if (!$('cTitle').value.trim()) closeComposer();
  });
}

