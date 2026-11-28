// Runs inside the (hidden) app window during `npm run smoke`. Clicks through the main screens and
// features; any thrown error, failed check, or console error fails the release.
(async () => {
  const failures = [];
  const w = (ms) => new Promise((r) => setTimeout(r, ms));
  const check = (name, cond) => { if (!cond) failures.push(name); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { failures.push(`${name}: ${e && e.message || e}`); } };
  const tomorrow = hAdd(todayStr(), 1);

  await step('every tab renders', async () => {
    for (const v of ['today', 'pending', 'matrix', 'calendar', 'report', 'closed', 'habits']) {
      ui.view = v; ui.selected = null; refresh(); await w(80);
      check(`tab ${v} has content`, $('list').innerHTML.length > 50);
    }
  });
  await step('charts on Review and Habits', async () => {
    ui.view = 'report'; refresh(); await w(80);
    check('review number tiles', document.querySelectorAll('#list .st-tile').length >= 3);
    check('review charts', document.querySelectorAll('#list .ch-card').length >= 2);
  });
  await step('four tabs; Tasks switches list / matrix / calendar', async () => {
    ui.view = 'pending'; refresh(); await w(60);
    check('four tabs', document.querySelectorAll('#tabs .tab').length === 4);
    document.querySelector('[data-tview="matrix"]').click(); await w(60);
    check('matrix inside Tasks', ui.view === 'matrix' && document.querySelector('.tab[data-view="pending"]').classList.contains('active'));
    document.querySelector('[data-tview="pending"]').click(); await w(60);
    check('back to the list', ui.view === 'pending');
  });
  await step('people: in the filter, not the sidebar or Today', async () => {
    ui.view = 'today'; refresh(); await w(60);
    check('no Waiting on panel on Today', !document.querySelector('#list .h-people'));
    check('no people in the sidebar', getComputedStyle(document.getElementById('peopleTitle').parentElement).display === 'none');
    ui.view = 'pending'; refresh(); await w(60);
    check('people filter lists Sara with her count', [...document.querySelectorAll('#personFilter option')].some((o) => /Sara \(1\)/.test(o.textContent)));
    openPeopleManager(); await w(60);
    check('people manager', document.querySelectorAll('.pm-row').length >= 1);
    closeModal(); await w(200);
  });
  await step('edit a follow-up already written', async () => {
    const x = data.tasks.find((y) => y.title === 'Report');
    x.log = [{ id: 'lg1', date: todayStr(), at: todayStr() + 'T09:00', text: 'Sent to Sara' }]; touch(x);
    select(x.id); await w(120);
    document.querySelector('[data-log-edit="lg1"]').click(); await w(60);
    document.getElementById('leText').value = 'Sent to Sara and Omar';
    document.querySelector('[data-log-save="lg1"]').click(); await w(60);
    check('log text changed', x.log[0].text === 'Sent to Sara and Omar');
    check('no notes box on a plain task', !document.querySelector('#detail .notes-sec') && !document.querySelector('[data-dmore="notes"]'));
    ui.selected = null; refresh();
  });
  await step('open items', async () => {
    ui.view = 'pending'; ui.pendingSub = 'all'; refresh(); openComposer(); await w(60);
    document.querySelector('[data-ckind="topic"]').click(); await w(40);
    $('cTitle').value = 'Smoke topic'; submitComposer(); closeComposer(); await w(60);
    const tp = data.tasks.find((y) => y.title === 'Smoke topic');
    check('open item created without a due date', tp && tp.topic && !tp.due && tp.checkEvery === 14);
    check('not in All', !currentTasks().some((y) => y.id === tp.id));
    ui.pendingSub = 'topics'; refresh(); await w(40);
    check('in Open items', currentTasks().some((y) => y.id === tp.id));
    tp.start = hAdd(todayStr(), -20); touch(tp);
    ui.view = 'today'; refresh(); await w(60);
    check('stale open item shows on Today', !!document.querySelector(`#list [data-task="${tp.id}"]`));
    select(tp.id); await w(100);
    check('open item page', !!document.querySelector('#detail .tp-box'));
    document.getElementById('dAddLog').value = 'they replied'; addLogEntry(tp); await w(60);
    check('an update clears needs-a-look', !topicStale(tp));
    // A task picked for today's plan, then turned into an open item, leaves the plan and Today.
    addTask('Smoke plan to topic', { due: todayStr() }); const pt = data.tasks.find((y) => y.title === 'Smoke plan to topic');
    data.plan = { date: todayStr(), ids: [pt.id] }; select(pt.id); await w(100);
    document.querySelector('[data-dmore="topic"]').click(); await w(60);
    ui.view = 'today'; ui.selected = null; refresh(); await w(60);
    check('open item left the plan', !todayPlan() || !todayPlan().ids.includes(pt.id));
    check('open item not on Today', !document.querySelector(`#list [data-task="${pt.id}"]`));
    data.plan = null; save();
    ui.selected = null; ui.pendingSub = 'all'; refresh();
  });
  await step('a plain task page shows only what is used', async () => {
    const x = data.tasks.find((y) => y.title === 'Report');
    select(x.id); await w(120);
    check('no repeat box until asked', !document.getElementById('dRepeat'));
    document.querySelector('[data-dmore="repeat"]').click(); await w(60);
    check('＋ Repeat opens it', !!document.getElementById('dRepeat'));
    ui.selected = null; refresh();
  });
  await step('calendar month / week / day', async () => {
    ui.view = 'calendar';
    for (const cv of ['month', 'week', 'day']) { data.settings.calView = cv; refresh(); await w(80); check(`calendar ${cv}`, $('list').innerHTML.length > 50); }
    check('day view has the now line', !!document.getElementById('tgNow'));
    data.settings.calView = 'month';
  });
  let added;
  await step('add a task with words', async () => {
    ui.view = 'pending'; refresh(); openComposer(); await w(80);
    $('cTitle').value = 'Smoke call tomorrow 3pm 1h !1'; $('cTitle').dispatchEvent(new Event('input', { bubbles: true }));
    check('preview chips', $('cParse').children.length >= 3);
    submitComposer(); closeComposer(); await w(80);
    added = data.tasks.find((x) => x.title === 'Smoke call');
    check('task added', !!added);
    check('due, time, length, priority read from the words', added && added.due === tomorrow && added.dueTime === '15:00' && added.estimate === 60 && added.priority === 'q1');
  });
  await step('task page', async () => {
    select(added.id); await w(120);
    check('task page open', !!document.querySelector('#detail .d-title'));
    check('no time estimate on the task page', !document.querySelector('#detail .est-field'));
    ui.selected = null; refresh();
  });
  await step('time block', async () => {
    added.blockAt = `${tomorrow}T09:00`; added.blockMins = 60; touch(added);
    ui.view = 'calendar'; data.settings.calView = 'week'; ui.calDay = tomorrow; refresh(); await w(80);
    check('block shows in week view', !!document.querySelector(`.tg-ev[data-task="${added.id}"]`));
    data.settings.calView = 'month'; ui.view = 'today'; refresh();
  });
  await step('plan suggests and saves', async () => {
    openPlan(); await w(120);
    check('plan has picks', document.querySelectorAll('[data-pick]:checked').length > 0);
    document.getElementById('plGo').click(); await w(80);
    check('plan saved', data.plan && data.plan.date === todayStr() && data.plan.ids.length > 0);
  });
  await step('focus start and stop', async () => {
    const x = data.tasks.find((y) => isActive(y));
    receiveData(await window.api.focus('start', x.id, { mins: 25 }));
    renderFocus(true); await w(50);
    check('focus running', data.focus && data.focus.mode === 'work');
    check('focus bar', !!document.querySelector('#focusBar.on'));
    receiveData(await window.api.focus('stop')); renderFocus(true);
    check('focus stopped', !data.focus);
  });
  await step('not today', async () => {
    const x = data.tasks.find((y) => isActive(y) && y.id !== added.id);
    deferTask(x, tomorrow); await w(50);
    check('moved to tomorrow', statusOf(x) === 'scheduled' && x.start === tomorrow);
  });
  await step('habits', async () => {
    data.habits.push({ id: 'smokeH', name: 'Smoke habit', emoji: '', color: 'blue', kind: 'days', days: [0, 1, 2, 3, 4, 5, 6], start: todayStr(), end: { type: 'never' }, log: {}, minutes: {}, duration: 30 });
    save(); ui.view = 'habits'; refresh(); await w(80);
    check('habit card', !!document.querySelector('[data-habit="smokeH"]'));
    check('habits summary', !!document.querySelector('#list .hb-sum'));
    // the day sheet: log amounts and where you stopped
    const h = habitById('smokeH'); h.measures = [{ id: 'm1', name: 'Pages', unit: 'pages' }]; h.askStop = true; save(); refresh(); await w(50);
    document.querySelector(`[data-habit="smokeH"] [data-hday="${todayStr()}"]`).click(); await w(80);
    check('day sheet opens', !!document.querySelector('.modal.hd'));
    document.querySelector('[data-rval="0"]').value = '12';
    document.getElementById('hdStop').value = 'page 40';
    // an item for this day only
    document.getElementById('hdNewName').value = 'Push ups'; document.getElementById('hdAddM').click(); await w(30);
    document.querySelector('[data-rval="1"]').value = '20';
    document.querySelector('[data-hdsave]').click(); await w(80);
    check('amount saved', habitEntry(habitById('smokeH'), todayStr())?.vals?.m1 === 12);
    const pu = habitById('smokeH').measures.find((m) => m.name === 'Push ups');
    check('added item is for this day only', pu && pu.every === false && habitEntry(habitById('smokeH'), todayStr()).vals[pu.id] === 20);
    check('not shown on other days', !habitMeasuresFor(habitById('smokeH'), hAdd(todayStr(), -1)).some((m) => m.id === pu.id));
    // cancel changes nothing; removing it from the day works
    document.querySelector(`[data-habit="smokeH"] [data-hday="${todayStr()}"]`).click(); await w(80);
    check('day sheet shows the day item', document.querySelectorAll('.modal.hd [data-rval]').length === 2);
    document.querySelector('[data-rdel="1"]').click(); await w(20); document.querySelector('[data-hdx]').click(); await w(30);
    check('cancel keeps it', habitEntry(habitById('smokeH'), todayStr()).vals[pu.id] === 20);
    document.querySelector(`[data-habit="smokeH"] [data-hday="${todayStr()}"]`).click(); await w(80);
    document.querySelector('[data-rdel="1"]').click(); await w(20);
    check('removed row can be undone', !!document.querySelector('[data-rundo="1"]'));
    document.querySelector('[data-hdsave]').click(); await w(80);
    check('removed from the day and tidied away', !habitById('smokeH').measures.some((m) => m.id === pu.id));
    check('logging marks it done', hLog(habitById('smokeH'), todayStr()) === 'done');
    check('you were here (tomorrow)', habitLastStop(habitById('smokeH'), hAdd(todayStr(), 1))?.stop === 'page 40');
  });
  await step('settings button opens General', async () => {
    ui.setSec = undefined; $('settingsBtn').click(); await w(150);
    const gen = document.querySelector('[data-sec="general"]');
    check('General is showing', gen && !gen.hidden);
    closeModal(); await w(50);
  });
  await step('folder list shows sub-folders by their own name', async () => {
    data.areas.push({ id: 'aSub', name: 'Sub', color: 'blue', parentId: 'a1' }); save();
    check('no "Parent / Child" in the list', !areaOptions('').includes('Work / Sub') && areaOptions('').includes('Sub'));
    data.areas = data.areas.filter((a) => a.id !== 'aSub'); save();
  });
  await step('day log: write, see the day fill itself, search it', async () => {
    ui.view = 'daylog'; refresh(); await w(80);
    check('day log page', !!document.getElementById('dlText'));
    document.getElementById('dlText').value = 'أسامة طلب الـ Risk register';
    document.getElementById('dlAdd').click(); await w(60);
    check('note saved', (data.journal || []).some((e) => e.text.includes('Risk register')));
    check('note on the page', document.querySelector('#list .dl-it.note') !== null);
    check('review tab stays active', document.querySelector('.tab[data-view="report"]').classList.contains('active'));
    openPalette(); await w(60);
    const q = document.getElementById('pQ'); q.value = 'اسامه'; q.dispatchEvent(new Event('input')); await w(60);
    check('search finds the note with another spelling', [...document.querySelectorAll('#pList .p-item')].some((x) => x.textContent.includes('Risk register')));
    q.value = 'Smoke call'; q.dispatchEvent(new Event('input')); await w(60);
    check('search finds tasks', [...document.querySelectorAll('#pList .p-item')].some((x) => x.textContent.includes('Smoke call')));
    closeModal(); await w(200);
  });
  await step('habit charts: bars, line, pie', async () => {
    ui.view = 'habits'; ui.hbView = 'charts'; refresh(); await w(80);
    check('charts view', !!document.querySelector('#list .hc-page'));
    for (const ty of ['line', 'pie', 'bars']) { data.settings.hbChart.type = ty; refresh(); await w(40); check(`chart ${ty}`, !!document.querySelector('#list .hc-main')); }
    ui.hbView = 'list'; refresh(); await w(40);
    check('no charts on habit cards', !document.querySelector('#list .hb-card .hb-prog'));
  });
  await step('dialogs open and close', async () => {
    for (const s of ['general', 'notifications', 'widget', 'data', 'updates', 'guide', 'about']) { await openSettings(s); await w(40); check(`settings ${s}`, !!document.querySelector(`[data-sec="${s}"]`)); }
    closeModal();
    openReview(); await w(60); check('daily review', !!document.querySelector('.modal.review')); document.querySelector('#rvOk').click(); await w(200);
    openWeekReview(); await w(60); check('weekly review', !!document.querySelector('.modal.week')); document.querySelector('[data-wk-ok]').click(); await w(200);
    guideGo('habits'); await w(150); check('guide coach card', !!document.querySelector('.coach')); closeCoach();
  });
  await step('saving reaches the app', async () => {
    await w(400);
    const disk = await window.api.getData();
    check('new task saved', disk.tasks.some((x) => x.title === 'Smoke call'));
    check('habit saved', (disk.habits || []).some((h) => h.id === 'smokeH'));
  });
  return { ok: !failures.length, failures };
})()
