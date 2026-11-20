// ---------------- "Not today": move a task to another day ----------------
// The task's start becomes that day, so it leaves Today and the open list and comes back on
// its day (it waits under Pending › Scheduled, in Coming up and on the calendar).
// If it was due before that day, the due date moves too, which counts as putting it off.

function deferOptions() {
  const td = todayStr();
  // "Next week" is the start of next week, unless that's tomorrow or the day after: then a week from today.
  const nextWeek = hAdd(hWeekStart({}, td), 7);
  return [
    ['tomorrowLbl', hAdd(td, 1)],
    ['dfAfterTomorrow', hAdd(td, 2)],
    nextWeek > hAdd(td, 2) ? ['dfNextWeek', nextWeek] : ['dfInWeek', hAdd(td, 7)]
  ];
}
function deferTask(x, day) {
  if (!x || x.closure || !day) return;
  const snap = snapshot(), planSnap = JSON.stringify(data.plan || null);
  const before = x.due;
  if (deferTo(x, day)) { notePostpone(x, before); syncReminder(x); }
  // It's no longer part of today's plan.
  if (data.plan && data.plan.date === todayStr()) data.plan.ids = data.plan.ids.filter((id) => id !== x.id);
  touch(x);
  if (ui.selected === x.id && ui.view !== 'pending') ui.selected = null;
  refresh();
  showToast(`${t('dfDone')} ${day === hAdd(todayStr(), 1) ? t('tomorrowLbl') : fmtDate(day, lang())}`, () => {
    data.tasks = JSON.parse(snap); data.plan = JSON.parse(planSnap); save(); refresh();
  }, t('undo'));
}

// A small menu under the button: tomorrow, the day after, next week, or pick a day.
function openDeferMenu(btn, id) {
  document.querySelector('.df-pop')?.remove();
  const pop = document.createElement('div');
  pop.className = 'df-pop';
  pop.innerHTML = deferOptions().map(([k, d]) => `<button data-df-day="${d}"><span>${t(k)}</span><small>${fmtDate(d, lang())}</small></button>`).join('') +
    `<label class="df-pick"><span>${t('dfPick')}</span><input type="date" id="dfDate" min="${hAdd(todayStr(), 1)}"></label>`;
  document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.top = Math.min(innerHeight - h - 8, r.bottom + 6) + 'px';
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, (document.documentElement.dir === 'rtl' ? r.right - w : r.left))) + 'px';
  const close = () => { pop.remove(); document.removeEventListener('mousedown', outside, true); };
  const outside = (e) => { if (!pop.contains(e.target) && !e.target.closest('.dp-pop') && e.target !== btn) close(); };
  setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-df-day]');
    if (b) { close(); deferTask(taskById(id), b.dataset.dfDay); }
  });
  pop.querySelector('#dfDate').addEventListener('change', (e) => { if (e.target.value) { close(); deferTask(taskById(id), e.target.value); } });
}

document.addEventListener('click', (e) => {
  const q = (s) => e.target.closest && e.target.closest(s);
  let b;
  if ((b = q('[data-defer-tomorrow]'))) { e.stopPropagation(); return deferTask(taskById(b.dataset.deferTomorrow), hAdd(todayStr(), 1)); }
  if ((b = q('[data-defer]'))) { e.stopPropagation(); return openDeferMenu(b, b.dataset.defer); }
}, true);
