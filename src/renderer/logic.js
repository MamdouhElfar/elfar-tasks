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
  const isActive = (x) => !x.closure && statusOf(x) !== 'scheduled';
  // Minutes of work left on a task: its estimate minus the time already focused on it.
  const minutesLeft = (x) => (x.estimate ? Math.max(0, Math.round(x.estimate - (x.focusMs || 0) / 60000)) : null);

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
  const COLLECTIONS = ['tasks', 'habits', 'areas', 'people'];
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

  return {
    todayStr, daysBetween, hAdd, hDow, shiftDate, uid, configure, appWeekStart,
    QUADS, QUAD_RANK, byPriorityThenDue, statusOf, isActive, minutesLeft,
    hWeekStart, hLog, hMins, hDoneCount, hEnded, hLive, hActiveOn, hScheduled, hWeek, hTarget, hWeekVal, hPartial,
    habitsDueOn, habitStillDue, habitAddMinutes,
    arCount, fmtMins,
    makePatch, patchEmpty, applyPatch
  };
});
