// ---------------- a habit's day: what happened, how much, and where you stopped ----------------
// Clicking a day (or "Did it" on a habit that logs amounts) opens a small sheet:
//  • status: done / day off / not done        • minutes (habits with a length)
//  • what you log: the habit's every-day items, plus items for this day only (push ups on a home
//    day, the surah you read…). Each can be renamed, pinned to every day, or removed.
//  • "where did you stop?" (shown the next time as "You were here")      • a note
// Nothing changes until Save; Cancel leaves the habit as it was.
// Data: h.measures = [{ id, name, unit, every }] (every === false → this day only),
//       h.askStop, h.entries[day] = { note, stop, vals }.

const UNITS = [['pages', 'صفحة', 'pages'], ['min', 'دقيقة', 'min'], ['reps', 'عدّة', 'reps'], ['sets', 'جولة', 'sets'], ['times', 'مرة', 'times'], ['km', 'كم', 'km']];
const unitLabel = (u) => { const f = UNITS.find((x) => x[0] === u); return f ? f[lang() === 'ar' ? 1 : 2] : (u || ''); };
const fmtVal = (m, v) => `${Math.round(v * 10) / 10} ${m.unit === 'min' ? '' : unitLabel(m.unit)}`.trim() + (m.unit === 'min' ? ` ${unitLabel('min')}` : '');
const unitOptions = (sel) => UNITS.map(([u]) => `<option value="${u}" ${u === sel ? 'selected' : ''}>${unitLabel(u)}</option>`).join('');

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
  const saved = habitEntry(h, d) || { vals: {} };
  // Everything below is a working copy; the habit changes only on Save.
  const st = {
    status: opts.markDone ? 'done' : (hLog(h, d) || 'none'),
    note: saved.note || '', stop: saved.stop || '', askStop: !!h.askStop,
    mins: hMins(h, d) || '', newName: '', newUnit: 'reps',
    rows: habitMeasuresFor(h, d).map((m) => ({ id: m.id, name: m.name, unit: m.unit, every: m.every !== false, val: (saved.vals || {})[m.id] || '', removed: false, isNew: false })),
  };
  const used = () => habitUsedBefore(h, d).filter((m) => !st.rows.some((r) => r.id === m.id)).slice(0, 8);
  const loc = lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  const prev = habitLastStop(h, d);
  const bg = document.createElement('div');
  bg.className = 'modal-bg hd-bg';

  const rowHtml = (r, i) => r.removed
    ? `<div class="hd-m gone"><span class="hd-mname" dir="auto">${esc(r.name)}</span><small class="muted">${t(r.every ? 'hdRemovedEvery' : 'hdRemoved')}</small><button type="button" class="link" data-rundo="${i}">${t('undo')}</button></div>`
    : `<div class="hd-m" data-row="${i}">
        <input type="text" class="hd-mname" dir="auto" data-rname="${i}" value="${esc(r.name)}" title="${t('hdRenameTip')}">
        <input type="number" class="hd-val" min="0" step="any" data-rval="${i}" value="${r.val}" placeholder="—">
        <select class="hd-unit" data-runit="${i}">${unitOptions(r.unit)}</select>
        <button type="button" class="hd-pin ${r.every ? 'on' : ''}" data-rpin="${i}" title="${t('hdPinTip')}">${r.every ? `${icon('pin')} ${t('hdEvery')}` : t('hdOnlyDay')}</button>
        <button type="button" class="icon hd-del" data-rdel="${i}" title="${t(r.every ? 'hdDelEveryTip' : 'hdDelTip')}">✕</button></div>`;

  const draw = () => {
    const seg = (v, label) => `<button type="button" class="${st.status === v ? 'on' : ''} st-${v}" data-hdst="${v}">${label}</button>`;
    const showMins = h.kind === 'minutes' || h.duration;
    const u = used();
    bg.innerHTML = `<div class="modal hd" role="dialog">
      <div class="hd-head"><span class="hb-emoji big" style="--hc:var(--c-${h.color || 'blue'})">${esc(h.emoji || '🔁')}</span>
        <div><h3 dir="auto">${esc(h.name)}</h3><small class="muted">${new Date(d + 'T00:00').toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}</small></div></div>
      ${prev && (st.askStop || prev.stop) ? `<div class="hd-prev">↩ ${t(prev.stop ? 'hdWereHere' : 'hdLastNote')} <b dir="auto">${esc(prev.stop || prev.note)}</b> <small>· ${fmtDate(prev.date, lang())}</small></div>` : ''}
      <div class="seg hd-status">${seg('done', '✓ ' + t('hdDone'))}${seg('skip', '🌴 ' + t('hbSkip'))}${seg('none', d >= td ? t('hdNotYet') : '✗ ' + t('hdMissed'))}</div>
      <p class="hd-help small muted">${t('hdHelp_' + st.status)}</p>
      ${showMins ? `<div class="hd-mins"><span>${t('hdMinutes')}</span><input type="number" class="hd-val" min="0" id="hdMins" value="${st.mins}" placeholder="—"><small>${unitLabel('min')}${h.duration ? ` · ${t('hdGoal')} ${h.duration}` : ''}</small></div>` : ''}
      <div class="hd-sec"><div class="hd-sec-h">${t('hdLogged')}</div>
        ${st.rows.length ? `<div class="hd-ms">${st.rows.map(rowHtml).join('')}</div>` : `<p class="small muted hd-empty">${t('hdNothingYet')}</p>`}
        <div class="hd-addm"><input type="text" id="hdNewName" dir="auto" value="${esc(st.newName)}" placeholder="${t('hdAddMeasure')}"><select id="hdNewUnit">${unitOptions(st.newUnit)}</select><button type="button" id="hdAddM">＋ ${t('hdAdd')}</button></div>
        ${u.length ? `<div class="hd-used"><small>${t('hdUsedBefore')}</small>${u.map((m) => `<button type="button" data-hduse="${m.id}" dir="auto">＋ ${esc(m.name)}</button>`).join('')}</div>` : ''}
        ${st.rows.some((r) => !r.removed) ? `<p class="small muted hd-legend">${t('hdLegend')}</p>` : ''}
      </div>
      ${st.askStop ? `<label class="hd-f"><span>${t('hdStop')}</span><input type="text" id="hdStop" dir="auto" value="${esc(st.stop)}" placeholder="${t('hdStopPh')}"></label>` : ''}
      <label class="hd-f"><span>${t('hdNote')}</span><textarea id="hdNote" dir="auto" rows="2" placeholder="${t('hdNotePh')}">${esc(st.note)}</textarea></label>
      ${!st.askStop ? `<button type="button" class="link hd-askstop" id="hdAskStop">＋ ${t('hdAskStopOn')}</button>` : ''}
      <div class="actions"><span style="flex:1"></span><button data-hdx>${t('cancel')}</button><button class="primary" data-hdsave>${t('save')}</button></div></div>`;
  };
  // Keep what's typed before any redraw.
  const sync = () => {
    const q = (s) => bg.querySelector(s);
    st.rows.forEach((r, i) => {
      const n = q(`[data-rname="${i}"]`), v = q(`[data-rval="${i}"]`), un = q(`[data-runit="${i}"]`);
      if (n) r.name = n.value; if (v) r.val = v.value; if (un) r.unit = un.value;
    });
    if (q('#hdNote')) st.note = q('#hdNote').value;
    if (q('#hdStop')) st.stop = q('#hdStop').value;
    if (q('#hdMins')) st.mins = q('#hdMins').value;
    if (q('#hdNewName')) { st.newName = q('#hdNewName').value; st.newUnit = q('#hdNewUnit').value; }
  };
  const redraw = (focus) => { draw(); if (focus) setTimeout(() => bg.querySelector(focus)?.focus(), 0); };
  // Add an item for this day. A name you used before brings that item back (so its totals add up).
  const addItem = (m) => {
    if (!m) {
      const name = st.newName.trim();
      if (!name) return bg.querySelector('#hdNewName')?.focus();
      const same = (x) => x.name.trim().toLowerCase() === name.toLowerCase();
      const inRows = st.rows.findIndex((r) => same(r));
      st.newName = '';
      if (inRows >= 0) { st.rows[inRows].removed = false; return redraw(`[data-rval="${inRows}"]`); }
      m = (h.measures || []).find(same);
      if (!m) { st.rows.push({ id: uid(), name, unit: st.newUnit, every: false, val: '', removed: false, isNew: true }); return redraw(`[data-rval="${st.rows.length - 1}"]`); }
    }
    st.rows.push({ id: m.id, name: m.name, unit: m.unit, every: m.every !== false, val: '', removed: false, isNew: false });
    redraw(`[data-rval="${st.rows.length - 1}"]`);
  };
  const doSave = () => {
    sync();
    h.measures = h.measures || [];
    const vals = {};
    for (const r of st.rows) {
      const name = r.name.trim();
      let m = h.measures.find((x) => x.id === r.id);
      if (r.removed || !name) {
        if (m && r.every) m.every = false; // stop showing it every day; earlier days keep their numbers
        continue;
      }
      if (!m) { m = { id: r.id }; h.measures.push(m); }
      m.name = name; m.unit = r.unit;
      if (r.every) delete m.every; else m.every = false;
      vals[r.id] = Number(r.val) || 0;
    }
    habitSetEntry(h, d, { vals, note: st.note, stop: st.stop });
    habitTidyMeasures(h);
    h.askStop = st.askStop;
    const mins = Number(st.mins) || 0;
    if (h.kind === 'minutes' || h.duration) { h.minutes = h.minutes || {}; if (mins) h.minutes[d] = mins; else delete h.minutes[d]; }
    // Logged something but left "not done"? Then it was done.
    const logged = Object.values(vals).some((x) => x > 0) || st.stop.trim() || (mins && h.duration && mins >= h.duration);
    if (st.status === 'none' && logged && d <= td) st.status = 'done';
    h.log = h.log || {};
    if (st.status === 'none') delete h.log[d]; else h.log[d] = st.status;
    save(); close(); refresh();
    if (st.status === 'done' && d === td) showToast(`${h.emoji || '✓'} ${h.name}: ${t('hbDoneToast')}`);
  };

  draw();
  document.body.appendChild(bg);
  setTimeout(() => (bg.querySelector('[data-rval]') || bg.querySelector('#hdMins') || bg.querySelector('#hdStop') || bg.querySelector('#hdNote'))?.focus(), 40);
  const close = () => { document.removeEventListener('keydown', onKey, true); bg.remove(); };
  const onKey = (ev) => {
    if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); return close(); }
    if (ev.key !== 'Enter' || ev.isComposing) return;
    if (ev.target.id === 'hdNewName') { ev.preventDefault(); sync(); return addItem(); }
    if (ev.ctrlKey || (ev.target.tagName === 'INPUT' && ev.target.type !== 'checkbox')) { ev.preventDefault(); doSave(); }
  };
  document.addEventListener('keydown', onKey, true);
  bg.addEventListener('mousedown', (ev) => { if (ev.target === bg) close(); });
  bg.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    const ds = b.dataset;
    if (ds.hdst) { sync(); st.status = ds.hdst; return redraw(); }
    if (ds.rpin !== undefined) { sync(); const r = st.rows[Number(ds.rpin)]; r.every = !r.every; return redraw(); }
    if (ds.rdel !== undefined) { sync(); const i = Number(ds.rdel); if (st.rows[i].isNew) st.rows.splice(i, 1); else st.rows[i].removed = true; return redraw(); }
    if (ds.rundo !== undefined) { sync(); st.rows[Number(ds.rundo)].removed = false; return redraw(); }
    if (ds.hduse) { sync(); return addItem(h.measures.find((m) => m.id === ds.hduse)); }
    if (b.id === 'hdAddM') { sync(); return addItem(); }
    if (b.id === 'hdAskStop') { sync(); st.askStop = true; return redraw('#hdStop'); }
    if (b.hasAttribute('data-hdx')) return close();
    if (b.hasAttribute('data-hdsave')) return doSave();
  });
}
