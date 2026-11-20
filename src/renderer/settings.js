// The Settings window.
// Part of the main window; loaded after app.js and shares its globals (data, ui, t, save, refresh…).

// Settings: sections on the side, each option with a one-line explanation of what it does.
async function openSettings(section) {
  const s = data.settings, w = s.widget;
  ui.setSec = section || ui.setSec || 'general';
  if (ui.setSec === 'updates') window.api.checkUpdate();
  const [login, info, displays, folder, backups] = await Promise.all([
    window.api.loginItem(), window.api.appInfo(), window.api.displays(), window.api.dataFolder(), window.api.listBackups()
  ]);
  ui.appVersion = info.version;
  const filterOpts = [['focus', t('focus')], ['overdue', t('overdue')], ['week', t('hWeek')], ['others', t('hOthers')], ['pending', t('pending')], ['starred', t('starred')]]
    .concat(topAreas().map((a) => ['area:' + a.id, a.name]))
    .concat(data.people.map((p) => ['person:' + p.id, `${t('waiting')}: ${p.name}`]));
  const zoom = Math.round((s.zoom || 1) * 100);
  // One setting: title + what it does on one side, the control on the other.
  const row = (title, desc, control, cls = '') => `<div class="set-row ${cls}"><div class="set-txt"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><div class="set-ctl">${control}</div></div>`;
  const toggle = (id, on) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></label>`;
  const card = (inner) => `<div class="set-card">${inner}</div>`;
  const backupLabel = (b) => b.kind === 'safety'
    ? `🛟 ${t('safetyCopy')} · ${fmtDate(b.date, lang())} ${fmtTime(`${b.date}T${b.time}`, lang())} · ${b.tasks} ${t('tasksWord')}`
    : `${fmtDate(b.date, lang())} · ${b.tasks} ${t('tasksWord')}`;
  const SECTIONS = [
    ['general', 'settings', t('general')], ['notifications', 'bell', t('notifications')], ['widget', 'edgeRight', t('widget')],
    ['data', 'folder', t('dataTitle')], ['updates', 'download', t('updates')], ['guide', 'idea', t('guide')], ['about', 'help', t('about')]
  ];
  const sec = (id, title, body) => `<section class="set-sec-body" data-sec="${id}" ${ui.setSec === id ? '' : 'hidden'}><h4>${title}</h4>${body}</section>`;

  $('modalRoot').innerHTML = `<div class="modal-bg" id="mBg"><div class="modal settings2">
    <nav class="set-nav">
      <div class="set-nav-title">${t('settings')}</div>
      ${SECTIONS.map(([id, ico, label]) => `<button class="${ui.setSec === id ? 'on' : ''}" data-setsec="${id}">${icon(ico)}<span>${label}</span></button>`).join('')}
    </nav>
    <div class="set-main">
      ${sec('general', t('general'), card(
        row(t('language'), '', `<div class="seg"><button data-lang="ar" class="${s.lang === 'ar' ? 'on' : ''}">عربي</button><button data-lang="en" class="${s.lang === 'en' ? 'on' : ''}">English</button></div>`) +
        row(t('launch'), t('launchDesc'), toggle('sLogin', login)) +
        row(t('planTitle'), t('planAuto'), toggle('sPlanAuto', s.planAuto !== false)) +
        row(t('dayHours'), t('dayHoursDesc'), `<span class="num-days"><input type="number" id="sDayHours" min="1" max="16" step="0.5" value="${s.dayHours || 6}"> ${t('hbHours')}</span>`) +
        row(t('weekStartLbl'), t('weekStartDesc'), `<div class="seg">${[6, 0, 1].map((d) => `<button data-wstart="${d}" class="${appWeekStart() === d ? 'on' : ''}">${new Date(2024, 0, 7 + d).toLocaleDateString(lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { weekday: 'long' })}</button>`).join('')}</div>`) +
        row(t('theme'), t('themeDesc'), `<div class="seg">${['system', 'light', 'dark'].map((m) => `<button data-theme="${m}" class="${(s.theme || 'system') === m ? 'on' : ''}">${t('theme_' + m)}</button>`).join('')}</div>`) +
        row(t('breakLen'), t('focusLenDesc'), `<div class="seg">${[5, 10].map((m) => `<button data-bmins="${m}" class="${(s.breakMins || 5) === m ? 'on' : ''}">${m}</button>`).join('')}</div>`) +
        row(`${t('textSize')} <span class="muted" id="sZoomVal">${zoom}%</span>`, t('textSizeDesc'), `<input type="range" id="sZoom" min="80" max="160" step="10" value="${zoom}">`)
      ) + card(`<div class="set-txt"><b>${t('shortcuts')}</b></div>
        <div class="keys">${shortcutList(info.quickKey).map(([k, d]) => `<div><kbd>${k}</kbd><span>${d}</span></div>`).join('')}</div>`))}

      ${sec('notifications', t('notifications'), card(
        row(t('morningSummary'), t('summaryDesc'), `${timeBox('sSumTime', s.summary.time)} ${toggle('sSum', s.summary.enabled)}`) +
        row(t('reviewSet'), t('reviewSetDesc'), `${timeBox('sRevTime', (s.review || {}).time || '17:00')} ${toggle('sRev', (s.review || {}).enabled !== false)}`) +
        row(t('nudgeTitle'), t('nudgeAfter'), `<span class="num-days"><input type="number" id="sNudge" min="1" max="30" value="${s.nudgeDays || 3}"> ${t('days')}</span>`)
      ) + card(
        row(t('remindStyle'), t('remindStyleDesc'), `<select id="sRemStyle"><option value="mouse" ${(s.remindStyle || 'mouse') === 'mouse' ? 'selected' : ''}>${t('styleMouse')}</option><option value="notification" ${s.remindStyle === 'notification' ? 'selected' : ''}>${t('styleNotif')}</option></select>`) +
        row(t('remindSound'), '', `<select id="sRemSound">${REMIND_SOUNDS.map((k) => `<option value="${k}" ${(s.remindSound || 'chime') === k ? 'selected' : ''}>${t('sound' + k[0].toUpperCase() + k.slice(1))}</option>`).join('')}</select>
          <button id="sRemTry">▶ ${t('tryIt')}</button>`)
      ))}

      ${sec('widget', t('widget'), card(
        row(t('showWidget'), t('widgetDesc'), toggle('sWidget', w.visible)) +
        row(t('widgetMode'), t('widgetModeDesc'), `<select id="sEdge">
          <option value="off" ${(w.edge || 'off') === 'off' ? 'selected' : ''}>${t('onTop')}</option>
          <option value="right" ${w.edge === 'right' ? 'selected' : ''}>${t('autoHide')} · ${t('edgeRight')}</option>
          <option value="left" ${w.edge === 'left' ? 'selected' : ''}>${t('autoHide')} · ${t('edgeLeft')}</option>
          <option value="top" ${w.edge === 'top' ? 'selected' : ''}>${t('autoHide')} · ${t('edgeTop')}</option></select>`) +
        row(t('openOn'), t('openOnDesc'), `<div class="seg"><button data-openon="hover" class="${(w.openOn || 'hover') === 'hover' ? 'on' : ''}">${t('openHover')}</button><button data-openon="click" class="${w.openOn === 'click' ? 'on' : ''}">${t('openClick')}</button></div>`) +
        row(t('widgetShows'), t('widgetShowsDesc'), `<select id="sFilter">${filterOpts.map(([v, l]) => `<option value="${v}" ${w.filter === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`) +
        (displays.length > 1 ? row(t('screen'), '', `<select id="sDisplay">${displays.map((d) => `<option value="${d.id}" ${w.display === d.id ? 'selected' : ''}>${d.label}</option>`).join('')}</select>`) : '') +
        row(t('opacity'), '', `<input type="range" id="sOpacity" min="0.4" max="1" step="0.05" value="${w.opacity || 1}">`)
      ))}

      ${sec('data', t('dataTitle'), `
        ${card(`<div class="data-item">
          <span class="di-ico">${icon('folder')}</span>
          <div class="set-txt"><b>${t('dataWhere')}</b><span>${t('syncHint')}</span>
            <div class="path-row"><code dir="ltr" title="${esc(folder)}">${esc(folder)}</code></div></div>
          <div class="set-ctl"><button id="sFolder">${t('changeFolder')}</button></div></div>`)}
        ${card(`<div class="data-item">
          <span class="di-ico ok">${icon('repeat')}</span>
          <div class="set-txt"><b>${t('autoBk')}</b><span>${t('autoBkDesc')}</span>
            <div class="path-row"><select id="sBackup">${backups.map((b) => `<option value="${esc(b.file)}">${esc(backupLabel(b))}</option>`).join('') || `<option>—</option>`}</select>
              <button class="icon-btn" id="sOpenBackups" title="${t('openBackups')}">${icon('folder')}</button></div></div>
          <div class="set-ctl"><button id="sRestore" ${backups.length ? '' : 'disabled'}>${t('restoreBtn')}</button></div></div>`)}
        <div class="set-group-title">${t('manualCopies')}</div>
        ${card(`<div class="data-item">
          <span class="di-ico">${icon('download')}</span>
          <div class="set-txt"><b>${t('saveCopy')}</b><span>${t('saveCopyDesc')}</span></div>
          <div class="set-ctl"><button id="sExport">${t('saveCopyBtn')}</button></div></div>
          <div class="data-item">
          <span class="di-ico warn">${icon('waiting')}</span>
          <div class="set-txt"><b>${t('loadCopy')}</b><span>${t('loadCopyDesc')}</span></div>
          <div class="set-ctl"><button id="sImport">${t('loadCopyBtn')}</button></div></div>`)}
        ${card(`<div class="data-item">
          <span class="di-ico xl">${icon('report')}</span>
          <div class="set-txt"><b>${t('excelTitle')}</b><span>${t('excelDesc')}</span></div>
          <div class="set-ctl"><button id="sCsv">${t('excelBtn')}</button></div></div>`)}`)}

      ${sec('updates', t('updates'), card(`<div id="sUpdRow">${updRowHtml(info.update)}</div>`) + changelogHtml())}

      ${sec('guide', t('guide'), guideHtml())}

      ${sec('about', t('about'), card(`<div class="about-top">${mouseLogo('about-logo')}<div><b>${esc(info.name)}</b> <span class="muted small">${t('version')} ${info.version}</span>
          <div class="small">${t('creditBy')}: <b>${esc(info.credit)}</b></div></div></div>
        <p class="small muted">${t('feedbackHint')}</p>
        <div class="about-btns">
          <button id="sBug">${icon('bug')} ${t('reportBug')}</button>
          <button id="sIdea">${icon('idea')} ${t('suggestIdea')}</button>
          <button id="sIssues">${icon('github')} ${t('seeRequests')}</button>
          <button id="sLogs" title="${t('errorLogTip')}">${icon('log')} ${t('errorLog')}</button>
        </div>`))}
      <div class="set-foot"><button class="primary" id="mCancel">${t('closeBtn')}</button></div>
    </div>
  </div></div>`;

  const setW = (patch) => { data.settings.widget = { ...data.settings.widget, ...patch }; save(); };
  // Load a copy / restore: confirm with what you're about to load, then replace (a safety copy is kept first).
  const loadFrom = async (file, label, tasks) => {
    if (!(await askConfirm({ title: t('confirmLoadTitle'), text: `${label}${tasks != null ? ` · ${tasks} ${t('tasksWord')}` : ''}\n${t('confirmLoadText')}`, ok: t('restoreBtn'), danger: true }))) return;
    await window.api.restoreBackup(file);
    adoptData(await window.api.getData()); ui.selected = null; renderAll();
    showToast(t('restoredMsg'));
    openSettings('data');
  };
  $('mBg').onclick = async (e) => {
    const id = e.target.closest('button')?.id || e.target.id;
    if (id === 'mBg' || id === 'mCancel') return closeModal();
    const nav = e.target.closest('[data-setsec]');
    if (nav) {
      ui.setSec = nav.dataset.setsec;
      if (ui.setSec === 'updates') window.api.checkUpdate(); // look again whenever you open it
      document.querySelectorAll('[data-setsec]').forEach((b) => b.classList.toggle('on', b === nav));
      document.querySelectorAll('.set-sec-body').forEach((x) => { x.hidden = x.dataset.sec !== ui.setSec; if (!x.hidden) animateIn(x); });
      return;
    }
    if (e.target.dataset.lang) { data.settings.lang = e.target.dataset.lang; save(); renderAll(); openSettings(); }
    if (e.target.dataset.wstart) { data.settings.weekStart = Number(e.target.dataset.wstart); save(); document.querySelectorAll('[data-wstart]').forEach((b) => b.classList.toggle('on', b === e.target)); renderList(); }
    if (e.target.dataset.theme) { data.settings.theme = e.target.dataset.theme; save(); document.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('on', b === e.target)); }
    if (e.target.dataset.fmins) { data.settings.focusMins = Number(e.target.dataset.fmins); save(); document.querySelectorAll('[data-fmins]').forEach((b) => b.classList.toggle('on', b === e.target)); }
    if (e.target.dataset.bmins) { data.settings.breakMins = Number(e.target.dataset.bmins); save(); document.querySelectorAll('[data-bmins]').forEach((b) => b.classList.toggle('on', b === e.target)); }
    if (e.target.dataset.openon) { setW({ openOn: e.target.dataset.openon }); document.querySelectorAll('[data-openon]').forEach((b) => b.classList.toggle('on', b === e.target)); }
    if (id === 'sBug') window.api.openGithub('bug');
    if (id === 'sIdea') window.api.openGithub('idea');
    if (id === 'sIssues') window.api.openGithub('list');
    if (id === 'sLogs') window.api.openLogs();
    if (id === 'sExport' && await window.api.exportData()) showToast(t('savedCopyMsg'));
    if (id === 'sCsv' && await window.api.exportCsv(tasksCsv(data.tasks), 'elfar-tasks')) showToast(t('savedCopyMsg'));
    if (id === 'sOpenBackups') window.api.openBackups();
    if (id === 'sRemTry') { if ((data.settings.remindStyle || 'mouse') === 'mouse') window.api.testReminder(); else playSound(data.settings.remindSound || 'chime'); }
    if (id === 'sCheck') { window.api.checkUpdate(); $('sUpd').textContent = t('upChecking'); }
    if (id === 'sCheckNewer') { window.api.checkUpdate(); $('sUpd').textContent = t('upCheckingNewer'); }
    if (id === 'sInstall') window.api.installUpdate();
    if (id === 'sFolder') {
      const dir = await window.api.chooseDataFolder();
      if (dir) { adoptData(await window.api.getData()); renderAll(); openSettings('data'); }
    }
    if (id === 'sRestore') {
      const b = backups.find((x) => x.file === $('sBackup').value);
      if (b) loadFrom(b.file, backupLabel(b).replace(/ · \d+ .*$/, ''), b.tasks);
    }
    if (id === 'sImport') {
      const f = await window.api.pickCopy();
      if (f && f.error) return askConfirm({ title: t('badCopy'), text: f.name, ok: t('ok') });
      if (f) loadFrom(f.file, f.name, f.tasks);
    }
  };
  $('sLogin').onchange = (e) => window.api.loginItem(e.target.checked);
  $('sDayHours').onchange = (e) => { data.settings.dayHours = Math.max(1, Math.min(16, Number(e.target.value) || 6)); save(); };
  $('sPlanAuto').onchange = (e) => { data.settings.planAuto = e.target.checked; save(); };
  $('sZoom').oninput = (e) => { $('sZoomVal').textContent = e.target.value + '%'; };
  $('sZoom').onchange = (e) => { data.settings.zoom = Number(e.target.value) / 100; save(); };
  $('sRev').onchange = (e) => { data.settings.review = { time: '17:00', ...(data.settings.review || {}), enabled: e.target.checked }; save(); };
  $('sRevTime').onchange = (e) => { if (timeValue(e.target)) { data.settings.review = { enabled: true, ...(data.settings.review || {}), time: timeValue(e.target) }; save(); } };
  $('sSum').onchange = (e) => { data.settings.summary = { ...data.settings.summary, enabled: e.target.checked }; save(); };
  $('sSumTime').onchange = (e) => { if (timeValue(e.target)) { data.settings.summary = { ...data.settings.summary, time: timeValue(e.target) }; save(); } };
  $('sRemStyle').onchange = (e) => { data.settings.remindStyle = e.target.value; save(); };
  $('sRemSound').onchange = (e) => { data.settings.remindSound = e.target.value; save(); playSound(e.target.value); };
  $('sNudge').onchange = (e) => { data.settings.nudgeDays = Math.max(1, Math.min(30, Number(e.target.value) || 3)); save(); };
  $('sWidget').onchange = (e) => setW({ visible: e.target.checked });
  $('sEdge').onchange = (e) => setW(e.target.value === 'off' ? { edge: 'off' } : { edge: e.target.value, lastEdge: e.target.value, edgeOffset: null, visible: true });
  if ($('sDisplay')) $('sDisplay').onchange = (e) => setW({ display: Number(e.target.value) });
  $('sOpacity').oninput = (e) => setW({ opacity: Number(e.target.value) });
  $('sFilter').onchange = (e) => setW({ filter: e.target.value });
}

// The keyboard shortcuts, shown as a list in Settings › General.
function shortcutList(quickKey) {
  const ar = lang() === 'ar';
  return [
    ['Ctrl+N', ar ? 'تاسك جديد' : 'New task'],
    [quickKey || 'Ctrl+Shift+Space', ar ? 'إضافة من أي برنامج' : 'Add from any app'],
    ['Ctrl+K', ar ? 'بحث في كل حاجة' : 'Search everything'],
    ['↑ ↓', ar ? 'تنقل بين التاسكات' : 'Move between tasks'],
    ['Space', ar ? 'قفل التاسك' : 'Close the task'],
    ['1 – 4', ar ? 'التصنيف' : 'Priority'],
    ['S', ar ? 'تمييز' : 'Star'],
    ['F', ar ? 'ركّز على التاسك' : 'Focus on the task'],
    ['Esc', ar ? 'قفل اللي مفتوح' : 'Close what is open'],
    ['Delete', ar ? 'حذف' : 'Delete'],
    ['Ctrl + / −', ar ? 'حجم الخط' : 'Text size']
  ];
}


// The update line in Settings › Updates. An update that's ready can be installed now, and you can
// still look for a newer one first (if there is, it downloads and replaces it).
function updRowHtml(u) {
  const ver = ui.appVersion || '';
  const ready = u && u.status === 'ready';
  const line = updateLine(u) || t('updatesDesc');
  return `<div class="set-row"><div class="set-txt"><b>${t('version')} ${ver}</b><span id="sUpd">${line}${ready ? ` · <span class="muted">${t('upNewestHint')}</span>` : ''}</span></div>
    <div class="set-ctl">${ready ? `<button id="sCheckNewer">${t('checkNewer')}</button><button class="primary" id="sInstall">${t('restartUpdate')}</button>`
      : `<button id="sCheck" ${u && ['dev', 'downloading', 'checking'].includes(u.status) ? 'disabled' : ''}>${t('checkNow')}</button>`}</div></div>`;
}
