// Two computers sharing one data file (e.g. through OneDrive): neither should lose the other's changes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('changes from another computer are merged, not overwritten', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elfar-sync-'));
  const store = require('../src/store.js');
  store.init(dir, { lang: 'en' });
  const file = path.join(dir, 'data.json');
  const task = (id, title) => ({ id, title, start: '2026-11-21', due: null, closure: null, subtasks: [], log: [], pendingWith: [], updated: Date.now() });

  // This computer adds a task and saves.
  let d = JSON.parse(JSON.stringify(store.get()));
  d.tasks.push(task('mine1', 'from this computer'));
  store.replace(d); store.flush();
  await wait(50);

  // The other computer writes the file (adds its own task).
  const theirs = JSON.parse(fs.readFileSync(file, 'utf8'));
  theirs.tasks.push(task('theirs1', 'from the other computer'));
  fs.writeFileSync(file, JSON.stringify(theirs));
  await wait(2600); // the file watcher checks every 2 s
  assert.ok(store.get().tasks.some((x) => x.id === 'theirs1'), 'their task arrived');
  assert.ok(store.get().tasks.some((x) => x.id === 'mine1'), 'ours is still here');

  // Both change at the same moment: we have an unsaved change while they write.
  d = JSON.parse(JSON.stringify(store.get()));
  d.tasks.push(task('mine2', 'ours, not saved yet'));
  store.replace(d);                      // write pending
  const t2 = JSON.parse(fs.readFileSync(file, 'utf8'));
  t2.tasks.push(task('theirs2', 'theirs, written meanwhile'));
  await wait(20);
  fs.writeFileSync(file, JSON.stringify(t2));
  store.flush();                         // our write must merge, not overwrite
  const onDisk = JSON.parse(fs.readFileSync(file, 'utf8')).tasks.map((x) => x.id);
  for (const id of ['mine1', 'theirs1', 'mine2', 'theirs2']) assert.ok(onDisk.includes(id), id + ' kept');
  store.stop();
});
