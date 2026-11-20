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
