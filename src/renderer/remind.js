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
  const when = [x.due && fmtDate(x.due, state.lang), x.dueTime && fmtTime(`${x.due || '2000-01-01'}T${x.dueTime}`, state.lang)].filter(Boolean).join(' · ');
  const later = [[5, `5 ${t('minShort')}`], [10, `10 ${t('minShort')}`], [30, `30 ${t('minShort')}`], [60, `1 ${t('hourShort')}`]];
  $('root').innerHTML = `<div class="rm" id="rm">
    <div class="rm-mouse">${remindMouseSvg()}</div>
    <div class="rm-card">
      <button class="rm-x" data-act="dismiss" title="${t('closeBtn')}">✕</button>
      <div class="rm-top">${icon('bell')} ${t('reminder')}${state.items.length > 1 ? `<span class="more">+${state.items.length - 1} ${t('more')}</span>` : ''}</div>
      <div class="rm-title" dir="auto">${esc(x.title)}</div>
      ${when ? `<div class="rm-meta">${t('due')}: ${when}${x.subs ? ` · ${x.subs}` : ''}</div>` : ''}
      ${x.pinnedNote ? `<div class="rm-pin" dir="auto">📌 ${esc(x.pinnedNote)}</div>` : ''}
      <div class="rm-acts">
        ${x.test ? '' : `<button class="primary" data-act="done">✓ ${t('done')}</button>`}
        ${x.test ? `<button class="primary" data-act="dismiss">${t('gotIt')}</button>` : `<button data-act="open">${t('open')}</button>`}
      </div>
      ${x.test ? '' : `<div class="rm-snooze">${t('snoozeLbl')} ${later.map(([m, l]) => `<button data-act="snooze" data-min="${m}">${l}</button>`).join('')}</div>`}
    </div></div>`;
  if (!fresh) $('rm').style.animation = 'none';
  else setTimeout(() => playSound(state.sound), 850);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const x = state.items[0]; if (!x) return;
  const act = b.dataset.act;
  $('rm').classList.add('leaving');
  setTimeout(() => window.api.remindAction({ id: x.id, action: act, minutes: Number(b.dataset.min) || 0 }), 380);
});

window.api.onRemindList((s) => { state = s; render(); });
