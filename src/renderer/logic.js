// ---------------- shared logic ----------------
// Pure rules about tasks, dates and habits, used by every window AND by the main process,
// so both sides always agree. No DOM, no Electron here; it is covered by tests/logic.test.js.
// In a window it puts its functions on `window`; in Node it is a normal module.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  // ---------- dates ----------
  function todayStr(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function daysBetween(a, b) {
    const pa = new Date(a + 'T00:00:00'), pb = new Date(b + 'T00:00:00');
    return Math.round((pb - pa) / 86400000);
  }
  const hAdd = (s, n) => { const d = new Date(s + 'T00:00'); d.setDate(d.getDate() + n); return todayStr(d); };
  const hDow = (s) => new Date(s + 'T00:00').getDay();
  // Move a date by n days / weeks / months / years. "31 Jan + 1 month" lands on the month's last day.
  function shiftDate(ds, n, unit) {
    const d = new Date(ds + 'T00:00');
    if (unit === 'day') d.setDate(d.getDate() + n);
    if (unit === 'week') d.setDate(d.getDate() + 7 * n);
    if (unit === 'month') { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
    if (unit === 'year') d.setFullYear(d.getFullYear() + n);
    return todayStr(d);
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // The week starts on the day picked in Settings (Saturday unless changed). Each side tells us
  // where to read that setting from.
  let weekStartFn = () => 6;
  function configure(o = {}) { if (o.weekStart) weekStartFn = o.weekStart; }
  const appWeekStart = () => { const v = weekStartFn(); return v === null || v === undefined ? 6 : Number(v); };

  // ---------- tasks ----------
  const QUADS = ['q1', 'q2', 'q3', 'q4'];
  const QUAD_RANK = { q1: 0, q2: 1, q3: 2, q4: 3 };
  // Matrix box first (unclassified last), then nearest due date (no due date last).
  const byPriorityThenDue = (a, b) =>
    (QUAD_RANK[a.priority] ?? 9) - (QUAD_RANK[b.priority] ?? 9) || (a.due || '9999').localeCompare(b.due || '9999');
  // Status is derived, never stored. A task whose start is still ahead is "scheduled".
  function statusOf(t, td = todayStr()) {
    if (t.closure) return 'closed';
    if (t.start && t.start > td && !(t.due && t.due <= td)) return 'scheduled';
    if (t.due && t.due < td) return 'overdue';
    if (t.due && t.due === td) return 'today';
    return 'pending';
  }
  // Open items (x.topic) have no due date and live under Tasks › Open items, so they are never "active"
  // work: they stay out of Today, the plan, the matrix and the counts.
  const isActive = (x) => !x.closure && !x.topic && statusOf(x) !== 'scheduled';
  // An open item is measured by when it last moved: its newest follow-up (or when it started).
  function topicLast(x) {
    let last = x.start ? x.start + 'T00:00' : '';
    for (const l of x.log || []) { const a = l.at || (l.date ? l.date + 'T00:00' : ''); if (a > last) last = a; }
    return last ? last.slice(0, 10) : null;
  }
  // "Remind me to check every N days": stale once N days pass without an update.
  const topicStale = (x, td = todayStr()) => !!(x.topic && !x.closure && x.checkEvery && topicLast(x) && daysBetween(topicLast(x), td) >= x.checkEvery);
  // Minutes of work left on a task: its estimate minus the time already focused on it.
  const minutesLeft = (x) => (x.estimate ? Math.max(0, Math.round(x.estimate - (x.focusMs || 0) / 60000)) : null);

  // Moving a task to another day: it starts that day; if it was due earlier, the due date moves too.
  // Returns true when that counts as putting it off.
  function deferTo(x, day) {
    let putOff = false;
    if (x.due && x.due < day) { x.due = day; putOff = true; }
    x.start = day;
    return putOff;
  }

  // ---------- habits ----------
  function hWeekStart(h, s) { const ws = h.weekStart ?? appWeekStart(); const d = new Date(s + 'T00:00'); d.setDate(d.getDate() - ((d.getDay() - ws + 7) % 7)); return todayStr(d); }
  const hLog = (h, s) => (h.log || {})[s] || null;
  const hMins = (h, s) => (h.minutes || {})[s] || 0;
  const hDoneCount = (h) => Object.values(h.log || {}).filter((v) => v === 'done').length;
  function hEnded(h, td = todayStr()) {
    const e = h.end || {};
    if (e.type === 'date' && e.date && td > e.date) return true;
    if (e.type === 'count' && e.count && hDoneCount(h) >= e.count) return true;
    return false;
  }
  const hLive = (h, td = todayStr()) => !h.archived && !hEnded(h, td) && h.start <= td;
  function hActiveOn(h, s) { const e = h.end || {}; return s >= h.start && !(e.type === 'date' && e.date && s > e.date); }
  const hScheduled = (h, s) => h.kind === 'days' && hActiveOn(h, s) && (h.days || []).includes(hDow(s));
  function hWeek(h, s, td = todayStr()) {
    const ws = hWeekStart(h, s);
    const days = [...Array(7)].map((_, i) => hAdd(ws, i));
    return { ws, days, done: days.filter((d) => hLog(h, d) === 'done').length, mins: days.reduce((n, d) => n + hMins(h, d), 0), left: days.filter((d) => d > td).length };
  }
  const hTarget = (h) => (h.kind === 'times' ? h.perWeek : h.minutesPerWeek);
  const hWeekVal = (h, w) => (h.kind === 'times' ? w.done : w.mins);
  // A day with time on it but short of the habit's length: done partly (0–1).
  function hPartial(h, s) {
    if (h.kind === 'minutes' || !h.duration || hLog(h, s)) return 0;
    const m = hMins(h, s);
    return m > 0 ? Math.min(0.99, m / h.duration) : 0;
  }
  // Habits for a day: scheduled that day, or a weekly goal not reached yet (or touched that day).
  function habitsDueOn(list, td = todayStr()) {
    return (list || []).filter((h) => hLive(h, td)).filter((h) => {
      if (h.kind === 'days') return hScheduled(h, td);
      const w = hWeek(h, td, td);
      return hWeekVal(h, w) < hTarget(h) || hLog(h, td) === 'done' || hMins(h, td) > 0;
    });
  }
  // Due and not done yet (for reminders).
  function habitStillDue(h, td = todayStr()) {
    if (!hActiveOn(h, td) || h.archived || hLog(h, td)) return false;
    if (h.kind === 'days') return hScheduled(h, td);
    return hWeekVal(h, hWeek(h, td, td)) < hTarget(h);
  }
  // Add time to a habit's day; once it reaches the habit's length the day is done.
  function habitAddMinutes(h, d, mins) {
    h.minutes = h.minutes || {};
    h.minutes[d] = Math.round(((h.minutes[d] || 0) + mins) * 10) / 10;
    if (h.kind !== 'minutes' && h.duration && h.minutes[d] >= h.duration - 0.5) { h.log = h.log || {}; h.log[d] = 'done'; }
    return h;
  }

  // ---------- habit days: what you did, how much, and where you stopped ----------
  // h.measures = [{ id, name, unit }]  (pages, minutes, push ups…, set on the habit)
  // h.entries  = { 'YYYY-MM-DD': { note, stop, vals: { measureId: number } } }
  function habitSetEntry(h, d, e) {
    h.entries = h.entries || {};
    const vals = {};
    for (const [k, v] of Object.entries((e && e.vals) || {})) if (Number(v) > 0) vals[k] = Number(v);
    const clean = { note: ((e && e.note) || '').trim(), stop: ((e && e.stop) || '').trim(), vals };
    if (!clean.note && !clean.stop && !Object.keys(vals).length) delete h.entries[d];
    else h.entries[d] = clean;
    return h;
  }
  const habitEntry = (h, d) => (h.entries || {})[d] || null;
  // The last time you wrote where you stopped (or a note), before a given day: "you were here".
  function habitLastStop(h, before = todayStr()) {
    const days = Object.keys(h.entries || {}).filter((d) => d < before).sort().reverse();
    for (const d of days) { const e = h.entries[d]; if (e.stop || e.note) return { date: d, stop: e.stop || '', note: e.note || '' }; }
    return null;
  }
  // A measure shows every day unless every === false: then it is a "this day only" item, shown only
  // on days that have a number for it (and offered as "used before" on other days).
  const hasVal = (h, mid) => Object.values(h.entries || {}).some((e) => e.vals && e.vals[mid] > 0);
  function habitMeasuresFor(h, d) {
    const e = (h.entries || {})[d];
    return (h.measures || []).filter((m) => m.every !== false || (e && e.vals && e.vals[m.id] > 0));
  }
  // Day-only items you used before but not on this day, the most recent first.
  function habitUsedBefore(h, d) {
    const shown = new Set(habitMeasuresFor(h, d).map((m) => m.id));
    const last = {};
    for (const [day, e] of Object.entries(h.entries || {})) for (const [k, v] of Object.entries(e.vals || {})) if (v > 0 && (!last[k] || day > last[k])) last[k] = day;
    return (h.measures || []).filter((m) => m.every === false && !shown.has(m.id) && last[m.id]).sort((a, b) => last[b.id].localeCompare(last[a.id]));
  }
  // Day-only items with no number on any day are gone for good.
  function habitTidyMeasures(h) {
    h.measures = (h.measures || []).filter((m) => m.every !== false || hasVal(h, m.id));
    return h;
  }
  // How well a habit was kept in the week starting ws: 0–1, or null if it wasn't running then.
  //  days: share of its scheduled days done so far (partly done counts for its share; days off and
  //  today-not-yet-marked don't count). times / minutes: how close the week got to the target.
  function habitWeekScore(h, ws, td = todayStr()) {
    const we = hAdd(ws, 6);
    if (ws > td || we < h.start || (h.end && h.end.type === 'date' && h.end.date && ws > h.end.date)) return null;
    if (h.kind === 'days') {
      let tot = 0, got = 0;
      for (let i = 0; i < 7; i++) {
        const d = hAdd(ws, i);
        if (d > td || !hScheduled(h, d)) continue;
        const l = hLog(h, d), part = hPartial(h, d);
        if (l === 'skip' || (d === td && !l && !part)) continue;
        tot++; got += l === 'done' ? 1 : part;
      }
      return tot ? got / tot : null;
    }
    const target = hTarget(h);
    return target ? Math.min(1, hWeekVal(h, hWeek(h, ws, td)) / target) : null;
  }
  // All habits together for that week (the average of the ones that were running).
  function habitsWeekScore(list, ws, td = todayStr()) {
    const sc = list.filter((h) => !h.archived).map((h) => habitWeekScore(h, hWeekStart(h, ws), td)).filter((v) => v !== null);
    return sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null;
  }
  // How much of each measure between two days (e.g. this week's pages and push ups).
  function habitTotals(h, from, to) {
    const out = {};
    for (const [d, e] of Object.entries(h.entries || {})) {
      if (d < from || d > to) continue;
      for (const [k, v] of Object.entries(e.vals || {})) out[k] = (out[k] || 0) + v;
    }
    return out;
  }

  // ---------- search ----------
  // Arabic-aware: أ إ آ ا are one letter, ة/ه, ى/ي, no tashkeel or tatweel, case-insensitive,
  // and Arabic-Indic digits match Latin ones. Every word you type must appear (any order).
  function normText(s) {
    return String(s || '').toLowerCase()
      .replace(/[ً-ْٰـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/\s+/g, ' ');
  }
  function matchText(hay, q) {
    const words = normText(q).trim().split(' ').filter(Boolean);
    if (!words.length) return false;
    const h = normText(hay);
    return words.every((w) => h.includes(w));
  }

  // ---------- words ----------
  // Arabic counts: 1 يوم, 2 يومين, 3–10 أيام, 11+ يوم.
  function arCount(n, one, two, few, many) {
    if (n === 1) return one;
    if (n === 2) return two;
    return `${n} ${n >= 3 && n <= 10 ? few : many}`;
  }
  // "1h 20m" / "ساعة و20 دقيقة"
  function fmtMins(mins, L) {
    mins = Math.round(mins);
    if (L !== 'ar') return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60 ? (mins % 60) + 'm' : ''}`.trim() : `${mins}m`;
    const h = Math.floor(mins / 60), m = mins % 60;
    const hw = (n) => arCount(n, 'ساعة', 'ساعتين', 'ساعات', 'ساعة'), mw = (n) => arCount(n, 'دقيقة', 'دقيقتين', 'دقايق', 'دقيقة');
    return h ? hw(h) + (m ? ` و${mw(m)}` : '') : mw(m);
  }

  // ---------- saving: send only what changed ----------
  // A window keeps the copy it last got from the app ("base"). When it saves it sends just the
  // records that changed, were deleted or moved, plus changed settings, and the app applies
  // them on top of ITS current copy. So two windows editing different things never undo
  // each other, and a window never overwrites what the app itself just wrote.
  const COLLECTIONS = ['tasks', 'habits', 'areas', 'people', 'journal'];
  const APP_OWNED = ['focus', 'focusLog', 'version'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function makePatch(base, cur) {
    const p = { sets: {}, dels: {}, order: {}, settings: {}, unset: [], top: {} };
    for (const k of COLLECTIONS) {
      const before = new Map((base[k] || []).map((r) => [r.id, JSON.stringify(r)]));
      const list = cur[k] || [];
      const ids = list.map((r) => r.id);
      const sets = list.filter((r) => before.get(r.id) !== JSON.stringify(r));
      const dels = [...before.keys()].filter((id) => !ids.includes(id));
      if (sets.length) p.sets[k] = sets;
      if (dels.length) p.dels[k] = dels;
      // Order matters for folders (and habits): send it when it isn't "old order + new at the end".
      const expected = [...(base[k] || []).map((r) => r.id).filter((id) => ids.includes(id)), ...ids.filter((id) => !before.has(id))];
      if (!same(expected, ids)) p.order[k] = ids;
    }
    const bs = base.settings || {}, cs = cur.settings || {};
    for (const key of Object.keys(cs)) if (!same(cs[key], bs[key])) p.settings[key] = cs[key];
    for (const key of Object.keys(bs)) if (!(key in cs)) p.unset.push(key);
    for (const key of Object.keys(cur)) {
      if (COLLECTIONS.includes(key) || key === 'settings' || APP_OWNED.includes(key)) continue;
      if (!same(cur[key], base[key])) p.top[key] = cur[key];
    }
    return p;
  }
  const patchEmpty = (p) => !Object.keys(p.sets).length && !Object.keys(p.dels).length && !Object.keys(p.order).length &&
    !Object.keys(p.settings).length && !p.unset.length && !Object.keys(p.top).length;
  function applyPatch(d, p) {
    for (const k of COLLECTIONS) {
      d[k] = d[k] || [];
      for (const r of p.sets[k] || []) { const i = d[k].findIndex((x) => x.id === r.id); if (i >= 0) d[k][i] = r; else d[k].push(r); }
      if (p.dels[k]) d[k] = d[k].filter((x) => !p.dels[k].includes(x.id));
      if (p.order[k]) { const pos = new Map(p.order[k].map((id, i) => [id, i])); d[k] = d[k].map((r, i) => [r, pos.has(r.id) ? pos.get(r.id) : 1e6 + i]).sort((a, b) => a[1] - b[1]).map((x) => x[0]); }
    }
    d.settings = d.settings || {};
    Object.assign(d.settings, p.settings);
    for (const k of p.unset || []) delete d.settings[k];
    Object.assign(d, p.top);
    return d;
  }


  // ---------- quick add: understand a sentence ----------
  // "Call Ahmed tomorrow 3pm for 30 min !1 #Work @Sara" / "اتصل بأحمد بكرة الساعة 3 ساعة"
  // → title, due date, time, estimate, priority, folder name, person. Works in both languages.
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const WEEKDAYS = [
    [0, 'الأحد|الاحد|الحد|sunday'], [1, 'الاتنين|الإثنين|الاثنين|الأتنين|monday'], [2, 'التلات|الثلاثاء|الثلاثا|التلاتاء|tuesday'],
    [3, 'الأربع|الاربع|الأربعاء|الاربعاء|wednesday'], [4, 'الخميس|thursday'], [5, 'الجمعة|الجمعه|friday'], [6, 'السبت|saturday']
  ];
  function parseQuick(text, now = new Date()) {
    let s = ' ' + String(text || '').replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d)) + ' ';
    const out = { title: '', due: null, dueTime: null, estimate: null, priority: null, folder: null, person: null };
    const td = todayStr(now);
    const B = '(?<=^|[\\s،,.])', E = '(?=$|[\\s،,.])';
    const take = (re, fn) => { const m = s.match(re); if (!m) return false; if (fn(m) === false) return false; s = s.replace(m[0], ' '); return true; };
    // priority, folder, person
    take(new RegExp(`${B}!([1-4])${E}`), (m) => { out.priority = 'q' + m[1]; });
    take(/(?:^|\s)#([^\s#@!]+)/, (m) => { out.folder = m[1].replace(/_/g, ' '); });
    take(/(?:^|\s)@([^\s\d#@!][^\s#@!]*)/, (m) => { out.person = m[1].replace(/_/g, ' '); });
    // dates
    const rel = [
      ['(?:بعد بكرة|بعد بكره|بعد بكرا|the day after tomorrow|day after tomorrow|after tomorrow)', 2],
      ['(?:النهارده|النهاردة|النهارد|اليوم|today|tonight)', 0],
      ['(?:بكرة|بكره|بكرا|غدا|غداً|tomorrow|tmrw|tmr)', 1]
    ];
    for (const [w, n] of rel) if (take(new RegExp(`${B}${w}${E}`, 'i'), () => { out.due = hAdd(td, n); })) break;
    if (!out.due) take(new RegExp(`${B}(?:الأسبوع الجاي|الاسبوع الجاي|الأسبوع اللي جاي|next week)${E}`, 'i'), () => {
      const ws = (() => { const d = new Date(td + 'T00:00'); d.setDate(d.getDate() - ((d.getDay() - appWeekStart() + 7) % 7)); return todayStr(d); })();
      out.due = hAdd(ws, 7);
    });
    if (!out.due) for (const [dow, names] of WEEKDAYS) {
      if (take(new RegExp(`${B}(?:يوم |on |next )?(?:${names})${E}`, 'i'), () => {
        let n = (dow - hDow(td) + 7) % 7; if (n === 0) n = 7; out.due = hAdd(td, n);
      })) break;
    }
    if (!out.due) take(new RegExp(`${B}(?:في |on )?(\\d{1,2})[/\\-.](\\d{1,2})(?:[/\\-.](\\d{2,4}))?${E}`), (m) => {
      const day = +m[1], mon = +m[2];
      if (mon < 1 || mon > 12 || day < 1 || day > 31) return false;
      let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
      let d = `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!m[3] && d < td) d = `${y + 1}${d.slice(4)}`;
      out.due = d;
    });
    // time: "الساعة 3", "3:30", "3م", "3pm", "at 3"
    const MER = '(ص|م|صباحا|صباحاً|الصبح|مساء|مساءً|بالليل|الضهر|العصر|am|pm|a\\.m\\.|p\\.m\\.)';
    const setTime = (h, mi, mer) => {
      h = +h; mi = +(mi || 0);
      if (h > 23 || mi > 59) return false;
      const pm = mer && /^(م|مساء|مساءً|بالليل|العصر|pm|p\.m\.)$/i.test(mer);
      const am = mer && /^(ص|صباحا|صباحاً|الصبح|am|a\.m\.)$/i.test(mer);
      if (mer && /الضهر/.test(mer)) { if (h < 12) h += 12; if (h === 24) h = 12; }
      else if (pm && h < 12) h += 12;
      else if (am && h === 12) h = 0;
      else if (!mer && h >= 1 && h <= 7) h += 12; // "at 3" during a working day means the afternoon
      out.dueTime = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
    };
    take(new RegExp(`${B}(?:الساعة|الساعه)\\s*(\\d{1,2})(?::(\\d{2}))?\\s*${MER}?${E}`, 'i'), (m) => setTime(m[1], m[2], m[3])) ||
      // English "at 3" only when it's clearly a time: "at 3pm", "at 3:30", or at the very end
      take(new RegExp(`${B}at\\s*(\\d{1,2})(?::(\\d{2}))?\\s*${MER}?(?=\\s*$)`, 'i'), (m) => setTime(m[1], m[2], m[3])) ||
      take(new RegExp(`${B}at\\s*(\\d{1,2})\\s*${MER}${E}`, 'i'), (m) => setTime(m[1], 0, m[2])) ||
      take(new RegExp(`${B}at\\s*(\\d{1,2}):(\\d{2})${E}`, 'i'), (m) => setTime(m[1], m[2])) ||
      take(new RegExp(`${B}(\\d{1,2}):(\\d{2})\\s*${MER}?${E}`, 'i'), (m) => setTime(m[1], m[2], m[3])) ||
      take(new RegExp(`${B}(\\d{1,2})\\s*${MER}${E}`, 'i'), (m) => setTime(m[1], 0, m[2]));
    // how long it takes
    const durs = [
      ['(?:ساعة ونص|ساعه ونص|ساعة و نص)', () => 90], ['(?:ساعتين ونص)', () => 150], ['(?:ساعتين)', () => 120],
      ['(?:نص ساعة|نص ساعه|نصف ساعة|half an hour|half hour)', () => 30], ['(?:ربع ساعة|ربع ساعه|quarter of an hour)', () => 15],
      ['(?:for\\s*)?(\\d+(?:\\.\\d+)?)\\s*(?:ساعات|ساعة|ساعه|h|hr|hrs|hour|hours)', (m) => Math.round(+m[1] * 60)],
      ['(?:for\\s*)?(\\d+)\\s*(?:دقيقة|دقيقه|دقايق|دقائق|د|min|mins|minutes|minute|m)', (m) => +m[1]],
      ['(?:for an hour|an hour|ساعة|ساعه)', () => 60]
    ];
    for (const [w, fn] of durs) if (take(new RegExp(`${B}${w}${E}`, 'i'), (m) => { out.estimate = fn(m); })) break;
    out.title = s.replace(/\s+/g, ' ').trim().replace(/^(?:في|يوم|on|at|for|و)\s+|\s+(?:في|يوم|on|at|for|و)$/gi, '').trim();
    if (!out.title) out.title = String(text || '').trim(); // never lose what was typed
    return out;
  }

  // ---------- sync: merge two copies changed on two computers ----------
  // base = the copy both started from; ours / theirs = the two edited copies.
  // A record changed on one side only takes that side; changed on both, the newer one wins
  // (habits keep the days logged on both). Deleted on one side and untouched on the other: deleted.
  function merge3(base, ours, theirs) {
    base = base || {};
    const out = JSON.parse(JSON.stringify(theirs));
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const k of COLLECTIONS) {
      const B = new Map((base[k] || []).map((r) => [r.id, r]));
      const O = new Map((ours[k] || []).map((r) => [r.id, r]));
      const T = new Map((theirs[k] || []).map((r) => [r.id, r]));
      const ids = [...new Set([...(theirs[k] || []).map((r) => r.id), ...(ours[k] || []).map((r) => r.id)])];
      const list = [];
      for (const id of ids) {
        const b = B.get(id), o = O.get(id), t = T.get(id);
        if (o && t) {
          if (eq(o, t) || eq(o, b)) list.push(t);
          else if (eq(t, b)) list.push(o);
          else if (k === 'habits') {
            // Keep the things logged on both computers; a measure added on one side stays (else its numbers vanish).
            const ms = new Map((t.measures || []).map((m) => [m.id, m]));
            for (const m of o.measures || []) ms.set(m.id, m);
            const gone = new Set([...(b && b.measures || [])].map((m) => m.id).filter((id) => !(o.measures || []).some((m) => m.id === id) || !(t.measures || []).some((m) => m.id === id)));
            const entries = { ...(t.entries || {}), ...(o.entries || {}) };
            const measures = [...ms.values()].filter((m) => !gone.has(m.id) || Object.values(entries).some((e) => e.vals && e.vals[m.id] > 0));
            list.push({ ...t, ...o, log: { ...(t.log || {}), ...(o.log || {}) }, minutes: { ...(t.minutes || {}), ...(o.minutes || {}) }, entries, measures });
          }
          else list.push((o.updated || 0) >= (t.updated || 0) ? o : t);
        } else if (o && !t) { if (!b || !eq(o, b)) list.push(o); }   // new here, or changed here after they deleted it
        else if (t && !o) { if (!b || !eq(t, b)) list.push(t); }
      }
      out[k] = list;
    }
    out.settings = { ...(theirs.settings || {}) };
    for (const [key, v] of Object.entries(ours.settings || {})) if (!eq(v, (base.settings || {})[key])) out.settings[key] = v;
    for (const key of Object.keys(ours)) {
      if (COLLECTIONS.includes(key) || key === 'settings') continue;
      if (!eq(ours[key], base[key]) && (eq(theirs[key], base[key]) || key === 'focus')) out[key] = ours[key];
    }
    if (ours.focusLog || theirs.focusLog) {
      const seen = new Set(); out.focusLog = [...(theirs.focusLog || []), ...(ours.focusLog || [])].filter((l) => { const k2 = l.at + l.taskId; return !seen.has(k2) && seen.add(k2); }).sort((a, b) => a.at.localeCompare(b.at)).slice(-1000);
    }
    return out;
  }

  // ---------- calendar: side by side when blocks overlap ----------
  // events: [{ id, start, end }] in minutes → each gets { lane, lanes }.
  function layoutBlocks(events) {
    const ev = events.slice().sort((a, b) => a.start - b.start || b.end - a.end);
    let cluster = [], clusterEnd = -1;
    const flush = () => { const lanes = Math.max(1, ...cluster.map((e) => e.lane + 1)); cluster.forEach((e) => { e.lanes = lanes; }); cluster = []; };
    for (const e of ev) {
      if (e.start >= clusterEnd && cluster.length) flush();
      const used = new Set(cluster.filter((c) => c.end > e.start).map((c) => c.lane));
      let lane = 0; while (used.has(lane)) lane++;
      e.lane = lane; cluster.push(e); clusterEnd = Math.max(clusterEnd, e.end);
    }
    if (cluster.length) flush();
    return ev;
  }

  // ---------- the plan suggests itself ----------
  // Most pressing first (moved from yesterday, late, due today, important & urgent, starred…),
  // until the day is full (estimates; 30 min when unknown) or there are 5.
  function suggestPlan(tasks, capMins, opts = {}) {
    const td = opts.today || todayStr();
    const next = new Set(opts.fromYesterday || []);
    const score = (x) => {
      const st = statusOf(x, td);
      let s = 0;
      if (next.has(x.id)) s += 90;
      if (st === 'overdue') s += 100 + Math.min(30, daysBetween(x.due, td));
      if (st === 'today') s += 80 + (x.dueTime ? 5 : 0);
      s += { q1: 50, q2: 30, q3: 15, q4: 0 }[x.priority] || 10;
      if (x.starred) s += 20;
      if (x.due && st !== 'overdue' && st !== 'today') s += Math.max(0, 20 - daysBetween(td, x.due) * 4);
      return s;
    };
    const pool = tasks.filter((x) => !x.closure && statusOf(x, td) !== 'scheduled').map((x) => ({ x, s: score(x) })).sort((a, b) => b.s - a.s);
    const out = []; let mins = 0;
    for (const { x } of pool) {
      if (out.length >= (opts.max || 5)) break;
      const m = minutesLeft(x) ?? 30;
      if (out.length && mins + m > capMins) continue;
      out.push(x.id); mins += m;
    }
    return out;
  }

  return {
    todayStr, daysBetween, hAdd, hDow, shiftDate, uid, configure, appWeekStart,
    QUADS, QUAD_RANK, byPriorityThenDue, statusOf, isActive, topicLast, topicStale, minutesLeft, deferTo,
    hWeekStart, hLog, hMins, hDoneCount, hEnded, hLive, hActiveOn, hScheduled, hWeek, hTarget, hWeekVal, hPartial,
    habitsDueOn, habitStillDue, habitAddMinutes, habitSetEntry, habitEntry, habitLastStop, habitTotals,
    habitMeasuresFor, habitUsedBefore, habitTidyMeasures,
    habitWeekScore, habitsWeekScore,
    arCount, fmtMins, normText, matchText,
    makePatch, patchEmpty, applyPatch,
    parseQuick, merge3, layoutBlocks, suggestPlan
  };
});
