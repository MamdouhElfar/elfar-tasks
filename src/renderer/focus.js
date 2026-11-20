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
  focusDo('start', id);
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
  const b = (what, label, cls = '') => `<button class="${cls}" data-fdo="${what}">${label}</button>`;
  if (f.mode === 'work') return (s.running ? b('pause', `❚❚ ${t('fPause')}`) : b('resume', `▶ ${t('fResume')}`, 'primary')) + b('add5', '+5') +
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
    bar.className = `focus-bar on mode-${s.f.mode} ${s.running ? 'running' : ''}`;
    bar.innerHTML = `<span class="fb-mouse">${mouseLogo('fb-logo', s.f.mode === 'ended' ? 'happy' : '')}</span>
      <div class="fb-main"><small>${focusHead(s)}</small><b dir="auto" data-fopen>${esc(s.x.title)}</b></div>
      ${s.f.mode === 'work' ? nextStepHtml(s) : ''}
      ${timing ? `<div class="fb-time"><b id="fbClock">${fmtClock(s.left)}</b><i><em id="fbProg" style="width:${pct * 100}%"></em></i></div>` : ''}
      <div class="fb-acts">${focusButtons(s)}<button class="icon fb-expand" data-fview title="${t('fExpand')}">⤢</button></div>`;
    const R = 92, C = 2 * Math.PI * R;
    const subs = (s.x.subtasks || []);
    view.classList.toggle('on', ui.focusView);
    view.innerHTML = !ui.focusView ? '' : `<div class="fv-card">
      <button class="icon fv-min" data-fview title="${t('fMinimize')}">⤡ ${t('fMinimize')}</button>
      <div class="fv-head">${focusHead(s)}</div>
      <h2 dir="auto">${esc(s.x.title)}</h2>
      <div class="fv-ring ${s.f.mode}">
        <svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="${R}" class="bg"/><circle id="fvArc" cx="110" cy="110" r="${R}" class="fg" stroke-dasharray="${C}" stroke-dashoffset="${C * pct}"/></svg>
        <div class="fv-clock"><b id="fvClock">${timing ? fmtClock(s.left) : '✓'}</b><small>${timing ? `${t('fOf')} ${s.f.mins} ${t('minShort')}` : ''}</small></div>
      </div>
      ${s.f.mode === 'work' || s.f.mode === 'ended' ? nextStepHtml(s, true) : ''}
      ${subs.length > 1 ? `<div class="fv-steps">${subs.filter((y) => !y.done && (!s.next || y.id !== s.next.id)).slice(0, 4).map((y) => `<div dir="auto">○ ${esc(y.title)}</div>`).join('')}</div>` : ''}
      <input type="text" class="fv-add" id="fvAdd" dir="auto" placeholder="＋ ${t('fAddStep')}">
      <div class="fv-acts">${focusButtons(s, true)}</div>
      ${focusMinsOf(s.x) ? `<p class="small muted">${t('fSoFar')} ${focusTimeLabel(focusMinsOf(s.x))}</p>` : ''}
    </div>`;
    return;
  }
  // Same session: just move the clock.
  if ($('fbClock')) $('fbClock').textContent = fmtClock(s.left);
  if ($('fbProg')) $('fbProg').style.width = pct * 100 + '%';
  if ($('fvClock') && timing) $('fvClock').textContent = fmtClock(s.left);
  if ($('fvArc')) $('fvArc').style.strokeDashoffset = 2 * Math.PI * 92 * pct;
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
