// ---------------- a habit's day: what happened, how much, and where you stopped ----------------
// Clicking a day (or "Did it" on a habit that logs amounts) opens a small sheet:
//  • status: done / day off / not done        • minutes (habits with a length)
//  • the habit's own measures (pages, push ups, minutes at the gym…), add more right there
//  • "where did you stop?" (shown the next time as "You were here")      • a note
// Data: h.measures = [{ id, name, unit }], h.askStop, h.entries[day] = { note, stop, vals }.

const UNITS = [['pages', 'صفحة', 'pages'], ['min', 'دقيقة', 'min'], ['reps', 'عدّة', 'reps'], ['sets', 'جولة', 'sets'], ['times', 'مرة', 'times'], ['km', 'كم', 'km']];
const unitLabel = (u) => { const f = UNITS.find((x) => x[0] === u); return f ? f[lang() === 'ar' ? 1 : 2] : (u || ''); };
const fmtVal = (m, v) => `${Math.round(v * 10) / 10} ${m.unit === 'min' ? '' : unitLabel(m.unit)}`.trim() + (m.unit === 'min' ? ` ${unitLabel('min')}` : '');

// "↩ You were here: chapter 3, page 45" — from the last day you wrote it.
function lastStopHtml(h, before = todayStr(), cls = '') {
  if (!h.askStop && !(h.entries && Object.keys(h.entries).length)) return '';
  const s = habitLastStop(h, before);
  if (!s) return '';
  return `<div class="hb-stop ${cls}" title="${fmtDate(s.date, lang())}">↩ <b>${t(s.stop ? 'hdWereHere' : 'hdLastNote')}</b> <span dir="auto">${esc(s.stop || s.note)}</span></div>`;
}
// "This week: 85 pages · 120 push ups"
function weekTotalsHtml(h) {
  if (!(h.measures || []).length) return '';
  const w = hWeek(h, todayStr());
  const tot = habitTotals(h, w.days[0], w.days[6]);
  const bits = h.measures.filter((m) => tot[m.id]).map((m) => `<b>${Math.round(tot[m.id] * 10) / 10}</b> ${esc(m.unit === 'min' ? `${unitLabel('min')} ${m.name}` : m.name)}`);
  return bits.length ? `<div class="hb-totals">${icon('report')} ${t('hbThisWeek')}: ${bits.join(' · ')}</div>` : '';
}

function openHabitDay(h, d, opts = {}) {
  document.querySelector('.hd-bg')?.remove();
  const td = todayStr();
  const e = habitEntry(h, d) || { vals: {} };
  let status = opts.markDone ? 'done' : (hLog(h, d) || 'none');
  const loc = lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  const bg = document.createElement('div');
  bg.className = 'modal-bg hd-bg';
  const prev = habitLastStop(h, d);
  const measureRow = (m) => `<label class="hd-m"><span dir="auto">${esc(m.name)}</span><input type="number" min="0" step="any" data-hdval="${m.id}" value="${e.vals && e.vals[m.id] ? e.vals[m.id] : ''}" placeholder="0"><small>${esc(unitLabel(m.unit))}</small></label>`;
  const draw = () => {
    const seg = (v, label) => `<button type="button" class="${status === v ? 'on' : ''} st-${v}" data-hdst="${v}">${label}</button>`;
    bg.innerHTML = `<div class="modal hd" role="dialog">
      <div class="hd-head"><span class="hb-emoji big" style="--hc:var(--c-${h.color || 'blue'})">${esc(h.emoji || '🔁')}</span>
        <div><h3 dir="auto">${esc(h.name)}</h3><small class="muted">${new Date(d + 'T00:00').toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}</small></div></div>
      ${prev && (h.askStop || prev.stop) ? `<div class="hd-prev">↩ ${t(prev.stop ? 'hdWereHere' : 'hdLastNote')} <b dir="auto">${esc(prev.stop || prev.note)}</b> <small>· ${fmtDate(prev.date, lang())}</small></div>` : ''}
      <div class="seg hd-status">${seg('done', '✓ ' + t('hdDone'))}${seg('skip', '🌴 ' + t('hbSkip'))}${seg('none', d >= td ? t('hdNotYet') : '✗ ' + t('hdMissed'))}</div>
      <p class="hd-help small muted">${t('hdHelp_' + status)}</p>
      ${h.duration && h.kind !== 'minutes' || h.kind === 'minutes' ? `<label class="hd-m"><span>${t('hdMinutes')}</span><input type="number" min="0" id="hdMins" value="${hMins(h, d) || ''}" placeholder="0"><small>${unitLabel('min')}${h.duration ? ` / ${h.duration}` : ''}</small></label>` : ''}
      ${(h.measures || []).length ? `<div class="hd-ms">${h.measures.map(measureRow).join('')}</div>` : ''}
      <div class="hd-addm"><input type="text" id="hdNewName" dir="auto" placeholder="${t('hdAddMeasure')}"><select id="hdNewUnit">${UNITS.map(([u]) => `<option value="${u}">${unitLabel(u)}</option>`).join('')}</select><button type="button" id="hdAddM">＋</button></div>
      ${h.askStop ? `<label class="hd-f"><span>${t('hdStop')}</span><input type="text" id="hdStop" dir="auto" value="${esc(e.stop || '')}" placeholder="${t('hdStopPh')}"></label>` : ''}
      <label class="hd-f"><span>${t('hdNote')}</span><textarea id="hdNote" dir="auto" rows="2" placeholder="${t('hdNotePh')}">${esc(e.note || '')}</textarea></label>
      ${!h.askStop ? `<button type="button" class="link hd-askstop" id="hdAskStop">＋ ${t('hdAskStopOn')}</button>` : ''}
      <div class="actions"><span style="flex:1"></span><button data-hdx>${t('cancel')}</button><button class="primary" data-hdsave>${t('save')}</button></div></div>`;
  };
  const read = () => {
    const vals = {};
    bg.querySelectorAll('[data-hdval]').forEach((i) => { vals[i.dataset.hdval] = Number(i.value) || 0; });
    return { vals, note: bg.querySelector('#hdNote')?.value || '', stop: bg.querySelector('#hdStop')?.value || '', mins: bg.querySelector('#hdMins') ? Number(bg.querySelector('#hdMins').value) || 0 : null };
  };
  draw();
  document.body.appendChild(bg);
  setTimeout(() => (bg.querySelector('[data-hdval]') || bg.querySelector('#hdStop') || bg.querySelector('#hdNote'))?.focus(), 40);
  const close = () => { document.removeEventListener('keydown', onKey, true); bg.remove(); };
  const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); close(); } if (ev.key === 'Enter' && ev.ctrlKey) bg.querySelector('[data-hdsave]').click(); };
  document.addEventListener('keydown', onKey, true);
  bg.addEventListener('mousedown', (ev) => { if (ev.target === bg) close(); });
  bg.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.hdst) { const keep = read(); e.vals = keep.vals; e.note = keep.note; e.stop = keep.stop; status = b.dataset.hdst; draw(); return; }
    if (b.id === 'hdAddM' || b.id === 'hdAskStop') {
      const keep = read(); e.vals = keep.vals; e.note = keep.note; e.stop = keep.stop;
      if (b.id === 'hdAskStop') h.askStop = true;
      else {
        const name = bg.querySelector('#hdNewName').value.trim(); if (!name) return bg.querySelector('#hdNewName').focus();
        h.measures = [...(h.measures || []), { id: uid(), name, unit: bg.querySelector('#hdNewUnit').value }];
      }
      save(); draw(); return;
    }
    if (b.hasAttribute('data-hdx')) return close();
    if (b.hasAttribute('data-hdsave')) {
      const v = read();
      habitSetEntry(h, d, v);
      if (v.mins !== null) { h.minutes = h.minutes || {}; if (v.mins) h.minutes[d] = v.mins; else delete h.minutes[d]; }
      // Logged something but left "not done"? Then it was done.
      const logged = Object.values(v.vals).some((x) => x > 0) || v.stop.trim() || (v.mins && h.duration && v.mins >= h.duration);
      if (status === 'none' && logged && d <= td) status = 'done';
      h.log = h.log || {};
      if (status === 'none') delete h.log[d]; else h.log[d] = status;
      save(); close(); refresh();
      if (status === 'done' && d === td) showToast(`${h.emoji || '✓'} ${h.name}: ${t('hbDoneToast')}`);
    }
  });
}
