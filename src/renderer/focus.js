// ---------------- focus mode (app window) ----------------
// Pick one task and work on it for a set time (25 min by default). The main process owns the
// timer (data.focus) so the app, the widget and the end-of-session pop-up all agree.
// Here: a bar under the tabs while a session is on, and a full focus screen over the task area.

ui.focusView = false;

const fmtClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
function focusNow() {
  const f = data.focus;
  if (!f) return null;
  const x = taskById(f.taskId);
  if (!x) return null;
  const total = (f.mins || 25) * 60000;
  const worked = (f.workedMs || 0) + (f.runFrom ? Date.now() - f.runFrom : 0);
  return { f, x, total, left: total - worked, running: !!f.runFrom, next: (x.subtasks || []).find((s) => !s.done) };
}
const focusDo = (what, id) => window.api.focus(what, id).then((d) => { data = d; refreshLists(); renderFocus(true); });
function startFocus(id) {
  const x = taskById(id); if (!x || x.closure) return;
  ui.focusView = true;
  // Already working on it: just show the focus screen.
  if (data.focus && data.focus.taskId === id && data.focus.mode === 'work') return renderFocus(true);
  ui.focusView = false;
  askFocusMins(t, Number(data.settings.focusMins) || 25, (mins) => {
    data.settings.focusMins = mins; save();
    ui.focusView = true;
    window.api.focus('start', id, { mins }).then((d) => { data = d; refreshLists(); renderFocus(true); });
  });
}
const focusMinsOf = (x) => Math.round((x.focusMs || 0) / 60000);
function focusTimeLabel(mins) {
  if (lang() !== 'ar') return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60 ? (mins % 60) + 'm' : ''}`.trim() : `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  const hw = (n) => arCount(n, 'ساعة', 'ساعتين', 'ساعات', 'ساعة'), mw = (n) => arCount(n, 'دقيقة', 'دقيقتين', 'دقايق', 'دقيقة');
  return h ? hw(h) + (m ? ` و${mw(m)}` : '') : mw(m);
}

function focusButtons(s, big) {
  const { f } = s;
  const b = (what, label, cls = '', tip = '') => `<button class="${cls}" data-fdo="${what}" ${tip ? `title="${esc(tip)}"` : ''}>${label}</button>`;
  if (f.mode === 'work') return (s.running ? b('pause', '❚❚', 'pause-btn', t('fPause')) : b('resume', `▶ ${t('fResume')}`, 'primary')) + b('add5', '+5', '', t('fAdd5')) +
    (big ? b('done', `✓ ${t('fTaskDone')}`, 'ok') : '') + b('stop', `■ ${t('fStop')}`, 'ghost');
  if (f.mode === 'break') return b('more', `▶ ${t('fSkipBreak')}`, 'primary') + b('stop', `■ ${t('fStop')}`, 'ghost');
  if (f.mode === 'ended') return b('more', `▶ ${t('fMore')} ${data.settings.focusMins || 25}`, 'primary') + b('break', `☕ ${t('fBreak')} ${data.settings.breakMins || 5}`) +
    b('done', `✓ ${t('fTaskDone')}`, 'ok') + b('stop', `■ ${t('fEnough')}`, 'ghost');
  return b('more', `▶ ${t('fBack')}`, 'primary') + b('stop', `■ ${t('fEnough')}`, 'ghost'); // breakEnded
}
function focusHead(s) {
  const m = s.f.mode;
  if (m === 'work') return s.running ? t('fWorkingOn') : t('fPaused');
  if (m === 'break') return `☕ ${t('fOnBreak')}`;
  if (m === 'ended') return `🎉 ${t('fEnded').replace('{n}', s.f.mins)}`;
  return `☕ ${t('fBreakOver')}`;
}
// The big screen's controls: one large main button (pause / resume / another round) between two small ones.
function focusControls(s) {
  const { f } = s;
  const c = (what, label, cls, tip) => `<button class="fc ${cls}" dir="ltr" data-fdo="${what}" title="${esc(tip)}" aria-label="${esc(tip)}">${label}</button>`;
  const P = '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.4"/><rect x="13.5" y="5" width="4" height="14" rx="1.4"/></svg>';
  const R = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>';
  const S = '<svg viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>';
  if (f.mode === 'work') return c('add5', '+5', 'small', t('fAdd5')) + (s.running ? c('pause', P, 'main', t('fPause')) : c('resume', R, 'main', t('fResume'))) + c('stop', S, 'small', t('fStop'));
  if (f.mode === 'break') return c('more', R, 'main', t('fSkipBreak')) + c('stop', S, 'small', t('fStop'));
  if (f.mode === 'ended') return c('break', '☕', 'small', `${t('fBreak')} ${data.settings.breakMins || 5} ${t('minShort')}`) + c('more', R, 'main', `${t('fMore')} ${data.settings.focusMins || 25} ${t('minShort')}`) + c('stop', S, 'small', t('fEnough'));
  return c('more', R, 'main', t('fBack')) + c('stop', S, 'small', t('fEnough'));
}
const nextStepHtml = (s, big) => s.next
  ? `<label class="f-next ${big ? 'big' : ''}"><input type="checkbox" data-fnext="${s.next.id}"><span><small>${t('nextStep')}</small><span dir="auto">${esc(s.next.title)}</span></span></label>`
  : big ? `<div class="f-next none small muted">${t('fNoSteps')}</div>` : '';

let focusSig = '';
function renderFocus(force) {
  const s = focusNow();
  let bar = $('focusBar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'focusBar'; bar.className = 'focus-bar';
    document.querySelector('.main').insertBefore(bar, document.querySelector('.work'));
    const view = document.createElement('div'); view.id = 'focusView'; view.className = 'focus-view';
    document.querySelector('.work').appendChild(view);
  }
  const view = $('focusView');
  if (!s) { bar.classList.remove('on'); view.classList.remove('on'); bar.innerHTML = ''; view.innerHTML = ''; focusSig = ''; ui.focusView = false; return; }
  const sig = JSON.stringify([s.f, s.x.title, s.next && s.next.id, (s.x.subtasks || []).map((y) => y.done + y.title), ui.focusView, lang()]);
  const pct = Math.min(1, Math.max(0, 1 - s.left / s.total));
  const timing = s.f.mode === 'work' || s.f.mode === 'break';
  if (force || sig !== focusSig) {
    focusSig = sig;
    // While the big screen is open the bar steps aside, so the time isn't shown twice.
    bar.className = `focus-bar on mode-${s.f.mode} ${s.running ? 'running' : ''} ${ui.focusView ? 'under-view' : ''}`;
    bar.innerHTML = `<span class="fb-mouse">${mouseLogo('fb-logo', s.f.mode === 'ended' ? 'happy' : s.running ? 'timer' : '')}</span>
      <div class="fb-main"><small>${focusHead(s)}</small><b dir="auto" data-fopen>${esc(s.x.title)}</b></div>
      ${s.f.mode === 'work' ? nextStepHtml(s) : ''}
      ${timing ? `<div class="fb-time"><b id="fbClock">${fmtClock(s.left)}</b><i><em id="fbProg" style="width:${pct * 100}%"></em></i></div>` : ''}
      <div class="fb-acts">${focusButtons(s)}<button class="icon fb-expand" data-fview title="${t('fExpand')}">⤢</button></div>`;
    const R = 100, C = 2 * Math.PI * R;
    const subs = (s.x.subtasks || []);
    const later = subs.filter((y) => !y.done && (!s.next || y.id !== s.next.id));
    view.classList.toggle('on', ui.focusView);
    view.className = `focus-view mode-${s.f.mode} ${ui.focusView ? 'on' : ''}`;
    view.innerHTML = !ui.focusView ? '' : `<div class="fv-card">
      <button class="fv-min" data-fview title="${t('fMinimize')}">⤡ ${t('fMinimize')}</button>
      <div class="fv-head">${focusHead(s)}</div>
      <h2 dir="auto" data-fopen>${esc(s.x.title)}</h2>
      <div class="fv-ring ${s.f.mode} ${s.running ? 'running' : ''}">
        <svg viewBox="0 0 240 240"><defs><linearGradient id="fvGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="g1"/><stop offset="1" class="g2"/></linearGradient></defs>
          <circle cx="120" cy="120" r="${R}" class="bg"/><circle id="fvArc" cx="120" cy="120" r="${R}" class="fg" stroke="url(#fvGrad)" stroke-dasharray="${C}" stroke-dashoffset="${C * pct}"/></svg>
        <div class="fv-clock"><span class="fv-mouse">${mouseLogo('fv-logo', s.f.mode === 'ended' ? 'happy' : s.running ? 'timer' : '')}</span>
          <b id="fvClock">${timing ? fmtClock(s.left) : '✓'}</b><small>${timing ? `${t('fOf')} ${s.f.mins} ${t('minShort')}` : t('fNice')}</small></div>
      </div>
      <div class="fv-ctrls">${focusControls(s)}</div>
      ${s.f.mode !== 'break' && s.f.mode !== 'breakEnded' ? `<div class="fv-work">
        ${nextStepHtml(s, true)}
        ${later.length ? `<div class="fv-steps">${later.slice(0, 4).map((y) => `<div dir="auto"><i></i>${esc(y.title)}</div>`).join('')}${later.length > 4 ? `<div class="muted">+${later.length - 4}</div>` : ''}</div>` : ''}
        <input type="text" class="fv-add" id="fvAdd" dir="auto" placeholder="＋ ${t('fAddStep')}">
      </div>` : ''}
      <div class="fv-foot"><button class="fv-done" data-fdo="done">✓ ${t('fTaskDone')}</button>
        ${focusMinsOf(s.x) ? `<span>⏱ ${t('fSoFar')} ${focusTimeLabel(focusMinsOf(s.x))}</span>` : ''}</div>
    </div>`;
    return;
  }
  // Same session: just move the clock.
  if ($('fbClock')) $('fbClock').textContent = fmtClock(s.left);
  if ($('fbProg')) $('fbProg').style.width = pct * 100 + '%';
  if ($('fvClock') && timing) $('fvClock').textContent = fmtClock(s.left);
  if ($('fvArc')) $('fvArc').style.strokeDashoffset = 2 * Math.PI * 100 * pct;
}
setInterval(() => { if (data) renderFocus(); }, 1000);

document.addEventListener('click', (e) => {
  const st = e.target.closest('[data-focus]');
  if (st) { e.stopPropagation(); e.preventDefault(); return startFocus(st.dataset.focus); }
  if (!e.target.closest('#focusBar, #focusView')) return;
  const s = focusNow(); if (!s) return;
  const d = e.target.closest('[data-fdo]');
  if (d) {
    if (d.dataset.fdo === 'done') ui.focusView = false;
    return focusDo(d.dataset.fdo, s.x.id);
  }
  if (e.target.closest('[data-fview]')) { ui.focusView = !ui.focusView; return renderFocus(true); }
  if (e.target.closest('[data-fopen]')) { ui.focusView = false; ui.selected = s.x.id; refresh(); renderFocus(true); }
}, true);
document.addEventListener('change', (e) => {
  const c = e.target.closest && e.target.closest('[data-fnext]');
  if (!c) return;
  const s = focusNow(); if (!s) return;
  const sub = (s.x.subtasks || []).find((y) => y.id === c.dataset.fnext);
  if (!sub) return;
  sub.done = true; touch(s.x);
  c.closest('.f-next').classList.add('ticked');
  setTimeout(() => { refreshLists(); if (ui.selected === s.x.id) renderDetail(); renderFocus(true); }, 450);
});
document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'fvAdd' || e.key !== 'Enter') return;
  const s = focusNow(); const v = e.target.value.trim();
  if (!s || !v) return;
  (s.x.subtasks = s.x.subtasks || []).push({ id: uid(), title: v, done: false });
  touch(s.x); refreshLists(); if (ui.selected === s.x.id) renderDetail(); renderFocus(true);
  setTimeout(() => $('fvAdd')?.focus(), 0);
});
