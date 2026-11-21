// Screen tests: start the real app hidden, with a throwaway data folder, let tests/smoke.renderer.js
// click through it, and fail if anything broke. Run: npm run smoke (also part of npm run dist).
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const electron = require('electron');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elfar-smoke-'));
const td = new Date(); const today = `${td.getFullYear()}-${String(td.getMonth() + 1).padStart(2, '0')}-${String(td.getDate()).padStart(2, '0')}`;
const task = (id, title, extra = {}) => ({ id, title, areaId: 'a1', start: today, due: today, closure: null, priority: 'q2', starred: false, pendingWith: [], notes: '', subtasks: [{ id: id + 's', title: 'step', done: false }], log: [], created: 1, updated: 1, ...extra });
// Nothing pops up: no widget, no reminders, no morning questions, no summary.
fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({
  version: 1,
  settings: { lang: 'en', widget: { visible: false, opacity: 1, filter: 'focus' }, summary: { enabled: false, time: '09:00' }, review: { enabled: false, time: '17:00' },
    nudgeDays: 3, zoom: 1, lastPlanAsk: today, lastHabitCheck: today, lastSeenVersion: '0', repeatStartsFixed: true, hbWeekFollow: true, planAuto: false },
  people: [{ id: 'p1', name: 'Sara', areaIds: [] }],
  areas: [{ id: 'a1', name: 'Work', color: 'blue', parentId: null }],
  tasks: [task('t1', 'Report'), task('t2', 'Slides', { priority: 'q1', estimate: 60 }), task('t3', 'Call', { due: null, pendingWith: [{ personId: 'p1', since: today }] })],
  habits: []
}));
const r = spawnSync(electron, ['.', '--hidden'], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, ELFAR_DATA_DIR: dir, ELFAR_SMOKE: path.join(__dirname, 'smoke.renderer.js') },
  encoding: 'utf8', timeout: 90000
});
const line = (r.stdout || '').split(/\r?\n/).find((l) => l.startsWith('SMOKE_RESULT '));
fs.rmSync(dir, { recursive: true, force: true });
if (!line) { console.error('Screen tests did not report back.', r.error || '', (r.stderr || '').slice(-1500)); process.exit(1); }
const res = JSON.parse(line.slice(13));
if (!res.ok) { console.error('Screen tests FAILED:\n - ' + res.failures.join('\n - ')); process.exit(1); }
console.log('Screen tests passed ✓');
