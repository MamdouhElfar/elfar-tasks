// ---------------- Habits (عاداتي) ----------------
// Things you keep doing, measured by how well you stick to them, not closed like tasks.
// Three kinds:
//   days    – on set weekdays (study: Sun, Tue, Thu at 8 PM for an hour). A scheduled day that
//             passes without "done" counts as missed; it never moves to another day.
//   times   – N times a week, any days (gym 3×). A week that ends below N is "below target".
//   minutes – N minutes a week (study 5 h), added up from focus sessions or by hand.
// h = { id, name, emoji, color, kind, days[], perWeek, minutesPerWeek, time, duration,
//       start, end: { type: 'never'|'date'|'count', date, count }, weekStart, archived,
//       log: { 'YYYY-MM-DD': 'done'|'skip' }, minutes: { 'YYYY-MM-DD': n } }

function habitsList() {
  data.habits = data.habits || [];
  if (!data.settings.hbWeekFollow) { data.habits.forEach((h) => { h.weekStart = null; }); data.settings.hbWeekFollow = true; save(); }
  return data.habits;
}
const habitById = (id) => habitsList().find((h) => h.id === id);
const hLoc = () => (lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');
const hDayName = (n, style = 'short') => new Date(2024, 0, 7 + n).toLocaleDateString(hLoc(), { weekday: style }); // 2024-01-07 is a Sunday

// What a day looks like on the tracker.
function hDayState(h, s) {
  const td = todayStr();
  if (!hActiveOn(h, s)) return 'off';
  const l = hLog(h, s);
  if (h.kind === 'days') {
    if (!hScheduled(h, s)) return l === 'done' ? 'done' : 'off';
    if (l) return l;
    if (hPartial(h, s)) return 'partial';
    return s < td ? 'missed' : s === td ? 'today' : 'future';
  }
  if (h.kind === 'times' && !l && hPartial(h, s)) return 'partial';
  if (h.kind === 'minutes') { const m = hMins(h, s); return m ? 'done' : s > td ? 'future' : 'none'; }
  return l || (s > td ? 'future' : 'none');
}

// Streak, how often you stuck to it, and the total.
function hStats(h) {
  const td = todayStr();
  if (h.kind === 'days') {
    let total = 0, done = 0, streak = 0, broke = false;
    for (let s = td, i = 0; s >= h.start && i < 2000; s = hAdd(s, -1), i++) {
      if (!hScheduled(h, s)) continue;
      const l = hLog(h, s);
      const part = hPartial(h, s);
      if (s === td && !l && !part) continue; // today isn't over yet
      if (l === 'skip') continue;   // a day off doesn't count either way
      total++;
      if (l === 'done') { done++; if (!broke) streak++; }
      else if (part) { done += part; if (!broke) streak++; } // did some of it: counts for its share
      else broke = true;
    }
    return { streak, streakUnit: 'd', rate: total ? Math.round((done / total) * 100) : null, total: hDoneCount(h) };
  }
  const cur = hWeekStart(h, td), first = hWeekStart(h, h.start), target = hTarget(h);
  let weeks = 0, met = 0, streak = 0, broke = false;
  for (let ws = cur, i = 0; ws >= first && i < 300; ws = hAdd(ws, -7), i++) {
    const ok = hWeekVal(h, hWeek(h, ws)) >= target;
    if (ws === cur) { if (ok) streak++; continue; } // this week only counts once it's reached
    weeks++;
    if (ok) met++;
    if (!broke) { if (ok) streak++; else broke = true; }
  }
  const total = h.kind === 'times' ? hDoneCount(h) : Object.values(h.minutes || {}).reduce((a, b) => a + b, 0);
  return { streak, streakUnit: 'w', rate: weeks ? Math.round((met / weeks) * 100) : null, total };
}

const hMinsLabel = (m) => focusTimeLabel(Math.round(m));
function hSummary(h) {
  const bits = [];
  if (h.kind === 'days') {
    const order = [...Array(7)].map((_, i) => ((h.weekStart ?? appWeekStart()) + i) % 7);
    const days = order.filter((d) => (h.days || []).includes(d));
    bits.push(days.length === 7 ? t('hbEveryDay') : days.map((d) => hDayName(d, 'long')).join('، '));
  }
  if (h.kind === 'times') bits.push(t('hbTimesWeek').replace('{n}', h.perWeek));
  if (h.kind === 'minutes') bits.push(t('hbMinsWeek').replace('{t}', hMinsLabel(h.minutesPerWeek)));
  if (h.time) bits.push(fmtTime(`2000-01-01T${h.time}`, lang()));
  if (h.duration) bits.push(hMinsLabel(h.duration));
  return bits.join(' · ');
}

// Habits to show on Today: scheduled today, or weekly goals not reached yet.
function hToggleToday(h) {
  const td = todayStr();
  h.log = h.log || {};
  if (h.log[td] === 'done') delete h.log[td]; else h.log[td] = 'done';
  save();
  if (h.log[td] === 'done') showToast(`${h.emoji || '✓'} ${h.name}: ${t('hbDoneToast')}`);
}
function hStartFocus(h, rest) {
  const left = rest && h.duration ? Math.max(1, Math.round(h.duration - hMins(h, todayStr()))) : null;
  askFocusMins(t, left || Number(h.duration) || Number(data.settings.focusMins) || 25, (mins) => {
    ui.focusView = true;
    window.api.focus('start', 'habit:' + h.id, { mins }).then((d) => { data = d; refreshLists(); renderFocus(true); });
  });
}

// One row on the Today page.
function habitRowHtml(h) {
  const td = todayStr();
  const done = hLog(h, td) === 'done';
  let meta = '';
  const part = hPartial(h, td);
  if (part) meta = `⏳ ${hMinsLabel(hMins(h, td))} / ${hMinsLabel(h.duration)}`;
  else if (h.kind === 'days') meta = [h.time && fmtTime(`2000-01-01T${h.time}`, lang()), h.duration && hMinsLabel(h.duration)].filter(Boolean).join(' · ');
  else if (h.kind === 'times') { const w = hWeek(h, td); meta = `${w.done} / ${h.perWeek} ${t('hbThisWeek')}`; }
  else { const w = hWeek(h, td); meta = `${hMinsLabel(w.mins)} / ${hMinsLabel(h.minutesPerWeek)} ${t('hbThisWeek')}`; }
  const canFocus = h.kind === 'minutes' || h.duration;
  return `<div class="hb-row ${done ? 'done' : ''}" style="--hc:${areaColor(h)}">
    ${h.kind === 'minutes' ? `<span class="hb-ring" style="--p:${Math.min(100, Math.round((hWeek(h, td).mins / h.minutesPerWeek) * 100))}"></span>` : `<button class="check ${done ? 'on' : ''}" data-hcheck="${h.id}" title="${t('hbMarkToday')}">✓</button>`}
    <span class="hb-emoji">${esc(h.emoji || '🔁')}</span>
    <span class="hb-name" dir="auto" data-hopen="${h.id}">${esc(h.name)}</span>
    <span class="hb-meta">${meta}</span>
    ${canFocus && !done ? `<button class="row-focus hb-focus" data-hfocus="${h.id}" title="${t('fStartTip')}">▶ ${t('fShort')}</button>` : ''}</div>`;
}

// ---------- the Habits tab ----------
function renderHabits() {
  const all = habitsList();
  const live = all.filter((h) => !h.archived && !hEnded(h));
  const old = all.filter((h) => h.archived || hEnded(h));
  const examples = [['📚', t('hbExStudy'), 'days'], ['🏋️', t('hbExGym'), 'times'], ['📖', t('hbExRead'), 'minutes']];
  $('list').innerHTML = `<div class="habits">
    <div class="hbp-head"><div><h2>${t('habits')}</h2><p class="small muted">${t('hbIntro')}</p></div>
      <button class="primary" data-hnew>＋ ${t('hbNew')}</button></div>
    ${live.length ? `<div class="hb-grid">${live.map(habitCardHtml).join('')}</div>` : `<div class="hb-empty">
      <div class="hb-empty-mouse">${mouseLogo('', 'happy')}</div><b>${t('hbEmpty')}</b><p class="small muted">${t('hbEmptySub')}</p>
      <div class="hb-examples">${examples.map(([e, n, k]) => `<button data-hex="${k}" data-hname="${esc(n)}" data-hemoji="${e}">${e} ${esc(n)}</button>`).join('')}</div></div>`}
    ${old.length ? `<details class="hb-old"><summary>${t('hbOld')} · ${old.length}</summary><div class="hb-grid">${old.map(habitCardHtml).join('')}</div></details>` : ''}
  </div>`;
}

function habitCardHtml(h) {
  const td = todayStr();
  const st = hStats(h);
  const w = hWeek(h, td);
  const live = hLive(h);
  let now = '';
  if (!live) now = `<div class="hbc-now muted small">${h.archived ? t('hbPaused') : hEnded(h) ? `🎉 ${t('hbFinished')}` : `${t('hbStarts')} ${fmtDate(h.start, lang())}`}</div>`;
  else if (h.kind === 'days') {
    const l = hLog(h, td);
    if (hScheduled(h, td)) {
      const part = hPartial(h, td);
      now = l === 'done' ? `<div class="hbc-now ok">✓ ${t('hbDoneToday')} <button class="link" data-hcheck="${h.id}">${t('hbUndo')}</button></div>`
        : part ? `<div class="hbc-now col"><div class="hb-bar part"><i style="width:${Math.round(part * 100)}%"></i></div>
            <div class="hbc-row"><span class="small">⏳ ${t('hbPartialOf').replace('{a}', hMinsLabel(hMins(h, td))).replace('{b}', hMinsLabel(h.duration))}</span>
            <span class="hbc-btns"><button class="primary" data-hfocus="${h.id}" data-hrest="1">▶ ${t('hbContinue')}</button><button data-hcheck="${h.id}" title="${t('hbCountDoneTip')}">✓ ${t('hbCountDone')}</button><button data-hadd="${h.id}" title="${t('hbAddTimeTip')}">＋</button></span></div></div>`
        : l === 'skip' ? `<div class="hbc-now muted">🌴 ${t('hbSkipToday')} <button class="link" data-hskip="${h.id}">${t('hbUndo')}</button></div>`
        : `<div class="hbc-now"><button class="primary" data-hcheck="${h.id}">✓ ${t('hbDidIt')}</button>${h.duration ? `<button data-hfocus="${h.id}">▶ ${t('fShort')} ${hMinsLabel(h.duration)}</button><button data-hadd="${h.id}" title="${t('hbAddTimeTip')}">＋ ${t('hbAddTime')}</button>` : ''}<button class="ghost" data-hskip="${h.id}" title="${t('hbSkipTip')}">🌴 ${t('hbSkip')}</button></div>`;
    } else {
      let n = td; for (let i = 0; i < 8; i++) { n = hAdd(n, 1); if (hScheduled(h, n)) break; }
      now = `<div class="hbc-now muted small">${t('hbNotToday')} · ${t('hbNext')}: ${hScheduled(h, n) ? (n === hAdd(td, 1) ? t('tomorrowLbl') : hDayName(hDow(n), 'long')) : '—'}</div>`;
    }
  } else if (h.kind === 'times') {
    const done = hLog(h, td) === 'done';
    now = `<div class="hbc-now"><span class="hb-dots">${[...Array(h.perWeek)].map((_, i) => `<i class="${i < w.done ? 'on' : ''}"></i>`).join('')}</span>
      <span class="small">${w.done} / ${h.perWeek} ${t('hbThisWeek')}${w.done < h.perWeek ? ` · ${t('hbDaysLeft').replace('{n}', w.left + 1)}` : ' 🎉'}</span>
      <button class="${done ? '' : 'primary'}" data-hcheck="${h.id}">${done ? `✓ ${t('hbDoneToday')}` : `✓ ${t('hbDidItToday')}`}</button>${h.duration && !done ? `<button data-hfocus="${h.id}">▶</button>` : ''}</div>`;
  } else {
    const pct = Math.min(100, Math.round((w.mins / h.minutesPerWeek) * 100));
    now = `<div class="hbc-now col"><div class="hb-bar"><i style="width:${pct}%"></i></div>
      <div class="hbc-row"><span class="small">${hMinsLabel(w.mins)} / ${hMinsLabel(h.minutesPerWeek)} ${t('hbThisWeek')}</span>
      <span class="hbc-btns"><button class="primary" data-hfocus="${h.id}">▶ ${t('fShort')}</button><button data-hadd="${h.id}" title="${t('hbAddTimeTip')}">＋ ${t('hbAddTime')}</button></span></div></div>`;
  }
  return `<section class="hb-card ${live ? '' : 'faded'}" data-habit="${h.id}" style="--hc:${areaColor(h)}">
    <header><span class="hb-emoji big">${esc(h.emoji || '🔁')}</span><div class="hbc-title"><b dir="auto">${esc(h.name)}</b><small>${hSummary(h)}</small></div>
      <button class="icon" data-hedit="${h.id}" title="${t('edit')}">✎</button></header>
    ${now}
    <div class="hbc-stats">
      <span title="${t(st.streakUnit === 'd' ? 'hbStreakDays' : 'hbStreakWeeks')}">🔥 <b>${st.streak}</b> ${st.streakUnit === 'd' ? t('hbDaysShort') : t('hbWeeksShort')}</span>
      <span title="${t('hbRateTip')}">🎯 <b>${st.rate === null ? '—' : st.rate + '%'}</b> ${t('hbRate')}</span>
      <span>${h.kind === 'minutes' ? `⏱ <b>${hMinsLabel(st.total)}</b>` : `✓ <b>${st.total}</b> ${t('hbTimes')}`}${h.end && h.end.type === 'count' ? ` / ${h.end.count}` : ''}</span>
    </div>
    ${h.kind === 'minutes' ? hWeekBars(h) : hWeekStrip(h)}
    ${hHistory(h)}
  </section>`;
}

// This week as seven day circles (like a calendar row), then the full history as a month calendar.
// Colors: done = filled, partly = filled part of the way round, missed = red, day off = 🌴, not due = faint.
function hCell(h, d, small) {
  const s = hDayState(h, d);
  const td = todayStr();
  const part = s === 'partial' ? Math.round(hPartial(h, d) * 100) : 0;
  const mins = hMins(h, d);
  const tip = `${hDayName(hDow(d), 'long')} ${fmtDate(d, lang())} · ${t('hbSt_' + s)}${mins ? ` · ${hMinsLabel(mins)}` : ''}`;
  const fixable = s !== 'off' && s !== 'future' && d <= td;
  return `<span class="hc ${s} ${d === td ? 'is-today' : ''} ${small ? 'sm' : ''}" ${part ? `style="--part:${part}%"` : ''} ${fixable ? `data-hday="${d}"` : ''} title="${esc(tip)}"><b>${s === 'skip' ? '🌴' : Number(d.slice(8))}</b></span>`;
}
function hWeekStrip(h) {
  const td = todayStr();
  const w = hWeek(h, td);
  return `<div class="hw-strip">${w.days.map((d) => `<div class="hw-day"><small>${hDayName(hDow(d), 'short')}</small>${hCell(h, d)}</div>`).join('')}</div>`;
}
// Month calendar, rows starting on the habit's week day; weekly habits get the week's result at the end of each row.
function hMonthCal(h) {
  ui.hbMonth = ui.hbMonth || {};
  const td = todayStr();
  const month = ui.hbMonth[h.id] || td.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const last = todayStr(new Date(y, m, 0));
  const ws0 = hWeekStart(h, first);
  const weekly = h.kind !== 'days';
  const head = [...Array(7)].map((_, i) => `<small>${hDayName(hDow(hAdd(ws0, i)), 'narrow')}</small>`).join('') + (weekly ? `<small>${t('hbWeekCol')}</small>` : '');
  let rows = '';
  for (let ws = ws0; ws <= last; ws = hAdd(ws, 7)) {
    const days = [...Array(7)].map((_, i) => hAdd(ws, i));
    rows += days.map((d) => (d.slice(0, 7) === month ? hCell(h, d, true) : '<span class="hc blank sm"></span>')).join('');
    if (weekly) {
      const wk = hWeek(h, ws), val = hWeekVal(h, wk), target = hTarget(h);
      const started = hAdd(ws, 6) >= h.start;
      const label = h.kind === 'times' ? `${val}/${target}` : hMinsLabel(val);
      rows += !started || ws > td ? '<span class="hc-wk"></span>' : ws === hWeekStart(h, td) ? `<span class="hc-wk cur" title="${t('hbThisWeek')}">${label}</span>` : `<span class="hc-wk ${val >= target ? 'ok' : 'bad'}" title="${val >= target ? t('hbMet') : t('hbBelow')}">${val >= target ? '✓' : '✗'} ${label}</span>`;
    }
  }
  const prev = todayStr(new Date(y, m - 2, 1)).slice(0, 7), next = todayStr(new Date(y, m, 1)).slice(0, 7);
  return `<div class="hc-cal ${weekly ? 'weekly' : ''}">
    <div class="hc-head"><button class="icon" data-hmon="${h.id}:${prev}" ${prev < h.start.slice(0, 7) ? 'disabled' : ''}>${lang() === 'ar' ? '›' : '‹'}</button>
      <b>${new Date(y, m - 1, 1).toLocaleDateString(hLoc(), { month: 'long', year: 'numeric' })}</b>
      <button class="icon" data-hmon="${h.id}:${next}" ${next > td.slice(0, 7) ? 'disabled' : ''}>${lang() === 'ar' ? '‹' : '›'}</button></div>
    <div class="hc-grid">${head}${rows}</div>
    <p class="hc-hint">${t('hbFixHint')}</p></div>`;
}
function hHistory(h) {
  ui.hbOpen = ui.hbOpen || {};
  const legend = `<div class="hm-legend"><span><i class="hc sm done"></i>${t('hbSt_done')}</span>${h.kind !== 'minutes' && h.duration ? `<span><i class="hc sm partial" style="--part:50%"></i>${t('hbSt_partial')}</span>` : ''}${h.kind === 'days' ? `<span><i class="hc sm missed"></i>${t('hbSt_missed')}</span>` : ''}<span>🌴 ${t('hbSt_skip')}</span></div>`;
  return `<details class="hb-hist" data-hhist="${h.id}" ${ui.hbOpen[h.id] ? 'open' : ''}><summary>${icon('calendar')} ${t('hbHistory')}</summary>${hMonthCal(h)}${legend}</details>`;
}

// Minutes per week: the last 8 weeks against the target.
function hWeekBars(h) {
  const cur = hWeekStart(h, todayStr());
  const weeks = [...Array(8)].map((_, i) => hAdd(cur, -7 * (7 - i)));
  const max = Math.max(h.minutesPerWeek, ...weeks.map((ws) => hWeek(h, ws).mins), 1);
  return `<div class="hb-bars-wrap"><div class="hb-bars"><span class="hb-target" style="bottom:${(h.minutesPerWeek / max) * 100}%"><em>${t('hbTarget')} ${hMinsLabel(h.minutesPerWeek)}</em></span>
    ${weeks.map((ws) => { const m = hWeek(h, ws).mins; const ok = m >= h.minutesPerWeek; return `<span class="hb-b ${ws === cur ? 'cur' : ok ? 'ok' : ws < hWeekStart(h, h.start) ? 'off' : 'bad'}" title="${fmtDate(ws, lang())} → ${fmtDate(hAdd(ws, 6), lang())}: ${hMinsLabel(m)}"><i style="height:${Math.max(3, (m / max) * 100)}%"></i></span>`; }).join('')}</div>
    <div class="hb-bars-x">${weeks.map((ws) => `<small>${ws === cur ? t('hbThisWeek') : fmtDate(ws, lang())}</small>`).join('')}</div></div>`;
}

// ---------- add / edit ----------
function openHabitEditor(h, preset = {}) {
  const isNew = !h;
  const ar = lang() === 'ar';
  h = h ? JSON.parse(JSON.stringify(h)) : { id: uid(), name: preset.name || '', emoji: preset.emoji || '', color: 'blue', kind: preset.kind || 'days', days: [0, 2, 4], perWeek: 3, minutesPerWeek: 300,
    time: '', duration: preset.kind === 'days' ? 60 : null, start: todayStr(), end: { type: 'never' }, weekStart: null, widget: true, log: {}, minutes: {} };
  const order = [...Array(7)].map((_, i) => ((h.weekStart ?? appWeekStart()) + i) % 7);
  const emojis = ['📚', '🏋️', '📖', '🏃', '🧘', '💧', '✍️', '🕌', '🎸', '💻', '🥗', '😴'];
  const bg = document.createElement('div');
  bg.className = 'modal-bg hb-edit-bg';
  const draw = () => {
    const seg = (name, val, label) => `<button type="button" class="${h[name] === val ? 'on' : ''}" data-hset="${name}" data-v="${val}">${label}</button>`;
    bg.innerHTML = `<div class="modal hb-edit" role="dialog">
      <h3>${isNew ? t('hbNew') : t('hbEdit')}</h3>
      <div class="hbe-name"><input type="text" id="heEmoji" class="hbe-emoji" maxlength="4" value="${esc(h.emoji)}" placeholder="🔁"><input type="text" id="heName" dir="auto" value="${esc(h.name)}" placeholder="${t('hbNamePh')}"></div>
      <div class="hbe-emojis">${emojis.map((e) => `<button type="button" data-hemo="${e}">${e}</button>`).join('')}</div>
      <label class="hbe-lbl">${t('hbKind')}</label>
      <div class="seg hbe-kind">${seg('kind', 'days', '📅 ' + t('hbKindDays'))}${seg('kind', 'times', '🔢 ' + t('hbKindTimes'))}${seg('kind', 'minutes', '⏱ ' + t('hbKindMins'))}</div>
      <p class="small muted hbe-help">${t('hbKindHelp_' + h.kind)}</p>
      ${h.kind === 'days' ? `<div class="hbe-days">${order.map((d) => `<button type="button" class="${h.days.includes(d) ? 'on' : ''}" data-hday-pick="${d}">${hDayName(d, 'short')}</button>`).join('')}</div>` : ''}
      ${h.kind === 'times' ? `<div class="hbe-line"><input type="number" id="hePer" min="1" max="7" value="${h.perWeek}"> ${t('hbTimesPerWeek')}</div>` : ''}
      ${h.kind === 'minutes' ? `<div class="hbe-line"><input type="number" id="heH" min="0" max="80" value="${Math.floor(h.minutesPerWeek / 60)}"> ${t('hbHours')} <input type="number" id="heM" min="0" max="59" step="5" value="${h.minutesPerWeek % 60}"> ${t('hbMinutes')} ${t('hbPerWeek')}</div>` : ''}
      <div class="hbe-two">
        <div><label class="hbe-lbl">${t('hbTime')}</label>${timeBox('heTime', h.time)}<small class="muted">${t('hbTimeHelp')}</small></div>
        ${h.kind !== 'minutes' ? `<div><label class="hbe-lbl">${t('hbDuration')}</label><div class="hbe-line"><input type="number" id="heDur" min="0" max="600" value="${h.duration || ''}" placeholder="—"> ${t('hbMinutes')}</div><small class="muted">${t('hbDurationHelp')}</small></div>` : ''}
      </div>
      <div class="hbe-two">
        <div><label class="hbe-lbl">${t('hbStart')}</label><input type="date" id="heStart" value="${h.start}"></div>
        <div><label class="hbe-lbl">${t('hbEnd')}</label>
          <select id="heEndType"><option value="never" ${h.end.type === 'never' ? 'selected' : ''}>${t('hbEndNever')}</option><option value="date" ${h.end.type === 'date' ? 'selected' : ''}>${t('hbEndDate')}</option><option value="count" ${h.end.type === 'count' ? 'selected' : ''}>${t('hbEndCount')}</option></select>
          ${h.end.type === 'date' ? `<input type="date" id="heEndDate" value="${h.end.date || hAdd(todayStr(), 30)}">` : ''}
          ${h.end.type === 'count' ? `<div class="hbe-line"><input type="number" id="heEndCount" min="1" max="999" value="${h.end.count || 20}"> ${t('hbTimes')}</div>` : ''}
        </div>
      </div>
      <div class="hbe-opts"><label class="hbe-check"><input type="checkbox" id="heWidget" ${h.widget !== false ? 'checked' : ''}> ${t('hbInWidget')}</label>
        ${h.kind !== 'days' ? `<label class="hbe-check">${t('hbWeekStarts')} <select id="heWs"><option value="">${t('hbWsDefault')} (${hDayName(appWeekStart(), 'long')})</option>${[6, 0, 1, 2, 3, 4, 5].map((d) => `<option value="${d}" ${h.weekStart === d ? 'selected' : ''}>${hDayName(d, 'long')}</option>`).join('')}</select></label>` : ''}</div>
      <div class="hbe-colors">${COLORS.map((c) => `<button type="button" class="swatch ${h.color === c ? 'on' : ''}" data-hcolor="${c}" style="background:var(--c-${c})"></button>`).join('')}</div>
      <div class="actions">${isNew ? '' : `<button class="danger" data-hdel>${icon('trash')}</button><button data-harch>${h.archived ? t('hbResume') : t('hbPause')}</button>`}
        <span style="flex:1"></span><button data-hcancel>${t('cancel')}</button><button class="primary" data-hsave>${t('save')}</button></div></div>`;
  };
  // Keep what's typed when the form redraws (e.g. after switching the kind).
  const read = () => {
    const v = (id) => bg.querySelector('#' + id);
    if (v('heName')) h.name = v('heName').value.trim();
    if (v('heEmoji')) h.emoji = v('heEmoji').value.trim();
    if (v('hePer')) h.perWeek = Math.max(1, Math.min(7, Number(v('hePer').value) || 1));
    if (v('heH')) h.minutesPerWeek = Math.max(5, (Number(v('heH').value) || 0) * 60 + (Number(v('heM').value) || 0));
    if (v('heTime')) h.time = timeValue(v('heTime')) || '';
    if (v('heDur')) h.duration = Number(v('heDur').value) || null;
    if (v('heStart')) h.start = v('heStart').value || todayStr();
    if (v('heEndType')) h.end = { type: v('heEndType').value };
    if (v('heEndDate')) h.end.date = v('heEndDate').value;
    if (v('heEndCount')) h.end.count = Number(v('heEndCount').value) || 1;
    if (v('heWidget')) h.widget = v('heWidget').checked;
    if (v('heWs')) h.weekStart = v('heWs').value === '' ? null : Number(v('heWs').value);
  };
  draw();
  document.body.appendChild(bg);
  setTimeout(() => bg.querySelector('#heName')?.focus(), 30);
  const close = () => { document.removeEventListener('keydown', onKey, true); bg.classList.add('leaving'); setTimeout(() => bg.remove(), 150); };
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.tp-pop, .dp-pop')) { e.stopPropagation(); e.preventDefault(); close(); } };
  document.addEventListener('keydown', onKey, true);
  bg.addEventListener('change', (e) => { if (e.target.id === 'heEndType') { read(); draw(); } });
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  bg.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.hset) { read(); h[b.dataset.hset] = b.dataset.v; if (h.kind === 'days' && !h.duration) h.duration = 60; draw(); return; }
    if (b.dataset.hdayPick !== undefined) { read(); const d = Number(b.dataset.hdayPick); h.days = h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d]; draw(); return; }
    if (b.dataset.hemo) { bg.querySelector('#heEmoji').value = b.dataset.hemo; return; }
    if (b.dataset.hcolor) { read(); h.color = b.dataset.hcolor; draw(); return; }
    if (b.hasAttribute('data-hcancel')) return close();
    if (b.hasAttribute('data-harch')) { const x = habitById(h.id); x.archived = !x.archived; save(); close(); return refresh(); }
    if (b.hasAttribute('data-hdel')) {
      if (await askConfirm({ title: t('hbDelQ'), text: t('hbDelText'), ok: t('del'), danger: true })) {
        data.habits = habitsList().filter((x) => x.id !== h.id); save(); close(); refresh();
      }
      return;
    }
    if (b.hasAttribute('data-hsave')) {
      read();
      if (!h.name) { const n = bg.querySelector('#heName'); n.classList.add('bad'); n.focus(); return; }
      if (h.kind === 'days' && !h.days.length) { showToast(t('hbPickDays')); return; }
      const list = habitsList();
      const i = list.findIndex((x) => x.id === h.id);
      if (i >= 0) list[i] = { ...list[i], ...h, log: list[i].log, minutes: list[i].minutes }; else list.push(h);
      save(); close();
      ui.view = 'habits'; ui.selected = null; refresh();
    }
  });
}

// Add time by hand (for "minutes a week" habits): a small box asking how many minutes.
function hAddTime(h) {
  askFocusMinsLike(t('hbAddTimeQ'), (m) => {
    const td = todayStr();
    h.minutes = h.minutes || {};
    h.minutes[td] = (h.minutes[td] || 0) + m;
    if (h.kind !== 'minutes' && h.duration && h.minutes[td] >= h.duration) { h.log = h.log || {}; h.log[td] = 'done'; }
    save(); refresh();
  });
}
function askFocusMinsLike(title, onGo) {
  const bg = document.createElement('div');
  bg.className = 'fm-bg';
  bg.innerHTML = `<div class="fm-card"><b class="fm-q">⏱ ${title}</b>
    <div class="fm-chips">${[15, 30, 60].map((m) => `<button data-fm="${m}">${m}<small>${t('minShort')}</small></button>`).join('')}
    <label class="fm-own"><input type="number" id="fmOwn" min="1" max="600" placeholder="${t('fmOwn')}"><small>${t('minShort')}</small></label></div>
    <div class="fm-acts"><button class="ghost" data-fmx>${t('cancel')}</button><button class="primary" data-fmgo>${t('addBtn')}</button></div></div>`;
  document.body.appendChild(bg);
  const close = () => bg.remove();
  const go = (m) => { m = Math.round(Number(m)); if (m > 0) { close(); onGo(m); } };
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  bg.addEventListener('click', (e) => {
    const c = e.target.closest('[data-fm]'); if (c) return go(c.dataset.fm);
    if (e.target.closest('[data-fmx]')) return close();
    if (e.target.closest('[data-fmgo]')) return go(bg.querySelector('#fmOwn').value);
  });
  bg.querySelector('#fmOwn').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(e.target.value); if (e.key === 'Escape') close(); });
}

// ---------- morning check: "did you do it yesterday?" ----------
// A scheduled day that passed without a mark counts as missed, but first you get the chance
// to say you did it (or that it was a day off). Asked once a day, before the plan.
function habitCheckRows() {
  const td = todayStr();
  const since = data.settings.lastHabitCheck && data.settings.lastHabitCheck > hAdd(td, -7) ? data.settings.lastHabitCheck : hAdd(td, -7);
  const rows = [];
  for (const h of habitsList()) {
    if (h.archived) continue;
    if (h.kind === 'days') {
      for (let s = hAdd(td, -1); s >= since && s >= h.start; s = hAdd(s, -1)) if (hScheduled(h, s) && !hLog(h, s)) rows.push({ h, d: s });
    } else if (h.kind === 'times') {
      const y = hAdd(td, -1);
      if (y >= since && hActiveOn(h, y) && !hLog(h, y) && hWeekVal(h, hWeek(h, y)) < h.perWeek) rows.push({ h, d: y });
    }
  }
  return rows.sort((a, b) => b.d.localeCompare(a.d));
}
function maybeAskHabits() {
  if (!data || !habitsList().length) return;
  const td = todayStr();
  if (data.settings.lastHabitCheck === td) return;
  if (document.querySelector('.modal-bg') || $('modalRoot').innerHTML) return setTimeout(maybeAskHabits, 1500);
  const rows = habitCheckRows();
  data.settings.lastHabitCheck = td; save();
  if (!rows.length) return;
  const dayLbl = (d) => (d === hAdd(td, -1) ? t('hbYesterday') : hDayName(hDow(d), 'long') + ' ' + fmtDate(d, lang()));
  const bg = document.createElement('div');
  bg.className = 'modal-bg hb-check-bg';
  bg.innerHTML = `<div class="modal hb-check"><div class="pl-head"><span class="pl-sun">🌤</span><div><h3>${t('hbCheckTitle').replace('{g}', (() => { const hr = new Date().getHours(); return hr < 12 ? t('gMorning') : hr < 18 ? t('gAfternoon') : t('gEvening'); })())}</h3><p class="small muted">${t('hbCheckSub')}</p></div></div>
    <div class="hbk-list">${rows.map(({ h, d }, i) => `<div class="hbk-row" data-i="${i}"><span class="hb-emoji">${esc(h.emoji || '🔁')}</span><span class="hbk-t"><b dir="auto">${esc(h.name)}</b><small>${dayLbl(d)}${hPartial(h, d) ? ` · ⏳ ${hMinsLabel(hMins(h, d))} / ${hMinsLabel(h.duration)}` : ''}</small></span>
      <span class="hbk-btns"><button class="ok" data-ans="done">✓ ${t('hbYes')}</button><button data-ans="no">✗ ${t('hbNo')}</button><button data-ans="skip" title="${t('hbSkipTip')}">🌴</button></span></div>`).join('')}</div>
    <p class="small muted">${t('hbCheckNote')} ${t('hbCheckPartial')}</p>
    <div class="actions"><span style="flex:1"></span><button class="primary" data-hk-ok>${t('ok')}</button></div></div>`;
  document.body.appendChild(bg);
  const close = () => { bg.classList.add('leaving'); setTimeout(() => bg.remove(), 150); refresh(); };
  bg.addEventListener('click', (e) => {
    const a = e.target.closest('[data-ans]');
    if (a) {
      const row = a.closest('[data-i]'); const { h, d } = rows[Number(row.dataset.i)];
      h.log = h.log || {};
      if (a.dataset.ans === 'done') h.log[d] = 'done'; else if (a.dataset.ans === 'skip') h.log[d] = 'skip'; else delete h.log[d];
      save();
      row.classList.add('answered', 'ans-' + a.dataset.ans);
      row.querySelectorAll('[data-ans]').forEach((b) => b.classList.toggle('on', b === a));
      return;
    }
    if (e.target.closest('[data-hk-ok]') || e.target === bg) close();
  });
}

// ---------- clicks ----------
document.addEventListener('click', (e) => {
  const q = (sel) => e.target.closest && e.target.closest(sel);
  let b;
  if ((b = q('[data-hnew]'))) return openHabitEditor(null);
  if ((b = q('[data-hex]'))) return openHabitEditor(null, { kind: b.dataset.hex, name: b.dataset.hname, emoji: b.dataset.hemoji });
  if ((b = q('[data-hedit]'))) return openHabitEditor(habitById(b.dataset.hedit));
  if ((b = q('[data-hcheck]'))) { e.stopPropagation(); const h = habitById(b.dataset.hcheck); if (h) { hToggleToday(h); refresh(); } return; }
  if ((b = q('[data-hskip]'))) { const h = habitById(b.dataset.hskip); const td = todayStr(); h.log = h.log || {}; if (h.log[td] === 'skip') delete h.log[td]; else h.log[td] = 'skip'; save(); return refresh(); }
  if ((b = q('[data-hfocus]'))) { e.stopPropagation(); const h = habitById(b.dataset.hfocus); if (h) hStartFocus(h, b.dataset.hrest || hPartial(h, todayStr())); return; }
  if ((b = q('[data-hadd]'))) return hAddTime(habitById(b.dataset.hadd));
  if ((b = q('[data-hopen]'))) { ui.view = 'habits'; ui.selected = null; refresh(); return; }
  if ((b = q('[data-hmon]'))) { const [id, mon] = b.dataset.hmon.split(':'); ui.hbMonth = ui.hbMonth || {}; ui.hbMonth[id] = mon; ui.hbOpen = ui.hbOpen || {}; ui.hbOpen[id] = true; return renderList(); }
  // Fix a past day on the tracker: nothing → done → day off → nothing.
  if ((b = q('[data-hday]'))) {
    const h = habitById(b.closest('[data-habit]').dataset.habit); const d = b.dataset.hday;
    h.log = h.log || {};
    const cur = h.log[d];
    if (!cur) h.log[d] = 'done'; else if (cur === 'done') h.log[d] = 'skip'; else delete h.log[d];
    save(); refresh();
  }
}, true);

document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (d.matches && d.matches('[data-hhist]')) { ui.hbOpen = ui.hbOpen || {}; ui.hbOpen[d.dataset.hhist] = d.open; }
}, true);
