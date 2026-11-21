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
    check('estimate field', !!document.querySelector('#detail .est-field'));
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
    // the day sheet: log amounts and where you stopped
    const h = habitById('smokeH'); h.measures = [{ id: 'm1', name: 'Pages', unit: 'pages' }]; h.askStop = true; save(); refresh(); await w(50);
    document.querySelector('[data-habit="smokeH"] [data-hday]').click(); await w(80);
    check('day sheet opens', !!document.querySelector('.modal.hd'));
    document.querySelector('[data-hdval="m1"]').value = '12';
    document.getElementById('hdStop').value = 'page 40';
    document.querySelector('[data-hdsave]').click(); await w(80);
    check('amount saved', habitEntry(habitById('smokeH'), todayStr())?.vals?.m1 === 12);
    check('logging marks it done', hLog(habitById('smokeH'), todayStr()) === 'done');
    check('you were here (tomorrow)', habitLastStop(habitById('smokeH'), hAdd(todayStr(), 1))?.stop === 'page 40');
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
