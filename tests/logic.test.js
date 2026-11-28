// Tests for the shared rules (src/renderer/logic.js) and the wording helpers in common.js.
// Run: npm test   (they also run before every build)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('../src/renderer/logic.js');

// common.js is a browser script: load it in a small sandbox with the shared rules.
function loadCommon() {
  const sandbox = { ...L, console, document: { addEventListener() {}, documentElement: {} }, window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/renderer/common.js'), 'utf8') + '\n;this.__exports = { whenOf, daysWord, timesWord, fmtDate, I18N };', sandbox);
  return sandbox.__exports;
}
const C = loadCommon();
const TD = L.todayStr();
const plus = (n) => L.hAdd(TD, n);

test('dates', () => {
  assert.equal(L.todayStr(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(L.daysBetween('2026-01-01', '2026-01-31'), 30);
  assert.equal(L.hAdd('2026-02-28', 1), '2026-03-01');
  assert.equal(L.shiftDate('2026-01-31', 1, 'month'), '2026-02-28'); // no day 31 in Feb → last day
  assert.equal(L.shiftDate('2024-02-29', 1, 'year'), '2025-03-01');
  assert.equal(L.shiftDate('2026-11-20', 2, 'week'), '2026-12-04');
});

test('task status', () => {
  assert.equal(L.statusOf({ closure: TD }), 'closed');
  assert.equal(L.statusOf({ due: plus(-1) }), 'overdue');
  assert.equal(L.statusOf({ due: TD }), 'today');
  assert.equal(L.statusOf({ start: plus(3), due: plus(5) }), 'scheduled');
  assert.equal(L.statusOf({ start: plus(3), due: plus(-1) }), 'overdue'); // late beats "not started"
  assert.equal(L.statusOf({}), 'pending');
  assert.equal(L.isActive({ start: plus(2) }), false);
  const list = [{ priority: 'q3', due: plus(1) }, { priority: 'q1', due: plus(5) }, { due: plus(0) }, { priority: 'q1', due: plus(2) }];
  assert.deepEqual(list.sort(L.byPriorityThenDue).map((x) => `${x.priority}:${x.due}`), [`q1:${plus(2)}`, `q1:${plus(5)}`, `q3:${plus(1)}`, `undefined:${TD}`]);
  assert.equal(L.minutesLeft({ estimate: 60, focusMs: 45 * 60000 }), 15);
  assert.equal(L.minutesLeft({}), null);
});

test('moving a task to another day', () => {
  const late = { due: plus(-2), start: plus(-5) };
  assert.equal(L.deferTo(late, plus(1)), true);           // was late → counts as put off
  assert.equal(late.due, plus(1)); assert.equal(late.start, plus(1));
  assert.equal(L.statusOf(late), 'scheduled');            // gone from today until its day
  const later = { due: plus(5), start: TD };
  assert.equal(L.deferTo(later, plus(1)), false);          // due still ahead → not put off
  assert.equal(later.due, plus(5)); assert.equal(L.statusOf(later), 'scheduled');
  const none = {};
  assert.equal(L.deferTo(none, plus(2)), false); assert.equal(L.statusOf(none), 'scheduled');
});

test('words', () => {
  assert.equal(L.arCount(1, 'يوم', 'يومين', 'أيام', 'يوم'), 'يوم');
  assert.equal(L.arCount(2, 'يوم', 'يومين', 'أيام', 'يوم'), 'يومين');
  assert.equal(L.arCount(5, 'يوم', 'يومين', 'أيام', 'يوم'), '5 أيام');
  assert.equal(L.arCount(12, 'يوم', 'يومين', 'أيام', 'يوم'), '12 يوم');
  assert.equal(L.fmtMins(80, 'en'), '1h 20m');
  assert.equal(L.fmtMins(45, 'en'), '45m');
  assert.equal(L.fmtMins(120, 'ar'), 'ساعتين');
  assert.equal(L.fmtMins(90, 'ar'), 'ساعة و30 دقيقة');
  assert.equal(C.daysWord(3, 'ar'), '3 أيام');
  assert.equal(C.daysWord(1, 'en'), '1 day');
});

test('dates said in words', () => {
  assert.equal(C.whenOf({ due: plus(-2) }, 'en').text, '2 days late');
  assert.equal(C.whenOf({ due: plus(-2) }, 'ar').text, 'متأخرة يومين');
  assert.equal(C.whenOf({ due: TD }, 'en').cls, 'today');
  assert.equal(C.whenOf({ due: plus(1) }, 'en').text, 'Tomorrow');
  assert.equal(C.whenOf({ due: plus(1) }, 'ar').text, 'بكرة');
  assert.equal(C.whenOf({}, 'en'), null);
  assert.match(C.whenOf({ closure: TD }, 'en').text, /^Closed/);
});

test('habits: set days, partial days, ends', () => {
  const dow = L.hDow(TD);
  const h = { kind: 'days', days: [dow], start: plus(-30), duration: 120, log: {}, minutes: {}, end: { type: 'never' } };
  assert.equal(L.hScheduled(h, TD), true);
  assert.equal(L.hScheduled(h, plus(1)), false);
  L.habitAddMinutes(h, TD, 35);
  assert.equal(L.hLog(h, TD), null);
  assert.ok(Math.abs(L.hPartial(h, TD) - 35 / 120) < 1e-9);
  L.habitAddMinutes(h, TD, 85); // reaches the length → done
  assert.equal(L.hLog(h, TD), 'done');
  assert.equal(L.hPartial(h, TD), 0);
  assert.equal(L.habitStillDue(h, TD), false);
  const ended = { ...h, end: { type: 'count', count: 1 } };
  assert.equal(L.hEnded(ended), true);
  assert.equal(L.hLive({ ...h, archived: true }), false);
  assert.equal(L.hLive({ ...h, start: plus(3) }), false);
});

test('habits: weeks follow the chosen week start', () => {
  L.configure({ weekStart: () => 6 }); // Saturday
  assert.equal(L.hWeekStart({}, '2026-11-20'), '2026-11-14'); // Fri → previous Sat
  L.configure({ weekStart: () => 1 }); // Monday
  assert.equal(L.hWeekStart({}, '2026-11-20'), '2026-11-16');
  assert.equal(L.hWeekStart({ weekStart: 0 }, '2026-11-20'), '2026-11-15'); // a habit's own start wins
  L.configure({ weekStart: () => null });
  assert.equal(L.appWeekStart(), 6);
  const gym = { kind: 'times', perWeek: 3, start: '2026-01-01', log: { '2026-11-16': 'done', '2026-11-18': 'done' }, end: { type: 'never' } };
  const w = L.hWeek(gym, '2026-11-20', '2026-11-20');
  assert.equal(w.done, 2);
  assert.equal(L.habitStillDue(gym, '2026-11-20'), true);
  gym.log['2026-11-19'] = 'done';
  assert.equal(L.habitStillDue(gym, '2026-11-20'), false);
  assert.equal(L.habitsDueOn([gym], '2026-11-20').length, 0);
});

test('saving: only changes travel, and nothing the app wrote is lost', () => {
  const base = { settings: { lang: 'ar', zoom: 1 }, tasks: [{ id: 'a', t: 1 }, { id: 'b', t: 1 }], areas: [{ id: 'x' }, { id: 'y' }], habits: [], people: [], focus: null, plan: null };
  const mine = JSON.parse(JSON.stringify(base));
  mine.tasks[0].t = 2;                // edited a
  mine.tasks.push({ id: 'c', t: 1 }); // added c
  mine.areas.reverse();               // reordered folders
  mine.settings.zoom = 1.2;
  mine.plan = { date: TD, ids: ['a'] };
  const p = L.makePatch(base, mine);
  assert.deepEqual(p.sets.tasks.map((r) => r.id), ['a', 'c']);
  assert.deepEqual(p.order.areas, ['y', 'x']);
  assert.deepEqual(p.settings, { zoom: 1.2 });
  assert.ok(p.top.plan && !('focus' in p.top));
  // Meanwhile the app changed task b and started a focus session.
  const app = JSON.parse(JSON.stringify(base));
  app.tasks[1].t = 9;
  app.focus = { taskId: 'b' };
  const out = L.applyPatch(app, p);
  assert.deepEqual(out.tasks.map((r) => `${r.id}${r.t}`), ['a2', 'b9', 'c1']); // b9 kept
  assert.deepEqual(out.focus, { taskId: 'b' });
  assert.deepEqual(out.areas.map((r) => r.id), ['y', 'x']);
  assert.equal(out.settings.zoom, 1.2);
  // Deleting
  const del = JSON.parse(JSON.stringify(base)); del.tasks = del.tasks.filter((r) => r.id !== 'b');
  const p2 = L.makePatch(base, del);
  assert.deepEqual(p2.dels.tasks, ['b']);
  assert.ok(L.patchEmpty(L.makePatch(base, JSON.parse(JSON.stringify(base)))));
});

test('quick add understands a sentence', () => {
  const now = new Date(2026, 10, 21, 10, 0); // Saturday 21 Nov 2026
  let r = L.parseQuick('اتصل بأحمد بكرة الساعة 3 ساعة', now);
  assert.deepEqual([r.title, r.due, r.dueTime, r.estimate], ['اتصل بأحمد', '2026-11-22', '15:00', 60]);
  r = L.parseQuick('Call Ahmed tomorrow 3pm for 30 min !1 #Work @Sara', now);
  assert.deepEqual([r.title, r.due, r.dueTime, r.estimate, r.priority, r.folder, r.person], ['Call Ahmed', '2026-11-22', '15:00', 30, 'q1', 'Work', 'Sara']);
  r = L.parseQuick('مذاكرة ساعة ونص بعد بكرة', now);
  assert.deepEqual([r.title, r.due, r.estimate], ['مذاكرة', '2026-11-23', 90]);
  r = L.parseQuick('تقرير الخميس 10:30', now);
  assert.deepEqual([r.title, r.due, r.dueTime], ['تقرير', '2026-11-26', '10:30']);
  r = L.parseQuick('meeting 25/12 9am', now);
  assert.deepEqual([r.due, r.dueTime], ['2026-12-25', '09:00']);
  // ordinary words are left alone
  for (const q of ['look at 3 options', 'Fix the sun panel', 'buy milk']) assert.equal(L.parseQuick(q, now).title, q);
});

test('sync merges what changed on each computer', () => {
  const base = { settings: { zoom: 1 }, tasks: [{ id: 'a', v: 1, updated: 1 }, { id: 'b', v: 1, updated: 1 }, { id: 'c', v: 1, updated: 1 }], habits: [{ id: 'h', log: { d1: 'done' } }], areas: [], people: [] };
  const ours = JSON.parse(JSON.stringify(base)), theirs = JSON.parse(JSON.stringify(base));
  ours.tasks[0].v = 2; ours.tasks[0].updated = 5;              // a changed here
  theirs.tasks[1].v = 3; theirs.tasks[1].updated = 6;          // b changed there
  ours.tasks.push({ id: 'd', v: 1 });                          // d added here
  theirs.tasks = theirs.tasks.filter((x) => x.id !== 'c');     // c deleted there
  ours.habits[0].log.d2 = 'done'; theirs.habits[0].log.d3 = 'done'; // both logged a day
  ours.settings.zoom = 1.2;
  const m = L.merge3(base, ours, theirs);
  assert.deepEqual(m.tasks.map((x) => `${x.id}${x.v}`).sort(), ['a2', 'b3', 'd1']);
  assert.deepEqual(Object.keys(m.habits[0].log).sort(), ['d1', 'd2', 'd3']);
  assert.equal(m.settings.zoom, 1.2);
});

test('calendar blocks that overlap sit side by side', () => {
  const ev = L.layoutBlocks([{ id: 1, start: 540, end: 600 }, { id: 2, start: 570, end: 630 }, { id: 3, start: 700, end: 760 }]);
  const by = Object.fromEntries(ev.map((e) => [e.id, e]));
  assert.equal(by[1].lanes, 2); assert.equal(by[2].lanes, 2); assert.notEqual(by[1].lane, by[2].lane);
  assert.equal(by[3].lanes, 1);
});

test('the plan suggests what is most pressing and fits the day', () => {
  const td = '2026-11-21';
  const tasks = [
    { id: 'late', due: '2026-11-19', priority: 'q2', estimate: 60 },
    { id: 'today', due: td, priority: 'q3', estimate: 60 },
    { id: 'big', priority: 'q1', estimate: 400 },
    { id: 'later', start: '2026-11-25', due: '2026-11-26', priority: 'q1' },
    { id: 'done', closure: td, priority: 'q1' },
    { id: 'small', priority: 'q2', estimate: 30 }
  ];
  const ids = L.suggestPlan(tasks, 240, { today: td });
  assert.deepEqual(ids.slice(0, 2), ['late', 'today']);
  assert.ok(!ids.includes('later') && !ids.includes('done'));
  assert.ok(!ids.includes('big'));      // doesn't fit in the 4 hours left
  assert.ok(ids.includes('small'));
});

test('habit days: amounts, notes and where you stopped', () => {
  const h = { measures: [{ id: 'p', name: 'Pages', unit: 'pages' }, { id: 'pu', name: 'Push ups', unit: 'reps' }] };
  L.habitSetEntry(h, '2026-11-19', { vals: { p: 20 }, stop: 'Chapter 3, page 45' });
  L.habitSetEntry(h, '2026-11-20', { vals: { p: 15, pu: 30 }, note: 'good session' });
  L.habitSetEntry(h, '2026-11-21', { vals: { p: 0 }, note: '  ' });          // nothing real → no entry
  assert.equal(L.habitEntry(h, '2026-11-21'), null);
  assert.deepEqual(L.habitTotals(h, '2026-11-14', '2026-11-20'), { p: 35, pu: 30 });
  const last = L.habitLastStop(h, '2026-11-21');
  assert.equal(last.date, '2026-11-20'); assert.equal(last.note, 'good session');
  assert.equal(L.habitLastStop(h, '2026-11-20').stop, 'Chapter 3, page 45');
  assert.equal(L.habitLastStop(h, '2026-11-19'), null);
});

test('habit days: items for one day only', () => {
  const h = { measures: [{ id: 'q', name: 'Quran', unit: 'pages' }, { id: 'pu', name: 'Push ups', unit: 'reps', every: false }, { id: 'x', name: 'typo', unit: 'min', every: false }] };
  L.habitSetEntry(h, '2026-11-20', { vals: { q: 10, pu: 30 } });
  // every-day items show on every day; a day-only item only where it has a number
  assert.deepEqual(L.habitMeasuresFor(h, '2026-11-20').map((m) => m.id), ['q', 'pu']);
  assert.deepEqual(L.habitMeasuresFor(h, '2026-11-21').map((m) => m.id), ['q']);
  // and it is offered as "used before" on other days
  assert.deepEqual(L.habitUsedBefore(h, '2026-11-21').map((m) => m.id), ['pu']);
  // a day-only item with no number anywhere is removed
  L.habitTidyMeasures(h);
  assert.deepEqual(h.measures.map((m) => m.id), ['q', 'pu']);
});

test('sync keeps habit items added on both computers', () => {
  const base = { habits: [{ id: 'h', name: 'Gym', measures: [{ id: 'a', name: 'Min', unit: 'min' }], entries: {} }] };
  const ours = JSON.parse(JSON.stringify(base)); const theirs = JSON.parse(JSON.stringify(base));
  ours.habits[0].measures.push({ id: 'b', name: 'Push ups', unit: 'reps', every: false }); ours.habits[0].entries['2026-11-20'] = { vals: { b: 20 } };
  theirs.habits[0].measures.push({ id: 'c', name: 'Pull ups', unit: 'reps', every: false }); theirs.habits[0].entries['2026-11-21'] = { vals: { c: 8 } };
  const out = L.merge3(base, ours, theirs);
  assert.deepEqual(out.habits[0].measures.map((m) => m.id).sort(), ['a', 'b', 'c']);
});

test('habit week score for the charts', () => {
  const td = '2026-11-25'; // a Wednesday
  L.configure({ weekStart: () => 6 }); // weeks start on Saturday: 21 → 27 Nov
  const study = { kind: 'days', days: [0, 2, 4], start: '2026-11-01', duration: 60, end: { type: 'never' },
    log: { '2026-11-22': 'done' }, minutes: { '2026-11-24': 30 } }; // Sun done, Tue half, Thu not yet
  assert.equal(L.habitWeekScore(study, '2026-11-21', td), 0.75);
  const gym = { kind: 'times', perWeek: 4, start: '2026-11-01', end: { type: 'never' }, log: { '2026-11-21': 'done' } };
  assert.equal(L.habitWeekScore(gym, '2026-11-21', td), 0.25);
  assert.equal(L.habitWeekScore(gym, '2026-12-05', td), null);       // a week that hasn't come
  assert.equal(L.habitsWeekScore([study, gym], '2026-11-21', td), 0.5);
  L.configure({ weekStart: () => null });
});

test('search understands Arabic spelling', () => {
  assert.ok(L.matchText('اتصلت بأسامة بخصوص التقرير', 'اسامه'));
  assert.ok(L.matchText('Risk register من أيمن', 'ايمن risk'));
  assert.ok(L.matchText('صفحة ٤٥', '45'));
  assert.ok(!L.matchText('Weekly meeting', 'report'));
  assert.ok(!L.matchText('anything', '   '));
});

test('open items: last update and needs a look', () => {
  const x = { topic: true, start: '2026-11-01', checkEvery: 14, log: [{ date: '2026-11-10', at: '2026-11-10T09:00', text: 'met them' }] };
  assert.equal(L.topicLast(x), '2026-11-10');
  assert.equal(L.topicStale(x, '2026-11-20'), false);
  assert.equal(L.topicStale(x, '2026-11-24'), true);           // 14 days without an update
  assert.equal(L.isActive(x), false);                           // never on Today / plan / matrix as work
  x.log.push({ date: '2026-11-23', text: 'they replied' });
  assert.equal(L.topicStale(x, '2026-11-24'), false);           // an update resets it
  assert.equal(L.topicStale({ ...x, checkEvery: null }, '2027-01-01'), false);
});
