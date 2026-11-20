// The reminder pop-up: a mouse walks in from the side, rings a bell, and shows the task.
// Done closes the task, Open shows it in the app, the chips remind you again later.
let state = { items: [], lang: 'ar', sound: 'chime' };
let shownId = null;
const $ = (id) => document.getElementById(id);
const t = (k) => (I18N[state.lang] || I18N.ar)[k] || k;

function render() {
  applyLang(state.lang);
  const x = state.items[0];
  if (!x) { $('root').innerHTML = ''; return; }
  const fresh = x.id !== shownId;
  shownId = x.id;
  if (x.kind === 'ended' || x.kind === 'breakEnded') return renderFocusEnd(x, fresh);
  if (x.kind === 'review') return renderReviewAsk(x, fresh);
  if (x.kind === 'habit') return renderHabitAsk(x, fresh);
  const when = [x.due && fmtDate(x.due, state.lang), x.dueTime && fmtTime(`${x.due || '2000-01-01'}T${x.dueTime}`, state.lang)].filter(Boolean).join(' · ');
  const later = [[5, `5 ${t('minShort')}`], [10, `10 ${t('minShort')}`], [30, `30 ${t('minShort')}`], [60, `1 ${t('hourShort')}`]];
  $('root').innerHTML = `<div class="rm" id="rm">
    <div class="rm-mouse">${remindMouseSvg()}</div>
    <div class="rm-card">
      <button class="rm-x" data-act="dismiss" title="${t('stopReminder')}">✕</button>
      <div class="rm-top">${icon('bell')} ${t('reminder')}${state.items.length > 1 ? `<span class="more">+${state.items.length - 1} ${t('more')}</span>` : ''}</div>
      <div class="rm-title" dir="auto">${esc(x.title)}</div>
      ${when ? `<div class="rm-meta">${t('due')}: ${when}${x.subs ? ` · ${x.subs}` : ''}</div>` : ''}
      ${x.pinnedNote ? `<div class="rm-pin" dir="auto">📌 ${esc(x.pinnedNote)}</div>` : ''}
      <div class="rm-acts">
        ${x.test ? '' : `<button class="primary" data-ask="done">✓ ${t('closeTaskBtn')}</button>`}
        ${x.test ? `<button class="primary" data-act="dismiss">${t('gotIt')}</button>` : `<button data-act="open">${t('open')}</button>`}
      </div>
      ${x.test ? '' : `<div class="rm-snooze">${t('snoozeLbl')} ${later.map(([m, l]) => `<button data-act="snooze" data-min="${m}">${l}</button>`).join('')}</div>`}
    </div></div>`;
  if (!fresh) $('rm').style.animation = 'none';
  else setTimeout(() => playSound(state.sound), 850);
}

// End of a focus session: another round, a break, stop, or the task is done.
function renderFocusEnd(x, fresh) {
  const work = x.kind === 'ended';
  const b = (what, label, cls = '') => `<button class="${cls}" data-act="focus" data-what="${what}">${label}</button>`;
  $('root').innerHTML = `<div class="rm" id="rm">
    <div class="rm-mouse">${remindMouseSvg()}</div>
    <div class="rm-card">
      <button class="rm-x" data-act="dismiss" title="${t('hide') || '✕'}">✕</button>
      <div class="rm-top">${work ? '⏱ ' + t('fEnded').replace('{n}', x.mins) : '☕ ' + t('fBreakOver')}</div>
      <div class="rm-title" dir="auto">${esc(x.title)}</div>
      ${work && x.next ? `<div class="rm-meta">↳ ${t('nextStep')}: <span dir="auto">${esc(x.next)}</span>${x.subs ? ` · ${x.subs}` : ''}</div>` : ''}
      <div class="rm-acts">${work ? b('more', `▶ ${t('fMore')}`, 'primary') + b('break', `☕ ${t('fBreak')}`) : b('more', `▶ ${t('fBack')}`, 'primary') + b('stop', `■ ${t('fEnough')}`)}</div>
      ${work ? `<div class="rm-snooze">${b('done', `✓ ${x.habit ? t('hbFocusDone') : t('fTaskDone')}`)}${b('stop', `■ ${t('fEnough')}`)}</div>` : ''}
    </div></div>`;
  if (!fresh) $('rm').style.animation = 'none';
  else setTimeout(() => playSound(state.sound === 'none' ? 'none' : 'chime'), 850);
}

// A habit's time has come.
function renderHabitAsk(x, fresh) {
  $('root').innerHTML = `<div class="rm" id="rm">
    <div class="rm-mouse">${remindMouseSvg()}</div>
    <div class="rm-card">
      <button class="rm-x" data-act="dismiss" title="${t('rvLater')}">✕</button>
      <div class="rm-top">🔁 ${t('hbRemind')}</div>
      <div class="rm-title" dir="auto">${esc(x.title)}</div>
      <div class="rm-acts">${x.duration || x.mins ? `<button class="primary" data-act="hfocus">▶ ${t('hbRemindStart')}${x.duration ? ` ${x.duration} ${t('minShort')}` : ''}</button>` : ''}
        ${x.mins ? '' : `<button ${x.duration ? '' : 'class="primary"'} data-act="hdone">✓ ${t('hbDidIt')}</button>`}<button data-act="dismiss">${t('rvLater')}</button></div>
    </div></div>`;
  if (!fresh) $('rm').style.animation = 'none';
  else setTimeout(() => playSound(state.sound), 850);
}

// Evening: time to review the day.
function renderReviewAsk(x, fresh) {
  $('root').innerHTML = `<div class="rm" id="rm">
    <div class="rm-mouse">${mouseLogo('rm-happy', 'happy')}</div>
    <div class="rm-card">
      <button class="rm-x" data-act="dismiss" title="${t('rvLater')}">✕</button>
      <div class="rm-top">🌙 ${t(x.week ? 'rvWeekAsk' : 'rvAsk')}</div>
      <div class="rm-title">${x.done ? `${x.done} ${t('rvDone')} 🎉` : t('reviewTitle')}</div>
      <div class="rm-meta">${t(x.week ? 'rvWeekAskSub' : 'rvAskSub')}</div>
      <div class="rm-acts">${x.week ? `<button class="primary" data-act="weekreview">${t('rvWeekGo')}</button><button data-act="review">${t('rvTodayOnly')}</button>` : `<button class="primary" data-act="review">${t('rvGo')}</button>`}<button data-act="dismiss">${t('rvLater')}</button></div>
    </div></div>`;
  if (!fresh) $('rm').style.animation = 'none';
  else setTimeout(() => playSound(state.sound === 'none' ? 'none' : 'chime'), 850);
}

// "Close the task" asks first (it's easy to click it just to make the reminder go away),
// then the mouse says thanks before leaving.
function askClose() {
  const card = document.querySelector('.rm-card');
  card.classList.add('asking');
  card.innerHTML = `<div class="rm-top">${icon('help')} ${t('closeTaskQ')}</div>
    <div class="rm-title" dir="auto">${esc(state.items[0].title)}</div>
    <div class="rm-meta">${t('closeTaskQText')}</div>
    <div class="rm-acts"><button class="primary" data-act="done">✓ ${t('yesClose')}</button><button data-act="dismiss">🔕 ${t('stopReminder')}</button></div>
    <button class="rm-back" data-back>‹ ${t('noBack')}</button>`;
}
function thanks(then) {
  const card = document.querySelector('.rm-card');
  card.classList.add('thanks');
  card.innerHTML = `<div class="rm-thanks"><b>${t('closedThanks')}</b><span>${t('closedThanksSub')}</span></div>`;
  document.querySelector('.rm-mouse').innerHTML = mouseLogo('rm-happy', 'happy');
  playSound(state.sound === 'none' ? 'none' : 'chime');
  setTimeout(then, 1700);
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-ask]')) return askClose();
  if (e.target.closest('[data-back]')) return render(); // same reminder: no walk-in, no sound again
  const b = e.target.closest('[data-act]'); if (!b) return;
  const x = state.items[0]; if (!x) return;
  const act = b.dataset.act, what = b.dataset.what;
  const go = () => {
    $('rm').classList.add('leaving');
    setTimeout(() => window.api.remindAction({ id: x.id, action: act, what, minutes: Number(b.dataset.min) || 0 }), 380);
  };
  if (act === 'done' || what === 'done') thanks(go); else go();
});

window.api.onRemindList((s) => { state = s; render(); });
